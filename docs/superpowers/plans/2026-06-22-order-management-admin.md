# Order Management Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép SuperAdmin/OrgAdmin/BrandManager/FranchiseeOwner xem danh sách đơn hàng, xem chi tiết, đổi trạng thái và huỷ đơn hàng trên trang admin, với scoping theo brand/franchisee và route thật `api/admin/Order` (singular — không phải `api/admin/orders` như spec mô tả nhầm).

**Architecture:** BE: thêm scoping logic vào 4 handler của module Order (GetPagedOrders, GetOrderById, UpdateOrderStatus, CancelOrder) thông qua `IBrandService`/`IFranchiseeService`/`IStoreService` (Store cần `IStoreService` mới), gom logic scope vào 1 helper tĩnh `OrderScopeValidator` để tránh lặp code 4 lần. FE: thêm module `order` theo đúng vertical-slice pattern hiện có (mirror module `store`), thêm route-level role guard đọc role từ `useUserStore().profile.Roles` (không phải `authStore`/`useAuth` — 2 chỗ này không có role).

**Tech Stack:** .NET 8 Modular Monolith (CQRS/MediatR, FluentValidation, Result/Error pattern) cho BE; Vue 3 Composition API + TypeScript strict + Vuetify 3 + Pinia cho FE.

## Global Constraints

- BE: mọi `class`/`interface`/`method`/`property` (kể cả `private`) phải có XML doc song ngữ VN/EN theo `NDTCore.BE/CLAUDE.md`.
- BE: logging dùng format `_logger.Log{Level}(..., nameof(Class), nameof(Method), ...)` theo `NDTCore.BE/.claude/rules/logger-format.md` — không string interpolation.
- BE: không đặt DbContext trong Application layer; handler chỉ dùng repository/service interface từ Contracts.
- FE: TypeScript strict, không dùng `any`. DTO giữ PascalCase đúng theo backend; ViewModel dùng camelCase.
- FE: không gọi API trực tiếp trong component — phải qua composable.
- Route thật của `OrderController` là `api/admin/Order` (số ít, suy ra từ `[Route("api/admin/[controller]")]` trên `AdminControllerBase` + class name `OrderController`) — spec ghi nhầm là `api/admin/orders`. Toàn bộ plan dùng route đúng này.
- Trước khi commit BE: `dotnet build NDTCore.sln` phải pass. Trước khi commit FE: `npx vue-tsc --build` phải pass (theo `.claude/rules/git-workflow.md`).
- Codebase này không có test project (BE) hay `.test.ts` (FE) — không áp dụng TDD red/green theo nghĩa chặt; mỗi task dùng `dotnet build` / `vue-tsc` + bước verify thủ công làm cổng kiểm tra, đúng với quy trình thực tế của repo.
- **Quyết định scoping cho GetPagedOrders (không có trong spec gốc, cần chốt ở đây):** `OrderFilterDto.StoreId` là field đơn (không phải list), nên với role `BrandManager`/`FranchiseeOwner`, `StoreId` là **bắt buộc** trong filter — nếu thiếu, trả `Forbidden`. Đây là lựa chọn an toàn (deny-by-default) thay vì cho xem toàn bộ đơn hàng không giới hạn store khi không truyền `StoreId`.

---

### Task B1: Thêm `IBrandService.GetBrandByUserIdAsync`

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Brand/NDTCore.Brand.Contracts/Interfaces/Services/IBrandService.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Brand/NDTCore.Brand.Application/Services/BrandService.cs`

**Interfaces:**
- Consumes: `IBrandRepository.GetByUserIdAsync(Guid userId, CancellationToken ct = default) : Task<List<AppBrand>>` (đã có sẵn).
- Produces: `IBrandService.GetBrandByUserIdAsync(Guid userId, CancellationToken ct = default) : Task<BrandDto?>` — dùng bởi Task B4 (Order scope validator) và Task B5 (GetPagedStoresQueryHandler).

- [ ] **Step 1: Thêm method vào interface**

```csharp
// NDTCore.Brand.Contracts/Interfaces/Services/IBrandService.cs
using NDTCore.Brand.Contracts.Models.Brands;

namespace NDTCore.Brand.Contracts.Interfaces.Services;

/// <summary>
/// VN: Định nghĩa các nghiệp vụ liên quan đến brand được expose cho các module khác. <br />
/// EN: Defines brand-related business operations exposed to other modules.
/// </summary>
public interface IBrandService
{
    /// <summary>
    /// VN: Lấy thông tin brand theo ID. <br />
    /// EN: Retrieves brand information by its ID.
    /// </summary>
    Task<BrandDto?> GetByIdAsync(int brandId, CancellationToken cancellationToken = default);

    /// <summary>
    /// VN: Lấy danh sách thành viên của brand. <br />
    /// EN: Retrieves the list of members belonging to the brand.
    /// </summary>
    Task<List<BrandMemberDto>> GetBrandMembersAsync(int brandId, CancellationToken cancellationToken = default);

    /// <summary>
    /// VN: Lấy brand đầu tiên mà user là thành viên (qua AppBrandUser). <br />
    /// EN: Returns the first brand the user belongs to via AppBrandUser.
    /// </summary>
    Task<BrandDto?> GetBrandByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
```

- [ ] **Step 2: Implement trong `BrandService`, mirror chính xác `FranchiseeService.GetFranchiseeByUserIdAsync`**

```csharp
// NDTCore.Brand.Application/Services/BrandService.cs — thêm method, giữ nguyên phần còn lại của class
    public async Task<BrandDto?> GetBrandByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var brands = await _brandRepository.GetByUserIdAsync(userId, cancellationToken);
        var brand = brands.FirstOrDefault();

        if (brand is null)
            return null;

        return _mapper.Map<BrandDto?>(brand);
    }
```

Không cần thay đổi DI — `IBrandService`/`BrandService` đã được đăng ký sẵn trong `Brand.Application/ServiceCollectionExtensions.cs`.

- [ ] **Step 3: Build để verify**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 Error(s).

- [ ] **Step 4: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Brand/NDTCore.Brand.Contracts/Interfaces/Services/IBrandService.cs NDTCore.BE/src/NDTCore.Modules/NDTCore.Brand/NDTCore.Brand.Application/Services/BrandService.cs
git commit -m "feat: add IBrandService.GetBrandByUserIdAsync for cross-module brand scoping"
```

---

### Task B2: Tạo `IStoreService` + `StoreScopeDto` + `StoreService` (mới hoàn toàn)

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/Interfaces/Services/IStoreService.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Services/StoreService.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/ServiceCollectionExtensions.cs`

**Interfaces:**
- Consumes: `IAppStoreRepository.GetByIdAsync(int id, CancellationToken ct = default) : Task<AppStore?>` (kế thừa từ `IRepository<AppStore,int>`, đã có sẵn).
- Produces: `IStoreService.GetByIdAsync(int storeId, CancellationToken ct = default) : Task<StoreScopeDto?>` với `StoreScopeDto { Id, BrandId, FranchiseeId }` — dùng bởi Task B4 (`OrderScopeValidator`).

- [ ] **Step 1: Tạo interface + DTO**

```csharp
// NDTCore.Store.Contracts/Interfaces/Services/IStoreService.cs
namespace NDTCore.Store.Contracts.Interfaces.Services;

/// <summary>
/// VN: Định nghĩa các nghiệp vụ liên quan đến store được expose cho các module khác. <br />
/// EN: Defines store-related business operations exposed to other modules.
/// </summary>
public interface IStoreService
{
    /// <summary>
    /// VN: Lấy thông tin scope (brand/franchisee) của một store theo ID. <br />
    /// EN: Retrieves the scope information (brand/franchisee) of a store by its ID.
    /// </summary>
    Task<StoreScopeDto?> GetByIdAsync(int storeId, CancellationToken cancellationToken = default);
}

/// <summary>
/// VN: Thông tin tối giản của store dùng để kiểm tra phạm vi truy cập (brand/franchisee) từ module khác. <br />
/// EN: Minimal store information used for cross-module access-scope checks (brand/franchisee).
/// </summary>
public sealed class StoreScopeDto
{
    /// <summary>
    /// VN: Khoá chính của store. <br />
    /// EN: The store's primary key.
    /// </summary>
    public int Id { get; init; }

    /// <summary>
    /// VN: ID brand mà store trực thuộc. <br />
    /// EN: The brand ID this store belongs to.
    /// </summary>
    public int BrandId { get; init; }

    /// <summary>
    /// VN: ID franchisee vận hành store; <see langword="null"/> nếu store trực thuộc brand trực tiếp. <br />
    /// EN: The franchisee ID operating this store; <see langword="null"/> if directly owned by the brand.
    /// </summary>
    public int? FranchiseeId { get; init; }
}
```

- [ ] **Step 2: Implement `StoreService`**

Không có AutoMapper trong `Store.Application` hiện tại (`ServiceCollectionExtensions.cs` không gọi `AddAutoMapper`, `.csproj` không reference package AutoMapper) — map thủ công, không thêm dependency mới.

```csharp
// NDTCore.Store.Application/Services/StoreService.cs
using NDTCore.Store.Contracts.Interfaces.Repositories;
using NDTCore.Store.Contracts.Interfaces.Services;

namespace NDTCore.Store.Application.Services;

/// <summary>
/// VN: Triển khai <see cref="IStoreService"/> — nghiệp vụ store expose cho module khác. <br />
/// EN: Implements <see cref="IStoreService"/> — store business operations exposed to other modules.
/// </summary>
public class StoreService : IStoreService
{
    private readonly IAppStoreRepository _storeRepository;

    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="StoreService"/>. <br />
    /// EN: Initializes a new instance of the <see cref="StoreService"/> class.
    /// </summary>
    public StoreService(IAppStoreRepository storeRepository)
    {
        _storeRepository = storeRepository;
    }

    /// <inheritdoc/>
    public async Task<StoreScopeDto?> GetByIdAsync(int storeId, CancellationToken cancellationToken = default)
    {
        var store = await _storeRepository.GetByIdAsync(storeId, cancellationToken);

        if (store is null)
            return null;

        return new StoreScopeDto
        {
            Id = store.Id,
            BrandId = store.BrandId,
            FranchiseeId = store.FranchiseeId,
        };
    }
}
```

- [ ] **Step 3: Đăng ký DI — thêm `AddApplicationServices` helper mirroring Brand's pattern**

```csharp
// NDTCore.Store.Application/ServiceCollectionExtensions.cs — thay toàn bộ file
using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NDTCore.Store.Application.Services;
using NDTCore.Store.Contracts.Interfaces.Services;
using System.Reflection;

namespace NDTCore.Store.Application;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddStoreApplicationServices(this IServiceCollection services, IConfiguration configuration)
    {
        var assembly = Assembly.GetExecutingAssembly();

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(assembly);
        });

        services.AddValidatorsFromAssembly(assembly);

        services.AddApplicationServices();

        return services;
    }

    private static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IStoreService, StoreService>();

        return services;
    }
}
```

- [ ] **Step 4: Build để verify**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 Error(s).

- [ ] **Step 5: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/Interfaces/Services/IStoreService.cs NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Services/StoreService.cs NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/ServiceCollectionExtensions.cs
git commit -m "feat: add IStoreService for cross-module store scope lookups"
```

---

### Task B4: Thêm scope validation vào 4 handler của module Order

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/NDTCore.Order.Application.csproj`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Common/OrderScopeValidator.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/GetPagedOrders/GetPagedOrdersQueryHandler.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/GetOrderById/GetOrderByIdQueryHandler.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/UpdateOrderStatus/UpdateOrderStatusCommandHandler.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CancelOrder/CancelOrderCommandHandler.cs`

**Interfaces:**
- Consumes: `IBrandService.GetBrandByUserIdAsync` (Task B1), `IStoreService.GetByIdAsync` (Task B2), `IFranchiseeService.GetFranchiseeByUserIdAsync` (đã có sẵn), `INdtContextAccessor.Context.{UserId,Roles}` (đã có sẵn).
- Produces: `OrderScopeValidator.ValidateAsync(INdtContextAccessor, IBrandService, IFranchiseeService, IStoreService, int? storeId, CancellationToken) : Task<Error?>` — trả `null` nếu hợp lệ, trả `Error` (Unauthorized/Forbidden/NotFound) nếu vi phạm scope. Dùng bởi 4 handler trong task này.

