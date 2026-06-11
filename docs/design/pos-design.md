# Thiết Kế Trang Bán Hàng — OrderStaff POS

> **Scope:** OrderStaff — có thể tạo order, **không** thanh toán, **không** huỷ đơn, **không** mở/chốt ca.

---

## Layout Tổng Thể

```
┌─────────────────────────────────────────────────┬───────────────────────┐
│  [Logo/Store]  [Tên cửa hàng]      [Tên NV ▾]  │                       │
├─────────────────────────────────────────────────┤                       │
│  [Search...]                                    │    ORDER PANEL        │
│                                                 │                       │
│  [Cat A] [Cat B] [Cat C] [Cat D] ...            │                       │
│                                                 │                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │                       │
│  │ Sp1  │ │ Sp2  │ │ Sp3  │ │ Sp4  │           │                       │
│  └──────┘ └──────┘ └──────┘ └──────┘           │                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │                       │
│  │ Sp5  │ │ Sp6  │ │ Sp7  │ │ ...  │           │                       │
│  └──────┘ └──────┘ └──────┘ └──────┘           │                       │
│                                                 │                       │
└─────────────────────────────────────────────────┴───────────────────────┘
```

Tỉ lệ: Menu Panel **~65%** — Order Panel **~35%**. Fixed height = viewport, không scroll page, scroll nội bộ từng vùng.

---

## 1. Header Bar

### Thông tin hiển thị

- **Logo + Tên cửa hàng** — load từ `AppStore.Name`, `AppStore.LogoUrl`
- **Trạng thái cửa hàng** — badge nhỏ:
  - `IsAcceptingOrders = true` → "Đang nhận đơn" (xanh)
  - `IsAcceptingOrders = false` → "Tạm dừng nhận đơn" (đỏ) → block tạo order, hiển thị thông báo
- **Avatar + Tên nhân viên** — dropdown nhỏ:
  - Xem thông tin tài khoản
  - Đăng xuất

### Trạng thái ca

- OrderStaff **không mở/chốt ca** — nhưng hiển thị trạng thái ca hiện tại (read-only):
  - Ca đang mở: "Ca [giờ mở ca] — [tên người mở]"
  - Chưa có ca: "Chưa mở ca" → **block tạo order**, hiển thị thông báo "Vui lòng liên hệ Cashier/Manager để mở ca"

---

## 2. Menu Panel

### 2.1 Search Bar

- Placeholder: "Tìm theo tên hoặc SKU..."
- Filter realtime trên danh sách sản phẩm đang hiển thị
- Khi có keyword → ẩn Category Bar, hiện kết quả dạng flat grid
- Xoá keyword → quay lại view category + grid bình thường
- Không tìm thấy → hiển thị "Không tìm thấy sản phẩm phù hợp"

### 2.2 Category Bar

- Danh sách category ngang, scroll ngang nếu tràn
- Mỗi item: tên category, số lượng sản phẩm (optional badge)
- Chọn category cha → nếu có category con, hiện thêm một hàng sub-category bên dưới
- Chọn sub-category → filter grid theo category đó
- Active state rõ ràng (underline hoặc background highlight)
- **"Tất cả"** là tab đầu tiên, hiển thị toàn bộ sản phẩm active

**Logic load:**

- Chỉ load category có `IsActive = true`
- Chỉ hiển thị category có ít nhất 1 sản phẩm available tại store này

### 2.3 Product Grid

**Layout card:**

```
┌──────────────────┐
│   [Ảnh sản phẩm] │  ← IsMain image, fallback placeholder
│                  │
│  [Tag badge]     │  ← nếu có Tag
│──────────────────│
│  Tên sản phẩm    │
│  xx,000đ         │  ← giá đã resolve store override
└──────────────────┘
```

**Trạng thái card:**

| Trạng thái | Hiển thị |
|---|---|
| Available, active | Bình thường, tap được |
| `ProductStore.IsAvailable = false` | Mờ, label "Hết hàng", không tap được |
| `Product.IsActive = false` | Không hiển thị (filter server-side) |

**Sắp xếp:** theo `Product.DisplayOrder ASC`, sau đó `Product.Name ASC`

**Giá hiển thị:** `ProductStorePrice.Price ?? Product.BasePrice` — luôn là giá đã resolve, không bao giờ raw

**Tag badge:** Hiển thị tối đa 1–2 tag, màu nền `Tag.ColorHex`, màu chữ `Tag.TextColor`

