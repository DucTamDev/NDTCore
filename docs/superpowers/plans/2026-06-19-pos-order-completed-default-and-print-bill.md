# POS Order Default Completed & Print-Bill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make POS-created orders default to `Completed` status, and add a "Print bill" button (plain browser `window.print()`, no QZ Tray) to each non-cancelled order in the POS Order History drawer.

**Architecture:** One-line BE status default change; a new `GET api/pos/orders/{id}` action on `PosController` that reuses the existing `GetOrderByIdQuery`/handler unchanged; 4 new address fields surfaced on the existing POS store-status response; on FE, a new typed DTO + service method fetch order detail, a pure `buildBillHtml()` util renders a self-contained HTML bill, a pure `printHtmlViaIframe()` util prints it via a hidden iframe (no popup blocker), and a `usePrintBill()` composable wires it all together behind a button in `PosOrderHistoryDrawer.vue`.

**Tech Stack:** .NET 8 (MediatR, EF Core) for BE; Vue 3 Composition API + TypeScript + Vuetify 3 + Pinia for FE.

**Spec:** `docs/superpowers/specs/2026-06-19-pos-order-completed-default-and-print-bill-design.md`

## Global Constraints

- BE: every `class`/`interface`/`method`/`property` (including `private`) needs bilingual VN/EN XML doc (`/// <summary>VN: ... <br /> EN: ...</summary>`); use `<inheritdoc/>` for interface implementations.
- BE: run `cd NDTCore.BE/src && dotnet build NDTCore.sln` and confirm it succeeds before every commit (per `.claude/rules/git-workflow.md`).
- FE: run `cd NDTCore.FE && npx vue-tsc --build` and confirm zero errors before every commit (per `.claude/rules/git-workflow.md`).
- FE: TypeScript strict, no `any`; DTOs are PascalCase and mirror the backend contract field-for-field, no renaming (`.claude/rules/convention.md` §9).
- No automated test project exists anywhere in this repo (confirmed: zero `*.Tests` projects in BE, zero `*.test.ts` files in FE) — verification in this plan is via build/type-check plus concrete manual steps (curl/Swagger/browser), not automated tests. Do not invent a test framework.
- Commit messages follow `<type>: <short description>` with types `feat`/`fix`/`refactor`/`docs`/`chore`/`test` (`.claude/rules/git-workflow.md`).
- Comments only when the WHY is non-obvious — never explain WHAT the code does.

---

## Task 1: BE — Order status defaults to Completed on creation

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommandHandler.cs:100`

**Interfaces:**
- Consumes: nothing new — `OrderStatus.Completed` already exists in `NDTCore.Order.Domain.Constants.OrderStatus` (already imported via `using NDTCore.Order.Domain.Constants;` at the top of this file).
- Produces: every order created via `CreateOrderCommandHandler` now has `Status = "Completed"` instead of `"Pending"`. No other task depends on this directly, but Task 2's endpoint will return whatever status is now set here.

- [ ] **Step 1: Change the status assignment**

In the `OrderEntity` initializer inside `Handle`, change:

```csharp
Status = OrderStatus.Pending,
```

to:

```csharp
Status = OrderStatus.Completed,
```

- [ ] **Step 2: Build and verify**

Run:
```bash
cd NDTCore.BE/src && dotnet build NDTCore.sln
```
Expected: `Build succeeded.` with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommandHandler.cs
git commit -m "feat: default POS order status to Completed on creation"
```

---

