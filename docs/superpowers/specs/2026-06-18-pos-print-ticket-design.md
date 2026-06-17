# Thiết Kế: In Phiếu Khi Tạo Đơn (POS)

> **Scope:** Frontend (NDTCore.FE) — module `pos`. Không thay đổi backend/DB.

---

## 1. Mục Đích

Khi OrderStaff bấm **"Tạo đơn"** thành công trên màn hình POS, hệ thống tự động in 1 phiếu ra máy in nhiệt tại quầy. Phiếu này vừa là phiếu báo món cho bếp/pha chế, vừa hiển thị giá từng dòng + tổng tiền (giống hóa đơn tạm tính) — không phải hóa đơn thanh toán chính thức (đơn vẫn ở trạng thái `Pending`/`Unpaid`, Cashier xử lý thanh toán sau theo flow hiện tại trong `pos-design.md`).

Việc in **không** ảnh hưởng tới việc tạo đơn: nếu in lỗi, đơn vẫn tạo thành công, chỉ hiện cảnh báo kèm nút in lại.

---

## 2. Kiến Trúc In

```
PosOrderPanel.vue (submitOrder() thành công)
        │
        ▼
  usePrinter().printTicket(model)
        │
        ├─ 1. Thử QZ Tray (npm lib "qz-tray", kết nối ws://localhost:8182, unsigned)
        │      → qz.print(config, [{ type:'pixel', format:'html', data: html }])
        │      → thành công: toast nhỏ "Đã gửi lệnh in"
        │
        └─ 2. QZ Tray không kết nối được hoặc lỗi khi in
               → fallback: mở iframe ẩn chứa cùng HTML, gọi iframe.contentWindow.print()
               → vẫn lỗi → toast lỗi kèm nút "In lại" (gọi lại printTicket() với model đã lưu)
```

### Vì sao chọn QZ Tray làm phương án chính

- POS chạy trong browser tại store (LAN cục bộ) — backend là service tập trung (SaaS multi-tenant), **không** thể gửi lệnh in trực tiếp tới máy in tại LAN của từng store.
- QZ Tray là agent local có sẵn (open-source), cài 1 lần trên thiết bị POS, browser giao tiếp qua `qz-tray` JS SDK — không cần tự xây dựng + maintain agent riêng.
- Cho phép in âm thầm (không hiện dialog xác nhận mỗi đơn) — phù hợp tốc độ vận hành quầy/bếp.
- **Bảo mật kết nối:** dùng chế độ unsigned — staff bấm "Allow, remember this decision" trong QZ Tray 1 lần/thiết bị khi setup, không cần hạ tầng ký số (self-signed cert) ở giai đoạn này.

### Vì sao cần fallback `window.print()`

- QZ Tray có thể chưa được cài/chưa mở trên một số thiết bị (đặc biệt giai đoạn rollout ban đầu).
- `window.print()` dùng driver máy in đã cài trên OS — không cần QZ Tray, đảm bảo luôn có đường in dự phòng dù chậm hơn (cần xác nhận dialog).

### Render nội dung phiếu

Nội dung phiếu được build **1 lần** dưới dạng **HTML string tự chứa** (inline `<style>`, không phụ thuộc CSS của app) — dùng chung cho cả 2 đường in (QZ pixel-print và iframe fallback), tránh trùng logic format.

Lý do dùng HTML/pixel-print thay vì raw ESC/POS text: tiếng Việt có dấu dễ lỗi font/codepage khi in raw text qua ESC/POS (phụ thuộc firmware từng dòng máy in). Render HTML → in dạng ảnh (pixel) qua QZ Tray đảm bảo hiển thị đúng tiếng Việt, đổi lại tốc độ in chậm hơn raw text một chút (đánh đổi chấp nhận được).

Khổ giấy: **80mm**.

---

## 3. Thành Phần Mới (`src/modules/pos/`)

| File | Vai trò |
|---|---|
| `models/types/print-ticket.types.ts` | Định nghĩa `PrintTicketModel` — shape trung gian cho phiếu in |
| `mappers/printTicket.mapper.ts` | Convert cart items (lúc tạo đơn) hoặc order history detail (lúc in lại) → `PrintTicketModel` |
| `templates/printTicket.template.ts` | Pure function `buildTicketHtml(model: PrintTicketModel): string` |
| `services/qzPrinter.service.ts` | Wrap thư viện `qz-tray`: connect, list printers, gửi lệnh print |
| `utils/printerConfig.ts` | `getPrinterName()` / `setPrinterName()` — đọc/ghi `localStorage` |
| `composables/usePrinter.ts` | Orchestrate luồng: thử QZ Tray → fallback iframe `window.print()` → toast lỗi + retry |
| `components/PosPrinterSettingsDialog.vue` | Dialog chọn máy in từ danh sách QZ Tray trả về (`qz.printers.find()`), lưu vào `localStorage` |

