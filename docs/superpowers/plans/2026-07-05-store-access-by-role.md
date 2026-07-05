# Store Access By Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Danh sách store (trang "Cửa hàng" + trang "Bán hàng") và API tạo đơn POS đều tuân theo đúng phạm vi truy cập của role hiện tại: `SuperAdmin`/`OrgAdmin` thấy/tạo đơn cho tất cả store; `FranchiseeOwner` chỉ thấy/tạo đơn cho store thuộc franchisee của mình; `StoreManager`/`Cashier`/`OrderStaff` chỉ thấy/tạo đơn cho store mà họ là thành viên (`AppStoreUser`).

**Architecture:** BE trước — mở rộng cơ chế scope-by-role đã có sẵn một phần (`GetPagedStoresQueryHandler` đã override `FranchiseeId`/`BrandId`; `OrderScopeValidator` đã hỗ trợ `BrandManager`/`FranchiseeOwner`) để thêm nhánh còn thiếu cho `StoreManager`/`Cashier`/`OrderStaff`, dùng lại hạ tầng có sẵn (`GetStoreIdsByUserIdAsync` join `AppStoreUser`) — không tạo abstraction mới. Sau đó gọi `OrderScopeValidator` từ `CreateOrderCommandHandler` (hiện chưa gọi — đây là lỗ hổng chính). Cuối cùng bỏ 2 dropdown filter Brand/Franchisee ở FE (trang "Cửa hàng") vì BE giờ tự scope đúng theo role.

**Tech Stack:** .NET 8 + EF Core (BE, CQRS/MediatR) — Vue 3 (Composition API) + TypeScript strict + Vuetify 3 (FE).

## Global Constraints

- BE: XML doc bắt buộc song ngữ VN/EN cho mọi class/interface/method/property mới, kể cả private.
- BE: Trước khi commit, `dotnet build NDTCore.sln` phải sạch (0 Error).
- FE: TypeScript strict, không dùng `any`.
- FE: Trước khi commit, `npx vue-tsc --build` phải sạch (exit code 0).
- Không gộp role `Cashier`/`OrderStaff` thành một — cả hai giữ nguyên, xử lý giống nhau chỉ trong phạm vi store-access-scope.
- Không xử lý `BrandAccountant` trong scope này.
- Không refactor `StoreScopeResolver` (Report module) — có logic tương tự nhưng ngoài phạm vi, giữ nguyên.
- Không đổi hành vi hiện tại của `GetPagedOrders`/`GetOrderById`/`UpdateOrderStatus`/`CancelOrder` cho `BrandManager`/`FranchiseeOwner`/`SuperAdmin`/`OrgAdmin` — chỉ thêm nhánh mới bên cạnh cho store-staff.
- `StoreFilterDto.StoreIds` không được client set qua query string (`[BindNever]`) — chỉ handler gán nội bộ.
- Filter theo `StoreIds` phải dùng `is not null` (không phải `Count: > 0`) — list rỗng vẫn phải áp dụng filter (trả về 0 kết quả), không được coi là "không giới hạn".

---

