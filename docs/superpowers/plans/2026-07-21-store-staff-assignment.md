# Store Staff Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép SuperAdmin/OrgAdmin (toàn quyền) và FranchiseeOwner (giới hạn trong franchisee của mình) gán/gỡ user (đã có role `StoreManager`/`Cashier`/`OrderStaff`) làm thành viên của một cửa hàng, qua tab "Nhân viên" mới trong trang chi tiết cửa hàng — mảnh còn thiếu để tính năng store-access-by-role (đã implement trước đó) thực sự hoạt động.

**Architecture:** BE mirror gần như y hệt module Brand's Franchisee-member feature đã có sẵn (`GetFranchiseeMembersQueryHandler`/`AssignUsersToFranchiseeCommandHandler`/`RemoveUserFromFranchiseeCommandHandler`), thêm mới `AppStoreUser` repository + 3 CQRS feature + endpoint trên `StoreController`, cộng thêm 2 lớp kiểm tra riêng cho Store (role StoreManager/Cashier/OrderStaff bắt buộc, scope FranchiseeOwner). FE nối vào 5 file FE đã tồn tại sẵn dưới dạng bản nháp chưa khớp (dto/view-model/mapper/api/service cho `store-member`, phát hiện trong lúc khảo sát) — viết đè cho khớp response BE, thêm composable + component tab mới, gỡ trang placeholder độc lập.

**Tech Stack:** .NET 8 + EF Core 8 (BE, CQRS/MediatR/FluentValidation) — Vue 3 (Composition API) + TypeScript strict + Vuetify 3 (FE).

## Global Constraints

- BE: XML doc bắt buộc song ngữ VN/EN cho mọi class/interface/method/property **mới**, kể cả private — kể cả khi precedent (Franchisee) không có, vì đó là thiếu sót của code cũ, không phải quy ước cần copy.
- BE: Trước khi commit, `dotnet build NDTCore.sln` phải sạch (0 Error).
- FE: TypeScript strict, không dùng `any`.
- FE: Trước khi commit, `npx vue-tsc --build` phải sạch (exit code 0).
- Chỉ cho gán user đã có role `StoreManager`/`Cashier`/`OrderStaff` — kiểm tra ở `AssignStoreMembersCommandHandler`, trả `Error.Forbidden` liệt kê user không hợp lệ nếu vi phạm.
- Quyền quản lý (gán/gỡ/xem danh sách): SuperAdmin/OrgAdmin — toàn bộ store; FranchiseeOwner — chỉ store thuộc franchisee của mình (qua `IFranchiseeService.GetFranchiseeByUserIdAsync`); role khác bị `Error.Forbidden`.
- `AppStoreUser` có 2 cột audit mới `AssignedAt`/`AssignedBy` — luôn set tường minh trong handler (`AssignedAt = DateTimeOffset.UtcNow`, `AssignedBy = context.UserId`), không dựa vào default SQL, tránh lặp lại lỗi `TenantId = Guid.Empty` đã gặp với `AppUserRole`/`UserManager.AddToRolesAsync` trước đây (ở đây insert đi thẳng qua repository tự viết, không qua UserManager, nên không có rủi ro tương tự).
- Bỏ qua (không lỗi) khi gán user đã là thành viên rồi — giống hệt hành vi `AssignUsersToFranchiseeCommandHandler`.
- Không thêm cột "vai trò tại store" riêng trong `AppStoreUser` — role vẫn là thuộc tính toàn hệ thống của user (Identity module).
- Không backfill dữ liệu cho user seed hiện có — user cần được gán thủ công qua UI mới.

---

### Task 1: BE — Domain: mở rộng `AppStoreUser` + migration

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Domain/Entities/AppStoreUser.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/Persistence/Configurations/AppStoreUserConfiguration.cs`
- Create: EF migration mới cho `NdtStoreContext` (file do `dotnet ef migrations add` tự sinh)

**Interfaces:**
- Produces: `AppStoreUser.AssignedAt` (`DateTimeOffset`), `AppStoreUser.AssignedBy` (`string?`) — dùng bởi Task 5 (Assign handler set giá trị) và Task 4 (Get handler đọc `AssignedAt` để trả về FE).

- [ ] **Step 1: Thêm 2 property vào `AppStoreUser.cs`**

Thay toàn bộ nội dung file:

```csharp
using NDTCore.Store.Domain.Common;

namespace NDTCore.Store.Domain.Entities;

/// <summary>
/// VN: Thành viên thuộc cửa hàng. <br />
/// EN: Member belonging to a store.
/// </summary>
public class AppStoreUser : IMultiTenant
{
    /// <inheritdoc/>
    public Guid TenantId { get; set; }

    /// <summary>
    /// VN: Cửa hàng. <br />
    /// EN: Store.
    /// </summary>
    public int StoreId { get; set; }

    /// <summary>
    /// VN: Navigation tới cửa hàng sở hữu bản ghi này. <br />
    /// EN: Navigation to the store owning this record.
    /// </summary>
    public AppStore Store { get; set; } = default!;

    /// <summary>
    /// VN: FK tới Identity — không navigation property. <br />
    /// EN: FK to Identity — no navigation.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// VN: Thời điểm gán user vào cửa hàng. <br />
    /// EN: Timestamp when the user was assigned to the store.
    /// </summary>
    public DateTimeOffset AssignedAt { get; set; }

    /// <summary>
    /// VN: ID người thực hiện gán (giá trị của <c>INdtContextAccessor.Context.UserId</c>). <br />
    /// EN: Identifier of the user who performed the assignment (value of <c>INdtContextAccessor.Context.UserId</c>).
    /// </summary>
    public string? AssignedBy { get; set; }
}
```

- [ ] **Step 2: Cập nhật `AppStoreUserConfiguration.cs`**

Tìm:

```csharp
        builder.Property(e => e.UserId)
            .IsRequired();

        // ----- RELATIONSHIPS -----
```

Thay bằng:

```csharp
        builder.Property(e => e.UserId)
            .IsRequired();

        builder.Property(e => e.AssignedAt)
            .IsRequired();

        builder.Property(e => e.AssignedBy)
            .HasMaxLength(256);

        // ----- RELATIONSHIPS -----
```

- [ ] **Step 3: Tạo migration**

Run (từ `NDTCore.BE/src/NDTCore.API/`):

```bash
cd NDTCore.BE/src/NDTCore.API
dotnet ef migrations add AddAppStoreUserAssignmentAudit \
  --context NdtStoreContext \
  --project ../NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure \
  --startup-project . \
  --output-dir Persistence/Migrations
```

Expected: migration file mới sinh ra trong `NDTCore.Store.Infrastructure/Persistence/Migrations/` với 2 cột `AssignedAt`/`AssignedBy` thêm vào bảng `AppStoreUsers`, không đổi cột nào khác.

- [ ] **Step 4: Áp dụng migration vào DB dev**

Run:

```bash
dotnet ef database update --context NdtStoreContext --startup-project .
```

Expected: chạy thành công, không lỗi.

- [ ] **Step 5: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 6: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Domain/Entities/AppStoreUser.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/Persistence/Configurations/AppStoreUserConfiguration.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/Persistence/Migrations/
git commit -m "feat: them AssignedAt/AssignedBy vao AppStoreUser"
```

---

### Task 2: BE — Repository mới `IAppStoreUserRepository`

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/Interfaces/Repositories/IAppStoreUserRepository.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/Repositories/AppStoreUserRepository.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/ServiceCollectionExtensions.cs`

**Interfaces:**
- Consumes: `AppStoreUser` (Task 1), base `Repository<TEntity,TKey>` (`NDTCore.BuildingBlocks.Abstractions.Persistence`, đã có sẵn — cung cấp `DbSet`, `AddRangeAsync`, `Remove` miễn phí qua kế thừa).
- Produces: `IAppStoreUserRepository` với `GetByStoreIdAsync`, `GetByStoreIdAndUserIdsAsync`, `ExistsAsync`, `AddRangeAsync`, `Remove` — dùng bởi Task 4/5/6.

- [ ] **Step 1: Viết `IAppStoreUserRepository.cs`**

```csharp
using NDTCore.Store.Domain.Entities;

namespace NDTCore.Store.Contracts.Interfaces.Repositories;

/// <summary>
/// VN: Định nghĩa contract truy cập dữ liệu cho <see cref="AppStoreUser"/> — thành viên (nhân viên) thuộc cửa hàng. <br />
/// EN: Defines the data access contract for <see cref="AppStoreUser"/> — store staff members.
/// </summary>
public interface IAppStoreUserRepository
{
    /// <summary>
    /// VN: Lấy toàn bộ thành viên thuộc một cửa hàng. <br />
    /// EN: Retrieves all members belonging to a store.
    /// </summary>
    /// <param name="storeId">
    /// VN: ID của cửa hàng. <br />
    /// EN: The store ID.
    /// </param>
    /// <param name="cancellationToken">
    /// VN: Token để huỷ thao tác bất đồng bộ. <br />
    /// EN: A token to cancel the asynchronous operation.
    /// </param>
    Task<List<AppStoreUser>> GetByStoreIdAsync(int storeId, CancellationToken cancellationToken = default);