**Lý do tạo `OrderScopeValidator` thay vì lặp code 4 lần:** logic scope giống nhau 100% ở cả 4 handler (chỉ khác `storeId` lấy từ đâu — từ filter hoặc từ order đã fetch). Đây là 1 static helper đơn lẻ, không phải abstraction/pattern mới, nên không vi phạm nguyên tắc "không tạo abstraction quá mức cần thiết".

- [ ] **Step 1: Thêm 2 project reference vào `Order.Application.csproj`**

```xml
<!-- NDTCore.Order.Application/NDTCore.Order.Application.csproj — thay toàn bộ ItemGroup đầu tiên -->
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="..\NDTCore.Order.Contracts\NDTCore.Order.Contracts.csproj" />
    <ProjectReference Include="..\..\NDTCore.Brand\NDTCore.Brand.Contracts\NDTCore.Brand.Contracts.csproj" />
    <ProjectReference Include="..\..\NDTCore.Store\NDTCore.Store.Contracts\NDTCore.Store.Contracts.csproj" />
  </ItemGroup>

</Project>
```

Không cần sửa `Order.Application/ServiceCollectionExtensions.cs` — `IBrandService`/`IFranchiseeService`/`IStoreService` đã được đăng ký bởi `AddBrandApplicationServices`/`AddStoreApplicationServices` ở module của chính chúng (đã wire trong `Program.cs`/module registrar).

- [ ] **Step 2: Tạo `OrderScopeValidator`**

```csharp
// NDTCore.Order.Application/Common/OrderScopeValidator.cs
using NDTCore.Brand.Contracts.Interfaces.Services;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Core.Constants;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Store.Contracts.Interfaces.Services;

namespace NDTCore.Order.Application.Common;

/// <summary>
/// VN: Kiểm tra phạm vi truy cập đơn hàng theo role hiện tại (SuperAdmin/OrgAdmin không giới hạn;
/// BrandManager/FranchiseeOwner chỉ được truy cập đơn hàng thuộc store trong phạm vi brand/franchisee của họ). <br />
/// EN: Validates order access scope based on the current role (SuperAdmin/OrgAdmin unrestricted;
/// BrandManager/FranchiseeOwner may only access orders whose store falls within their brand/franchisee scope).
/// </summary>
internal static class OrderScopeValidator
{
    /// <summary>
    /// VN: Thực hiện kiểm tra phạm vi. Với role BrandManager/FranchiseeOwner, <paramref name="storeId"/> là bắt buộc —
    /// nếu thiếu sẽ trả về <see cref="Error.Forbidden"/>. <br />
    /// EN: Performs the scope check. For BrandManager/FranchiseeOwner roles, <paramref name="storeId"/> is required —
    /// if missing, returns <see cref="Error.Forbidden"/>.
    /// </summary>
    /// <param name="contextAccessor">
    /// VN: Truy cập ngữ cảnh người dùng hiện tại. <br />
    /// EN: Accessor for the current user context.
    /// </param>
    /// <param name="brandService">
    /// VN: Dịch vụ tra cứu brand theo user. <br />
    /// EN: Service for looking up a brand by user.
    /// </param>
    /// <param name="franchiseeService">
    /// VN: Dịch vụ tra cứu franchisee theo user. <br />
    /// EN: Service for looking up a franchisee by user.
    /// </param>
    /// <param name="storeService">
    /// VN: Dịch vụ tra cứu thông tin scope của store. <br />
    /// EN: Service for looking up a store's scope information.
    /// </param>
    /// <param name="storeId">
    /// VN: ID store cần kiểm tra; <see langword="null"/> nếu chưa xác định (chỉ hợp lệ với role không giới hạn). <br />
    /// EN: The store ID to validate; <see langword="null"/> if undetermined (only valid for unrestricted roles).
    /// </param>
    /// <param name="cancellationToken">
    /// VN: Token để huỷ thao tác bất đồng bộ. <br />
    /// EN: A token to cancel the asynchronous operation.
    /// </param>
    /// <returns>
    /// VN: <see langword="null"/> nếu hợp lệ; ngược lại <see cref="Error"/> mô tả lý do từ chối. <br />
    /// EN: <see langword="null"/> if valid; otherwise an <see cref="Error"/> describing the rejection reason.
    /// </returns>
    public static async Task<Error?> ValidateAsync(
        INdtContextAccessor contextAccessor,
        IBrandService brandService,
        IFranchiseeService franchiseeService,
        IStoreService storeService,
        int? storeId,
        CancellationToken cancellationToken)
    {
        var userIdRaw = contextAccessor.Context?.UserId;

        if (userIdRaw is null || !Guid.TryParse(userIdRaw, out var userId))
            return Error.Unauthorized("User context is missing.");

        var roles = contextAccessor.Context?.Roles ?? [];

        if (roles.Contains(SystemRoles.SuperAdmin) || roles.Contains(SystemRoles.OrgAdmin))
            return null;

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
        {
            var brand = await brandService.GetBrandByUserIdAsync(userId, cancellationToken);

            if (brand is null)
                return Error.Unauthorized("No brand found for the user.");

            return store.BrandId == brand.Id
                ? null
                : Error.Forbidden("Order does not belong to your brand.");
        }

        var franchisee = await franchiseeService.GetFranchiseeByUserIdAsync(userId, cancellationToken);

        if (franchisee is null)
            return Error.Unauthorized("No franchisee found for the user.");

        return store.FranchiseeId == franchisee.Id
            ? null
            : Error.Forbidden("Order does not belong to your franchisee.");
    }
}
```

- [ ] **Step 3: Cập nhật `GetPagedOrdersQueryHandler` — validate scope theo `request.Filter.StoreId`**

```csharp
// NDTCore.Order.Application/Features/Orders/GetPagedOrders/GetPagedOrdersQueryHandler.cs — thay toàn bộ file
using Microsoft.Extensions.Logging;
using NDTCore.Brand.Contracts.Interfaces.Services;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Order.Application.Common;
using NDTCore.Order.Contracts.Interfaces.Repositories;
using NDTCore.Order.Contracts.ViewModels.Orders;
using NDTCore.Store.Contracts.Interfaces.Services;
using OrderEntity = NDTCore.Order.Domain.Entities.Order;

namespace NDTCore.Order.Application.Features.Orders.GetPagedOrders;

/// <summary>
/// VN: Xử lý <see cref="GetPagedOrdersQuery"/> — lấy danh sách đơn hàng phân trang. <br />
/// EN: Handles <see cref="GetPagedOrdersQuery"/> — retrieves a paginated list of orders.
/// </summary>
public sealed class GetPagedOrdersQueryHandler : IQueryHandler<GetPagedOrdersQuery, PaginatedCollection<GetOrderResponse>>
{
    private readonly ILogger<GetPagedOrdersQueryHandler> _logger;
    private readonly INdtContextAccessor _contextAccessor;
    private readonly IAppOrderRepository _orderRepository;
    private readonly IBrandService _brandService;
    private readonly IFranchiseeService _franchiseeService;
    private readonly IStoreService _storeService;

    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="GetPagedOrdersQueryHandler"/>. <br />
    /// EN: Initializes a new instance of the <see cref="GetPagedOrdersQueryHandler"/> class.
    /// </summary>
    public GetPagedOrdersQueryHandler(
        ILogger<GetPagedOrdersQueryHandler> logger,
        INdtContextAccessor contextAccessor,
        IAppOrderRepository orderRepository,
        IBrandService brandService,
        IFranchiseeService franchiseeService,
        IStoreService storeService)
    {
        _logger = logger;
        _contextAccessor = contextAccessor;
        _orderRepository = orderRepository;
        _brandService = brandService;
        _franchiseeService = franchiseeService;
        _storeService = storeService;
    }

    /// <inheritdoc/>
    public async Task<Result<PaginatedCollection<GetOrderResponse>>> Handle(
        GetPagedOrdersQuery request,
        CancellationToken cancellationToken)
    {
        var scopeError = await OrderScopeValidator.ValidateAsync(
            _contextAccessor, _brandService, _franchiseeService, _storeService,
            request.Filter.StoreId, cancellationToken);

        if (scopeError is not null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Order list scope validation failed: ErrorCode={ErrorCode}, StoreId={StoreId}",
                nameof(GetPagedOrdersQueryHandler),
                nameof(Handle),
                scopeError.ErrorCode,
                request.Filter.StoreId);

            return Result<PaginatedCollection<GetOrderResponse>>.Failure(scopeError);
        }

        var orders = await _orderRepository.GetPagedAsync(request.Filter, cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Order page loaded: PageNumber={PageNumber}, PageSize={PageSize}, TotalRecords={TotalRecords}",
            nameof(GetPagedOrdersQueryHandler),
            nameof(Handle),
            request.Filter.PageNumber,
            request.Filter.PageSize,
            orders.PaginationMetadata.TotalRecords);

        var items = orders.Items.Select(MapToResponse).ToList();

        return Result<PaginatedCollection<GetOrderResponse>>.Success(
            new PaginatedCollection<GetOrderResponse>(items, orders.PaginationMetadata));
    }

    /// <summary>
    /// VN: Ánh xạ entity <see cref="Order"/> sang <see cref="GetOrderResponse"/> (không bao gồm items). <br />
    /// EN: Maps the <see cref="Order"/> entity to <see cref="GetOrderResponse"/> (without items).
    /// </summary>
    private static GetOrderResponse MapToResponse(OrderEntity o) => new()
    {
        Id = o.Id,
        TenantId = o.TenantId,
        StoreId = o.StoreId,
        OrderNumber = o.OrderNumber,
        Status = o.Status,
        Channel = o.Channel,
        CustomerName = o.CustomerName,
        CustomerPhone = o.CustomerPhone,
        Note = o.Note,
        Subtotal = o.Subtotal,
        DiscountAmount = o.DiscountAmount,
        TaxAmount = o.TaxAmount,
        TotalAmount = o.TotalAmount,
        PaymentMethod = o.PaymentMethod,
        PaymentStatus = o.PaymentStatus,
        PaidAt = o.PaidAt,
        CancelledAt = o.CancelledAt,
        CancelledReason = o.CancelledReason,
        CreatedAt = o.CreatedAt,
        CreatedBy = o.CreatedBy,
        UpdatedAt = o.UpdatedAt,
        UpdatedBy = o.UpdatedBy,
        Items = [],
    };
}
```

- [ ] **Step 4: Cập nhật `GetOrderByIdQueryHandler` — validate scope theo `order.StoreId` sau khi fetch**

