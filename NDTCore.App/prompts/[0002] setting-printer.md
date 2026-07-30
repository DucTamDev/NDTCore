# NDTCore.POS

# Phase 1 - Feature – Settings & Printer Management

## Mục tiêu

Triển khai chức năng **Settings** và **Printer Management** cho NDTCore.POS.

Đây là chức năng cốt lõi của **Phase 1**, cho phép người dùng cấu hình, quản lý và kiểm tra kết nối máy in.

Chức năng này chỉ quản lý cấu hình máy in, **không thực hiện nghiệp vụ bán hàng**.

Toàn bộ chức năng phải tuân thủ **Project Prompt** của NDTCore.POS.

---

# 1. Mục tiêu chức năng

Người dùng có thể:

* Xem danh sách máy in.
* Thêm máy in.
* Chỉnh sửa máy in.
* Xóa máy in.
* Đặt máy in mặc định.
* Kết nối máy in.
* Ngắt kết nối.
* Kết nối lại.
* In thử.
* Kiểm tra trạng thái kết nối.
* Bật/Tắt Auto Reconnect.

---

# 2. Yêu cầu chung

* Không phụ thuộc vào hãng máy in.
* Không phụ thuộc vào thư viện in cụ thể.
* Không gọi trực tiếp Native SDK trong UI.
* UI chỉ giao tiếp với `PrinterService`.
* Toàn bộ cấu hình được lưu bằng MMKV.
* Không gọi API.
* Không đồng bộ dữ liệu với Server.
* Trạng thái kết nối sử dụng Event từ Driver.
* Không Polling.

---

# 3. Feature Structure

```text
features/

    settings/

        components/

        hooks/

        screens/

        store/

        types/

        utils/

    printer/

        components/

        hooks/

        services/

        types/

        utils/
```

Không tạo thêm layer Repository hoặc Presenter nếu không cần.

---

# 4. Settings Screen

Layout dành cho màn hình Landscape.

```text
+----------------------+------------------------------------+
|                      |                                    |
| Sidebar              | Content                            |
|                      |                                    |
|                      |                                    |
+----------------------+------------------------------------+
```

Sidebar khoảng 220px.

---

# 5. Menu

Sidebar gồm:

* Printer
* Language
* Sync
* About

Nếu có ít nhất một máy in đang Connected thì menu Printer hiển thị `StatusDot`.

---

# 6. Component

## Settings

* SettingsScreen
* SettingsHeader
* SettingsSidebar
* SettingsMenuGroup
* SettingsMenuItem
* SettingsContent
* SettingsRow

## Printer

* PrinterManagementPanel
* PrinterList
* PrinterListItem
* PrinterStatusBadge
* AddPrinterModal

---

# 7. SettingsScreen

Chỉ quản lý:

```ts
activeMenuKey
```

Không chứa Business Logic.

---

# 8. Printer Management

Hiển thị danh sách máy in.

Thông tin mỗi máy:

* Tên
* Printer Type
* Protocol
* Connection Type
* Trạng thái
* Mặc định

Ví dụ

```text
Receipt Printer

Receipt

ESC/POS

USB

Connected
```

---

# 9. Trạng thái

Hệ thống hỗ trợ:

* Idle
* Connecting
* Connected
* Disconnecting
* Disconnected
* Reconnecting
* Error

Trạng thái cập nhật bằng Event.

Không Polling.

---

# 10. Menu thao tác

Mỗi máy in có menu:

* Kết nối
* Ngắt kết nối
* Kết nối lại
* Đặt mặc định
* Chỉnh sửa
* Xóa

Nếu máy đang Connected:

Khi xóa phải hiện Confirm Dialog.

---

# 11. Add / Edit Printer

Sử dụng cùng một Modal.

```ts
AddPrinterModal
```

Có hỗ trợ:

```ts
initialValues?
```

để tái sử dụng khi chỉnh sửa.

Không tạo EditPrinterModal riêng.

---

# 12. Form

Sử dụng

* React Hook Form
* Zod

Các trường:

## Printer Name

Tên máy in.

Bắt buộc.

---

## Printer Type

* Receipt
* Label

Chỉ dùng để phân loại.

Không quyết định Driver.

---

## Protocol

Dropdown.

Hiện tại hỗ trợ:

* ESC/POS
* TSPL

Thiết kế phải dễ mở rộng thêm:

* ZPL
* CPCL

