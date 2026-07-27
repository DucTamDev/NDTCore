# POS Bill Print via WebUSB (Xprinter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, independent "In qua USB" print path in the POS order history drawer that prints the bill directly to a USB-connected Xprinter via the WebUSB API, bypassing the Android Print Framework entirely (which currently fails to detect the printer and mis-sizes the paper on Android POS devices).

**Architecture:** A new `usb-printer.service.ts` owns a single `USBDevice` connection (hand-written `requestDevice`/`open`/`claimInterface`/`transferOut` — deliberately not using the `@point-of-sale/webusb-receipt-printer` package, whose device picker is restricted to a hardcoded vendor/product ID list that may not match this Xprinter). A new `build-bill-canvas.util.ts` renders the bill as a black-and-white `<canvas>` bitmap (avoids Xprinter's ESC/POS codepages, none of which support Vietnamese diacritics). `@point-of-sale/receipt-printer-encoder` turns that canvas into ESC/POS raster-image bytes, which `usb-printer.service.ts` sends over USB. A new `usePrintBillUsb.ts` composable orchestrates the flow and is wired to a new button in `PosOrderHistoryDrawer.vue`, sitting next to (not replacing) the existing `window.print()`-based "In bill" button.

**Tech Stack:** Vue 3 Composition API + TypeScript (strict) for FE; `@point-of-sale/receipt-printer-encoder` (npm) for ESC/POS command encoding; browser WebUSB API (hand-written glue, no wrapper library) for the USB transport.

**Spec:** `docs/superpowers/specs/2026-07-27-pos-bill-print-webusb-design.md`

## Global Constraints

- FE: TypeScript strict, no `any` (`.claude/rules/convention.md` §21).
- FE: run `cd NDTCore.FE && npm run type-check` and confirm zero errors before every commit (per `.claude/rules/git-workflow.md`).
- No automated test project exists in `NDTCore.FE` (zero `*.test.ts` files) — verification is via type-check plus manual browser/hardware steps, not automated tests.
- Comments only when the WHY is non-obvious — never explain WHAT the code does.
- Commit messages follow `<type>: <short description>` with types `feat`/`fix`/`refactor`/`docs`/`chore`/`test` (`.claude/rules/git-workflow.md`).
- This feature is purely additive to `NDTCore.FE` — no backend/DB changes, reuses the existing `posService.getOrderByIdAsync` and `usePosShiftStore` already used by `usePrintBill.ts`.
- WebUSB requires a secure context (HTTPS) and must be initiated by a genuine user gesture — `usbPrinterService.ensureConnected()` must always be the *first* awaited call inside `printBillUsb()`, before any other `await`, mirroring the pattern already used for `window.open()` popup-blocker avoidance elsewhere in this module.

---

## Task 1: Dependencies and TypeScript ambient types

**Files:**
- Modify: `NDTCore.FE/package.json` (via `npm install`, not manual edit)
- Modify: `NDTCore.FE/tsconfig.app.json:9`
- Create: `NDTCore.FE/src/modules/pos/types/receipt-printer-encoder.d.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: global `Navigator.usb`/`USBDevice`/`USBConfiguration`/`USBInterface`/`USBAlternateInterface`/`USBEndpoint`/`USBInTransferResult`/`USBOutTransferResult` types (from `@types/w3c-web-usb`, consumed by Task 5); a typed default export from `@point-of-sale/receipt-printer-encoder` (consumed by Task 6).

- [ ] **Step 1: Install the runtime dependency**

Run from `NDTCore.FE/`:
```bash
npm install @point-of-sale/receipt-printer-encoder
```
Expected: `package.json` `dependencies` gains `"@point-of-sale/receipt-printer-encoder": "^3.0.3"` (or newer patch), `package-lock.json` updates.

- [ ] **Step 2: Install the WebUSB type declarations as a dev dependency**

Run from `NDTCore.FE/`:
```bash
npm install -D @types/w3c-web-usb
```
Expected: `package.json` `devDependencies` gains `"@types/w3c-web-usb": "^1.0.14"` (or newer patch).

- [ ] **Step 3: Register the type package in tsconfig**

In `NDTCore.FE/tsconfig.app.json`, change line 9 from:
```json
    "types": ["node"],
```
to:
```json
    "types": ["node", "w3c-web-usb"],
```
This project restricts automatic `@types/*` inclusion to this explicit list (verified: `tsconfig.app.json` already has `"types": ["node"]`), so `@types/w3c-web-usb`'s global `Navigator.usb` augmentation would otherwise be silently ignored by `vue-tsc`.

- [ ] **Step 4: Add the ambient module declaration for the encoder package**

`@point-of-sale/receipt-printer-encoder` ships no `.d.ts` files (verified via `npm view @point-of-sale/receipt-printer-encoder types` — empty). Create `NDTCore.FE/src/modules/pos/types/receipt-printer-encoder.d.ts`:

```ts
declare module '@point-of-sale/receipt-printer-encoder' {
    export interface ReceiptPrinterEncoderOptions {
        language?: 'esc-pos' | 'star-prnt' | 'star-line'
    }

    export default class ReceiptPrinterEncoder {
        constructor(options?: ReceiptPrinterEncoderOptions)
        initialize(): this
        image(
            input: HTMLCanvasElement,
            width: number,
            height: number,
            algorithm?: 'threshold' | 'bayer' | 'floydsteinberg' | 'atkinson',
            threshold?: number,
        ): this
        cut(value?: 'partial' | 'full'): this
        encode(format?: 'commands' | 'lines' | 'array'): Uint8Array
    }
}
```

This declares exactly the subset of the real API this project uses (verified against the package's actual source in `dist/receipt-printer-encoder.mjs`: `image()` requires `width`/`height` to each be a multiple of 8 and accepts an `HTMLCanvasElement` directly as `input`; `encode()` with no `format` argument returns `Uint8Array`).

- [ ] **Step 5: Verify the type-check picks up both type sources**

Run:
```bash
cd NDTCore.FE && npm run type-check
```
Expected: `0` errors. If it reports `Property 'usb' does not exist on type 'Navigator'`, re-check Step 3 was saved correctly (this is the only expected failure mode for this task).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.app.json src/modules/pos/types/receipt-printer-encoder.d.ts
git commit -m "chore: add receipt-printer-encoder dependency and WebUSB ambient types"
```

---

## Task 2: Extract shared bill formatting helpers

**Files:**
- Create: `NDTCore.FE/src/modules/pos/utils/bill-format.util.ts`
- Modify: `NDTCore.FE/src/modules/pos/utils/build-bill-html.util.ts`

**Interfaces:**
- Consumes: `GetOrderItemOptionDto` (from `../models/dtos/pos-order.dto`, unchanged).
- Produces: `PAYMENT_METHOD_LABEL: Record<string, string>`, `SERVICE_TYPE_LABEL: Record<string, string>`, `formatCurrency(value: number): string`, `formatDateTime(iso: string | null): string`, `isSizeOption(o: GetOrderItemOptionDto): boolean`, `groupOptionsByGroupName(options: GetOrderItemOptionDto[]): { groupName: string; options: GetOrderItemOptionDto[] }[]` — consumed by both `build-bill-html.util.ts` (this task) and Task 3's `build-bill-canvas.util.ts`.

`build-bill-html.util.ts` and the new `build-bill-canvas.util.ts` (Task 3) render the same order data through two independent layout engines (HTML/CSS vs. canvas) — the two layouts must stay independent, but the plain data-formatting logic (currency/date formatting, option grouping, status labels) has nothing to do with which renderer is used, so it moves to one shared file instead of being duplicated.

- [ ] **Step 1: Create the shared helpers file**

```ts
import type { GetOrderItemOptionDto } from '../models/dtos/pos-order.dto'

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
    Cash: 'Tiền mặt',
    Card: 'Thẻ',
    Transfer: 'Chuyển khoản',
    EWallet: 'Ví điện tử',
}

export const SERVICE_TYPE_LABEL: Record<string, string> = {
    TakeAway: 'Mang đi',
    DineIn: 'Ngồi lại',
    Delivery: 'Giao hàng',
}

export function formatCurrency(value: number): string {
    return `${value.toLocaleString('vi-VN')}₫`
}

export function formatDateTime(iso: string | null): string {
    if (!iso) return ''
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function isSizeOption(o: GetOrderItemOptionDto): boolean {
    return (o.GroupName ?? '').toLowerCase() === 'size'
}

export function groupOptionsByGroupName(options: GetOrderItemOptionDto[]): { groupName: string; options: GetOrderItemOptionDto[] }[] {
    const map = new Map<string, { groupName: string; options: GetOrderItemOptionDto[] }>()
    for (const opt of options) {
        const key = opt.GroupName ?? ''
        if (!map.has(key)) {
            map.set(key, { groupName: opt.GroupName ?? '', options: [] })
        }
        map.get(key)!.options.push(opt)
    }
    return Array.from(map.values())
}
```

Save this as `NDTCore.FE/src/modules/pos/utils/bill-format.util.ts`.

- [ ] **Step 2: Update `build-bill-html.util.ts` to import the shared helpers instead of defining its own**

In `NDTCore.FE/src/modules/pos/utils/build-bill-html.util.ts`, change the top of the file from:
```ts
import { POS_PRINT_ROOT_ID } from '../constants/print-bill.constants'
import type { GetOrderDetailDto, GetOrderItemDto, GetOrderItemOptionDto } from '../models/dtos/pos-order.dto'

export interface BillStoreInfo {
    name: string
    address: string
    hotline: string | null
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
    Cash: 'Tiền mặt',
    Card: 'Thẻ',
    Transfer: 'Chuyển khoản',
    EWallet: 'Ví điện tử',
}

const SERVICE_TYPE_LABEL: Record<string, string> = {
    TakeAway: 'Mang đi',
    DineIn: 'Ngồi lại',
    Delivery: 'Giao hàng',
}

function formatCurrency(value: number): string {
    return `${value.toLocaleString('vi-VN')}₫`
}

function formatDateTime(iso: string | null): string {
    if (!iso) return ''
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function isSizeOption(o: GetOrderItemOptionDto): boolean {
    return (o.GroupName ?? '').toLowerCase() === 'size'
}

function groupOptionsByGroupName(options: GetOrderItemOptionDto[]): { groupName: string; options: GetOrderItemOptionDto[] }[] {
    const map = new Map<string, { groupName: string; options: GetOrderItemOptionDto[] }>()
    for (const opt of options) {
        const key = opt.GroupName ?? ''
        if (!map.has(key)) {
            map.set(key, { groupName: opt.GroupName ?? '', options: [] })
        }
        map.get(key)!.options.push(opt)
    }
    return Array.from(map.values())
}
```
to:
```ts
import { POS_PRINT_ROOT_ID } from '../constants/print-bill.constants'
import {
    PAYMENT_METHOD_LABEL,
    SERVICE_TYPE_LABEL,
    formatCurrency,
    formatDateTime,
    isSizeOption,
    groupOptionsByGroupName,
} from './bill-format.util'
import type { GetOrderDetailDto, GetOrderItemDto } from '../models/dtos/pos-order.dto'

export interface BillStoreInfo {
    name: string
    address: string
    hotline: string | null
}
```
The rest of the file (`renderItemBlock`, `buildBillHtml`, and everything below) is unchanged — it already calls `formatCurrency`, `formatDateTime`, `isSizeOption`, `groupOptionsByGroupName`, `PAYMENT_METHOD_LABEL`, and `SERVICE_TYPE_LABEL` by these exact names, which now resolve to the imports instead of local definitions. Note `GetOrderItemOptionDto` is dropped from this file's own type-only import since nothing in the remaining code references it directly by name (it was only used by the two functions that moved out).

- [ ] **Step 3: Verify compilation**

Run:
```bash
cd NDTCore.FE && npm run type-check
```
Expected: `0` errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/pos/utils/bill-format.util.ts src/modules/pos/utils/build-bill-html.util.ts
git commit -m "refactor: extract shared bill formatting helpers"
```

---

## Task 3: `buildBillCanvas` — render the bill as a black-and-white canvas

**Files:**
- Create: `NDTCore.FE/src/modules/pos/utils/build-bill-canvas.util.ts`

**Interfaces:**
- Consumes: `GetOrderDetailDto`, `GetOrderItemDto`, `GetOrderItemOptionDto` (from `../models/dtos/pos-order.dto`, unchanged); `BillStoreInfo` (from `../utils/build-bill-html.util`, unchanged: `{ name: string; address: string; hotline: string | null }`); `PAYMENT_METHOD_LABEL`, `SERVICE_TYPE_LABEL`, `formatCurrency`, `formatDateTime`, `isSizeOption`, `groupOptionsByGroupName` (Task 2's `bill-format.util.ts`).
- Produces: `buildBillCanvas(order: GetOrderDetailDto, store: BillStoreInfo): HTMLCanvasElement` — consumed by Task 6's `usePrintBillUsb`. Canvas `width` is always `576`; `height` is always a positive multiple of `8`.

- [ ] **Step 1: Create the file**

```ts
import type { GetOrderDetailDto, GetOrderItemDto, GetOrderItemOptionDto } from '../models/dtos/pos-order.dto'
import type { BillStoreInfo } from './build-bill-html.util'
import {
    PAYMENT_METHOD_LABEL,
    SERVICE_TYPE_LABEL,
    formatCurrency,
    formatDateTime,
    isSizeOption,
    groupOptionsByGroupName,
} from './bill-format.util'

const CANVAS_WIDTH = 576
const PADDING_X = 20
const CONTENT_WIDTH = CANVAS_WIDTH - PADDING_X * 2
const FONT_SIZE = 26
const SUB_FONT_SIZE = 22
const LINE_HEIGHT = 34
const SUB_LINE_HEIGHT = 28
const DIVIDER_HEIGHT = 20
const FONT = `${FONT_SIZE}px monospace`
const BOLD_FONT = `bold ${FONT_SIZE}px monospace`
const SUB_FONT = `${SUB_FONT_SIZE}px monospace`
const ITALIC_FONT = `italic ${SUB_FONT_SIZE}px monospace`

type DrawCommand =
    | { kind: 'line'; text: string; align: 'left' | 'center'; font: string; height: number }
    | { kind: 'row'; left: string; right: string; font: string; height: number }
    | { kind: 'divider' }

function createMeasureContext(): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Không tạo được canvas context.')
    return ctx
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, font: string, maxWidth: number): string[] {
    ctx.font = font
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
        const attempt = current ? `${current} ${word}` : word
        if (current && ctx.measureText(attempt).width > maxWidth) {
            lines.push(current)
            current = word
        } else {
            current = attempt
        }
    }
    lines.push(current)
    return lines
}

function renderItemCommands(ctx: CanvasRenderingContext2D, item: GetOrderItemDto, index: number): DrawCommand[] {
    const sizeOption = item.Options.find(isSizeOption)
    const sizeSuffix = sizeOption ? ` (${sizeOption.OptionName})` : ''
    const label = `${index}. ${item.ProductName}${sizeSuffix}`
    const amount = formatCurrency(item.LineNetAmount)

    const commands: DrawCommand[] = []
    ctx.font = FONT
    const wrappedLabel = wrapText(ctx, label, FONT, CONTENT_WIDTH - ctx.measureText(amount).width - 16)
    commands.push({ kind: 'row', left: wrappedLabel[0], right: amount, font: FONT, height: LINE_HEIGHT })
    for (const extraLine of wrappedLabel.slice(1)) {
        commands.push({ kind: 'line', text: extraLine, align: 'left', font: FONT, height: LINE_HEIGHT })
    }

    const toppingOptions = item.Options.filter((o) => !isSizeOption(o))
    for (const group of groupOptionsByGroupName(toppingOptions)) {
        const text = `  ${group.groupName ? `${group.groupName}: ` : ''}${group.options.map((o) => o.OptionName).join(', ')}`
        for (const line of wrapText(ctx, text, SUB_FONT, CONTENT_WIDTH)) {
            commands.push({ kind: 'line', text: line, align: 'left', font: SUB_FONT, height: SUB_LINE_HEIGHT })
        }
    }

    return commands
}

export function buildBillCanvas(order: GetOrderDetailDto, store: BillStoreInfo): HTMLCanvasElement {
    const measureCtx = createMeasureContext()
    const commands: DrawCommand[] = []

    commands.push({ kind: 'line', text: store.name, align: 'center', font: BOLD_FONT, height: LINE_HEIGHT })
    if (store.address) {
        for (const line of wrapText(measureCtx, store.address, SUB_FONT, CONTENT_WIDTH)) {
            commands.push({ kind: 'line', text: line, align: 'center', font: SUB_FONT, height: SUB_LINE_HEIGHT })
        }
    }
    if (store.hotline) {
        commands.push({ kind: 'line', text: `ĐT: ${store.hotline}`, align: 'center', font: SUB_FONT, height: SUB_LINE_HEIGHT })
    }
    commands.push({ kind: 'divider' })

    commands.push({ kind: 'row', left: 'Mã đơn', right: `#${order.OrderNumber}`, font: FONT, height: LINE_HEIGHT })
    commands.push({ kind: 'row', left: 'Thời gian', right: formatDateTime(order.CreatedAt), font: FONT, height: LINE_HEIGHT })
    commands.push({
        kind: 'row',
        left: 'Hình thức',
        right: SERVICE_TYPE_LABEL[order.ServiceType] ?? order.ServiceType,
        font: FONT,
        height: LINE_HEIGHT,
    })
    commands.push({ kind: 'divider' })

    commands.push({ kind: 'line', text: 'SẢN PHẨM', align: 'left', font: BOLD_FONT, height: LINE_HEIGHT })
    const totalQuantity = order.Items.reduce((sum, item) => sum + item.Quantity, 0)
    order.Items.forEach((item, idx) => {
        commands.push(...renderItemCommands(measureCtx, item, idx + 1))
    })
    commands.push({ kind: 'divider' })

    commands.push({ kind: 'row', left: 'Tổng số lượng', right: String(totalQuantity), font: FONT, height: LINE_HEIGHT })
    commands.push({ kind: 'row', left: 'Thành tiền', right: formatCurrency(order.Subtotal), font: FONT, height: LINE_HEIGHT })
    if (order.DiscountAmount > 0) {
        commands.push({ kind: 'row', left: 'Giảm giá', right: `-${formatCurrency(order.DiscountAmount)}`, font: FONT, height: LINE_HEIGHT })
    }
    if (order.DeliveryFee > 0) {
        commands.push({ kind: 'row', left: 'Phí giao hàng', right: formatCurrency(order.DeliveryFee), font: FONT, height: LINE_HEIGHT })
    }
    commands.push({ kind: 'divider' })
    commands.push({
        kind: 'row',
        left: 'TỔNG THANH TOÁN',
        right: formatCurrency(order.TotalAmount),
        font: BOLD_FONT,
        height: LINE_HEIGHT,
    })
    commands.push({ kind: 'divider' })

    const paymentMethodLabel = order.PaymentMethod ? PAYMENT_METHOD_LABEL[order.PaymentMethod] ?? order.PaymentMethod : ''
    commands.push({ kind: 'row', left: 'Phương thức', right: paymentMethodLabel, font: FONT, height: LINE_HEIGHT })
    if (order.PaymentMethod === 'Cash' && order.AmountReceived !== null && order.ChangeAmount !== null) {
        commands.push({ kind: 'row', left: 'Số tiền nhận', right: formatCurrency(order.AmountReceived), font: FONT, height: LINE_HEIGHT })
        commands.push({ kind: 'row', left: 'Tiền thừa', right: formatCurrency(order.ChangeAmount), font: FONT, height: LINE_HEIGHT })
    }
    commands.push({ kind: 'divider' })
    commands.push({
        kind: 'line',
        text: 'Cảm ơn quý khách! Hẹn gặp lại lần sau',
        align: 'center',
        font: ITALIC_FONT,
        height: LINE_HEIGHT,
    })

    const contentHeight = commands.reduce((sum, cmd) => sum + (cmd.kind === 'divider' ? DIVIDER_HEIGHT : cmd.height), 0)
    const rawHeight = PADDING_X + contentHeight + PADDING_X
    const canvasHeight = Math.ceil(rawHeight / 8) * 8

    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_WIDTH
    canvas.height = canvasHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Không tạo được canvas context.')

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight)
    ctx.fillStyle = '#000'
    ctx.textBaseline = 'middle'

    let y = PADDING_X
    for (const cmd of commands) {
        if (cmd.kind === 'divider') {
            ctx.strokeStyle = '#000'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(PADDING_X, y + DIVIDER_HEIGHT / 2)
            ctx.lineTo(CANVAS_WIDTH - PADDING_X, y + DIVIDER_HEIGHT / 2)
            ctx.stroke()
            y += DIVIDER_HEIGHT
            continue
        }

        ctx.font = cmd.font
        if (cmd.kind === 'line') {
            ctx.textAlign = cmd.align
            const x = cmd.align === 'center' ? CANVAS_WIDTH / 2 : PADDING_X
            ctx.fillText(cmd.text, x, y + cmd.height / 2)
        } else {
            ctx.textAlign = 'left'
            ctx.fillText(cmd.left, PADDING_X, y + cmd.height / 2)
            ctx.textAlign = 'right'
            ctx.fillText(cmd.right, CANVAS_WIDTH - PADDING_X, y + cmd.height / 2)
        }
        y += cmd.height
    }

    return canvas
}
```

Note: this canvas layout is a deliberately simpler, single-font-size rendering of the same bill data as `build-bill-html.util.ts` — it does not need to be pixel-identical to the HTML/CSS bill, since the two print paths are fully independent (per spec §4).

- [ ] **Step 2: Verify compilation**

Run:
```bash
cd NDTCore.FE && npm run type-check
```
Expected: `0` errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/pos/utils/build-bill-canvas.util.ts
git commit -m "feat: add canvas bill renderer for USB thermal printing"
```

---

## Task 4: Storage key for the last-connected USB printer

**Files:**
- Modify: `NDTCore.FE/src/core/storage/storage.constant.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `STORAGE_KEYS.POS_USB_PRINTER_DEVICE` — consumed by Task 5's `usb-printer.service.ts`.

- [ ] **Step 1: Add the key**

Change `NDTCore.FE/src/core/storage/storage.constant.ts` from:
```ts
export const STORAGE_KEYS = {
    AUTH_TOKENS: 'auth.tokens',
    USER: 'auth.user',
} as const
```
to:
```ts
export const STORAGE_KEYS = {
    AUTH_TOKENS: 'auth.tokens',
    USER: 'auth.user',
    POS_USB_PRINTER_DEVICE: 'pos.usbPrinterDevice',
} as const
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
cd NDTCore.FE && npm run type-check
```
Expected: `0` errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/storage/storage.constant.ts
git commit -m "feat: add storage key for last-connected USB printer device"
```

---

## Task 5: `usb-printer.service.ts` — WebUSB connect/reconnect/print

**Files:**
- Create: `NDTCore.FE/src/modules/pos/services/usb-printer.service.ts`

**Interfaces:**
- Consumes: `storageService` (from `@/core/storage/storage.service`, existing: `get<T>(key): T | null`, `set<T>(key, value): void`), `STORAGE_KEYS.POS_USB_PRINTER_DEVICE` (Task 4), global `navigator.usb`/`USBDevice` types (Task 1).
- Produces: `usbPrinterService.ensureConnected(): Promise<void>` and `usbPrinterService.print(data: Uint8Array): Promise<void>` — both consumed by Task 6's `usePrintBillUsb`. `ensureConnected()` throws a plain `Error` with a Vietnamese message on any failure (unsupported browser, no device selected, no OUT endpoint found); `print()` throws if called before a successful `ensureConnected()`.

- [ ] **Step 1: Create the file**

```ts
import { storageService } from '@/core/storage/storage.service'
import { STORAGE_KEYS } from '@/core/storage/storage.constant'

interface StoredUsbPrinterDevice {
    serialNumber: string | undefined
    vendorId: number
    productId: number
}

const CHUNK_SIZE = 4096

let connectedDevice: USBDevice | null = null
let outEndpointNumber: number | null = null

function findBulkOutEndpoint(device: USBDevice): { interfaceNumber: number; endpointNumber: number } | null {
    const configuration = device.configuration
    if (!configuration) return null

    for (const iface of configuration.interfaces) {
        const outEndpoint = iface.alternate.endpoints.find((e) => e.direction === 'out')
        if (outEndpoint) {
            return { interfaceNumber: iface.interfaceNumber, endpointNumber: outEndpoint.endpointNumber }
        }
    }
    return null
}

async function openDevice(device: USBDevice): Promise<void> {
    await device.open()

    if (!device.configuration) {
        const configurationValue = device.configurations[0]?.configurationValue
        if (configurationValue === undefined) {
            throw new Error('Thiết bị USB không có configuration khả dụng.')
        }
        await device.selectConfiguration(configurationValue)
    }

    const found = findBulkOutEndpoint(device)
    if (!found) {
        throw new Error('Không tìm thấy cổng gửi dữ liệu (OUT endpoint) trên thiết bị USB này.')
    }
    await device.claimInterface(found.interfaceNumber)

    connectedDevice = device
    outEndpointNumber = found.endpointNumber

    storageService.set<StoredUsbPrinterDevice>(STORAGE_KEYS.POS_USB_PRINTER_DEVICE, {
        serialNumber: device.serialNumber,
        vendorId: device.vendorId,
        productId: device.productId,
    })
}

async function tryReconnect(): Promise<boolean> {
    const saved = storageService.get<StoredUsbPrinterDevice>(STORAGE_KEYS.POS_USB_PRINTER_DEVICE)
    if (!saved) return false

    const devices = await navigator.usb.getDevices()
    const match =
        (saved.serialNumber && devices.find((d) => d.serialNumber === saved.serialNumber)) ||
        devices.find((d) => d.vendorId === saved.vendorId && d.productId === saved.productId)

    if (!match) return false

    await openDevice(match)
    return true
}

export const usbPrinterService = {
    async ensureConnected(): Promise<void> {
        if (connectedDevice) return

        if (!('usb' in navigator)) {
            throw new Error('Trình duyệt không hỗ trợ WebUSB.')
        }

        if (await tryReconnect()) return

        const device = await navigator.usb.requestDevice({ filters: [{}] })
        await openDevice(device)
    },

    async print(data: Uint8Array): Promise<void> {
        if (!connectedDevice || outEndpointNumber === null) {
            throw new Error('Chưa kết nối máy in USB.')
        }

        for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
            const chunk = data.subarray(offset, offset + CHUNK_SIZE)
            const result = await connectedDevice.transferOut(outEndpointNumber, chunk)
            if (result.status !== 'ok') {
                throw new Error(`Gửi lệnh in thất bại: ${result.status}`)
            }
        }
    },
}
```

Note on `requestDevice({ filters: [{}] })`: a single filter object with no properties matches every USB device — this intentionally shows the full device list in Chrome's picker instead of the closed vendor/product ID list that `@point-of-sale/webusb-receipt-printer` hardcodes (see spec §2 for why that library was rejected).

- [ ] **Step 2: Verify compilation**

Run:
```bash
cd NDTCore.FE && npm run type-check
```
Expected: `0` errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/pos/services/usb-printer.service.ts
git commit -m "feat: add WebUSB printer connect/reconnect/print service"
```

---

## Task 6: `usePrintBillUsb` composable

**Files:**
- Create: `NDTCore.FE/src/modules/pos/composables/usePrintBillUsb.ts`

**Interfaces:**
- Consumes: `usbPrinterService` (Task 5), `buildBillCanvas` (Task 3), `posService.getOrderByIdAsync(id: number): Promise<GetOrderDetailDto | null>` (existing, unchanged), `usePosShiftStore()` (existing: `storeName`, `address`, `hotline`), `useToastNotification()` (existing), `ReceiptPrinterEncoder` (Task 1's ambient type over the Task 1 npm package).
- Produces: `usePrintBillUsb(): { isPrinting: Ref<boolean>; printBillUsb: (orderId: number) => Promise<void> }` — consumed by Task 7's `PosOrderHistoryDrawer.vue`.

- [ ] **Step 1: Create the file**

```ts
import { ref } from 'vue'
import { useToastNotification } from '@/composables/useToastNotification'
import { posService } from '../services/pos.service'
import { usePosShiftStore } from '../stores/pos-shift.store'
import { buildBillCanvas } from '../utils/build-bill-canvas.util'
import { usbPrinterService } from '../services/usb-printer.service'
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'

export function usePrintBillUsb() {
    const toast = useToastNotification()
    const shiftStore = usePosShiftStore()
    const isPrinting = ref(false)

    async function printBillUsb(orderId: number): Promise<void> {
        isPrinting.value = true
        try {
            await usbPrinterService.ensureConnected()

            const order = await posService.getOrderByIdAsync(orderId)
            if (!order) {
                toast.error('Không tải được chi tiết đơn hàng.')
                return
            }

            const canvas = buildBillCanvas(order, {
                name: shiftStore.storeName,
                address: shiftStore.address,
                hotline: shiftStore.hotline,
            })

            const data = new ReceiptPrinterEncoder({ language: 'esc-pos' })
                .initialize()
                .image(canvas, canvas.width, canvas.height, 'threshold')
                .cut()
                .encode()

            await usbPrinterService.print(data)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'In bill qua USB thất bại.')
        } finally {
            isPrinting.value = false
        }
    }

    return { isPrinting, printBillUsb }
}
```

`ensureConnected()` is the first `await` in the function (before `getOrderByIdAsync`) so that when it needs to call `requestDevice()` (no device connected/saved yet), it still runs within the transient user-activation window of the button click — see Global Constraints.

- [ ] **Step 2: Verify compilation**

Run:
```bash
cd NDTCore.FE && npm run type-check
```
Expected: `0` errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/pos/composables/usePrintBillUsb.ts
git commit -m "feat: add usePrintBillUsb composable"
```

---

## Task 7: "In qua USB" button in `PosOrderHistoryDrawer.vue`

**Files:**
- Modify: `NDTCore.FE/src/modules/pos/components/PosOrderHistoryDrawer.vue`

**Interfaces:**
- Consumes: `usePrintBillUsb()` (Task 6).
- Produces: visible UI — terminal task, nothing else depends on it.

- [ ] **Step 1: Import and call the composable**

In `NDTCore.FE/src/modules/pos/components/PosOrderHistoryDrawer.vue`, change:
```ts
import { usePrintBill } from '../composables/usePrintBill'
```
to:
```ts
import { usePrintBill } from '../composables/usePrintBill'
import { usePrintBillUsb } from '../composables/usePrintBillUsb'
```

Change:
```ts
const { isPrinting, printBill } = usePrintBill()
```
to:
```ts
const { isPrinting, printBill } = usePrintBill()
const { isPrinting: isPrintingUsb, printBillUsb } = usePrintBillUsb()
```

- [ ] **Step 2: Add the second button**

In the same file, change the `#append` template block from:
```vue
              <template #append v-if="order.Status !== 'Cancelled'">
                <v-btn
                  icon="mdi-printer-outline"
                  variant="text"
                  size="small"
                  :loading="isPrinting"
                  @click="printBill(order.Id)"
                />
              </template>
```
to:
```vue
              <template #append v-if="order.Status !== 'Cancelled'">
                <v-btn
                  icon="mdi-printer-outline"
                  variant="text"
                  size="small"
                  :loading="isPrinting"
                  @click="printBill(order.Id)"
                />
                <v-btn
                  icon="mdi-usb"
                  variant="text"
                  size="small"
                  :loading="isPrintingUsb"
                  @click="printBillUsb(order.Id)"
                />
              </template>
```

- [ ] **Step 3: Type-check**

Run:
```bash
cd NDTCore.FE && npm run type-check
```
Expected: `0` errors.

- [ ] **Step 4: Manual browser + hardware verification**

Run:
```bash
cd NDTCore.FE && npm run dev
```
On the Android POS device (Chrome), open the POS screen, open the order-history drawer, and tap the new USB icon next to a non-cancelled order. Confirm:
- The button is hidden for orders with status "Đã huỷ" (same as the existing print button).
- First tap opens Chrome's USB device picker listing the Xprinter; selecting it and confirming triggers a print with the bill content readable and correctly cut.
- A second tap (same session or after reloading the page) prints without showing the device picker again (silent reconnect via the stored device info).
- Unplugging the printer and tapping the button shows a Vietnamese error toast, and does **not** fall back to opening the regular print dialog.

Stop the dev server (Ctrl+C) when done.

- [ ] **Step 5: Commit**

```bash
git add src/modules/pos/components/PosOrderHistoryDrawer.vue
git commit -m "feat: add print-bill-via-USB button to POS order history drawer"
```