### Task 1: BE — Store list scoping cho StoreManager/Cashier/OrderStaff

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/Models/Stores/StoreFilterDto.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/Repositories/AppStoreRepository.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/GetPagedStores/GetPagedStoresQueryHandler.cs`

**Interfaces:**
- Produces: `StoreFilterDto.StoreIds` (`IReadOnlyCollection<int>?`, `[BindNever]`) — set nội bộ bởi `GetPagedStoresQueryHandler`, đọc bởi `AppStoreRepository.ApplyFilters`.
- Consumes: `IAppStoreRepository.GetStoreIdsByUserIdAsync(Guid userId, CancellationToken)` (đã có sẵn, không đổi signature).
- Không đổi bất kỳ interface public nào khác — `IAppStoreRepository`/`IStoreService` giữ nguyên signature.

- [ ] **Step 1: Thêm `StoreIds` vào `StoreFilterDto`**

`Store.Contracts` không target `Microsoft.NET.Sdk.Web` và không có `FrameworkReference` tới `Microsoft.AspNetCore.App`, nên **không dùng** `[BindNever]` (`Microsoft.AspNetCore.Mvc.ModelBinding`) — type này không chắc available, và không có tiền lệ nào trong codebase dùng attribute đó. Thay vào đó, property vẫn `public` bình thường nhưng an toàn nhờ 2 lý do: (1) handler luôn ghi đè `StoreIds` cho role bị giới hạn scope trước khi gọi repository (giống hệt cách `FranchiseeId`/`BrandId` đã làm), (2) `ApplyFilters` kết hợp các điều kiện bằng AND nên dù client có tự gửi `StoreIds` qua query, kết quả chỉ bị thu hẹp thêm chứ không mở rộng quyền truy cập.

Thay toàn bộ nội dung `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/Models/Stores/StoreFilterDto.cs`:

```csharp
using NDTCore.BuildingBlocks.Abstractions.Requests;

namespace NDTCore.Store.Contracts.Models.Stores;

public sealed class StoreFilterDto : PagedRequest
{
    public int? BrandId { get; set; }
    public int? FranchiseeId { get; set; }
    public bool? IsActive { get; set; }
    public string? Province { get; set; }
    public string? District { get; set; }

    /// <summary>
    /// VN: Danh sách ID store được phép xem — chỉ gán nội bộ bởi handler theo scope của role hiện tại
    /// (StoreManager/Cashier/OrderStaff). Không nên set giá trị này từ client; handler luôn ghi đè
    /// trước khi truy vấn nên giá trị client gửi lên (nếu có) không ảnh hưởng đến phạm vi truy cập. <br />
    /// EN: List of store IDs the current user may view — set internally by the handler based on the
    /// current role's scope (StoreManager/Cashier/OrderStaff). Should not be set by the client; the
    /// handler always overwrites it before querying, so any client-supplied value has no effect on scope.
    /// </summary>
    public IReadOnlyCollection<int>? StoreIds { get; set; }
}
```

- [ ] **Step 2: Áp dụng filter `StoreIds` trong `AppStoreRepository.ApplyFilters`**

Trong `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/Repositories/AppStoreRepository.cs`, tìm:

```csharp
        if (filter.FranchiseeId.HasValue)
            query = query.Where(u => u.FranchiseeId == filter.FranchiseeId.Value);

        if (filter.IsActive.HasValue)
```

Thay bằng:

```csharp
        if (filter.FranchiseeId.HasValue)
            query = query.Where(u => u.FranchiseeId == filter.FranchiseeId.Value);

        if (filter.StoreIds is not null)
            query = query.Where(u => filter.StoreIds.Contains(u.Id));

        if (filter.IsActive.HasValue)
```

**Lưu ý bắt buộc**: dùng `is not null`, KHÔNG dùng `is { Count: > 0 }` — nếu dùng `Count: > 0`, một user chưa được gán store nào (`GetStoreIdsByUserIdAsync` trả về list rỗng) sẽ bị coi như "không giới hạn" và thấy toàn bộ store trong tenant, sai hoàn toàn với ý định (phải thấy 0 store).

- [ ] **Step 3: Thêm nhánh `StoreManager`/`Cashier`/`OrderStaff` vào `GetPagedStoresQueryHandler`**

Trong `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/GetPagedStores/GetPagedStoresQueryHandler.cs`, tìm:

```csharp
            request.Filter.BrandId = brand.Id;
        }

        var stores = await _storeRepository.GetPagedAsync(request.Filter, cancellationToken);
```

Thay bằng:

```csharp
            request.Filter.BrandId = brand.Id;
        }
        else if (roles.Contains(SystemRoles.StoreManager)
            || roles.Contains(SystemRoles.Cashier)
            || roles.Contains(SystemRoles.OrderStaff))
        {
            var storeIds = await _storeRepository.GetStoreIdsByUserIdAsync(parsedUserId, cancellationToken);

            request.Filter.StoreIds = storeIds;
        }

        var stores = await _storeRepository.GetPagedAsync(request.Filter, cancellationToken);
