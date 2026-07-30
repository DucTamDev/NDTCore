# Thiết Kế: NDTCore.POS Phase 1 — Settings & Printer Management

> **Scope:** Dự án mới `NDTCore.App/` (React Native CLI, Android POS). Không đụng tới `NDTCore.BE` hay `NDTCore.FE`.

---

## 1. Bối Cảnh & Mục Đích

`NDTCore.App` (tên package thực tế `NDTCorePOS`) là ứng dụng POS Android mới, hiện thư mục chỉ có docs (`README.md`, `prompts/[0001-0004]`, `design-ui/*.html`) — chưa có code. Các file `prompts/` đã là spec chi tiết do người dùng viết sẵn cho 4 phase; tài liệu này **chính thức hoá Phase 1** (tương ứng `[0002] setting-printer.md`) thành spec chuẩn của repo, làm cơ sở viết implementation plan.

Phase 1 chỉ làm **Settings & Printer Management** — quản lý cấu hình máy in cục bộ trên thiết bị (MMKV), không có nghiệp vụ bán hàng, không gọi API, không cần Auth/Splash thật.

**Giới hạn môi trường quan trọng:** phiên làm việc hiện tại không có Android device/emulator hay máy in vật lý để test. Toàn bộ luồng cần hardware thật (scan USB/Bluetooth, connect, in thử) sẽ được implement đúng kiến trúc nhưng **cần người dùng tự test trên thiết bị thật** — không claim "đã hoạt động" chỉ dựa trên compile/type-check.

---

## 2. Phạm Vi

**Trong phạm vi:**
- Bootstrap project React Native CLI + TypeScript trong `NDTCore.App/`
- `SettingsScreen` (layout landscape, sidebar + content) theo `design-ui/pos_settings_landscape.html`
- `PrinterManagementPanel`: danh sách máy in, thêm/sửa/xóa, đặt mặc định, kết nối/ngắt/kết nối lại, in thử, auto-reconnect
- `AddPrinterModal` (dùng chung add/edit) theo `design-ui/pos_add_printer_modal.html`
- Kiến trúc `PrinterService` + Driver Adapter (Protocol × Connection độc lập) theo `[0001]` mục 11
- Driver ESC/POS (qua `react-native-esc-pos-printer`, USB/BT/LAN) và Driver TSPL (tự encode, transport qua `react-native-tcp-socket` cho LAN, `react-native-bluetooth-classic` cho BT)
- MMKV lưu cấu hình theo thiết bị (không theo user)
- Shared components tối thiểu cần cho màn hình này: `AppButton`, `AppInput`, `AppSelect`, `AppSwitch`, `StatusDot`, `ConfirmDialog`, `EmptyState`, `LoadingOverlay`

**Ngoài phạm vi (tường minh):**
- Auth/Login/Splash/Session thật, Home Dashboard, i18next, Dark Theme, Sync/Offline Queue — thuộc `[0003]` Foundation, làm ở phase sau
- Product/Cart/Order/Sales, receipt template bán hàng thật — thuộc `[0004]` Sales
- **USB transport cho máy in tem (TSPL)** — chưa có lib RN USB-serial generic nào đủ tin cậy; Phase 1 sẽ throw `UnsupportedConnectionError` rõ ràng thay vì giả lập hoạt động (chi tiết mục 4.3)
- Auto-reconnect theo OS-level hardware event thật (USB cắm lại, Bluetooth bật lại) — Phase 1 chỉ auto-reconnect lúc app khởi động và khi người dùng bấm nút; lắng nghe native hardware event là milestone riêng nếu cần sau

---

## 3. Bootstrap & Cấu Trúc Dự Án

Khởi tạo bằng `@react-native-community/cli` (TypeScript template) trực tiếp trong `NDTCore.App/`.

**Thư viện chính** (theo `[0001]`):
- Core: `@reduxjs/toolkit`, `react-redux`, `@tanstack/react-query`, `react-native-mmkv`, `react-hook-form`, `@hookform/resolvers`, `zod`, `react-native-paper`, `@react-navigation/native` + `native-stack`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens`
- Printer: `react-native-esc-pos-printer`, `react-native-tcp-socket`, `react-native-bluetooth-classic`

```text
src/
├── app/                   # App.tsx, providers (Redux, QueryClient, PaperProvider, Navigation)
├── navigation/             # RootNavigator tối giản — 1 route Settings
├── store/                  # configureStore, rootReducer
├── services/                # StorageService (MMKV), LoggerService
├── components/               # AppButton, AppInput, AppSelect, AppSwitch, StatusDot, ConfirmDialog, EmptyState, LoadingOverlay
├── theme/                     # Paper theme (Light only)
├── types/                      # Result<T>, AppError dùng chung
└── features/
    ├── settings/                # SettingsScreen, Sidebar, Menu
    └── printer/                  # domain máy in — mục 4
