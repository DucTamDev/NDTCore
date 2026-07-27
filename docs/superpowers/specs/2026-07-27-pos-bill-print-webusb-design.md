# Thiết Kế: In Bill Qua USB (WebUSB) Cho Máy POS Android

> **Scope:** Frontend (NDTCore.FE) — module `pos`. Không thay đổi backend/DB.

---

## 1. Bối Cảnh & Mục Đích

Nút "In bill" hiện tại (`usePrintBill.ts`) in qua `window.print()` — trên laptop Windows hoạt động tốt vì Xprinter được cài như driver máy in hệ thống. Trên máy POS chạy Android, Xprinter (kết nối USB) **không có Print Service** nào được Android nhận diện, nên hộp thoại in hệ thống không thấy được máy in — không in được, hoặc in ra khổ giấy sai (Android áp khổ mặc định A4 thay vì khổ nhiệt 80mm).

Mục đích: thêm một đường in **thứ hai, độc lập** — in bill trực tiếp qua cổng USB bằng WebUSB API, bỏ qua hoàn toàn Android Print Framework/hộp thoại in hệ thống. Đường in cũ (`window.print()`) giữ nguyên, không đổi, tiếp tục dùng cho laptop.

**Khổ giấy:** 80mm (203dpi, 576 dot ngang) — theo xác nhận thực tế đang dùng. Nếu sau này đo được số dot khác, đây là 1 hằng số duy nhất cần chỉnh.

**Giới hạn đã biết:** WebUSB **không hoạt động trên Windows** khi driver hệ thống đã giữ độc quyền thiết bị máy in. Điều này không ảnh hưởng vì laptop Windows đã có đường in `window.print()` riêng hoạt động tốt; nút USB chỉ dành cho máy POS Android.

---

## 2. Kiến Trúc

```text
PosOrderHistoryDrawer.vue
        │  click "In qua USB"
        ▼
  usePrintBillUsb().printBillUsb(orderId)
        │
        ├─ 1. usbPrinterService.ensureConnected()
        │      ├─ có thiết bị đã lưu (storageService: serialNumber/vendorId/productId)
        │      │  → navigator.usb.getDevices() rồi tìm khớp serialNumber (hoặc vendorId+productId
        │      │    nếu thiết bị không báo serialNumber) → mở kết nối lại, KHÔNG hỏi quyền lại
        │      └─ chưa có / không tìm thấy → navigator.usb.requestDevice({ filters: [] })
        │         (không lọc gì — Chrome hiện TẤT CẢ thiết bị USB đang cắm để chọn; phải gọi
        │         ngay trong click handler, cùng nguyên tắc "user gesture" đã áp dụng trước đây
        │         với window.open())
        │      → mở device: open() → selectConfiguration(1) → tìm interface có endpoint OUT kiểu
        │        bulk → claimInterface(interfaceNumber) → lưu {serialNumber, vendorId, productId}
        │        vào storageService
        │
        ├─ 2. posService.getOrderByIdAsync(orderId)  — dùng lại, không đổi
        │
        ├─ 3. buildBillCanvas(order, store)  — vẽ bill lên <canvas> đen-trắng, 576 dot ngang
        │
        ├─ 4. new ReceiptPrinterEncoder({ language: 'esc-pos' })
        │      .initialize().image(canvas, 576, height, 'raster').cut().encode()
        │      (không cần codepageMapping vì toàn bộ nội dung là ảnh raster, không gọi .text())
        │
        └─ 5. usbPrinterService.print(encodedBytes)  — device.transferOut(endpointNumber, bytes)

Lỗi ở bất kỳ bước nào → toast.error(...), dừng lại. KHÔNG fallback về window.print().
```

### Vì sao render ra ảnh (canvas) thay vì gửi text ESC/POS thô

Bảng mã (`codepage`) riêng của Xprinter trong `@point-of-sale/receipt-printer-encoder` (đã kiểm tra trong package đã cài: `cp437, cp850, cp860, cp863, cp865, iso8859-1, windows125x, cp866, cp852, cp858, cp864, cp737...`) **không có bảng mã nào hỗ trợ tiếng Việt có dấu**. In text thô sẽ lỗi font. Vẽ ra ảnh bitmap rồi in bằng lệnh ảnh raster của ESC/POS (`.image()` trong thư viện) tránh hoàn toàn vấn đề bảng mã — giống lý do đã từng ghi nhận ở spec in phiếu bếp trước đó (`2026-06-18-pos-print-ticket-design.md`).