```

- [ ] **Step 4: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 5: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/Models/Stores/StoreFilterDto.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/Repositories/AppStoreRepository.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/GetPagedStores/GetPagedStoresQueryHandler.cs
git commit -m "feat: loc danh sach store theo StoreManager/Cashier/OrderStaff scope"
```

---

### Task 2: BE — Ownership check khi tạo đơn POS

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Common/OrderScopeValidator.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommandHandler.cs`
- Modify: `NDTCore.BE/src/NDTCore.API/Controllers/Modules/Pos/PosController.cs`

**Interfaces:**
- Consumes: `IStoreService.GetStoreIdsByUserIdAsync(Guid, CancellationToken)`, `IStoreService.GetByIdAsync(int, CancellationToken)`, `IBrandService.GetBrandByUserIdAsync`, `IFranchiseeService.GetFranchiseeByUserIdAsync` (tất cả đã có sẵn, không đổi signature).
- Produces: `OrderScopeValidator.ValidateAsync(...)` giờ hỗ trợ thêm role `StoreManager`/`Cashier`/`OrderStaff` — các handler khác (`GetPagedOrders`, `GetOrderById`, `UpdateOrderStatus`, `CancelOrder`) tự động được hưởng lợi (không cần sửa) vì cùng gọi hàm này.

- [ ] **Step 1: Thêm nhánh store-staff vào `OrderScopeValidator.ValidateAsync`**

Trong `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Common/OrderScopeValidator.cs`, tìm:

```csharp
        var isBrandManager = roles.Contains(SystemRoles.BrandManager);
        var isFranchiseeOwner = roles.Contains(SystemRoles.FranchiseeOwner);

        if (!isBrandManager && !isFranchiseeOwner)
            return Error.Forbidden("Role is not permitted to access orders.");

        if (storeId is null)
            return Error.Forbidden("StoreId is required for your role.");

        var store = await storeService.GetByIdAsync(storeId.Value, cancellationToken);

        if (store is null)
            return Error.NotFound($"Store '{storeId}' was not found.");

        if (isBrandManager)
```

Thay bằng:

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

        if (isBrandManager)
```

Cập nhật XML doc summary của class (đầu file) để phản ánh thêm nhánh mới — tìm:

```csharp
/// <summary>
/// VN: Kiểm tra phạm vi truy cập đơn hàng theo role hiện tại (SuperAdmin/OrgAdmin không giới hạn;
/// BrandManager/FranchiseeOwner chỉ được truy cập đơn hàng thuộc store trong phạm vi brand/franchisee của họ). <br />
/// EN: Validates order access scope based on the current role (SuperAdmin/OrgAdmin unrestricted;
/// BrandManager/FranchiseeOwner may only access orders whose store falls within their brand/franchisee scope).
/// </summary>
```

Thay bằng:

```csharp
/// <summary>
/// VN: Kiểm tra phạm vi truy cập đơn hàng theo role hiện tại (SuperAdmin/OrgAdmin không giới hạn;
/// BrandManager/FranchiseeOwner chỉ được truy cập đơn hàng thuộc store trong phạm vi brand/franchisee của họ;
/// StoreManager/Cashier/OrderStaff chỉ được truy cập đơn hàng thuộc store mà họ là thành viên). <br />
/// EN: Validates order access scope based on the current role (SuperAdmin/OrgAdmin unrestricted;
/// BrandManager/FranchiseeOwner may only access orders whose store falls within their brand/franchisee scope;
/// StoreManager/Cashier/OrderStaff may only access orders whose store they are a member of).
/// </summary>
```

- [ ] **Step 2: Gọi `OrderScopeValidator` từ `CreateOrderCommandHandler`**

Trong `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommandHandler.cs`, tìm phần using + constructor:

```csharp
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Order.Application.Common;
using NDTCore.Order.Contracts.Interfaces.Repositories;
using NDTCore.Order.Contracts.ViewModels.Orders;
using NDTCore.Order.Domain.Constants;
using NDTCore.Order.Domain.Entities;
using NDTCore.Store.Contracts.Interfaces.Services;
using OrderEntity = NDTCore.Order.Domain.Entities.Order;

namespace NDTCore.Order.Application.Features.Orders.CreateOrder;

/// <summary>
/// VN: Xử lý <see cref="CreateOrderCommand"/> — tạo đơn hàng với các dòng sản phẩm và option. <br />
/// EN: Handles <see cref="CreateOrderCommand"/> — creates an order with line items and options.
/// </summary>
public sealed class CreateOrderCommandHandler : ICommandHandler<CreateOrderCommand, CreateOrderResponse>
{
    private readonly ILogger<CreateOrderCommandHandler> _logger;
    private readonly INdtContextAccessor _contextAccessor;
    private readonly IAppOrderRepository _orderRepository;
    private readonly IOrderUnitOfWork _unitOfWork;
    private readonly IStoreService _storeService;

    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="CreateOrderCommandHandler"/>. <br />
    /// EN: Initializes a new instance of the <see cref="CreateOrderCommandHandler"/> class.
    /// </summary>
    public CreateOrderCommandHandler(
        ILogger<CreateOrderCommandHandler> logger,
        INdtContextAccessor contextAccessor,
        IAppOrderRepository orderRepository,
        IOrderUnitOfWork unitOfWork,
        IStoreService storeService)
    {
        _logger = logger;
        _contextAccessor = contextAccessor;
        _orderRepository = orderRepository;
        _unitOfWork = unitOfWork;
        _storeService = storeService;
    }
```

Thay bằng:

```csharp
using Microsoft.Extensions.Logging;
using NDTCore.Brand.Contracts.Interfaces.Services;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Order.Application.Common;
using NDTCore.Order.Contracts.Interfaces.Repositories;
using NDTCore.Order.Contracts.ViewModels.Orders;
using NDTCore.Order.Domain.Constants;
using NDTCore.Order.Domain.Entities;
using NDTCore.Store.Contracts.Interfaces.Services;
using OrderEntity = NDTCore.Order.Domain.Entities.Order;

namespace NDTCore.Order.Application.Features.Orders.CreateOrder;

/// <summary>
/// VN: Xử lý <see cref="CreateOrderCommand"/> — tạo đơn hàng với các dòng sản phẩm và option. <br />
/// EN: Handles <see cref="CreateOrderCommand"/> — creates an order with line items and options.
/// </summary>
public sealed class CreateOrderCommandHandler : ICommandHandler<CreateOrderCommand, CreateOrderResponse>
{
    private readonly ILogger<CreateOrderCommandHandler> _logger;
    private readonly INdtContextAccessor _contextAccessor;
    private readonly IAppOrderRepository _orderRepository;
    private readonly IOrderUnitOfWork _unitOfWork;
    private readonly IBrandService _brandService;
    private readonly IFranchiseeService _franchiseeService;
    private readonly IStoreService _storeService;

    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="CreateOrderCommandHandler"/>. <br />
    /// EN: Initializes a new instance of the <see cref="CreateOrderCommandHandler"/> class.
    /// </summary>
    public CreateOrderCommandHandler(
        ILogger<CreateOrderCommandHandler> logger,
        INdtContextAccessor contextAccessor,
        IAppOrderRepository orderRepository,
        IOrderUnitOfWork unitOfWork,
        IBrandService brandService,
        IFranchiseeService franchiseeService,
        IStoreService storeService)
    {
        _logger = logger;
        _contextAccessor = contextAccessor;
        _orderRepository = orderRepository;
        _unitOfWork = unitOfWork;
        _brandService = brandService;
        _franchiseeService = franchiseeService;
        _storeService = storeService;
    }
```

