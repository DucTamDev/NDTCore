# POS: Order status default = Completed & nút "In bill" trong History

**Ngày:** 2026-06-19
**Phạm vi:** NDTCore.BE (Order, Store module) + NDTCore.FE (pos module)

## Bối cảnh

Hiện tại:
- Khi tạo đơn POS, `CreateOrderCommandHandler` luôn gán `Status = OrderStatus.Pending`.
- `PosOrderHistoryDrawer.vue` hiển thị danh sách đơn (số đơn, trạng thái, tổng tiền, tóm tắt món, thời gian) nhưng không có cách in hoá đơn.
- Đã có spec riêng `2026-06-18-pos-print-ticket-design.md` cho việc tự động in vé qua QZ Tray (máy in nhiệt) khi tạo đơn — **chưa implement**. Spec này độc lập, không phụ thuộc QZ Tray.

## Yêu cầu

1. Đơn tạo qua POS có status mặc định là **Completed** ngay khi tạo (mọi đơn hợp lệ, không phụ thuộc PaymentStatus).
2. Trong History Order (POS), mỗi đơn có status **khác Cancelled** hiển thị nút **"In bill"** — in hoá đơn qua trình duyệt (`window.print()`), không phụ thuộc QZ Tray/máy in nhiệt.

## A. Order status default = Completed

**File:** `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommandHandler.cs`

Đổi dòng gán status khi khởi tạo `OrderEntity`:

```csharp
Status = OrderStatus.Completed, // trước đó: OrderStatus.Pending
```

Không cần thay đổi FE — payload tạo đơn không gửi field `Status`, status luôn do BE gán.

**Tác động:** Đơn POS bỏ qua giai đoạn Pending/Confirmed, hiển thị Completed ngay trong History. Endpoint `UpdateOrderStatus` (Pending→Confirmed→Completed) vẫn giữ nguyên cho các luồng khác (ví dụ đơn tạo qua kênh không phải POS, nếu có).

## B. BE: endpoint chi tiết đơn + địa chỉ cửa hàng cho POS

### B1. Endpoint GET chi tiết đơn cho màn POS

**File:** `NDTCore.BE/src/NDTCore.API/Controllers/Modules/Pos/PosController.cs`

Thêm action mới, tái dùng `GetOrderByIdQuery` đã có (không cần Application code mới):

```csharp
[HttpGet("orders/{id:int}")]
public async Task<IActionResult> GetOrderById(
    int id,
    CancellationToken cancellationToken)
{
    var result = await _mediator.Send(new GetOrderByIdQuery(id), cancellationToken);
    return StatusResult(result);
}
```

Route: `GET api/pos/orders/{id}`, cùng policy `[Authorize(Roles = Cashier/StoreManager/FranchiseeOwner/OrgAdmin/SuperAdmin)]` đã khai báo ở class level — tách biệt với `GET api/admin/order/{id}` (admin-only route, không dùng từ màn POS).

Response: `GetOrderResponse` hiện có (đầy đủ Items, Options, Subtotal/DiscountAmount/TaxAmount/TotalAmount, PaymentMethod/PaymentStatus, CustomerName/Phone, CreatedAt/CreatedBy) — đủ dữ liệu dựng bill, không cần đổi DTO BE.

### B2. Bổ sung địa chỉ cửa hàng vào GetPosStoreStatusQuery

**Files:**
- `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Pos/PosStoreStatusResponse.cs`
- `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Pos/GetPosStoreStatus/GetPosStoreStatusQueryHandler.cs`

Thêm 4 property vào `PosStoreStatusResponse`: `Address`, `City`, `District`, `Province` (string?, mirror `AppStore`). Map trực tiếp trong handler từ entity. `StoreName`/`LogoUrl` đã có sẵn, không đổi.

## C. FE: composable usePrintBill + nút "In bill"

### C1. DTOs

**File:** `NDTCore.FE/src/modules/pos/models/dtos/pos-order.dto.ts` — thêm (PascalCase, mirror BE `GetOrderResponse`):

