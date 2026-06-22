# Order Management Admin Page — Design

**Goal:** Thêm trang quản lý đơn hàng (brand-level admin), độc lập với POS, cho phép BrandManager/FranchiseeOwner/OrgAdmin/SuperAdmin xem đơn hàng của 1 store cụ thể (chọn qua Brand/Store dropdown theo đúng phạm vi được phân quyền), filter/tìm kiếm, xem chi tiết, đổi trạng thái và hủy đơn.

**Tech Stack:** Vue 3 (Composition API) + TypeScript + Vuetify 3 + Pinia (FE); .NET 8 + EF Core 8 + MediatR (BE).

---

## 1. Bối cảnh hiện tại

BE module `NDTCore.Order` đã có đầy đủ CQRS cho order management:
- `CreateOrder`, `GetOrderById`, `GetPagedOrders`, `UpdateOrderStatus`, `CancelOrder`, `GetPosOrderHistory`

Endpoint REST tại `OrderController` (`NDTCore.API/Controllers/Modules/Order/Admin/OrderController.cs`), route prefix thật là `api/admin/orders` (kế thừa từ `AdminControllerBase`):

| Action | Verb | Route |
|---|---|---|
| GetPagedOrders | GET | `api/admin/orders` |
| GetOrderById | GET | `api/admin/orders/{id}` |
| UpdateOrderStatus | PATCH | `api/admin/orders/{id}/status` |
| CancelOrder | POST | `api/admin/orders/{id}/cancel` |

`OrderStatus` là state machine tuyến tính: `Pending → Confirmed → Completed`, không lùi; `Cancelled` chỉ từ `Pending`/`Confirmed`.

**Vấn đề:** FE chưa có module/trang nào tiêu thụ 4 endpoint admin này — toàn bộ order UI hiện chỉ nằm trong POS (`PosOrderHistoryDrawer.vue`, chỉ xem đơn hôm nay của 1 store, không đổi status/hủy được từ UI).

### 1.1. Cơ chế xác định phạm vi user hiện có (tái dùng, không tạo mới)

Đã khảo sát và xác nhận pattern scoping hiện có ở `GetPagedStoresQueryHandler` (`NDTCore.Store.Application/Features/Stores/GetPagedStores/GetPagedStoresQueryHandler.cs:50-68`):

```csharp
var roles = _ndtContextAccessor.Context?.Roles ?? [];
if (roles.Contains(SystemRoles.FranchiseeOwner))
{
    var franchisee = await _franchiseeService.GetFranchiseeByUserIdAsync(parsedUserId, cancellationToken);
    // ... Unauthorized nếu null
    request.Filter.FranchiseeId = franchisee.Id; // ép filter, bỏ qua giá trị FE gửi
}
```

- `FranchiseeOwner` được scope theo **FranchiseeId** (không phải BrandId) — chỉ thấy store thuộc franchisee của mình. Resolve qua `IFranchiseeService.GetFranchiseeByUserIdAsync(userId)` (đã có), dựa trên bảng `AppFranchiseeUser` (UserId ↔ FranchiseeId) → `AppFranchisee.BrandId`.
- `BrandManager` **chưa được scope ở đâu cả** — đây là phần thiếu cần bổ sung. Bảng `AppBrandUser` (UserId ↔ BrandId, `NDTCore.Brand.Domain/Entities/AppBrandUser.cs`) đã tồn tại nhưng `IBrandService` (`NDTCore.Brand.Contracts/Interfaces/Services/IBrandService.cs`) chưa có method tương đương `GetFranchiseeByUserIdAsync`.
- `SuperAdmin`/`OrgAdmin` không bị scope — filter theo lựa chọn tự do của user.

**Quyết định phạm vi (đã chốt qua brainstorming, sửa lần 2):**