Tìm tiếp phần đầu `Handle` (ngay sau khi lấy `tenantId`/`userEmail`/`now`, trước khi lookup store):

```csharp
        var tenantId = context.TenantId;
        var userEmail = context.Email;
        var now = DateTimeOffset.UtcNow;

        var stores = await _storeService.GetStoresByIdsAsync([request.StoreId], null, cancellationToken);
```

Thay bằng:

```csharp
        var tenantId = context.TenantId;
        var userEmail = context.Email;
        var now = DateTimeOffset.UtcNow;

        var scopeError = await OrderScopeValidator.ValidateAsync(
            _contextAccessor, _brandService, _franchiseeService, _storeService,
            request.StoreId, cancellationToken);

        if (scopeError is not null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Create order scope validation failed: StoreId={StoreId}, ErrorCode={ErrorCode}",
                nameof(CreateOrderCommandHandler),
                nameof(Handle),
                request.StoreId,
                scopeError.ErrorCode);

            return Result<CreateOrderResponse>.Failure(scopeError);
        }

        var stores = await _storeService.GetStoresByIdsAsync([request.StoreId], null, cancellationToken);
```

- [ ] **Step 3: Thêm `OrderStaff` vào `[Authorize(Roles=...)]` của `PosController`**

Trong `NDTCore.BE/src/NDTCore.API/Controllers/Modules/Pos/PosController.cs`, tìm:

```csharp
[Authorize(Roles = SystemRoles.Cashier + "," + SystemRoles.StoreManager + "," + SystemRoles.FranchiseeOwner + "," + SystemRoles.OrgAdmin + "," + SystemRoles.SuperAdmin)]
```

Thay bằng:

```csharp
[Authorize(Roles = SystemRoles.Cashier + "," + SystemRoles.StoreManager + "," + SystemRoles.OrderStaff + "," + SystemRoles.FranchiseeOwner + "," + SystemRoles.OrgAdmin + "," + SystemRoles.SuperAdmin)]
```

