# POS: Restyle bill in + bổ sung ServiceType/tiền nhận/tiền thừa/phí giao hàng

**Ngày:** 2026-06-19
**Phạm vi:** NDTCore.BE (Order, Store module) + NDTCore.FE (pos module)

## Bối cảnh

`build-bill-html.util.ts` hiện dựng bill bằng `<table>` đơn giản (tên món, SL, đơn giá, thành tiền + dòng option gộp chung), không phân biệt Size/topping, không hiển thị hình thức nhận hàng, số tiền nhận/tiền thừa, phí giao hàng. User yêu cầu restyle theo phong cách hiện đại/tối giản cho cửa hàng trà sữa, tối ưu máy in nhiệt 58mm/80mm, và **bổ sung đầy đủ dữ liệu còn thiếu** (ServiceType chưa lên đến FE response, AmountReceived/ChangeAmount/DeliveryFee chưa tồn tại ở bất kỳ layer nào) — đây là lựa chọn phạm vi đầy đủ do user chọn, không phải chỉ restyle CSS.

**Quyết định đã chốt (qua hỏi đáp):**

| Vấn đề | Quyết định |
|---|---|
| ServiceType thiếu "Giao hàng" | Thêm `Delivery` vào enum (BE constant + FE enum + UI toggle) |
| Thời điểm nhập AmountReceived/ChangeAmount (Order bất biến sau khi tạo) | Nhập ngay lúc tạo đơn — 1 bước, không cần luồng capture-payment riêng |
| DeliveryFee có cộng vào TotalAmount không | Có — `TotalAmount = Subtotal - DiscountAmount + TaxAmount + DeliveryFee` |
| Hiển thị "Thu ngân" | Dùng trực tiếp `order.CreatedBy` (là email người tạo đơn), không join Identity |
| Phân biệt Size vs topping trên bill | Option có `GroupName` (so sánh không phân biệt hoa/thường) bằng `'Size'` → ghép vào tên món; còn lại là topping/ghi chú thụt lề |
| Validate AmountReceived khi Cash+Paid | Bắt buộc `AmountReceived >= TotalAmount` |

## A. BE — Domain & dữ liệu

### A1. `ServiceType` constants

**File:** `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Domain/Constants/ServiceType.cs`

Thêm hằng số `Delivery` và cập nhật `IsValid`:

```csharp
public const string Delivery = "Delivery";

public static bool IsValid(string value) => value is TakeAway or DineIn or Delivery;
```

### A2. `Order` entity — 3 field mới

**File:** `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Domain/Entities/Order.cs`

Thêm vào khu vực Pricing/Payment:

```csharp
/// <summary>
/// VN: Phí giao hàng, chỉ có giá trị khi ServiceType là Delivery, mặc định 0. <br />
/// EN: Delivery fee, only meaningful when ServiceType is Delivery, defaults to 0.
/// </summary>
public decimal DeliveryFee { get; set; }

/// <summary>
/// VN: Số tiền khách đưa khi thanh toán bằng tiền mặt, <see langword="null"/> nếu không phải Cash. <br />
/// EN: Amount received from customer for cash payment, <see langword="null"/> when payment method is not Cash.
/// </summary>
public decimal? AmountReceived { get; set; }

/// <summary>
/// VN: Tiền thừa trả khách, tính server-side = AmountReceived - TotalAmount, <see langword="null"/> nếu không phải Cash. <br />
/// EN: Change returned to customer, server-computed as AmountReceived - TotalAmount, <see langword="null"/> when payment method is not Cash.
/// </summary>
public decimal? ChangeAmount { get; set; }
```

Cập nhật công thức trong XML doc của `TotalAmount` (nếu có ghi công thức cũ) thành:
`TotalAmount = Subtotal - DiscountAmount + TaxAmount + DeliveryFee`.

### A3. EF Configuration

**File:** `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Persistence/Configurations/OrderConfiguration.cs`

Trong region Pricing, thêm:

```csharp
builder.Property(o => o.DeliveryFee).HasPrecision(18, 2);
builder.Property(o => o.AmountReceived).HasPrecision(18, 2);
builder.Property(o => o.ChangeAmount).HasPrecision(18, 2);
```

### A4. Migration

Chạy sau khi A2/A3 hoàn tất (module Order, dùng skill `be-migration`):