```csharp
// NDTCore.Order.Application/Features/Orders/GetOrderById/GetOrderByIdQueryHandler.cs — thay toàn bộ file
using Microsoft.Extensions.Logging;
using NDTCore.Brand.Contracts.Interfaces.Services;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Order.Application.Common;
using NDTCore.Order.Contracts.Interfaces.Repositories;
using NDTCore.Order.Contracts.ViewModels.Orders;
using NDTCore.Order.Domain.Constants;
using NDTCore.Store.Contracts.Interfaces.Services;
using OrderEntity = NDTCore.Order.Domain.Entities.Order;

namespace NDTCore.Order.Application.Features.Orders.GetOrderById;

/// <summary>
/// VN: Xử lý <see cref="GetOrderByIdQuery"/> — lấy chi tiết đơn hàng kèm dòng sản phẩm và option. <br />
/// EN: Handles <see cref="GetOrderByIdQuery"/> — retrieves full order detail with items and options.
/// </summary>
public sealed class GetOrderByIdQueryHandler : IQueryHandler<GetOrderByIdQuery, GetOrderResponse>
{
    private readonly ILogger<GetOrderByIdQueryHandler> _logger;
    private readonly INdtContextAccessor _contextAccessor;
    private readonly IAppOrderRepository _orderRepository;
    private readonly IBrandService _brandService;
    private readonly IFranchiseeService _franchiseeService;
    private readonly IStoreService _storeService;

    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="GetOrderByIdQueryHandler"/>. <br />
    /// EN: Initializes a new instance of the <see cref="GetOrderByIdQueryHandler"/> class.
    /// </summary>
    public GetOrderByIdQueryHandler(
        ILogger<GetOrderByIdQueryHandler> logger,
        INdtContextAccessor contextAccessor,
        IAppOrderRepository orderRepository,
        IBrandService brandService,
        IFranchiseeService franchiseeService,
        IStoreService storeService)
    {
        _logger = logger;
        _contextAccessor = contextAccessor;
        _orderRepository = orderRepository;
        _brandService = brandService;
        _franchiseeService = franchiseeService;
        _storeService = storeService;
    }

    /// <inheritdoc/>
    public async Task<Result<GetOrderResponse>> Handle(
        GetOrderByIdQuery request,
        CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdWithItemsAsync(request.OrderId, cancellationToken);

        if (order is null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Order not found: OrderId={OrderId}",
                nameof(GetOrderByIdQueryHandler),
                nameof(Handle),
                request.OrderId);

            return Result<GetOrderResponse>.Failure(
                Error.NotFound($"Order '{request.OrderId}' was not found."));
        }

        var scopeError = await OrderScopeValidator.ValidateAsync(
            _contextAccessor, _brandService, _franchiseeService, _storeService,
            order.StoreId, cancellationToken);

        if (scopeError is not null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Order detail scope validation failed: OrderId={OrderId}, ErrorCode={ErrorCode}",
                nameof(GetOrderByIdQueryHandler),
                nameof(Handle),
                request.OrderId,
                scopeError.ErrorCode);

            return Result<GetOrderResponse>.Failure(scopeError);
        }

        return Result<GetOrderResponse>.Success(MapToResponse(order));
    }

    /// <summary>
    /// VN: Ánh xạ entity <see cref="Order"/> sang <see cref="GetOrderResponse"/>. <br />
    /// EN: Maps the <see cref="Order"/> entity to a <see cref="GetOrderResponse"/>.
    /// </summary>
    private static GetOrderResponse MapToResponse(OrderEntity o) => new()
    {
        Id = o.Id,
        TenantId = o.TenantId,
        StoreId = o.StoreId,
        OrderNumber = o.OrderNumber,
        Status = o.Status,
        Channel = o.Channel,
        ServiceType = o.ServiceType ?? ServiceType.TakeAway,
        CustomerName = o.CustomerName,
        CustomerPhone = o.CustomerPhone,
        Note = o.Note,
        Subtotal = o.Subtotal,
        DiscountAmount = o.DiscountAmount,
        TaxAmount = o.TaxAmount,
        DeliveryFee = o.DeliveryFee,
        DeliveryAddress = o.DeliveryAddress,
        TotalAmount = o.TotalAmount,
        PaymentMethod = o.PaymentMethod,
        PaymentStatus = o.PaymentStatus,
        AmountReceived = o.AmountReceived,
        ChangeAmount = o.ChangeAmount,
        PaidAt = o.PaidAt,
        CancelledAt = o.CancelledAt,
        CancelledReason = o.CancelledReason,
        CreatedAt = o.CreatedAt,
        CreatedBy = o.CreatedBy,
        UpdatedAt = o.UpdatedAt,
        UpdatedBy = o.UpdatedBy,
        Items = o.OrderItems.Select(i => new GetOrderItemResponse
        {
            Id = i.Id,
            ProductId = i.ProductId,
            ProductCode = i.ProductCode,
            ProductName = i.ProductName,
            RegularPrice = i.RegularPrice,
            OptionsAmount = i.OptionsAmount,
            SalePrice = i.SalePrice,
            Quantity = i.Quantity,
            LineAmount = i.LineAmount,
            DiscountAmount = i.DiscountAmount,
            LineNetAmount = i.LineNetAmount,
            Note = i.Note,
            Options = i.OrderItemOptions.Select(opt => new GetOrderItemOptionResponse
            {
                Id = opt.Id,
                OptionId = opt.OptionId,
                GroupName = opt.GroupName,
                OptionName = opt.OptionName,
                Price = opt.Price,
            }).ToList(),
        }).ToList(),
    };
}
```

- [ ] **Step 5: Cập nhật `UpdateOrderStatusCommandHandler` — validate scope theo `order.StoreId` trước khi đổi trạng thái**

```csharp
// NDTCore.Order.Application/Features/Orders/UpdateOrderStatus/UpdateOrderStatusCommandHandler.cs — thay toàn bộ file
using Microsoft.Extensions.Logging;
using NDTCore.Brand.Contracts.Interfaces.Services;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Order.Application.Common;
using NDTCore.Order.Contracts.Interfaces.Repositories;
using NDTCore.Order.Contracts.ViewModels.Orders;
using NDTCore.Order.Domain.Constants;
using NDTCore.Store.Contracts.Interfaces.Services;

namespace NDTCore.Order.Application.Features.Orders.UpdateOrderStatus;

/// <summary>
/// VN: Xử lý <see cref="UpdateOrderStatusCommand"/> — chuyển trạng thái đơn hàng với validation lifecycle. <br />
/// EN: Handles <see cref="UpdateOrderStatusCommand"/> — transitions order status with lifecycle validation.
/// </summary>
public sealed class UpdateOrderStatusCommandHandler
    : ICommandHandler<UpdateOrderStatusCommand, UpdateOrderStatusResponse>
{
    private readonly ILogger<UpdateOrderStatusCommandHandler> _logger;
    private readonly INdtContextAccessor _contextAccessor;
    private readonly IAppOrderRepository _orderRepository;
    private readonly IOrderUnitOfWork _unitOfWork;
    private readonly IBrandService _brandService;
    private readonly IFranchiseeService _franchiseeService;
    private readonly IStoreService _storeService;

    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="UpdateOrderStatusCommandHandler"/>. <br />
    /// EN: Initializes a new instance of the <see cref="UpdateOrderStatusCommandHandler"/> class.
    /// </summary>
    public UpdateOrderStatusCommandHandler(
        ILogger<UpdateOrderStatusCommandHandler> logger,
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

    /// <inheritdoc/>
    public async Task<Result<UpdateOrderStatusResponse>> Handle(
        UpdateOrderStatusCommand request,
        CancellationToken cancellationToken)
    {
        var userEmail = _contextAccessor.Context?.Email;

        var order = await _orderRepository.GetByIdTrackedAsync(request.OrderId, cancellationToken);

        if (order is null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Order not found: OrderId={OrderId}",
                nameof(UpdateOrderStatusCommandHandler),
                nameof(Handle),
                request.OrderId);

            return Result<UpdateOrderStatusResponse>.Failure(
                Error.NotFound($"Order '{request.OrderId}' was not found."));
        }

        var scopeError = await OrderScopeValidator.ValidateAsync(
            _contextAccessor, _brandService, _franchiseeService, _storeService,
            order.StoreId, cancellationToken);

        if (scopeError is not null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Status update scope validation failed: OrderId={OrderId}, ErrorCode={ErrorCode}",
                nameof(UpdateOrderStatusCommandHandler),
                nameof(Handle),
                request.OrderId,
                scopeError.ErrorCode);

            return Result<UpdateOrderStatusResponse>.Failure(scopeError);
        }

        var newStatus = request.Request.Status;
        var isValidTransition =
            (order.Status == OrderStatus.Pending && newStatus == OrderStatus.Confirmed) ||
            (order.Status == OrderStatus.Confirmed && newStatus == OrderStatus.Completed);

        if (!isValidTransition)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Invalid status transition: OrderId={OrderId}, CurrentStatus={CurrentStatus}, RequestedStatus={RequestedStatus}",
                nameof(UpdateOrderStatusCommandHandler),
                nameof(Handle),
                order.Id,
                order.Status,
                newStatus);

            return Result<UpdateOrderStatusResponse>.Failure(
                Error.Validation($"Cannot transition from '{order.Status}' to '{newStatus}'."));
        }

        order.Status = newStatus;
        order.UpdatedAt = DateTimeOffset.UtcNow;
        order.UpdatedBy = userEmail;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Order status updated: OrderId={OrderId}, NewStatus={NewStatus}",
            nameof(UpdateOrderStatusCommandHandler),
            nameof(Handle),
            order.Id,
            order.Status);

        return Result<UpdateOrderStatusResponse>.Success(new UpdateOrderStatusResponse
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            Status = order.Status,
            UpdatedAt = order.UpdatedAt,
            UpdatedBy = order.UpdatedBy,
        });
    }
}
```

- [ ] **Step 6: Cập nhật `CancelOrderCommandHandler` — validate scope theo `order.StoreId` trước khi huỷ**

```csharp
// NDTCore.Order.Application/Features/Orders/CancelOrder/CancelOrderCommandHandler.cs — thay toàn bộ file
using Microsoft.Extensions.Logging;
using NDTCore.Brand.Contracts.Interfaces.Services;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Order.Application.Common;
using NDTCore.Order.Contracts.Interfaces.Repositories;
using NDTCore.Order.Contracts.ViewModels.Orders;
using NDTCore.Order.Domain.Constants;
using NDTCore.Store.Contracts.Interfaces.Services;

namespace NDTCore.Order.Application.Features.Orders.CancelOrder;

/// <summary>
/// VN: Xử lý <see cref="CancelOrderCommand"/> — huỷ đơn hàng đang Pending hoặc Confirmed. <br />
/// EN: Handles <see cref="CancelOrderCommand"/> — cancels an order that is Pending or Confirmed.
/// </summary>
public sealed class CancelOrderCommandHandler : ICommandHandler<CancelOrderCommand, CancelOrderResponse>
{
    private readonly ILogger<CancelOrderCommandHandler> _logger;
    private readonly INdtContextAccessor _contextAccessor;
    private readonly IAppOrderRepository _orderRepository;
    private readonly IOrderUnitOfWork _unitOfWork;
    private readonly IBrandService _brandService;
    private readonly IFranchiseeService _franchiseeService;
    private readonly IStoreService _storeService;

    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="CancelOrderCommandHandler"/>. <br />
    /// EN: Initializes a new instance of the <see cref="CancelOrderCommandHandler"/> class.
    /// </summary>
    public CancelOrderCommandHandler(
        ILogger<CancelOrderCommandHandler> logger,
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

    /// <inheritdoc/>
    public async Task<Result<CancelOrderResponse>> Handle(
        CancelOrderCommand request,
        CancellationToken cancellationToken)
    {
        var userEmail = _contextAccessor.Context?.Email;

        var order = await _orderRepository.GetByIdTrackedAsync(request.OrderId, cancellationToken);

        if (order is null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Order not found: OrderId={OrderId}",
                nameof(CancelOrderCommandHandler),
                nameof(Handle),
                request.OrderId);

            return Result<CancelOrderResponse>.Failure(
                Error.NotFound($"Order '{request.OrderId}' was not found."));
        }

        var scopeError = await OrderScopeValidator.ValidateAsync(
            _contextAccessor, _brandService, _franchiseeService, _storeService,
            order.StoreId, cancellationToken);

        if (scopeError is not null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Cancel scope validation failed: OrderId={OrderId}, ErrorCode={ErrorCode}",
                nameof(CancelOrderCommandHandler),
                nameof(Handle),
                request.OrderId,
                scopeError.ErrorCode);

            return Result<CancelOrderResponse>.Failure(scopeError);
        }

        var canCancel = order.Status == OrderStatus.Pending || order.Status == OrderStatus.Confirmed;

        if (!canCancel)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Order cannot be cancelled: OrderId={OrderId}, Status={Status}",
                nameof(CancelOrderCommandHandler),
                nameof(Handle),
                order.Id,
                order.Status);

            return Result<CancelOrderResponse>.Failure(
                Error.Validation($"Order with status '{order.Status}' cannot be cancelled."));
        }

        var now = DateTimeOffset.UtcNow;
        order.Status = OrderStatus.Cancelled;
        order.CancelledAt = now;
        order.CancelledReason = request.Request.CancelledReason;
        order.UpdatedAt = now;
        order.UpdatedBy = userEmail;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Order cancelled: OrderId={OrderId}, OrderNumber={OrderNumber}",
            nameof(CancelOrderCommandHandler),
            nameof(Handle),
            order.Id,
            order.OrderNumber);

        return Result<CancelOrderResponse>.Success(new CancelOrderResponse
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            Status = order.Status,
            CancelledAt = order.CancelledAt,
            CancelledReason = order.CancelledReason,
        });
    }
}
```

- [ ] **Step 7: Build để verify**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 Error(s).

- [ ] **Step 8: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application
git commit -m "feat: enforce brand/franchisee store scope on Order handlers"
```

---

### Task B5: Thêm nhánh BrandManager vào `GetPagedStoresQueryHandler`

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/GetPagedStores/GetPagedStoresQueryHandler.cs`

**Interfaces:**
- Consumes: `IBrandService.GetBrandByUserIdAsync` (Task B1).
- Produces: không có gì mới cho task khác — đây là điểm cuối của chuỗi scoping (đảm bảo BrandManager khi browse `/admin/store` chỉ thấy store của brand mình, qua đó cascading dropdown Store ở FE Task F4 tự động đúng phạm vi).