- [ ] **Step 4: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 5: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Common/OrderScopeValidator.cs src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommandHandler.cs src/NDTCore.API/Controllers/Modules/Pos/PosController.cs
git commit -m "fix: kiem tra ownership khi tao don POS, mo OrderStaff cho toan bo endpoint POS"
```

---

### Task 3: FE — Bỏ dropdown Brand/Franchisee ở trang "Cửa hàng"

**Files:**
- Modify: `NDTCore.FE/src/modules/store/constants/store-list.constants.ts`
- Modify: `NDTCore.FE/src/modules/store/views/StoresView.vue`

**Interfaces:**
- Consumes: Task 1 (BE scope tự động theo role — không còn cần dropdown chọn thủ công).
- Không đổi `StoreForm`/`onFormBrandChange`/`brandOptions`/`formFranchiseeOptions` — các phần này phục vụ form tạo store, ngoài phạm vi.

- [ ] **Step 1: Bỏ field `brandId`/`franchiseeId` khỏi `buildStoreFilterFields`**

Trong `NDTCore.FE/src/modules/store/constants/store-list.constants.ts`, tìm:

```ts
export function buildStoreFilterFields(
    brandOptions: FilterOption[],
    franchiseeOptions: FilterOption[],
): FilterField[] {
    return [
        { key: 'keyword', label: 'Tìm kiếm', type: 'text', placeholder: 'Tên, mã cửa hàng...' },
        {
            key: 'brandId',
            label: 'Thương hiệu',
            type: 'select',
            options: [{ label: 'Tất cả', value: null }, ...brandOptions],
        },
        {
            key: 'franchiseeId',
            label: 'Nhà nhượng quyền',
            type: 'select',
            options: [{ label: 'Tất cả', value: null }, ...franchiseeOptions],
        },
        {
            key: 'isActive',
            label: 'Trạng thái',
            type: 'select',
            options: [
                { label: 'Tất cả', value: null },
                { label: 'Đang hoạt động', value: 'true' },
                { label: 'Ngừng hoạt động', value: 'false' },
            ],
        },
        { key: 'province', label: 'Tỉnh/Thành', type: 'text', placeholder: 'Lọc theo tỉnh...' },
    ]
}
```

Thay bằng:

```ts
export function buildStoreFilterFields(): FilterField[] {
    return [
        { key: 'keyword', label: 'Tìm kiếm', type: 'text', placeholder: 'Tên, mã cửa hàng...' },
        {
            key: 'isActive',
            label: 'Trạng thái',
            type: 'select',
            options: [
                { label: 'Tất cả', value: null },
                { label: 'Đang hoạt động', value: 'true' },
                { label: 'Ngừng hoạt động', value: 'false' },
            ],
        },
        { key: 'province', label: 'Tỉnh/Thành', type: 'text', placeholder: 'Lọc theo tỉnh...' },
    ]
}
```

Nếu `FilterOption` không còn được dùng ở nơi khác trong file này sau khi bỏ tham số, xóa luôn import không dùng của nó (kiểm tra bằng bước type-check ở Step 3).

- [ ] **Step 2: `StoresView.vue` — bỏ state/logic filter Brand/Franchisee, giữ nguyên phần phục vụ form tạo store**

Tìm:

```ts
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AppDialog } from '@/components/ui'
import type { FilterOption } from '@/components/ui'
import { useListPage } from '@/components/ui/composables'
import type { ListPageParams } from '@/components/ui/composables'
import { APP_ROUTES, DEFAULT_PAGINATION } from '@/core/constants/_index'
import { toCreatePayload } from '@/modules/store/adapters/store.adapter'
import { useStore } from '@/modules/store/composables/useStore'
import { buildStoreFilterFields, STORE_ROW_ACTION } from '@/modules/store/constants/store-list.constants'
import type { StoreFormModel } from '@/modules/store/models/form-models/store.model'
import type { StoreViewModel } from '@/modules/store/models/view-models/store.view-model'
import StoreList from '@/modules/store/components/store/StoreList.vue'
import StoreForm from '@/modules/store/components/store/StoreForm.vue'
import { useBrand } from '@/modules/brand/composables/useBrand'
import { useFranchisee } from '@/modules/brand/composables/useFranchisee'

const router = useRouter()
const { getPagedStores, createStore, deleteStore } = useStore()
const { getPagedBrands } = useBrand()
const { getPagedFranchisees } = useFranchisee()

// ── Filter options ─────────────────────────────────────────────────────────
const brandOptions = ref<FilterOption[]>([])
const allFranchiseeOptions = ref<FilterOption[]>([])
const filterFranchiseeOptions = ref<FilterOption[]>([])
const formFranchiseeOptions = ref<FilterOption[]>([])
const filterFields = computed(() =>
  buildStoreFilterFields(brandOptions.value, filterFranchiseeOptions.value),
)

// ── List page ───────────────────────────────────────────────────────────────
const fetchStores = async (params: ListPageParams): Promise<{ items: StoreViewModel[]; total: number }> => {
  const isActiveStr = params.filters['isActive'] as string | null
  const result = await getPagedStores({
    PageNumber: params.pageNumber,
    PageSize: params.pageSize,
    Keyword: (params.filters['keyword'] as string | null) ?? null,
    BrandId: params.filters['brandId'] ? Number(params.filters['brandId']) : null,
    FranchiseeId: params.filters['franchiseeId'] ? Number(params.filters['franchiseeId']) : null,
    IsActive: isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : null,
    Province: (params.filters['province'] as string | null) ?? null,
    SortBy: params.sortBy?.key ?? null,
    SortDirection: params.sortBy?.order ?? null,
  })
  return { items: result.items, total: result.totalCount }
}

const listPage = useListPage<StoreViewModel>({
  fetchFn: fetchStores,
  keyField: 'id',
  defaultPageSize: DEFAULT_PAGINATION.LIMIT,
})