- Mỗi lần xem chỉ xem đơn của **1 store cụ thể** (không phải gộp nhiều store/toàn brand cùng lúc) — `OrderFilterDto.StoreId` giữ nguyên `int?`, **không đổi thành array**.
- **SuperAdmin/OrgAdmin**: chọn Brand (dropdown, mọi brand) → chọn Store (dropdown, các store thuộc brand đã chọn).
- **BrandManager**: brand cố định theo `AppBrandUser` — **không hiện Brand dropdown**, chỉ hiện Store dropdown (mọi store trong brand cố định đó).
- **FranchiseeOwner**: brand/franchisee cố định theo `AppFranchiseeUser` — **không hiện Brand dropdown**, chỉ hiện Store dropdown (chỉ store thuộc franchisee của họ — nhất quán với `GetPagedStoresQueryHandler` hiện có, **không phải toàn brand**).
- Dropdown Brand: chỉ render khi role hiện tại ∈ {SuperAdmin, OrgAdmin}.

---

## 2. Phạm vi tổng thể

- Trang mới, brand-admin level, vai trò `BrandManager`/`FranchiseeOwner`/`OrgAdmin`/`SuperAdmin`.
- 4 tính năng: danh sách + filter/phân trang (theo 1 store đã chọn), xem chi tiết, đổi trạng thái, hủy đơn.
- Trang chi tiết là **route riêng** (`/orders/:id`), không phải dialog.
- Action đổi trạng thái/hủy đơn **chỉ nằm trong trang chi tiết**, không có trên list.
- Mặc định khi vào trang: lọc theo **hôm nay**.
- Module FE mới `src/modules/order/`, tách biệt với `pos/`.

---

## 3. BE — thay đổi

### B1. Thêm `IBrandService.GetBrandByUserIdAsync` (mirror pattern Franchisee)

`NDTCore.Brand.Contracts/Interfaces/Services/IBrandService.cs`:

```diff
public interface IBrandService
{
    Task<BrandDto?> GetByIdAsync(int brandId, CancellationToken cancellationToken = default);
    Task<List<BrandMemberDto>> GetBrandMembersAsync(int brandId, CancellationToken cancellationToken = default);
+
+   /// <summary>
+   /// VN: Lấy brand mà user là thành viên (qua AppBrandUser). <br />
+   /// EN: Returns the brand the user belongs to via AppBrandUser.
+   /// </summary>
+   Task<BrandDto?> GetBrandByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
```

Implementation truy `AppBrandUser` theo `UserId`, trả `AppBrand` tương ứng (map sang `BrandDto`) — viết tương tự cách `IFranchiseeService.GetFranchiseeByUserIdAsync` đang truy `AppFranchiseeUser`.

### B2. Thêm `IStoreService.GetByIdAsync` trong `NDTCore.Store.Contracts` (mới — chưa tồn tại)

Hiện không có service cross-module nào để lấy 1 store theo Id (chỉ có `IAppStoreRepository` ở Infrastructure, không expose qua Contracts cho module khác dùng). Cần thêm:

```csharp
// NDTCore.Store.Contracts/Interfaces/Services/IStoreService.cs
public interface IStoreService
{
    /// <summary>
    /// VN: Lấy thông tin tối thiểu của 1 store theo Id (Id, BrandId, FranchiseeId) để module khác dùng kiểm tra phạm vi. <br />
    /// EN: Returns minimal store info (Id, BrandId, FranchiseeId) by Id, for cross-module scope validation.
    /// </summary>
    Task<StoreScopeDto?> GetByIdAsync(int storeId, CancellationToken cancellationToken = default);
}

public sealed class StoreScopeDto
{
    public int Id { get; init; }
    public int BrandId { get; init; }
    public int? FranchiseeId { get; init; }
}
```

`FranchiseeId` phải là `int?` — đúng theo `AppStore.FranchiseeId` (`null` nghĩa là store trực thuộc brand, không qua franchisee nào). Đây là service mới, nhỏ, theo đúng pattern `IBrandService`/`IFranchiseeService` đã có ở Brand module — không lộ DbContext, không phá nguyên tắc layer.

### B3. `OrderController` — role-gate

```diff
- [Authorize]
+ [Authorize(Roles = SystemRoles.BrandManager + "," + SystemRoles.FranchiseeOwner + "," + SystemRoles.OrgAdmin + "," + SystemRoles.SuperAdmin)]
public class OrderController : AdminControllerBase
```