### Vì sao chỉ dùng `@point-of-sale/receipt-printer-encoder`, không dùng `@point-of-sale/webusb-receipt-printer`

Ban đầu định dùng cả `webusb-receipt-printer` để xử lý phần kết nối USB, nhưng đọc thẳng source code của package (không có tài liệu API chi tiết, không có type declaration) phát hiện: `connect()` của thư viện này gọi `navigator.usb.requestDevice()` với **danh sách filter vendorId/productId đóng cứng, chỉ có đúng 1 cặp ID cho Xprinter** (`vendorId 8137, productId 8214`), và không có API công khai nào để thêm ID khác. Vì không biết chắc Xprinter thực tế có đúng ID này không (nhiều dòng/OEM khác nhau), dùng thư viện này có rủi ro popup chọn thiết bị của Chrome **không hiện được máy in nào cả**.

Quyết định: **tự viết phần kết nối/gửi dữ liệu WebUSB** (ngắn, ~20-30 dòng, dựa trên logic đã đọc được từ source của thư viện trên nhưng bỏ filter đóng cứng — dùng `filters: []` để hiện mọi thiết bị USB), chỉ giữ lại `@point-of-sale/receipt-printer-encoder` để dựng lệnh ESC/POS (phần này không phụ thuộc thiết bị cụ thể, an toàn).

---

## 3. Thành Phần Mới (`src/modules/pos/`)

| File | Vai trò |
|---|---|
| `utils/build-bill-canvas.util.ts` | Pure function `buildBillCanvas(order: GetOrderDetailDto, store: BillStoreInfo): HTMLCanvasElement` — vẽ lại nội dung bill (giống layout `build-bill-html.util.ts`) lên canvas đen-trắng rộng 576px, cao theo nội dung |
| `services/usb-printer.service.ts` | Tự quản lý 1 `USBDevice` dùng chung: `ensureConnected(): Promise<void>`, `print(data: Uint8Array): Promise<void>`; sau khi kết nối thành công, lưu `{serialNumber, vendorId, productId}` vào `storageService` |
| `composables/usePrintBillUsb.ts` | Orchestrate luồng ở mục 2 — trả về `{ isPrinting, printBillUsb }`, cùng shape với `usePrintBill` hiện có |

**Sửa file có sẵn:**
- `src/core/storage/storage.constant.ts` — thêm key `POS_USB_PRINTER_DEVICE: 'pos.usbPrinterDevice'`
- `src/modules/pos/components/PosOrderHistoryDrawer.vue` — thêm nút icon `mdi-usb` cạnh nút in hiện tại, cùng điều kiện hiển thị (`order.Status !== 'Cancelled'`)
- `package.json` — thêm dependency `@point-of-sale/receipt-printer-encoder`; thêm devDependency `@types/w3c-web-usb` (type cho `navigator.usb`/`USBDevice` — TypeScript không có sẵn type built-in cho WebUSB trong lib DOM)
- `src/modules/pos/types/receipt-printer-encoder.d.ts` (file mới) — ambient module declaration tối thiểu cho `@point-of-sale/receipt-printer-encoder` vì package không có sẵn file `.d.ts`, chỉ khai báo đúng phần API dùng tới (constructor, `.initialize()`, `.image()`, `.cut()`, `.encode()`)

---

## 4. Data Flow

`GetOrderDetailDto` + `BillStoreInfo` (đã có sẵn từ `usePrintBill`) là input chung cho cả `buildBillHtml` (đường in cũ) và `buildBillCanvas` (đường in mới) — không cần DTO/model mới.

`StoredUsbPrinterDevice` (kiểu dữ liệu mới, lưu trong `storageService` dưới key `POS_USB_PRINTER_DEVICE`):

```ts
interface StoredUsbPrinterDevice {
    serialNumber: string | undefined
    vendorId: number
    productId: number
}
```

`serialNumber` có thể `undefined` vì không phải máy in nào cũng báo số serial qua WebUSB — khi đó việc tìm lại thiết bị lúc `reconnect` sẽ dựa vào cặp `vendorId`+`productId`.

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
