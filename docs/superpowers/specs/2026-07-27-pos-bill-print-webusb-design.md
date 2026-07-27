# Thiết Kế: In Bill Qua USB (WebUSB) Cho Máy POS Android

> **Scope:** Frontend (NDTCore.FE) — module `pos`. Không thay đổi backend/DB.

---

## 1. Bối Cảnh & Mục Đích

Nút "In bill" hiện tại (`usePrintBill.ts`) in qua `window.print()` — trên laptop Windows hoạt động tốt vì Xprinter được cài như driver máy in hệ thống. Trên máy POS chạy Android, Xprinter (kết nối USB) **không có Print Service** nào được Android nhận diện, nên hộp thoại in hệ thống không thấy được máy in — không in được, hoặc in ra khổ giấy sai (Android áp khổ mặc định A4 thay vì khổ nhiệt 80mm).

Mục đích: thêm một đường in **thứ hai, độc lập** — in bill trực tiếp qua cổng USB bằng WebUSB API, bỏ qua hoàn toàn Android Print Framework/hộp thoại in hệ thống. Đường in cũ (`window.print()`) giữ nguyên, không đổi, tiếp tục dùng cho laptop.

**Khổ giấy:** 80mm (203dpi, 576 dot ngang) — theo xác nhận thực tế đang dùng. Nếu sau này đo được số dot khác, đây là 1 hằng số duy nhất cần chỉnh.

**Giới hạn đã biết:** Theo tài liệu chính thức của thư viện `webusb-receipt-printer`, WebUSB **không hoạt động trên Windows** khi driver hệ thống đã giữ độc quyền thiết bị. Điều này không ảnh hưởng vì laptop Windows đã có đường in `window.print()` riêng hoạt động tốt; nút USB chỉ dành cho máy POS Android.

---

## 2. Kiến Trúc

```
PosOrderHistoryDrawer.vue
        │  click "In qua USB"
        ▼
  usePrintBillUsb().printBillUsb(orderId)
        │
        ├─ 1. usbPrinterService.ensureConnected()
        │      ├─ có thiết bị đã lưu (storageService) → reconnect() (không hỏi quyền lại)
        │      └─ chưa có / reconnect thất bại → connect() (mở popup chọn thiết bị USB của Chrome —
        │         phải gọi ngay trong click handler, cùng nguyên tắc "user gesture" đã áp dụng
        │         trước đây với window.open())
        │      → khi có sự kiện 'connected': lưu {serialNumber, vendorId, productId} vào storageService
        │
        ├─ 2. posService.getOrderByIdAsync(orderId)  — dùng lại, không đổi
        │
        ├─ 3. buildBillCanvas(order, store)  — vẽ bill lên <canvas> đen-trắng, 576 dot ngang
        │
        ├─ 4. new ReceiptPrinterEncoder({ language, codepageMapping })  (2 giá trị này lấy từ
        │      sự kiện 'connected' của bước 1 — thư viện tự xác định đúng theo thiết bị)
        │      .initialize().image(canvas, 576, height, 'raster').cut().encode()
        │
        └─ 5. usbPrinterService.print(encodedBytes)

Lỗi ở bất kỳ bước nào → toast.error(...), dừng lại. KHÔNG fallback về window.print().
```

### Vì sao render ra ảnh (canvas) thay vì gửi text ESC/POS thô

Bảng mã (`codepage`) riêng của Xprinter trong `@point-of-sale/receipt-printer-encoder` (đã kiểm tra trong package đã cài: `cp437, cp850, cp860, cp863, cp865, iso8859-1, windows125x, cp866, cp852, cp858, cp864, cp737...`) **không có bảng mã nào hỗ trợ tiếng Việt có dấu**. In text thô sẽ lỗi font. Vẽ ra ảnh bitmap rồi in bằng lệnh ảnh raster của ESC/POS (`.image()` trong thư viện) tránh hoàn toàn vấn đề bảng mã — giống lý do đã từng ghi nhận ở spec in phiếu bếp trước đó (`2026-06-18-pos-print-ticket-design.md`).

### Vì sao chọn `@point-of-sale/receipt-printer-encoder` + `@point-of-sale/webusb-receipt-printer`

