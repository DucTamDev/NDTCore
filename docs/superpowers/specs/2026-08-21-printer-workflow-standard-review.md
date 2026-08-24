# Printer Workflow — Review theo chuẩn POS thương mại

> Audit kiến trúc/luồng làm việc với máy in trong `NDTCore.App` (Phase 1 — Printer Management, đã hoàn thành theo `docs/superpowers/plans/2026-07-30-pos-app-phase1-printer-management.md`), đối chiếu với cách các app POS thương mại (Square, Loyverse, KiotViet, Sapo...) tổ chức 3 luồng: setup/gán máy in, in thật + xử lý lỗi, và kiến trúc code. Kết thúc bằng danh sách hành động ưu tiên cho Phase 2/3.

---

## Bối cảnh

Phase 1 đã xây xong nền tảng quản lý máy in (thêm/sửa/xoá, tự nhận diện protocol, in thử). Phase 2 (POS Core) sẽ cần in hoá đơn thật trong luồng bán hàng — trước khi bắt tay vào đó, cần biết luồng hiện tại đã khớp với cách vận hành thực tế của 1 quầy POS hay chưa, và chỗ nào sẽ gây sự cố khi lên production (mất đơn in, thu ngân không biết máy in lỗi...).

Doc này **không phải** thiết kế lại từ đầu — phần lớn kiến trúc hiện tại đã đúng hướng. Mục tiêu là chỉ rõ từng chỗ lệch/thiếu cụ thể, kèm vị trí trong code, để lên kế hoạch Phase 2/3.

---

## 1. Setup & gán máy in

### Chuẩn ngành

- Màn hình quản lý máy in tập trung: thêm (scan USB/BT/LAN), đặt tên, in thử, sửa, xoá.
- **Gán vai trò tách biệt khỏi bản thân máy in**: 1 máy in có thể được gán in cho nhiều loại nội dung (hoá đơn, tem, phiếu bếp...), và ngược lại 1 loại nội dung có thể gán nhiều máy in (in đồng thời ở nhiều quầy/khu vực) — việc gán này là cấu hình của người dùng, không phải thuộc tính cố định của máy in.
- Auto-connect khi mở app, không bắt thu ngân bấm "Kết nối" thủ công từng máy mỗi ca.
- Theo dõi sức khoẻ kết nối trong suốt ca làm việc (không chỉ lúc khởi động), vì máy in LAN/Bluetooth có thể rớt kết nối bất kỳ lúc nào (nhiễu sóng, máy in tắt tạm, WiFi đổi kênh...).

### Hiện trạng NDTCore.App

- `PrinterManagementPanel` (`src/features/printer/components/PrinterManagementPanel.tsx`) quản lý CRUD máy in; `PrintConfigurationPanel` (`src/features/printer/components/PrintConfigurationPanel.tsx`) gán `printerId` theo từng `PrintType` (`Receipt`/`Label`) — **2 khái niệm đã tách đúng**, không mapping cứng máy in ↔ loại nội dung — `PrintType` (Bill/Label) là business content type, `Protocol` (ESC/POS/TSPL) là capability của máy in vật lý, 2 trục hoàn toàn độc lập.
- `PrintService.print()` gửi job tới **toàn bộ** `printerId` đã gán cho loại nội dung đó (`effectivePrinterIds`, `PrintService.ts:17-22`) — đã hỗ trợ multi-printer per content type đúng chuẩn.
- Auto-reconnect lúc khởi động app: **mới bổ sung trong phiên review này** — `PrinterService.reconnectAutoPrinters()` (`PrinterService.ts`) gọi 1 lần từ `App.tsx` lúc mount, kết nối lại mọi máy in đã bật `autoReconnect` + `enabled`. Trước đó, field `autoReconnect` chỉ có tác dụng đúng 1 lần lúc vừa lưu máy in trong `AddPrinterModal`, khiến mọi máy in luôn hiện "Chưa kết nối" sau khi restart app.

### Gap / Đề xuất

- **Không có health-check định kỳ trong ca.** Sau lúc app khởi động, trạng thái kết nối chỉ cập nhật khi có sự kiện chủ động (connect/disconnect/print) — nếu máy in LAN/BT rớt kết nối giữa ca mà không có job in nào chạy qua, badge trạng thái trong `PrinterListItem` sẽ tiếp tục hiện "Đã kết nối" sai sự thật cho tới lần thao tác/in tiếp theo. Đề xuất: thêm 1 interval nhẹ (vd 30-60s) gọi `getStatus()`/ping nhẹ cho các máy in `enabled`, hoặc dựa vào sự kiện disconnect tự nhiên của native module nếu thư viện hỗ trợ — cần khảo sát thêm trước khi chọn cách nào, không nằm trong phạm vi audit này.