```bash
dotnet ef migrations add Add_OrderDeliveryFeeAndCashPayment \
  --context NdtOrderContext \
  --project ../NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure \
  --startup-project . \
  --output-dir Persistence/Migrations
```

## B. BE — Contracts/Application (Create flow)

### B1. `CreateOrderRequest`

**File:** `NDTCore.BE/.../NDTCore.Order.Contracts/ViewModels/Orders/CreateOrderRequest.cs`

Thêm 2 property (bilingual XML doc theo pattern hiện có):

```csharp
public decimal DeliveryFee { get; set; }
public decimal? AmountReceived { get; set; }
```

Cập nhật doc comment của `ServiceType` để liệt kê thêm `Delivery`.

### B2. `CreateOrderCommand`

**File:** `NDTCore.BE/.../CreateOrder/CreateOrderCommand.cs`

Thêm `DeliveryFee` (decimal) và `AmountReceived` (decimal?) vào record + constructor mapping từ `CreateOrderRequest`.

### B3. `CreateOrderCommandValidator`

**File:** `NDTCore.BE/.../CreateOrder/CreateOrderCommandValidator.cs`

- Cập nhật message `ServiceType`: `$"ServiceType must be one of: {ServiceType.TakeAway}, {ServiceType.DineIn}, {ServiceType.Delivery}."`
- Thêm rule: `RuleFor(x => x.DeliveryFee).GreaterThanOrEqualTo(0)`.
- Thêm rule: `RuleFor(x => x.AmountReceived).NotNull().When(x => x.PaymentMethod == PaymentMethod.Cash && x.PaymentStatus == PaymentStatus.Paid)` — chỉ validate **có nhập** giá trị ở đây.

**Không** validate `AmountReceived >= TotalAmount` trong validator: `CreateOrderCommand` chưa có `TotalAmount` (chỉ tính được trong Handler sau khi cộng `Items`). So sánh `>= TotalAmount` thực hiện trong Handler (B4) để tránh tính trùng tổng tiền ở 2 nơi.

### B4. `CreateOrderCommandHandler`

**File:** `NDTCore.BE/.../CreateOrder/CreateOrderCommandHandler.cs`

- Đổi công thức: `var totalAmount = subtotalOrder - request.DiscountAmount + request.TaxAmount + request.DeliveryFee;`
- Sau khi tính `totalAmount`, nếu `request.PaymentMethod == PaymentMethod.Cash && request.PaymentStatus == PaymentStatus.Paid`:
  - Nếu `request.AmountReceived is null || request.AmountReceived < totalAmount` → trả lỗi validation (theo pattern xử lý lỗi hiện có của handler này, ví dụ `Result.Failure(...)` hoặc throw — giữ đúng convention đang dùng trong file).
  - Ngược lại tính `changeAmount = request.AmountReceived.Value - totalAmount`.
- Trong object-initializer `OrderEntity`, thêm:

```csharp
DeliveryFee = request.DeliveryFee,
AmountReceived = request.PaymentMethod == PaymentMethod.Cash ? request.AmountReceived : null,
ChangeAmount = request.PaymentMethod == PaymentMethod.Cash ? changeAmount : null,
```

(Khai báo `decimal? changeAmount = null;` trước nhánh tính ở trên.)

## C. BE — Read flow (trả dữ liệu cho bill)

### C1. `GetOrderResponse`

**File:** `NDTCore.BE/.../Contracts/ViewModels/Orders/GetOrderResponse.cs`

Thêm 4 property (bilingual XML doc):

```csharp
public string ServiceType { get; set; }
public decimal DeliveryFee { get; set; }
public decimal? AmountReceived { get; set; }
public decimal? ChangeAmount { get; set; }
```

### C2. `GetOrderByIdQueryHandler.MapToResponse`

**File:** `NDTCore.BE/.../GetOrderById/GetOrderByIdQueryHandler.cs`

Thêm 4 dòng map:

```csharp
ServiceType = o.ServiceType,
DeliveryFee = o.DeliveryFee,
AmountReceived = o.AmountReceived,
ChangeAmount = o.ChangeAmount,
```

### C3. Hotline cửa hàng (bổ sung phát hiện thêm trong lúc thiết kế)