- [ ] **Step 1: Thêm `IBrandService` vào constructor + nhánh `else if` cho `BrandManager`**

```csharp
// NDTCore.Store.Application/Features/Stores/GetPagedStores/GetPagedStoresQueryHandler.cs — thay toàn bộ file
using Microsoft.Extensions.Logging;
using NDTCore.Brand.Contracts.Interfaces.Services;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Constants;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Store.Contracts.Interfaces.Repositories;
using NDTCore.Store.Contracts.ViewModels.Stores;
using NDTCore.Store.Domain.Entities;

namespace NDTCore.Store.Application.Features.Stores.GetPagedStores;

public sealed class GetPagedStoresQueryHandler : IQueryHandler<GetPagedStoresQuery, PaginatedCollection<GetStoreResponse>>
{
    private readonly ILogger<GetPagedStoresQueryHandler> _logger;
    private readonly INdtContextAccessor _ndtContextAccessor;
    private readonly IAppStoreRepository _storeRepository;
    private readonly IFranchiseeService _franchiseeService;
    private readonly IBrandService _brandService;

    public GetPagedStoresQueryHandler(
        ILogger<GetPagedStoresQueryHandler> logger,
        INdtContextAccessor ndtContextAccessor,
        IAppStoreRepository storeRepository,
        IFranchiseeService franchiseeService,
        IBrandService brandService)
    {
        _logger = logger;
        _ndtContextAccessor = ndtContextAccessor;
        _storeRepository = storeRepository;
        _franchiseeService = franchiseeService;
        _brandService = brandService;
    }

    public async Task<Result<PaginatedCollection<GetStoreResponse>>> Handle(
        GetPagedStoresQuery request,
        CancellationToken cancellationToken)
    {
        var userId = _ndtContextAccessor.Context?.UserId;

        if (userId == null || !Guid.TryParse(userId, out var parsedUserId))
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] No user context found when attempting to get paged stores.",
                nameof(GetPagedStoresQueryHandler),
                nameof(Handle));

            return Result<PaginatedCollection<GetStoreResponse>>.Failure(ErrorCodes.Auth.Unauthorized, "User context is missing.");
        }

        var roles = _ndtContextAccessor.Context?.Roles ?? [];

        if (roles.Contains(SystemRoles.FranchiseeOwner))
        {
            var franchisee = await _franchiseeService.GetFranchiseeByUserIdAsync(parsedUserId, cancellationToken);

            if (franchisee == null)
            {
                _logger.LogWarning(
                    "[{ClassName}.{FunctionName}] No franchisee found for user with ID {UserId} when attempting to get paged stores.",
                    nameof(GetPagedStoresQueryHandler),
                    nameof(Handle),
                    parsedUserId);

                return Result<PaginatedCollection<GetStoreResponse>>.Failure(ErrorCodes.Auth.Unauthorized, "No franchisee found for the user.");
            }

            request.Filter.FranchiseeId = franchisee.Id;
        }
        else if (roles.Contains(SystemRoles.BrandManager))
        {
            var brand = await _brandService.GetBrandByUserIdAsync(parsedUserId, cancellationToken);

            if (brand == null)
            {
                _logger.LogWarning(
                    "[{ClassName}.{FunctionName}] No brand found for user with ID {UserId} when attempting to get paged stores.",
                    nameof(GetPagedStoresQueryHandler),
                    nameof(Handle),
                    parsedUserId);

                return Result<PaginatedCollection<GetStoreResponse>>.Failure(ErrorCodes.Auth.Unauthorized, "No brand found for the user.");
            }

            request.Filter.BrandId = brand.Id;
        }

        var stores = await _storeRepository.GetPagedAsync(request.Filter, cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Store page loaded: PageNumber={PageNumber}, PageSize={PageSize}, TotalRecords={TotalRecords}",
            nameof(GetPagedStoresQueryHandler),
            nameof(Handle),
            request.Filter.PageNumber,
            request.Filter.PageSize,
            stores.PaginationMetadata.TotalRecords);

        var items = stores.Items
            .Select(s => MapToResponse(s))
            .ToList();

        return Result<PaginatedCollection<GetStoreResponse>>.Success(
            new PaginatedCollection<GetStoreResponse>(items, stores.PaginationMetadata));
    }

    private static GetStoreResponse MapToResponse(AppStore s) => new GetStoreResponse
    {
        Id = s.Id,
        TenantId = s.TenantId,
        BrandId = s.BrandId,
        FranchiseeId = s.FranchiseeId,
        Name = s.Name,
        Code = s.Code,
        Slug = s.Slug,
        LogoUrl = s.LogoUrl,
        IsActive = s.IsActive,
        IsAcceptingOrders = s.IsAcceptingOrders,
        Phone = s.Phone,
        Email = s.Email,
        Address = s.Address,
        City = s.City,
        Ward = s.Ward,
        District = s.District,
        Province = s.Province,
        Country = s.Country,
        Latitude = s.Latitude,
        Longitude = s.Longitude,
        OpenTime = s.OpenTime,
        CloseTime = s.CloseTime,
        TimeZone = s.TimeZone,
        CreatedAt = s.CreatedAt,
        CreatedBy = s.CreatedBy,
        UpdatedAt = s.UpdatedAt,
        UpdatedBy = s.UpdatedBy,
    };
}
```

- [ ] **Step 2: Build để verify**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 Error(s).

- [ ] **Step 3: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/GetPagedStores/GetPagedStoresQueryHandler.cs
git commit -m "feat: scope GetPagedStores to BrandManager's own brand"
```

---

### Task F1: Routing, route-guard theo role, và menu config

**Files:**
- Modify: `NDTCore.FE/src/core/constants/app-routes.constants.ts`
- Modify: `NDTCore.FE/src/router/types.ts`
- Modify: `NDTCore.FE/src/router/index.ts`
- Modify: `NDTCore.FE/src/router/routes.ts`
- Modify: `NDTCore.FE/src/core/constants/menu-config.constants.ts`

**Interfaces:**
- Consumes: `useUserStore().profile?.Roles : RoleDto[]` với `RoleDto { Id: string; Name: string }` (đã có sẵn, populate lúc bootstrap trong `main.ts`).
- Produces: `APP_ROUTES.ADMIN.CHILDREN.ORDERS.{NAME,PATH}` = `'admin:orders'` / `'orders'`, `APP_ROUTES.ADMIN.CHILDREN.ORDER_DETAIL.{NAME,PATH}` = `'admin:order-detail'` / `'orders/:id'` — dùng bởi Task F4, F5.

**Quyết định quan trọng:** route stub hiện tại ở `routes.ts:219-222` hardcode `path: 'orders'` / `name: 'admin:orders'` trực tiếp, không tham chiếu `APP_ROUTES` (khác với toàn bộ phần còn lại của file). Task này sửa luôn điểm không nhất quán này — thêm `ORDERS`/`ORDER_DETAIL` vào `APP_ROUTES.ADMIN.CHILDREN` mirror đúng pattern `STORES`/`STORE_DETAIL`, không tạo key cấp cao mới. Vai trò hiện tại lấy từ `useUserStore()` — **không** từ `authStore`/`useAuth` (2 chỗ này không track role, mặc dù `NDTCore.FE/CLAUDE.md` ghi nhầm là `useAuth` có `canAny`).

- [ ] **Step 1: Thêm `ORDERS`/`ORDER_DETAIL` vào `APP_ROUTES.ADMIN.CHILDREN`**

```ts
// NDTCore.FE/src/core/constants/app-routes.constants.ts — trong ADMIN.CHILDREN, thêm 2 entry sau STORE_MEMBERS
            STORE_MEMBERS: {
                NAME: 'admin:store-members',
                PATH: 'store-members',
            },
            ORDERS: {
                NAME: 'admin:orders',
                PATH: 'orders',
            },
            ORDER_DETAIL: {
                NAME: 'admin:order-detail',
                PATH: 'orders/:id',
            },
            SALES: {
                NAME: 'admin:sales',
                PATH: 'sales',
            },
```

- [ ] **Step 2: Thêm field `roles` vào `RouteMeta` augmentation**

```ts
// NDTCore.FE/src/router/types.ts — thay toàn bộ file
export interface BreadcrumbItem {
    title: string
    to?: string
    disabled?: boolean
}

export type LayoutType = 'default' | 'auth' | 'blank' | 'admin'

declare module 'vue-router' {
    interface RouteMeta {
        layout?: LayoutType
        title?: string
        requiresAuth?: boolean
        breadcrumbs?: BreadcrumbItem[]
        roles?: string[]
    }
}
```

- [ ] **Step 3: Thêm role-guard vào `router/index.ts`, đọc role từ `useUserStore()`**

```ts
// NDTCore.FE/src/router/index.ts — thay toàn bộ file
import { createRouter, createWebHistory } from 'vue-router'
import { APP_NAME } from '@/core/constants/app.constants'
import { APP_ROUTES } from '@/core/constants/app-routes.constants'
import { routes } from './routes'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useUserStore } from '@/modules/user/stores/user.store'

export const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, _from, savedPosition) {
        if (savedPosition) return savedPosition

        if (to.hash) {
            return {
                el: to.hash,
                behavior: 'smooth',
                top: 64,
            }
        }

        return { top: 0 }
    },
})

router.beforeEach((to) => {
    const authStore = useAuthStore()
    const userStore = useUserStore()

    // Đã login → không cho vào trang không cần auth
    if (authStore.isLoggedIn && !to.meta.requiresAuth) {
        return { name: APP_ROUTES.ADMIN.CHILDREN.DASHBOARD.NAME }
    }

    // Chưa login → không cho vào trang cần auth
    if (!authStore.isLoggedIn && to.meta.requiresAuth) {
        return { name: APP_ROUTES.AUTH.CHILDREN.LOGIN.NAME }
    }

    // Có yêu cầu role cụ thể → kiểm tra role hiện tại của user (lấy từ userStore, không phải authStore)
    if (to.meta.roles?.length) {
        const userRoles = userStore.profile?.Roles?.map((r) => r.Name) ?? []
        const hasAccess = to.meta.roles.some((role) => userRoles.includes(role))

        if (!hasAccess) {
            return { name: APP_ROUTES.ADMIN.CHILDREN.DASHBOARD.NAME }
        }
    }

    const pageTitle = to.meta.title as string | undefined
    document.title = pageTitle && pageTitle !== APP_NAME ? `${pageTitle} | ${APP_NAME}` : APP_NAME
})
```

- [ ] **Step 4: Sửa stub `orders` ở `routes.ts` thành 2 route thật, dùng `APP_ROUTES` + `roles` trong meta**

```ts
// NDTCore.FE/src/router/routes.ts — thay block stub hiện tại (dòng 218-222)
            {
                path: 'orders',
                name: 'admin:orders',
                component: () => import('@/components/common/ComingSoonView.vue'),
            },