const viewItems = computed<StoreViewModel[]>(() => listPage.items.value ?? [])

watch(
  () => listPage.filters.activeFilters.value['brandId'],
  async (brandId) => {
    listPage.filters.setFilter('franchiseeId', null)
    if (!brandId) { filterFranchiseeOptions.value = allFranchiseeOptions.value; return }
    const result = await getPagedFranchisees({ PageNumber: 1, PageSize: 200, BrandId: Number(brandId) })
    filterFranchiseeOptions.value = result.items.map((f) => ({ label: f.name, value: f.id }))
  },
)
```

Thay bằng:

```ts
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AppDialog } from '@/components/ui'
import type { FilterOption } from '@/components/ui'
import { useListPage } from '@/components/ui/composables'
import type { ListPageParams } from '@/components/ui/composables'
import { APP_ROUTES, DEFAULT_PAGINATION } from '@/core/constants/_index'
import { toCreatePayload } from '@/modules/store/adapters/store.adapter'
import { useStore } from '@/modules/store/composables/useStore'
import { buildStoreFilterFields, STORE_ROW_ACTION } from '@/modules/store/constants/store-list.constants'
import type { StoreFormModel } from '@/modules/store/models/form-models/store.model'
import type { StoreViewModel } from '@/modules/store/models/view-models/store.view-model'
import StoreList from '@/modules/store/components/store/StoreList.vue'
import StoreForm from '@/modules/store/components/store/StoreForm.vue'
import { useBrand } from '@/modules/brand/composables/useBrand'
import { useFranchisee } from '@/modules/brand/composables/useFranchisee'

const router = useRouter()
const { getPagedStores, createStore, deleteStore } = useStore()
const { getPagedBrands } = useBrand()
const { getPagedFranchisees } = useFranchisee()

// ── Form dropdown options (StoreForm — không phải filter) ───────────────────
const brandOptions = ref<FilterOption[]>([])
const formFranchiseeOptions = ref<FilterOption[]>([])
const filterFields = computed(() => buildStoreFilterFields())

// ── List page ───────────────────────────────────────────────────────────────
const fetchStores = async (params: ListPageParams): Promise<{ items: StoreViewModel[]; total: number }> => {
  const isActiveStr = params.filters['isActive'] as string | null
  const result = await getPagedStores({
    PageNumber: params.pageNumber,
    PageSize: params.pageSize,
    Keyword: (params.filters['keyword'] as string | null) ?? null,
    IsActive: isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : null,
    Province: (params.filters['province'] as string | null) ?? null,
    SortBy: params.sortBy?.key ?? null,
    SortDirection: params.sortBy?.order ?? null,
  })
  return { items: result.items, total: result.totalCount }
}

const listPage = useListPage<StoreViewModel>({
  fetchFn: fetchStores,
  keyField: 'id',
  defaultPageSize: DEFAULT_PAGINATION.LIMIT,
})