    /// <summary>
    /// VN: Lấy các bản ghi thành viên khớp cả cửa hàng và tập UserId — dùng để kiểm tra tồn tại trước khi gán/gỡ. <br />
    /// EN: Retrieves member records matching both the store and a set of UserIds — used to check existence before assign/remove.
    /// </summary>
    /// <param name="storeId">
    /// VN: ID của cửa hàng. <br />
    /// EN: The store ID.
    /// </param>
    /// <param name="userIds">
    /// VN: Tập UserId cần kiểm tra. <br />
    /// EN: The set of UserIds to check.
    /// </param>
    /// <param name="cancellationToken">
    /// VN: Token để huỷ thao tác bất đồng bộ. <br />
    /// EN: A token to cancel the asynchronous operation.
    /// </param>
    Task<List<AppStoreUser>> GetByStoreIdAndUserIdsAsync(
        int storeId,
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// VN: Kiểm tra một user có đang là thành viên của cửa hàng hay không. <br />
    /// EN: Checks whether a user is currently a member of the store.
    /// </summary>
    /// <param name="storeId">
    /// VN: ID của cửa hàng. <br />
    /// EN: The store ID.
    /// </param>
    /// <param name="userId">
    /// VN: ID của user cần kiểm tra. <br />
    /// EN: The user ID to check.
    /// </param>
    /// <param name="cancellationToken">
    /// VN: Token để huỷ thao tác bất đồng bộ. <br />
    /// EN: A token to cancel the asynchronous operation.
    /// </param>
    Task<bool> ExistsAsync(int storeId, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// VN: Thêm hàng loạt bản ghi thành viên mới. <br />
    /// EN: Adds a batch of new member records.
    /// </summary>
    /// <param name="entities">
    /// VN: Danh sách bản ghi cần thêm. <br />
    /// EN: The records to add.
    /// </param>
    /// <param name="cancellationToken">
    /// VN: Token để huỷ thao tác bất đồng bộ. <br />
    /// EN: A token to cancel the asynchronous operation.
    /// </param>
    Task AddRangeAsync(IEnumerable<AppStoreUser> entities, CancellationToken cancellationToken = default);

    /// <summary>
    /// VN: Xoá một bản ghi thành viên. <br />
    /// EN: Removes a member record.
    /// </summary>
    /// <param name="entity">
    /// VN: Bản ghi cần xoá. <br />
    /// EN: The record to remove.
    /// </param>
    void Remove(AppStoreUser entity);
}
```

- [ ] **Step 2: Viết `AppStoreUserRepository.cs`**

```csharp
using Microsoft.EntityFrameworkCore;
using NDTCore.BuildingBlocks.Abstractions.Persistence;
using NDTCore.Store.Contracts.Interfaces.Repositories;
using NDTCore.Store.Domain.Entities;
using NDTCore.Store.Infrastructure.Persistence.Context;

namespace NDTCore.Store.Infrastructure.Repositories;

/// <summary>
/// VN: Triển khai <see cref="IAppStoreUserRepository"/> — truy cập dữ liệu thành viên cửa hàng qua EF Core. <br />
/// EN: Implements <see cref="IAppStoreUserRepository"/> — EF Core data access for store members.
/// </summary>
public sealed class AppStoreUserRepository : Repository<AppStoreUser, Guid>, IAppStoreUserRepository
{
    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="AppStoreUserRepository"/>. <br />
    /// EN: Initializes a new instance of the <see cref="AppStoreUserRepository"/> class.
    /// </summary>
    /// <param name="dbContext">
    /// VN: DbContext của module Store. <br />
    /// EN: The Store module's DbContext.
    /// </param>
    public AppStoreUserRepository(NdtStoreDbContext dbContext) : base(dbContext)
    {
    }

    /// <inheritdoc/>
    public async Task<List<AppStoreUser>> GetByStoreIdAsync(int storeId, CancellationToken cancellationToken = default)
        => await DbSet.AsNoTracking()
            .Where(x => x.StoreId == storeId)
            .OrderBy(x => x.UserId)
            .ToListAsync(cancellationToken);

    /// <inheritdoc/>
    public async Task<List<AppStoreUser>> GetByStoreIdAndUserIdsAsync(
        int storeId,
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken = default)
    {
        if (userIds.Count == 0)
        {
            return [];
        }

        return await DbSet
            .Where(x => x.StoreId == storeId && userIds.Contains(x.UserId))
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> ExistsAsync(int storeId, Guid userId, CancellationToken cancellationToken = default)
        => await DbSet.AsNoTracking()
            .AnyAsync(x => x.StoreId == storeId && x.UserId == userId, cancellationToken);
}
```

> `AddRangeAsync`/`Remove` không cần viết lại — kế thừa sẵn từ base `Repository<AppStoreUser, Guid>` (xem `NDTCore.BuildingBlocks.Abstractions/Persistence/Repository.cs:74,82`), khớp signature `IAppStoreUserRepository` yêu cầu. `Guid` chỉ là generic `TKey` giữ chỗ (entity dùng composite key `(StoreId, UserId)`, không có khoá đơn) — giống hệt cách `FranchiseeUserRepository : Repository<AppFranchiseeUser, Guid>` đã làm.

- [ ] **Step 3: Đăng ký DI**

Trong `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/ServiceCollectionExtensions.cs`, tìm:

```csharp
    private static IServiceCollection AddStoreRepositories(this IServiceCollection services)
    {
        services.AddScoped<IAppStoreUnitOfWork, AppStoreUnitOfWork>();

        services.AddScoped<IAppStoreRepository, AppStoreRepository>();

        return services;
    }
```

Thay bằng:

```csharp
    private static IServiceCollection AddStoreRepositories(this IServiceCollection services)
    {
        services.AddScoped<IAppStoreUnitOfWork, AppStoreUnitOfWork>();

        services.AddScoped<IAppStoreRepository, AppStoreRepository>();
        services.AddScoped<IAppStoreUserRepository, AppStoreUserRepository>();

        return services;
    }
```

- [ ] **Step 4: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 5: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/Interfaces/Repositories/IAppStoreUserRepository.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/Repositories/AppStoreUserRepository.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/ServiceCollectionExtensions.cs
git commit -m "feat: them IAppStoreUserRepository cho thanh vien cua hang"
```

---

### Task 3: BE — Scope validator `StoreMemberScopeValidator`

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Common/StoreMemberScopeValidator.cs`

**Interfaces:**
- Consumes: `INdtContextAccessor` (đã có sẵn), `IFranchiseeService.GetFranchiseeByUserIdAsync(Guid, CancellationToken)` (`NDTCore.Brand.Contracts.Interfaces.Services`, đã public — `Store.Application.csproj` đã reference `Brand.Contracts.csproj` trực tiếp, không cần thêm project reference), `AppStore` entity (đã có sẵn, cần field `FranchiseeId`).
- Produces: `StoreMemberScopeValidator.ValidateAsync(...)` — dùng bởi Task 4/5/6, cả 3 handler cùng module nên dùng chung 1 static helper (không như `OrderScopeValidator` phải để module khác viết bản cục bộ riêng do rủi ro phụ thuộc ngược).

- [ ] **Step 1: Viết `StoreMemberScopeValidator.cs`**

```csharp
using NDTCore.Brand.Contracts.Interfaces.Services;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Core.Constants;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Store.Domain.Entities;

namespace NDTCore.Store.Application.Common;

/// <summary>
/// VN: Kiểm tra phạm vi truy cập khi quản lý thành viên cửa hàng (xem/gán/gỡ). SuperAdmin/OrgAdmin không giới hạn;
/// FranchiseeOwner chỉ được thao tác trên store thuộc franchisee của mình; role khác bị từ chối. <br />
/// EN: Validates access scope when managing store members (view/assign/remove). SuperAdmin/OrgAdmin are unrestricted;
/// FranchiseeOwner may only act on stores within their own franchisee; other roles are rejected.
/// </summary>
internal static class StoreMemberScopeValidator
{
    /// <summary>
    /// VN: Thực hiện kiểm tra phạm vi cho caller hiện tại đối với một store đã được load sẵn. <br />
    /// EN: Performs the scope check for the current caller against an already-loaded store.
    /// </summary>
    /// <param name="contextAccessor">
    /// VN: Truy cập ngữ cảnh người dùng hiện tại. <br />
    /// EN: Accessor for the current user context.
    /// </param>
    /// <param name="franchiseeService">
    /// VN: Dịch vụ tra cứu franchisee theo user. <br />
    /// EN: Service for looking up a franchisee by user.
    /// </param>
    /// <param name="store">
    /// VN: Store đã được load sẵn bởi handler gọi hàm này. <br />
    /// EN: The store already loaded by the calling handler.
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
        IFranchiseeService franchiseeService,
        AppStore store,
        CancellationToken cancellationToken)
    {
        var userIdRaw = contextAccessor.Context?.UserId;

        if (userIdRaw is null || !Guid.TryParse(userIdRaw, out var userId))
            return Error.Unauthorized("User context is missing.");

        var roles = contextAccessor.Context?.Roles ?? [];

        if (roles.Contains(SystemRoles.SuperAdmin) || roles.Contains(SystemRoles.OrgAdmin))
            return null;

        if (!roles.Contains(SystemRoles.FranchiseeOwner))
            return Error.Forbidden("Role is not permitted to manage store members.");

        var franchisee = await franchiseeService.GetFranchiseeByUserIdAsync(userId, cancellationToken);

        if (franchisee is null)
            return Error.Unauthorized("No franchisee found for the user.");

        return store.FranchiseeId == franchisee.Id
            ? null
            : Error.Forbidden("Store does not belong to your franchisee.");
    }
}
```

- [ ] **Step 2: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 3: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Common/StoreMemberScopeValidator.cs
git commit -m "feat: them StoreMemberScopeValidator"
```

---

### Task 4: BE — Feature `GetStoreMembers`

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Stores/StoreMemberResponse.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/GetStoreMembers/GetStoreMembersQuery.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/GetStoreMembers/GetStoreMembersQueryValidator.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/GetStoreMembers/GetStoreMembersQueryHandler.cs`

**Interfaces:**
- Consumes: `IAppStoreRepository.GetByIdAsync` (đã có sẵn qua base `IRepository<AppStore,int>`), `IAppStoreUserRepository.GetByStoreIdAsync` (Task 2), `StoreMemberScopeValidator.ValidateAsync` (Task 3), `IUserService.GetUsersByIdsAsync(IReadOnlyCollection<Guid>, CancellationToken)` (`NDTCore.Identity.Contracts.Interfaces.Services`, đã public — `Store.Application.csproj` đã reference `Identity.Contracts.csproj` trực tiếp).
- Produces: `GetStoreMembersQuery(int StoreId) : IQuery<List<StoreMemberResponse>>`, `StoreMemberResponse` — dùng bởi Task 7 (controller) và FE Task 8 (khớp field name).

- [ ] **Step 1: Viết `StoreMemberResponse.cs`**

```csharp
namespace NDTCore.Store.Contracts.ViewModels.Stores;

/// <summary>
/// VN: Thông tin một thành viên (nhân viên) của cửa hàng, đã enrich tên/email/role từ Identity module. <br />
/// EN: Information about a single store member (staff), enriched with name/email/roles from the Identity module.
/// </summary>
public sealed class StoreMemberResponse
{
    /// <summary>VN: ID cửa hàng. <br /> EN: Store ID.</summary>
    public int StoreId { get; set; }

    /// <summary>VN: ID tenant. <br /> EN: Tenant ID.</summary>
    public Guid TenantId { get; set; }

    /// <summary>VN: ID user. <br /> EN: User ID.</summary>
    public Guid UserId { get; set; }

    /// <summary>VN: Tên đăng nhập. <br /> EN: Username.</summary>
    public string UserName { get; set; } = string.Empty;

    /// <summary>VN: Email. <br /> EN: Email address.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>VN: Họ tên đầy đủ. <br /> EN: Full name.</summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>VN: URL ảnh đại diện. <br /> EN: Avatar URL.</summary>
    public string? AvatarUrl { get; set; }

    /// <summary>VN: Trạng thái hoạt động của user. <br /> EN: The user's active status.</summary>
    public bool IsActive { get; set; }

    /// <summary>VN: Danh sách role hiện có của user. <br /> EN: The user's current roles.</summary>
    public List<string> Roles { get; set; } = [];

    /// <summary>VN: Thời điểm được gán vào cửa hàng. <br /> EN: Timestamp when assigned to the store.</summary>
    public DateTimeOffset AssignedAt { get; set; }
}
```

- [ ] **Step 2: Viết `GetStoreMembersQuery.cs`**

```csharp
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.Store.Contracts.ViewModels.Stores;

namespace NDTCore.Store.Application.Features.Stores.GetStoreMembers;

/// <summary>
/// VN: Truy vấn lấy danh sách thành viên của một cửa hàng. <br />
/// EN: Query to retrieve the list of members belonging to a store.
/// </summary>
/// <param name="StoreId">
/// VN: ID cửa hàng cần lấy danh sách thành viên. <br />
/// EN: The ID of the store to retrieve members for.
/// </param>
public sealed record GetStoreMembersQuery(int StoreId) : IQuery<List<StoreMemberResponse>>;
```

- [ ] **Step 3: Viết `GetStoreMembersQueryValidator.cs`**

```csharp
using FluentValidation;

namespace NDTCore.Store.Application.Features.Stores.GetStoreMembers;

/// <summary>
/// VN: Validator cho <see cref="GetStoreMembersQuery"/>. <br />
/// EN: Validator for <see cref="GetStoreMembersQuery"/>.
/// </summary>
public sealed class GetStoreMembersQueryValidator : AbstractValidator<GetStoreMembersQuery>
{
    /// <summary>
    /// VN: Khởi tạo các rule kiểm tra cho <see cref="GetStoreMembersQuery"/>. <br />
    /// EN: Initializes the validation rules for <see cref="GetStoreMembersQuery"/>.
    /// </summary>
    public GetStoreMembersQueryValidator()
    {
        RuleFor(x => x.StoreId)
            .GreaterThan(0)
                .WithMessage("StoreId must be greater than 0.");
    }
}
```

- [ ] **Step 4: Viết `GetStoreMembersQueryHandler.cs`**

```csharp
using Microsoft.Extensions.Logging;
using NDTCore.Brand.Contracts.Interfaces.Services;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Identity.Contracts.Interfaces.Services;
using NDTCore.Store.Application.Common;
using NDTCore.Store.Contracts.Interfaces.Repositories;
using NDTCore.Store.Contracts.ViewModels.Stores;

namespace NDTCore.Store.Application.Features.Stores.GetStoreMembers;

/// <summary>
/// VN: Xử lý truy vấn lấy danh sách thành viên cửa hàng. Yêu cầu role SuperAdmin/OrgAdmin hoặc FranchiseeOwner
/// (chỉ store thuộc franchisee của mình). <br />
/// EN: Handles the query to retrieve store members. Requires SuperAdmin/OrgAdmin role, or FranchiseeOwner
/// (only for stores within their own franchisee).
/// </summary>
public sealed class GetStoreMembersQueryHandler : IQueryHandler<GetStoreMembersQuery, List<StoreMemberResponse>>
{
    private readonly ILogger<GetStoreMembersQueryHandler> _logger;
    private readonly INdtContextAccessor _contextAccessor;
    private readonly IAppStoreRepository _storeRepository;
    private readonly IAppStoreUserRepository _storeUserRepository;
    private readonly IFranchiseeService _franchiseeService;
    private readonly IUserService _userService;

    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="GetStoreMembersQueryHandler"/>. <br />
    /// EN: Initializes a new instance of the <see cref="GetStoreMembersQueryHandler"/> class.
    /// </summary>
    public GetStoreMembersQueryHandler(
        ILogger<GetStoreMembersQueryHandler> logger,
        INdtContextAccessor contextAccessor,
        IAppStoreRepository storeRepository,
        IAppStoreUserRepository storeUserRepository,
        IFranchiseeService franchiseeService,
        IUserService userService)
    {
        _logger = logger;
        _contextAccessor = contextAccessor;
        _storeRepository = storeRepository;
        _storeUserRepository = storeUserRepository;
        _franchiseeService = franchiseeService;
        _userService = userService;
    }

    /// <inheritdoc/>
    public async Task<Result<List<StoreMemberResponse>>> Handle(
        GetStoreMembersQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _contextAccessor.Context!.TenantId;

        var store = await _storeRepository.GetByIdAsync(request.StoreId, cancellationToken);

        if (store is null || store.TenantId != tenantId)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Store not found: StoreId={StoreId}",
                nameof(GetStoreMembersQueryHandler),
                nameof(Handle),
                request.StoreId);

            return Result<List<StoreMemberResponse>>.Failure(
                Error.NotFound($"Store '{request.StoreId}' was not found."));
        }

        var scopeError = await StoreMemberScopeValidator.ValidateAsync(
            _contextAccessor, _franchiseeService, store, cancellationToken);

        if (scopeError is not null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Scope validation failed: StoreId={StoreId}, ErrorCode={ErrorCode}",
                nameof(GetStoreMembersQueryHandler),
                nameof(Handle),
                request.StoreId,
                scopeError.ErrorCode);

            return Result<List<StoreMemberResponse>>.Failure(scopeError);
        }