---

## 3. Option Picker — Modal

Mở khi tap vào product card available. Hiển thị dạng **bottom sheet** (mobile) hoặc **centered modal** (desktop).

### 3.1 Header modal

- Ảnh sản phẩm (lớn hơn, landscape hoặc square)
- Tên sản phẩm
- Giá base đã resolve: `ProductStorePrice.Price ?? Product.BasePrice`
- `ShortDescription` nếu có — italic, nhỏ hơn

### 3.2 Option Groups

Với mỗi group trong `ProductOptionGroup` của sản phẩm này:

**Header group:**

```
Mức Đường                    Bắt buộc · Chọn 1
```

- Tên group (`OptionGroup.Name`)
- Badge ràng buộc:
  - `IsRequired = true` + `MinSelect = MaxSelect = 1` → "Bắt buộc · Chọn 1"
  - `IsRequired = true` + range → "Bắt buộc · Chọn [Min]–[Max]"
  - `IsRequired = false` → "Tuỳ chọn · Chọn tối đa [Max]"

**Render option items:**

- `UiType = SingleSelect` → radio button behavior (chỉ chọn 1)
- `UiType = MultiSelect` → checkbox behavior (chọn nhiều)

Mỗi option item:

```
  ● Bình thường (0đ)
  ○ 70% Đường               +0đ     ← DefaultPrice = 0
  ○ 50% Đường
  ○ Không Đường
```

```
  □ Trân Châu Đen            +8,000đ
  □ Thạch Cà Phê             +8,000đ
  ☑ Pudding                  +10,000đ   ← IsDefault = true → pre-checked
```

**Giá option:** resolve theo chain:
`OptionStorePrice.Price ?? ProductOptionConfig.CustomPrice ?? Option.DefaultPrice`

Hiển thị: `+8,000đ` nếu > 0, bỏ trống hoặc "Miễn phí" nếu = 0

**Option không available tại store:** (`OptionStoreAvailability.IsAvailable = false`) → hiển thị mờ, strikethrough tên, không chọn được, không đếm vào MinSelect

**Pre-select:** Option có `ProductOptionConfig.IsDefault = true` → tự động chọn khi mở modal

### 3.3 Ghi Chú Dòng

- Label: "Ghi chú cho món này"
- Textarea nhỏ, placeholder: "VD: ít đá, không đường..."
- Map vào `OrderItem.Note`
- Optional, không validate

### 3.4 Số Lượng

- Spinner: nút **−** / số lượng / nút **+**
- Min = 1, không có max cứng (hoặc max config sau)
- Nút − disable khi quantity = 1

### 3.5 Preview Giá & Nút Thêm

- Dòng preview: `(BasePrice + Σ option đã chọn) × quantity = xxx,000đ`
- Nút **"Thêm vào đơn"**:
  - Disabled nếu chưa chọn đủ option bắt buộc
  - Khi tap → validate, nếu pass → đóng modal, đẩy item vào Order Panel

### 3.6 Validate trước khi thêm

Với mỗi group `IsRequired = true`:

- Số option đang chọn < `MinSelect` → highlight group lỗi, hiển thị "Vui lòng chọn ít nhất [Min] lựa chọn"

Với mỗi group `MultiSelect`:

- Số option đang chọn > `MaxSelect` → disable chọn thêm (không cho chọn quá), hoặc highlight nếu cần

---

## 4. Order Panel

### 4.1 Header Đơn

- Tiêu đề: **"Đơn mới"**
- Nút **Xoá đơn** (icon trash) — clear toàn bộ items, reset về trạng thái trống. Confirm trước khi xoá nếu đã có item.

### 4.2 Thông Tin Khách (Tuỳ Chọn)

- Input **Tên khách** — map `Order.CustomerName`, placeholder "Tên khách (tuỳ chọn)"
- Input **Số điện thoại** — map `Order.CustomerPhone`, placeholder "SĐT (tuỳ chọn)"
- Không bắt buộc — walk-in có thể để trống

### 4.3 Ghi Chú Đơn

- Textarea nhỏ, placeholder "Ghi chú cho đơn..."
- Map `Order.Note`
- Hiển thị thu gọn, expand khi focus

### 4.4 Danh Sách Item

Mỗi item trong đơn:

```
Trà Sữa Truyền Thống              × 2
50% Đường · Ít Đá · +Trân Châu
Ghi chú: không đá                       [Sửa] [✕]
                              48,000đ
```