```ts
export interface GetOrderItemOptionDto {
  Id: number
  OptionId: number
  GroupName: string
  OptionName: string
  Price: number
}

export interface GetOrderItemDto {
  Id: number
  ProductId: number
  ProductCode: string
  ProductName: string
  RegularPrice: number
  OptionsAmount: number
  SalePrice: number
  Quantity: number
  LineAmount: number
  DiscountAmount: number
  LineNetAmount: number
  Note: string | null
  Options: GetOrderItemOptionDto[]
}

export interface GetOrderDetailDto {
  Id: number
  OrderNumber: string
  Status: string
  CustomerName: string | null
  CustomerPhone: string | null
  Note: string | null
  Subtotal: number
  DiscountAmount: number
  TaxAmount: number
  TotalAmount: number
  PaymentMethod: string
  PaymentStatus: string
  CreatedAt: string
  CreatedBy: string | null
  Items: GetOrderItemDto[]
}
```

**File:** `NDTCore.FE/src/modules/pos/models/dtos/pos-shift.dto.ts` — thêm vào `PosStoreStatusDto`: `Address: string | null`, `City: string | null`, `District: string | null`, `Province: string | null`.

### C2. API + Service

**File:** `pos.api.ts` — thêm `getOrderByIdAsync(id: number): Promise<ApiResponse<GetOrderDetailDto>>` gọi `posClient.get(`/pos/orders/${id}`)`.
**File:** `pos.service.ts` — thêm `getOrderByIdAsync(id: number): Promise<GetOrderDetailDto | null>`.

### C3. Composable `usePrintBill.ts`

**File mới:** `NDTCore.FE/src/modules/pos/composables/usePrintBill.ts`

```ts
export function usePrintBill() {
  const isPrinting = ref(false)

  async function printBill(orderId: number): Promise<void> {
    isPrinting.value = true
    try {
      const order = await posService.getOrderByIdAsync(orderId)
      if (!order) {
        toast.error('Không tải được chi tiết đơn hàng')
        return
      }
      const html = buildBillHtml(order, {
        name: shiftStore.storeName,
        logoUrl: shiftStore.logoUrl,
        address: shiftStore.address, // computed nối Address/District/City/Province
      })
      printHtmlViaIframe(html)
    } catch (error) {
      handleApiError(error)
    } finally {
      isPrinting.value = false
    }
  }

  return { isPrinting, printBill }
}
```

- `buildBillHtml()` là hàm thuần (đặt trong `utils/build-bill-html.util.ts`) — nhận `GetOrderDetailDto` + thông tin cửa hàng, trả HTML string tự chứa style inline (khổ in thông thường, không bắt buộc 80mm). Nội dung: header (logo nếu có, tên cửa hàng, địa chỉ), số đơn + thời gian tạo, khách hàng (nếu có), bảng món (tên, SL, đơn giá, option, thành tiền dòng), tổng (Subtotal/Discount/Tax/Total), phương thức + trạng thái thanh toán, người tạo.
- `printHtmlViaIframe()` (cũng trong cùng util file hoặc `utils/print-iframe.util.ts`) — tạo `<iframe>` ẩn (`style="display:none"`), gắn vào `document.body`, viết HTML vào `iframe.contentDocument`, gọi `iframe.contentWindow.print()` sau khi load, gỡ iframe sau khi in (delay nhỏ hoặc lắng nghe `afterprint`). Tránh popup blocker vì không mở tab/window mới — kỹ thuật này tương thích với fallback đã định trong spec QZ Tray (2026-06-18), có thể tái dùng khi triển khai phần đó.

### C4. UI — nút trong History

**File:** `PosOrderHistoryDrawer.vue`

Thêm slot `#append` cho mỗi `v-list-item`:

```vue
<template #append v-if="order.Status !== 'Cancelled'">
  <v-btn
    icon="mdi-printer-outline"
    variant="text"
    size="small"
    :loading="isPrinting"
    @click="printBill(order.Id)"
  />
</template>
```

Import `usePrintBill()` trong `<script setup>`, dùng `isPrinting`/`printBill` trực tiếp.

## Error handling

- Fetch chi tiết đơn lỗi (404/5xx) → toast error qua `handleApiError`, không crash drawer.
- In thất bại (hiếm, do iframe) → vẫn coi đơn đã tạo thành công, chỉ lỗi UI in.

## Out of scope

- QZ Tray / máy in nhiệt tự động (đã có spec riêng `2026-06-18-pos-print-ticket-design.md`).
- Brand logo riêng (dùng `AppStore.LogoUrl` hiện có, không đụng Brand module).
- Đổi luồng `UpdateOrderStatus` (Pending→Confirmed→Completed) cho các kênh khác ngoài POS.