## Task 2: BE — `GET api/pos/orders/{id}` endpoint for order detail

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.API/Controllers/Modules/Pos/PosController.cs`

**Interfaces:**
- Consumes: existing `GetOrderByIdQuery(int OrderId) : IQuery<GetOrderResponse>` from `NDTCore.Order.Application.Features.Orders.GetOrderById` (unchanged, already has a handler).
- Produces: `GET api/pos/orders/{id}` → `GetOrderResponse` JSON (fields: `Id, TenantId, StoreId, OrderNumber, Status, Channel, CustomerName, CustomerPhone, Note, Subtotal, DiscountAmount, TaxAmount, TotalAmount, PaymentMethod, PaymentStatus, PaidAt, CancelledAt, CancelledReason, CreatedAt, CreatedBy, UpdatedAt, UpdatedBy, Items[]` where each item has `Id, ProductId, ProductCode, ProductName, RegularPrice, OptionsAmount, SalePrice, Quantity, LineAmount, DiscountAmount, LineNetAmount, Note, Options[]` and each option has `Id, OptionId, GroupName, OptionName, Price`). This exact shape is consumed by FE Task 4's `GetOrderDetailDto`.

- [ ] **Step 1: Add the using statement**

After line 6 (`using NDTCore.Order.Application.Features.Orders.CreateOrder;`), add:

```csharp
using NDTCore.Order.Application.Features.Orders.GetOrderById;
```

- [ ] **Step 2: Add the action**

Insert this new action right after `CreateOrder` and before `GetOrderHistory`:

```csharp
    /// <summary>
    /// VN: Lấy chi tiết một đơn hàng theo id cho màn hình POS (ví dụ: in bill). <br />
    /// EN: Gets full order detail by id for the POS screen (e.g. printing a bill).
    /// </summary>
    /// <param name="id">VN: Định danh đơn hàng. EN: Order identifier.</param>
    /// <param name="cancellationToken"><inheritdoc/></param>
    [HttpGet("orders/{id:int}")]
    public async Task<IActionResult> GetOrderById(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetOrderByIdQuery(id), cancellationToken);
        return StatusResult(result);
    }
```

- [ ] **Step 3: Build and verify**

Run:
```bash
cd NDTCore.BE/src && dotnet build NDTCore.sln
```
Expected: `Build succeeded.` with 0 errors.

- [ ] **Step 4: Manual verify via Swagger**

Run:
```bash
cd NDTCore.BE/src/NDTCore.API && dotnet run
```
Open the Swagger UI URL printed in the console output. Confirm a new `GET /api/pos/orders/{id}` operation appears under the Pos tag, and (with a valid Cashier/StoreManager/etc. bearer token and an existing order id) it returns 200 with the `GetOrderResponse` shape described above. Stop the server (Ctrl+C) when done.

- [ ] **Step 5: Commit**

```bash
git add NDTCore.BE/src/NDTCore.API/Controllers/Modules/Pos/PosController.cs
git commit -m "feat: add GET api/pos/orders/{id} endpoint for POS order detail"
```

---

## Task 3: BE — Store address fields on POS store-status response

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Pos/PosStoreStatusResponse.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Pos/GetPosStoreStatus/GetPosStoreStatusQueryHandler.cs`

**Interfaces:**
- Consumes: existing `AppStore` entity properties `Address`, `City`, `District`, `Province` (all `string?`, confirmed in `NDTCore.Store.Domain.Entities.AppStore`).
- Produces: `PosStoreStatusResponse` gains `Address`, `City`, `District`, `Province` (`string?`). Consumed by FE Task 4's extended `PosStoreStatusDto`.

- [ ] **Step 1: Add properties to the response record**

In `PosStoreStatusResponse.cs`, insert after the `LogoUrl` property (after line 25) and before `IsAcceptingOrders`:

```csharp
    /// <summary>
    /// VN: Địa chỉ đường phố của cửa hàng; <see langword="null"/> nếu chưa thiết lập. <br />
    /// EN: Store street address; <see langword="null"/> if not set.
    /// </summary>
    public string? Address { get; init; }

    /// <summary>
    /// VN: Thành phố của cửa hàng; <see langword="null"/> nếu chưa thiết lập. <br />
    /// EN: Store city; <see langword="null"/> if not set.
    /// </summary>
    public string? City { get; init; }

    /// <summary>
    /// VN: Quận/Huyện của cửa hàng; <see langword="null"/> nếu chưa thiết lập. <br />
    /// EN: Store district; <see langword="null"/> if not set.
    /// </summary>
    public string? District { get; init; }

    /// <summary>
    /// VN: Tỉnh/Thành phố của cửa hàng; <see langword="null"/> nếu chưa thiết lập. <br />
    /// EN: Store province; <see langword="null"/> if not set.
    /// </summary>
    public string? Province { get; init; }
```

- [ ] **Step 2: Map the fields in the handler**

In `GetPosStoreStatusQueryHandler.cs`, in the `MapToResponse`-equivalent object initializer (the `Result<PosStoreStatusResponse>.Success(new PosStoreStatusResponse { ... })` block), change:

```csharp
        return Result<PosStoreStatusResponse>.Success(new PosStoreStatusResponse
        {
            StoreId           = store.Id,
            StoreName         = store.Name,
            LogoUrl           = store.LogoUrl,
            IsAcceptingOrders = store.IsAcceptingOrders,
            HasOpenShift      = true,  // Shift management not yet implemented — always open
            ShiftId           = null,
            ShiftOpenedAt     = null,
            ShiftOpenedBy     = null,
        });
```

