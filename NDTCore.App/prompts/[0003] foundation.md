# NDTCore.POS

# Phase 2 - Foundation (Application Core)

## Mục tiêu

Triển khai toàn bộ nền tảng vận hành của ứng dụng sau khi hoàn thành Device Setup (Phase 1).

Phase này chịu trách nhiệm xây dựng khung ứng dụng (Application Core), quản lý người dùng, phiên đăng nhập, điều hướng, đồng bộ và các thành phần dùng chung.

Không triển khai nghiệp vụ bán hàng.

Sau khi hoàn thành Phase này, ứng dụng phải có thể hoạt động như một ứng dụng hoàn chỉnh, sẵn sàng triển khai các nghiệp vụ POS ở Phase 3.

---

# Phạm vi

Bao gồm:

- Splash
- Authentication
- Session
- Navigation
- Home Dashboard
- User Profile
- Synchronization
- Localization
- Theme
- Shared Components
- Shared Hooks
- Shared Services

Không bao gồm:

- Product
- Category
- Customer
- Shopping Cart
- Order
- Checkout
- Payment
- Receipt Printing
- Label Printing

---

# Authentication

Triển khai đầy đủ quy trình xác thực.

## Login

Hỗ trợ:

- Username / Password
- Remember Login

Sau khi đăng nhập:

- Lưu Access Token.
- Lưu Refresh Token.
- Lưu User Information.
- Chuyển đến Home.

---

## Auto Login

Khi mở App:

Splash Screen phải:

- Kiểm tra Session.
- Kiểm tra Token.
- Kiểm tra Refresh Token.
- Tự động Restore User.

Nếu Session hợp lệ:

→ Home

Nếu không hợp lệ:

→ Login

---

## Refresh Token

Khi Access Token hết hạn:

- Refresh Token.
- Cập nhật Session.
- Không yêu cầu Login lại.

Nếu Refresh thất bại:

- Logout.
- Điều hướng Login.

---

## Logout

Khi Logout:

- Xóa Session.
- Xóa Token.
- Xóa User Cache.

Không xóa:

- Printer Configuration.
- Language.
- Theme.
- Application Settings.

---

# Splash Screen

Splash chịu trách nhiệm:

- Restore Session.
- Restore Settings.
- Restore Printer Configuration.
- Restore Language.
- Initialize Application.

Không xử lý Business Logic.

---

# Navigation

Triển khai Navigation thống nhất.

Ví dụ:

Splash

↓

Login

↓

Home

↓

Settings

↓

About

Navigation phải dễ mở rộng.

Không Hard-code.

---

# Home Dashboard

Home chỉ là Dashboard.

Hiển thị:

- Store Information.
- User Information.
- Printer Status.
- Sync Status.
- Version.
- Quick Menu.

Không hiển thị Product.

---

# User Profile

Bao gồm:

- Avatar.
- Name.
- Store.
- Role.
- Logout.

---

# Synchronization

Triển khai:

- Manual Sync.
- Auto Sync.
- Retry.
- Offline Queue.

Chưa đồng bộ Order.

---

# Network Monitoring

Theo dõi:

- Online.
- Offline.

Thông báo khi trạng thái thay đổi.

Cho phép Trigger Sync khi có mạng.

---

# Localization

Sử dụng i18next.

Cho phép:

- Đổi ngôn ngữ Runtime.
- Không Restart App.

Ngôn ngữ lưu bằng MMKV.

---

# Theme

Sử dụng Material Design.

Hỗ trợ:

- Light Theme.
- Dark Theme (Future).

Theme lưu trong MMKV.

---

# Local Storage

Toàn bộ Local Storage thông qua StorageService.

Bao gồm:

- Session.
- User.
- Settings.
- Language.
- Theme.

Không truy cập MMKV trực tiếp trong UI.

---

# Shared Components

Hoàn thiện bộ Component dùng chung.

Ví dụ:

- AppButton
- AppInput
- AppPasswordInput
- AppDialog
- AppSelect
- AppSwitch
- AppLoading
- LoadingOverlay
- EmptyState
- ConfirmDialog
- StatusDot
- AppCard

Các Component phải:

- Reusable.
- Không chứa Business Logic.

---

# Shared Hooks

Ví dụ:

- useAuth
- useTheme
- useLanguage
- useNetwork
- useStorage

Hook chỉ xử lý Logic.

Không Render UI.

---

# Shared Services

Bao gồm:

- StorageService
- LoggerService
- LanguageService

PrinterService đã triển khai ở Phase 1.

Service không phụ thuộc React Component.

---

# Error Handling

Chuẩn hóa toàn bộ Error.

Bao gồm:

- API Error.
- Validation Error.
- Network Error.
- Authentication Error.

UI chỉ hiển thị Error đã được chuẩn hóa.

---

# Logging

LoggerService hỗ trợ:

- Debug.
- Info.
- Warning.
- Error.

Không sử dụng console.log trong Production.

---

# State Management

Redux Toolkit

Dùng cho:

- Session.
- User.
- Theme.
- Language.
- UI State.

TanStack Query

Dùng cho:

- API.
- Cache.

Không dùng Redux để Cache API.

---

# Coding Rules

- Không Business Logic trong Screen.
- Không gọi Native Module trong UI.
- Không truy cập MMKV trực tiếp.
- Không gọi API trực tiếp trong Component.
- UI chỉ giao tiếp với Hook hoặc Service.

---

# Kết quả mong đợi

Sau khi hoàn thành Phase 2:

Ứng dụng có thể:

✓ Login

✓ Logout

✓ Auto Login

✓ Session Management

✓ Navigation

✓ Dashboard

✓ Localization

✓ Theme

✓ Sync

✓ Shared Infrastructure

✓ Sẵn sàng triển khai Product và Sales ở Phase 3.

---

# Acceptance Criteria

- Người dùng có thể đăng nhập và duy trì phiên làm việc.
- Splash tự động khôi phục trạng thái ứng dụng và điều hướng chính xác.
- Navigation hoạt động ổn định và dễ mở rộng.
- Dashboard hiển thị đầy đủ thông tin nền.
- Ngôn ngữ thay đổi ngay mà không cần khởi động lại.
- Dữ liệu cục bộ được quản lý qua StorageService.
- Các Service và Component dùng chung có thể tái sử dụng ở các Phase tiếp theo.
- Không có nghiệp vụ bán hàng hoặc quản lý sản phẩm trong Phase này.