`AppStore.Phone` (`NDTCore.Store.Domain/Entities/AppStore.cs:115`) đã tồn tại nhưng chưa expose qua status endpoint dùng cho POS.

**Files:**
- `NDTCore.Store.Contracts/ViewModels/Pos/PosStoreStatusResponse.cs` — thêm `public string? Phone { get; set; }`.
- `NDTCore.Store.Application/Features/Pos/GetPosStoreStatus/GetPosStoreStatusQueryHandler.cs` — thêm `Phone = store.Phone,` trong object-initializer mapping.

## D. FE — Enums & constants

### D1. `service-type.enum.ts`

**File:** `NDTCore.FE/src/modules/pos/enums/service-type.enum.ts`

Thêm member `Delivery = 'Delivery'`.

### D2. `pos-order-panel.constants.ts`

**File:** `NDTCore.FE/src/modules/pos/constants/pos-order-panel.constants.ts`

Thêm vào `POS_SERVICE_TYPE_OPTIONS`:

```ts
{ value: ServiceType.Delivery, label: 'Giao hàng', icon: 'mdi-moped' }
```

## E. FE — DTOs

**File:** `NDTCore.FE/src/modules/pos/models/dtos/pos-order.dto.ts`

`CreatePosOrderRequest` — thêm:

```ts
DeliveryFee: number
AmountReceived: number | null
```

`GetOrderDetailDto` — thêm:

```ts
ServiceType: string
DeliveryFee: number
AmountReceived: number | null
ChangeAmount: number | null
```

**File:** `NDTCore.FE/src/modules/pos/models/dtos/pos-shift.dto.ts`

`PosStoreStatusDto` — thêm `Phone: string | null`.

## F. FE — Order-creation UI

### F1. `pos-cart.store.ts`

**File:** `NDTCore.FE/src/modules/pos/stores/pos-cart.store.ts`

- Thêm `const deliveryFee = ref(0)` — reset về `0` trong `$reset()` và khi `serviceType` đổi khỏi `Delivery` (watch hoặc reset thủ công tại nơi đổi service type trong component).
- Thêm `const amountReceived = ref<number | null>(null)` — reset về `null` trong `$reset()` và khi `paymentMethod` đổi khỏi `Cash`.
- Computed `totalAmount` cập nhật: `subtotal - discountAmount + taxAmount + deliveryFee.value`.
- Computed mới `changeAmount = computed(() => amountReceived.value !== null ? amountReceived.value - totalAmount.value : null)` — chỉ dùng để preview trên UI, không phải nguồn sự thật (server tính lại).
- Export thêm `deliveryFee`, `amountReceived`, `changeAmount` trong `return {}`.

### F2. `pos-shift.store.ts`

**File:** `NDTCore.FE/src/modules/pos/stores/pos-shift.store.ts`

Thêm `const hotline = computed(() => status.value?.Phone ?? null)`, export trong `return {}`.

### F3. `PosOrderPanel.vue`

**File:** `NDTCore.FE/src/modules/pos/components/PosOrderPanel.vue`

- Input số "Phí giao hàng" (`v-text-field` type number, `v-model.number="cart.deliveryFee"`) — render có điều kiện `v-if="cart.serviceType === ServiceType.Delivery"`, đặt ngay dưới nhóm chọn hình thức nhận hàng.
- Input số "Số tiền khách đưa" (`v-model.number="cart.amountReceived"`) — render có điều kiện `v-if="cart.paymentMethod === PaymentMethod.Cash"`, đặt trong nhóm thanh toán. Ngay dưới, hiển thị dòng text "Tiền thừa: {format(cart.changeAmount)}" (class đỏ nếu `cart.changeAmount < 0`, ẩn nếu `cart.changeAmount === null`).
- `submitOrder()` — thêm `DeliveryFee: cart.deliveryFee` và `AmountReceived: cart.amountReceived` vào payload `CreatePosOrderRequest`.

## G. FE — Bill layout (`build-bill-html.util.ts`)

### G1. `BillStoreInfo`

```ts
export interface BillStoreInfo {
    name: string
    logoUrl: string | null
    address: string
    hotline: string | null
}
```

`usePrintBill.ts` truyền thêm `hotline: shiftStore.hotline`.

### G2. Markup — chuyển từ `<table>` sang block flexbox xếp dọc