        var members = await _storeUserRepository.GetByStoreIdAsync(request.StoreId, cancellationToken);

        if (members.Count == 0)
        {
            return Result<List<StoreMemberResponse>>.Success([]);
        }

        var userIds = members.Select(m => m.UserId).ToList();
        var users = await _userService.GetUsersByIdsAsync(userIds, cancellationToken);
        var userMap = users.ToDictionary(u => u.Id);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Loaded store members: StoreId={StoreId}, MemberCount={MemberCount}",
            nameof(GetStoreMembersQueryHandler),
            nameof(Handle),
            request.StoreId,
            members.Count);

        var response = members.Select(m =>
        {
            userMap.TryGetValue(m.UserId, out var user);

            return new StoreMemberResponse
            {
                StoreId = m.StoreId,
                TenantId = m.TenantId,
                UserId = m.UserId,
                UserName = user?.UserName ?? string.Empty,
                Email = user?.Email ?? string.Empty,
                FullName = user?.FullName ?? string.Empty,
                AvatarUrl = user?.AvatarUrl,
                IsActive = user?.IsActive ?? false,
                Roles = user?.Roles ?? [],
                AssignedAt = m.AssignedAt,
            };
        }).ToList();

        return Result<List<StoreMemberResponse>>.Success(response);
    }
}
```

- [ ] **Step 5: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 6: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Stores/StoreMemberResponse.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/GetStoreMembers/
git commit -m "feat: them GetStoreMembers query"
```

---

### Task 5: BE — Feature `AssignStoreMembers`

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Stores/AssignStoreMembersRequest.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Stores/AssignStoreMembersResponse.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/AssignStoreMembers/AssignStoreMembersCommand.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/AssignStoreMembers/AssignStoreMembersCommandValidator.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/AssignStoreMembers/AssignStoreMembersCommandHandler.cs`

**Interfaces:**
- Consumes: `IAppStoreRepository.GetByIdTrackedAsync` (đã có sẵn), `IAppStoreUserRepository.GetByStoreIdAndUserIdsAsync`/`AddRangeAsync` (Task 2), `StoreMemberScopeValidator.ValidateAsync` (Task 3), `IUserService.GetUsersByIdsAsync` (đã public), `IAppStoreUnitOfWork.SaveChangesAsync` (đã có sẵn).
- Produces: `AssignStoreMembersCommand(int StoreId, AssignStoreMembersRequest Request) : ICommand<AssignStoreMembersResponse>` — dùng bởi Task 7 (controller).

- [ ] **Step 1: Viết `AssignStoreMembersRequest.cs`**

```csharp
namespace NDTCore.Store.Contracts.ViewModels.Stores;

/// <summary>
/// VN: Request body để gán một hoặc nhiều user làm thành viên cửa hàng. <br />
/// EN: Request body to assign one or more users as store members.
/// </summary>
public sealed class AssignStoreMembersRequest
{
    /// <summary>
    /// VN: Danh sách ID user cần gán — mỗi user phải đã có role StoreManager/Cashier/OrderStaff. <br />
    /// EN: The list of user IDs to assign — each user must already hold the StoreManager/Cashier/OrderStaff role.
    /// </summary>
    public List<Guid> UserIds { get; set; } = [];
}
```

- [ ] **Step 2: Viết `AssignStoreMembersResponse.cs`**

```csharp
namespace NDTCore.Store.Contracts.ViewModels.Stores;

/// <summary>
/// VN: Kết quả gán thành viên cửa hàng. <br />
/// EN: Result of assigning store members.
/// </summary>
public sealed class AssignStoreMembersResponse
{
    /// <summary>VN: ID cửa hàng. <br /> EN: Store ID.</summary>
    public int StoreId { get; set; }