```

`RootNavigator` mở thẳng vào `SettingsScreen`, không có Splash/Login thật.

---

## 4. Kiến Trúc Printer

Nguyên tắc bắt buộc từ `[0001]` mục 11: **Protocol** (ESC/POS, TSPL, …) và **Connection** (USB, Bluetooth, LAN, …) là hai khái niệm độc lập; `PrinterService` là điểm truy cập duy nhất mà UI/Redux được gọi — không component nào gọi thẳng SDK máy in.

### 4.1 Interface trung tâm

```ts
interface IPrinterDriver {
  scan(connectionType: ConnectionType): Observable<DeviceScanEvent>; // loading | found | empty | error
  connect(config: PrinterConfig): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, cb: (status: PrinterStatus) => void): Unsubscribe;
  testPrint(printerId: string): Promise<void>;
}
```

`DriverRegistry: Record<Protocol, IPrinterDriver>` — `PrinterService` chọn driver theo `printer.protocol`.

### 4.2 EscPosDriver

Bọc `react-native-esc-pos-printer` trực tiếp. SDK Epson đã gộp sẵn connection + protocol nội bộ (tự quản lý USB/BT/LAN cho thiết bị Epson-compatible) — driver này chấp nhận coupling đó bên trong, miễn `PrinterService`/UI không đụng thẳng API của SDK (đúng rule "đóng gói trong Driver Adapter", không phải "driver nội bộ cũng phải tách lớp").

### 4.3 TsplDriver

Tự viết `TsplEncoder` (text/barcode/QRCode/cut theo khổ tem) + `ITransport` riêng theo connection type:

| Connection | Transport | Trạng thái Phase 1 |
|---|---|---|
| LAN | `LanTransport` (`react-native-tcp-socket`, connect theo IP:Port nhập tay, không scan) | Hoạt động đầy đủ |
| Bluetooth | `BluetoothTransport` (`react-native-bluetooth-classic`, scan + connect SPP) | Hoạt động đầy đủ |
| USB | `UsbTransport` | **Chưa hỗ trợ** — throw `UnsupportedConnectionError`. Chưa có lib RN USB-serial generic đủ ổn định cho Android USB Host; `react-native-esc-pos-printer` chỉ hỗ trợ USB cho thiết bị Epson (ESC/POS), không dùng được cho TSPL. Cần khảo sát thêm lib hoặc viết Native Module riêng ở một plan sau nếu cần gấp. |

USB cho **máy in hóa đơn** (ESC/POS) không bị ảnh hưởng — vẫn hoạt động qua `EscPosDriver`.

### 4.4 PrinterService (`features/printer/services/PrinterService.ts`)

- `addPrinter/updatePrinter/removePrinter/setDefault` → ghi qua `StorageService` (MMKV)
- `connect/disconnect/reconnect/testPrint` → forward driver tương ứng theo `printer.protocol`
- Phát event trạng thái (`onStatusChange`) → Redux slice subscribe qua hook `usePrinterConnection`; **không polling**

### 4.5 State & Storage

- Redux `printerSlice`: `printers: PrinterConfig[]`, `statusById: Record<string, PrinterStatus>`, `defaultPrinterId: string | null` — load từ MMKV lúc khởi tạo store
- Không dùng TanStack Query cho domain này (không có API)
- MMKV key theo device, không theo user:
  ```
  printer.list: PrinterConfig[]
  printer.defaultId: string | null
  ```
- `PrinterConfig.rawDevice: Record<string, unknown>` lưu nguyên object SDK trả về — không tự nặn model riêng làm mất dữ liệu (đúng `[0002]` mục 14)

### 4.6 Trạng thái kết nối

`Idle | Connecting | Connected | Disconnecting | Disconnected | Reconnecting | Error` — cập nhật hoàn toàn bằng event từ driver, không polling.

---

## 5. UI/UX

Component tree bám theo `[0002]` mục 6 và 2 mockup HTML, giữ nguyên tiếng Việt trong UI:

```text
SettingsScreen (state: activeMenuKey)
├── SettingsSidebar
│     "Thiết bị": Quản lý máy in (active), Máy quét mã vạch (disabled placeholder)
│     "Ứng dụng": Tài khoản / Ngôn ngữ / Đồng bộ / Về ứng dụng (disabled placeholder)
│     Đăng xuất (disabled placeholder)
└── SettingsContent
      └── PrinterManagementPanel
            ├── PrinterList → PrinterListItem
            │     icon theo type · tên · "Connection · Khổ giấy" · PrinterStatusBadge · menu ⋮
            └── AddPrinterModal (add/edit dùng chung qua initialValues?)
