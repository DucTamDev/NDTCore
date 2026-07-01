# Đổi Format OrderNumber Khi POS Tạo Đơn — Design

**Goal:** Đổi format `OrderNumber` sinh ra khi tạo đơn (`CreateOrder`) từ `ORDER_{ddMMyy}_{sequence:D4}` (scope: per-tenant/ngày) sang `{StoreCode}-{ddMMyy}-{sequence:D6}` (scope: per-tenant + per-store/ngày), ví dụ `HCM01-010726-000123`.

**Tech Stack:** .NET 8 + EF Core 8 + MediatR (BE only — không đổi FE, FE chỉ hiển thị `OrderNumber` server trả về).

---

## 1. Bối cảnh hiện tại

`CreateOrderCommandHandler.Handle()` sinh `OrderNumber` inline:

```csharp
var now = DateTimeOffset.UtcNow;
var sequence    = await _orderRepository.GetNextOrderSequenceAsync(tenantId, now, cancellationToken);
var orderNumber = $"ORDER_{now:ddMMyy}_{sequence:D4}";
```
([CreateOrderCommandHandler.cs:50-53](../../../NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommandHandler.cs))

`GetNextOrderSequenceAsync` tính `sequence` bằng `COUNT(*)` số đơn của **toàn tenant** trong ngày UTC hiện tại (`.IgnoreQueryFilters()` + filter `TenantId` + khoảng `[startOfDay, endOfDay)` UTC), không phân biệt theo store:

```csharp
public async Task<int> GetNextOrderSequenceAsync(Guid tenantId, DateTimeOffset orderDate, CancellationToken cancellationToken = default)
{
    var startOfDay = new DateTimeOffset(orderDate.Year, orderDate.Month, orderDate.Day, 0, 0, 0, TimeSpan.Zero);
    var endOfDay   = startOfDay.AddDays(1);
    var count = await _context.Orders
        .IgnoreQueryFilters()
        .CountAsync(o => o.TenantId == tenantId && o.CreatedAt >= startOfDay && o.CreatedAt < endOfDay, cancellationToken);
    return count + 1;
}
```
([AppOrderRepository.cs:44-52](../../../NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Repositories/AppOrderRepository.cs))

`OrderNumber` là `string`, `MaxLength(50)`, unique index composite `(TenantId, OrderNumber)` ([OrderConfiguration.cs:27, 61-63](../../../NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Persistence/Configurations/OrderConfiguration.cs)) — index này vẫn hợp lệ với format mới vì `StoreCode` là tiền tố nằm trong chuỗi.

`CreateOrderCommandValidator` hiện chỉ kiểm tra `StoreId > 0`, **không** kiểm tra store có thực sự tồn tại.

Store module đã expose sẵn `IStoreService` (đăng ký DI global, gọi in-process — không HTTP) với method:

```csharp
Task<IReadOnlyList<StoreSummaryDto>> GetStoresByIdsAsync(
    IReadOnlyCollection<int>? storeIds, string? search, CancellationToken cancellationToken = default);
```

`StoreSummaryDto` có sẵn field `Code` (map từ `AppStore.Code`, `nvarchar(50)`, unique per `(TenantId, Code)`). Pattern gọi `IStoreService` từ Order module đã có tiền lệ ở `OrderScopeValidator` (dùng `GetByIdAsync`).

**Vấn đề với format hiện tại:**
1. Không chứa `StoreCode` → không phân biệt trực quan đơn của store nào trên hóa đơn in.
2. Sequence chia sẻ chung toàn tenant → 2 store cùng ngày cộng dồn vào 1 dãy số, không phải "số thứ tự riêng của từng cửa hàng" như nghiệp vụ POS mong đợi.
3. Không validate `StoreId` tồn tại trước khi tạo đơn.

---

## 2. Quyết định thiết kế (đã chốt)

| Điểm | Quyết định |
|---|---|
| Format | `{StoreCode}-{ddMMyy}-{sequence:D6}`, ví dụ `HCM01-010726-000123` |
| Padding sequence | 6 chữ số |
| Scope reset sequence | Per `(TenantId, StoreId, ngày)` — không còn per-tenant chung |
| Múi giờ tính `ddMMyy` và khoảng ngày | Giữ UTC như hiện tại (không đổi sang giờ VN) |
| Race condition (2 đơn cùng lúc cùng store) | Chấp nhận rủi ro thấp — không thêm bảng counter, không thêm unique-retry |
| Dữ liệu đơn cũ | Không backfill — chỉ áp dụng cho đơn tạo mới sau khi deploy |
| Lấy `StoreCode` | Gọi `IStoreService.GetStoresByIdsAsync(new[] { request.StoreId }, null, ct)` trong `CreateOrderCommandHandler` |

---

## 3. Thay đổi chi tiết

### 3.1. `IAppOrderRepository.GetNextOrderSequenceAsync` — thêm scope `storeId`

Đổi signature:

```csharp
Task<int> GetNextOrderSequenceAsync(Guid tenantId, int storeId, DateTimeOffset orderDate, CancellationToken cancellationToken = default);
```

`AppOrderRepository` implementation thêm điều kiện `o.StoreId == storeId` vào query count. Đây là method duy nhất dùng interface này ngoài `CreateOrderCommandHandler` (đã xác nhận qua grep — không có caller nào khác).

### 3.2. `CreateOrderCommandHandler.Handle()` — lookup Store + đổi công thức OrderNumber

Trước khi build `orderNumber`, gọi `IStoreService` (inject qua constructor, cùng pattern `OrderScopeValidator`):

```csharp
var stores = await _storeService.GetStoresByIdsAsync(new[] { request.StoreId }, null, cancellationToken);
var store = stores.FirstOrDefault();
if (store is null)
    return Result<CreateOrderResponse>.Failure(Error.NotFound($"Store '{request.StoreId}' was not found."));

var sequence    = await _orderRepository.GetNextOrderSequenceAsync(tenantId, request.StoreId, now, cancellationToken);
var orderNumber = $"{store.Code}-{now:ddMMyy}-{sequence:D6}";
```

Đây đồng thời bổ sung validate `StoreId` tồn tại (hiện đang thiếu) như một hệ quả tự nhiên của việc cần `StoreCode`.

### 3.3. Không đổi

- `OrderConfiguration` (index hiện có vẫn đúng).
- `CreateOrderCommandValidator` (giữ check `StoreId > 0`, existence check chuyển sang handler vì cần gọi async cross-module service).
- FE: không đổi gì, chỉ hiển thị `OrderNumber` trả về từ response như hiện tại.

---

## 4. Testing

- Unit test `CreateOrderCommandHandler`: mock `IStoreService` trả về `StoreSummaryDto { Code = "HCM01" }`, verify `OrderNumber` đúng format `HCM01-{ddMMyy}-000001`.
- Unit test case `StoreId` không tồn tại (`GetStoresByIdsAsync` trả list rỗng) → verify trả `NotFound`.
- Unit/integration test `AppOrderRepository.GetNextOrderSequenceAsync`: 2 store khác nhau cùng ngày → sequence độc lập, mỗi store bắt đầu từ 1.