    /// <summary>
    /// VN: Danh sách UserId thực sự vừa được thêm mới (không tính user đã là thành viên từ trước). <br />
    /// EN: The list of UserIds actually newly added (excludes users who were already members).
    /// </summary>
    public List<Guid> AssignedUserIds { get; set; } = [];
}
```

- [ ] **Step 3: Viết `AssignStoreMembersCommand.cs`**

```csharp
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.Store.Contracts.ViewModels.Stores;

namespace NDTCore.Store.Application.Features.Stores.AssignStoreMembers;

/// <summary>
/// VN: Lệnh gán một hoặc nhiều user làm thành viên cửa hàng. <br />
/// EN: Command to assign one or more users as store members.
/// </summary>
public sealed record AssignStoreMembersCommand : ICommand<AssignStoreMembersResponse>
{
    /// <summary>
    /// VN: Khởi tạo lệnh từ ID cửa hàng (route param) và request body. <br />
    /// EN: Initializes the command from the store ID (route param) and the request body.
    /// </summary>
    /// <param name="storeId">
    /// VN: ID cửa hàng. <br />
    /// EN: The store ID.
    /// </param>
    /// <param name="request">
    /// VN: Request body chứa danh sách UserId cần gán. <br />
    /// EN: The request body containing the UserIds to assign.
    /// </param>
    public AssignStoreMembersCommand(int storeId, AssignStoreMembersRequest request)
    {
        StoreId = storeId;
        UserIds = request.UserIds;
    }

    /// <summary>VN: ID cửa hàng. <br /> EN: Store ID.</summary>
    public int StoreId { get; init; }

    /// <summary>VN: Danh sách UserId cần gán. <br /> EN: The list of UserIds to assign.</summary>
    public List<Guid> UserIds { get; init; } = [];
}
```

- [ ] **Step 4: Viết `AssignStoreMembersCommandValidator.cs`**

```csharp
using FluentValidation;

namespace NDTCore.Store.Application.Features.Stores.AssignStoreMembers;

/// <summary>
/// VN: Validator cho <see cref="AssignStoreMembersCommand"/>. <br />
/// EN: Validator for <see cref="AssignStoreMembersCommand"/>.
/// </summary>
public sealed class AssignStoreMembersCommandValidator : AbstractValidator<AssignStoreMembersCommand>
{
    /// <summary>
    /// VN: Khởi tạo các rule kiểm tra cho <see cref="AssignStoreMembersCommand"/>. <br />
    /// EN: Initializes the validation rules for <see cref="AssignStoreMembersCommand"/>.
    /// </summary>
    public AssignStoreMembersCommandValidator()
    {
        RuleFor(x => x.StoreId)
            .GreaterThan(0)
                .WithMessage("StoreId must be greater than 0.");

        RuleFor(x => x.UserIds)
            .NotEmpty()
                .WithMessage("At least one userId is required.");
    }
}
```

- [ ] **Step 5: Viết `AssignStoreMembersCommandHandler.cs`**

```csharp
using Microsoft.Extensions.Logging;
using NDTCore.Brand.Contracts.Interfaces.Services;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Constants;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Identity.Contracts.Interfaces.Services;
using NDTCore.Store.Application.Common;
using NDTCore.Store.Contracts.Interfaces.Repositories;
using NDTCore.Store.Contracts.ViewModels.Stores;
using NDTCore.Store.Domain.Entities;

namespace NDTCore.Store.Application.Features.Stores.AssignStoreMembers;

/// <summary>
/// VN: Xử lý lệnh gán user làm thành viên cửa hàng. Chỉ chấp nhận user đã có role StoreManager/Cashier/OrderStaff.
/// Bỏ qua (không lỗi) user đã là thành viên từ trước. Yêu cầu role SuperAdmin/OrgAdmin hoặc FranchiseeOwner
/// (chỉ store thuộc franchisee của mình). <br />
/// EN: Handles the command to assign users as store members. Only accepts users who already hold the
/// StoreManager/Cashier/OrderStaff role. Silently skips users already assigned. Requires SuperAdmin/OrgAdmin
/// role, or FranchiseeOwner (only for stores within their own franchisee).
/// </summary>
public sealed class AssignStoreMembersCommandHandler : ICommandHandler<AssignStoreMembersCommand, AssignStoreMembersResponse>
{
    private static readonly string[] AssignableRoles =
    [
        SystemRoles.StoreManager,
        SystemRoles.Cashier,
        SystemRoles.OrderStaff,
    ];

    private readonly ILogger<AssignStoreMembersCommandHandler> _logger;
    private readonly INdtContextAccessor _contextAccessor;
    private readonly IAppStoreRepository _storeRepository;
    private readonly IAppStoreUserRepository _storeUserRepository;
    private readonly IFranchiseeService _franchiseeService;
    private readonly IUserService _userService;
    private readonly IAppStoreUnitOfWork _unitOfWork;

    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="AssignStoreMembersCommandHandler"/>. <br />
    /// EN: Initializes a new instance of the <see cref="AssignStoreMembersCommandHandler"/> class.
    /// </summary>
    public AssignStoreMembersCommandHandler(
        ILogger<AssignStoreMembersCommandHandler> logger,
        INdtContextAccessor contextAccessor,
        IAppStoreRepository storeRepository,
        IAppStoreUserRepository storeUserRepository,
        IFranchiseeService franchiseeService,
        IUserService userService,
        IAppStoreUnitOfWork unitOfWork)
    {
        _logger = logger;
        _contextAccessor = contextAccessor;
        _storeRepository = storeRepository;
        _storeUserRepository = storeUserRepository;
        _franchiseeService = franchiseeService;
        _userService = userService;
        _unitOfWork = unitOfWork;
    }

    /// <inheritdoc/>
    public async Task<Result<AssignStoreMembersResponse>> Handle(
        AssignStoreMembersCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _contextAccessor.Context!.TenantId;
        var callerId = _contextAccessor.Context!.UserId;

        var store = await _storeRepository.GetByIdTrackedAsync(request.StoreId, cancellationToken);

        if (store is null || store.TenantId != tenantId)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Store not found: StoreId={StoreId}",
                nameof(AssignStoreMembersCommandHandler),
                nameof(Handle),
                request.StoreId);

            return Result<AssignStoreMembersResponse>.Failure(
                Error.NotFound($"Store '{request.StoreId}' was not found."));
        }

        var scopeError = await StoreMemberScopeValidator.ValidateAsync(
            _contextAccessor, _franchiseeService, store, cancellationToken);

        if (scopeError is not null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Scope validation failed: StoreId={StoreId}, ErrorCode={ErrorCode}",
                nameof(AssignStoreMembersCommandHandler),
                nameof(Handle),
                request.StoreId,
                scopeError.ErrorCode);

            return Result<AssignStoreMembersResponse>.Failure(scopeError);
        }

        var requestedUserIds = request.UserIds.Where(x => x != Guid.Empty).Distinct().ToList();
        var users = await _userService.GetUsersByIdsAsync(requestedUserIds, cancellationToken);
        var userMap = users.ToDictionary(u => u.Id);

        var missingUserIds = requestedUserIds.Where(id => !userMap.ContainsKey(id)).ToList();

        if (missingUserIds.Count > 0)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Users not found: StoreId={StoreId}, UserIds={UserIds}",
                nameof(AssignStoreMembersCommandHandler),
                nameof(Handle),
                request.StoreId,
                string.Join(", ", missingUserIds));

            return Result<AssignStoreMembersResponse>.Failure(
                Error.NotFound($"The following users do not exist: {string.Join(", ", missingUserIds)}."));
        }

        var ineligibleUsers = userMap.Values
            .Where(u => !u.Roles.Any(r => AssignableRoles.Contains(r, StringComparer.OrdinalIgnoreCase)))
            .ToList();

        if (ineligibleUsers.Count > 0)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Users lack an assignable role: StoreId={StoreId}, Users={Users}",
                nameof(AssignStoreMembersCommandHandler),
                nameof(Handle),
                request.StoreId,
                string.Join(", ", ineligibleUsers.Select(u => u.Email)));

            return Result<AssignStoreMembersResponse>.Failure(
                Error.Forbidden(
                    "The following users do not have the StoreManager/Cashier/OrderStaff role: " +
                    string.Join(", ", ineligibleUsers.Select(u => u.Email)) + "."));
        }

        var existingMembers = await _storeUserRepository.GetByStoreIdAndUserIdsAsync(
            request.StoreId, requestedUserIds, cancellationToken);
        var existingUserIds = existingMembers.Select(x => x.UserId).ToHashSet();
        var userIdsToAdd = requestedUserIds.Where(x => !existingUserIds.Contains(x)).ToList();

        if (userIdsToAdd.Count > 0)
        {
            var now = DateTimeOffset.UtcNow;

            await _storeUserRepository.AddRangeAsync(
                userIdsToAdd.Select(userId => new AppStoreUser
                {
                    TenantId = tenantId,
                    StoreId = request.StoreId,
                    UserId = userId,
                    AssignedAt = now,
                    AssignedBy = callerId,
                }),
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Store members assigned: StoreId={StoreId}, Added={Added}",
            nameof(AssignStoreMembersCommandHandler),
            nameof(Handle),
            request.StoreId,
            string.Join(", ", userIdsToAdd));

        return Result<AssignStoreMembersResponse>.Success(new AssignStoreMembersResponse
        {
            StoreId = request.StoreId,
            AssignedUserIds = userIdsToAdd,
        });
    }
}
```

- [ ] **Step 6: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 7: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Stores/AssignStoreMembersRequest.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Stores/AssignStoreMembersResponse.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/AssignStoreMembers/
git commit -m "feat: them AssignStoreMembers command"
```

---

### Task 6: BE — Feature `RemoveStoreMember`

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Stores/RemoveStoreMemberResponse.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/RemoveStoreMember/RemoveStoreMemberCommand.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/RemoveStoreMember/RemoveStoreMemberCommandValidator.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/RemoveStoreMember/RemoveStoreMemberCommandHandler.cs`

**Interfaces:**
- Consumes: giống Task 5 (trừ `IUserService`, không cần vì remove không cần enrich thông tin user).
- Produces: `RemoveStoreMemberCommand(int StoreId, Guid UserId) : ICommand<RemoveStoreMemberResponse>` — dùng bởi Task 7 (controller).

- [ ] **Step 1: Viết `RemoveStoreMemberResponse.cs`**

```csharp
namespace NDTCore.Store.Contracts.ViewModels.Stores;