---

## 2. In thật + xử lý lỗi

### Chuẩn ngành

- Print job có **hàng đợi bền** (ít nhất trong phiên làm việc) với **retry tự động** (backoff) cho lỗi tạm thời — mất kết nối chớp nhoáng, máy in đang bận, hết giấy rồi nạp lại.
- Thu ngân luôn thấy trạng thái in (đang in/thành công/lỗi) qua toast/snackbar, có nút "In lại" ngay tại chỗ khi lỗi — không chặn luồng thanh toán chờ máy in.
- Lịch sử đơn có nút in lại bất kỳ lúc nào, độc lập với job in gốc lúc thanh toán.

### Hiện trạng NDTCore.App

- `PrintScheduler.enqueue()`/`retry()` (`PrintScheduler.ts`) đã có cơ chế retry, nhưng **`retry()` không tự động chạy** — phải được gọi thủ công từ nơi khác, và hiện **không có UI nào gọi `retry()`**.
- `OrderPrintTrigger.printReceipt()` (`src/features/cart/services/OrderPrintTrigger.ts`) chạy kiểu "fire-and-forget": chỉ trả về `boolean` cho đúng 1 trường hợp — chưa cấu hình máy in (`no-available-printer`), được `useCheckout.ts:46` dùng để set `noReceiptPrinterConfigured` hiển thị cho người dùng. **Mọi lỗi in khác** (mất kết nối, hết giấy, lỗi driver...) chỉ `LoggerService.warning(...)` — thu ngân không nhận được tín hiệu gì, đơn hàng vẫn được ghi nhận thành công dù hoá đơn chưa in ra giấy.
- `PrintJob` (`types/printJob.types.ts`) chỉ sống trong bộ nhớ, là kết quả trả về của 1 lần gọi `PrintService.print()` — không có gì để "in lại" 1 job đã thất bại ngoài việc build lại `PrintDocument` từ đầu qua đơn hàng (đã có `buildReprintDocument` cho hoá đơn, xem mục dưới).

### Gap / Đề xuất

- **[Cao]** Không có phản hồi cho thu ngân khi in thất bại (ngoài trường hợp chưa cấu hình máy in) — cần ít nhất 1 tín hiệu UI (snackbar/badge) khi `PrintService.print()` trả `status: 'failed' | 'partial-failure'`, kèm hành động "In lại" gọi `PrintScheduler.retry()` với job vừa thất bại.
- **[Cao]** Không có retry tự động cho lỗi thoáng qua — cân nhắc: `PrintScheduler.enqueue()` tự gọi lại `retry()` 1-2 lần với backoff ngắn trước khi báo `failed` hẳn, tương tự cách `TsplDriver.testPrint()`/`ThermalReceiptDriver.testPrint()` đã có logic "connect-if-needed".
- **[Trung bình]** `PrintJob` không persist — nếu app crash giữa lúc đang in, job đó biến mất hoàn toàn không dấu vết. Với hoá đơn đã có `buildReprintDocument` từ order history nên rủi ro thấp hơn; cần đánh giá thêm khi có luồng in Label thật (mục 3).

---

## 3. Kiến trúc code

### Chuẩn ngành

- Driver/Strategy pattern: 1 interface chung (connect/print/status...), implement riêng theo protocol — tách biệt hoàn toàn nội dung in (business model) khỏi việc encode byte (giống cách `escpos-php`, `node-thermal-printer` tổ chức: 1 lớp `Printer`/builder độc lập protocol, encode chỉ xảy ra ở tầng adapter trong cùng).
- Xử lý character encoding/codepage tường minh — không gửi thẳng JS string lên serial/socket và hy vọng máy in tự hiểu đúng.
- State machine kết nối rõ ràng (idle/connecting/connected/error/reconnecting...), không suy luận trạng thái qua side effect của lệnh khác.

### Hiện trạng NDTCore.App

Khớp tốt với chuẩn — đây là điểm mạnh kiến trúc, hiếm gặp ở app tự viết (nhiều app nhỏ hardcode byte ESC/POS thẳng trong component):

- `IPrinterDriver` (`types/driver.types.ts`) + `DriverRegistry` (`services/DriverRegistry.ts`) — driver pattern đúng chuẩn, `ThermalReceiptDriver`/`TsplDriver` độc lập theo protocol.
- `PrintDocument`/`PrintElement` (`types/printDocument.types.ts`) — content model protocol-agnostic, chỉ encode thành ESC/POS text hoặc lệnh TSPL bên trong driver tương ứng.
- `PrinterStatus` (`idle`/`connecting`/`connected`/`disconnecting`/`disconnected`/`reconnecting`/`error`) — state machine rõ ràng, event-driven qua `onStatusChange`, không polling.
- `discoverProtocol()` tự nhận diện protocol qua `identify()` thật (không đoán theo rule vendor/model tĩnh — rule table từng có đã bị bỏ trong phiên review này vì không cần thiết, `identify()` là nguồn xác nhận duy nhất).