```

Các menu item ngoài "Quản lý máy in" hiển thị dạng disabled/greyed để giữ đúng layout mockup nhưng không có handler thật — tránh phải giả lập Auth/Language/Sync (thuộc Phase 2). `StatusDot` hiện cạnh "Quản lý máy in" khi có ≥1 printer `Connected`.

**AddPrinterModal** (theo `pos_add_printer_modal.html`): Tên máy in → Loại máy in (Receipt/Label, card chọn) → Loại kết nối (tabs USB/BT/LAN) → khối động:
- USB/BT: `DeviceScanList` (loading / danh sách / empty state + nút "Quét lại"), chọn đúng 1 thiết bị
- LAN: form IP + Port

→ Khổ giấy (dropdown 58/80mm) → Auto Reconnect (switch) → footer: "In thử" (disabled tới khi `Connected`, không lưu cấu hình/không đổi trạng thái/không đặt mặc định) + "Lưu máy in"

**Menu thao tác trên từng `PrinterListItem`:** Kết nối / Ngắt kết nối / Kết nối lại / Đặt mặc định / Chỉnh sửa / Xóa. Xóa khi đang `Connected` → `ConfirmDialog` trước khi disconnect + remove.

**Validation (Zod `printerFormSchema`)** theo `[0002]` mục 17: `printerName/printerType/protocol/connectionType/paperSize` bắt buộc; USB/BT bắt buộc đã chọn device; LAN bắt buộc IP hợp lệ + port 1–65535.

**Save flow** (`[0002]` mục 18): validate → lưu MMKV → đóng modal → refresh list → nếu Auto Reconnect bật thì tự connect.

**Edit flow** (`[0002]` mục 19): nếu đổi Protocol/Connection/Device/IP/Port → disconnect kết nối cũ → cập nhật config → reconnect nếu Auto Reconnect đang bật.

---

## 6. Error Handling & Logging

- Toàn bộ lỗi driver/transport chuẩn hoá qua `AppError` (đã có type dùng chung ở `src/types/`) trước khi lên UI — hiển thị ngay trên Form khi connect thất bại, không throw thẳng.
- `LoggerService` (debug/info/warning/error), không dùng `console.log` khi build production.

---

## 7. Kiểm Thử

Môi trường hiện tại không có Android device/emulator/máy in vật lý:

- `npx tsc --noEmit` + ESLint sau mỗi bước lớn để đảm bảo compile/type-safe.
- Logic thuần JS (Zod schema, `TsplEncoder`, `printerSlice` reducer) verify được bằng cách gọi hàm trực tiếp, không cần hardware.
- `npm run android` build sẽ chạy để xác nhận project compile được — chỉ khi có sẵn Android SDK/emulator trên máy người dùng.
- Luồng cần hardware thật (scan USB/BT, connect, in thử, TSPL qua LAN/BT) đánh dấu rõ trong plan là **"cần test trên thiết bị thật"** — không tự nhận đã hoạt động chỉ vì code compile được.

---

## 8. Rủi Ro & Giả Định Đã Biết

- `react-native-esc-pos-printer` được giả định hỗ trợ đủ USB/BT/LAN cho máy Epson-compatible như README mô tả — chưa verify trực tiếp API của lib vì không có hardware; nếu lib thực tế thiếu 1 connection type nào đó, `EscPosDriver` sẽ cần điều chỉnh khi implement.
- USB cho TSPL (label printer) không khả dụng trong Phase 1 (mục 4.3) — quyết định có chủ đích, không phải thiếu sót.
- Auto-reconnect theo hardware event thật (USB cắm lại, BT bật) chưa làm trong Phase 1 — chỉ auto-reconnect lúc khởi động app/theo thao tác người dùng.
