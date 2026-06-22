# Order Management Admin Page — Design

**Goal:** Thêm trang quản lý đơn hàng (brand-level admin), độc lập với POS, cho phép BrandManager+ xem toàn bộ đơn hàng của tất cả store trong 1 brand, filter/tìm kiếm, xem chi tiết, đổi trạng thái và hủy đơn.

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

---

## 2. Phạm vi (đã chốt qua brainstorming)

- Trang mới, brand-admin level, vai trò `BrandManager`/`FranchiseeOwner`/`OrgAdmin`/`SuperAdmin`.
- Xem đơn của **tất cả store trong 1 brand** (không chỉ 1 store).
- 4 tính năng: danh sách + filter/phân trang, xem chi tiết, đổi trạng thái, hủy đơn.
- Trang chi tiết là **route riêng** (`/orders/:id`), không phải dialog.
- Action đổi trạng thái/hủy đơn **chỉ nằm trong trang chi tiết**, không có trên list.
- Mặc định khi vào trang: lọc theo **hôm nay**.
- Module FE mới `src/modules/order/`, tách biệt với `pos/`.

---

## 3. BE — thay đổi

### B1. Mở rộng filter store theo brand

`OrderFilterDto.cs` (`NDTCore.Order.Contracts/Models/Orders/OrderFilterDto.cs`):

```diff
- public int? StoreId { get; set; }
+ public int[]? StoreIds { get; set; }
```

`AppOrderRepository.ApplyFilters()`:

```diff
- if (filter.StoreId.HasValue)
-     query = query.Where(o => o.StoreId == filter.StoreId.Value);
+ if (filter.StoreIds is { Length: > 0 })
+     query = query.Where(o => filter.StoreIds.Contains(o.StoreId));
```

`[FromQuery]` model binding tự nhận `?StoreIds=1&StoreIds=2` từ query string — không đổi action signature của `GetPagedOrders`.

Lý do chọn cách này thay vì thêm `BrandId` denormalize vào `Order` entity: Order chỉ lưu `StoreId`/`TenantId`, không có khái niệm Brand ở entity level; FE đã có sẵn API lấy `StoreId[]` theo `BrandId` (qua `getPagedStores({ BrandId })`), nên không cần migration hay đổi entity.

### B2. Role-gate `OrderController`

```diff
- [Authorize]
+ [Authorize(Roles = SystemRoles.BrandManager + "," + SystemRoles.FranchiseeOwner + "," + SystemRoles.OrgAdmin + "," + SystemRoles.SuperAdmin)]
public class OrderController : AdminControllerBase
```

Theo đúng pattern đã dùng ở `PosController.cs:20`. Class-level nên áp dụng cho cả 4 action.

### Không đổi

`UpdateOrderStatus`, `CancelOrder`, `GetOrderById` giữ nguyên — state machine và validation hiện tại đã đáp ứng đủ nhu cầu.

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

Dùng `useListPage` composable (giống `StoresView.vue`), `fetchFn` gọi `orderService.getPagedOrdersAsync(filter)`.

**Filter bar:**
- Dropdown **Brand** — khi đổi, gọi `useStore().getPagedStores({ BrandId })` để resolve danh sách `StoreId` thuộc brand, gán vào `filters.storeIds` (nội bộ, không hiển thị riêng list ID cho user)
- Dropdown **Store** (phụ, phụ thuộc Brand đã chọn) — lọc tiếp 1 store cụ thể
- Dropdown **Status**, Date range **FromDate/ToDate** (mặc định = hôm nay), text field **Keyword**

**Bảng:** OrderNumber, Store (tên), Status (chip màu), Channel, CustomerName/Phone, TotalAmount, CreatedAt. Click dòng → `router.push({ name: 'admin:order-detail', params: { id } })`.

Không có action đổi status/hủy trên dòng list.

### 4.3. `OrderDetailView.vue` — chi tiết

Gọi `GetOrderById`, hiển thị đầy đủ: header (OrderNumber, Status chip, Store, Channel, ServiceType), khách hàng, OrderItems + Options, tổng tiền (Subtotal/DiscountAmount/TaxAmount/DeliveryFee/TotalAmount), thanh toán (PaymentMethod/PaymentStatus/AmountReceived/ChangeAmount/PaidAt), DeliveryAddress (nếu Delivery), thông tin hủy (nếu có).

**Action đổi trạng thái:**
- Nút hiện theo status hiện tại: Pending → nút "Xác nhận đơn"; Confirmed → nút "Hoàn tất"; Completed/Cancelled → không có nút chuyển status
- Nút "Hủy đơn" hiện khi Status ∈ {Pending, Confirmed} → dialog confirm, nhập `CancelledReason` (optional, ≤500 ký tự) → gọi `CancelOrder`
- Sau khi thành công: gọi lại `GetOrderById` để refresh, hiển thị snackbar
- Lỗi từ BE (vd. transition không hợp lệ vì đơn đã đổi bởi người khác): snackbar lỗi + refresh để đồng bộ trạng thái mới nhất

---

## 5. Testing / Verification

Codebase không có test suite cho Order module hoặc admin FE pages — verification qua:
- BE: `dotnet build NDTCore.sln` phải pass
- FE: `npm run type-check` phải pass
- Manual: đăng nhập với role BrandManager → vào trang Orders → đổi Brand filter → xác nhận chỉ thấy đơn của store thuộc brand đó → click 1 đơn → xác nhận đơn / hủy đơn → xác nhận status cập nhật đúng theo state machine; đăng nhập với role không đủ quyền (vd. Cashier) → xác nhận bị chặn truy cập route.

---

## 6. Self-Review

- **Placeholder scan:** không có TBD/TODO.
- **Consistency:** field `StoreIds` (FE) ↔ `OrderFilterDto.StoreIds` (BE) khớp tên; route names theo đúng convention `admin:<module>` / `admin:<module>-detail` đã dùng cho Products/Stores.
- **Scope:** vừa đủ cho 1 implementation plan — không gộp thêm tính năng ngoài 4 đã chốt (không có bulk action, không có export, không có realtime update).