const viewItems = computed<StoreViewModel[]>(() => listPage.items.value ?? [])
```

Lưu ý: `BrandId`/`FranchiseeId` không còn trong payload gửi lên `getPagedStores` — kiểm tra `StoreFilterDto` (FE, `models/dtos/store-filter.dto.ts`) đang khai báo 2 field này là optional (`BrandId?`, `FranchiseeId?`) nên việc không gửi hoàn toàn hợp lệ, không cần sửa DTO.

Tìm tiếp trong `onMounted` (giữ nguyên `getPagedBrands` cho form, bỏ preload franchisee list không còn dùng):

```ts
onMounted(async () => {
  const [brandsResult, franchiseesResult] = await Promise.all([
    getPagedBrands({ PageNumber: 1, PageSize: 200 }),
    getPagedFranchisees({ PageNumber: 1, PageSize: 200 }),
  ])
  brandOptions.value = brandsResult.items.map((b) => ({ label: b.name, value: b.id }))
  allFranchiseeOptions.value = franchiseesResult.items.map((f) => ({ label: f.name, value: f.id }))
  filterFranchiseeOptions.value = allFranchiseeOptions.value
  await listPage.refresh()
})
```

Thay bằng:

```ts
onMounted(async () => {
  const brandsResult = await getPagedBrands({ PageNumber: 1, PageSize: 200 })
  brandOptions.value = brandsResult.items.map((b) => ({ label: b.name, value: b.id }))
  await listPage.refresh()
})
```

Toàn bộ phần còn lại của file (`onFormBrandChange`, `saveStore`, dialog xóa, `handleRowAction`, `<template>`) **không đổi**.

- [ ] **Step 3: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: exit code 0, no errors. Nếu báo lỗi import `FilterOption` không dùng trong `store-list.constants.ts` (Step 1), xóa import đó.

- [ ] **Step 4: Commit**

```bash
cd NDTCore.FE
git add src/modules/store/constants/store-list.constants.ts src/modules/store/views/StoresView.vue
git commit -m "feat: bo dropdown filter Brand/Franchisee o trang Cua hang, BE tu scope theo role"
```

---

### Task 4: Kiểm thử thủ công trên dev server

**Files:** Không sửa file — chỉ chạy backend + frontend và quan sát.

**Interfaces:**
- Consumes: kết quả Task 1-3.

- [ ] **Step 1: Chạy BE**

Run: `cd NDTCore.BE/src/NDTCore.API && dotnet run`
Expected: API khởi động không lỗi.

- [ ] **Step 2: Chạy FE dev server**

Run: `cd NDTCore.FE && npm run dev`
Expected: Vite serve không lỗi compile.

- [ ] **Step 3: Verify trang "Cửa hàng"**

Đăng nhập lần lượt các role và quan sát:
1. `SuperAdmin`/`OrgAdmin` (`admin@ndtcore.com`/`orgadmin@ndtcore.com`): filter bar chỉ còn "Tìm kiếm"/"Trạng thái"/"Tỉnh/Thành" (không còn dropdown Thương hiệu/Nhà nhượng quyền); danh sách hiển thị **toàn bộ** store trong tenant. Form "Tạo cửa hàng" vẫn chọn được Brand → Franchisee như cũ.
2. `FranchiseeOwner` (`franchiseeowner@ndtcore.com`): chỉ thấy store thuộc franchisee của mình.

Expected: đúng như mô tả, không lỗi console.

- [ ] **Step 4: Verify trang "Bán hàng"**

Đăng nhập role `order staff` (`orderstaff@ndtcore.com`) và `franchiseeowner@ndtcore.com`:
1. Trang "Bán hàng" chỉ hiện store mà `orderstaff` là thành viên (`AppStoreUser`) — nếu chưa gán store nào, danh sách phải **rỗng**, không phải toàn bộ tenant.
2. `franchiseeowner@ndtcore.com` chỉ thấy store thuộc franchisee của mình.
3. Chọn 1 store → vào màn POS → tạo 1 đơn hàng thành công (200 OK, `POST /api/pos/orders`).

Expected: đúng như mô tả.

- [ ] **Step 5: Verify ownership check khi tạo đơn (dùng Postman/curl hoặc DevTools Network — sửa `storeId` trong request POS thành 1 store KHÔNG thuộc scope của user đang đăng nhập)**

1. Với `orderstaff`/role store-staff bất kỳ: gọi `POST /api/pos/orders` với `StoreId` thuộc về store khác (không nằm trong `AppStoreUser` của họ) → phải trả về lỗi Forbidden, không tạo được đơn.
2. Với `franchiseeowner@ndtcore.com`: gọi với `StoreId` thuộc franchisee khác → phải Forbidden.
3. `GET /api/pos/orders/{id}` cho 1 đơn thuộc store khác (không phải store của user) → phải Forbidden (side-effect fix từ Task 2).

Expected: cả 3 trường hợp đều bị chặn đúng, không rò rỉ dữ liệu/khả năng thao tác ngoài phạm vi.