to:

```csharp
        return Result<PosStoreStatusResponse>.Success(new PosStoreStatusResponse
        {
            StoreId           = store.Id,
            StoreName         = store.Name,
            LogoUrl           = store.LogoUrl,
            Address           = store.Address,
            City              = store.City,
            District          = store.District,
            Province          = store.Province,
            IsAcceptingOrders = store.IsAcceptingOrders,
            HasOpenShift      = true,  // Shift management not yet implemented — always open
            ShiftId           = null,
            ShiftOpenedAt     = null,
            ShiftOpenedBy     = null,
        });
```

- [ ] **Step 3: Build and verify**

Run:
```bash
cd NDTCore.BE/src && dotnet build NDTCore.sln
```
Expected: `Build succeeded.` with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Pos/PosStoreStatusResponse.cs NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Pos/GetPosStoreStatus/GetPosStoreStatusQueryHandler.cs
git commit -m "feat: include store address fields in POS store status response"
```

---

## Task 4: FE — Order-detail DTOs + store address fields

**Files:**
- Modify: `NDTCore.FE/src/modules/pos/models/dtos/pos-order.dto.ts`
- Modify: `NDTCore.FE/src/modules/pos/models/dtos/pos-shift.dto.ts`
- Modify: `NDTCore.FE/src/modules/pos/stores/pos-shift.store.ts`

**Interfaces:**
- Consumes: BE contract shapes from Task 2 (`GetOrderResponse`/`GetOrderItemResponse`/`GetOrderItemOptionResponse`) and Task 3 (`PosStoreStatusResponse.Address/City/District/Province`).
- Produces: `GetOrderDetailDto`, `GetOrderItemDto`, `GetOrderItemOptionDto` (consumed by Task 5's service and Task 6's `buildBillHtml`); `PosStoreStatusDto.{Address,City,District,Province}`; `usePosShiftStore().address: ComputedRef<string>` (consumed by Task 7's composable).

- [ ] **Step 1: Append order-detail DTOs**

At the end of `pos-order.dto.ts`, append:

```ts
export interface GetOrderItemOptionDto {
    Id: number
    OptionId: number
    GroupName: string | null
    OptionName: string
    Price: number
}

export interface GetOrderItemDto {
    Id: number
    ProductId: number
    ProductCode: string
    ProductName: string
    RegularPrice: number
    OptionsAmount: number
    SalePrice: number
    Quantity: number
    LineAmount: number
    DiscountAmount: number
    LineNetAmount: number
    Note: string | null
    Options: GetOrderItemOptionDto[]
}

export interface GetOrderDetailDto {
    Id: number
    TenantId: string
    StoreId: number
    OrderNumber: string
    Status: string
    Channel: string | null
    CustomerName: string | null
    CustomerPhone: string | null
    Note: string | null
    Subtotal: number
    DiscountAmount: number
    TaxAmount: number
    TotalAmount: number
    PaymentMethod: string | null
    PaymentStatus: string | null
    PaidAt: string | null
    CancelledAt: string | null
    CancelledReason: string | null
    CreatedAt: string | null
    CreatedBy: string | null
    UpdatedAt: string | null
    UpdatedBy: string | null
    Items: GetOrderItemDto[]
}
```

- [ ] **Step 2: Extend `PosStoreStatusDto`**

Replace the full content of `pos-shift.dto.ts` with:

```ts
export interface PosStoreStatusDto {
    StoreId: number
    StoreName: string
    LogoUrl: string | null
    Address: string | null
    City: string | null
    District: string | null
    Province: string | null
    IsAcceptingOrders: boolean
    HasOpenShift: boolean
    ShiftId: number | null
    ShiftOpenedAt: string | null
    ShiftOpenedBy: string | null
}
```

- [ ] **Step 3: Add a composed `address` computed to the shift store**

In `pos-shift.store.ts`, after the `logoUrl` computed (line 11), add:

```ts
    const address = computed(() => {
        if (!status.value) return ''
        return [status.value.Address, status.value.District, status.value.City, status.value.Province]
            .filter(Boolean)
            .join(', ')
    })
```

Then add `address` to the returned object (in the `storeName, logoUrl, isAcceptingOrders, hasOpenShift,` line), so it reads:

```ts
        storeName, logoUrl, address, isAcceptingOrders, hasOpenShift,