/// <summary>
/// VN: Kết quả gỡ một thành viên khỏi cửa hàng. <br />
/// EN: Result of removing a member from a store.
/// </summary>
public sealed class RemoveStoreMemberResponse
{
    /// <summary>VN: ID cửa hàng. <br /> EN: Store ID.</summary>
    public int StoreId { get; set; }

    /// <summary>VN: ID user vừa bị gỡ. <br /> EN: ID of the user just removed.</summary>
    public Guid UserId { get; set; }
}
```

- [ ] **Step 2: Viết `RemoveStoreMemberCommand.cs`**

```csharp
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.Store.Contracts.ViewModels.Stores;

namespace NDTCore.Store.Application.Features.Stores.RemoveStoreMember;

/// <summary>
/// VN: Lệnh gỡ một user khỏi danh sách thành viên cửa hàng. <br />
/// EN: Command to remove a user from a store's member list.
/// </summary>
/// <param name="StoreId">
/// VN: ID cửa hàng. <br />
/// EN: The store ID.
/// </param>
/// <param name="UserId">
/// VN: ID user cần gỡ. <br />
/// EN: The user ID to remove.
/// </param>
public sealed record RemoveStoreMemberCommand(int StoreId, Guid UserId) : ICommand<RemoveStoreMemberResponse>;
```

- [ ] **Step 3: Viết `RemoveStoreMemberCommandValidator.cs`**

```csharp
using FluentValidation;

namespace NDTCore.Store.Application.Features.Stores.RemoveStoreMember;

/// <summary>
/// VN: Validator cho <see cref="RemoveStoreMemberCommand"/>. <br />
/// EN: Validator for <see cref="RemoveStoreMemberCommand"/>.
/// </summary>
public sealed class RemoveStoreMemberCommandValidator : AbstractValidator<RemoveStoreMemberCommand>
{
    /// <summary>
    /// VN: Khởi tạo các rule kiểm tra cho <see cref="RemoveStoreMemberCommand"/>. <br />
    /// EN: Initializes the validation rules for <see cref="RemoveStoreMemberCommand"/>.
    /// </summary>
    public RemoveStoreMemberCommandValidator()
    {
        RuleFor(x => x.StoreId)
            .GreaterThan(0)
                .WithMessage("StoreId must be greater than 0.");

        RuleFor(x => x.UserId)
            .NotEmpty()
                .WithMessage("UserId is required.");
    }
}
```

- [ ] **Step 4: Viết `RemoveStoreMemberCommandHandler.cs`**

```csharp
using Microsoft.Extensions.Logging;
using NDTCore.Brand.Contracts.Interfaces.Services;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Store.Application.Common;
using NDTCore.Store.Contracts.Interfaces.Repositories;
using NDTCore.Store.Contracts.ViewModels.Stores;

namespace NDTCore.Store.Application.Features.Stores.RemoveStoreMember;

/// <summary>
/// VN: Xử lý lệnh gỡ một user khỏi danh sách thành viên cửa hàng. Yêu cầu role SuperAdmin/OrgAdmin hoặc
/// FranchiseeOwner (chỉ store thuộc franchisee của mình). <br />
/// EN: Handles the command to remove a user from a store's member list. Requires SuperAdmin/OrgAdmin role,
/// or FranchiseeOwner (only for stores within their own franchisee).
/// </summary>
public sealed class RemoveStoreMemberCommandHandler : ICommandHandler<RemoveStoreMemberCommand, RemoveStoreMemberResponse>
{
    private readonly ILogger<RemoveStoreMemberCommandHandler> _logger;
    private readonly INdtContextAccessor _contextAccessor;
    private readonly IAppStoreRepository _storeRepository;
    private readonly IAppStoreUserRepository _storeUserRepository;
    private readonly IFranchiseeService _franchiseeService;
    private readonly IAppStoreUnitOfWork _unitOfWork;

    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="RemoveStoreMemberCommandHandler"/>. <br />
    /// EN: Initializes a new instance of the <see cref="RemoveStoreMemberCommandHandler"/> class.
    /// </summary>
    public RemoveStoreMemberCommandHandler(
        ILogger<RemoveStoreMemberCommandHandler> logger,
        INdtContextAccessor contextAccessor,
        IAppStoreRepository storeRepository,
        IAppStoreUserRepository storeUserRepository,
        IFranchiseeService franchiseeService,
        IAppStoreUnitOfWork unitOfWork)
    {
        _logger = logger;
        _contextAccessor = contextAccessor;
        _storeRepository = storeRepository;
        _storeUserRepository = storeUserRepository;
        _franchiseeService = franchiseeService;
        _unitOfWork = unitOfWork;
    }

    /// <inheritdoc/>
    public async Task<Result<RemoveStoreMemberResponse>> Handle(
        RemoveStoreMemberCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _contextAccessor.Context!.TenantId;

        var store = await _storeRepository.GetByIdTrackedAsync(request.StoreId, cancellationToken);

        if (store is null || store.TenantId != tenantId)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Store not found: StoreId={StoreId}",
                nameof(RemoveStoreMemberCommandHandler),
                nameof(Handle),
                request.StoreId);

            return Result<RemoveStoreMemberResponse>.Failure(
                Error.NotFound($"Store '{request.StoreId}' was not found."));
        }

        var scopeError = await StoreMemberScopeValidator.ValidateAsync(
            _contextAccessor, _franchiseeService, store, cancellationToken);

        if (scopeError is not null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Scope validation failed: StoreId={StoreId}, ErrorCode={ErrorCode}",
                nameof(RemoveStoreMemberCommandHandler),
                nameof(Handle),
                request.StoreId,
                scopeError.ErrorCode);

            return Result<RemoveStoreMemberResponse>.Failure(scopeError);
        }

        var members = await _storeUserRepository.GetByStoreIdAndUserIdsAsync(
            request.StoreId, [request.UserId], cancellationToken);
        var member = members.FirstOrDefault();

        if (member is null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] User is not a store member: StoreId={StoreId}, UserId={UserId}",
                nameof(RemoveStoreMemberCommandHandler),
                nameof(Handle),
                request.StoreId,
                request.UserId);

            return Result<RemoveStoreMemberResponse>.Failure(
                Error.NotFound($"User '{request.UserId}' is not a member of store '{request.StoreId}'."));
        }

        _storeUserRepository.Remove(member);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Store member removed: StoreId={StoreId}, UserId={UserId}",
            nameof(RemoveStoreMemberCommandHandler),
            nameof(Handle),
            request.StoreId,
            request.UserId);

        return Result<RemoveStoreMemberResponse>.Success(new RemoveStoreMemberResponse
        {
            StoreId = request.StoreId,
            UserId = request.UserId,
        });
    }
}
```

- [ ] **Step 5: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 6: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Stores/RemoveStoreMemberResponse.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/RemoveStoreMember/
git commit -m "feat: them RemoveStoreMember command"
```

---

### Task 7: BE — Controller: wire 3 endpoint + kiểm thử thủ công

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.API/Controllers/Modules/Store/Admin/StoreController.cs`

**Interfaces:**
- Consumes: `GetStoreMembersQuery` (Task 4), `AssignStoreMembersCommand` (Task 5), `RemoveStoreMemberCommand` (Task 6).
- Produces: `GET/POST /api/admin/store/{id}/members`, `DELETE /api/admin/store/{id}/members/{userId}` — khớp `STORE_MEMBER_API` đã có sẵn ở FE (`api.constants.ts`).

- [ ] **Step 1: Thêm using + 3 action vào `StoreController.cs`**

Tìm phần `using` đầu file:

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NDTCore.API.Controllers.Base;
using NDTCore.Store.Application.Features.Stores.CreateStore;
using NDTCore.Store.Application.Features.Stores.DeleteStore;
using NDTCore.Store.Application.Features.Stores.GetPagedStores;
using NDTCore.Store.Application.Features.Stores.GetStoreById;
using NDTCore.Store.Application.Features.Stores.UpdateStore;
using NDTCore.Store.Contracts.Models.Stores;
using NDTCore.Store.Contracts.ViewModels.Stores;

namespace NDTCore.API.Controllers.Modules.Store.Admin;
```

Thay bằng:

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NDTCore.API.Controllers.Base;
using NDTCore.Store.Application.Features.Stores.AssignStoreMembers;
using NDTCore.Store.Application.Features.Stores.CreateStore;
using NDTCore.Store.Application.Features.Stores.DeleteStore;
using NDTCore.Store.Application.Features.Stores.GetPagedStores;
using NDTCore.Store.Application.Features.Stores.GetStoreById;
using NDTCore.Store.Application.Features.Stores.GetStoreMembers;
using NDTCore.Store.Application.Features.Stores.RemoveStoreMember;
using NDTCore.Store.Application.Features.Stores.UpdateStore;
using NDTCore.Store.Contracts.Models.Stores;
using NDTCore.Store.Contracts.ViewModels.Stores;

