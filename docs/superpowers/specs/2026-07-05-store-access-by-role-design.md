# Store Access By Role — Design Spec

## Goal

Đảm bảo danh sách cửa hàng (trang "Cửa hàng" và trang "Bán hàng") và API tạo đơn hàng POS đều tuân theo đúng phạm vi truy cập (scope) của role hiện tại, thay vì dựa vào dropdown chọn thủ công hoặc không kiểm tra gì:

- `SuperAdmin`/`OrgAdmin`: thấy tất cả store trong tenant.
- `FranchiseeOwner`: chỉ thấy/tạo đơn được cho store thuộc franchisee của mình.
- `StoreManager`/`Cashier`/`OrderStaff`: chỉ thấy/tạo đơn được cho store mà user là thành viên (bảng `AppStoreUser`).
- `BrandManager`: giữ hành vi hiện tại (scope theo brand) — không mở rộng thêm trong spec này.

## Bối cảnh hiện trạng (đã khảo sát)

- `GetPagedStoresQueryHandler` (`NDTCore.Store.Application`) đã override `filter.FranchiseeId`/`filter.BrandId` cho role `FranchiseeOwner`/`BrandManager`, nhưng **chưa xử lý** `StoreManager`/`Cashier`/`OrderStaff` — các role này hiện thấy toàn bộ store trong tenant.
- `IAppStoreRepository.GetStoreIdsByUserIdAsync(userId)` đã tồn tại (join `AppStoreUser`) nhưng chưa được handler nào trong Store module gọi tới.
- `StoreFilterDto` chưa có field để giới hạn theo danh sách store cụ thể.
- `SalesView.vue` (trang "Bán hàng") không có dropdown filter — phụ thuộc hoàn toàn vào BE, nên đang bị lộ toàn bộ store cho `StoreManager`/`Cashier`/`OrderStaff`.
- `StoresView.vue` (trang "Cửa hàng") có 2 dropdown filter Brand + Franchisee, cho phép chọn thủ công — cần bỏ, để BE tự scope theo role.
- `OrderScopeValidator` (`NDTCore.Order.Application.Common`) đã tồn tại, dùng cho 4 handler (`GetPagedOrders`, `GetOrderById`, `UpdateOrderStatus`, `CancelOrder`) — hỗ trợ `SuperAdmin`/`OrgAdmin` (full), `BrandManager` (theo brand), `FranchiseeOwner` (theo franchisee). **Chưa hỗ trợ** `StoreManager`/`Cashier`/`OrderStaff`.
- `CreateOrderCommandHandler` (dùng chung cho `OrderController` và `PosController`) **không gọi** `OrderScopeValidator` — đây là lỗ hổng: bất kỳ user có role hợp lệ đều tạo được đơn cho `storeId` bất kỳ trong tenant, không cần thuộc store/franchisee đó.
- `PosController` thiếu `SystemRoles.OrderStaff` trong `[Authorize(Roles=...)]` ở cấp controller — dù role này đã được seed permission `Order.CreateOrder`, hiện không gọi được bất kỳ endpoint POS nào.

## Thiết kế

### 1. Store list scoping (BE) — dùng chung cho "Bán hàng" + "Cửa hàng"

**`StoreFilterDto`** (`NDTCore.Store.Contracts/Models/Stores/StoreFilterDto.cs`): thêm property mới, không bind từ query string của client (chỉ set nội bộ bởi handler):

```csharp
public IReadOnlyCollection<int>? StoreIds { get; set; }
```

**`AppStoreRepository.ApplyFilters`** (`NDTCore.Store.Infrastructure/Repositories/AppStoreRepository.cs`): thêm điều kiện lọc:

```csharp
if (filter.StoreIds is { Count: > 0 })
    query = query.Where(u => filter.StoreIds.Contains(u.Id));
```

**`GetPagedStoresQueryHandler`** (`NDTCore.Store.Application/Features/Stores/GetPagedStores/GetPagedStoresQueryHandler.cs`): thêm nhánh `else if` sau nhánh `BrandManager` hiện có:

```csharp
else if (roles.Contains(SystemRoles.StoreManager)
    || roles.Contains(SystemRoles.Cashier)
    || roles.Contains(SystemRoles.OrderStaff))
{
    var storeIds = await _storeRepository.GetStoreIdsByUserIdAsync(parsedUserId, cancellationToken);
    request.Filter.StoreIds = storeIds;
}
```

Cơ chế override giống hệt cách `FranchiseeId`/`BrandId` đã làm — ghi đè bất kỳ giá trị filter client gửi lên, không tin tưởng input từ client cho các role bị giới hạn scope.

### 2. Trang "Cửa hàng" (FE) — bỏ dropdown Brand/Franchisee ở filter

**`store-list.constants.ts`** (`buildStoreFilterFields`): bỏ 2 field `brandId`/`franchiseeId`, giữ `keyword`/`isActive`/`province`.