```

- [ ] **Step 4: Type-check**

Run:
```bash
cd NDTCore.FE && npx vue-tsc --build
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add NDTCore.FE/src/modules/pos/models/dtos/pos-order.dto.ts NDTCore.FE/src/modules/pos/models/dtos/pos-shift.dto.ts NDTCore.FE/src/modules/pos/stores/pos-shift.store.ts
git commit -m "feat: add order-detail and store-address DTOs for POS bill printing"
```

---

## Task 5: FE — API + service for order detail fetch

**Files:**
- Modify: `NDTCore.FE/src/core/constants/api.constants.ts`
- Modify: `NDTCore.FE/src/modules/pos/api/pos.api.ts`
- Modify: `NDTCore.FE/src/modules/pos/services/pos.service.ts`

**Interfaces:**
- Consumes: `GetOrderDetailDto` (Task 4).
- Produces: `posService.getOrderByIdAsync(id: number): Promise<GetOrderDetailDto | null>` — consumed by Task 7's `usePrintBill` composable.

- [ ] **Step 1: Add the endpoint path constant**

In `api.constants.ts`, inside `ORDER.POS_API`, after `GET_ORDER_HISTORY`, add:

```ts
            GET_ORDER_BY_ID: (id: number) => `/pos/orders/${id}`,
```

- [ ] **Step 2: Add the API method**

In `pos.api.ts`, add `GetOrderDetailDto` to the type import from `'../models/dtos/pos-order.dto'`:

```ts
import type {
    CreatePosOrderRequest,
    CreatePosOrderResponse,
    PosOrderHistoryItemDto,
    GetOrderDetailDto,
} from '../models/dtos/pos-order.dto'
```

Then add to the `posApi` object, after `getOrderHistoryAsync`:

```ts
    getOrderByIdAsync(id: number): Promise<ApiResponse<GetOrderDetailDto>> {
        return posClient.get(EP.GET_ORDER_BY_ID(id))
    },
```

- [ ] **Step 3: Add the service method**

In `pos.service.ts`, add `GetOrderDetailDto` to the type import from `'../models/dtos/pos-order.dto'`:

```ts
import type {
    CreatePosOrderRequest,
    CreatePosOrderResponse,
    PosOrderHistoryItemDto,
    GetOrderDetailDto,
} from '../models/dtos/pos-order.dto'
```

Then add to the `PosService` class, after `getOrderHistoryAsync`:

```ts
    async getOrderByIdAsync(id: number): Promise<GetOrderDetailDto | null> {
        const r = await posApi.getOrderByIdAsync(id)
        return r.Data ?? null
    }
```

- [ ] **Step 4: Type-check**

Run:
```bash
cd NDTCore.FE && npx vue-tsc --build
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add NDTCore.FE/src/core/constants/api.constants.ts NDTCore.FE/src/modules/pos/api/pos.api.ts NDTCore.FE/src/modules/pos/services/pos.service.ts
git commit -m "feat: add getOrderByIdAsync to POS api and service"
```

---

## Task 6: FE — Bill HTML builder + hidden-iframe print utility

**Files:**
- Create: `NDTCore.FE/src/modules/pos/utils/build-bill-html.util.ts`
- Create: `NDTCore.FE/src/modules/pos/utils/print-iframe.util.ts`

**Interfaces:**
- Consumes: `GetOrderDetailDto` (Task 4).
- Produces: `BillStoreInfo` type and `buildBillHtml(order: GetOrderDetailDto, store: BillStoreInfo): string`; `printHtmlViaIframe(html: string): void` — both consumed by Task 7's `usePrintBill` composable.

- [ ] **Step 1: Create `build-bill-html.util.ts`**

```ts
import type { GetOrderDetailDto, GetOrderItemDto } from '../models/dtos/pos-order.dto'