Lý do: tên món dài + nhiều dòng topping thụt lề không hợp với cột cố định ở khổ 58mm; block co giãn theo nội dung tránh vỡ layout.

**Cấu trúc HTML (giữ nguyên cách trả về 1 string HTML đầy đủ, style inline trong `<style>`, in qua iframe — không đổi `usePrintBill`/`printHtmlViaIframe`):**

```text
bill-header (center)
  bill-store-name (store.name)
  bill-store-address (store.address, nếu có)
  bill-store-hotline (store.hotline, nếu có, format "ĐT: {hotline}")
divider
bill-order-info (mỗi dòng: label trái, value phải — flex space-between)
  Mã đơn / Thời gian / Thu ngân / Hình thức (map ServiceType → nhãn VN)
divider
bill-products
  "SẢN PHẨM" (label, border-bottom)
  mỗi item (function renderItemBlock):
    dòng chính: "{index}. {ProductName}{sizeSuffix}" trái — "{LineNetAmount}" phải, bold vừa
    dòng SL (chỉ khi Quantity > 1): "SL: {Quantity} x {SalePrice}" thụt lề, font nhỏ xám
    mỗi option khác Size: dòng thụt lề "- {OptionName}" (hoặc "+ {OptionName} +{Price}₫" nếu Price > 0)
divider
bill-summary
  "Tổng số lượng" / "Tạm tính" (luôn hiện)
  "Giảm giá" (chỉ khi > 0) / "Phí giao hàng" (chỉ khi > 0)
  bill-total (khối border-top/bottom 2px, font lớn bold): "TỔNG THANH TOÁN" — TotalAmount
bill-payment
  "Phương thức" (luôn hiện)
  "Số tiền nhận" / "Tiền thừa" (chỉ khi PaymentMethod === 'Cash' và giá trị not null)
divider
bill-footer (center, italic): "Cảm ơn quý khách! Hẹn gặp lại lần sau"
```

### G3. Quy tắc Size/topping

```ts
function isSizeOption(o: GetOrderItemOptionDto): boolean {
    return (o.GroupName ?? '').toLowerCase() === 'size'
}
```

- Item: tách `sizeOption = item.Options.find(isSizeOption)`; `sizeSuffix` lấy giá trị `(${sizeOption.OptionName})` nếu có `sizeOption`, ngược lại chuỗi rỗng.
- Topping: `item.Options.filter(o => !isSizeOption(o))` → mỗi cái 1 dòng thụt lề.

### G4. ServiceType → nhãn hiển thị

```ts
const SERVICE_TYPE_LABEL: Record<string, string> = {
    TakeAway: 'Mang đi',
    DineIn: 'Ngồi lại',
    Delivery: 'Giao hàng',
}
```

### G5. CSS

- Font `Arial, sans-serif`, toàn bộ đen/xám đậm (không phụ thuộc màu — máy in nhiệt monochrome).
- `bill-store-name`: ~16px, bold, letter-spacing nhẹ.
- `bill-store-address`/`bill-store-hotline`: ~11px, `color: #444`.
- Dòng info/summary thường: ~12px, `margin: 3px 0`.
- Dòng phụ (SL, topping): ~11px, `color: #666`, `padding-left: 10px`.
- `bill-total`: `border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; font-size: 16px; font-weight: bold;`.
- `bill-footer`: `font-style: italic; margin-top: 12px; margin-bottom: 16px;` (đủ khoảng feed giấy trước khi cắt).

## Error handling

- `AmountReceived < TotalAmount` khi Cash+Paid → BE trả lỗi validation, FE hiển thị toast (đường lỗi sẵn có qua `handleApiError`), không tạo đơn.
- Bill build khi thiếu `hotline`/`address` → ẩn dòng tương ứng, không hiện chuỗi rỗng/`null`.

## Out of scope

- Đổi `PaymentMethod` options hiện có (Card/EWallet vẫn không hiển thị trong POS UI, không nằm trong yêu cầu này).
- Tính năng sửa `AmountReceived`/`ChangeAmount` sau khi đơn đã tạo (Order vẫn bất biến ngoài `Status`, theo quyết định "nhập 1 bước lúc tạo").
- QZ Tray / in nhiệt tự động (đã có spec riêng `2026-06-18-pos-print-ticket-design.md`).