Theo đúng pattern đã dùng ở `PosController.cs:20`. Class-level nên áp dụng cho cả 4 action.

### B4. `GetPagedOrdersQueryHandler` — validate phạm vi store theo role

Thêm dependency `IBrandService`, `IFranchiseeService` (Brand.Contracts), `IStoreService` (Store.Contracts) vào `NDTCore.Order.Application` (cần thêm `ProjectReference` mới tới `NDTCore.Brand.Contracts` và `NDTCore.Store.Contracts` — **hiện Order.Application chưa reference 2 project này**).

Logic (mirror `GetPagedStoresQueryHandler`, nhưng validate `StoreId` đơn lẻ thay vì set `FranchiseeId`):

```csharp
var roles = _ndtContextAccessor.Context?.Roles ?? [];

if (roles.Contains(SystemRoles.SuperAdmin) || roles.Contains(SystemRoles.OrgAdmin))
{
    // Không giới hạn — StoreId từ request giữ nguyên (có thể null nếu FE chưa chọn store)
}
else if (roles.Contains(SystemRoles.BrandManager))
{
    var brand = await _brandService.GetBrandByUserIdAsync(parsedUserId, cancellationToken);
    if (brand == null) return Result<...>.Failure(ErrorCodes.Auth.Unauthorized, "No brand found for the user.");

    if (request.Filter.StoreId.HasValue)
    {
        var store = await _storeService.GetByIdAsync(request.Filter.StoreId.Value, cancellationToken);
        if (store == null || store.BrandId != brand.Id)
            return Result<...>.Failure(ErrorCodes.Auth.Forbidden, "Store does not belong to your brand.");
    }
}
else if (roles.Contains(SystemRoles.FranchiseeOwner))
{
    var franchisee = await _franchiseeService.GetFranchiseeByUserIdAsync(parsedUserId, cancellationToken);
    if (franchisee == null) return Result<...>.Failure(ErrorCodes.Auth.Unauthorized, "No franchisee found for the user.");

    if (request.Filter.StoreId.HasValue)
    {
        var store = await _storeService.GetByIdAsync(request.Filter.StoreId.Value, cancellationToken);
        if (store == null || store.FranchiseeId != franchisee.Id)
            return Result<...>.Failure(ErrorCodes.Auth.Forbidden, "Store does not belong to your franchisee.");
    }
}
```

`store.FranchiseeId` là `int?`. Khi store trực thuộc brand (`store.FranchiseeId == null`), so sánh `null != franchisee.Id` luôn `true` → bị chặn đúng như mong đợi: FranchiseeOwner chỉ xem được store thuộc franchisee của họ, **không** xem được store brand-direct (kể cả cùng brand) — đúng theo quyết định "Chỉ store thuộc franchisee của họ (giống Store module hiện tại)". Không cần xử lý nullable đặc biệt gì thêm, C# so sánh `int? != int` hoạt động đúng ý.

Tương tự cần thêm validate này vào `GetOrderByIdQueryHandler`, `UpdateOrderStatusCommandHandler`, `CancelOrderCommandHandler` — vì user có thể truyền `id` của 1 order bất kỳ qua route `{id}`, không qua filter, nên phải kiểm tra `order.StoreId` thuộc phạm vi mới cho phép đọc/sửa (tránh BrandManager A xem/sửa được đơn của brand B bằng cách đoán Id).

### B5. (Tiện thể vá lỗ hổng có sẵn) `GetPagedStoresQueryHandler` — thêm scope cho BrandManager

Hiện handler này chỉ scope `FranchiseeOwner`, chưa scope `BrandManager` (BrandManager hiện gọi `GetPagedStores` sẽ thấy **tất cả** store mọi brand — lỗ hổng có từ trước, không phải do feature này tạo ra, nhưng ảnh hưởng trực tiếp tới việc populate Store dropdown ở trang Order Management). Thêm nhánh:

```csharp
else if (roles.Contains(SystemRoles.BrandManager))
{
    var brand = await _brandService.GetBrandByUserIdAsync(parsedUserId, cancellationToken);
    if (brand == null) return Result<...>.Failure(ErrorCodes.Auth.Unauthorized, "No brand found for the user.");
    request.Filter.BrandId = brand.Id;
}
```

