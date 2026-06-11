# Product Module — Đặc Tả Chức Năng

> **Hệ thống:** NDTCore — SaaS quản lý chuỗi trà sữa  
> **Vai trò tài liệu:** Business Analysis & UI/UX Design Specification  
> **Phiên bản:** 1.1 — Tháng 6/2026  
> **Phạm vi:** Toàn bộ Product Module (5 Plan: A → E)  
> **Thay đổi v1.1:** Bổ sung Detail Page cho tất cả entity (Category, Tag, Option, OptionGroup, Product)

---

## Mục Lục

1. [Tổng Quan Module](#1-tổng-quan-module)
2. [Sơ Đồ Quan Hệ Chức Năng](#2-sơ-đồ-quan-hệ-chức-năng)
3. [Plan A — Dữ Liệu Tham Chiếu](#3-plan-a--dữ-liệu-tham-chiếu)
   - 3.1 [Category](#31-category--danh-mục-sản-phẩm)
   - 3.2 [Tag](#32-tag--nhãn-phân-loại)
4. [Plan B — Nhóm & Lựa Chọn](#4-plan-b--nhóm--lựa-chọn)
   - 4.1 [OptionGroup](#41-optiongroup--nhóm-tuỳ-chọn)
   - 4.2 [Option](#42-option--lựa-chọn-cụ-thể)
5. [Plan C — Sản Phẩm Cốt Lõi](#5-plan-c--sản-phẩm-cốt-lõi)
6. [Plan D — Quan Hệ Sản Phẩm](#6-plan-d--quan-hệ-sản-phẩm)
7. [Plan E — Cấu Hình Theo Cửa Hàng](#7-plan-e--cấu-hình-theo-cửa-hàng)
8. [Shared Components](#8-shared-components)
9. [Luồng Nghiệp Vụ Quan Trọng](#9-luồng-nghiệp-vụ-quan-trọng)
10. [Tổng Hợp Màn Hình](#10-tổng-hợp-màn-hình)

---

## 1. Tổng Quan Module

### 1.1 Mục Đích

Product Module là **nguồn dữ liệu duy nhất (Single Source of Truth)** cho toàn bộ catalog hàng hoá của một tenant. Module quản lý từ định nghĩa sản phẩm gốc đến cấu hình tuỳ chỉnh riêng cho từng cửa hàng, đảm bảo:

- Menu toàn hệ thống nhất quán, có thể override linh hoạt theo cửa hàng
- Giá và tình trạng tại thời điểm bán được ghi nhận chính xác vào Order
- Tách biệt rõ ràng giữa dữ liệu cấu hình (Product) và dữ liệu giao dịch (Order)

### 1.2 Cấu Trúc 5 Plan

| Plan | Tên | Nội dung | Phụ thuộc |
|------|-----|----------|-----------|
| **A** | Reference Data | Category, Tag | Không có |
| **B** | Option Catalog | OptionGroup, Option | Không có |
| **C** | Product Core | Product, ProductImage | Plan A |
| **D** | Product Relations | ProductTag, ProductOptionGroup, ProductOptionConfig | Plan A + B + C |
| **E** | Store Overrides | ProductStore, ProductStorePrice, OptionStoreAvailability, OptionStorePrice | Plan B + C |

### 1.3 Người Dùng Liên Quan

| Vai trò | Quyền trên Product Module |
|---------|---------------------------|
| OrgAdmin | Toàn quyền |
| BrandManager | Toàn quyền Product + StoreOverride |
| FranchiseeOwner | Chỉ StoreOverride thuộc store của mình |
| StoreManager | Chỉ StoreOverride thuộc store của mình |

### 1.4 Nguyên Tắc Thiết Kế UI

- **Mỗi entity có đủ 3 màn hình:** List → Detail Page → Form (tạo/sửa)
- Mọi màn hình List đều có **toolbar:** tìm kiếm, bộ lọc, nút "Thêm mới"
- **Detail Page** là trang riêng, hiển thị toàn bộ thông tin và quan hệ của entity
- Thao tác **tạo / sửa** mở bằng Dialog (form đơn giản) hoặc Page riêng (form phức tạp nhiều section)
- Mọi thao tác **xoá hoặc gỡ liên kết** phải qua `AppConfirmDialog` xác nhận trước
- Trường nhập giá tiền dùng `AppCurrencyField` thống nhất (format VND, validate ≥ 0)
- **Slug** tự sinh từ tên (lowercase, bỏ dấu, thay space bằng `-`), người dùng có thể chỉnh
- **Trạng thái** hiển thị dạng badge: 🟢 Hoạt động / ⚫ Ẩn

---

## 2. Sơ Đồ Quan Hệ Chức Năng

```
Category ──────────────────────────────► Product ◄── ProductImage
                                            │
Tag ─────────────────────── ProductTag ─────┤
                                            │
OptionGroup ──── Option ── ProductOptionGroup (ràng buộc chọn)
                    │                       │
                    └───── ProductOptionConfig (override giá per-product)
                    │
                    ├───── OptionStoreAvailability (bật/tắt per-store)
                    └───── OptionStorePrice       (giá per-store)

Product ─────── ProductStore      (bật/tắt sản phẩm per-store)
        └────── ProductStorePrice (giá sản phẩm per-store)
```

---

## 3. Plan A — Dữ Liệu Tham Chiếu

> Không phụ thuộc Plan nào khác. Có thể triển khai và release trước tiên.

---

### 3.1 Category — Danh Mục Sản Phẩm

#### Mô Tả

Category phân nhóm sản phẩm theo danh mục hiển thị trên menu. Hỗ trợ cấu trúc **cây cha–con** (self-referencing).

```
☕ Đồ uống nóng
   ├── Cà phê
   └── Trà

🧋 Đồ uống lạnh
   ├── Trà sữa
   └── Smoothie
```

**Thuộc tính chính:** Tên, Slug, Danh mục cha, Thứ tự hiển thị, Trạng thái

---

#### Màn Hình 1: Category List

**URL:** `/admin/product/categories`

```
┌──────────────────────────────────────────────────────────────┐
│ [🔍 Tìm kiếm theo tên...]                 [+ Thêm danh mục] │
├────┬──────────────┬────────────────┬─────────────┬─────┬─────┤
│ ID │     Tên      │      Slug      │ Danh mục cha│Thứtự│Trạng│ Thao tác │
├────┼──────────────┼────────────────┼─────────────┼─────┼─────┤
│  1 │ Đồ uống nóng │ do-uong-nong   │      —      │  0  │ 🟢  │ 👁️ ✏️ 🗑️ │
│  2 │ Cà phê       │ ca-phe         │ Đồ uống nóng│  0  │ 🟢  │ 👁️ ✏️ 🗑️ │
└────┴──────────────┴────────────────┴─────────────┴─────┴─────┘
```

| Thao tác | Hành động |
|----------|-----------|
| 👁️ Xem | Chuyển sang Category Detail Page |
| ✏️ Sửa | Mở Form Dialog sửa |
| 🗑️ Xoá | Mở AppConfirmDialog |

---

#### Màn Hình 2: Category Detail Page

**URL:** `/admin/product/categories/:id`

**Mục đích:** Xem toàn bộ thông tin của một category và danh sách sản phẩm / danh mục con trực thuộc.

```
← Danh mục    Đồ uống nóng                        [✏️ Sửa]  [🗑️ Xoá]

┌─────────────────────────────────────────────────────────────────┐
│ THÔNG TIN CHUNG                                                 │
│                                                                 │
│  Tên:          Đồ uống nóng                                     │
│  Slug:         do-uong-nong                                     │
│  Danh mục cha: —  (root)                                        │
│  Thứ tự:       0                                                │
│  Trạng thái:   🟢 Hoạt động                                     │
│  Ngày tạo:     01/06/2026                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DANH MỤC CON  (2)                                               │
│                                                                 │
│  ID │ Tên     │ Slug    │ Thứ tự │ Trạng thái │ Thao tác       │
│   2 │ Cà phê  │ ca-phe  │   0    │ 🟢          │ 👁️ ✏️ 🗑️      │
│   3 │ Trà     │ tra     │   1    │ 🟢          │ 👁️ ✏️ 🗑️      │
│                                                                 │
│                                     [+ Thêm danh mục con]      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ SẢN PHẨM THUỘC DANH MỤC NÀY  (12)           [Xem tất cả →]    │
│                                                                 │
│  [🖼️] Cà phê sữa đá     │ 35.000₫  │ 🟢 Đang bán              │
│  [🖼️] Bạc xỉu           │ 30.000₫  │ 🟢 Đang bán              │
│  [🖼️] Cà phê đen        │ 25.000₫  │ ⚫ Ngừng bán             │
│  ... (hiển thị tối đa 5 sản phẩm, nút "Xem tất cả")           │
└─────────────────────────────────────────────────────────────────┘
```

**Ghi chú thiết kế:**
- Widget "DANH MỤC CON" chỉ hiện nếu category hiện tại có con
- Widget "SẢN PHẨM" hiển thị tối đa 5 sản phẩm, link "Xem tất cả" chuyển sang Product List lọc sẵn theo category này
- Nút `[+ Thêm danh mục con]` mở Form Dialog với trường "Danh mục cha" điền sẵn

---

#### Màn Hình 3: Form Tạo / Sửa Category

**Loại:** Dialog

| Trường | Loại | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| Tên danh mục | Text | ✅ | Trigger tự sinh Slug khi thay đổi |
| Slug | Text | ✅ | Tự sinh từ tên; chỉ chứa `a-z`, `0-9`, `-` |
| Danh mục cha | Dropdown | ❌ | Chỉ hiện category Hoạt động; bỏ trống = root |
| Thứ tự hiển thị | Number | ✅ | ≥ 0, mặc định 0 |
| Trạng thái | Toggle | ✅ | Mặc định Hoạt động |

**Validation:**
- Tên không được để trống
- Slug không trùng trong cùng tenant
- Không được chọn chính nó làm danh mục cha (khi sửa)

---

#### Luồng: Xoá Category

```
🗑️ → AppConfirmDialog:
  "Bạn có chắc muốn xoá danh mục [Tên]? Hành động này không thể hoàn tác."
  → [Xác nhận] → API DELETE → Chuyển về Category List
  → [Huỷ]      → Đóng dialog
```

> BE kiểm tra: nếu category đang có sản phẩm hoặc danh mục con → từ chối xoá và trả lỗi rõ ràng.

---

### 3.2 Tag — Nhãn Phân Loại

#### Mô Tả

Tag là nhãn linh hoạt gắn vào sản phẩm. Mỗi tag có màu sắc riêng, hiển thị dạng **pill/badge** màu trên UI.

Ví dụ: `🔴 Best Seller` · `🟢 New` · `🟡 Seasonal`

**Thuộc tính chính:** Tên, Màu nền (ColorHex), Màu chữ (TextColor), URL Icon, Thứ tự, Trạng thái

---

#### Màn Hình 1: Tag List

**URL:** `/admin/product/tags`

```
┌──────────────────────────────────────────────────────────────┐
│ [🔍 Tìm kiếm theo tên...]                    [+ Thêm nhãn]  │
├────┬─────────────┬──────────┬──────────┬───────────┬─────────┤
│ ID │     Tên     │ Màu nền  │ Màu chữ  │  Preview  │Trạng thái│ Thao tác │
├────┼─────────────┼──────────┼──────────┼───────────┼─────────┤
│  1 │ Best Seller │ #FF6B35  │ #FFFFFF  │[Best Seller]│ 🟢   │ 👁️ ✏️ 🗑️ │
│  2 │ New         │ #4CAF50  │ #FFFFFF  │  [New]    │ 🟢      │ 👁️ ✏️ 🗑️ │
└────┴─────────────┴──────────┴──────────┴───────────┴─────────┘
```

---

#### Màn Hình 2: Tag Detail Page

**URL:** `/admin/product/tags/:id`

**Mục đích:** Xem toàn bộ thông tin tag và danh sách sản phẩm đang được gán nhãn này.

```
← Nhãn    Best Seller                             [✏️ Sửa]  [🗑️ Xoá]

┌─────────────────────────────────────────────────────────────────┐
│ THÔNG TIN NHÃN                                                  │
│                                                                 │
│  Tên:        Best Seller                                        │
│  Màu nền:    #FF6B35   [████]                                   │
│  Màu chữ:    #FFFFFF   [████]                                   │
│  Preview:    [Best Seller]  ← pill thực tế                      │
│  URL Icon:   —                                                  │
│  Thứ tự:     0                                                  │
│  Trạng thái: 🟢 Hoạt động                                       │
│  Ngày tạo:   01/06/2026                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ SẢN PHẨM ĐANG DÙNG NHÃN NÀY  (8)            [Xem tất cả →]    │
│                                                                 │
│  [🖼️] Trà sữa Taro       │ 🧋 Đồ uống lạnh │ 55.000₫  │ 🟢   │
│  [🖼️] Matcha Latte       │ ☕ Đồ uống nóng │ 60.000₫  │ 🟢   │
│  [🖼️] Brown Sugar Milk   │ 🧋 Đồ uống lạnh │ 65.000₫  │ 🟢   │
│  ... (tối đa 5, link "Xem tất cả")                             │
└─────────────────────────────────────────────────────────────────┘
```

**Ghi chú thiết kế:**
- Widget "Sản phẩm đang dùng nhãn" giúp admin thấy ngay impact trước khi sửa/xoá tag
- Link "Xem tất cả" chuyển sang Product List lọc sẵn theo tag này

---

#### Màn Hình 3: Form Tạo / Sửa Tag

**Loại:** Dialog

| Trường | Loại | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| Tên nhãn | Text | ✅ | |
| Màu nền (ColorHex) | Text + Preview | ❌ | Định dạng `#RRGGBB`; ô màu preview inline |
| Màu chữ (TextColor) | Text + Preview | ❌ | Định dạng `#RRGGBB`; ô màu preview inline |
| URL Icon | Text | ❌ | URL hình icon |
| Thứ tự hiển thị | Number | ✅ | ≥ 0, mặc định 0 |
| Trạng thái | Toggle | ✅ | Mặc định Hoạt động |

**Preview live trong form:**
```
Màu nền:  [  #FF6B35  ] [████]
Màu chữ:  [  #FFFFFF  ] [████]
Kết quả:  [Best Seller]  ← cập nhật real-time khi thay đổi màu
```

**Validation:**
- Tên không được để trống
- ColorHex và TextColor nếu nhập phải đúng định dạng `#RRGGBB`

---

## 4. Plan B — Nhóm & Lựa Chọn

> Quản lý danh mục tuỳ chọn (Topping, Đường, Đá...). Không phụ thuộc Plan nào khác.

---

### 4.1 OptionGroup — Nhóm Tuỳ Chọn

#### Mô Tả

OptionGroup là nhóm chứa các lựa chọn cùng loại. `UiType` quyết định hành vi chọn:
- `SingleSelect` — khách chọn đúng 1 option (vd: Mức đường)
- `MultiSelect` — khách chọn nhiều option (vd: Topping)

---

#### Màn Hình 1: OptionGroup List

**URL:** `/admin/product/option-groups`

```
┌──────────────────────────────────────────────────────────────┐
│ [🔍 Tìm kiếm...]                          [+ Thêm nhóm]     │
├────┬──────────────┬───────────────┬──────────┬────┬──────────┤
│ ID │   Tên nhóm   │    Loại UI    │ Số option│Trạng│ Thao tác │
├────┼──────────────┼───────────────┼──────────┼────┼──────────┤
│  1 │ Mức đường    │ SingleSelect  │    5     │ 🟢  │ 👁️ ✏️ 🗑️ │
│  2 │ Topping      │ MultiSelect   │    8     │ 🟢  │ 👁️ ✏️ 🗑️ │
│  3 │ Size         │ SingleSelect  │    3     │ 🟢  │ 👁️ ✏️ 🗑️ │
└────┴──────────────┴───────────────┴──────────┴────┴──────────┘
```

---

#### Màn Hình 2: OptionGroup Detail Page

**URL:** `/admin/product/option-groups/:id`

**Mục đích:** Xem thông tin nhóm, quản lý danh sách Option bên trong, và xem sản phẩm đang dùng nhóm này.

```
← Nhóm tuỳ chọn    Mức đường                    [✏️ Sửa]  [🗑️ Xoá]

┌────────────────────────────────┬────────────────────────────────┐
│ THÔNG TIN NHÓM                 │ DANH SÁCH OPTION               │
│                                │                                │
│ Tên:     Mức đường             │  Tổng: 5 · Đang hoạt động: 5  │
│ Loại UI: SingleSelect          │                                │
│ Mô tả:   —                     │ ID │ Tên        │ Giá  │Trạng │
│ Thứ tự:  0                     │  1 │ 0% đường   │  0₫  │ 🟢   │
│ Trạng:   🟢 Hoạt động          │  2 │ 30% đường  │  0₫  │ 🟢   │
│ Ngày tạo: 01/06/2026           │  3 │ 50% đường  │  0₫  │ 🟢   │
│                                │  4 │ 70% đường  │  0₫  │ 🟢   │
│                                │  5 │ 100% đường │  0₫  │ 🟢   │
│                                │                                │
│                                │ Thao tác mỗi dòng: ✏️ 🗑️       │
│                                │              [+ Thêm option]  │
└────────────────────────────────┴────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ SẢN PHẨM ĐANG DÙNG NHÓM NÀY  (15)           [Xem tất cả →]    │
│                                                                 │
│  [🖼️] Trà sữa Taro    │ Bắt buộc: ✅ │ Min: 1 │ Max: 1        │
│  [🖼️] Matcha Latte    │ Bắt buộc: ✅ │ Min: 1 │ Max: 1        │
│  ...                                                           │
└─────────────────────────────────────────────────────────────────┘
```

**Ghi chú thiết kế:**
- Widget "Sản phẩm đang dùng nhóm" hiển thị cả ràng buộc (IsRequired, MinSelect, MaxSelect) riêng của từng sản phẩm
- Thao tác ✏️ trên dòng Option mở Option Detail Page hoặc inline form

---

#### Màn Hình 3: Form Tạo / Sửa OptionGroup

**Loại:** Dialog

| Trường | Loại | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| Tên nhóm | Text | ✅ | Vd: Mức đường, Topping, Size |
| Loại UI | Radio / Dropdown | ✅ | SingleSelect / MultiSelect |
| Mô tả | Textarea | ❌ | |
| Thứ tự hiển thị | Number | ✅ | ≥ 0, mặc định 0 |
| Trạng thái | Toggle | ✅ | Mặc định Hoạt động |

---

### 4.2 Option — Lựa Chọn Cụ Thể

#### Mô Tả

Option là lựa chọn cụ thể trong một nhóm (vd: "Trân châu đen" trong nhóm Topping). Có giá phụ thu mặc định có thể bằng 0. Giá có thể được override tại cấp sản phẩm (Plan D) hoặc cấp cửa hàng (Plan E).

---

#### Màn Hình 1: Option List

**URL:** `/admin/product/options`

> Option List là màn hình tổng hợp toàn bộ option của tenant — có thể lọc theo nhóm.

```
┌──────────────────────────────────────────────────────────────┐
│ [🔍 Tìm kiếm...]  [Nhóm: Tất cả ▼]           [+ Thêm option]│
├────┬──────────────────┬──────────────┬──────────┬─────┬──────┤
│ ID │    Tên option    │    Nhóm      │   Giá    │Thứtự│Trạng │ Thao tác │
├────┼──────────────────┼──────────────┼──────────┼─────┼──────┤
│  1 │ 0% đường         │ Mức đường    │  0₫      │  0  │ 🟢   │ 👁️ ✏️ 🗑️ │
│  2 │ 50% đường        │ Mức đường    │  0₫      │  2  │ 🟢   │ 👁️ ✏️ 🗑️ │
│  3 │ Trân châu đen    │ Topping      │ 10.000₫  │  0  │ 🟢   │ 👁️ ✏️ 🗑️ │
│  4 │ Pudding          │ Topping      │ 10.000₫  │  1  │ 🟢   │ 👁️ ✏️ 🗑️ │
└────┴──────────────────┴──────────────┴──────────┴─────┴──────┘
```

> Option cũng được quản lý **trong OptionGroup Detail Page** — hai điểm vào khác nhau nhưng cùng dữ liệu.

---

#### Màn Hình 2: Option Detail Page

**URL:** `/admin/product/options/:id`

**Mục đích:** Xem toàn bộ thông tin option, cấu hình override theo sản phẩm và theo cửa hàng.

```
← Lựa chọn    Trân châu đen                      [✏️ Sửa]  [🗑️ Xoá]

┌─────────────────────────────────────────────────────────────────┐
│ THÔNG TIN OPTION                                                │
│                                                                 │
│  Tên:          Trân châu đen                                    │
│  Thuộc nhóm:   Topping  →  [Xem nhóm]                          │
│  Giá mặc định: 10.000₫                                         │
│  Thứ tự:       0                                               │
│  Trạng thái:   🟢 Hoạt động                                     │
│  Ngày tạo:     01/06/2026                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CẤU HÌNH OVERRIDE THEO SẢN PHẨM  (ProductOptionConfig)  (5)   │
│                                                                 │
│  Sản phẩm           │ Giá custom  │ Mặc định │  Ẩn            │
│  Trà sữa Taro       │     —       │    ❌     │  ❌            │
│  Matcha Latte       │ 12.000₫     │    ❌     │  ❌            │
│  Brown Sugar Milk   │     —       │    ✅     │  ❌            │
│  Hồng trà nướng     │     —       │    ❌     │  ✅  (ẩn)      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ OVERRIDE GIÁ THEO CỬA HÀNG  (OptionStorePrice)                 │
│                                                                 │
│  Cửa hàng         │ Giá override │ Thao tác                    │
│  Chi nhánh Q1     │ 12.000₫      │ 🗑️                          │
│  Chi nhánh Bình Thạnh │ 11.000₫  │ 🗑️                          │
│                                                                 │
│  [+ Thêm override giá cửa hàng]                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TÌNH TRẠNG THEO CỬA HÀNG  (OptionStoreAvailability)            │
│                                                                 │
│  Cửa hàng         │ Trạng thái   │ Thao tác                    │
│  Chi nhánh Q7     │ ⛔ Hết hàng  │ 🗑️                          │
│                                                                 │
│  [+ Thêm override tình trạng]                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Ghi chú thiết kế:**
- Widget "Override theo sản phẩm" chỉ hiển thị, không cho sửa tại đây (sửa tại ProductDetailPage > Tab Cấu hình tuỳ chọn)
- Widget "Override theo cửa hàng" cho phép Upsert và Xoá trực tiếp

---

#### Màn Hình 3: Form Tạo / Sửa Option

**Loại:** Dialog

| Trường | Loại | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| Thuộc nhóm | Dropdown | ✅ | Chọn OptionGroup; khi tạo từ Detail Page thì điền sẵn |
| Tên option | Text | ✅ | Vd: Trân châu đen, Pudding |
| Giá mặc định | AppCurrencyField | ❌ | Phụ phí; ≥ 0; mặc định 0 |
| Thứ tự hiển thị | Number | ✅ | Sort ASC trong nhóm |
| Trạng thái | Toggle | ✅ | Mặc định Hoạt động |

---

## 5. Plan C — Sản Phẩm Cốt Lõi

> Trung tâm của module. Phụ thuộc Plan A (cần Category).

---

#### Màn Hình 1: Product List

**URL:** `/admin/product/products`

**Toolbar:** Tìm kiếm tên · Lọc Danh mục · Lọc Trạng thái · `[+ Thêm sản phẩm]`

```
┌──────────────────────────────────────────────────────────────────────┐
│ [🔍 Tên...]  [Danh mục: Tất cả ▼]  [Trạng thái: Tất cả ▼]  [+ Thêm]│
├───────┬──────────────────┬──────────────┬──────────┬──────────┬──────┤
│ Thumb │    Tên SP        │  Danh mục    │ Giá gốc  │ Giá vốn  │Trạng │ Thao tác │
├───────┼──────────────────┼──────────────┼──────────┼──────────┼──────┤
│ [🖼️]  │ Trà sữa Taro    │ Đồ uống lạnh │ 55.000₫  │ 20.000₫  │ 🟢   │ 👁️ ✏️ 🗑️ │
│ [🖼️]  │ Matcha Latte    │ Đồ uống nóng │ 60.000₫  │ 22.000₫  │ 🟢   │ 👁️ ✏️ 🗑️ │
│ [📷]  │ Chè Thái        │ Đồ ăn        │ 45.000₫  │    —     │ ⚫   │ 👁️ ✏️ 🗑️ │
└───────┴──────────────────┴──────────────┴──────────┴──────────┴──────┘
```

- `[🖼️]` = có ảnh, hiển thị thumbnail 40×40px
- `[📷]` = chưa có ảnh, hiển thị icon placeholder

---

#### Màn Hình 2: Product Detail Page

**URL:** `/admin/product/products/:id`

**Mục đích:** Trang trung tâm quản lý toàn bộ thông tin, quan hệ và cấu hình của một sản phẩm. Là điểm tập kết của Plan C, D, E.

```
← Sản phẩm    Trà Sữa Taro Lớn                   [✏️ Sửa]  [🗑️ Xoá]

┌─────────────────────────────────────────────────────────────────┐
│ THÔNG TIN CHUNG                           HÌNH ẢNH              │
│                                                                 │
│ Tên:          Trà Sữa Taro Lớn           [🖼️][🖼️][🖼️][+]        │
│ SKU:          TST-L-001                  (ảnh 1 = thumbnail)    │
│ Slug:         tra-sua-taro-lon                                  │
│ Danh mục:     🧋 Đồ uống lạnh                                   │
│ Mô tả ngắn:  Trà sữa taro thơm ngon...                         │
│ Giá gốc:      55.000₫                                           │
│ Giá vốn:      20.000₫                                           │
│ Thứ tự:       0                                                 │
│ Nổi bật:      ✅                                                 │
│ Trạng thái:   🟢 Đang bán                                       │
│ Ngày tạo:     01/06/2026                                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ [Nhãn (Tags)] [Option groups] [Cấu hình tuỳ chọn] [Cửa hàng]   │
├──────────────────────────────────────────────────────────────────┤
│  (Nội dung tab — xem Plan D và E bên dưới)                      │
└──────────────────────────────────────────────────────────────────┘
```

4 tab trong ProductDetailPage:

| Tab | Nội dung | Plan |
|-----|----------|------|
| Nhãn (Tags) | Danh sách tag đã gán; form gán tag mới | D |
| Option groups | Danh sách nhóm đã gán với ràng buộc; form gán nhóm | D |
| Cấu hình tuỳ chọn | Override giá / ẩn / mặc định từng option | D |
| Giá theo cửa hàng | 4 panel override tình trạng và giá per-store | E |

---

#### Màn Hình 3: Form Tạo / Sửa Product

**Loại:** Page riêng (do upload ảnh và nhiều section)

**URL tạo mới:** `/admin/product/products/new`
**URL sửa:** `/admin/product/products/:id/edit`

Form chia thành 4 section:

**Section 1 — Thông Tin Cơ Bản**

| Trường | Loại | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| Tên sản phẩm | Text | ✅ | Trigger tự sinh Slug |
| Slug | Text | ✅ | Unique per tenant |
| Danh mục | Dropdown | ✅ | Chỉ hiện category Hoạt động |
| Mô tả ngắn | Textarea | ❌ | |
| Mô tả đầy đủ | Rich text | ❌ | |

**Section 2 — Giá**

| Trường | Loại | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| Giá gốc | AppCurrencyField | ✅ | ≥ 0 |
| Giá vốn | AppCurrencyField | ❌ | Nội bộ; không hiện với khách |

**Section 3 — Hình Ảnh**

```
┌─────┬─────┬─────┬─────┐
│img 1│img 2│img 3│  +  │  ← 80×80px mỗi ô
│(main)│    │     │Upload│
└─────┴─────┴─────┴─────┘
```

- Ảnh đầu tiên (DisplayOrder = 0) là thumbnail chính
- Bấm ảnh đã có → xem phóng to / xoá (Confirm Dialog)
- Drag-and-drop để đổi thứ tự

**Section 4 — Cài Đặt**

| Trường | Loại | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| Thứ tự hiển thị | Number | ✅ | Sort ASC trên menu |
| Trạng thái | Dropdown | ✅ | Đang bán / Ngừng bán / Nháp |
| Nổi bật | Checkbox | ❌ | IsFeatured |

---

## 6. Plan D — Quan Hệ Sản Phẩm

> Toàn bộ nằm trong **ProductDetailPage** dưới dạng 3 tab đầu.

---

### 6.1 Tab: Nhãn (Tags)

**Mục đích:** Gán / gỡ Tag vào sản phẩm.

```
┌─────────────────────────────────────────────────────────────────┐
│ NHÃN ĐÃ GÁN                                                    │
│                                                                 │
│  [🔴 Best Seller ×]   [🟢 New ×]   [🟡 Seasonal ×]             │
│                                                                 │
│ GÁN NHÃN MỚI                                                   │
│                                                                 │
│  [Chọn nhãn...  ▼]   [Gán]                                     │
│  ↑ Dropdown chỉ liệt kê tag chưa gán                           │
└─────────────────────────────────────────────────────────────────┘
```

**Luồng gỡ tag:** Bấm `×` → AppConfirmDialog → API DELETE → Reload

**Validation:** Dropdown lọc sẵn tag đã gán; BE cũng trả lỗi `TAG_ALREADY_ASSIGNED` nếu gán trùng.

---

### 6.2 Tab: Option Groups

**Mục đích:** Gán OptionGroup vào sản phẩm với ràng buộc chọn riêng.

**Danh sách đã gán:**

| Tên nhóm | Bắt buộc | Min | Max | Thứ tự | Thao tác |
|----------|----------|-----|-----|--------|----------|
| Mức đường | ✅ | 1 | 1 | 0 | ✏️ 🗑️ |
| Topping | ❌ | 0 | 3 | 1 | ✏️ 🗑️ |
| Size | ✅ | 1 | 1 | 2 | ✏️ 🗑️ |

**Form gán nhóm mới:**

| Trường | Loại | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| Nhóm tuỳ chọn | Dropdown | ✅ | Chỉ hiện nhóm chưa gán |
| Bắt buộc chọn | Toggle | ✅ | IsRequired |
| Số chọn tối thiểu | Number | ✅ | MinSelect ≥ 0 |
| Số chọn tối đa | Number | ✅ | MaxSelect ≥ MinSelect |
| Thứ tự hiển thị | Number | ✅ | |

**Validation:** `MaxSelect ≥ MinSelect` — check FE trước submit.

---

### 6.3 Tab: Cấu Hình Tuỳ Chọn (Option Configs)

**Mục đích:** Override giá / đặt mặc định / ẩn từng Option cho sản phẩm này (Upsert).

**Danh sách config:**

| Tên option | Nhóm | Giá custom | Mặc định | Ẩn | Thao tác |
|------------|------|------------|----------|----|----------|
| Nhỏ (S) | Size | — | ✅ | ❌ | ✏️ 🗑️ |
| Trân châu đen | Topping | 12.000₫ | ❌ | ❌ | ✏️ 🗑️ |
| Pudding | Topping | — | ❌ | ✅ | ✏️ 🗑️ |

**Form Upsert:**

| Trường | Loại | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| Option | Dropdown | ✅ | OptionId > 0 |
| Giá custom | AppCurrencyField | ❌ | Nullable; `null` = dùng giá mặc định |
| Mặc định (IsDefault) | Checkbox | ❌ | Auto-chọn khi mở menu |
| Ẩn (IsHidden) | Checkbox | ❌ | Ẩn option khỏi sản phẩm này |

---

## 7. Plan E — Cấu Hình Theo Cửa Hàng

> Nằm trong **Tab 4 "Giá theo cửa hàng"** của ProductDetailPage.

**Mục đích:** Từng cửa hàng có cấu hình riêng về tình trạng và giá bán. Nếu không có override → kế thừa mặc định từ Product domain.

---

### Giao Diện Tab "Giá theo cửa hàng"

Layout 2 cột, 4 panel:

```
┌──────────────────────────────┬───────────────────────────────┐
│  TÌNH TRẠNG SẢN PHẨM         │  TÌNH TRẠNG OPTION             │
│  per store                   │  per store                    │
├──────────────────────────────┼───────────────────────────────┤
│  GIÁ SẢN PHẨM                │  GIÁ OPTION                   │
│  per store                   │  per store                    │
└──────────────────────────────┴───────────────────────────────┘
```

---

#### Panel 1 — Tình Trạng Sản Phẩm Theo Cửa Hàng

**Dữ liệu:** `ProductStore` (ProductId × StoreId × IsAvailable)

| Cửa hàng | Trạng thái | Thao tác |
|----------|-----------|---------|
| Chi nhánh Q1 | ✅ Có bán | 🗑️ |
| Chi nhánh Q7 | ⛔ Tạm ngừng | 🗑️ |

**Form upsert:** `[Cửa hàng ▼]  [Trạng thái ▼]  [Lưu]`

**Fallback:** Không có bản ghi → kế thừa `Product.IsActive`

---

#### Panel 2 — Giá Sản Phẩm Theo Cửa Hàng

**Dữ liệu:** `ProductStorePrice` (ProductId × StoreId × Price)

| Cửa hàng | Giá override | Thao tác |
|----------|-------------|---------|
| Chi nhánh Q1 | 58.000₫ | 🗑️ |

**Form upsert:** `[Cửa hàng ▼]  [AppCurrencyField]  [Lưu]`

**Fallback:** Không có → dùng `Product.BasePrice`

---

#### Panel 3 — Tình Trạng Option Theo Cửa Hàng

**Dữ liệu:** `OptionStoreAvailability` (OptionId × StoreId × IsAvailable)

| Option | Cửa hàng | Trạng thái | Thao tác |
|--------|----------|-----------|---------|
| Trân châu đen | Chi nhánh Q1 | ⛔ Hết hàng | 🗑️ |

**Form upsert:** `[Option ▼]  [Cửa hàng ▼]  [Trạng thái ▼]  [Lưu]`

---

#### Panel 4 — Giá Option Theo Cửa Hàng

**Dữ liệu:** `OptionStorePrice` (OptionId × StoreId × Price)

| Option | Cửa hàng | Giá | Thao tác |
|--------|----------|-----|---------|
| Topping pudding | Chi nhánh Q1 | 12.000₫ | 🗑️ |

**Form upsert:** `[Option ▼]  [Cửa hàng ▼]  [AppCurrencyField]  [Lưu]`

---

### Chuỗi Fallback Giá (Price Chain)

```
Giá option tại cửa hàng X:
  1. OptionStorePrice.Price           ← Ưu tiên cao nhất
  2. ProductOptionConfig.CustomPrice  ← Override per-product
  3. Option.DefaultPrice              ← Giá mặc định catalog

Giá sản phẩm tại cửa hàng X:
  1. ProductStorePrice.Price          ← Override per-store
  2. Product.BasePrice                ← Giá gốc
```

| Trường hợp | Giá sản phẩm | Giá option |
|------------|-------------|-----------|
| Có store override | `ProductStorePrice.Price` | `OptionStorePrice.Price` |
| Có product config, không có store override | `Product.BasePrice` | `ProductOptionConfig.CustomPrice` |
| Không có override nào | `Product.BasePrice` | `Option.DefaultPrice` |

> Chuỗi fallback chỉ áp dụng tại tầng **đọc** (GetStoreMenuQuery). Tầng **ghi** (Upsert) luôn lưu đúng bảng tương ứng.

---

## 8. Shared Components

Xây dựng trước khi implement các Plan.

---

### 8.1 AppCurrencyField

**Mục đích:** Thay thế `<input type="text">` cho mọi trường nhập giá.

- Format `vi-VN`: dấu chấm ngăn cách nghìn, suffix `₫`
- `v-model` nhận/trả về `number`, không phải `string`
- Validate ≥ 0; nullable nếu trường cho phép null

**Áp dụng tại:** ProductForm (basePrice, costPrice) · OptionForm (defaultPrice) · Tab Cấu hình tuỳ chọn (customPrice) · Panel Giá sản phẩm per-store · Panel Giá option per-store

---

### 8.2 AppConfirmDialog

**Mục đích:** Dialog xác nhận trước mọi thao tác xoá hoặc gỡ liên kết.

| Prop | Type | Default |
|------|------|---------|
| `title` | string | — |
| `message` | string | — |
| `confirmLabel` | string | "Xác nhận xoá" |
| `confirmVariant` | string | "danger" |

**Events:** `@confirm`, `@cancel`

---

### 8.3 Utilities

| File | Hàm | Dùng tại |
|------|-----|---------|
| `src/utils/slug.utils.ts` | `toSlug(text)` | CategoryForm, ProductForm |
| `src/utils/slug.utils.ts` | `slugRule(v)` | CategoryForm, ProductForm |
| `src/utils/currency.utils.ts` | `formatCurrency(amount)` | Mọi nơi hiển thị số tiền |

> Dùng `/[\u0300-\u036f]/g` để normalize Unicode trong `toSlug`.

---

### 8.4 StoreOverridesTab (Component Gộp)

Gộp `ProductStoreOverridesTab` và `OptionStoreOverridesTab` thành một component dùng chung.

| Prop | Type | Mô tả |
|------|------|-------|
| `entityType` | `"product" \| "option"` | Xác định loại entity |
| `entityId` | number | ID của product hoặc option |

---

## 9. Luồng Nghiệp Vụ Quan Trọng

### 9.1 Luồng Tạo Sản Phẩm Mới (End-to-End)

```
1. [Plan A] Tạo / chọn Category
2. [Plan A] Tạo / chọn Tag (nếu cần)
3. [Plan B] Tạo / chọn OptionGroup + Options
4. [Plan C] Tạo Product → Upload ảnh
5. [Plan D] ProductDetailPage:
           Tab "Nhãn"            → Gán Tag
           Tab "Option groups"   → Gán nhóm + đặt ràng buộc
           Tab "Cấu hình tuỳ chọn" → Override giá/ẩn/mặc định
6. [Plan E] Tab "Giá theo cửa hàng":
           → Set tình trạng / giá riêng từng cửa hàng (nếu cần)
```

---

### 9.2 Luồng Build Menu Cho Cửa Hàng

```
Input: TenantId + StoreId

1. Load Products (IsActive = true)
2. Load OptionGroup + Options theo Product
3. Load overrides theo StoreId:
   ProductStore, ProductStorePrice,
   OptionStoreAvailability, OptionStorePrice
4. Merge + Fallback:
   Availability product: Product.IsActive AND ProductStore.IsAvailable
   Giá product:          ProductStorePrice.Price ?? Product.BasePrice
   Availability option:  Option.IsActive AND OptionStoreAvailability.IsAvailable
   Giá option:           OptionStorePrice.Price ?? ProductOptionConfig.CustomPrice ?? Option.DefaultPrice

Output: Menu JSON → UI
```

---

### 9.3 Luồng Tạo Order (Snapshot)

```
Validate:
  ✅ Product tồn tại, IsActive = true
  ✅ Product available tại store
  ✅ Option thuộc đúng nhóm được gán
  ✅ MinSelect ≤ số option chọn ≤ MaxSelect

Snapshot lưu vào Order:
  OrderItem.ProductName  = Product.Name    tại thời điểm bán
  OrderItem.ProductSku   = Product.Sku     tại thời điểm bán
  OrderItem.CategoryName = Category.Name   tại thời điểm bán
  OrderItem.BasePrice    = giá đã tính store override

  OrderItemOption.GroupName  = OptionGroup.Name  tại thời điểm bán
  OrderItemOption.OptionName = Option.Name       tại thời điểm bán
  OrderItemOption.Price      = giá option đã tính fallback chain
```

> Thay đổi menu/giá sau khi Order tạo **không ảnh hưởng** Order cũ.

---

## 10. Tổng Hợp Màn Hình

| # | Màn hình | URL | Loại | Plan |
|---|----------|-----|------|------|
| 1 | Category List | `/admin/product/categories` | Page | A |
| 2 | **Category Detail** | `/admin/product/categories/:id` | **Page** | A |
| 3 | Category Form | *(dialog)* | Dialog | A |
| 4 | Tag List | `/admin/product/tags` | Page | A |
| 5 | **Tag Detail** | `/admin/product/tags/:id` | **Page** | A |
| 6 | Tag Form | *(dialog)* | Dialog | A |
| 7 | OptionGroup List | `/admin/product/option-groups` | Page | B |
| 8 | **OptionGroup Detail** | `/admin/product/option-groups/:id` | **Page** | B |
| 9 | OptionGroup Form | *(dialog)* | Dialog | B |
| 10 | Option List | `/admin/product/options` | Page | B |
| 11 | **Option Detail** | `/admin/product/options/:id` | **Page** | B |
| 12 | Option Form | *(dialog)* | Dialog | B |
| 13 | Product List | `/admin/product/products` | Page | C |
| 14 | **Product Detail** | `/admin/product/products/:id` | **Page** | C/D/E |
| 15 | Product Form | `/admin/product/products/new` · `/:id/edit` | Page | C |
| 16 | Tab: Nhãn | *(trong Product Detail)* | Tab | D |
| 17 | Tab: Option groups | *(trong Product Detail)* | Tab | D |
| 18 | Tab: Cấu hình tuỳ chọn | *(trong Product Detail)* | Tab | D |
| 19 | Tab: Giá theo cửa hàng | *(trong Product Detail)* | Tab | E |

**Tổng: 19 màn hình** — mỗi entity đều có đủ List · Detail · Form.

---

*Tài liệu mô tả chức năng từ góc nhìn BA & Design. Chi tiết kỹ thuật API xem tài liệu Design Specification đi kèm.*