- Cùng một tác giả (`nielsleenheer`), là bộ thư viện chuyên biệt duy nhất tìm được vừa hỗ trợ WebUSB vừa có sẵn profile riêng cho Xprinter (bao gồm dòng 80mm).
- `webusb-receipt-printer` tự xử lý phần rủi ro nhất nếu tự viết tay: dò đúng interface/endpoint USB theo từng dòng máy, xin quyền, và hỗ trợ `reconnect()` theo `serialNumber` đã lưu để không phải hỏi lại quyền mỗi lần in.

---

## 3. Thành Phần Mới (`src/modules/pos/`)

| File | Vai trò |
|---|---|
| `utils/build-bill-canvas.util.ts` | Pure function `buildBillCanvas(order: GetOrderDetailDto, store: BillStoreInfo): HTMLCanvasElement` — vẽ lại nội dung bill (giống layout `build-bill-html.util.ts`) lên canvas đen-trắng rộng 576px, cao theo nội dung |
| `services/usb-printer.service.ts` | Bọc 1 instance `WebUSBReceiptPrinter` dùng chung: `ensureConnected(): Promise<ConnectedPrinterInfo>`, `print(data: Uint8Array): Promise<void>`; lắng nghe sự kiện `connected` để lưu thiết bị vào `storageService` |
| `composables/usePrintBillUsb.ts` | Orchestrate luồng ở mục 2 — trả về `{ isPrinting, printBillUsb }`, cùng shape với `usePrintBill` hiện có |

**Sửa file có sẵn:**
- `src/core/storage/storage.constant.ts` — thêm key `POS_USB_PRINTER_DEVICE: 'pos.usbPrinterDevice'`
- `src/modules/pos/components/PosOrderHistoryDrawer.vue` — thêm nút icon `mdi-usb` cạnh nút in hiện tại, cùng điều kiện hiển thị (`order.Status !== 'Cancelled'`)
- `package.json` — thêm dependency `@point-of-sale/receipt-printer-encoder`, `@point-of-sale/webusb-receipt-printer`

---

## 4. Data Flow

`GetOrderDetailDto` + `BillStoreInfo` (đã có sẵn từ `usePrintBill`) là input chung cho cả `buildBillHtml` (đường in cũ) và `buildBillCanvas` (đường in mới) — không cần DTO/model mới.

`ConnectedPrinterInfo` (kiểu dữ liệu mới, nội bộ `usb-printer.service.ts`):

```ts
interface ConnectedPrinterInfo {
    serialNumber: string
    vendorId: number
    productId: number
    language: 'esc-pos' | 'star-prnt'
    codepageMapping: unknown  // truyền thẳng vào ReceiptPrinterEncoder, không cần biết cấu trúc chi tiết
}
```

---

## 5. Error Handling

- `!('usb' in navigator)` → toast lỗi ngay, không thử connect.
- `connect()`/`reconnect()` thất bại (huỷ popup, không tìm thấy thiết bị đã lưu) → toast lỗi.
- `print()` thất bại (mất kết nối, máy in hết giấy...) → toast lỗi.
- Không có cơ chế fallback về `window.print()` — theo quyết định đã chốt, để tránh hành vi khó đoán khi có 2 đường in tự động thay nhau.
- Nút "In bill" (`window.print()`) hiện tại vẫn đứng độc lập cạnh nút mới, staff tự chọn dùng nút nào.

---

## 6. Testing

Repo không có test tự động cho FE (đã xác nhận từ các plan trước) — verify qua:
- `npm run type-check` + lint sau khi code xong.
- Test tay bắt buộc trên máy POS Android + Xprinter thật (WebUSB cần thiết bị thật + popup cấp quyền của trình duyệt, không mô phỏng được trong CI/dev thường).

---

## 7. Out of Scope

- In qua LAN/WiFi (Xprinter cũng hỗ trợ, nhưng cần thêm app/service cầu nối cục bộ trên Android vì trình duyệt không mở được socket TCP thô tới IP máy in) — để sau, làm spec riêng khi có cửa hàng thực sự cần.
- Đổi/xoá đường in `window.print()` hiện tại — giữ nguyên làm phương án thủ công.
- UI quản lý/xem danh sách nhiều máy in đã ghép — hiện chỉ lưu 1 thiết bị gần nhất mỗi trình duyệt.
- Test tự động (không có hạ tầng test trong repo).
