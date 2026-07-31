# NDTCore.POS

> **NDTCore.POS** là ứng dụng **Point of Sale (POS)** được phát triển bằng **React Native**, tối ưu cho các thiết bị Android POS. Ứng dụng cung cấp chức năng bán hàng, quản lý đơn hàng và tích hợp máy in hóa đơn, máy in tem thông qua Native Module.

---

# Giới thiệu

NDTCore.POS được xây dựng nhằm cung cấp một nền tảng POS hiện đại, dễ mở rộng và dễ tích hợp với các thiết bị phần cứng.

Mục tiêu của dự án:

* Tối ưu cho thiết bị Android POS.
* Giao diện đơn giản, thao tác nhanh.
* Kiến trúc rõ ràng, dễ bảo trì.
* Hỗ trợ nhiều loại máy in.
* Dễ dàng tích hợp SDK của các nhà sản xuất.
* Sẵn sàng mở rộng thêm các thiết bị ngoại vi trong tương lai.

Giai đoạn đầu của dự án tập trung vào **Printer Management**, xây dựng nền tảng quản lý máy in để phục vụ các chức năng bán hàng.

---

# Công nghệ sử dụng

| Hạng mục         | Công nghệ                    |
| ---------------- | ---------------------------- |
| Framework        | React Native CLI             |
| Ngôn ngữ         | TypeScript                   |
| UI Framework     | React Native Paper           |
| Điều hướng       | React Navigation             |
| State Management | Redux Toolkit                |
| HTTP Client      | Axios                        |
| Server State     | TanStack Query               |
| Local Storage    | react-native-mmkv            |
| Form             | React Hook Form              |
| Validation       | Zod                          |
| Icons            | react-native-vector-icons    |
| Animation        | React Native Reanimated      |
| Gesture          | react-native-gesture-handler |
| Bottom Sheet     | @gorhom/bottom-sheet         |
| Date Library     | dayjs                        |

---

# Kiến trúc tổng thể

```text
React Native

├── UI (React Native Paper)

├── Navigation (React Navigation)

├── State (Redux Toolkit)

├── Server State (TanStack Query)

├── API (Axios)

├── Local Storage (MMKV)

├── Form (React Hook Form)

├── Validation (Zod)

└── Native Module (Android)
```

---

# Cấu trúc thư mục

```text
src/

├── app/
├── assets/
├── components/
├── constants/
├── features/
│   ├── auth/
│   ├── printer/
│   ├── product/
│   ├── cart/
│   ├── order/
│   └── settings/
├── hooks/
├── navigation/
├── screens/
├── services/
├── store/
├── types/
├── utils/
└── App.tsx
```

---

# Lộ trình phát triển

## Phase 1 - Printer Management

Xây dựng hệ thống quản lý máy in.

### Chức năng

* Quản lý nhiều máy in
* Tìm kiếm thiết bị
* Kết nối USB
* Kết nối Bluetooth
* Kết nối LAN
* Thêm máy in
* Chỉnh sửa cấu hình
* Xóa máy in
* Kết nối / Ngắt kết nối
* In thử
* Lưu cấu hình
* Tự động kết nối lại

### Loại máy in hỗ trợ

* Receipt Printer (Máy in hóa đơn)
* Label Printer (Máy in tem)

---

## Phase 2 - POS Core

Hoàn thiện các chức năng bán hàng.

* Đăng nhập
* Màn hình bán hàng (POS)
* Danh mục sản phẩm
* Danh sách sản phẩm
* Giỏ hàng
* In hóa đơn
* Lịch sử đơn hàng

---

## Phase 3 - Advanced Features

* Hỗ trợ nhiều SDK máy in
* Máy quét mã vạch
* Thanh toán QR
* Đồng bộ Offline
* Đồng bộ dữ liệu
* Quản lý nhiều cửa hàng

---

# Quản lý State

## Client State (Redux Toolkit)

Quản lý trạng thái của ứng dụng:

* Người dùng
* Giỏ hàng
* Đơn hàng hiện tại
* Danh sách máy in
* Trạng thái kết nối máy in
* Thiết lập ứng dụng

## Server State (TanStack Query)

Quản lý dữ liệu từ Backend:

* Sản phẩm
* Danh mục
* Khách hàng
* Đơn hàng
* Khuyến mãi
* Cửa hàng

---

# Lưu trữ cục bộ

Sử dụng **react-native-mmkv** để lưu dữ liệu cục bộ.

Ví dụ:

* Access Token
* Refresh Token
* Danh sách máy in
* Cấu hình từng máy in
* Thiết lập ứng dụng
* Thông tin người dùng

---

# Form & Validation

Sử dụng:

* React Hook Form
* Zod

Đảm bảo:

* Hiệu năng cao
* Type-safe
* Dễ bảo trì
* Tích hợp tốt với TypeScript

---

# Điều hướng

```text
Splash

↓

Đăng nhập

↓

POS

├── Bán hàng
├── Lịch sử đơn hàng
└── Cài đặt
      └── Quản lý máy in
```

Sau khi đăng nhập thành công, người dùng được chuyển trực tiếp đến **màn hình Bán hàng (POS)**.

---

# Printer Management

Hệ thống được thiết kế theo mô hình **Multi Printer**, cho phép quản lý nhiều máy in trong cùng một thiết bị POS.

Hiện tại hỗ trợ:

* Receipt Printer
* Label Printer

Mỗi máy in có thể cấu hình:

* Tên máy in
* Loại máy in
* Loại kết nối (USB / Bluetooth / LAN)
* Thiết bị
* Khổ giấy
* Tự động kết nối
* Trạng thái kết nối

---

# Kiến trúc tích hợp máy in

```text
React Native

        │

Printer Manager

        │

Printer Service

        │
react-native-esc-pos-printer

        │

Receipt Printer / Label Printer
```

Kiến trúc theo **Adapter Pattern** giúp tách biệt tầng nghiệp vụ với SDK của từng nhà sản xuất, thuận tiện cho việc mở rộng và bảo trì.

---

# Native Module

Các chức năng làm việc với phần cứng được triển khai thông qua Native Module.

Bao gồm:

* Máy in
* USB
* Bluetooth
* Thiết bị Android POS

---

# Yêu cầu môi trường

* Node.js 22+
* Android Studio
* Android SDK
* JDK 17
* React Native CLI

---

# Chạy dự án

Cài đặt thư viện:

```bash
npm install
```

Khởi động Metro:

```bash
npm start
```

Chạy trên Android:

```bash
npm run android
```

---

# Quy ước phát triển

* TypeScript Strict Mode
* Functional Components
* React Hooks
* Feature-based Architecture
* Redux Toolkit
* TanStack Query
* ESLint
* Prettier
* Absolute Imports
* Reusable Components
* Clean Architecture

---

# Mục tiêu kiến trúc

* Hỗ trợ nhiều thiết bị Android POS.
* Quản lý đồng thời nhiều máy in hóa đơn và máy in tem.
* Hỗ trợ USB, Bluetooth và LAN.
* Không phụ thuộc vào SDK của một nhà sản xuất.
* Dễ dàng bổ sung thêm SDK hoặc thiết bị mới.
* Kiến trúc sẵn sàng cho các phiên bản POS trong tương lai.

---

# Giấy phép

Dự án được phát triển nội bộ cho hệ thống **NDTCore.POS**.
