# POS: Refactor bố cục PosOrderPanel.vue theo 3 vùng cố định + bổ sung DeliveryAddress

**Ngày:** 2026-06-20
**Phạm vi:** NDTCore.FE (pos module) + NDTCore.BE (Order module)

## Bối cảnh

`PosOrderPanel.vue` hiện xếp toàn bộ nội dung theo 1 cột dọc duy nhất: khách hàng → loại đơn → phí giao hàng (nếu Delivery) → phương thức thanh toán → tiền khách đưa → trạng thái thanh toán → cart → ghi chú → tổng tiền → hành động. Cart (phần nhân viên cần nhìn nhiều nhất) bị kẹp giữa các form thanh toán, nút "Tạo đơn" có thể bị đẩy xuống dưới khi cart dài.

**Quyết định đã chốt (qua hỏi đáp):**

| Vấn đề | Quyết định |
|---|---|
| Tách `PosCheckoutPanel.vue` con hay giữ trong `PosOrderPanel.vue`? | Giữ trong `PosOrderPanel.vue` — không tạo component mới. Checkout dùng trực tiếp `cartStore`/`shiftStore`, không cần prop-drilling; tách ra không giảm risk vì vẫn phải tách dialogs/submit logic kèm theo. |
| Phạm vi field `DeliveryAddress` | Full-stack: thêm cột BE (`Order.DeliveryAddress`) + migration + DTO + payload, không chỉ FE-only. |
| Thứ tự hiển thị "Đã nhận/Tiền thừa" vs input "Số tiền khách đưa" | Giữ đúng thứ tự yêu cầu: khối tóm tắt (Đã nhận/Tiền thừa) nằm TRÊN input nhập — không đổi để khớp use-case "xem nhanh trước khi gõ số tiền".|

## A. FE — Layout 3 vùng cố định (`PosOrderPanel.vue`)

Container gốc giữ `d-flex flex-column h-100`. Chia thành 3 div theo chiều dọc bằng CSS:

```css
.panel-header   { flex-shrink: 0; }
.panel-cart     { flex-grow: 1; overflow-y: auto; min-height: 0; }
.panel-checkout { flex-shrink: 0; border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1); }
```

`min-height: 0` trên `.panel-cart` là bắt buộc — thiếu nó flexbox sẽ không co cart lại để scroll đúng cách (lỗi flexbox phổ biến).

### A1. Vùng Header (`.panel-header`)

- Alert "Cửa hàng không nhận đơn" / "Chưa mở ca làm việc" — giữ nguyên, đặt đầu vùng Header.
- **Khách hàng thu gọn**: thêm `const showCustomerForm = ref(cartStore.customerName !== '' || cartStore.customerPhone !== '')`.
  - `showCustomerForm === false`: hiện 1 dòng text "Khách lẻ" + `v-btn variant="text" size="small"` nhãn "+ Thêm khách", click → `showCustomerForm.value = true`.
  - `showCustomerForm === true`: hiện 2 `v-text-field` (tên, SĐT) như hiện tại, không đổi binding/props.
- **Loại đơn**: `v-btn-toggle` với `POS_SERVICE_TYPE_OPTIONS` — giữ nguyên y như hiện tại, đặt ngay dưới khối khách hàng.
- **Delivery block** (`v-if="cartStore.serviceType === ServiceType.Delivery"`):
  - `v-text-field` mới "Địa chỉ giao hàng" (`v-model="cartStore.deliveryAddress"`, density compact, variant outlined, `hide-details`, `maxlength="300"`).
  - `v-text-field` "Phí giao hàng" (`v-model.number="cartStore.deliveryFee"`) — di chuyển từ vị trí cũ (giữa phương thức thanh toán) lên đây, giữ đúng binding/type hiện tại.
- Không có lựa chọn bàn cho DineIn (đã xác nhận không yêu cầu).

### A2. Vùng Cart (`.panel-cart`)

- Giữ nguyên empty-state ("Chưa có món nào") và `v-for` render `PosOrderItem` + `v-divider` giữa các item — chỉ đổi class container từ `overflow-y-auto flex-grow-1 px-3` (đang nằm giữa các block khác) sang `.panel-cart px-3` (đứng riêng 1 vùng).
- Ghi chú đơn hàng (`v-textarea` "Ghi chú đơn hàng") chuyển xuống nằm **trong vùng Cart**, ngay dưới danh sách item (không thuộc Checkout — đây là metadata của đơn, không phải bước thanh toán).