namespace NDTCore.API.Controllers.Modules.Store.Admin;
```

Tìm action cuối cùng của class (`DeleteStore`) và dấu `}` đóng class ngay sau nó:

```csharp
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteStore(
        int id,
        CancellationToken cancellationToken)
    {
        var command = new DeleteStoreCommand(id);
        var result = await _mediator.Send(command, cancellationToken);

        return DeletedResult(result);
    }
}
```

Thay bằng:

```csharp
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteStore(
        int id,
        CancellationToken cancellationToken)
    {
        var command = new DeleteStoreCommand(id);
        var result = await _mediator.Send(command, cancellationToken);

        return DeletedResult(result);
    }

    /// <summary>
    /// VN: Lấy danh sách thành viên (nhân viên) của một cửa hàng. Yêu cầu role SuperAdmin/OrgAdmin hoặc
    /// FranchiseeOwner (chỉ store thuộc franchisee của mình). <br />
    /// EN: Retrieves the list of members (staff) of a store. Requires SuperAdmin/OrgAdmin role, or
    /// FranchiseeOwner (only for stores within their own franchisee).
    /// </summary>
    [HttpGet("{id:int}/members")]
    public async Task<IActionResult> GetStoreMembers(
        int id,
        CancellationToken cancellationToken)
    {
        var query = new GetStoreMembersQuery(id);
        var result = await _mediator.Send(query, cancellationToken);

        return StatusResult(result);
    }

    /// <summary>
    /// VN: Gán một hoặc nhiều user (đã có role StoreManager/Cashier/OrderStaff) làm thành viên cửa hàng.
    /// Bỏ qua user đã là thành viên, không báo lỗi trùng. Yêu cầu role SuperAdmin/OrgAdmin hoặc FranchiseeOwner
    /// (chỉ store thuộc franchisee của mình). <br />
    /// EN: Assigns one or more users (who already hold the StoreManager/Cashier/OrderStaff role) as store
    /// members. Users already assigned are silently skipped. Requires SuperAdmin/OrgAdmin role, or
    /// FranchiseeOwner (only for stores within their own franchisee).
    /// </summary>
    [HttpPost("{id:int}/members")]
    public async Task<IActionResult> AssignStoreMembers(
        int id,
        [FromBody] AssignStoreMembersRequest request,
        CancellationToken cancellationToken)
    {
        var command = new AssignStoreMembersCommand(id, request);
        var result = await _mediator.Send(command, cancellationToken);

        return StatusResult(result);
    }

    /// <summary>
    /// VN: Gỡ một user khỏi danh sách thành viên cửa hàng. Yêu cầu role SuperAdmin/OrgAdmin hoặc FranchiseeOwner
    /// (chỉ store thuộc franchisee của mình). <br />
    /// EN: Removes a user from the store's member list. Requires SuperAdmin/OrgAdmin role, or FranchiseeOwner
    /// (only for stores within their own franchisee).
    /// </summary>
    [HttpDelete("{id:int}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveStoreMember(
        int id,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var command = new RemoveStoreMemberCommand(id, userId);
        var result = await _mediator.Send(command, cancellationToken);

        return DeletedResult(result);
    }
}
```

- [ ] **Step 2: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 3: Kiểm thử thủ công qua curl**

Run `cd NDTCore.BE/src/NDTCore.API && dotnet run --urls "http://localhost:5048"`, sau đó (thay `<TOKEN>` bằng `AccessToken` lấy từ `POST /api/admin/auth/login` với `admin@ndtcore.com`/`Admin@12345678` — lưu ý token hết hạn rất nhanh trong dev, cần login lại trước mỗi lệnh nếu cách nhau quá lâu):

```bash
# 1. Danh sách thành viên (mong đợi: 200, mảng rỗng — chưa có ai được gán)
curl -s http://localhost:5048/api/admin/store/1/members -H "Authorization: Bearer <TOKEN>"

# 2. Gán user KHÔNG có role StoreManager/Cashier/OrderStaff (dùng UserId của admin@ndtcore.com) — mong đợi: 403 Forbidden liệt kê lý do
curl -s http://localhost:5048/api/admin/store/1/members -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"UserIds":["<ADMIN_USER_ID>"]}'

# 3. Gán user CÓ role OrderStaff (dùng UserId của orderstaff@ndtcore.com) — mong đợi: 200, AssignedUserIds có 1 phần tử
curl -s http://localhost:5048/api/admin/store/1/members -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"UserIds":["<ORDERSTAFF_USER_ID>"]}'

# 4. Gán lại lần 2 cùng user — mong đợi: 200, AssignedUserIds rỗng (bỏ qua trùng, không lỗi)
curl -s http://localhost:5048/api/admin/store/1/members -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"UserIds":["<ORDERSTAFF_USER_ID>"]}'

# 5. Xem lại danh sách — mong đợi: 200, 1 thành viên, Roles=["OrderStaff"], AssignedAt có giá trị hợp lệ
curl -s http://localhost:5048/api/admin/store/1/members -H "Authorization: Bearer <TOKEN>"

# 6. Gỡ thành viên — mong đợi: 200
curl -s http://localhost:5048/api/admin/store/1/members/<ORDERSTAFF_USER_ID> -X DELETE -H "Authorization: Bearer <TOKEN>"

# 7. Gỡ lại lần 2 (không còn là thành viên) — mong đợi: 404
curl -s http://localhost:5048/api/admin/store/1/members/<ORDERSTAFF_USER_ID> -X DELETE -H "Authorization: Bearer <TOKEN>"
```

Đăng nhập bằng `orgadmin@ndtcore.com`/`Admin12345678@` và `franchiseeowner@ndtcore.com`/`Admin12345678@`, lặp lại bước 1/3 để xác nhận: OrgAdmin thao tác được trên mọi store; FranchiseeOwner chỉ thao tác được trên store thuộc franchisee của mình (thử với 1 store KHÔNG thuộc franchisee của họ → mong đợi 403).

Dừng server (`Ctrl+C` hoặc kill process) sau khi test xong.

- [ ] **Step 4: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.API/Controllers/Modules/Store/Admin/StoreController.cs
git commit -m "feat: wire GetStoreMembers/AssignStoreMembers/RemoveStoreMember vao StoreController"
```

---

### Task 8: FE — DTO + ViewModel + Mapper cho `store-member`

**Files:**
- Modify: `NDTCore.FE/src/modules/store/models/dtos/store-member.dto.ts` (file đã tồn tại dạng nháp thiếu field — viết đè)
- Modify: `NDTCore.FE/src/modules/store/models/view-models/store-member.view-model.ts` (đã tồn tại dạng nháp — viết đè)
- Modify: `NDTCore.FE/src/modules/store/mappers/store-member.mapper.ts` (đã tồn tại dạng nháp — viết đè)

**Interfaces:**
- Consumes: response shape từ `StoreMemberResponse`/`AssignStoreMembersResponse`/`RemoveStoreMemberResponse` (Task 4/5/6, BE).
- Produces: `StoreMemberDto`, `AssignStoreMembersRequest`, `AssignStoreMembersResponse`, `RemoveStoreMemberResponse` (dtos), `StoreMemberViewModel` (view-model), `storeMemberMapper` — dùng bởi Task 9 (api/service), Task 10 (component).

> Các file này đã tồn tại trong repo dưới dạng bản nháp không khớp response BE thực tế (chỉ có `StoreId`/`UserId`/`TenantId`, thiếu tên/email/role) — viết đè toàn bộ nội dung, không phải tạo file mới.

- [ ] **Step 1: Viết đè `store-member.dto.ts`**

```ts
export interface StoreMemberDto {
    StoreId: number
    TenantId: string
    UserId: string
    UserName: string
    Email: string
    FullName: string
    AvatarUrl?: string | null
    IsActive: boolean
    Roles: string[]
    AssignedAt: string
}

export interface AssignStoreMembersRequest {
    UserIds: string[]
}

export interface AssignStoreMembersResponse {
    StoreId: number
    AssignedUserIds: string[]
}

export interface RemoveStoreMemberResponse {
    StoreId: number
    UserId: string
}
```

- [ ] **Step 2: Viết đè `store-member.view-model.ts`**

```ts
export interface StoreMemberViewModel extends Record<string, unknown> {
    storeId: number
    tenantId: string
    userId: string
    userName: string
    email: string
    fullName: string
    avatarUrl?: string | null
    isActive: boolean
    roles: string[]
    assignedAt: string
}
```

- [ ] **Step 3: Viết đè `store-member.mapper.ts`**

```ts
import type { StoreMemberDto } from '@/modules/store/models/dtos/store-member.dto'
import type { StoreMemberViewModel } from '@/modules/store/models/view-models/store-member.view-model'

export const storeMemberMapper = {
    toViewModel(dto: StoreMemberDto): StoreMemberViewModel {
        return {
            storeId: dto.StoreId,
            tenantId: dto.TenantId,
            userId: dto.UserId,
            userName: dto.UserName,
            email: dto.Email,
            fullName: dto.FullName,
            avatarUrl: dto.AvatarUrl ?? null,
            isActive: dto.IsActive,
            roles: dto.Roles,
            assignedAt: dto.AssignedAt,
        }
    },

    toViewModels(dtos: StoreMemberDto[]): StoreMemberViewModel[] {
        return (dtos ?? []).map((dto) => this.toViewModel(dto))
    },
}
```

- [ ] **Step 4: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: sẽ còn lỗi ở `store-member.api.ts`/`store-member.service.ts` (Task 9 chưa sửa) — đó là lỗi mong đợi ở bước này, không phải lỗi của Task 8. Xác nhận riêng 3 file vừa sửa trong Task 8 không phải nguồn gây lỗi bằng cách đọc lại thông báo lỗi (phải chỉ tới `store-member.api.ts`/`store-member.service.ts`, không phải `store-member.dto.ts`/`store-member.view-model.ts`/`store-member.mapper.ts`).

- [ ] **Step 5: Commit**

```bash
cd NDTCore.FE
git add src/modules/store/models/dtos/store-member.dto.ts src/modules/store/models/view-models/store-member.view-model.ts src/modules/store/mappers/store-member.mapper.ts
git commit -m "feat: cap nhat StoreMemberDto/ViewModel/Mapper khop response BE"
```

---

### Task 9: FE — API + Service + Composable cho `store-member`

**Files:**
- Modify: `NDTCore.FE/src/modules/store/api/store-member.api.ts` (đã tồn tại dạng nháp không khớp — viết đè)
- Modify: `NDTCore.FE/src/modules/store/services/store-member.service.ts` (đã tồn tại dạng nháp không khớp — viết đè)
- Create: `NDTCore.FE/src/modules/store/composables/useStoreMember.ts`

**Interfaces:**
- Consumes: `StoreMemberDto`/`AssignStoreMembersRequest`/`AssignStoreMembersResponse`/`RemoveStoreMemberResponse` (Task 8), `storeMemberMapper` (Task 8), `API_ENDPOINTS.STORE.STORE_MEMBER_API` (đã có sẵn trong `api.constants.ts` — `GET_BY_STORE(storeId)`, `ASSIGN(storeId)`, `REMOVE(storeId, userId)`), `storeClient` (`@/core/api/clients/store.client`, đã có sẵn).
- Produces: `useStoreMember()` trả `{ getStoreMembers, assignStoreMembers, removeStoreMember }` — dùng bởi Task 10 (component).