export interface BillStoreInfo {
    name: string
    logoUrl: string | null
    address: string
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
    Cash: 'Tiền mặt',
    Card: 'Thẻ',
    Transfer: 'Chuyển khoản',
    EWallet: 'Ví điện tử',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
    Unpaid: 'Chưa thanh toán',
    Paid: 'Đã thanh toán',
    Refunded: 'Đã hoàn tiền',
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

function renderItemRow(item: GetOrderItemDto): string {
    const optionsText = item.Options.map((o) => o.OptionName).join(', ')
    return `
        <tr>
            <td>
                ${item.ProductName}
                ${optionsText ? `<div class="bill-item-options">${optionsText}</div>` : ''}
            </td>
            <td class="bill-text-center">${item.Quantity}</td>
            <td class="bill-text-right">${formatCurrency(item.SalePrice)}</td>
            <td class="bill-text-right">${formatCurrency(item.LineNetAmount)}</td>
        </tr>
    `
}

export function buildBillHtml(order: GetOrderDetailDto, store: BillStoreInfo): string {
    const itemRows = order.Items.map(renderItemRow).join('')
    const customerLine = order.CustomerName || order.CustomerPhone
        ? `<div class="bill-row"><span>Khách hàng</span><span>${[order.CustomerName, order.CustomerPhone].filter(Boolean).join(' - ')}</span></div>`
        : ''
    const paymentMethodLabel = order.PaymentMethod ? PAYMENT_METHOD_LABEL[order.PaymentMethod] ?? order.PaymentMethod : ''
    const paymentStatusLabel = order.PaymentStatus ? PAYMENT_STATUS_LABEL[order.PaymentStatus] ?? order.PaymentStatus : ''
    const createdByLine = order.CreatedBy
        ? `<div class="bill-row"><span>Người tạo</span><span>${order.CreatedBy}</span></div>`
        : ''

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>Bill ${order.OrderNumber}</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #000; margin: 0; padding: 16px; }
    .bill-header { text-align: center; margin-bottom: 12px; }
    .bill-logo { max-width: 80px; max-height: 80px; margin-bottom: 8px; }
    .bill-store-name { font-size: 16px; font-weight: bold; }
    .bill-store-address { font-size: 12px; color: #444; }
    .bill-divider { border-top: 1px dashed #000; margin: 8px 0; }
    .bill-row { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { padding: 4px 2px; font-size: 12px; text-align: left; }
    th { border-bottom: 1px solid #000; }
    .bill-text-center { text-align: center; }
    .bill-text-right { text-align: right; }
    .bill-item-options { font-size: 11px; color: #666; }
    .bill-totals .bill-row { font-size: 13px; }
    .bill-totals .bill-row.bill-total { font-weight: bold; font-size: 14px; }
</style>
</head>
<body>
    <div class="bill-header">
        ${store.logoUrl ? `<img class="bill-logo" src="${store.logoUrl}" />` : ''}
        <div class="bill-store-name">${store.name}</div>
        ${store.address ? `<div class="bill-store-address">${store.address}</div>` : ''}
    </div>

    <div class="bill-divider"></div>

    <div class="bill-row"><span>Số đơn</span><span>#${order.OrderNumber}</span></div>
    <div class="bill-row"><span>Thời gian</span><span>${formatDateTime(order.CreatedAt)}</span></div>
    ${customerLine}

    <div class="bill-divider"></div>

    <table>
        <thead>
            <tr>
                <th>Sản phẩm</th>
                <th class="bill-text-center">SL</th>
                <th class="bill-text-right">Đơn giá</th>
                <th class="bill-text-right">Thành tiền</th>
            </tr>
        </thead>
        <tbody>
            ${itemRows}
        </tbody>
    </table>

    <div class="bill-divider"></div>

    <div class="bill-totals">
        <div class="bill-row"><span>Tạm tính</span><span>${formatCurrency(order.Subtotal)}</span></div>
        <div class="bill-row"><span>Giảm giá</span><span>-${formatCurrency(order.DiscountAmount)}</span></div>
        <div class="bill-row"><span>Thuế</span><span>${formatCurrency(order.TaxAmount)}</span></div>
        <div class="bill-row bill-total"><span>Tổng cộng</span><span>${formatCurrency(order.TotalAmount)}</span></div>
    </div>

    <div class="bill-divider"></div>

    <div class="bill-row"><span>Thanh toán</span><span>${paymentMethodLabel}</span></div>
    <div class="bill-row"><span>Trạng thái</span><span>${paymentStatusLabel}</span></div>
    ${createdByLine}
</body>
</html>
    `
}
```

- [ ] **Step 2: Create `print-iframe.util.ts`**

```ts
export function printHtmlViaIframe(html: string): void {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const cleanup = (): void => {
        iframe.contentWindow?.removeEventListener('afterprint', cleanup)
        document.body.removeChild(iframe)
    }

    iframe.onload = (): void => {
        iframe.contentWindow?.addEventListener('afterprint', cleanup)
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
    }

    const doc = iframe.contentDocument
    if (!doc) {
        cleanup()
        throw new Error('Không thể tạo nội dung in.')
    }
    doc.open()
    doc.write(html)
    doc.close()
}
```

- [ ] **Step 3: Type-check**

Run:
```bash
cd NDTCore.FE && npx vue-tsc --build
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add NDTCore.FE/src/modules/pos/utils/build-bill-html.util.ts NDTCore.FE/src/modules/pos/utils/print-iframe.util.ts
git commit -m "feat: add bill HTML builder and hidden-iframe print utility"
```

---

## Task 7: FE — `usePrintBill` composable

**Files:**
- Create: `NDTCore.FE/src/modules/pos/composables/usePrintBill.ts`

**Interfaces:**
- Consumes: `posService.getOrderByIdAsync` (Task 5), `buildBillHtml`/`printHtmlViaIframe` (Task 6), `usePosShiftStore().{storeName,logoUrl,address}` (Task 4), `useToastNotification` (existing, `@/composables/useToastNotification`).
- Produces: `usePrintBill(): { isPrinting: Ref<boolean>; printBill: (orderId: number) => Promise<void> }` — consumed by Task 8's `PosOrderHistoryDrawer.vue`.

- [ ] **Step 1: Create the composable**

```ts
import { ref } from 'vue'
import { useToastNotification } from '@/composables/useToastNotification'
import { posService } from '../services/pos.service'
import { usePosShiftStore } from '../stores/pos-shift.store'
import { buildBillHtml } from '../utils/build-bill-html.util'
import { printHtmlViaIframe } from '../utils/print-iframe.util'

export function usePrintBill() {
    const toast = useToastNotification()
    const shiftStore = usePosShiftStore()
    const isPrinting = ref(false)

    async function printBill(orderId: number): Promise<void> {
        isPrinting.value = true
        try {
            const order = await posService.getOrderByIdAsync(orderId)
            if (!order) {
                toast.error('Không tải được chi tiết đơn hàng.')
                return
            }
            const html = buildBillHtml(order, {
                name: shiftStore.storeName,
                logoUrl: shiftStore.logoUrl,
                address: shiftStore.address,
            })
            printHtmlViaIframe(html)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'In bill thất bại.')
        } finally {
            isPrinting.value = false
        }
    }

    return { isPrinting, printBill }
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
cd NDTCore.FE && npx vue-tsc --build
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.FE/src/modules/pos/composables/usePrintBill.ts
git commit -m "feat: add usePrintBill composable for POS order history"
```

---

## Task 8: FE — "In bill" button in `PosOrderHistoryDrawer.vue`

**Files:**
- Modify: `NDTCore.FE/src/modules/pos/components/PosOrderHistoryDrawer.vue`

**Interfaces:**
- Consumes: `usePrintBill()` (Task 7).
- Produces: visible UI — terminal task, nothing else depends on it.

- [ ] **Step 1: Import and call the composable**

Add the import after the existing `import type { PosOrderHistoryItemDto } from '../models/dtos/pos-order.dto'` line:

```ts
import { usePrintBill } from '../composables/usePrintBill'
```

Add the composable call right after the `defineEmits` line (before the `orders`/`isLoading`/`selectedStatus` refs):

```ts
const { isPrinting, printBill } = usePrintBill()
```

- [ ] **Step 2: Add the print button**

Inside the `v-list-item` (after the `</template>` that closes `#prepend`, line 55, and before `<v-list-item-title>`), add:

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

- [ ] **Step 3: Type-check**

Run:
```bash
cd NDTCore.FE && npx vue-tsc --build
```
Expected: 0 errors.

- [ ] **Step 4: Manual browser verification**

Run:
```bash
cd NDTCore.FE && npm run dev
```
In the browser: open the POS screen, create an order (status should now show "Hoàn tất" immediately — confirms Task 1), open the order-history drawer, and click the printer icon next to a non-Cancelled order. Confirm:
- The icon is hidden for any order with status "Đã huỷ".
- Clicking it opens the browser's print dialog with the bill content (store name/address/logo if set, order number, items, totals, payment info) — no new tab/window appears, no popup-blocker warning.
- The button shows a loading spinner while the order detail is being fetched.

Stop the dev server (Ctrl+C) when done.

- [ ] **Step 5: Commit**

```bash
git add NDTCore.FE/src/modules/pos/components/PosOrderHistoryDrawer.vue
git commit -m "feat: add print-bill button to POS order history drawer"
```