- **Tên sản phẩm** — bold
- **Option summary** — tóm tắt các option đã chọn, phân cách bằng " · "
- **Ghi chú** nếu có — italic, nhỏ
- **Nút Sửa** → mở lại Option Picker với state hiện tại pre-filled (chỉnh option, quantity, ghi chú)
- **Nút Xoá (✕)** → xoá item khỏi đơn, không confirm (undo trong 3s nếu cần)
- **Giá dòng** = `ItemPrice × Quantity` — align right

**Chỉnh nhanh số lượng:**

- Hiển thị spinner nhỏ (− / số / +) ngay trên dòng item
- Thay đổi → tự cập nhật lại giá dòng và tổng đơn

**Scroll:** Nếu nhiều item → scroll nội bộ trong Order Panel, phần tổng tiền và nút submit luôn cố định ở dưới

### 4.5 Tổng Tiền

```
Tạm tính:        120,000đ
──────────────────────────
Tổng cộng:       120,000đ
```

> OrderStaff không xử lý discount hay thanh toán — không hiển thị DiscountAmount / TaxAmount / PaymentMethod ở bước này. Các trường đó sẽ do Cashier xử lý sau.

- Tổng cộng update realtime khi thêm/sửa/xoá item

### 4.6 Nút Gửi Đơn

- Label: **"Gửi đơn"** (không phải "Thanh toán")
- Disabled nếu:
  - Không có item nào trong đơn
  - Cửa hàng `IsAcceptingOrders = false`
  - Không có ca đang mở
- Khi tap → confirm dialog nhỏ: "Xác nhận gửi đơn? Đơn sẽ không chỉnh sửa được sau khi gửi."
- Submit → POST lên server:
  - Server tạo `Order` với `Status = Pending`, `PaymentStatus = Unpaid`, `Channel = Pos`
  - Server resolve snapshot: `ProductName`, `CategoryName`, `BasePrice` tại thời điểm này
  - Server trả về `OrderNumber`

---

## 5. Trạng Thái Sau Khi Gửi Đơn

### Success State

- Hiển thị màn hình xác nhận (overlay hoặc replace Order Panel):

```
  ✅  Đã gửi đơn thành công

  Mã đơn:  #ORD-20240605-001

  Chuyển cho Cashier để thanh toán.

  [Đơn mới]
```

- Nút **"Đơn mới"** → reset Order Panel về trạng thái trống, quay lại bán hàng bình thường
- Auto-reset sau 5 giây nếu không có tương tác (tuỳ UX)

### Error State

Nếu server trả lỗi:

| Lỗi | Thông báo hiển thị |
|---|---|
| Product không còn active | "Sản phẩm [tên] không còn bán. Vui lòng xoá khỏi đơn." |
| Product không available tại store | "Sản phẩm [tên] tạm hết hàng." |
| Option không hợp lệ | "Lựa chọn không hợp lệ, vui lòng kiểm tra lại." |
| MinSelect/MaxSelect vi phạm | "Số lựa chọn không hợp lệ cho [tên group]." |
| Cửa hàng không nhận đơn | "Cửa hàng đang tạm dừng nhận đơn." |
| Lỗi khác | "Gửi đơn thất bại. Vui lòng thử lại." |

Không reset đơn khi lỗi — để nhân viên có thể chỉnh sửa và thử lại.

---

## 6. Order History — Tab Phụ

OrderStaff có `Order.Read` permission → có thể xem lại đơn đã tạo.

### Truy cập

- Tab hoặc icon ở góc Order Panel: **"Lịch sử đơn"**
- Mở dạng drawer phủ lên Order Panel (không che Menu Panel)

### Danh Sách

- Hiển thị các order của **ca hiện tại**, sort `CreatedAt DESC`
- Mỗi dòng:

```
  #ORD-001  |  Trà Sữa × 2, Trà Đào × 1  |  Pending  |  48,000đ  |  14:32
```

- Filter nhanh: **Tất cả / Pending / Completed / Cancelled**

### Chi Tiết Đơn

- Tap vào order → mở detail read-only:
  - Thông tin header đơn (OrderNumber, CustomerName, Channel, CreatedAt)
  - Danh sách items với option và giá snapshot
  - Trạng thái thanh toán
- OrderStaff **không** thấy nút Huỷ đơn (thiếu `Order.Delete` permission)
- OrderStaff **không** thấy nút Thanh toán

---