### Điểm gọi (integration points)

- **`PosOrderPanel.vue`** — sau `submitOrder()` thành công (file hiện tại, dòng ~228-232): build `PrintTicketModel` từ cart items (`PosCartItem[]`) + response (`OrderNumber`, `TotalAmount`) → gọi `printTicket()` (fire-and-forget, không `await` trước khi `cartStore.clearCart()`/hiện success dialog)
- **`PosOrderHistoryDrawer.vue`** (chi tiết đơn) — thêm nút **"In lại"**: build `PrintTicketModel` từ order detail đã fetch → gọi `printTicket()`
- **`PosHeader.vue`** — thêm icon **"Cấu hình máy in"** mở `PosPrinterSettingsDialog.vue`

---

## 4. Data Flow — `PrintTicketModel`

```ts
interface PrintTicketModel {
  storeName: string
  orderNumber: string
  createdAt: string          // đã format
  staffName?: string
  customerName?: string
  customerPhone?: string
  items: PrintTicketItem[]
  note?: string
  totalAmount: number
}

interface PrintTicketItem {
  name: string
  quantity: number
  optionsSummary: string     // text tóm tắt, giống cách hiển thị trong Order Panel hiện tại
  note?: string
  lineTotal: number
}
```

Hai nguồn dữ liệu map vào `PrintTicketModel` qua `printTicket.mapper.ts`:
1. **Lúc tạo đơn:** `PosCartItem[]` (từ `pos-cart.store.ts`) + `CreatePosOrderResponse` (OrderNumber, TotalAmount, CreatedAt)
2. **Lúc in lại:** order detail đã fetch trong `PosOrderHistoryDrawer.vue` (đã có items + options + giá snapshot)

---

## 5. Cấu Hình Máy In

Tên máy in (string do QZ Tray trả về từ danh sách printer của OS) lưu trong `localStorage` của trình duyệt — gắn với **thiết bị POS cụ thể** (USB/network printer cấu hình ở tầng OS), không phải thuộc tính của `Store` trong DB. Mỗi thiết bị tự chọn máy in 1 lần khi setup qua `PosPrinterSettingsDialog.vue`. Không cần thay đổi backend/migration.

---

## 6. Error Handling

- In lỗi (QZ Tray không kết nối, máy in offline, hết giấy...) → **không** block việc tạo đơn — đơn đã tạo thành công ở bước gọi API, độc lập với việc in.
- Hiện toast (`vue-toastification`) báo lỗi kèm action button **"In lại"** → gọi lại `printTicket()` với `PrintTicketModel` đã lưu trong closure/state tạm.
- Lần đầu kết nối QZ Tray trên một thiết bị, QZ Tray sẽ hỏi "Allow" — staff bấm "Allow, remember this decision" 1 lần (ghi chú vận hành lúc setup thiết bị, không phải logic code).

---

## 7. Testing

- Unit test `printTicket.mapper.ts` và `printTicket.template.ts` — pure function, input model rõ ràng → assert output HTML chứa đúng field (OrderNumber, item list, tổng tiền).
- `qzPrinter.service.ts` và `usePrinter.ts` — mock thư viện `qz-tray` để test:
  - Luồng QZ Tray kết nối thành công → gọi đúng `qz.print()` với config mong đợi
  - Luồng QZ Tray timeout/lỗi → fallback gọi iframe `window.print()`
  - Luồng cả 2 đường lỗi → toast hiện đúng, retry gọi lại đúng model
- Không test với máy in vật lý trong CI — verify qua manual test khi deploy lên thiết bị POS thật.

---

## 8. Out of Scope

- Đa máy in theo khu vực (bếp/pha chế riêng) — hiện chỉ 1 máy in/store.
- Ký số (self-signed cert) cho QZ Tray — dùng unsigned mode ở giai đoạn này.
- Lưu cấu hình máy in vào DB theo Store — hiện lưu local theo thiết bị.
- Raw ESC/POS printing (bold, cut paper command tùy biến) — dùng HTML/pixel-print qua QZ Tray.
