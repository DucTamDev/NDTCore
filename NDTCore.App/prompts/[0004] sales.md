# NDTCore.POS

# Phase 3 - Sales

## Mục tiêu

Triển khai toàn bộ nghiệp vụ bán hàng của NDTCore.POS.

Phase này sử dụng toàn bộ nền tảng đã hoàn thành ở:

- 0001-project-overview.md
- 0002-setting-printer.md
- 0003-foundation.md

Sau khi hoàn thành Phase này, ứng dụng phải có khả năng thực hiện đầy đủ quy trình bán hàng từ chọn sản phẩm đến hoàn tất đơn hàng và in hóa đơn.

---

# Phạm vi

Bao gồm:

- Product Catalog
- Category
- Search
- Customer
- Shopping Cart
- Order
- Checkout
- Receipt Printing
- Kitchen Printing
- Label Printing
- Offline Order
- Order Synchronization

Không bao gồm:

- Payment Gateway
- Inventory
- Promotion Engine
- Employee Management
- Reporting

---

# Sales Workflow

Luồng bán hàng chuẩn:

Login
↓

Dashboard
↓

Product Catalog
↓

Shopping Cart
↓

Customer (Optional)
↓

Checkout
↓

Create Order
↓

Print Receipt

↓

Print Kitchen Ticket (Optional)

↓

Print Label (Optional)

↓

Sync

---

# Product Catalog

Hiển thị toàn bộ sản phẩm.

Bao gồm:

- Category
- Product
- Variant
- Modifier
- Combo
- Favorite

Cho phép:

- Search
- Filter
- Sort

Dữ liệu lấy từ API.

Sử dụng TanStack Query.

Có Cache.

Hỗ trợ Offline.

---

# Product Detail

Hiển thị:

- Name
- Image
- Price
- Description
- Variant
- Modifier

Cho phép:

- Chọn Variant
- Chọn Modifier
- Ghi chú

Sau đó:

Thêm vào Cart.

---

# Shopping Cart

Shopping Cart là trung tâm của toàn bộ nghiệp vụ bán hàng.

Chức năng:

- Add Product
- Remove Product
- Update Quantity
- Update Modifier
- Update Variant
- Note
- Discount Item
- Discount Order
- Coupon
- Tax
- Service Charge

Hiển thị:

- Item Count
- Quantity
- Subtotal
- Discount
- Tax
- Grand Total

Cart phải cập nhật theo thời gian thực.

Không Reload Screen.

---

# Customer

Cho phép:

- Search
- Select
- Remove Customer

Hiển thị:

- Membership
- Loyalty
- Point

Customer là tùy chọn.

Không bắt buộc.

---

# Checkout

Kiểm tra:

- Cart hợp lệ
- Customer (nếu có)
- Total

Hiển thị:

- Order Summary

Cho phép:

- Confirm Order

Chưa xử lý Payment Gateway.

---

# Order

Sau khi Checkout:

Tạo Order.

Order bao gồm:

- Order Number
- Created Time
- Items
- Customer
- Discount
- Tax
- Service Charge
- Total

Trạng thái:

- Draft
- Completed
- Cancelled

---

# Draft Order

Cho phép:

- Save Draft
- Resume Draft
- Delete Draft

Draft lưu Local.

---

# Order History

Hiển thị:

- Recent Orders
- Order Detail

Cho phép:

- Reprint
- Reorder

---

# Receipt Printing

Sử dụng PrinterService.

Không gọi trực tiếp SDK.

Cho phép:

- Receipt Builder
- Receipt Template
- Reprint

Printer:

- Default Receipt Printer

Protocol:

- ESC/POS

---

# Kitchen Printing

Cho phép:

- Route theo Category
- Route theo Printer

Ví dụ:

Drink

↓

Printer A

Food

↓

Printer B

---

# Label Printing

Cho phép:

- Barcode
- QRCode
- Product Label

Protocol:

- TSPL

---

# Multi Printer

Một Order có thể gửi tới nhiều máy in.

Ví dụ:

Receipt

↓

Receipt Printer

Kitchen

↓

Kitchen Printer

Label

↓

Label Printer

Mỗi Printer hoạt động độc lập.

Không chờ nhau.

---

# Offline Order

Nếu Offline:

Cho phép:

- Tạo Order

Order lưu Local.

Khi Online:

Tự động Sync.

---

# Synchronization

Đồng bộ:

- Order
- Draft
- Print Log

Retry nếu thất bại.

Không mất dữ liệu.

---

# Error Handling

Chuẩn hóa:

- Printer Error
- Network Error
- Validation Error

Không Crash App.

---

# State Management

Redux

Quản lý:

- Cart
- Current Order
- Customer

TanStack Query

Quản lý:

- Product
- Category
- Customer

---

# Local Storage

MMKV

Lưu:

- Draft Order
- Cart
- Recent Customer

Không lưu Product.

---

# Coding Rules

Không Business Logic trong Screen.

Không gọi Printer SDK.

Không truy cập MMKV trực tiếp.

Không gọi API trực tiếp trong UI.

Mọi thao tác:

↓

Hook

↓

Service

↓

API

---

# Acceptance Criteria

Sau khi hoàn thành Phase này:

✓ Hiển thị Product Catalog.

✓ Search Product.

✓ Chọn Variant.

✓ Chọn Modifier.

✓ Thêm vào Cart.

✓ Tính Total.

✓ Chọn Customer.

✓ Checkout.

✓ Tạo Order.

✓ Lưu Draft.

✓ Reorder.

✓ In Receipt.

✓ In Kitchen Ticket.

✓ In Label.

✓ Hoạt động Offline.

✓ Đồng bộ Order khi Online.

Ứng dụng sẵn sàng mở rộng sang Payment, Inventory và Reporting trong các Phase tiếp theo.