Không Auto Detect.

---

## Connection Type

Tabs

* USB
* Bluetooth
* LAN

---

## Paper Size

Dropdown

* 58mm
* 80mm

---

## Auto Reconnect

Switch.

---

# 13. Scan thiết bị

Khi chọn

## USB

Tự động Scan.

Hiển thị:

* Loading
* Danh sách thiết bị
* Empty State

Có nút

```text
Quét lại
```

---

## Bluetooth

Tự động Scan.

Hiển thị:

* Loading
* Danh sách thiết bị
* Empty State

Có nút

```text
Quét lại
```

---

## LAN

Không Scan.

Hiển thị Form:

* IP
* Port

Validate bằng Zod.

---

# 14. Device List

USB/Bluetooth chỉ cho phép chọn **một** thiết bị.

Hiển thị:

* Device Name
* Device Id
* Address
* Vendor Id (nếu có)
* Product Id (nếu có)

Lưu toàn bộ thông tin mà SDK trả về.

Không tự tạo Model riêng làm mất dữ liệu.

---

# 15. Quy trình kết nối

Sau khi chọn thiết bị hoặc nhập IP:

Người dùng bấm

```text
Kết nối
```

`PrinterService`

↓

Driver

↓

Connection

↓

Native Library

Nếu thành công

* Connected

Nếu thất bại

* Error

Hiển thị lỗi ngay trên Form.

---

# 16. In thử

Nút

```text
In thử
```

Mặc định Disabled.

Chỉ Enable khi

```text
Connected
```

In thử:

* Không lưu cấu hình.
* Không thay đổi trạng thái máy in.
* Không đặt làm mặc định.

---

# 17. Validation

Sử dụng Zod.

Điều kiện lưu:

Bắt buộc:

* Printer Name
* Printer Type
* Protocol
* Connection Type
* Paper Size

USB/Bluetooth

* Đã chọn thiết bị.

LAN

* IP hợp lệ.
* Port hợp lệ.

---

# 18. Save

Sau khi bấm

```text
Lưu
```

Thực hiện:

1. Validate.
2. Lưu MMKV.
3. Đóng Modal.
4. Refresh Printer List.
5. Nếu Auto Reconnect được bật thì tự động thực hiện kết nối.

Không gọi API.

---

# 19. Edit

Cho phép sửa:

* Tên
* Printer Type
* Protocol
* Connection
* Paper Size
* AutoReconnect

Nếu thay đổi:

* Protocol
* Connection Type
* Device
* IP
* Port

Thì:

1. Disconnect kết nối cũ.
2. Cập nhật cấu hình.
3. Kết nối lại nếu Auto Reconnect đang bật.

---

# 20. Delete

Nếu máy đang Connected:

* Hiện Confirm Dialog.
* Disconnect.
* Xóa khỏi MMKV.

Nếu Disconnected:

* Xóa trực tiếp.

---

# 21. Auto Reconnect

Nếu được bật:

Ứng dụng tự động kết nối lại khi:

* App khởi động.
* Thiết bị Bluetooth khả dụng.
* USB được cắm lại.
* Kết nối mạng khả dụng (đối với LAN).

Không yêu cầu người dùng thao tác.

---

# 22. Settings

## Language

* Thay đổi ngôn ngữ ngay lập tức.
* Không Restart App.

---

## Logout

* Hiện Confirm Dialog.
* Xóa Token.
* Giữ nguyên toàn bộ cấu hình máy in.
* Giữ nguyên Auto Reconnect.
* Giữ nguyên Printer Settings.

---

# 23. Nguyên tắc triển khai

* Không phụ thuộc vào Epson, XPrinter hoặc bất kỳ hãng máy in nào.
* Không gọi trực tiếp API của thư viện in trong UI.
* Không Auto Detect Protocol.
* Không Polling trạng thái máy in.
* `PrinterService` là điểm truy cập duy nhất của ứng dụng.
* Thiết kế phải cho phép bổ sung Protocol (ZPL, CPCL...) và Connection (Serial, WebUSB...) mà không thay đổi UI hoặc Business Logic.
* Mọi thao tác kết nối, ngắt kết nối, quét thiết bị và in đều phải đi qua `PrinterService`.
* Ưu tiên khả năng mở rộng, tái sử dụng và bảo trì mã nguồn hơn là tối ưu cho một thư viện hoặc một hãng máy in cụ thể.