> `store-member.api.ts`/`store-member.service.ts` đã tồn tại nhưng sai signature: bản nháp cũ dùng `PagedApiResponse` (BE trả list phẳng, không phân trang), gán từng user một `assignAsync(storeId, userId)` (BE nhận mảng `UserIds`), và gửi body `{ userId }` camelCase (không khớp convention PascalCase của mọi request DTO khác trong codebase, ví dụ `AssignRolesRequest`). Viết đè toàn bộ.

- [ ] **Step 1: Viết đè `store-member.api.ts`**

```ts
import { API_ENDPOINTS } from '@/core/constants/api.constants'
import type { ApiResponse } from '@/core/models/common.dto'
import type {
    StoreMemberDto,
    AssignStoreMembersRequest,
    AssignStoreMembersResponse,
    RemoveStoreMemberResponse,
} from '@/modules/store/models/dtos/store-member.dto'
import { storeClient } from '@/core/api/clients/store.client'

export const storeMemberApi = {
    getByStoreAsync(storeId: number): Promise<ApiResponse<StoreMemberDto[]>> {
        return storeClient.get(API_ENDPOINTS.STORE.STORE_MEMBER_API.GET_BY_STORE(storeId))
    },

    assignAsync(storeId: number, payload: AssignStoreMembersRequest): Promise<ApiResponse<AssignStoreMembersResponse>> {
        return storeClient.post(API_ENDPOINTS.STORE.STORE_MEMBER_API.ASSIGN(storeId), payload)
    },

    removeAsync(storeId: number, userId: string): Promise<ApiResponse<RemoveStoreMemberResponse>> {
        return storeClient.delete(API_ENDPOINTS.STORE.STORE_MEMBER_API.REMOVE(storeId, userId))
    },
}
```

- [ ] **Step 2: Viết đè `store-member.service.ts`**

```ts
import { storeMemberApi } from '@/modules/store/api/store-member.api'
import { storeMemberMapper } from '@/modules/store/mappers/store-member.mapper'
import type { AssignStoreMembersRequest } from '@/modules/store/models/dtos/store-member.dto'
import type { StoreMemberViewModel } from '@/modules/store/models/view-models/store-member.view-model'

class StoreMemberService {
    async getByStoreAsync(storeId: number): Promise<StoreMemberViewModel[]> {
        const response = await storeMemberApi.getByStoreAsync(storeId)
        return storeMemberMapper.toViewModels(response.Data ?? [])
    }

    async assignAsync(storeId: number, payload: AssignStoreMembersRequest): Promise<void> {
        await storeMemberApi.assignAsync(storeId, payload)
    }

    async removeAsync(storeId: number, userId: string): Promise<void> {
        await storeMemberApi.removeAsync(storeId, userId)
    }
}

export const storeMemberService = new StoreMemberService()
```

- [ ] **Step 3: Viết `useStoreMember.ts`**

```ts
import { useToastNotification } from '@/composables/useToastNotification'
import { storeMemberService } from '@/modules/store/services/store-member.service'
import type { AssignStoreMembersRequest } from '@/modules/store/models/dtos/store-member.dto'

export function useStoreMember() {
    const toast = useToastNotification()

    async function getStoreMembers(storeId: number) {
        try {
            return await storeMemberService.getByStoreAsync(storeId)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Không thể tải danh sách thành viên.')
            throw error
        }
    }

    async function assignStoreMembers(storeId: number, payload: AssignStoreMembersRequest) {
        try {
            await storeMemberService.assignAsync(storeId, payload)
            toast.success('Gán thành viên thành công.')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gán thành viên thất bại.')
            throw error
        }
    }

    async function removeStoreMember(storeId: number, userId: string) {
        try {
            await storeMemberService.removeAsync(storeId, userId)
            toast.success('Xóa thành viên thành công.')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Xóa thành viên thất bại.')
            throw error
        }
    }

    return { getStoreMembers, assignStoreMembers, removeStoreMember }
}
```

- [ ] **Step 4: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: exit code 0, 0 lỗi (Task 8 + Task 9 cùng nhau đã khớp hết).

- [ ] **Step 5: Commit**

```bash
cd NDTCore.FE
git add src/modules/store/api/store-member.api.ts src/modules/store/services/store-member.service.ts src/modules/store/composables/useStoreMember.ts
git commit -m "feat: cap nhat store-member api/service, them useStoreMember composable"
```

---

### Task 10: FE — Component `StoreStaffTab.vue`

**Files:**
- Create: `NDTCore.FE/src/modules/store/components/store/StoreStaffTab.vue`

**Interfaces:**
- Consumes: `useStoreMember()` (Task 9), `useUser().getPagedUsers` (đã có sẵn, hỗ trợ `RoleNames` filter), `SYSTEM_ROLES` (`@/core/constants/app.constants`, đã có sẵn), `getUserRoles` (`@/composables/useMenuAccess`, đã có sẵn — hàm đồng bộ đọc role từ Pinia store), `AppDialog`/`AppConfirmDialog`/`AppEmptyState` (`@/components/ui`, đã có sẵn), `StoreMemberViewModel` (Task 8), `UserViewModel` (`@/modules/user/models/view-models/user.view-model`, đã có sẵn).
- Produces: component `StoreStaffTab` với prop `storeId: number` — dùng bởi Task 11.

- [ ] **Step 1: Viết `StoreStaffTab.vue`**

```vue
<template>
  <div class="pa-4 d-flex flex-column ga-4">
    <div v-if="canManage" class="d-flex justify-end">
      <v-btn color="primary" prepend-icon="mdi-account-plus-outline" @click="openAddDialog">
        Thêm thành viên
      </v-btn>
    </div>

    <div v-if="isLoading" class="d-flex justify-center pa-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <AppEmptyState
        v-if="members.length === 0"
        icon="mdi-account-group-outline"
        title="Chưa có thành viên"
        :description="canManage ? 'Nhấn \'Thêm thành viên\' để gán nhân viên cho cửa hàng.' : 'Cửa hàng này chưa có thành viên nào.'"
      />

      <v-card v-for="member in members" :key="member.userId" elevation="0" rounded="lg" class="info-card">
        <v-card-text class="d-flex align-center justify-space-between ga-3 pa-4 flex-wrap">
          <div class="d-flex align-center ga-3 flex-wrap">
            <v-avatar color="primary" variant="tonal" size="40">
              <v-img v-if="member.avatarUrl" :src="member.avatarUrl" />
              <span v-else>{{ member.fullName.charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ member.fullName }}</div>
              <div class="text-caption text-medium-emphasis">{{ member.email }}</div>
            </div>
            <div class="d-flex flex-wrap ga-1 ml-2">
              <v-chip v-for="role in member.roles" :key="role" size="small" variant="tonal" color="primary">
                {{ role }}
              </v-chip>
            </div>
          </div>
          <v-btn
            v-if="canManage"
            icon="mdi-close"
            variant="text"
            color="error"
            size="small"
            @click="openRemoveConfirm(member)"
          />
        </v-card-text>
      </v-card>
    </template>

    <AppDialog
      v-model="addDialogOpen"
      title="Thêm thành viên"
      size="sm"
      :loading="isSubmitting"
      confirm-label="Gán"
      @confirm="onAssign"
    >
      <v-autocomplete
        v-model="selectedUserIds"
        :items="availableUserOptions"
        item-value="id"
        item-title="label"
        label="Chọn nhân viên (StoreManager/Cashier/OrderStaff)"
        :loading="isLoadingUsers"
        multiple
        chips
        closable-chips
        density="compact"
        variant="outlined"
        no-data-text="Không tìm thấy nhân viên phù hợp"
      />
    </AppDialog>

    <AppConfirmDialog
      v-model="removeConfirmOpen"
      title="Xóa thành viên"
      :message="`Xóa '${removeTarget?.fullName}' khỏi danh sách thành viên cửa hàng?`"
      confirm-label="Xóa"
      @confirm="onConfirmRemove"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AppDialog, AppConfirmDialog, AppEmptyState } from '@/components/ui'
import { SYSTEM_ROLES } from '@/core/constants/app.constants'
import { getUserRoles } from '@/composables/useMenuAccess'
import { useStoreMember } from '@/modules/store/composables/useStoreMember'
import { useUser } from '@/modules/user/composables/useUser'
import type { StoreMemberViewModel } from '@/modules/store/models/view-models/store-member.view-model'
import type { UserViewModel } from '@/modules/user/models/view-models/user.view-model'

const props = defineProps<{ storeId: number }>()

const { getStoreMembers, assignStoreMembers, removeStoreMember } = useStoreMember()
const { getPagedUsers } = useUser()

const canManage = computed(() =>
  getUserRoles().some((r) =>
    [SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ORG_ADMIN, SYSTEM_ROLES.FRANCHISEE_OWNER].includes(r),
  ),
)

const isLoading = ref(false)
const members = ref<StoreMemberViewModel[]>([])

async function loadMembers() {
  isLoading.value = true
  try {
    members.value = await getStoreMembers(props.storeId)
  } finally {
    isLoading.value = false
  }
}

const addDialogOpen = ref(false)
const isSubmitting = ref(false)
const isLoadingUsers = ref(false)
const eligibleUsers = ref<UserViewModel[]>([])
const selectedUserIds = ref<string[]>([])

const availableUserOptions = computed(() => {
  const memberIds = new Set(members.value.map((m) => m.userId))
  return eligibleUsers.value
    .filter((u) => !memberIds.has(u.id))
    .map((u) => ({ id: u.id, label: `${u.fullName} (${u.email})` }))
})

async function openAddDialog() {
  selectedUserIds.value = []
  addDialogOpen.value = true
  isLoadingUsers.value = true
  try {
    const result = await getPagedUsers({
      PageNumber: 1,
      PageSize: 200,
      RoleNames: [SYSTEM_ROLES.STORE_MANAGER, SYSTEM_ROLES.CASHIER, SYSTEM_ROLES.ORDER_STAFF],
    })
    eligibleUsers.value = result.items
  } finally {
    isLoadingUsers.value = false
  }
}

async function onAssign() {
  if (selectedUserIds.value.length === 0) return
  isSubmitting.value = true
  try {
    await assignStoreMembers(props.storeId, { UserIds: [...selectedUserIds.value] })
    addDialogOpen.value = false
    await loadMembers()
  } finally {
    isSubmitting.value = false
  }
}

const removeConfirmOpen = ref(false)
const removeTarget = ref<StoreMemberViewModel | null>(null)

function openRemoveConfirm(member: StoreMemberViewModel) {
  removeTarget.value = member
  removeConfirmOpen.value = true
}

async function onConfirmRemove() {
  if (!removeTarget.value) return
  const userId = removeTarget.value.userId
  removeConfirmOpen.value = false
  removeTarget.value = null
  await removeStoreMember(props.storeId, userId)
  await loadMembers()
}

onMounted(loadMembers)
</script>

<style scoped>
.info-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
```