`GetPagedStoresQueryHandler` đã có `IBrandService` chưa? Cần kiểm tra lúc viết code — nếu chưa, thêm constructor param (project Store.Application đã reference Brand.Contracts sẵn, vì đang dùng `IFranchiseeService`).

### Không đổi

`UpdateOrderStatus`, `CancelOrder` giữ nguyên state machine/validation hiện tại — chỉ thêm bước validate phạm vi store ở B4.

---

## 4. FE — module mới `src/modules/order/`

Cấu trúc theo chuẩn module hiện có (tham chiếu `product/`, `store/`):

```
order/
├── api/                    # order.api.ts — raw HTTP calls
├── composables/            # useOrder.ts
├── constants/              # status labels, filter field configs
├── models/dtos/            # OrderListItemDto, OrderDetailDto, OrderFilterDto (FE-side)
└── views/
    ├── OrdersView.vue       # danh sách
    └── OrderDetailView.vue  # chi tiết
```

### 4.1. Route & quyền

`app-routes.constants.ts`: thêm `APP_ROUTES.ORDER.ORDERS` (`path: 'orders'`, `name: 'admin:orders'`) và `APP_ROUTES.ORDER.ORDER_DETAIL` (`path: 'orders/:id'`, `name: 'admin:order-detail'`).

`router/types.ts`: `RouteMeta` hiện chỉ có `requiresAuth`, chưa có khái niệm role — cần thêm field mới:

```diff
interface RouteMeta {
    layout?: LayoutType
    title?: string
    requiresAuth?: boolean
+   roles?: string[]
    breadcrumbs?: BreadcrumbItem[]
}
```

`router/index.ts` guard: bổ sung kiểm tra `to.meta.roles` so với role hiện tại trong `authStore` (theo cùng cơ chế `isLoggedIn` đang có) — nếu không khớp, redirect về trang chủ/403.

Route mới khai báo:

```ts
{
    path: APP_ROUTES.ORDER.ORDERS.PATH,
    name: APP_ROUTES.ORDER.ORDERS.NAME,
    component: () => import('@/modules/order/views/OrdersView.vue'),
    meta: { title: 'Quản lý đơn hàng', requiresAuth: true, roles: [BRAND_MANAGER, FRANCHISEE_OWNER, ORG_ADMIN, SUPER_ADMIN] },
},
{
    path: APP_ROUTES.ORDER.ORDER_DETAIL.PATH,
    name: APP_ROUTES.ORDER.ORDER_DETAIL.NAME,
    component: () => import('@/modules/order/views/OrderDetailView.vue'),
    meta: { title: 'Chi tiết đơn hàng', requiresAuth: true, roles: [BRAND_MANAGER, FRANCHISEE_OWNER, ORG_ADMIN, SUPER_ADMIN] },
},
```

### 4.2. `OrdersView.vue` — danh sách

Dùng `useListPage` composable (giống `StoresView.vue`), `fetchFn` gọi `orderService.getPagedOrdersAsync(filter)` với `filter.StoreId` (đơn, không phải array).

**Filter bar:**

- Dropdown **Brand** — chỉ render khi `authStore.roles` chứa `SuperAdmin`/`OrgAdmin`. Khi đổi, load lại Store dropdown theo Brand đã chọn (gọi `useStore().getPagedStores({ BrandId })`).
- Dropdown **Store** — luôn render, **bắt buộc chọn 1 store** trước khi bảng có dữ liệu:
  - SuperAdmin/OrgAdmin: options = store thuộc Brand đã chọn ở trên.
  - BrandManager/FranchiseeOwner: không cần chọn Brand trước — gọi `getPagedStores({})` không kèm BrandId/FranchiseeId, để BE tự scope theo role (B5/khoản đã có) và trả về đúng danh sách store được phép.
- Dropdown **Status**, Date range **FromDate/ToDate** (mặc định = hôm nay), text field **Keyword**.