```

thành:

```ts
            {
                path: APP_ROUTES.ADMIN.CHILDREN.ORDERS.PATH,
                name: APP_ROUTES.ADMIN.CHILDREN.ORDERS.NAME,
                component: () => import('@/modules/order/views/OrdersView.vue'),
                meta: {
                    title: 'Đơn hàng',
                    requiresAuth: true,
                    roles: [
                        SYSTEM_ROLES.SUPER_ADMIN,
                        SYSTEM_ROLES.ORG_ADMIN,
                        SYSTEM_ROLES.BRAND_MANAGER,
                        SYSTEM_ROLES.FRANCHISEE_OWNER,
                    ],
                    breadcrumbs: [
                        { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                        { title: 'Đơn hàng', disabled: true },
                    ],
                },
            },
            {
                path: APP_ROUTES.ADMIN.CHILDREN.ORDER_DETAIL.PATH,
                name: APP_ROUTES.ADMIN.CHILDREN.ORDER_DETAIL.NAME,
                component: () => import('@/modules/order/views/OrderDetailView.vue'),
                meta: {
                    title: 'Chi tiết đơn hàng',
                    requiresAuth: true,
                    roles: [
                        SYSTEM_ROLES.SUPER_ADMIN,
                        SYSTEM_ROLES.ORG_ADMIN,
                        SYSTEM_ROLES.BRAND_MANAGER,
                        SYSTEM_ROLES.FRANCHISEE_OWNER,
                    ],
                },
            },
```

Thêm import ở đầu file `routes.ts`:

```ts
import { SYSTEM_ROLES } from '@/core/constants/app.constants'
```

(import `APP_ROUTES` đã có sẵn ở đầu file — không cần thêm lại).

- [ ] **Step 5: Cập nhật roles của entry "Đơn hàng" trong `menu-config.constants.ts`**

```ts
// NDTCore.FE/src/core/constants/menu-config.constants.ts — trong section 'Nghiệp vụ', sửa entry "Đơn hàng"
            {
                title: 'Đơn hàng',
                icon: 'mdi-clipboard-list-outline',
                to: 'admin:orders',
                roles: [
                    SYSTEM_ROLES.SUPER_ADMIN,
                    SYSTEM_ROLES.ORG_ADMIN,
                    SYSTEM_ROLES.BRAND_MANAGER,
                    SYSTEM_ROLES.FRANCHISEE_OWNER,
                ],
            },
```

(giữ `to: 'admin:orders'` dạng literal string — nhất quán với `'admin:sales'`/`'admin:reports-revenue'` trong cùng file, không đổi sang tham chiếu `APP_ROUTES` vì đó không phải phạm vi của task này).

- [ ] **Step 6: Type-check để verify**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 lỗi type.

- [ ] **Step 7: Commit**

```bash
git add NDTCore.FE/src/core/constants/app-routes.constants.ts NDTCore.FE/src/router/types.ts NDTCore.FE/src/router/index.ts NDTCore.FE/src/router/routes.ts NDTCore.FE/src/core/constants/menu-config.constants.ts
git commit -m "feat: add order routes with role-based route guard"
```

---

### Task F2: Thêm endpoint Order admin vào `api.constants.ts`

**Files:**
- Modify: `NDTCore.FE/src/core/constants/api.constants.ts`

**Interfaces:**
- Produces: `API_ENDPOINTS.ORDER.ADMIN_API.{GET_PAGED,GET_BY_ID,UPDATE_STATUS,CANCEL}` — dùng bởi Task F3 (`order.api.ts`).

- [ ] **Step 1: Thêm sub-object `ADMIN_API` cạnh `POS_API` hiện có, dùng route thật `/admin/order` (chữ thường — ASP.NET routing không phân biệt hoa thường, nhất quán với `/admin/store`, `/admin/brand` trong cùng file)**

```ts
// NDTCore.FE/src/core/constants/api.constants.ts — trong API_ENDPOINTS.ORDER, thêm ADMIN_API cạnh POS_API
    ORDER: {
        POS_API: {
            GET_STORE_STATUS: (storeId: number) => `/pos/store/${storeId}/status`,
            GET_CATALOG: (storeId: number) => `/pos/store/${storeId}/catalog`,
            CREATE_ORDER: '/pos/orders',
            GET_ORDER_HISTORY: (storeId: number) => `/pos/store/${storeId}/orders`,
            GET_ORDER_BY_ID: (id: number) => `/pos/orders/${id}`,
        },
        ADMIN_API: {
            GET_PAGED: '/admin/order',
            GET_BY_ID: (id: number) => `/admin/order/${id}`,
            UPDATE_STATUS: (id: number) => `/admin/order/${id}/status`,
            CANCEL: (id: number) => `/admin/order/${id}/cancel`,
        },
    },
```

- [ ] **Step 2: Type-check để verify**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 lỗi type.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.FE/src/core/constants/api.constants.ts
git commit -m "feat: add admin order API endpoints"
```

---

### Task F3a: Order module — DTOs + ViewModels + Mapper

**Files:**
- Create: `NDTCore.FE/src/modules/order/models/dtos/order.dto.ts`
- Create: `NDTCore.FE/src/modules/order/models/dtos/order-filter.dto.ts`
- Create: `NDTCore.FE/src/modules/order/models/view-models/order.view-model.ts`
- Create: `NDTCore.FE/src/modules/order/mappers/order.mapper.ts`

**Interfaces:**
- Produces: `OrderDto`, `OrderItemDto`, `OrderItemOptionDto`, `OrderFilterDto`, `UpdateOrderStatusRequest`, `UpdateOrderStatusResponse`, `CancelOrderRequest`, `CancelOrderResponse` (PascalCase, mirror `GetOrderResponse`/`OrderFilterDto`/`UpdateOrderStatusRequest`/`UpdateOrderStatusResponse`/`CancelOrderRequest`/`CancelOrderResponse` từ BE Contracts). `OrderViewModel`, `OrderItemViewModel`, `OrderItemOptionViewModel` (camelCase). `orderMapper.toViewModel(dto)` / `toViewModels(dtos[])` — dùng bởi Task F3b (`order.service.ts`).

- [ ] **Step 1: Tạo `order.dto.ts` — mirror chính xác `GetOrderResponse`/`GetOrderItemResponse`/`GetOrderItemOptionResponse` và 4 request/response DTO**

```ts
// NDTCore.FE/src/modules/order/models/dtos/order.dto.ts
export interface OrderItemOptionDto {
    Id: number
    OptionId: number
    GroupName?: string | null
    OptionName: string
    Price: number
}

export interface OrderItemDto {
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
    Note?: string | null
    Options: OrderItemOptionDto[]
}

export interface OrderDto {
    Id: number
    TenantId: string
    StoreId: number
    OrderNumber: string
    Status: string
    Channel?: string | null
    ServiceType: string
    CustomerName?: string | null
    CustomerPhone?: string | null
    Note?: string | null
    Subtotal: number
    DiscountAmount: number
    TaxAmount: number
    DeliveryFee: number
    DeliveryAddress?: string | null
    TotalAmount: number
    PaymentMethod?: string | null
    PaymentStatus?: string | null
    AmountReceived?: number | null
    ChangeAmount?: number | null
    PaidAt?: string | null
    CancelledAt?: string | null
    CancelledReason?: string | null
    CreatedAt?: string | null
    CreatedBy?: string | null
    UpdatedAt?: string | null
    UpdatedBy?: string | null
    Items: OrderItemDto[]
}

export interface UpdateOrderStatusRequest {
    Status: string
}

export interface UpdateOrderStatusResponse {
    Id: number
    OrderNumber: string
    Status: string
    UpdatedAt?: string | null
    UpdatedBy?: string | null
}

export interface CancelOrderRequest {
    CancelledReason?: string | null
}

export interface CancelOrderResponse {
    Id: number
    OrderNumber: string
    Status: string
    CancelledAt?: string | null
    CancelledReason?: string | null
}
```

- [ ] **Step 2: Tạo `order-filter.dto.ts` — mirror `OrderFilterDto` + `PagedRequest` từ BE**

```ts
// NDTCore.FE/src/modules/order/models/dtos/order-filter.dto.ts
export interface OrderFilterDto {
    PageNumber: number
    PageSize: number
    StoreId?: number | null
    Status?: string | null
    Channel?: string | null
    FromDate?: string | null
    ToDate?: string | null
    Keyword?: string | null
    SortBy?: string | null
    SortDirection?: string | null
}
```

- [ ] **Step 3: Tạo `order.view-model.ts` — camelCase, dùng cho hiển thị**

```ts
// NDTCore.FE/src/modules/order/models/view-models/order.view-model.ts
export interface OrderItemOptionViewModel {
    id: number
    optionId: number
    groupName?: string | null
    optionName: string
    price: number
}

export interface OrderItemViewModel {
    id: number
    productId: number
    productCode: string
    productName: string
    regularPrice: number
    optionsAmount: number
    salePrice: number
    quantity: number
    lineAmount: number
    discountAmount: number
    lineNetAmount: number
    note?: string | null
    options: OrderItemOptionViewModel[]
}

export interface OrderViewModel extends Record<string, unknown> {
    id: number
    tenantId: string
    storeId: number
    orderNumber: string
    status: string
    channel?: string | null
    serviceType: string
    customerName?: string | null
    customerPhone?: string | null
    note?: string | null
    subtotal: number
    discountAmount: number
    taxAmount: number
    deliveryFee: number
    deliveryAddress?: string | null
    totalAmount: number
    paymentMethod?: string | null
    paymentStatus?: string | null
    amountReceived?: number | null
    changeAmount?: number | null
    paidAt?: string | null
    cancelledAt?: string | null
    cancelledReason?: string | null
    createdAt?: string | null
    createdBy?: string | null
    updatedAt?: string | null
    updatedBy?: string | null
    items: OrderItemViewModel[]
}
```

- [ ] **Step 4: Tạo `order.mapper.ts`**

```ts
// NDTCore.FE/src/modules/order/mappers/order.mapper.ts
import type { OrderDto, OrderItemDto, OrderItemOptionDto } from '@/modules/order/models/dtos/order.dto'
import type {
    OrderViewModel,
    OrderItemViewModel,
    OrderItemOptionViewModel,
} from '@/modules/order/models/view-models/order.view-model'

export const orderMapper = {
    toViewModels(dtos: OrderDto[]): OrderViewModel[] {
        return (dtos ?? []).map((dto) => this.toViewModel(dto))
    },

    toViewModel(dto: OrderDto): OrderViewModel {
        return {
            id: dto.Id,
            tenantId: dto.TenantId,
            storeId: dto.StoreId,
            orderNumber: dto.OrderNumber,
            status: dto.Status,
            channel: dto.Channel ?? null,
            serviceType: dto.ServiceType,
            customerName: dto.CustomerName ?? null,
            customerPhone: dto.CustomerPhone ?? null,
            note: dto.Note ?? null,
            subtotal: dto.Subtotal,
            discountAmount: dto.DiscountAmount,
            taxAmount: dto.TaxAmount,
            deliveryFee: dto.DeliveryFee,
            deliveryAddress: dto.DeliveryAddress ?? null,
            totalAmount: dto.TotalAmount,
            paymentMethod: dto.PaymentMethod ?? null,
            paymentStatus: dto.PaymentStatus ?? null,
            amountReceived: dto.AmountReceived ?? null,
            changeAmount: dto.ChangeAmount ?? null,
            paidAt: dto.PaidAt ?? null,
            cancelledAt: dto.CancelledAt ?? null,
            cancelledReason: dto.CancelledReason ?? null,
            createdAt: dto.CreatedAt ?? null,
            createdBy: dto.CreatedBy ?? null,
            updatedAt: dto.UpdatedAt ?? null,
            updatedBy: dto.UpdatedBy ?? null,
            items: (dto.Items ?? []).map((item) => this.toItemViewModel(item)),
        }
    },

    toItemViewModel(dto: OrderItemDto): OrderItemViewModel {
        return {
            id: dto.Id,
            productId: dto.ProductId,
            productCode: dto.ProductCode,
            productName: dto.ProductName,
            regularPrice: dto.RegularPrice,
            optionsAmount: dto.OptionsAmount,
            salePrice: dto.SalePrice,
            quantity: dto.Quantity,
            lineAmount: dto.LineAmount,
            discountAmount: dto.DiscountAmount,
            lineNetAmount: dto.LineNetAmount,
            note: dto.Note ?? null,
            options: (dto.Options ?? []).map((opt) => this.toItemOptionViewModel(opt)),
        }
    },

    toItemOptionViewModel(dto: OrderItemOptionDto): OrderItemOptionViewModel {
        return {
            id: dto.Id,
            optionId: dto.OptionId,
            groupName: dto.GroupName ?? null,
            optionName: dto.OptionName,
            price: dto.Price,
        }
    },
}
```

- [ ] **Step 5: Type-check để verify**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 lỗi type (các file này chưa được import ở đâu nên chỉ kiểm tra cú pháp nội bộ).

- [ ] **Step 6: Commit**

```bash
git add NDTCore.FE/src/modules/order/models NDTCore.FE/src/modules/order/mappers
git commit -m "feat: add Order module DTOs, view-models, and mapper"
```

---

### Task F3b: Order module — Client + API + Service + Composable + Constants

**Files:**
- Create: `NDTCore.FE/src/core/api/clients/order.client.ts`
- Create: `NDTCore.FE/src/modules/order/api/order.api.ts`
- Create: `NDTCore.FE/src/modules/order/services/order.service.ts`
- Create: `NDTCore.FE/src/modules/order/composables/useOrder.ts`
- Create: `NDTCore.FE/src/modules/order/constants/order-list.constants.ts`

**Interfaces:**
- Consumes: `API_ENDPOINTS.ORDER.ADMIN_API.*` (Task F2), `OrderDto`/`OrderFilterDto`/`UpdateOrderStatusRequest`/`CancelOrderRequest` (Task F3a), `orderMapper` (Task F3a), `PagedResult<T>` (`@/core/types/pagination.types`, đã có sẵn), `useToastNotification` (đã có sẵn).
- Produces: `useOrder() : { getPagedOrders, getOrder, updateOrderStatus, cancelOrder }` — dùng bởi Task F4 (`OrdersView.vue`) và Task F5 (`OrderDetailView.vue`). `ORDER_STATUS`, `ORDER_STATUS_CONFIG`, `ORDER_LIST_COLUMNS`, `buildOrderFilterFields(...)` — dùng bởi Task F4.

`VITE_ORDER_BASE_URL` đã có sẵn trong `.env.development` (`https://localhost:44392/api`) — không cần thêm biến môi trường mới.

- [ ] **Step 1: Tạo `order.client.ts`, mirror chính xác `store.client.ts`**

```ts
// NDTCore.FE/src/core/api/clients/order.client.ts
import { BaseClient } from './base.client'

const ENV_ORDER_API_URL = import.meta.env.VITE_ORDER_BASE_URL as string | undefined
if (!ENV_ORDER_API_URL) throw new Error('[OrderClient] VITE_ORDER_BASE_URL is not defined')

export class OrderClient extends BaseClient {
    constructor() {
        super({
            baseURL: ENV_ORDER_API_URL,
        })
    }
}

export const orderClient = new OrderClient()
```

- [ ] **Step 2: Tạo `order.api.ts`**

```ts
// NDTCore.FE/src/modules/order/api/order.api.ts
import { API_ENDPOINTS } from '@/core/constants/api.constants'
import type { ApiResponse, PagedApiResponse } from '@/core/models/common.dto'
import type {
    OrderDto,
    UpdateOrderStatusRequest,
    UpdateOrderStatusResponse,
    CancelOrderRequest,
    CancelOrderResponse,
} from '@/modules/order/models/dtos/order.dto'
import type { OrderFilterDto } from '@/modules/order/models/dtos/order-filter.dto'
import { orderClient } from '@/core/api/clients/order.client'

export const orderApi = {
    getPagedAsync(params: OrderFilterDto): Promise<PagedApiResponse<OrderDto>> {
        return orderClient.get(API_ENDPOINTS.ORDER.ADMIN_API.GET_PAGED, params)
    },

    getByIdAsync(id: number): Promise<ApiResponse<OrderDto>> {
        return orderClient.get(API_ENDPOINTS.ORDER.ADMIN_API.GET_BY_ID(id))
    },

    updateStatusAsync(
        id: number,
        payload: UpdateOrderStatusRequest,
    ): Promise<ApiResponse<UpdateOrderStatusResponse>> {
        return orderClient.patch(API_ENDPOINTS.ORDER.ADMIN_API.UPDATE_STATUS(id), payload)
    },

    cancelAsync(id: number, payload: CancelOrderRequest): Promise<ApiResponse<CancelOrderResponse>> {
        return orderClient.post(API_ENDPOINTS.ORDER.ADMIN_API.CANCEL(id), payload)
    },
}
```

- [ ] **Step 3: Tạo `order.service.ts`**

`updateStatusAsync`/`cancelAsync` trả về response tối giản (không đủ field để dựng lại `OrderViewModel` đầy đủ) — service chỉ `await` để propagate lỗi, phần gọi lại `getOrderAsync(id)` để refresh chi tiết đầy đủ thuộc về Task F5 (`OrderDetailView.vue`), không lặp logic mapping ở đây.

```ts
// NDTCore.FE/src/modules/order/services/order.service.ts
import { orderApi } from '@/modules/order/api/order.api'
import { orderMapper } from '@/modules/order/mappers/order.mapper'
import type { OrderFilterDto } from '@/modules/order/models/dtos/order-filter.dto'
import type { UpdateOrderStatusRequest, CancelOrderRequest } from '@/modules/order/models/dtos/order.dto'
import type { OrderViewModel } from '@/modules/order/models/view-models/order.view-model'
import type { PagedResult } from '@/core/types/pagination.types'

class OrderService {
    async getPagedOrdersAsync(filter: OrderFilterDto): Promise<PagedResult<OrderViewModel>> {
        const response = await orderApi.getPagedAsync(filter)
        return {
            items: orderMapper.toViewModels(response.Data ?? []),
            pageNumber: response.PageNumber,
            pageSize: response.PageSize,
            totalCount: response.TotalCount,
            totalPages: response.TotalPages,
            hasPreviousPage: response.HasPreviousPage,
            hasNextPage: response.HasNextPage,
        }
    }

    async getOrderAsync(id: number): Promise<OrderViewModel | null> {
        const response = await orderApi.getByIdAsync(id)
        return response.Data ? orderMapper.toViewModel(response.Data) : null
    }

    async updateOrderStatusAsync(id: number, payload: UpdateOrderStatusRequest): Promise<void> {
        await orderApi.updateStatusAsync(id, payload)
    }

    async cancelOrderAsync(id: number, payload: CancelOrderRequest): Promise<void> {
        await orderApi.cancelAsync(id, payload)
    }
}

export const orderService = new OrderService()
```

- [ ] **Step 4: Tạo `useOrder.ts`**

```ts
// NDTCore.FE/src/modules/order/composables/useOrder.ts
import { useToastNotification } from '@/composables/useToastNotification'
import { orderService } from '@/modules/order/services/order.service'
import type { OrderFilterDto } from '@/modules/order/models/dtos/order-filter.dto'
import type { UpdateOrderStatusRequest, CancelOrderRequest } from '@/modules/order/models/dtos/order.dto'

export function useOrder() {
    const toast = useToastNotification()

    async function getPagedOrders(filter: OrderFilterDto) {
        try {
            return await orderService.getPagedOrdersAsync(filter)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Không thể tải danh sách đơn hàng.')
            throw error
        }
    }

    async function getOrder(id: number) {
        try {
            return await orderService.getOrderAsync(id)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Không thể tải chi tiết đơn hàng.')
            throw error
        }
    }

    async function updateOrderStatus(id: number, payload: UpdateOrderStatusRequest) {
        try {
            await orderService.updateOrderStatusAsync(id, payload)
            toast.success('Cập nhật trạng thái đơn hàng thành công.')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Cập nhật trạng thái đơn hàng thất bại.')
            throw error
        }
    }

    async function cancelOrder(id: number, payload: CancelOrderRequest) {
        try {
            await orderService.cancelOrderAsync(id, payload)
            toast.success('Huỷ đơn hàng thành công.')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Huỷ đơn hàng thất bại.')
            throw error
        }
    }

    return { getPagedOrders, getOrder, updateOrderStatus, cancelOrder }
}
```

- [ ] **Step 5: Tạo `order-list.constants.ts` — status constants/config, columns, filter fields builder**

```ts
// NDTCore.FE/src/modules/order/constants/order-list.constants.ts
import type { FilterField, FilterOption, TableColumn, StatusConfig } from '@/components/ui'
import type { OrderViewModel } from '@/modules/order/models/view-models/order.view-model'

export const ORDER_STATUS = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
} as const

export const ORDER_STATUS_CONFIG: Record<string, StatusConfig> = {
    [ORDER_STATUS.PENDING]: { label: 'Chờ xác nhận', color: 'warning', icon: 'mdi-clock-outline', variant: 'tonal' },
    [ORDER_STATUS.CONFIRMED]: { label: 'Đã xác nhận', color: 'info', icon: 'mdi-progress-clock', variant: 'tonal' },
    [ORDER_STATUS.COMPLETED]: { label: 'Hoàn thành', color: 'success', icon: 'mdi-check-circle-outline', variant: 'tonal' },
    [ORDER_STATUS.CANCELLED]: { label: 'Đã huỷ', color: 'error', icon: 'mdi-close-circle-outline', variant: 'tonal' },
}

export const ORDER_LIST_COLUMNS: TableColumn[] = [
    { key: 'orderNumber', title: 'Mã đơn', sortable: true, minWidth: '140px' },
    { key: 'status', title: 'Trạng thái', width: '140px', align: 'center' },
    { key: 'channel', title: 'Kênh', width: '110px', hideBelow: 'md' },
    { key: 'customerName', title: 'Khách hàng', minWidth: '160px', hideBelow: 'md' },
    { key: 'totalAmount', title: 'Tổng tiền', width: '130px', align: 'end' },
    { key: 'createdAt', title: 'Thời gian tạo', width: '170px', sortable: true },
]

export function buildOrderFilterFields(
    storeOptions: FilterOption[],
    brandOptions: FilterOption[] | null,
): FilterField[] {
    const fields: FilterField[] = []

    if (brandOptions) {
        fields.push({
            key: 'brandId',
            label: 'Thương hiệu',
            type: 'select',
            options: [{ label: 'Tất cả', value: null }, ...brandOptions],
        })
    }

    fields.push(
        {
            key: 'storeId',
            label: 'Cửa hàng',
            type: 'select',
            options: [{ label: 'Tất cả', value: null }, ...storeOptions],
        },
        {
            key: 'status',
            label: 'Trạng thái',
            type: 'select',
            options: [
                { label: 'Tất cả', value: null },
                { label: 'Chờ xác nhận', value: ORDER_STATUS.PENDING },
                { label: 'Đã xác nhận', value: ORDER_STATUS.CONFIRMED },
                { label: 'Hoàn thành', value: ORDER_STATUS.COMPLETED },
                { label: 'Đã huỷ', value: ORDER_STATUS.CANCELLED },
            ],
        },
        {
            key: 'channel',
            label: 'Kênh',
            type: 'select',
            options: [
                { label: 'Tất cả', value: null },
                { label: 'POS', value: 'Pos' },
                { label: 'Online', value: 'Online' },
                { label: 'Kiosk', value: 'Kiosk' },
            ],
        },
        { key: 'dateRange', label: 'Ngày tạo', type: 'daterange' },
    )

    return fields
}

export type OrderRowClickHandler = (item: OrderViewModel) => void
```

`brandOptions: null` được dùng khi user không phải SuperAdmin/OrgAdmin (ẩn filter Brand) — quyết định này thuộc Task F4 (`OrdersView.vue`), nơi tính `canSeeBrandFilter` từ role hiện tại.

- [ ] **Step 6: Type-check để verify**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 lỗi type.

- [ ] **Step 7: Commit**

```bash
git add NDTCore.FE/src/core/api/clients/order.client.ts NDTCore.FE/src/modules/order/api NDTCore.FE/src/modules/order/services NDTCore.FE/src/modules/order/composables NDTCore.FE/src/modules/order/constants
git commit -m "feat: add Order module client, API, service, composable, and list constants"
```

---

### Task F4: `OrdersView.vue` — trang danh sách đơn hàng

**Files:**
- Create: `NDTCore.FE/src/modules/order/views/OrdersView.vue`

**Interfaces:**
- Consumes: `useOrder().getPagedOrders` (F3b), `useListPage`/`ListPageParams` (`@/components/ui/composables`, đã có sẵn), `useStore().getPagedStores` + `useBrand().getPagedBrands` (đã có sẵn, dùng để build dropdown), `useUserStore().profile.Roles` (đã có sẵn), `buildOrderFilterFields`/`ORDER_LIST_COLUMNS`/`ORDER_STATUS_CONFIG` (F3b), `APP_ROUTES.ADMIN.CHILDREN.ORDER_DETAIL` (F1).
- Produces: route component cho `admin:orders` (đã khai báo ở F1).

Không tạo component `OrderList.vue` riêng (khác với `store` module) — module `order` không có create/edit form và view-detail là 1 route riêng, nên list UI gộp thẳng vào view container để giảm số file không cần thiết.

- [ ] **Step 1: Tạo file**

```vue
<!-- NDTCore.FE/src/modules/order/views/OrdersView.vue -->
<template>
    <div class="d-flex flex-column ga-4">
        <AppPageHeader title="Đơn hàng" subtitle="Theo dõi và xử lý đơn hàng">
            <template #breadcrumb>
                <AppBreadcrumb
                    :items="[
                        { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                        { title: 'Đơn hàng', disabled: true },
                    ]"
                />
            </template>
        </AppPageHeader>

        <AppFilterBar>
            <AppDataFilter
                :fields="filterFields"
                :model-value="listPage.filters.activeFilters.value"
                @update:model-value="listPage.filters.setFilters"
                @search="listPage.onSearch"
            />

            <template #actions>
                <v-btn variant="text" prepend-icon="mdi-filter-off-outline" @click="onResetFilters">
                    Xóa lọc
                </v-btn>
                <v-btn color="primary" prepend-icon="mdi-magnify" @click="listPage.onSearch">
                    Tìm kiếm
                </v-btn>
            </template>
        </AppFilterBar>

        <v-card rounded="lg">
            <AppDataTable
                :items="viewItems"
                :columns="ORDER_LIST_COLUMNS"
                :loading="listPage.loading.value"
                :sort-by="listPage.sortBy.value"
                item-key="id"
                @update:sort-by="listPage.onSort"
                @row-click="onRowClick"
            >
                <template #[`item.status`]="{ item }">
                    <AppStatusChip :config="ORDER_STATUS_CONFIG[item.status as string]" />
                </template>

                <template #[`item.totalAmount`]="{ item }">
                    {{ formatCurrency(item.totalAmount as number) }}
                </template>

                <template #[`item.createdAt`]="{ item }">
                    {{ formatDateTime(item.createdAt as string | null) }}
                </template>

                <template #empty>
                    <AppEmptyState
                        icon="mdi-clipboard-text-off-outline"
                        title="Không có đơn hàng"
                        description="Không tìm thấy đơn hàng phù hợp với điều kiện lọc."
                    />
                </template>
            </AppDataTable>

            <v-divider />

            <AppPagination
                :page-number="listPage.pagination.pageNumber.value"
                :page-size="listPage.pagination.pageSize.value"
                :total-pages="listPage.pagination.totalPages.value"
                :total-items="listPage.pagination.totalItems.value"
                @update:page-number="listPage.onPageChange"
                @update:page-size="listPage.onPageSizeChange"
            />
        </v-card>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
    AppBreadcrumb,
    AppPageHeader,
    AppFilterBar,
    AppDataFilter,
    AppDataTable,
    AppPagination,
    AppStatusChip,
    AppEmptyState,
} from '@/components/ui'
import type { FilterOption } from '@/components/ui'
import { useListPage } from '@/components/ui/composables'
import type { ListPageParams } from '@/components/ui/composables'
import { APP_ROUTES, DEFAULT_PAGINATION, SYSTEM_ROLES } from '@/core/constants/_index'
import { useUserStore } from '@/modules/user/stores/user.store'
import { useOrder } from '@/modules/order/composables/useOrder'
import { useStore } from '@/modules/store/composables/useStore'
import { useBrand } from '@/modules/brand/composables/useBrand'
import {
    ORDER_LIST_COLUMNS,
    ORDER_STATUS_CONFIG,
    buildOrderFilterFields,
} from '@/modules/order/constants/order-list.constants'
import type { OrderViewModel } from '@/modules/order/models/view-models/order.view-model'

const router = useRouter()
const userStore = useUserStore()
const { getPagedOrders } = useOrder()
const { getPagedStores } = useStore()
const { getPagedBrands } = useBrand()

// ── Role-based filter visibility ────────────────────────────────────────────
const userRoles = computed(() => userStore.profile?.Roles?.map((r) => r.Name) ?? [])
const canSeeBrandFilter = computed(() =>
    userRoles.value.some((r) => [SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ORG_ADMIN].includes(r)),
)

// ── Filter options ─────────────────────────────────────────────────────────
const storeOptions = ref<FilterOption[]>([])
const brandOptions = ref<FilterOption[]>([])
const filterFields = computed(() =>
    buildOrderFilterFields(storeOptions.value, canSeeBrandFilter.value ? brandOptions.value : null),
)

// ── List page ───────────────────────────────────────────────────────────────
const fetchOrders = async (params: ListPageParams): Promise<{ items: OrderViewModel[]; total: number }> => {
    const dateRange = params.filters['dateRange'] as [string, string] | null
    const result = await getPagedOrders({
        PageNumber: params.pageNumber,
        PageSize: params.pageSize,
        StoreId: params.filters['storeId'] ? Number(params.filters['storeId']) : null,
        Status: (params.filters['status'] as string | null) ?? null,
        Channel: (params.filters['channel'] as string | null) ?? null,
        FromDate: dateRange?.[0] ? `${dateRange[0]}T00:00:00` : null,
        ToDate: dateRange?.[1] ? `${dateRange[1]}T23:59:59` : null,
        SortBy: params.sortBy?.key ?? null,
        SortDirection: params.sortBy?.order ?? null,
    })
    return { items: result.items, total: result.totalCount }
}

const listPage = useListPage<OrderViewModel>({
    fetchFn: fetchOrders,
    keyField: 'id',
    defaultPageSize: DEFAULT_PAGINATION.LIMIT,
})

const viewItems = computed<OrderViewModel[]>(() => listPage.items.value ?? [])

const onResetFilters = async () => {
    listPage.filters.resetFilters()
    applyTodayDefault()
    listPage.pagination.reset()
    await listPage.refresh()
}

watch(
    () => listPage.filters.activeFilters.value['brandId'],
    async (brandId) => {
        listPage.filters.setFilter('storeId', null)
        const result = await getPagedStores({
            PageNumber: 1,
            PageSize: 200,
            BrandId: brandId ? Number(brandId) : null,
        })
        storeOptions.value = result.items.map((s) => ({ label: s.name, value: s.id }))
    },
)

function applyTodayDefault(): void {
    const today = new Date().toISOString().slice(0, 10)
    listPage.filters.setFilter('dateRange', [today, today])
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return '—'
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function onRowClick(item: OrderViewModel): void {
    void router.push({ name: APP_ROUTES.ADMIN.CHILDREN.ORDER_DETAIL.NAME, params: { id: item.id } })
}

onMounted(async () => {
    const storesResult = await getPagedStores({ PageNumber: 1, PageSize: 200 })
    storeOptions.value = storesResult.items.map((s) => ({ label: s.name, value: s.id }))

    if (canSeeBrandFilter.value) {
        const brandsResult = await getPagedBrands({ PageNumber: 1, PageSize: 200 })
        brandOptions.value = brandsResult.items.map((b) => ({ label: b.name, value: b.id }))
    }

    applyTodayDefault()
    await listPage.refresh()
})
</script>
```

`AppDataTable`'s `@row-click` emits the raw item (đã xác nhận qua cách dùng trong `StoreList.vue`: `@row-click="(item) => emit(...)"`) — nên `onRowClick(item: OrderViewModel)` nhận trực tiếp item, không cần ép kiểu.

- [ ] **Step 2: Type-check để verify**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 lỗi type.

- [ ] **Step 3: Chạy dev server và kiểm tra thủ công**

Run: `cd NDTCore.FE && npm run dev`

Mở `http://localhost:<port>/admin/orders`, đăng nhập bằng tài khoản `SuperAdmin` → kỳ vọng thấy filter Brand + Store, bảng đơn hàng load mặc định theo ngày hôm nay. Đăng nhập bằng `BrandManager`/`FranchiseeOwner` → kỳ vọng không thấy filter Brand, dropdown Store chỉ chứa store thuộc phạm vi của họ (nhờ Task B5).

- [ ] **Step 4: Commit**

```bash
git add NDTCore.FE/src/modules/order/views/OrdersView.vue
git commit -m "feat: add OrdersView list page with role-scoped filters"
```

---

### Task F5: `OrderDetailView.vue` — trang chi tiết đơn hàng

**Files:**
- Create: `NDTCore.FE/src/modules/order/views/OrderDetailView.vue`

**Interfaces:**
- Consumes: `useOrder().{getOrder,updateOrderStatus,cancelOrder}` (F3b), `ORDER_STATUS`/`ORDER_STATUS_CONFIG` (F3b), `AppDialog` (đã có sẵn, dùng cho dialog huỷ đơn).
- Produces: route component cho `admin:order-detail` (đã khai báo ở F1).

- [ ] **Step 1: Tạo file**

```vue
<!-- NDTCore.FE/src/modules/order/views/OrderDetailView.vue -->
<template>
    <div class="d-flex flex-column ga-4">
        <AppPageHeader :title="order ? `Đơn hàng ${order.orderNumber}` : 'Chi tiết đơn hàng'" subtitle="Chi tiết đơn hàng">
            <template #breadcrumb>
                <AppBreadcrumb
                    :items="[
                        { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                        { title: 'Đơn hàng', to: `/${APP_ROUTES.ADMIN.BASE.PATH}/${APP_ROUTES.ADMIN.CHILDREN.ORDERS.PATH}` },
                        { title: order?.orderNumber ?? '...', disabled: true },
                    ]"
                />
            </template>

            <v-btn v-if="canConfirm" color="primary" prepend-icon="mdi-check" :loading="actionLoading" @click="onConfirm">
                Xác nhận
            </v-btn>
            <v-btn v-if="canComplete" color="success" prepend-icon="mdi-check-all" :loading="actionLoading" @click="onComplete">
                Hoàn thành
            </v-btn>
            <v-btn v-if="canCancel" color="error" variant="outlined" prepend-icon="mdi-close" :loading="actionLoading" @click="isCancelDialogOpen = true">
                Huỷ đơn
            </v-btn>
        </AppPageHeader>

        <v-skeleton-loader v-if="loading" type="card" />

        <template v-else-if="order">
            <v-card rounded="lg">
                <v-card-text class="d-flex flex-wrap ga-6">
                    <div>
                        <div class="text-caption text-medium-emphasis">Trạng thái</div>
                        <AppStatusChip :config="ORDER_STATUS_CONFIG[order.status]" />
                    </div>
                    <div>
                        <div class="text-caption text-medium-emphasis">Kênh</div>
                        <div>{{ order.channel ?? '—' }}</div>
                    </div>
                    <div>
                        <div class="text-caption text-medium-emphasis">Loại phục vụ</div>
                        <div>{{ order.serviceType }}</div>
                    </div>
                    <div>
                        <div class="text-caption text-medium-emphasis">Khách hàng</div>
                        <div>{{ order.customerName ?? '—' }} {{ order.customerPhone ? `(${order.customerPhone})` : '' }}</div>
                    </div>
                    <div>
                        <div class="text-caption text-medium-emphasis">Thời gian tạo</div>
                        <div>{{ formatDateTime(order.createdAt) }}</div>
                    </div>
                    <div v-if="order.cancelledReason">
                        <div class="text-caption text-medium-emphasis">Lý do huỷ</div>
                        <div>{{ order.cancelledReason }}</div>
                    </div>
                </v-card-text>
            </v-card>

            <v-card rounded="lg">
                <v-table>
                    <thead>
                        <tr>
                            <th>Sản phẩm</th>
                            <th class="text-end">SL</th>
                            <th class="text-end">Đơn giá</th>
                            <th class="text-end">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in order.items" :key="item.id">
                            <td>
                                <div class="font-weight-medium">{{ item.productName }}</div>
                                <div v-if="item.options.length" class="text-caption text-medium-emphasis">
                                    {{ item.options.map((o) => o.optionName).join(', ') }}
                                </div>
                                <div v-if="item.note" class="text-caption text-medium-emphasis">Note: {{ item.note }}</div>
                            </td>
                            <td class="text-end">{{ item.quantity }}</td>
                            <td class="text-end">{{ formatCurrency(item.salePrice) }}</td>
                            <td class="text-end">{{ formatCurrency(item.lineNetAmount) }}</td>
                        </tr>
                    </tbody>
                </v-table>

                <v-divider />

                <v-card-text class="d-flex flex-column ga-1 align-end">
                    <div>Tạm tính: {{ formatCurrency(order.subtotal) }}</div>
                    <div v-if="order.discountAmount > 0">Giảm giá: -{{ formatCurrency(order.discountAmount) }}</div>
                    <div v-if="order.deliveryFee > 0">Phí giao hàng: {{ formatCurrency(order.deliveryFee) }}</div>
                    <div class="text-h6 font-weight-bold">Tổng cộng: {{ formatCurrency(order.totalAmount) }}</div>
                </v-card-text>
            </v-card>
        </template>

        <AppEmptyState
            v-else
            icon="mdi-alert-circle-outline"
            title="Không tìm thấy đơn hàng"
            description="Đơn hàng không tồn tại hoặc bạn không có quyền xem."
        />

        <AppDialog
            v-model="isCancelDialogOpen"
            title="Huỷ đơn hàng"
            size="sm"
            confirm-label="Huỷ đơn"
            cancel-label="Đóng"
            :loading="actionLoading"
            @confirm="onCancelConfirm"
        >
            <v-textarea
                v-model="cancelledReason"
                label="Lý do huỷ (tuỳ chọn)"
                rows="3"
                density="compact"
                hide-details="auto"
            />
        </AppDialog>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { AppBreadcrumb, AppPageHeader, AppStatusChip, AppEmptyState, AppDialog } from '@/components/ui'
import { APP_ROUTES } from '@/core/constants/_index'
import { useOrder } from '@/modules/order/composables/useOrder'
import { ORDER_STATUS, ORDER_STATUS_CONFIG } from '@/modules/order/constants/order-list.constants'
import type { OrderViewModel } from '@/modules/order/models/view-models/order.view-model'

const route = useRoute()
const { getOrder, updateOrderStatus, cancelOrder } = useOrder()

const orderId = Number(route.params.id)

const order = ref<OrderViewModel | null>(null)
const loading = ref(true)
const actionLoading = ref(false)
const isCancelDialogOpen = ref(false)
const cancelledReason = ref('')

const canConfirm = computed(() => order.value?.status === ORDER_STATUS.PENDING)
const canComplete = computed(() => order.value?.status === ORDER_STATUS.CONFIRMED)
const canCancel = computed(
    () => order.value?.status === ORDER_STATUS.PENDING || order.value?.status === ORDER_STATUS.CONFIRMED,
)

async function loadOrder(): Promise<void> {
    loading.value = true
    try {
        order.value = await getOrder(orderId)
    } finally {
        loading.value = false
    }
}

async function onConfirm(): Promise<void> {
    actionLoading.value = true
    try {
        await updateOrderStatus(orderId, { Status: ORDER_STATUS.CONFIRMED })
        await loadOrder()
    } finally {
        actionLoading.value = false
    }
}

async function onComplete(): Promise<void> {
    actionLoading.value = true
    try {
        await updateOrderStatus(orderId, { Status: ORDER_STATUS.COMPLETED })
        await loadOrder()
    } finally {
        actionLoading.value = false
    }
}

async function onCancelConfirm(): Promise<void> {
    actionLoading.value = true
    try {
        await cancelOrder(orderId, { CancelledReason: cancelledReason.value || null })
        isCancelDialogOpen.value = false
        cancelledReason.value = ''
        await loadOrder()
    } finally {
        actionLoading.value = false
    }
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return '—'
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

onMounted(loadOrder)
</script>
```

`@confirm`/`@cancel` trên `AppDialog` là tên event literal đã được dùng trực tiếp ở `StoresView.vue` (`@confirm="doDelete"`) — không cần qua `AppDialogEmits` type ở nơi gọi.

- [ ] **Step 2: Type-check để verify**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 lỗi type.

- [ ] **Step 3: Chạy dev server và kiểm tra thủ công**

Mở 1 đơn hàng ở trạng thái `Pending` → bấm "Xác nhận" → kỳ vọng trạng thái chuyển `Confirmed` và nút đổi thành "Hoàn thành". Bấm "Huỷ đơn" trên 1 đơn `Pending`/`Confirmed` → nhập lý do → xác nhận → kỳ vọng trạng thái chuyển `Cancelled`, nút hành động biến mất, "Lý do huỷ" hiển thị đúng giá trị đã nhập.

Test cross-scope: đăng nhập `FranchiseeOwner` A, thử truy cập trực tiếp URL `/admin/orders/<id của đơn thuộc franchisee B>` → kỳ vọng `AppEmptyState` "Không tìm thấy đơn hàng" (do BE trả `403 Forbidden`, FE coi `Data: null` là không có quyền xem).

- [ ] **Step 4: Commit**

```bash
git add NDTCore.FE/src/modules/order/views/OrderDetailView.vue
git commit -m "feat: add OrderDetailView with status transitions and cancel dialog"
```

---

### Task Final: Smoke test end-to-end (BE + FE)

**Files:** không tạo/sửa file — chỉ verify thủ công, chạy sau khi toàn bộ Task B1-B5, F1-F5 hoàn tất.

- [ ] **Step 1: Chạy BE**

Run: `cd NDTCore.BE/src/NDTCore.API && dotnet run`
Expected: API khởi động thành công, Swagger UI truy cập được.

- [ ] **Step 2: Verify route thật của `OrderController`**

Trong Swagger UI, xác nhận group `Order` có các path: `GET /api/admin/Order`, `GET /api/admin/Order/{id}`, `PATCH /api/admin/Order/{id}/status`, `POST /api/admin/Order/{id}/cancel`, `POST /api/admin/Order` — route số ít, đúng như Task B3 đã xác nhận.

- [ ] **Step 3: Chạy FE**

Run: `cd NDTCore.FE && npm run dev`

- [ ] **Step 4: Test theo từng role**

| Role | Kỳ vọng |
|---|---|
| `SuperAdmin`/`OrgAdmin` | Thấy menu "Đơn hàng", filter Brand + Store, xem được mọi đơn hàng không giới hạn. |
| `BrandManager` | Thấy menu "Đơn hàng", **không** thấy filter Brand, dropdown Store chỉ gồm store thuộc brand của họ, truy cập đơn hàng ngoài brand → `403`. |
| `FranchiseeOwner` | Tương tự `BrandManager` nhưng giới hạn theo franchisee. |
| `Cashier`/`StoreManager`/role khác | Không thấy menu "Đơn hàng"; truy cập trực tiếp URL `/admin/orders` → redirect về Dashboard (route guard Task F1). |

- [ ] **Step 5: Test full flow 1 đơn hàng**

Tạo 1 đơn hàng qua POS (`Pending`) → vào trang Đơn hàng admin → mở chi tiết → Xác nhận (`Confirmed`) → Hoàn thành (`Completed`). Tạo đơn hàng khác → Huỷ với lý do → verify `CancelledReason` hiển thị đúng.

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task tương ứng |
|---|---|
| §1.1 Scoping decisions (BrandManager qua AppBrandUser, FranchiseeOwner qua AppFranchiseeUser, Brand dropdown chỉ SuperAdmin/OrgAdmin) | B1, B2, B4, B5, F4 |
| §2 List + filter, default = today | F4 |
| §2 Detail là route riêng (không phải dialog) | F1 (route `ORDER_DETAIL`), F5 |
| §2 Status change (Pending→Confirmed→Completed) | B4 (UpdateOrderStatusCommandHandler scope), F5 (nút hành động) — logic transition chính đã có sẵn từ trước, B4 chỉ thêm scope check |
| §2 Cancel (Pending/Confirmed → Cancelled, có lý do) | B4 (CancelOrderCommandHandler scope), F5 (dialog + textarea) |
| §3 B1-B5 | Task B1-B5 (đổi tên giữ nguyên thứ tự logic) |
| §4 Route/role + menu | F1 |
| Route thật `api/admin/Order` (đã sửa lỗi spec) | B3, F2 |

**2. Placeholder scan:** đã rà toàn bộ — không còn "TBD"/"tương tự task N"/code thiếu. Mọi step sửa file đều có code đầy đủ, không cắt ngắn.

**3. Type consistency:**
- `OrderScopeValidator.ValidateAsync` cùng signature được gọi giống nhau ở cả 4 handler (B4) — đã kiểm tra tham số theo đúng thứ tự `(contextAccessor, brandService, franchiseeService, storeService, storeId, ct)`.
- FE: `OrderDto`/`OrderFilterDto` (PascalCase, F3a) ánh xạ đúng field-by-field với BE `GetOrderResponse`/`OrderFilterDto` (đã đối chiếu từng property). `OrderViewModel` (camelCase) dùng nhất quán giữa `order.mapper.ts`, `OrdersView.vue`, `OrderDetailView.vue` — không có field nào đặt tên khác nhau giữa các file.
- `ORDER_STATUS.{PENDING,CONFIRMED,COMPLETED,CANCELLED}` dùng cùng giá trị string với BE `OrderStatus` constants (`"Pending"`, `"Confirmed"`, `"Completed"`, `"Cancelled"`) — đã đối chiếu.
- `API_ENDPOINTS.ORDER.ADMIN_API` (F2) được gọi đúng tên trong `order.api.ts` (F3b) — đã kiểm tra khớp `GET_PAGED`/`GET_BY_ID`/`UPDATE_STATUS`/`CANCEL`.
- `APP_ROUTES.ADMIN.CHILDREN.ORDERS`/`ORDER_DETAIL` (F1) được tham chiếu đúng tên ở `routes.ts`, `OrdersView.vue` (row-click), `OrderDetailView.vue` (breadcrumb) — không có chỗ nào gõ nhầm `ORDER` thay vì `ORDERS`.

---

## Execution Handoff

Plan đã lưu tại `docs/superpowers/plans/2026-06-22-order-management-admin.md`. Hai lựa chọn thực thi:

**1. Subagent-Driven (khuyến nghị)** — dispatch 1 subagent riêng cho mỗi task, review giữa các task, lặp nhanh.

**2. Inline Execution** — thực thi tuần tự trong session này theo `executing-plans`, batch execution với checkpoint để review.

**Bạn muốn dùng cách nào?**


**Files:** không tạo/sửa file — chỉ verify thủ công.

- [ ] **Step 1: Chạy API**

Run: `cd NDTCore.BE/src/NDTCore.API && dotnet run`
Expected: API khởi động thành công, Swagger UI truy cập được tại `https://localhost:<port>/swagger`.

- [ ] **Step 2: Verify route thật của OrderController**

Trong Swagger UI, xác nhận endpoint group hiển thị là `Order` với các path: `GET /api/admin/Order`, `GET /api/admin/Order/{id}`, `PATCH /api/admin/Order/{id}/status`, `POST /api/admin/Order/{id}/cancel`, `POST /api/admin/Order` — đúng route số ít đã xác nhận ở Task B3.

- [ ] **Step 3: Verify scoping bằng tài khoản BrandManager và FranchiseeOwner**

Login bằng tài khoản role `BrandManager`, gọi `GET /api/admin/Order?StoreId=<id của store thuộc brand khác>` → kỳ vọng `403 Forbidden`. Gọi lại với `StoreId` thuộc đúng brand mình → kỳ vọng `200 OK`. Lặp lại tương tự với tài khoản `FranchiseeOwner`.

---


**Files:**
- Modify: `NDTCore.BE/src/NDTCore.API/Controllers/Modules/Order/Admin/OrderController.cs`

**Interfaces:**
- Consumes: `SystemRoles.{BrandManager,FranchiseeOwner,OrgAdmin,SuperAdmin}` (`NDTCore.BuildingBlocks.Core.Constants`, đã có sẵn).
- Produces: không có API mới — chỉ siết quyền truy cập controller hiện có.

- [ ] **Step 1: Thêm using + đổi `[Authorize]` thành `[Authorize(Roles = ...)]`, mirror đúng cú pháp của `PosController.cs:20`**

```csharp
// NDTCore.API/Controllers/Modules/Order/Admin/OrderController.cs
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NDTCore.API.Controllers.Base;
using NDTCore.BuildingBlocks.Core.Constants;
using NDTCore.Order.Application.Features.Orders.CancelOrder;
using NDTCore.Order.Application.Features.Orders.CreateOrder;
using NDTCore.Order.Application.Features.Orders.GetOrderById;
using NDTCore.Order.Application.Features.Orders.GetPagedOrders;
using NDTCore.Order.Application.Features.Orders.UpdateOrderStatus;
using NDTCore.Order.Contracts.Models.Orders;
using NDTCore.Order.Contracts.ViewModels.Orders;

namespace NDTCore.API.Controllers.Modules.Order.Admin;

/// <summary>
/// VN: Quản lý đơn hàng dành cho admin. <br />
/// EN: Admin order management endpoints.
/// </summary>
[Authorize(Roles = SystemRoles.BrandManager + "," + SystemRoles.FranchiseeOwner + "," + SystemRoles.OrgAdmin + "," + SystemRoles.SuperAdmin)]
public class OrderController : AdminControllerBase
{
    // ... toàn bộ phần còn lại của class giữ nguyên không đổi (constructor, các action methods)
}
```

Chỉ thay đổi 2 chỗ: thêm `using NDTCore.BuildingBlocks.Core.Constants;` và đổi attribute `[Authorize]` → `[Authorize(Roles = ...)]` ở dòng 19. Toàn bộ method bodies (`CreateOrder`, `GetPagedOrders`, `GetOrderById`, `UpdateOrderStatus`, `CancelOrder`) giữ nguyên 100%.

- [ ] **Step 2: Build để verify**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 Error(s).

- [ ] **Step 3: Commit**

```bash
git add NDTCore.BE/src/NDTCore.API/Controllers/Modules/Order/Admin/OrderController.cs
git commit -m "feat: restrict OrderController to admin-facing roles"
```

---