### A3. Vùng Checkout (`.panel-checkout`)

Dùng chung 1 khối cho TakeAway/DineIn/Delivery (không tách layout riêng), thứ tự từ trên xuống:

1. **Nếu `serviceType === Delivery`**: 2 dòng nhỏ "Tiền món" (`cartStore.subtotalAmount`) và "Phí giao hàng" (`cartStore.deliveryFee`, chỉ hiện khi > 0) — `d-flex justify-space-between text-body-2 text-medium-emphasis`.
2. **Tổng cộng**: `cartStore.totalAmount` — `text-subtitle-1 font-weight-semibold`, viền dashed phân cách phía dưới (`border-bottom: 1px dashed`).
3. **Đã nhận / Tiền thừa** (`v-if="cartStore.paymentMethod === PaymentMethod.Cash"`): 2 cột chia bởi `v-divider vertical` — cột trái "Đã nhận" hiện `cartStore.amountReceived`, cột phải hiện `cartStore.changeAmount`; khi `changeAmount < 0` đổi label cột phải thành "Còn thiếu" + `text-error` (giữ đúng điều kiện `:class` hiện có, chỉ đổi bố cục từ 1 dòng sang 2 cột).
4. **Phương thức thanh toán**: `v-btn-toggle` với `POS_PAYMENT_METHOD_OPTIONS` — giữ nguyên logic, đổi vị trí.
5. **Input "Số tiền khách đưa"** (`v-if="paymentMethod === Cash"`, `v-model.number="cartStore.amountReceived"`) — giữ đúng `v-if`/binding hiện tại.
6. **4 nút tiền nhanh** (`v-if="paymentMethod === Cash"`): grid 4 cột, mỗi nút `v-btn variant="tonal" size="small"` hiện `50K`/`100K`/`200K`/`500K`, click → `cartStore.amountReceived = amount`. Giá trị lấy từ `POS_QUICK_CASH_AMOUNTS` (constants mới).
7. **Trạng thái thanh toán**: `v-btn-toggle` với `POS_PAYMENT_STATUS_OPTIONS` — giữ nguyên, không ép COD cho Delivery.
8. **Hành động**: nút xoá tất cả (icon) + nút "Tạo đơn" — giữ nguyên `confirmClear`/`confirmSubmit`, không đổi label theo loại đơn (giữ "Tạo đơn" cho cả 3 loại — tránh thêm logic không cần thiết).

Dialog xác nhận (`confirmDialog`) và dialog thành công (`successDialog`) giữ nguyên vị trí cuối template, không thuộc 3 vùng layout.

## B. FE — `PosOrderItem.vue` (chỉ đổi CSS)

| Phần tử | Hiện tại | Mới |
|---|---|---|
| `.item-img`, `.item-img-placeholder` | 44px | 36px |
| `v-icon` trong placeholder | size 22 | size 18 |
| `.item-name` | mặc định `text-body-2` (14px) | font-size 13px |
| `.group-label` | `text-caption` (12px) | font-size 10px |
| `.opt-row` | `text-caption` (12px) | font-size 11px |
| Giá dòng (`lineTotal`) | `text-body-2` (14px) | font-size 13px |
| `.note-block em` | `text-caption` (12px) | font-size 11px |
| `.qty-btn` | 26px | 22px |
| `v-icon` trong qty-btn | size 14 | size 12 |
| `.qty-num` | min-width 24px | min-width 20px |

Không đổi template structure, script (`groupedOptions`, `lineTotal`), hay emit `edit`.

## C. FE — Store & Constants

### C1. `pos-cart.store.ts`

- Thêm `const deliveryAddress = ref('')`.
- Thêm computed `subtotalAmount = computed(() => totalAmount.value - deliveryFee.value)` — dùng cho dòng "Tiền món" khi Delivery.
- `clearCart()`: thêm `deliveryAddress.value = ''`.
- Export thêm `deliveryAddress`, `subtotalAmount` trong `return {}`.
- Không đổi watch/computed hiện có (`totalAmount`, `changeAmount`, `itemCount`).

### C2. `pos-order-panel.constants.ts`

Thêm:

```ts
export const POS_QUICK_CASH_AMOUNTS = [50000, 100000, 200000, 500000] as const
```

### C3. `pos-order.dto.ts`

- `CreatePosOrderRequest` — thêm `DeliveryAddress: string | null`.
- `GetOrderDetailDto` — thêm `DeliveryAddress: string | null`.

### C4. `PosOrderPanel.vue` — `submitOrder()`