**Bảng:** OrderNumber, Status (chip màu), Channel, CustomerName/Phone, TotalAmount, CreatedAt — bỏ cột Store (vì đã filter theo 1 store, không cần lặp lại). Click dòng → `router.push({ name: 'admin:order-detail', params: { id } })`.

Không có action đổi status/hủy trên dòng list.

### 4.3. `OrderDetailView.vue` — chi tiết

Gọi `GetOrderById`, hiển thị đầy đủ: header (OrderNumber, Status chip, Store, Channel, ServiceType), khách hàng, OrderItems + Options, tổng tiền (Subtotal/DiscountAmount/TaxAmount/DeliveryFee/TotalAmount), thanh toán (PaymentMethod/PaymentStatus/AmountReceived/ChangeAmount/PaidAt), DeliveryAddress (nếu Delivery), thông tin hủy (nếu có).

**Action đổi trạng thái:**
- Nút hiện theo status hiện tại: Pending → nút "Xác nhận đơn"; Confirmed → nút "Hoàn tất"; Completed/Cancelled → không có nút chuyển status
- Nút "Hủy đơn" hiện khi Status ∈ {Pending, Confirmed} → dialog confirm, nhập `CancelledReason` (optional, ≤500 ký tự) → gọi `CancelOrder`
- Sau khi thành công: gọi lại `GetOrderById` để refresh, hiển thị snackbar
- Lỗi từ BE (vd. transition không hợp lệ vì đơn đã đổi bởi người khác, hoặc 403 do order không thuộc phạm vi — không nên xảy ra qua UI bình thường nhưng BE vẫn chặn ở B4): snackbar lỗi + refresh để đồng bộ trạng thái mới nhất

---

## 5. Testing / Verification

Codebase không có test suite cho Order module hoặc admin FE pages — verification qua:
- BE: `dotnet build NDTCore.sln` phải pass
- FE: `npm run type-check` phải pass
- Manual:
  - Đăng nhập BrandManager → vào trang Orders → không thấy Brand dropdown → Store dropdown chỉ liệt kê store thuộc brand của họ → chọn 1 store → xem list/chi tiết/đổi status/hủy đơn hoạt động đúng.
  - Đăng nhập FranchiseeOwner → Store dropdown chỉ liệt kê store thuộc franchisee của họ (ít hơn BrandManager nếu brand có nhiều franchisee).
  - Đăng nhập SuperAdmin/OrgAdmin → thấy Brand dropdown, đổi Brand → Store dropdown load lại theo brand mới.
  - Thử gọi trực tiếp API với `id`/`StoreId` ngoài phạm vi (vd. BrandManager brand A truyền StoreId thuộc brand B) → xác nhận BE trả lỗi 403/Forbidden, không trả dữ liệu.
  - Đăng nhập role không đủ quyền (vd. Cashier) → xác nhận bị chặn truy cập route.

---

## 6. Self-Review

- **Placeholder scan:** không có TBD/TODO.
- **Consistency:** `OrderFilterDto.StoreId` giữ `int?` (đã sửa lại từ bản trước, không đổi thành array); route names theo đúng convention `admin:<module>` / `admin:<module>-detail` đã dùng cho Products/Stores.
- **Cross-module dependency mới:** `NDTCore.Order.Application` → `NDTCore.Brand.Contracts` + `NDTCore.Store.Contracts` (ProjectReference mới); `NDTCore.Store.Contracts` có thêm `IStoreService` (chưa tồn tại — cần tạo); `IBrandService` có thêm method `GetBrandByUserIdAsync` (chưa tồn tại — cần tạo). Đây là phần việc BE lớn hơn ước tính ban đầu (ban đầu nghĩ chỉ sửa `OrderFilterDto`), cần phản ánh đúng trong implementation plan.
- **Lỗ hổng có sẵn được vá kèm (B5):** `GetPagedStoresQueryHandler` thiếu scope cho `BrandManager` — vá trong cùng plan vì ảnh hưởng trực tiếp tới việc populate Store dropdown của tính năng này.
- **Scope:** vừa đủ cho 1 implementation plan — không gộp thêm tính năng ngoài 4 đã chốt (không có bulk action, không có export, không có realtime update).