**Các phần đã sửa trong chính phiên audit này** (ghi nhận đã đóng, không phải gap còn mở):
- Mã hoá UTF-8 thật cho nội dung tiếng Việt qua TSPL (`TsplEncoder.encode()` trước đây cắt byte sai cho ký tự có dấu thanh ngoài dải U+00FF) + `CODEPAGE UTF-8` trong `initialize()`.
- `encoding: 'UTF8'` truyền tường minh cho ESC/POS thay vì dựa vào default ngầm của thư viện.
- `disconnect()` ở cả 2 driver + 3 transport không có try/catch — lỗi native khiến trạng thái kẹt mãi ở `disconnecting`, bookkeeping (`activeByType`/`connectedTypes`/`connections`) không được dọn. Đã chuẩn hoá theo pattern try/catch/finally giống `connect()`, thêm `PrinterLogger.disconnectFailed`.
- "Lưu máy in" trước đây bắt buộc phải "In thử" thành công — đã bỏ, chỉ cần kết nối/nhận diện protocol thành công là lưu được.

### Gap / Đề xuất

- **[Cao]** **Label (tem) content thật chưa từng được implement.** Toàn bộ codebase chỉ có `PrintService.print('Receipt', ...)` (gọi từ `OrderPrintTrigger.printReceipt`) — không có `buildLabelDocument` hay bất kỳ luồng nghiệp vụ nào gọi `PrintService.print('Label', ...)`. Việc "in tem" hiện tại chỉ tồn tại dưới dạng In thử (`testPrint`) trong màn Quản lý máy in. README xác định in tem sản phẩm là phạm vi Phase 2/3 — cần lên kế hoạch nội dung tem thật (tem sản phẩm, tem đơn mang đi...) trước khi build UI.
- **[Thấp]** Font Unicode TSPL chưa verify trên phần cứng thật — `TsplEncoder.text()` dùng font built-in `"3"` (bitmap font cơ bản), byte gửi lên đã đúng UTF-8 nhưng nhiều dòng máy TSPL chỉ có glyph ASCII ở font này, cần chọn font resident hỗ trợ Unicode (vd `TSS24.BF2`) hoặc tải font TTF — phụ thuộc từng dòng máy cụ thể, chưa hardcode được.

---

## Danh sách hành động ưu tiên

| # | Mức | Hành động | Vị trí liên quan |
|---|-----|-----------|-------------------|
| 1 | Cao | Thêm tín hiệu UI + nút "In lại" khi in hoá đơn thất bại (không chỉ trường hợp chưa cấu hình máy in) | `OrderPrintTrigger.ts`, `useCheckout.ts` |
| 2 | Cao | Retry tự động (backoff ngắn) cho lỗi in thoáng qua trước khi báo `failed` hẳn | `PrintScheduler.ts` |
| 3 | Cao | Thiết kế + build luồng in Label (tem) thật cho nghiệp vụ Phase 2/3 | `src/features/printer/services/PrintService.ts`, module nghiệp vụ liên quan (sản phẩm/đơn mang đi) |
| 4 | Trung bình | Health-check định kỳ trong ca cho máy in LAN/Bluetooth | `PrinterService.ts`, `usePrinterConnection.ts` |
| 5 | Trung bình | Đánh giá persist `PrintJob` (ít nhất trong phiên) khi luồng Label thật được build, tránh mất job nếu app crash giữa lúc in | `PrintScheduler.ts`, `types/printJob.types.ts` |
| 6 | Thấp | Verify font Unicode TSPL trên phần cứng thật, chọn font resident phù hợp | `TsplEncoder.ts` |

---

## Ghi chú

- Phần "Kiến trúc code" xác nhận: kiến trúc hiện tại **không cần thiết kế lại** — chỉ cần lấp các gap về error-handling/feedback (mục 2) và hoàn thiện luồng nghiệp vụ còn thiếu (Label, mục 3, hành động #3).
- So sánh "chuẩn ngành" trong doc này dựa trên pattern phổ biến quan sát được ở các app POS thương mại phổ thông (Square, Loyverse, KiotViet, Sapo) và các thư viện in nhiệt phổ biến (escpos-php, node-thermal-printer) — không trích dẫn tài liệu nội bộ của các sản phẩm đó (không có quyền truy cập), chỉ dựa trên hành vi/UX quan sát được và kiến thức domain phổ biến của POS thermal printing.