Thêm vào payload: `DeliveryAddress: cartStore.deliveryAddress || null` (đặt cạnh `DeliveryFee` trong object literal).

## D. BE — `DeliveryAddress` (full-stack)

### D1. `Order.cs` entity

Thêm property trong region Pricing (cạnh `DeliveryFee`):

```csharp
/// <summary>
/// VN: Địa chỉ giao hàng, chỉ có giá trị khi ServiceType là Delivery. <br />
/// EN: Delivery address, only meaningful when ServiceType is Delivery.
/// </summary>
public string? DeliveryAddress { get; set; }
```

### D2. `OrderConfiguration.cs`

Trong region PRICING (cạnh `DeliveryFee`), thêm:

```csharp
builder.Property(o => o.DeliveryAddress).HasMaxLength(300);
```

### D3. Migration

```bash
dotnet ef migrations add Add_OrderDeliveryAddress \
  --context NdtOrderContext \
  --project ../NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure \
  --startup-project . \
  --output-dir Persistence/Migrations
```

### D4. `CreateOrderRequest.cs`

Thêm (bilingual XML doc theo pattern hiện có, cạnh `DeliveryFee`):

```csharp
/// <summary>
/// VN: Địa chỉ giao hàng, chỉ có ý nghĩa khi ServiceType là Delivery. <br />
/// EN: Delivery address, only meaningful when ServiceType is Delivery.
/// </summary>
public string? DeliveryAddress { get; set; }
```

### D5. `CreateOrderCommand.cs`

Thêm `DeliveryAddress` (string?) vào record + constructor mapping từ `CreateOrderRequest` (cùng vị trí với `DeliveryFee`).

### D6. `CreateOrderCommandValidator.cs`

```csharp
RuleFor(x => x.DeliveryAddress)
    .MaximumLength(300)
    .WithMessage("DeliveryAddress must not exceed 300 characters.")
    .When(x => x.DeliveryAddress is not null);
```

Không bắt buộc `DeliveryAddress` khi `ServiceType == Delivery` — giữ tối thiểu, để nhân viên vẫn tạo đơn được nếu khách đọc địa chỉ qua điện thoại sau.

### D7. `CreateOrderCommandHandler.cs`

Trong object-initializer `OrderEntity`, thêm `DeliveryAddress = request.DeliveryAddress,` cạnh `DeliveryFee = request.DeliveryFee,`.

### D8. `GetOrderResponse.cs` + `GetOrderByIdQueryHandler.cs`

- `GetOrderResponse`: thêm `public string? DeliveryAddress { get; set; }` cạnh `DeliveryFee`.
- `MapToResponse`: thêm `DeliveryAddress = o.DeliveryAddress,` cạnh `DeliveryFee = o.DeliveryFee,`.

## Error handling

- `DeliveryAddress` vượt 300 ký tự → BE trả lỗi validation 400, FE hiển thị toast qua `handleApiError` (pattern sẵn có) — không cần xử lý thêm ở FE vì input đã có `maxlength="300"` chặn trước.
- Không có rule mới nào ảnh hưởng luồng thanh toán hiện có (`AmountReceived >= TotalAmount` khi Cash+Paid) — giữ nguyên.

## Testing

- FE: `npx vue-tsc --build` sau khi đổi DTO/store (bắt lỗi thiếu field ở các nơi dùng `CreatePosOrderRequest`/`GetOrderDetailDto`).
- BE: `dotnet build NDTCore.sln` sau khi đổi entity/DTO/handler.
- Manual: tạo đơn Delivery với địa chỉ → kiểm tra `GetOrderById` trả về đúng `DeliveryAddress`; tạo đơn TakeAway/DineIn → field `DeliveryAddress` là `null`, không lỗi.
- Manual UI: cart dài → xác nhận vùng Checkout không bị đẩy ra ngoài viewport, cart tự scroll riêng.

## Out of scope

- Không đổi label nút "Tạo đơn" theo loại đơn (giữ nguyên cho cả 3 loại).
- Không validate bắt buộc `DeliveryAddress` khi Delivery (xem D6).
- Không thêm tính năng chọn bàn cho DineIn.
- Không đổi `build-bill-html.util.ts` / bill in — đã có spec riêng (`2026-06-19-pos-bill-redesign-and-order-payment-fields-design.md`), không thêm `DeliveryAddress` lên bill ở task này.
- Không thêm helper/action mới vào store cho quick-cash (gán trực tiếp tại component, theo YAGNI).