- [ ] **Step 2: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: exit code 0, 0 lỗi.

- [ ] **Step 3: Commit**

```bash
cd NDTCore.FE
git add src/modules/store/components/store/StoreStaffTab.vue
git commit -m "feat: them StoreStaffTab component"
```

---

### Task 11: FE — Wire tab "Nhân viên" vào `StoreDetailView.vue`

**Files:**
- Modify: `NDTCore.FE/src/modules/store/views/StoreDetailView.vue`

**Interfaces:**
- Consumes: `StoreStaffTab` (Task 10), biến `storeId` đã có sẵn trong script của `StoreDetailView.vue`.
- Produces: trang chi tiết cửa hàng có 2 tab "Tổng quan"/"Nhân viên" hoạt động đầy đủ.

- [ ] **Step 1: Thêm tab trong `<template>`**

Tìm:

```vue
      <v-card rounded="lg" elevation="1">
        <v-tabs v-model="activeTab" color="primary" class="px-2">
          <v-tab value="overview" class="text-none" rounded="lg">
            <v-icon start icon="mdi-information-outline" size="18" />
            Tổng quan
          </v-tab>
        </v-tabs>
        <v-divider />
        <v-window v-model="activeTab">
          <v-window-item value="overview">
            <StoreOverviewTab
              :entity="store.data.value"
              :form="editForm"
              :form-errors="formErrors"
              :is-dirty="isDirty"
              :submitting="submitting"
              :brand-options="brandOptions"
              :franchisee-options="franchiseeOptions"
              @update:form="onFormUpdate"
              @brand-change="onBrandChange"
              @save="saveChanges"
              @discard="onDiscard"
              @back="onBack"
            />
          </v-window-item>
        </v-window>
      </v-card>
```

Thay bằng:

```vue
      <v-card rounded="lg" elevation="1">
        <v-tabs v-model="activeTab" color="primary" class="px-2">
          <v-tab value="overview" class="text-none" rounded="lg">
            <v-icon start icon="mdi-information-outline" size="18" />
            Tổng quan
          </v-tab>
          <v-tab value="members" class="text-none" rounded="lg">
            <v-icon start icon="mdi-account-group-outline" size="18" />
            Nhân viên
          </v-tab>
        </v-tabs>
        <v-divider />
        <v-window v-model="activeTab">
          <v-window-item value="overview">
            <StoreOverviewTab
              :entity="store.data.value"
              :form="editForm"
              :form-errors="formErrors"
              :is-dirty="isDirty"
              :submitting="submitting"
              :brand-options="brandOptions"
              :franchisee-options="franchiseeOptions"
              @update:form="onFormUpdate"
              @brand-change="onBrandChange"
              @save="saveChanges"
              @discard="onDiscard"
              @back="onBack"
            />
          </v-window-item>
          <v-window-item value="members">
            <StoreStaffTab :store-id="storeId" />
          </v-window-item>
        </v-window>
      </v-card>
```

- [ ] **Step 2: Thêm import trong `<script setup>`**

Tìm:

```ts
import StoreOverviewTab from '@/modules/store/components/store/StoreOverviewTab.vue'
import { useBrand } from '@/modules/brand/composables/useBrand'
import { useFranchisee } from '@/modules/brand/composables/useFranchisee'
```

Thay bằng:

```ts
import StoreOverviewTab from '@/modules/store/components/store/StoreOverviewTab.vue'
import StoreStaffTab from '@/modules/store/components/store/StoreStaffTab.vue'
import { useBrand } from '@/modules/brand/composables/useBrand'
import { useFranchisee } from '@/modules/brand/composables/useFranchisee'
```

- [ ] **Step 3: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: exit code 0, 0 lỗi.

- [ ] **Step 4: Commit**

```bash
cd NDTCore.FE
git add src/modules/store/views/StoreDetailView.vue
git commit -m "feat: them tab Nhan vien vao StoreDetailView"
```

---

### Task 12: FE — Dọn dẹp trang placeholder độc lập

**Files:**
- Delete: `NDTCore.FE/src/modules/store/views/StoreMembersView.vue`
- Delete: `NDTCore.FE/src/modules/store/components/store/StoreMemberList.vue`
- Modify: `NDTCore.FE/src/router/routes.ts`
- Modify: `NDTCore.FE/src/core/constants/app-routes.constants.ts`

**Interfaces:**
- Không có interface nào khác phụ thuộc vào các file này — đã xác nhận qua grep toàn repo (chỉ 3 file tham chiếu `STORE_MEMBERS`/`store-members`/`StoreMembersView`/`StoreMemberList`, cả 3 đều nằm trong scope task này).

- [ ] **Step 1: Xóa 2 file placeholder**

```bash
cd NDTCore.FE
rm src/modules/store/views/StoreMembersView.vue
rm src/modules/store/components/store/StoreMemberList.vue
```

- [ ] **Step 2: Bỏ route trong `routes.ts`**

Tìm:

```ts
                {
                    path: APP_ROUTES.ADMIN.CHILDREN.STORE_MEMBERS.PATH,
                    name: APP_ROUTES.ADMIN.CHILDREN.STORE_MEMBERS.NAME,
                    component: () => import('@/modules/store/views/StoreMembersView.vue'),
                    meta: {
                        title: 'Thành viên cửa hàng',
                        requiresAuth: true,
                        roles: [SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ORG_ADMIN, SYSTEM_ROLES.FRANCHISEE_OWNER],
                    },
                },
```

Xóa toàn bộ khối trên (giữ nguyên route `STORE_DETAIL` phía trước và `SALES` phía sau).

- [ ] **Step 3: Bỏ entry trong `app-routes.constants.ts`**

Tìm:

```ts
            STORE_MEMBERS: {
                NAME: 'admin:store-members',
                PATH: 'store-members',
            },
```

Xóa toàn bộ khối trên (giữ nguyên `STORE_DETAIL` phía trước và `ORDERS` phía sau).

- [ ] **Step 4: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: exit code 0, 0 lỗi.

- [ ] **Step 5: Commit**

```bash
cd NDTCore.FE
git add -A src/modules/store/views/StoreMembersView.vue src/modules/store/components/store/StoreMemberList.vue src/router/routes.ts src/core/constants/app-routes.constants.ts
git commit -m "chore: xoa trang StoreMembersView doc lap, chuyen sang tab trong chi tiet cua hang"
```

---

### Task 13: Kiểm thử thủ công đầu-cuối trên dev server

**Files:** Không sửa file — chỉ chạy backend + frontend và quan sát.

**Interfaces:**
- Consumes: kết quả Task 1-12.

- [ ] **Step 1: Chạy BE**

Run: `cd NDTCore.BE/src/NDTCore.API && dotnet run`
Expected: API khởi động không lỗi.

- [ ] **Step 2: Chạy FE dev server**

Run: `cd NDTCore.FE && npm run dev`
Expected: Vite serve không lỗi compile.

- [ ] **Step 3: Verify tab "Nhân viên" — SuperAdmin**

Đăng nhập `admin@ndtcore.com`/`Admin@12345678`, vào "Cửa hàng" → chọn 1 cửa hàng → tab "Nhân viên":
1. Danh sách rỗng ban đầu (hoặc có sẵn nếu Task 7 đã gán qua curl) — hiển thị đúng `AppEmptyState`/danh sách.
2. Bấm "Thêm thành viên" → dialog mở, autocomplete chỉ liệt kê user có role StoreManager/Cashier/OrderStaff (không thấy `admin@ndtcore.com`, `orgadmin@ndtcore.com`).
3. Chọn `orderstaff@ndtcore.com` → bấm "Gán" → toast thành công, danh sách refresh hiện thành viên mới với chip role đúng.
4. Bấm nút xóa (icon X) trên dòng vừa thêm → confirm dialog hiện → xác nhận → toast thành công, thành viên biến mất khỏi danh sách.

- [ ] **Step 4: Verify FranchiseeOwner bị giới hạn scope**

Đăng nhập `franchiseeowner@ndtcore.com`/`Admin12345678@`:
1. Vào 1 cửa hàng thuộc franchisee của mình → tab "Nhân viên" hoạt động bình thường (thấy nút Thêm/Xóa).
2. Thử truy cập trực tiếp URL `/admin/stores/<id-cua-store-khac-franchisee>` (nếu route cho phép truy cập — tuỳ theo cấu hình `roles` trên route `STORE_DETAIL`) → tab Nhân viên phải báo lỗi/không load được danh sách (403 từ BE).

- [ ] **Step 5: Verify role thường không thấy nút quản lý**

Đăng nhập `orderstaff@ndtcore.com`/`Admin12345678@` (nếu route `STORE_DETAIL` cho phép role này truy cập — nếu không, bỏ qua bước này vì đã bị chặn ở tầng route):
1. Tab "Nhân viên" hiển thị danh sách nhưng KHÔNG có nút "Thêm thành viên" và nút xóa trên từng dòng.

Expected: tất cả đúng như mô tả, không có lỗi console, không có network request nào trả về ngoài dự kiến (mở DevTools Network tab để xác nhận response `GET/POST/DELETE /api/admin/store/{id}/members...` đều đúng status code).

---
