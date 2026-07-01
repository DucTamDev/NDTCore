# Preview OrderNumber Trên POS Header — Design

**Goal:** Hiển thị "OrderNumber dự kiến" (số đơn tiếp theo, chưa được reserve) trên header/AppBar của trang POS, để thu ngân biết trước mã đơn sắp tạo.

**Tech Stack:** .NET 8 + EF Core 8 + MediatR (BE); Vue 3 (Composition API) + TypeScript + Pinia (FE).

---

## 1. Bối cảnh

`CreateOrderCommandHandler` sinh `OrderNumber` theo format `{StoreCode}-{ddMMyy}-{sequence:D6}` (xem [2026-07-01-order-number-format-design.md](2026-07-01-order-number-format-design.md)), trong đó `sequence` lấy từ `IAppOrderRepository.GetNextOrderSequenceAsync(tenantId, storeId, now)` — COUNT(*) số đơn của store trong ngày UTC hiện tại, cộng 1.

`PosController` (`api/pos`) hiện có 5 endpoint (`store/{id}/status`, `store/{id}/catalog`, `orders` POST, `orders/{id}` GET, `store/{id}/orders`), chưa có endpoint trả về số dự kiến.

FE: `PosHeader.vue` là AppBar riêng của trang POS, hiện có `v-spacer` giữa StoreName/status (trái) và History button (phải) — chỗ trống để thêm hiển thị số dự kiến. `usePosShiftStore` (Pinia) đã quản lý `status` fetch qua `posService.getStoreStatusAsync`, cùng pattern sẽ tái dùng cho state mới. `PosView.vue` gọi `fetchStatus` + `fetchCatalog` song song trong `onMounted`. `PosOrderPanel.vue.submitOrder()` là nơi xử lý response sau khi tạo đơn thành công (set `lastOrderNumber`, clear cart).

---

## 2. Quyết định thiết kế (đã chốt)

| Điểm | Quyết định |
|---|---|
| Vị trí hiển thị | Header/AppBar của trang POS (`PosHeader.vue`) |
| Thời điểm refresh | 1 lần khi vào trang POS (mount) + refresh lại ngay sau khi tạo đơn thành công |
| Độ chính xác | Chỉ là ước tính tại thời điểm gọi — **không reserve số**, có thể lệch nếu có đơn khác được tạo xen giữa (chấp nhận, nhất quán với quyết định race-condition đã chốt ở spec trước) |

---

## 3. Thay đổi chi tiết

### 3.1. BE — Query mới `GetNextOrderNumber`

Thêm `NDTCore.Order.Application/Features/Orders/GetNextOrderNumber/`:
- `GetNextOrderNumberQuery(int StoreId) : IQuery<GetNextOrderNumberResponse>`
- `GetNextOrderNumberResponse { string OrderNumber }`
- `GetNextOrderNumberQueryHandler`: lookup store qua `IStoreService.GetStoresByIdsAsync([StoreId], null, ct)` (NotFound nếu không có — cùng pattern `CreateOrderCommandHandler`), gọi `_orderRepository.GetNextOrderSequenceAsync(tenantId, storeId, DateTimeOffset.UtcNow, ct)`, build `OrderNumber` — **không** gọi `AddAsync`/`SaveChangesAsync`, chỉ đọc.

**Tách logic build OrderNumber dùng chung:** thêm static helper `OrderNumberFormatter.Build(string storeCode, DateTimeOffset date, int sequence) => $"{storeCode}-{date:ddMMyy}-{sequence:D6}"` (đặt tại `NDTCore.Order.Application/Common/`, cùng nơi với `OrderScopeValidator`). `CreateOrderCommandHandler` và `GetNextOrderNumberQueryHandler` đều gọi helper này thay vì lặp format string.

### 3.2. BE — Endpoint mới trên `PosController`

```csharp
[HttpGet("store/{storeId:int}/next-order-number")]
public async Task<IActionResult> GetNextOrderNumber(
    [FromRoute] int storeId,
    CancellationToken cancellationToken)
{
    var result = await _mediator.Send(new GetNextOrderNumberQuery(storeId), cancellationToken);
    return StatusResult(result);
}
```

Cùng nhóm `[Authorize(Roles = ...)]` như các endpoint POS khác (không thêm policy mới).

### 3.3. FE — API + Service + Store

- `api.constants.ts` (`POS_API`): thêm `GET_NEXT_ORDER_NUMBER: (storeId: number) => \`/pos/store/${storeId}/next-order-number\``.
- `pos.api.ts`: thêm `getNextOrderNumberAsync(storeId: number)` gọi `GET`.
- `pos.service.ts`: thêm `getNextOrderNumberAsync(storeId)` wrap, trả `.Data.OrderNumber`.
- `pos-shift.store.ts`: thêm `nextOrderNumber = ref<string | null>(null)` + `async function fetchNextOrderNumber(storeId: number)`, reset trong `$reset()`.

### 3.4. FE — Wiring

- `PosView.vue` `onMounted`: thêm `shiftStore.fetchNextOrderNumber(storeId.value)` vào `Promise.all` cùng `fetchStatus`/`fetchCatalog`.
- `PosOrderPanel.vue.submitOrder()`: sau khi `posService.createOrderAsync()` thành công (chỗ set `lastOrderNumber`), gọi thêm `shiftStore.fetchNextOrderNumber(storeId)` để cập nhật số tiếp theo cho đơn kế.
- `PosHeader.vue`: hiện `shiftStore.nextOrderNumber` dạng text nhỏ tại vị trí `v-spacer` hiện có, ví dụ "Đơn tiếp theo: HCM01-020726-000045"; ẩn nếu `null` (đang loading hoặc lỗi).

### 3.5. Không đổi

- Không thay đổi logic sinh `OrderNumber` thật trong `CreateOrderCommandHandler` (chỉ tách phần format ra helper dùng chung).
- Không polling định kỳ — chỉ fetch theo 2 mốc đã chốt.

---

## 4. Error handling

- `GetNextOrderNumberQueryHandler` trả `NotFound` nếu `StoreId` không tồn tại — FE khi gọi lỗi thì để `nextOrderNumber = null`, ẩn hiển thị (không toast lỗi, vì đây là thông tin phụ, không chặn luồng tạo đơn chính).