**`StoresView.vue`**:
- Bỏ tham số `brandOptions`/`filterFranchiseeOptions` khi gọi `buildStoreFilterFields` (đổi hàm còn 0 param hoặc bỏ 2 param không dùng).
- Bỏ `watch` trên `activeFilters['brandId']` (chỉ tồn tại để đồng bộ dropdown filter, nay không còn dropdown filter).
- Bỏ `allFranchiseeOptions`, `filterFranchiseeOptions`, và lệnh `getPagedFranchisees({PageNumber:1, PageSize:200})` preload trong `onMounted` (chỉ dùng cho dropdown filter đã bỏ).
- **Giữ nguyên** `brandOptions`, `formFranchiseeOptions`, `onFormBrandChange` — vì đây là dropdown của **form tạo store** (`StoreForm`), không phải filter, không thuộc phạm vi thay đổi.
- Bỏ `BrandId`/`FranchiseeId` khỏi payload gửi trong `fetchStores` (không còn nguồn để đọc từ `params.filters`).

Kết quả: SuperAdmin/OrgAdmin thấy toàn bộ store (không filter theo brand/franchisee nữa); FranchiseeOwner tự động chỉ thấy store của mình (nhờ mục 1, đã hoạt động từ trước); StoreManager/Cashier/OrderStaff không truy cập trang này (route đã giới hạn role trước đó, ngoài phạm vi spec này).

### 3. POS — Order creation authorization

**`OrderScopeValidator.ValidateAsync`** (`NDTCore.Order.Application/Common/OrderScopeValidator.cs`): tái cấu trúc để thêm nhánh store-staff, không đổi hành vi của 4 handler đang dùng validator này cho `BrandManager`/`FranchiseeOwner`/`SuperAdmin`/`OrgAdmin`:

```csharp
var isBrandManager = roles.Contains(SystemRoles.BrandManager);
var isFranchiseeOwner = roles.Contains(SystemRoles.FranchiseeOwner);
var isStoreStaff = roles.Contains(SystemRoles.StoreManager)
    || roles.Contains(SystemRoles.Cashier)
    || roles.Contains(SystemRoles.OrderStaff);

if (!isBrandManager && !isFranchiseeOwner && !isStoreStaff)
    return Error.Forbidden("Role is not permitted to access orders.");

if (storeId is null)
    return Error.Forbidden("StoreId is required for your role.");

if (isStoreStaff)
{
    var storeIds = await storeService.GetStoreIdsByUserIdAsync(userId, cancellationToken);
    return storeIds.Contains(storeId.Value)
        ? null
        : Error.Forbidden("Order does not belong to your store.");
}

var store = await storeService.GetByIdAsync(storeId.Value, cancellationToken);
if (store is null)
    return Error.NotFound($"Store '{storeId}' was not found.");

// ...existing isBrandManager / franchisee checks giữ nguyên
```

**`CreateOrderCommandHandler`** (`NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommandHandler.cs`):
- Inject thêm `IBrandService`, `IFranchiseeService` (interface đã có sẵn, chỉ thêm vào constructor).
- Gọi `OrderScopeValidator.ValidateAsync(...)` với `request.StoreId` **trước** khi xử lý tạo đơn; nếu trả về `Error` khác `null` → return `Result<CreateOrderResponse>.Failure(error)`.

**`PosController`** (`NDTCore.API/Controllers/Modules/Pos/PosController.cs`): thêm `SystemRoles.OrderStaff` vào `[Authorize(Roles=...)]` ở cấp controller (dòng 21) — áp dụng cho toàn bộ endpoint POS (store status, catalog, create order, get order, order history), khớp với permission `Order.CreateOrder` đã seed cho role này.

## Ngoài phạm vi (đã xác nhận với user)

- Không gộp role `Cashier`/`OrderStaff` thành một.
- Không xử lý `BrandAccountant` trong store/order scoping.
- Không refactor `StoreScopeResolver` (Report module) — giữ nguyên, dù có logic tương tự (không mở rộng phạm vi spec).
- Không đổi hành vi của `GetPagedOrders`/`GetOrderById`/`UpdateOrderStatus`/`CancelOrder` cho `BrandManager`/`FranchiseeOwner`/`SuperAdmin`/`OrgAdmin` (đường đi cũ giữ nguyên, chỉ thêm nhánh mới bên cạnh).

## Kiểm thử

- BE: build solution; test thủ công/`dotnet test` (nếu có) cho `GetPagedStoresQueryHandler`, `OrderScopeValidator`, `CreateOrderCommandHandler` với các role: SuperAdmin, FranchiseeOwner (store trong/ngoài franchisee), Cashier/StoreManager/OrderStaff (store trong/ngoài `AppStoreUser`).
- FE: `npx vue-tsc --build`; kiểm tra trực quan trang "Cửa hàng" (dropdown biến mất, filter còn lại hoạt động, form tạo store vẫn chọn được brand/franchisee) và trang "Bán hàng" (danh sách store đúng theo role đăng nhập).
