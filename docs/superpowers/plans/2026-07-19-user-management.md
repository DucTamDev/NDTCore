# User Management (BE + FE) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện màn hình quản lý user cho admin (list phân trang, tạo, sửa, xoá, gán role) và bổ sung 2 endpoint BE còn thiếu mà FE đã scaffold sẵn contract.

**Architecture:** BE thêm 2 CQRS query mới (`GetPagedUsers`, `AdminGetUserById`) vào module `NDTCore.Identity` theo đúng pattern `GetPagedStores`/`AdminGetUserByEmail` đã có. FE dựng module `user` (api/service/mapper/adapter/composable/components/views) mirror 1:1 cấu trúc module `store` đã có, nối vào route/nav đã scaffold sẵn.

**Tech Stack:** BE: .NET 8, MediatR, FluentValidation, EF Core 8. FE: Vue 3 Composition API, TypeScript strict, Vuetify 3, Pinia (không dùng cho phần này — xem Global Constraints).

## Global Constraints

- Spec gốc: `docs/superpowers/specs/2026-07-19-user-management-design.md`.
- BE: mọi `class`/`interface`/`method`/`property` (kể cả `private`) phải có XML doc song ngữ VN/EN theo format `/// <summary>\n/// VN: ... <br />\n/// EN: ...\n/// </summary>`.
- BE: `dotnet build NDTCore.sln` (chạy từ `NDTCore.BE/src/`) phải 0 error trước khi commit.
- FE: TypeScript strict, không dùng `any`. `npx vue-tsc --build` (chạy từ `NDTCore.FE/`) phải 0 error trước khi commit.
- FE: DTO field PascalCase khớp contract backend; ViewModel/FormModel field camelCase; API không gọi trực tiếp trong component — luôn qua composable.
- **Không có test project tự động trong repo này** (không xUnit/vitest spec nào tồn tại) — quy ước xác minh hiện tại của dự án là build + type-check + kiểm thử thủ công (xem `.claude/rules/git-workflow.md`). Mỗi task dưới đây dùng đúng quy ước này thay vì viết unit test — **đây là chủ đích, không phải thiếu sót**.
- Commit message format: `<type>: <short description>` (`feat`, `fix`, `refactor`, `docs`, `chore`).
- List v1 **không** có filter Role, **không** có `CreatedAfter`/`CreatedBefore`. Gán role chỉ **ADD**, không có nút xoá role.
- Nhánh làm việc: `feature/user-management-access-control` ở cả `NDTCore.BE` và `NDTCore.FE` (đã tạo sẵn, đã có 4 fix authorization ở BE).

---

## Phase 1 — Backend (`NDTCore.BE`)

### Task 1: Sửa doc comment sai trong `AssignRolesRequest`

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Identity/NDTCore.Identity.Contracts/ViewModels/Users/AssignRolesRequest.cs`

**Interfaces:** Không đổi field nào, chỉ sửa doc comment.

- [ ] **Step 1: Sửa doc comment**

Trong `AssignRolesRequest.cs`, đổi:

```csharp
/// <summary>
/// VN: Danh sách tên roles muốn gán (thay thế hoàn toàn roles hiện tại). <br />
/// EN: List of role names to assign (fully replaces current roles).
/// </summary>
public List<string> Roles { get; init; } = [];
```

thành:

```csharp
/// <summary>
/// VN: Danh sách tên roles muốn gán thêm. Chỉ thêm role chưa có, không xoá role hiện tại. <br />
/// EN: List of role names to add. Only adds roles the user doesn't already have; existing roles are never removed.
/// </summary>
public List<string> Roles { get; init; } = [];
```

- [ ] **Step 2: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Warning(s). 0 Error(s).`

- [ ] **Step 3: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Identity/NDTCore.Identity.Contracts/ViewModels/Users/AssignRolesRequest.cs
git commit -m "docs: fix inaccurate AssignRolesRequest doc comment (add-only, not replace)"
```

---

### Task 2: `GetPagedUsersQuery` — endpoint list user phân trang

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Identity/NDTCore.Identity.Application/Features/Users/GetPagedUsers/GetPagedUsersQuery.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Identity/NDTCore.Identity.Application/Features/Users/GetPagedUsers/GetPagedUsersQueryValidator.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Identity/NDTCore.Identity.Application/Features/Users/GetPagedUsers/GetPagedUsersQueryHandler.cs`
- Modify: `NDTCore.BE/src/NDTCore.API/Controllers/Modules/Identity/Admin/UsersController.cs`

**Interfaces:**
- Consumes: `IUserRepository.GetPagedAsync(UserFilterDto, CancellationToken) : Task<PaginatedCollection<AppUser>>` (đã có sẵn, đã `Include(AppUserRoles.AppRole)`), `UserFilterDto` (đã có sẵn: `PageNumber`, `PageSize`, `Keyword`, `IsActive`, `IsLocked`, `RoleNames`, `CreatedAfter`, `CreatedBefore`), `UserDto` (đã có sẵn: `Id`, `Email`, `UserName`, `FirstName`, `LastName`, `FullName`, `PhoneNumber`, `AvatarUrl`, `EmailConfirmed`, `PhoneNumberConfirmed`, `IsActive`, `LastLoginAt`, `CreatedAt`, `UpdatedAt`, `Roles: List<string>`), `PagedResult<T>(Result<PaginatedCollection<T>>)` helper trên `ApiControllerBase`.
- Produces: `GetPagedUsersQuery(UserFilterDto Filter) : IQuery<PaginatedCollection<UserDto>>`, endpoint `GET /api/admin/users`.

- [ ] **Step 1: Tạo `GetPagedUsersQuery.cs`**

```csharp
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.Identity.Contracts.Models.Users;

namespace NDTCore.Identity.Application.Features.Users.GetPagedUsers;

/// <summary>
/// VN: Truy vấn lấy danh sách user phân trang cho admin. <br />
/// EN: Query to retrieve a paginated list of users for admin.
/// </summary>
public sealed record GetPagedUsersQuery(UserFilterDto Filter) : IQuery<PaginatedCollection<UserDto>>;
```

- [ ] **Step 2: Tạo `GetPagedUsersQueryValidator.cs`**

```csharp
using FluentValidation;

namespace NDTCore.Identity.Application.Features.Users.GetPagedUsers;

/// <summary>
/// VN: Validator cho GetPagedUsersQuery. <br />
/// EN: Validator for GetPagedUsersQuery.
/// </summary>
public sealed class GetPagedUsersQueryValidator : AbstractValidator<GetPagedUsersQuery>
{
    /// <summary>
    /// VN: Khởi tạo các rule kiểm tra phân trang hợp lệ. <br />
    /// EN: Initializes the pagination validation rules.
    /// </summary>
    public GetPagedUsersQueryValidator()
    {
        RuleFor(x => x.Filter.PageNumber)
            .GreaterThan(0)
                .WithMessage("PageNumber must be greater than 0.");

        RuleFor(x => x.Filter.PageSize)
            .GreaterThan(0)
                .WithMessage("PageSize must be greater than 0.");
    }
}
```

- [ ] **Step 3: Tạo `GetPagedUsersQueryHandler.cs`**

```csharp
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Constants;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Identity.Contracts.Interfaces.Repositories;
using NDTCore.Identity.Contracts.Models.Users;
using NDTCore.Identity.Domain.Entities;

namespace NDTCore.Identity.Application.Features.Users.GetPagedUsers;

/// <summary>
/// VN: Xử lý truy vấn lấy danh sách user phân trang. Chỉ SuperAdmin/OrgAdmin được phép gọi. <br />
/// EN: Handles the query to retrieve a paginated list of users. Only SuperAdmin/OrgAdmin callers are allowed.
/// </summary>
public sealed class GetPagedUsersQueryHandler : IQueryHandler<GetPagedUsersQuery, PaginatedCollection<UserDto>>
{
    private readonly ILogger<GetPagedUsersQueryHandler> _logger;
    private readonly INdtContextAccessor _contextAccessor;
    private readonly IUserRepository _userRepository;

    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="GetPagedUsersQueryHandler"/>. <br />
    /// EN: Initializes a new instance of the <see cref="GetPagedUsersQueryHandler"/> class.
    /// </summary>
    /// <param name="logger">
    /// VN: Dịch vụ ghi log. <br />
    /// EN: The logger service.
    /// </param>
    /// <param name="contextAccessor">
    /// VN: Dịch vụ truy cập ngữ cảnh yêu cầu (user, tenant, roles). <br />
    /// EN: The service to access request context (user, tenant, roles).
    /// </param>
    /// <param name="userRepository">
    /// VN: Repository user dùng để truy vấn dữ liệu. <br />
    /// EN: The user repository for data queries.
    /// </param>
    public GetPagedUsersQueryHandler(
        ILogger<GetPagedUsersQueryHandler> logger,
        INdtContextAccessor contextAccessor,
        IUserRepository userRepository)
    {
        _logger = logger;
        _contextAccessor = contextAccessor;
        _userRepository = userRepository;
    }

    /// <summary>
    /// VN: Xử lý truy vấn, kiểm tra quyền người gọi rồi trả về danh sách user phân trang. <br />
    /// EN: Handles the query, checks caller authorization, then returns the paginated user list.
    /// </summary>
    /// <param name="request">
    /// VN: Truy vấn chứa bộ lọc và thông tin phân trang. <br />
    /// EN: The query containing the filter and pagination information.
    /// </param>
    /// <param name="cancellationToken">
    /// VN: Token để hủy hoạt động không đồng bộ. <br />
    /// EN: Token to cancel the asynchronous operation.
    /// </param>
    /// <returns>
    /// VN: Kết quả chứa danh sách user phân trang hoặc lỗi nếu có. <br />
    /// EN: A result containing the paginated user list or an error if any.
    /// </returns>
    public async Task<Result<PaginatedCollection<UserDto>>> Handle(
        GetPagedUsersQuery request,
        CancellationToken cancellationToken)
    {
        var callerRoles = _contextAccessor.Context?.Roles ?? [];
        var callerIsAuthorized = callerRoles.Any(r =>
            r.Equals(SystemRoles.SuperAdmin, StringComparison.OrdinalIgnoreCase) ||
            r.Equals(SystemRoles.OrgAdmin, StringComparison.OrdinalIgnoreCase));

        if (!callerIsAuthorized)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Caller lacks required role: CallerId={CallerId}",
                nameof(GetPagedUsersQueryHandler),
                nameof(Handle),
                _contextAccessor.Context?.UserId);

            return Result<PaginatedCollection<UserDto>>.Failure(
                Error.Forbidden("Only SuperAdmin or OrgAdmin can list users."));
        }

        var users = await _userRepository.GetPagedAsync(request.Filter, cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] User page loaded: PageNumber={PageNumber}, PageSize={PageSize}, TotalRecords={TotalRecords}",
            nameof(GetPagedUsersQueryHandler),
            nameof(Handle),
            request.Filter.PageNumber,
            request.Filter.PageSize,
            users.PaginationMetadata.TotalRecords);

        var items = users.Items.Select(MapToDto).ToList();

        return Result<PaginatedCollection<UserDto>>.Success(
            new PaginatedCollection<UserDto>(items, users.PaginationMetadata));
    }

    /// <summary>
    /// VN: Ánh xạ entity <see cref="AppUser"/> thành DTO <see cref="UserDto"/>. <br />
    /// EN: Maps the <see cref="AppUser"/> entity to a <see cref="UserDto"/> DTO.
    /// </summary>
    /// <param name="user">
    /// VN: Entity user cần ánh xạ. <br />
    /// EN: The user entity to map.
    /// </param>
    /// <returns>
    /// VN: DTO chứa thông tin user để trả về client. <br />
    /// EN: A DTO containing user information to return to the client.
    /// </returns>
    private static UserDto MapToDto(AppUser user) => new()
    {
        Id = user.Id,
        Email = user.Email ?? string.Empty,
        UserName = user.UserName ?? string.Empty,
        FirstName = user.FirstName,
        LastName = user.LastName,
        PhoneNumber = user.PhoneNumber,
        AvatarUrl = user.AvatarUrl,
        EmailConfirmed = user.EmailConfirmed,
        PhoneNumberConfirmed = user.PhoneNumberConfirmed,
        IsActive = user.IsActive,
        LastLoginAt = user.LastLoginAt,
        CreatedAt = user.CreatedAt,
        UpdatedAt = user.UpdatedAt,
        Roles = user.AppUserRoles?
            .Select(ur => ur.AppRole?.Name ?? string.Empty)
            .Where(name => !string.IsNullOrEmpty(name))
            .ToList() ?? [],
    };
}
```

- [ ] **Step 4: Wire vào `UsersController.cs`**

Thêm using ở đầu file:

```csharp
using NDTCore.Identity.Application.Features.Users.GetPagedUsers;
using NDTCore.Identity.Contracts.Models.Users;
```

Thêm method sau constructor, trước `CreateUser` (thứ tự trong file không quan trọng, đặt ở đâu cũng được, ví dụ ngay trước `GetProfile`):

```csharp
    /// <summary>
    /// VN: Lấy danh sách user phân trang. Yêu cầu role SuperAdmin hoặc OrgAdmin. <br />
    /// EN: Retrieves a paginated list of users. Requires SuperAdmin or OrgAdmin role.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetPagedUsers(
        [FromQuery] UserFilterDto filter,
        CancellationToken cancellationToken)
    {
        var query = new GetPagedUsersQuery(filter);
        var result = await _mediator.Send(query, cancellationToken);
        return PagedResult(result);
    }
```

- [ ] **Step 5: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Warning(s). 0 Error(s).`

- [ ] **Step 6: Kiểm thử thủ công**

Chạy API (`dotnet run --project NDTCore.API`), login lấy Bearer token của user SuperAdmin/OrgAdmin, gọi:

```
GET http://localhost:5048/api/admin/users?PageNumber=1&PageSize=20
Authorization: Bearer <token>
```

Expected: HTTP 200, body có `Data` là mảng `UserDto`, kèm `PageNumber`/`PageSize`/`TotalCount`/`TotalPages`. Gọi lại với token của user role `OrgUser` → expect HTTP 403.

- [ ] **Step 7: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Identity/NDTCore.Identity.Application/Features/Users/GetPagedUsers src/NDTCore.API/Controllers/Modules/Identity/Admin/UsersController.cs
git commit -m "feat: add GetPagedUsers query and endpoint for admin user list"
```

---

### Task 3: `AdminGetUserByIdQuery` — endpoint chi tiết user theo ID

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Identity/NDTCore.Identity.Application/Features/Users/AdminGetUserById/AdminGetUserByIdQuery.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Identity/NDTCore.Identity.Application/Features/Users/AdminGetUserById/AdminGetUserByIdQueryValidator.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Identity/NDTCore.Identity.Application/Features/Users/AdminGetUserById/AdminGetUserByIdQueryHandler.cs`
- Modify: `NDTCore.BE/src/NDTCore.API/Controllers/Modules/Identity/Admin/UsersController.cs`

**Interfaces:**
- Consumes: `IUserRepository.GetByIdWithRolesAsync(Guid, CancellationToken) : Task<AppUser?>` (đã có sẵn, đã `Include(AppUserRoles.AppRole)`), `AdminUserDetailResponse` (đã có sẵn — dùng lại nguyên vẹn từ `AdminGetUserByEmail`).
- Produces: `AdminGetUserByIdQuery(Guid Id) : IQuery<AdminUserDetailResponse>`, endpoint `GET /api/admin/users/{id:guid}`.

- [ ] **Step 1: Tạo `AdminGetUserByIdQuery.cs`**

```csharp
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.Identity.Contracts.ViewModels.Users;

namespace NDTCore.Identity.Application.Features.Users.AdminGetUserById;

/// <summary>
/// VN: Truy vấn lấy thông tin chi tiết user theo ID cho admin. <br />
/// EN: Query to retrieve full user detail by ID for admin.
/// </summary>
public sealed record AdminGetUserByIdQuery(Guid Id) : IQuery<AdminUserDetailResponse>;
```

- [ ] **Step 2: Tạo `AdminGetUserByIdQueryValidator.cs`**

```csharp
using FluentValidation;

namespace NDTCore.Identity.Application.Features.Users.AdminGetUserById;

/// <summary>
/// VN: Validator cho AdminGetUserByIdQuery. <br />
/// EN: Validator for AdminGetUserByIdQuery.
/// </summary>
public sealed class AdminGetUserByIdQueryValidator : AbstractValidator<AdminGetUserByIdQuery>
{
    /// <summary>
    /// VN: Khởi tạo rule kiểm tra Id hợp lệ. <br />
    /// EN: Initializes the Id validation rule.
    /// </summary>
    public AdminGetUserByIdQueryValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
                .WithMessage("Id is required.");
    }
}
```

- [ ] **Step 3: Tạo `AdminGetUserByIdQueryHandler.cs`**

```csharp
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Constants;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Identity.Contracts.Interfaces.Repositories;
using NDTCore.Identity.Contracts.ViewModels.Users;

namespace NDTCore.Identity.Application.Features.Users.AdminGetUserById;

/// <summary>
/// VN: Xử lý query lấy thông tin chi tiết user theo ID cho admin. Chỉ SuperAdmin/OrgAdmin được phép gọi. <br />
/// EN: Handles the query to retrieve full user detail by ID for admin. Only SuperAdmin/OrgAdmin callers are allowed.
/// </summary>
public sealed class AdminGetUserByIdQueryHandler : IQueryHandler<AdminGetUserByIdQuery, AdminUserDetailResponse>
{
    private readonly ILogger<AdminGetUserByIdQueryHandler> _logger;
    private readonly INdtContextAccessor _contextAccessor;
    private readonly IUserRepository _userRepository;

    /// <summary>
    /// VN: Khởi tạo một instance mới của <see cref="AdminGetUserByIdQueryHandler"/>. <br />
    /// EN: Initializes a new instance of the <see cref="AdminGetUserByIdQueryHandler"/> class.
    /// </summary>
    /// <param name="logger">
    /// VN: Dịch vụ ghi log. <br />
    /// EN: The logger service.
    /// </param>
    /// <param name="contextAccessor">
    /// VN: Dịch vụ truy cập ngữ cảnh yêu cầu (user, tenant, roles). <br />
    /// EN: The service to access request context (user, tenant, roles).
    /// </param>
    /// <param name="userRepository">
    /// VN: Repository user dùng để truy vấn dữ liệu. <br />
    /// EN: The user repository for data queries.
    /// </param>
    public AdminGetUserByIdQueryHandler(
        ILogger<AdminGetUserByIdQueryHandler> logger,
        INdtContextAccessor contextAccessor,
        IUserRepository userRepository)
    {
        _logger = logger;
        _contextAccessor = contextAccessor;
        _userRepository = userRepository;
    }

    /// <summary>
    /// VN: Xử lý truy vấn, kiểm tra quyền người gọi rồi trả về thông tin chi tiết user. <br />
    /// EN: Handles the query, checks caller authorization, then returns the full user detail.
    /// </summary>
    /// <param name="request">
    /// VN: Truy vấn chứa Id của user cần lấy thông tin. <br />
    /// EN: The query containing the Id of the user to retrieve.
    /// </param>
    /// <param name="cancellationToken">
    /// VN: Token để hủy hoạt động không đồng bộ. <br />
    /// EN: Token to cancel the asynchronous operation.
    /// </param>
    /// <returns>
    /// VN: Kết quả chứa thông tin chi tiết user hoặc lỗi nếu có. <br />
    /// EN: A result containing the full user detail or an error if any.
    /// </returns>
    public async Task<Result<AdminUserDetailResponse>> Handle(
        AdminGetUserByIdQuery request,
        CancellationToken cancellationToken)
    {
        var callerRoles = _contextAccessor.Context?.Roles ?? [];
        var callerIsAuthorized = callerRoles.Any(r =>
            r.Equals(SystemRoles.SuperAdmin, StringComparison.OrdinalIgnoreCase) ||
            r.Equals(SystemRoles.OrgAdmin, StringComparison.OrdinalIgnoreCase));

        if (!callerIsAuthorized)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Caller lacks required role: CallerId={CallerId}",
                nameof(AdminGetUserByIdQueryHandler),
                nameof(Handle),
                _contextAccessor.Context?.UserId);

            return Result<AdminUserDetailResponse>.Failure(
                Error.Forbidden("Only SuperAdmin or OrgAdmin can view user details."));
        }

        var user = await _userRepository.GetByIdWithRolesAsync(request.Id, cancellationToken);

        if (user is null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] User not found: UserId={UserId}",
                nameof(AdminGetUserByIdQueryHandler),
                nameof(Handle),
                request.Id);

            return Result<AdminUserDetailResponse>.Failure(
                Error.NotFound($"User '{request.Id}' was not found."));
        }

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] User retrieved successfully: UserId={UserId}",
            nameof(AdminGetUserByIdQueryHandler),
            nameof(Handle),
            user.Id);

        var roles = user.AppUserRoles?
            .Select(ur => ur.AppRole?.Name ?? string.Empty)
            .Where(name => !string.IsNullOrEmpty(name))
            .ToList() ?? [];

        var response = new AdminUserDetailResponse
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            UserName = user.UserName ?? string.Empty,
            FirstName = user.FirstName,
            LastName = user.LastName,
            FullName = user.FullName,
            PhoneNumber = user.PhoneNumber,
            AvatarUrl = user.AvatarUrl,
            DateOfBirth = user.DateOfBirth,
            Gender = user.Gender,
            IsActive = user.IsActive,
            EmailConfirmed = user.EmailConfirmed,
            PhoneNumberConfirmed = user.PhoneNumberConfirmed,
            LockoutEnabled = user.LockoutEnabled,
            LockoutEnd = user.LockoutEnd,
            AccessFailedCount = user.AccessFailedCount,
            LastLoginAt = user.LastLoginAt,
            Roles = roles,
            TenantId = user.TenantId,
            CreatedAt = user.CreatedAt,
            CreatedBy = user.CreatedBy,
            UpdatedAt = user.UpdatedAt,
            UpdatedBy = user.UpdatedBy,
            IsDeleted = user.IsDeleted,
            DeletedAt = user.DeletedAt,
            DeletedBy = user.DeletedBy,
        };

        return Result<AdminUserDetailResponse>.Success(response);
    }
}
```

- [ ] **Step 4: Wire vào `UsersController.cs`**

Thêm using:

```csharp
using NDTCore.Identity.Application.Features.Users.AdminGetUserById;
```

Thêm method (đặt cạnh `GetByEmail`, ví dụ ngay sau):

```csharp
    /// <summary>
    /// VN: Lấy thông tin chi tiết user theo ID. Yêu cầu role SuperAdmin hoặc OrgAdmin. <br />
    /// EN: Retrieves full user detail by ID. Requires SuperAdmin or OrgAdmin role.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetUserById(
        [FromRoute] Guid id,
        CancellationToken cancellationToken)
    {
        var query = new AdminGetUserByIdQuery(id);
        var result = await _mediator.Send(query, cancellationToken);
        return StatusResult(result);
    }
```

> Lưu ý: route `{id:guid}` đã dùng cho `PUT`/`DELETE`/`PUT .../roles` — không xung đột vì khác HTTP verb (giống hệt cách `StoreController` có cả `[HttpGet] GetPagedStores` và `[HttpGet("{id:int}")] GetStoreById` cùng tồn tại).

- [ ] **Step 5: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Warning(s). 0 Error(s).`

- [ ] **Step 6: Kiểm thử thủ công**

```
GET http://localhost:5048/api/admin/users/{id}
Authorization: Bearer <SuperAdmin/OrgAdmin token>
```

Expected: HTTP 200, body `Data` là `AdminUserDetailResponse` đầy đủ field kể cả `Roles`, `LockoutEnabled`, `AccessFailedCount`. Với `id` không tồn tại → HTTP 404. Với token role `OrgUser` → HTTP 403.

- [ ] **Step 7: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Identity/NDTCore.Identity.Application/Features/Users/AdminGetUserById src/NDTCore.API/Controllers/Modules/Identity/Admin/UsersController.cs
git commit -m "feat: add AdminGetUserById query and endpoint for admin user detail"
```

---

## Phase 2 — Frontend (`NDTCore.FE`)

### Task 4: Data models — DTOs, view-models, form-models

**Files:**
- Create: `NDTCore.FE/src/modules/user/models/dtos/user-filter.dto.ts`
- Create: `NDTCore.FE/src/modules/user/models/dtos/create-user.dto.ts`
- Create: `NDTCore.FE/src/modules/user/models/dtos/update-user.dto.ts`
- Create: `NDTCore.FE/src/modules/user/models/dtos/delete-user.dto.ts`
- Create: `NDTCore.FE/src/modules/user/models/dtos/assign-roles.dto.ts`
- Create: `NDTCore.FE/src/modules/user/models/dtos/admin-user-detail.dto.ts`
- Modify: `NDTCore.FE/src/modules/user/models/dtos/user.dto.ts` (thêm `UserDto` cho list, giữ nguyên `UserProfileDto`/`RoleDto`/`PermissionDto` hiện có)
- Modify: `NDTCore.FE/src/modules/user/models/dtos/_index.ts` (barrel export)
- Create: `NDTCore.FE/src/modules/user/models/view-models/user.view-model.ts`
- Create: `NDTCore.FE/src/modules/user/models/view-models/user-detail.view-model.ts`
- Create: `NDTCore.FE/src/modules/user/models/form-models/user.model.ts`

**Interfaces:**
- Produces: `UserFilterDto`, `CreateUserRequest`, `CreateUserResponse`, `UpdateUserRequest`, `UpdateUserResponse`, `DeleteUserResponse`, `AssignRolesRequest`, `AssignRolesResponse`, `UserDto`, `AdminUserDetailResponse`, `UserViewModel`, `UserDetailViewModel`, `CreateUserFormModel`, `UserOverviewFormModel`. Các task sau (5–14) dùng nguyên các type name này.

- [ ] **Step 1: `user-filter.dto.ts`**

```ts
export interface UserFilterDto {
    PageNumber: number
    PageSize: number
    Keyword?: string | null
    IsActive?: boolean | null
    IsLocked?: boolean | null
    RoleNames?: string[] | null
    SortBy?: string | null
    SortDirection?: string | null
}
```

- [ ] **Step 2: `create-user.dto.ts`**

```ts
export interface CreateUserRequest {
    Email: string
    UserName: string
    Password: string
    FirstName: string
    LastName: string
    PhoneNumber?: string | null
    DateOfBirth?: string | null
    Gender?: string | null
    IsActive: boolean
}

export interface CreateUserResponse {
    Id: string
    Email: string
    UserName: string
    FirstName: string
    LastName: string
    FullName: string
    IsActive: boolean
    Roles: string[]
    TenantId: string
    CreatedAt?: string | null
}
```

- [ ] **Step 3: `update-user.dto.ts`**

```ts
export interface UpdateUserRequest {
    FirstName: string
    LastName: string
    PhoneNumber?: string | null
    AvatarUrl?: string | null
    DateOfBirth?: string | null
    Gender?: string | null
    IsActive: boolean
}

export interface UpdateUserResponse {
    Id: string
    Email: string
    UserName: string
    FirstName: string
    LastName: string
    FullName: string
    PhoneNumber?: string | null
    AvatarUrl?: string | null
    DateOfBirth?: string | null
    Gender?: string | null
    IsActive: boolean
    UpdatedAt?: string | null
}
```

- [ ] **Step 4: `delete-user.dto.ts`**

```ts
export interface DeleteUserResponse {
    UserId: string
    DeletedAt: string
}
```

- [ ] **Step 5: `assign-roles.dto.ts`**

```ts
export interface AssignRolesRequest {
    Roles: string[]
}

export interface AssignRolesResponse {
    UserId: string
    AssignedRoles: string[]
}
```

- [ ] **Step 6: `admin-user-detail.dto.ts`**

```ts
export interface AdminUserDetailResponse {
    Id: string
    Email: string
    UserName: string
    FirstName: string
    LastName: string
    FullName: string
    PhoneNumber?: string | null
    AvatarUrl?: string | null
    DateOfBirth?: string | null
    Gender?: string | null
    IsActive: boolean
    EmailConfirmed: boolean
    PhoneNumberConfirmed: boolean
    LockoutEnabled: boolean
    LockoutEnd?: string | null
    AccessFailedCount: number
    LastLoginAt?: string | null
    Roles: string[]
    TenantId: string
    CreatedAt?: string | null
    CreatedBy?: string | null
    UpdatedAt?: string | null
    UpdatedBy?: string | null
    IsDeleted: boolean
    DeletedAt?: string | null
    DeletedBy?: string | null
}
```

- [ ] **Step 7: Thêm `UserDto` vào `user.dto.ts` (giữ nguyên nội dung hiện có)**

Đọc file hiện tại, thêm vào cuối (sau `PermissionDto`):

```ts
export interface UserDto {
    Id: string
    Email: string
    UserName: string
    FirstName: string
    LastName: string
    FullName: string
    PhoneNumber?: string | null
    AvatarUrl?: string | null
    EmailConfirmed: boolean
    PhoneNumberConfirmed: boolean
    IsActive: boolean
    LastLoginAt?: string | null
    CreatedAt?: string | null
    UpdatedAt?: string | null
    Roles: string[]
}
```

- [ ] **Step 8: Cập nhật `_index.ts` barrel**

Đọc `NDTCore.FE/src/modules/user/models/dtos/_index.ts` hiện có, thêm các export mới:

```ts
export * from './user.dto'
export * from './user-filter.dto'
export * from './create-user.dto'
export * from './update-user.dto'
export * from './delete-user.dto'
export * from './assign-roles.dto'
export * from './admin-user-detail.dto'
```

(giữ nguyên export nào đã có sẵn trong file, không xoá)

- [ ] **Step 9: `user.view-model.ts`**

```ts
export interface UserViewModel extends Record<string, unknown> {
    id: string
    email: string
    userName: string
    firstName: string
    lastName: string
    fullName: string
    phoneNumber?: string | null
    avatarUrl?: string | null
    emailConfirmed: boolean
    phoneNumberConfirmed: boolean
    isActive: boolean
    lastLoginAt?: string | null
    createdAt?: string | null
    updatedAt?: string | null
    roles: string[]
}
```

- [ ] **Step 10: `user-detail.view-model.ts`**

```ts
export interface UserDetailViewModel {
    id: string
    email: string
    userName: string
    firstName: string
    lastName: string
    fullName: string
    phoneNumber?: string | null
    avatarUrl?: string | null
    dateOfBirth?: string | null
    gender?: string | null
    isActive: boolean
    emailConfirmed: boolean
    phoneNumberConfirmed: boolean
    lockoutEnabled: boolean
    lockoutEnd?: string | null
    accessFailedCount: number
    lastLoginAt?: string | null
    roles: string[]
    tenantId: string
    createdAt?: string | null
    createdBy?: string | null
    updatedAt?: string | null
    updatedBy?: string | null
    isDeleted: boolean
    deletedAt?: string | null
    deletedBy?: string | null
}
```

- [ ] **Step 11: `user.model.ts` (form-models)**

```ts
export interface CreateUserFormModel {
    email: string
    userName: string
    password: string
    firstName: string
    lastName: string
    phoneNumber?: string | null
    dateOfBirth?: string | null
    gender?: string | null
    isActive: boolean
}

export interface UserOverviewFormModel {
    firstName: string
    lastName: string
    phoneNumber?: string | null
    avatarUrl?: string | null
    dateOfBirth?: string | null
    gender?: string | null
    isActive: boolean
}
```

- [ ] **Step 12: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 error (các file mới chỉ khai báo type, chưa được import ở đâu nên không lỗi biên dịch).

- [ ] **Step 13: Commit**

```bash
cd NDTCore.FE
git add src/modules/user/models
git commit -m "feat: add DTOs, view-models, form-models for admin user management"
```

---

### Task 5: API layer — `api.constants.ts` + `user.api.ts`

**Files:**
- Modify: `NDTCore.FE/src/core/constants/api.constants.ts`
- Modify: `NDTCore.FE/src/modules/user/api/user.api.ts`

**Interfaces:**
- Consumes: `UserFilterDto`, `CreateUserRequest/Response`, `UpdateUserRequest/Response`, `DeleteUserResponse`, `AssignRolesRequest/Response`, `AdminUserDetailResponse`, `UserDto` (Task 4); `identityClient` (đã có sẵn — `.get(url, params?)`, `.post(url, payload)`, `.put(url, payload)`, `.delete(url)`, trả `Promise<ApiResponse<T>>`/`Promise<PagedApiResponse<T>>`).
- Produces: `userApi.getPagedAsync`, `getByIdAsync`, `createAsync`, `updateAsync`, `deleteAsync`, `assignRolesAsync` (dùng ở Task 6).

- [ ] **Step 1: Cập nhật `IDENTITY.USERS_API` trong `api.constants.ts`**

Đổi:

```ts
        USERS_API: {
            GET_PAGED: '/admin/users',
            GET_PROFILE: 'admin/users/profile',
        },
```

thành:

```ts
        USERS_API: {
            GET_PAGED: '/admin/users',
            GET_PROFILE: 'admin/users/profile',
            GET_BY_ID: (id: string) => `/admin/users/${id}`,
            CREATE: '/admin/users',
            UPDATE: (id: string) => `/admin/users/${id}`,
            DELETE: (id: string) => `/admin/users/${id}`,
            ASSIGN_ROLES: (id: string) => `/admin/users/${id}/roles`,
        },
```

- [ ] **Step 2: Cập nhật `user.api.ts`**

Đổi toàn bộ nội dung file thành:

```ts
import { API_ENDPOINTS } from '@/core/constants/api.constants'
import type { ApiResponse, PagedApiResponse } from '@/core/models/common.dto'

import { identityClient } from '@/core/api/clients/identity.client'
import type { UserProfileDto, UserDto } from '@/modules/user/models/dtos/_index'
import type { UserFilterDto } from '@/modules/user/models/dtos/user-filter.dto'
import type { CreateUserRequest, CreateUserResponse } from '@/modules/user/models/dtos/create-user.dto'
import type { UpdateUserRequest, UpdateUserResponse } from '@/modules/user/models/dtos/update-user.dto'
import type { DeleteUserResponse } from '@/modules/user/models/dtos/delete-user.dto'
import type { AssignRolesRequest, AssignRolesResponse } from '@/modules/user/models/dtos/assign-roles.dto'
import type { AdminUserDetailResponse } from '@/modules/user/models/dtos/admin-user-detail.dto'

export const userApi = {
    getProfileAsync(): Promise<ApiResponse<UserProfileDto>> {
        return identityClient.get(API_ENDPOINTS.IDENTITY.USERS_API.GET_PROFILE)
    },

    getPagedAsync(params: UserFilterDto): Promise<PagedApiResponse<UserDto>> {
        return identityClient.get(API_ENDPOINTS.IDENTITY.USERS_API.GET_PAGED, params)
    },

    getByIdAsync(id: string): Promise<ApiResponse<AdminUserDetailResponse>> {
        return identityClient.get(API_ENDPOINTS.IDENTITY.USERS_API.GET_BY_ID(id))
    },

    createAsync(payload: CreateUserRequest): Promise<ApiResponse<CreateUserResponse>> {
        return identityClient.post(API_ENDPOINTS.IDENTITY.USERS_API.CREATE, payload)
    },

    updateAsync(id: string, payload: UpdateUserRequest): Promise<ApiResponse<UpdateUserResponse>> {
        return identityClient.put(API_ENDPOINTS.IDENTITY.USERS_API.UPDATE(id), payload)
    },

    deleteAsync(id: string): Promise<ApiResponse<DeleteUserResponse>> {
        return identityClient.delete(API_ENDPOINTS.IDENTITY.USERS_API.DELETE(id))
    },

    assignRolesAsync(id: string, payload: AssignRolesRequest): Promise<ApiResponse<AssignRolesResponse>> {
        return identityClient.put(API_ENDPOINTS.IDENTITY.USERS_API.ASSIGN_ROLES(id), payload)
    },
}
```

- [ ] **Step 3: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
cd NDTCore.FE
git add src/core/constants/api.constants.ts src/modules/user/api/user.api.ts
git commit -m "feat: add admin user API methods (paged list, get-by-id, CRUD, assign roles)"
```

---

### Task 6: Mappers, adapter, service

**Files:**
- Create: `NDTCore.FE/src/modules/user/mappers/user.mapper.ts`
- Create: `NDTCore.FE/src/modules/user/mappers/user-detail.mapper.ts`
- Create: `NDTCore.FE/src/modules/user/adapters/user.adapter.ts`
- Modify: `NDTCore.FE/src/modules/user/services/user.service.ts`

**Interfaces:**
- Consumes: `userApi` (Task 5), `UserDto`/`AdminUserDetailResponse`/`CreateUserResponse`/`UpdateUserResponse` (Task 4), `PagedResult<T>` (`@/core/types/pagination.types`, đã có sẵn).
- Produces: `userMapper.toViewModel/toViewModels/createResponseToViewModel`, `userDetailMapper.toViewModel`, `emptyCreateForm()`, `toCreatePayload(form)`, `toOverviewForm(entity)`, `toUpdatePayload(form)`, `TRACKED_FIELDS`, `userService.getPagedUsersAsync/getUserAsync/createUserAsync/updateUserAsync/deleteUserAsync/assignRolesAsync/getProfileAsync`. Dùng ở Task 7 (`useUser.ts`).

- [ ] **Step 1: `user.mapper.ts`**

```ts
import type { UserDto } from '@/modules/user/models/dtos/user.dto'
import type { CreateUserResponse } from '@/modules/user/models/dtos/create-user.dto'
import type { UserViewModel } from '@/modules/user/models/view-models/user.view-model'

export const userMapper = {
    toViewModels(dtos: UserDto[]): UserViewModel[] {
        return (dtos ?? []).map((dto) => this.toViewModel(dto))
    },

    toViewModel(dto: UserDto): UserViewModel {
        return {
            id: dto.Id,
            email: dto.Email,
            userName: dto.UserName,
            firstName: dto.FirstName,
            lastName: dto.LastName,
            fullName: dto.FullName,
            phoneNumber: dto.PhoneNumber ?? null,
            avatarUrl: dto.AvatarUrl ?? null,
            emailConfirmed: dto.EmailConfirmed,
            phoneNumberConfirmed: dto.PhoneNumberConfirmed,
            isActive: dto.IsActive,
            lastLoginAt: dto.LastLoginAt ?? null,
            createdAt: dto.CreatedAt ?? null,
            updatedAt: dto.UpdatedAt ?? null,
            roles: dto.Roles ?? [],
        }
    },

    createResponseToViewModel(res: CreateUserResponse): UserViewModel {
        return {
            id: res.Id,
            email: res.Email,
            userName: res.UserName,
            firstName: res.FirstName,
            lastName: res.LastName,
            fullName: res.FullName,
            phoneNumber: null,
            avatarUrl: null,
            emailConfirmed: false,
            phoneNumberConfirmed: false,
            isActive: res.IsActive,
            lastLoginAt: null,
            createdAt: res.CreatedAt ?? null,
            updatedAt: null,
            roles: res.Roles ?? [],
        }
    },
}
```

- [ ] **Step 2: `user-detail.mapper.ts`**

```ts
import type { AdminUserDetailResponse } from '@/modules/user/models/dtos/admin-user-detail.dto'
import type { UserDetailViewModel } from '@/modules/user/models/view-models/user-detail.view-model'

export const userDetailMapper = {
    toViewModel(dto: AdminUserDetailResponse): UserDetailViewModel {
        return {
            id: dto.Id,
            email: dto.Email,
            userName: dto.UserName,
            firstName: dto.FirstName,
            lastName: dto.LastName,
            fullName: dto.FullName,
            phoneNumber: dto.PhoneNumber ?? null,
            avatarUrl: dto.AvatarUrl ?? null,
            dateOfBirth: dto.DateOfBirth ?? null,
            gender: dto.Gender ?? null,
            isActive: dto.IsActive,
            emailConfirmed: dto.EmailConfirmed,
            phoneNumberConfirmed: dto.PhoneNumberConfirmed,
            lockoutEnabled: dto.LockoutEnabled,
            lockoutEnd: dto.LockoutEnd ?? null,
            accessFailedCount: dto.AccessFailedCount,
            lastLoginAt: dto.LastLoginAt ?? null,
            roles: dto.Roles ?? [],
            tenantId: dto.TenantId,
            createdAt: dto.CreatedAt ?? null,
            createdBy: dto.CreatedBy ?? null,
            updatedAt: dto.UpdatedAt ?? null,
            updatedBy: dto.UpdatedBy ?? null,
            isDeleted: dto.IsDeleted,
            deletedAt: dto.DeletedAt ?? null,
            deletedBy: dto.DeletedBy ?? null,
        }
    },
}
```

- [ ] **Step 3: `user.adapter.ts`**

```ts
import type { UserDetailViewModel } from '../models/view-models/user-detail.view-model'
import type { CreateUserFormModel, UserOverviewFormModel } from '../models/form-models/user.model'
import type { CreateUserRequest } from '../models/dtos/create-user.dto'
import type { UpdateUserRequest } from '../models/dtos/update-user.dto'

export const TRACKED_FIELDS: ReadonlyArray<keyof UserOverviewFormModel> = [
    'firstName', 'lastName', 'phoneNumber', 'avatarUrl', 'dateOfBirth', 'gender', 'isActive',
] as const

export function emptyCreateForm(): CreateUserFormModel {
    return {
        email: '',
        userName: '',
        password: '',
        firstName: '',
        lastName: '',
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
        isActive: true,
    }
}

export function toCreatePayload(form: CreateUserFormModel): CreateUserRequest {
    return {
        Email: form.email.trim(),
        UserName: form.userName.trim(),
        Password: form.password,
        FirstName: form.firstName.trim(),
        LastName: form.lastName.trim(),
        PhoneNumber: form.phoneNumber?.trim() ?? null,
        DateOfBirth: form.dateOfBirth ?? null,
        Gender: form.gender ?? null,
        IsActive: form.isActive,
    }
}

export function toOverviewForm(entity: UserDetailViewModel): UserOverviewFormModel {
    return {
        firstName: entity.firstName ?? '',
        lastName: entity.lastName ?? '',
        phoneNumber: entity.phoneNumber ?? null,
        avatarUrl: entity.avatarUrl ?? null,
        dateOfBirth: entity.dateOfBirth ?? null,
        gender: entity.gender ?? null,
        isActive: entity.isActive ?? true,
    }
}

export function toUpdatePayload(form: UserOverviewFormModel): UpdateUserRequest {
    return {
        FirstName: form.firstName.trim(),
        LastName: form.lastName.trim(),
        PhoneNumber: form.phoneNumber?.trim() ?? null,
        AvatarUrl: form.avatarUrl?.trim() ?? null,
        DateOfBirth: form.dateOfBirth ?? null,
        Gender: form.gender ?? null,
        IsActive: form.isActive,
    }
}
```

- [ ] **Step 4: Cập nhật `user.service.ts`**

Đổi toàn bộ nội dung file thành:

```ts
import { userApi } from '@/modules/user/api/user.api'
import { userMapper } from '@/modules/user/mappers/user.mapper'
import { userDetailMapper } from '@/modules/user/mappers/user-detail.mapper'
import type { UserProfileDto } from '@/modules/user/models/dtos/_index'
import type { UserFilterDto } from '@/modules/user/models/dtos/user-filter.dto'
import type { CreateUserRequest } from '@/modules/user/models/dtos/create-user.dto'
import type { UpdateUserRequest } from '@/modules/user/models/dtos/update-user.dto'
import type { AssignRolesRequest } from '@/modules/user/models/dtos/assign-roles.dto'
import type { UserViewModel } from '@/modules/user/models/view-models/user.view-model'
import type { UserDetailViewModel } from '@/modules/user/models/view-models/user-detail.view-model'
import type { PagedResult } from '@/core/types/pagination.types'

class UserService {
    async getProfileAsync(): Promise<UserProfileDto | null> {
        const response = await userApi.getProfileAsync()

        return response.Data
    }

    async getPagedUsersAsync(filter: UserFilterDto): Promise<PagedResult<UserViewModel>> {
        const response = await userApi.getPagedAsync(filter)
        return {
            items: userMapper.toViewModels(response.Data ?? []),
            pageNumber: response.PageNumber,
            pageSize: response.PageSize,
            totalCount: response.TotalCount,
            totalPages: response.TotalPages,
            hasPreviousPage: response.HasPreviousPage,
            hasNextPage: response.HasNextPage,
        }
    }

    async getUserAsync(id: string): Promise<UserDetailViewModel | null> {
        const response = await userApi.getByIdAsync(id)
        return response.Data ? userDetailMapper.toViewModel(response.Data) : null
    }

    async createUserAsync(payload: CreateUserRequest): Promise<UserViewModel | null> {
        const response = await userApi.createAsync(payload)
        return response.Data ? userMapper.createResponseToViewModel(response.Data) : null
    }

    async updateUserAsync(id: string, payload: UpdateUserRequest): Promise<void> {
        await userApi.updateAsync(id, payload)
    }

    async deleteUserAsync(id: string): Promise<void> {
        await userApi.deleteAsync(id)
    }

    async assignRolesAsync(id: string, payload: AssignRolesRequest): Promise<void> {
        await userApi.assignRolesAsync(id, payload)
    }
}

export const userService = new UserService()
```

> Lưu ý: `updateUserAsync`/`assignRolesAsync` không map response thành ViewModel — caller (composable/view) tự gọi lại `getUser(id)` để lấy state mới nhất, tránh trùng logic merge ở 2 nơi.

- [ ] **Step 5: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 error.

- [ ] **Step 6: Commit**

```bash
cd NDTCore.FE
git add src/modules/user/mappers src/modules/user/adapters src/modules/user/services/user.service.ts
git commit -m "feat: add mappers, adapter, and service methods for admin user management"
```

---

### Task 7: `useUser.ts` composable

**Files:**
- Create: `NDTCore.FE/src/modules/user/composables/useUser.ts`

**Interfaces:**
- Consumes: `userService` (Task 6), `useToastNotification` (`@/composables/useToastNotification`, đã có sẵn).
- Produces: `useUser()` trả `{ getPagedUsers, getUser, createUser, updateUser, deleteUser, assignRoles }`. Dùng ở Task 9, 11, 12, 13, 14.

- [ ] **Step 1: Viết `useUser.ts`**

```ts
import { useToastNotification } from '@/composables/useToastNotification'
import { userService } from '@/modules/user/services/user.service'
import type { UserFilterDto } from '@/modules/user/models/dtos/user-filter.dto'
import type { CreateUserRequest } from '@/modules/user/models/dtos/create-user.dto'
import type { UpdateUserRequest } from '@/modules/user/models/dtos/update-user.dto'
import type { AssignRolesRequest } from '@/modules/user/models/dtos/assign-roles.dto'

export function useUser() {
    const toast = useToastNotification()

    async function getPagedUsers(filter: UserFilterDto) {
        try {
            return await userService.getPagedUsersAsync(filter)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Không thể tải danh sách người dùng.')
            throw error
        }
    }

    async function getUser(id: string) {
        try {
            return await userService.getUserAsync(id)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Không thể tải chi tiết người dùng.')
            throw error
        }
    }

    async function createUser(payload: CreateUserRequest) {
        try {
            const user = await userService.createUserAsync(payload)
            toast.success('Tạo người dùng thành công.')
            return user
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Tạo người dùng thất bại.')
            throw error
        }
    }

    async function updateUser(id: string, payload: UpdateUserRequest) {
        try {
            await userService.updateUserAsync(id, payload)
            toast.success('Cập nhật người dùng thành công.')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Cập nhật người dùng thất bại.')
            throw error
        }
    }

    async function deleteUser(id: string) {
        try {
            await userService.deleteUserAsync(id)
            toast.success('Xóa người dùng thành công.')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Xóa người dùng thất bại.')
            throw error
        }
    }

    async function assignRoles(id: string, payload: AssignRolesRequest) {
        try {
            await userService.assignRolesAsync(id, payload)
            toast.success('Gán role thành công.')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gán role thất bại.')
            throw error
        }
    }

    return { getPagedUsers, getUser, createUser, updateUser, deleteUser, assignRoles }
}
```

- [ ] **Step 2: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
cd NDTCore.FE
git add src/modules/user/composables/useUser.ts
git commit -m "feat: add useUser composable for admin user CRUD and role assignment"
```

---

### Task 8: `user-list.constants.ts`

**Files:**
- Create: `NDTCore.FE/src/modules/user/constants/user-list.constants.ts`

**Interfaces:**
- Consumes: `UserViewModel` (Task 4), `FilterField`/`TableColumn`/`RowAction`/`ActiveFilters`/`SortState` (`@/components/ui`, đã có sẵn), `SYSTEM_ROLES` (`@/core/constants/app.constants`, đã có sẵn).
- Produces: `USER_LIST_EMIT`, `UserListEmits`, `USER_ROW_ACTION`, `buildUserFilterFields()`, `USER_LIST_COLUMNS`, `USER_LIST_ROW_ACTIONS`. Dùng ở Task 9, 11.

- [ ] **Step 1: Viết `user-list.constants.ts`**

```ts
import type {
    FilterField,
    TableColumn,
    RowAction,
    SortState,
    ActiveFilters,
} from '@/components/ui'
import { SYSTEM_ROLES } from '@/core/constants/app.constants'
import type { UserViewModel } from '@/modules/user/models/view-models/user.view-model'

export const USER_LIST_EMIT = {
    UPDATE_ACTIVE_FILTERS: 'update:activeFilters',
    SEARCH: 'search',
    RESET: 'reset',
    PAGE_CHANGE: 'page-change',
    PAGE_SIZE_CHANGE: 'page-size-change',
    SORT_CHANGE: 'sort-change',
    ROW_ACTION: 'row-action',
    CREATE: 'create',
    REFRESH: 'refresh',
} as const

export type UserListEmits = {
    (event: typeof USER_LIST_EMIT.UPDATE_ACTIVE_FILTERS, value: ActiveFilters): void
    (event: typeof USER_LIST_EMIT.SEARCH): void
    (event: typeof USER_LIST_EMIT.RESET): void
    (event: typeof USER_LIST_EMIT.PAGE_CHANGE, page: number): void
    (event: typeof USER_LIST_EMIT.PAGE_SIZE_CHANGE, size: number): void
    (event: typeof USER_LIST_EMIT.SORT_CHANGE, state: SortState | null): void
    (event: typeof USER_LIST_EMIT.ROW_ACTION, key: string, item: UserViewModel): void
    (event: typeof USER_LIST_EMIT.CREATE): void
    (event: typeof USER_LIST_EMIT.REFRESH): void
}

export const USER_ROW_ACTION = {
    EDIT: 'edit',
    DELETE: 'delete',
} as const

export function buildUserFilterFields(): FilterField[] {
    return [
        { key: 'keyword', label: 'Tìm kiếm', type: 'text', placeholder: 'Họ tên, email, username...' },
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
        {
            key: 'isLocked',
            label: 'Khóa tài khoản',
            type: 'select',
            options: [
                { label: 'Tất cả', value: null },
                { label: 'Đang bị khóa', value: 'true' },
                { label: 'Không bị khóa', value: 'false' },
            ],
        },
    ]
}

export const USER_LIST_COLUMNS: TableColumn[] = [
    { key: 'fullName', title: 'Họ tên', sortable: true, minWidth: '200px' },
    { key: 'email', title: 'Email', minWidth: '200px', hideBelow: 'md' },
    { key: 'userName', title: 'Username', width: '140px', hideBelow: 'lg' },
    { key: 'roles', title: 'Roles', width: '200px' },
    { key: 'isActive', title: 'Trạng thái', width: '130px', align: 'center' },
    { key: 'lastLoginAt', title: 'Đăng nhập gần nhất', width: '170px', hideBelow: 'lg' },
    { key: 'actions', title: '', width: '100px', align: 'end' },
]

export const USER_LIST_ROW_ACTIONS: RowAction<UserViewModel>[] = [
    { key: USER_ROW_ACTION.EDIT, label: 'Sửa', icon: 'mdi-pencil-outline' },
    {
        key: USER_ROW_ACTION.DELETE,
        label: 'Xóa',
        icon: 'mdi-delete-outline',
        color: 'error',
        hidden: (item) => item.roles.includes(SYSTEM_ROLES.SUPER_ADMIN),
    },
]
```

- [ ] **Step 2: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
cd NDTCore.FE
git add src/modules/user/constants/user-list.constants.ts
git commit -m "feat: add user list constants (columns, row actions, filter fields)"
```

---

### Task 9: `UserList.vue`

**Files:**
- Create: `NDTCore.FE/src/modules/user/components/user/UserList.vue`

**Interfaces:**
- Consumes: `USER_LIST_EMIT`, `USER_ROW_ACTION`, `USER_LIST_COLUMNS`, `USER_LIST_ROW_ACTIONS`, `UserListEmits` (Task 8), `UserViewModel` (Task 4), `AppBreadcrumb`/`AppPageHeader`/`AppFilterBar`/`AppDataFilter`/`AppDataTable`/`AppPagination`/`AppRowActions`/`AppStatusChip`/`AppEmptyState` (`@/components/ui`, đã có sẵn — chữ ký y hệt cách `StoreList.vue` dùng).
- Produces: component `UserList` với props `items/loading/pageNumber/pageSize/totalPages/totalItems/activeFilters/filterFields/sortBy` và emits theo `UserListEmits`. Dùng ở Task 11.

- [ ] **Step 1: Viết `UserList.vue`**

```vue
<template>
  <div class="d-flex flex-column ga-4">
    <AppPageHeader
      title="Người dùng"
      subtitle="Quản lý tài khoản người dùng và phân quyền"
    >
      <template #breadcrumb>
        <AppBreadcrumb
          :items="[
            { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
            { title: 'Người dùng', disabled: true },
          ]"
        />
      </template>

      <v-btn color="primary" prepend-icon="mdi-plus" @click="emit(USER_LIST_EMIT.CREATE)">
        Tạo người dùng
      </v-btn>
    </AppPageHeader>

    <AppFilterBar>
      <AppDataFilter
        :fields="filterFields"
        :model-value="activeFilters"
        @update:model-value="emit(USER_LIST_EMIT.UPDATE_ACTIVE_FILTERS, $event)"
        @search="emit(USER_LIST_EMIT.SEARCH)"
      />

      <template #actions>
        <v-btn variant="outlined" prepend-icon="mdi-filter-off-outline" @click="emit(USER_LIST_EMIT.RESET)">
          Xóa lọc
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-magnify" @click="emit(USER_LIST_EMIT.SEARCH)">
          Tìm kiếm
        </v-btn>
      </template>
    </AppFilterBar>

    <v-card rounded="lg">
      <AppDataTable
        :items="items"
        :columns="USER_LIST_COLUMNS"
        :loading="loading"
        :sort-by="sortBy"
        item-key="id"
        @update:sort-by="emit(USER_LIST_EMIT.SORT_CHANGE, $event)"
      >
        <template #[`item.fullName`]="{ item }">
          <div class="d-flex flex-column py-1">
            <span class="font-weight-medium">{{ item.fullName }}</span>
            <span class="text-caption text-medium-emphasis">{{ item.userName }}</span>
          </div>
        </template>

        <template #[`item.roles`]="{ item }">
          <div class="d-flex flex-wrap ga-1">
            <v-chip v-for="role in item.roles" :key="role" size="small" variant="tonal" color="primary">
              {{ role }}
            </v-chip>
          </div>
        </template>

        <template #[`item.isActive`]="{ item }">
          <AppStatusChip :config="USER_STATUS_CONFIG[item.isActive ? 'active' : 'inactive']" />
        </template>

        <template #[`item.lastLoginAt`]="{ item }">
          <span class="text-body-2">{{ item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString('vi-VN') : '—' }}</span>
        </template>

        <template #[`item.actions`]="{ item }">
          <AppRowActions
            :actions="USER_LIST_ROW_ACTIONS"
            :item="item"
            @action="emit(USER_LIST_EMIT.ROW_ACTION, $event, item)"
          />
        </template>

        <template #empty>
          <AppEmptyState
            icon="mdi-account-off-outline"
            title="Chưa có người dùng"
            description="Tạo người dùng đầu tiên để bắt đầu quản lý."
          >
            <template #actions>
              <v-btn color="primary" prepend-icon="mdi-plus" @click="emit(USER_LIST_EMIT.CREATE)">
                Tạo người dùng
              </v-btn>
            </template>
          </AppEmptyState>
        </template>
      </AppDataTable>

      <v-divider />

      <AppPagination
        :page-number="pageNumber"
        :page-size="pageSize"
        :total-pages="totalPages"
        :total-items="totalItems"
        @update:page-number="emit(USER_LIST_EMIT.PAGE_CHANGE, $event)"
        @update:page-size="emit(USER_LIST_EMIT.PAGE_SIZE_CHANGE, $event)"
      />
    </v-card>
  </div>
</template>

<script setup lang="ts">
import type { ActiveFilters, FilterField, SortState, StatusConfig } from '@/components/ui'
import {
  AppBreadcrumb,
  AppPageHeader,
  AppFilterBar,
  AppDataFilter,
  AppDataTable,
  AppPagination,
  AppRowActions,
  AppStatusChip,
  AppEmptyState,
} from '@/components/ui'
import { APP_ROUTES } from '@/core/constants/_index'
import {
  USER_LIST_EMIT,
  USER_LIST_COLUMNS,
  USER_LIST_ROW_ACTIONS,
  type UserListEmits,
} from '@/modules/user/constants/user-list.constants'
import type { UserViewModel } from '@/modules/user/models/view-models/user.view-model'

defineProps<{
  items: UserViewModel[]
  loading: boolean
  pageNumber: number
  pageSize: number
  totalPages: number
  totalItems: number
  activeFilters: ActiveFilters
  filterFields: FilterField[]
  sortBy: SortState | null
}>()

const emit = defineEmits<UserListEmits>()

const USER_STATUS_CONFIG: Record<'active' | 'inactive', StatusConfig> = {
  active: { label: 'Hoạt động', color: 'success', icon: 'mdi-check-circle-outline', variant: 'tonal' },
  inactive: { label: 'Ngừng', color: 'error', icon: 'mdi-close-circle-outline', variant: 'tonal' },
}
</script>
```

> Không bind `@row-click` trên `AppDataTable` (khác `StoreList.vue`) — theo quyết định UX: chỉ điều hướng chi tiết qua nút "Sửa", không qua click row.

- [ ] **Step 2: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
cd NDTCore.FE
git add src/modules/user/components/user/UserList.vue
git commit -m "feat: add UserList component"
```

---

### Task 10: `UserForm.vue` (dialog tạo mới)

**Files:**
- Create: `NDTCore.FE/src/modules/user/components/user/UserForm.vue`

**Interfaces:**
- Consumes: `CreateUserFormModel` (Task 4), `AppDialog` (`@/components/ui`, đã có sẵn — props `model-value/title/loading/confirm-label/cancel-label/size`, emits `update:model-value/confirm/cancel`).
- Produces: component `UserForm` với props `modelValue: boolean, submitting: boolean`, emits `update:modelValue: [boolean]`, `submit: [CreateUserFormModel]`. Dùng ở Task 11.

- [ ] **Step 1: Viết `UserForm.vue`**

```vue
<template>
  <AppDialog
    :model-value="modelValue"
    title="Tạo người dùng"
    :loading="submitting"
    confirm-label="Lưu"
    cancel-label="Hủy"
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="handleSubmit"
    @cancel="emit('update:modelValue', false)"
  >
    <v-form ref="formRef">
      <div class="text-subtitle-2 font-weight-semibold mb-3">Tài khoản</div>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="localForm.email"
            label="Email *"
            type="email"
            variant="solo-filled"
            flat
            @update:model-value="update('email', $event)"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="localForm.userName"
            label="Username *"
            variant="solo-filled"
            flat
            @update:model-value="update('userName', $event)"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="localForm.password"
            label="Mật khẩu *"
            type="password"
            variant="solo-filled"
            flat
            hint="Tối thiểu 6 ký tự"
            persistent-hint
            @update:model-value="update('password', $event)"
          />
        </v-col>
        <v-col cols="12" md="6" class="d-flex align-center">
          <v-switch
            :model-value="localForm.isActive"
            label="Đang hoạt động"
            color="primary"
            base-color="grey"
            hide-details
            @update:model-value="update('isActive', !!$event)"
          />
        </v-col>
      </v-row>

      <v-divider class="my-4" />

      <div class="text-subtitle-2 font-weight-semibold mb-3">Thông tin cá nhân</div>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="localForm.firstName"
            label="Họ *"
            variant="solo-filled"
            flat
            @update:model-value="update('firstName', $event)"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="localForm.lastName"
            label="Tên *"
            variant="solo-filled"
            flat
            @update:model-value="update('lastName', $event)"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="localForm.phoneNumber"
            label="Số điện thoại"
            variant="solo-filled"
            flat
            clearable
            @update:model-value="update('phoneNumber', $event || null)"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="localForm.dateOfBirth"
            label="Ngày sinh"
            type="date"
            variant="solo-filled"
            flat
            clearable
            @update:model-value="update('dateOfBirth', $event || null)"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="localForm.gender"
            label="Giới tính"
            variant="solo-filled"
            flat
            clearable
            @update:model-value="update('gender', $event || null)"
          />
        </v-col>
      </v-row>
    </v-form>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { AppDialog } from '@/components/ui'
import type { CreateUserFormModel } from '@/modules/user/models/form-models/user.model'
import { emptyCreateForm } from '@/modules/user/adapters/user.adapter'

interface Props {
  modelValue: boolean
  submitting: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [form: CreateUserFormModel]
}>()

const localForm = ref<CreateUserFormModel>(emptyCreateForm())

watch(
  () => props.modelValue,
  (open) => {
    if (open) localForm.value = emptyCreateForm()
  },
)

function update<K extends keyof CreateUserFormModel>(key: K, value: CreateUserFormModel[K]) {
  localForm.value[key] = value
}

function handleSubmit() {
  emit('submit', { ...localForm.value })
}
</script>
```

- [ ] **Step 2: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
cd NDTCore.FE
git add src/modules/user/components/user/UserForm.vue
git commit -m "feat: add UserForm create dialog component"
```

---

### Task 11: `UsersView.vue` + router (`admin:users`)

**Files:**
- Modify: `NDTCore.FE/src/modules/user/views/UsersView.vue` (hiện đang rỗng)
- Modify: `NDTCore.FE/src/router/routes.ts` (đổi component route `admin:users`)

**Interfaces:**
- Consumes: `UserList` (Task 9), `UserForm` (Task 10), `useUser` (Task 7), `useListPage`/`AppDialog` (`@/components/ui`, đã có sẵn — chữ ký y hệt `StoresView.vue`), `toCreatePayload` (Task 6).
- Produces: trang `/admin/users` hoạt động đầy đủ list + create + delete.

- [ ] **Step 1: Viết `UsersView.vue`**

```vue
<template>
  <div class="d-flex flex-column ga-4">
    <UserList
      :items="viewItems"
      :loading="listPage.loading.value"
      :page-number="listPage.pagination.pageNumber.value"
      :page-size="listPage.pagination.pageSize.value"
      :total-pages="listPage.pagination.totalPages.value"
      :total-items="listPage.pagination.totalItems.value"
      :active-filters="listPage.filters.activeFilters.value"
      :filter-fields="filterFields"
      :sort-by="listPage.sortBy.value"
      @update:active-filters="listPage.filters.setFilters"
      @search="listPage.onSearch"
      @reset="listPage.onResetFilters"
      @page-change="listPage.onPageChange"
      @page-size-change="listPage.onPageSizeChange"
      @sort-change="listPage.onSort"
      @row-action="handleRowAction"
      @create="openCreateDialog"
      @refresh="listPage.refresh"
    />

    <UserForm
      v-model="isFormDialogOpen"
      :submitting="submitting"
      @submit="saveUser"
    />

    <AppDialog
      v-model="isDeleteDialogOpen"
      title="Xóa người dùng"
      size="sm"
      confirm-label="Xóa"
      cancel-label="Hủy"
      :loading="deleting"
      @confirm="doDelete"
      @cancel="userToDelete = null"
    >
      Bạn có chắc muốn xóa người dùng
      <strong>{{ userToDelete?.fullName }}</strong>?
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AppDialog } from '@/components/ui'
import { useListPage } from '@/components/ui/composables'
import type { ListPageParams } from '@/components/ui/composables'
import { APP_ROUTES, DEFAULT_PAGINATION } from '@/core/constants/_index'
import { toCreatePayload } from '@/modules/user/adapters/user.adapter'
import { useUser } from '@/modules/user/composables/useUser'
import { buildUserFilterFields, USER_ROW_ACTION } from '@/modules/user/constants/user-list.constants'
import type { CreateUserFormModel } from '@/modules/user/models/form-models/user.model'
import type { UserViewModel } from '@/modules/user/models/view-models/user.view-model'
import UserList from '@/modules/user/components/user/UserList.vue'
import UserForm from '@/modules/user/components/user/UserForm.vue'

const router = useRouter()
const { getPagedUsers, createUser, deleteUser } = useUser()

const filterFields = computed(() => buildUserFilterFields())

const fetchUsers = async (params: ListPageParams): Promise<{ items: UserViewModel[]; total: number }> => {
  const isActiveStr = params.filters['isActive'] as string | null
  const isLockedStr = params.filters['isLocked'] as string | null
  const result = await getPagedUsers({
    PageNumber: params.pageNumber,
    PageSize: params.pageSize,
    Keyword: (params.filters['keyword'] as string | null) ?? null,
    IsActive: isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : null,
    IsLocked: isLockedStr === 'true' ? true : isLockedStr === 'false' ? false : null,
    SortBy: params.sortBy?.key ?? null,
    SortDirection: params.sortBy?.order ?? null,
  })
  return { items: result.items, total: result.totalCount }
}

const listPage = useListPage<UserViewModel>({
  fetchFn: fetchUsers,
  keyField: 'id',
  defaultPageSize: DEFAULT_PAGINATION.LIMIT,
})

const viewItems = computed<UserViewModel[]>(() => listPage.items.value ?? [])

const isFormDialogOpen = ref(false)
const submitting = ref(false)

const openCreateDialog = () => {
  isFormDialogOpen.value = true
}

const saveUser = async (form: Parameters<typeof toCreatePayload>[0]) => {
  submitting.value = true
  try {
    await createUser(toCreatePayload(form))
    isFormDialogOpen.value = false
    await listPage.refresh()
  } finally {
    submitting.value = false
  }
}

const userToDelete = ref<UserViewModel | null>(null)
const isDeleteDialogOpen = ref(false)
const deleting = ref(false)

const doDelete = async () => {
  if (!userToDelete.value) return
  const id = userToDelete.value.id
  isDeleteDialogOpen.value = false
  userToDelete.value = null
  deleting.value = true
  try {
    await deleteUser(id)
    await listPage.refresh()
  } finally {
    deleting.value = false
  }
}

const handleRowAction = (key: string, item: UserViewModel) => {
  if (key === USER_ROW_ACTION.EDIT) {
    void router.push({ name: APP_ROUTES.ADMIN.CHILDREN.USER_DETAIL.NAME, params: { id: item.id } })
  } else if (key === USER_ROW_ACTION.DELETE) {
    userToDelete.value = item
    isDeleteDialogOpen.value = true
  }
}

onMounted(async () => {
  await listPage.refresh()
})
</script>
```

> Sửa lại import chuẩn: dùng `ref`, `onMounted` từ `vue` (không phải `useRouter` từ `vue`). Xem step 2.

- [ ] **Step 2: Sửa import ở đầu `<script setup>` cho đúng (không có `useRouter`/`useVueRouter` trùng lặp như bản nháp trên)**

Thay dòng import đầu tiên bằng:

```ts
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
```

Và đổi `const router = useVueRouter()` thành `const router = useRouter()`.

- [ ] **Step 3: Đổi route `admin:users` trong `routes.ts`**

Đổi:

```ts
            {
                path: APP_ROUTES.ADMIN.CHILDREN.USERS.PATH,
                name: APP_ROUTES.ADMIN.CHILDREN.USERS.NAME,
                component: () => import('@/components/common/ComingSoonView.vue'),
                meta: {
                    title: 'Users',
                    roles: [SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ORG_ADMIN],
                    breadcrumbs: [
                        { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                        { title: 'Users', disabled: true },
                    ],
                },
            },
```

thành:

```ts
            {
                path: APP_ROUTES.ADMIN.CHILDREN.USERS.PATH,
                name: APP_ROUTES.ADMIN.CHILDREN.USERS.NAME,
                component: () => import('@/modules/user/views/UsersView.vue'),
                meta: {
                    title: 'Người dùng',
                    requiresAuth: true,
                    roles: [SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ORG_ADMIN],
                    breadcrumbs: [
                        { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                        { title: 'Người dùng', disabled: true },
                    ],
                },
            },
```

- [ ] **Step 4: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 error.

- [ ] **Step 5: Kiểm thử thủ công**

Run: `npm run dev`, đăng nhập với SuperAdmin/OrgAdmin, vào menu "Người dùng":
- Danh sách load được, phân trang hoạt động, filter Keyword/IsActive/IsLocked hoạt động.
- Bấm "Tạo người dùng" → điền form → Lưu → toast thành công, list refresh, user mới xuất hiện.
- Bấm icon "Xóa" trên 1 row (không phải SuperAdmin) → confirm → toast thành công, user biến mất khỏi list.
- Xác nhận row có role `SuperAdmin` **không hiện** icon "Xóa".

- [ ] **Step 6: Commit**

```bash
cd NDTCore.FE
git add src/modules/user/views/UsersView.vue src/router/routes.ts
git commit -m "feat: wire UsersView (list, create, delete) and admin:users route"
```

---

### Task 12: `UserOverviewTab.vue`

**Files:**
- Create: `NDTCore.FE/src/modules/user/components/user/UserOverviewTab.vue`

**Interfaces:**
- Consumes: `UserDetailViewModel`, `UserOverviewFormModel` (Task 4), `AppAuditHistory` (`@/components/ui`, đã có sẵn — props `created-at/created-by/updated-at/updated-by/format-date`).
- Produces: component `UserOverviewTab` props `entity/form/isDirty/submitting`, emits `update:form/save/discard/back`. Dùng ở Task 14.

- [ ] **Step 1: Viết `UserOverviewTab.vue`**

```vue
<template>
  <div>
    <div class="d-flex align-center justify-space-between ga-2 pa-3 px-4">
      <v-btn variant="text" rounded="lg" prepend-icon="mdi-arrow-left" @click="emit('back')">
        Quay lại
      </v-btn>

      <div class="d-flex align-center ga-2">
        <v-slide-x-reverse-transition>
          <v-btn
            v-if="props.isDirty"
            variant="text"
            rounded="lg"
            :disabled="props.submitting"
            @click="emit('discard')"
          >
            Hủy thay đổi
          </v-btn>
        </v-slide-x-reverse-transition>

        <v-btn
          color="primary"
          variant="flat"
          rounded="lg"
          prepend-icon="mdi-content-save-outline"
          :loading="props.submitting"
          :disabled="!props.isDirty"
          @click="emit('save')"
        >
          Lưu thay đổi
        </v-btn>
      </div>
    </div>

    <v-divider />

    <div class="pa-5">
      <v-row>
        <v-col cols="12" md="6">
          <v-card elevation="0" rounded="lg" height="100%" class="info-card">
            <v-list-item class="bg-surface-variant py-3">
              <template #prepend>
                <v-sheet rounded="md" width="32" height="32" class="d-flex align-center justify-center mr-1">
                  <v-icon icon="mdi-account-outline" size="16" color="primary" />
                </v-sheet>
              </template>
              <v-list-item-title class="font-weight-semibold">Tài khoản</v-list-item-title>
            </v-list-item>
            <v-divider />
            <div class="pa-4 d-flex flex-column ga-4">
              <v-text-field :model-value="props.entity.email" label="Email" variant="solo-filled" flat readonly />
              <v-text-field :model-value="props.entity.userName" label="Username" variant="solo-filled" flat readonly />
              <div>
                <div class="text-caption text-medium-emphasis mb-2 ml-1">Trạng thái</div>
                <v-btn-toggle
                  :model-value="props.form.isActive ? 'active' : 'inactive'"
                  density="comfortable"
                  rounded="lg"
                  mandatory
                  class="w-100"
                  @update:model-value="emit('update:form', 'isActive', $event === 'active')"
                >
                  <v-btn value="active" :color="props.form.isActive ? 'primary' : undefined" variant="outlined" class="text-none flex-1-1" prepend-icon="mdi-check-circle-outline">
                    Đang hoạt động
                  </v-btn>
                  <v-btn value="inactive" :color="!props.form.isActive ? 'error' : undefined" variant="outlined" class="text-none flex-1-1" prepend-icon="mdi-close-circle-outline">
                    Ngưng hoạt động
                  </v-btn>
                </v-btn-toggle>
              </div>
            </div>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card elevation="0" rounded="lg" height="100%" class="info-card">
            <v-list-item class="bg-surface-variant py-3">
              <template #prepend>
                <v-sheet rounded="md" width="32" height="32" class="d-flex align-center justify-center mr-1">
                  <v-icon icon="mdi-card-account-details-outline" size="16" color="primary" />
                </v-sheet>
              </template>
              <v-list-item-title class="font-weight-semibold">Thông tin cá nhân</v-list-item-title>
            </v-list-item>
            <v-divider />
            <div class="pa-4 d-flex flex-column ga-4">
              <v-text-field :model-value="props.form.firstName" label="Họ *" variant="solo-filled" flat @update:model-value="emit('update:form', 'firstName', $event)" />
              <v-text-field :model-value="props.form.lastName" label="Tên *" variant="solo-filled" flat @update:model-value="emit('update:form', 'lastName', $event)" />
              <v-text-field :model-value="props.form.phoneNumber" label="Số điện thoại" variant="solo-filled" flat clearable @update:model-value="emit('update:form', 'phoneNumber', $event || null)" />
              <v-text-field :model-value="props.form.dateOfBirth" label="Ngày sinh" type="date" variant="solo-filled" flat clearable @update:model-value="emit('update:form', 'dateOfBirth', $event || null)" />
              <v-text-field :model-value="props.form.gender" label="Giới tính" variant="solo-filled" flat clearable @update:model-value="emit('update:form', 'gender', $event || null)" />
              <v-text-field :model-value="props.form.avatarUrl" label="Avatar URL" variant="solo-filled" flat clearable @update:model-value="emit('update:form', 'avatarUrl', $event || null)" />
            </div>
          </v-card>
        </v-col>

        <v-col cols="12">
          <AppAuditHistory
            :created-at="props.entity.createdAt"
            :created-by="props.entity.createdBy"
            :updated-at="props.entity.updatedAt"
            :updated-by="props.entity.updatedBy"
            :format-date="formatUserDate"
          />
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AppAuditHistory } from '@/components/ui'
import type { UserDetailViewModel } from '@/modules/user/models/view-models/user-detail.view-model'
import type { UserOverviewFormModel } from '@/modules/user/models/form-models/user.model'

const props = defineProps<{
  entity: UserDetailViewModel
  form: UserOverviewFormModel
  isDirty: boolean
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:form': [field: keyof UserOverviewFormModel, value: unknown]
  save: []
  discard: []
  back: []
}>()

function formatUserDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}
</script>

<style scoped>
.info-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
```

- [ ] **Step 2: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
cd NDTCore.FE
git add src/modules/user/components/user/UserOverviewTab.vue
git commit -m "feat: add UserOverviewTab component"
```

---

### Task 13: `UserRolesTab.vue`

**Files:**
- Create: `NDTCore.FE/src/modules/user/components/user/UserRolesTab.vue`

**Interfaces:**
- Consumes: `UserDetailViewModel` (Task 4), `SYSTEM_ROLES` (`@/core/constants/app.constants`, đã có sẵn — 12 role tĩnh).
- Produces: component `UserRolesTab` props `roles: string[], submitting: boolean`, emit `assign: [string[]]`. Dùng ở Task 14.

- [ ] **Step 1: Viết `UserRolesTab.vue`**

```vue
<template>
  <div class="pa-5 d-flex flex-column ga-5">
    <v-card elevation="0" rounded="lg" class="info-card">
      <v-list-item class="bg-surface-variant py-3">
        <template #prepend>
          <v-sheet rounded="md" width="32" height="32" class="d-flex align-center justify-center mr-1">
            <v-icon icon="mdi-shield-account-outline" size="16" color="primary" />
          </v-sheet>
        </template>
        <v-list-item-title class="font-weight-semibold">Roles hiện tại</v-list-item-title>
      </v-list-item>
      <v-divider />
      <div class="pa-4">
        <div v-if="props.roles.length === 0" class="text-body-2 text-medium-emphasis">
          Người dùng chưa có role nào.
        </div>
        <div v-else class="d-flex flex-wrap ga-2">
          <v-chip v-for="role in props.roles" :key="role" color="primary" variant="tonal">
            {{ role }}
          </v-chip>
        </div>
      </div>
    </v-card>

    <v-card elevation="0" rounded="lg" class="info-card">
      <v-list-item class="bg-surface-variant py-3">
        <template #prepend>
          <v-sheet rounded="md" width="32" height="32" class="d-flex align-center justify-center mr-1">
            <v-icon icon="mdi-shield-plus-outline" size="16" color="primary" />
          </v-sheet>
        </template>
        <v-list-item-title class="font-weight-semibold">Gán thêm role</v-list-item-title>
      </v-list-item>
      <v-divider />
      <div class="pa-4 d-flex flex-column ga-4">
        <v-select
          v-model="selectedRoles"
          :items="availableRoles"
          label="Chọn role muốn gán"
          variant="solo-filled"
          flat
          multiple
          chips
          closable-chips
          hint="Chỉ thêm role mới, không xóa role hiện tại"
          persistent-hint
        />
        <div>
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            prepend-icon="mdi-shield-plus-outline"
            :loading="props.submitting"
            :disabled="selectedRoles.length === 0"
            @click="handleAssign"
          >
            Gán role
          </v-btn>
        </div>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SYSTEM_ROLES } from '@/core/constants/app.constants'

const props = defineProps<{
  roles: string[]
  submitting: boolean
}>()

const emit = defineEmits<{
  assign: [roles: string[]]
}>()

const selectedRoles = ref<string[]>([])

const availableRoles = computed(() =>
  Object.values(SYSTEM_ROLES).filter(
    (role) => role !== SYSTEM_ROLES.SUPER_ADMIN && !props.roles.includes(role),
  ),
)

watch(
  () => props.submitting,
  (submitting, wasSubmitting) => {
    if (wasSubmitting && !submitting) selectedRoles.value = []
  },
)

function handleAssign() {
  emit('assign', [...selectedRoles.value])
}
</script>

<style scoped>
.info-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
```

- [ ] **Step 2: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
cd NDTCore.FE
git add src/modules/user/components/user/UserRolesTab.vue
git commit -m "feat: add UserRolesTab component (add-only role assignment)"
```

---

### Task 14: `UserDetailView.vue` + router (`admin:user-detail`)

**Files:**
- Create: `NDTCore.FE/src/modules/user/views/UserDetailView.vue`
- Modify: `NDTCore.FE/src/router/routes.ts` (thêm route `admin:user-detail`)

**Interfaces:**
- Consumes: `UserOverviewTab` (Task 12), `UserRolesTab` (Task 13), `useUser` (Task 7), `toOverviewForm`/`toUpdatePayload`/`TRACKED_FIELDS` (Task 6), `useAsyncState`/`AppBreadcrumb`/`AppEmptyState`/`AppConfirmDialog` (đã có sẵn — chữ ký y hệt `StoreDetailView.vue`).
- Produces: trang `/admin/users/:id` hoạt động đầy đủ 2 tab Tổng quan/Roles.

- [ ] **Step 1: Viết `UserDetailView.vue`**

```vue
<template>
  <div class="d-flex flex-column ga-5">
    <template v-if="user.loading.value">
      <v-skeleton-loader type="heading" />
      <v-skeleton-loader type="card" height="120" />
      <v-skeleton-loader type="card" />
    </template>

    <template v-else-if="user.data.value">
      <v-card variant="tonal" color="primary" rounded="lg" flat>
        <v-card-text class="pa-5">
          <div class="d-flex flex-column ga-3">
            <AppBreadcrumb
              :items="[
                { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                { title: 'Người dùng', to: { name: APP_ROUTES.ADMIN.CHILDREN.USERS.NAME } },
                { title: user.data.value.fullName, disabled: true },
              ]"
            />
            <div class="d-flex align-center ga-3">
              <v-sheet rounded="lg" width="52" height="52" class="d-flex align-center justify-center flex-shrink-0">
                <v-icon icon="mdi-account" size="28" color="primary" />
              </v-sheet>
              <div>
                <div class="text-h6 font-weight-bold text-high-emphasis">{{ user.data.value.fullName }}</div>
                <div class="text-body-2 text-medium-emphasis mt-1">{{ user.data.value.email }}</div>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-card rounded="lg" elevation="1">
        <v-tabs v-model="activeTab" color="primary" class="px-2">
          <v-tab value="overview" class="text-none" rounded="lg">
            <v-icon start icon="mdi-information-outline" size="18" />
            Tổng quan
          </v-tab>
          <v-tab value="roles" class="text-none" rounded="lg">
            <v-icon start icon="mdi-shield-account-outline" size="18" />
            Roles
          </v-tab>
        </v-tabs>
        <v-divider />
        <v-window v-model="activeTab">
          <v-window-item value="overview">
            <UserOverviewTab
              :entity="user.data.value"
              :form="editForm"
              :is-dirty="isDirty"
              :submitting="submitting"
              @update:form="onFormUpdate"
              @save="saveChanges"
              @discard="onDiscard"
              @back="onBack"
            />
          </v-window-item>
          <v-window-item value="roles">
            <UserRolesTab
              :roles="user.data.value.roles"
              :submitting="assigning"
              @assign="onAssignRoles"
            />
          </v-window-item>
        </v-window>
      </v-card>
    </template>

    <AppEmptyState
      v-else-if="!user.loading.value"
      icon="mdi-account-off-outline"
      title="Không tìm thấy người dùng"
      description="Người dùng này không tồn tại hoặc đã bị xóa."
    >
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-arrow-left" rounded="lg" :to="{ name: APP_ROUTES.ADMIN.CHILDREN.USERS.NAME }">
          Quay lại danh sách
        </v-btn>
      </template>
    </AppEmptyState>

    <AppConfirmDialog
      v-model="confirmOpen"
      title="Bỏ thay đổi?"
      message="Bạn có thay đổi chưa được lưu. Nếu tiếp tục, các thay đổi sẽ bị mất."
      confirm-label="Bỏ thay đổi"
      @confirm="onConfirmUnsaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, toRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppBreadcrumb, AppEmptyState, AppConfirmDialog } from '@/components/ui'
import { useAsyncState } from '@/composables/useAsyncState'
import { APP_ROUTES } from '@/core/constants/_index'
import { useUser } from '@/modules/user/composables/useUser'
import { toOverviewForm, toUpdatePayload, TRACKED_FIELDS } from '@/modules/user/adapters/user.adapter'
import type { UserOverviewFormModel } from '@/modules/user/models/form-models/user.model'
import UserOverviewTab from '@/modules/user/components/user/UserOverviewTab.vue'
import UserRolesTab from '@/modules/user/components/user/UserRolesTab.vue'

const route = useRoute()
const router = useRouter()
const { getUser, updateUser, assignRoles } = useUser()

const userId = String(route.params['id'] ?? '')
if (!userId) void router.replace({ name: APP_ROUTES.ADMIN.CHILDREN.USERS.NAME })

const activeTab = ref('overview')
const submitting = ref(false)
const assigning = ref(false)
const confirmOpen = ref(false)
const pendingNavAction = ref<'back' | 'discard' | null>(null)

const user = useAsyncState(() => getUser(userId))

const editForm = reactive<UserOverviewFormModel>({
  firstName: '', lastName: '', phoneNumber: null, avatarUrl: null, dateOfBirth: null, gender: null, isActive: true,
})
const snapshot = ref<UserOverviewFormModel | null>(null)

function syncFormFromUser() {
  if (!user.data.value) return
  Object.assign(editForm, toOverviewForm(user.data.value))
  snapshot.value = structuredClone(toRaw(editForm))
}

const isDirty = computed(() => {
  if (!snapshot.value) return false
  return TRACKED_FIELDS.some((f) => editForm[f] !== snapshot.value![f])
})

function onFormUpdate(field: keyof UserOverviewFormModel, value: unknown) {
  ;(editForm as Record<string, unknown>)[field] = value
}

function discardChanges() {
  syncFormFromUser()
}

function onBack() {
  if (isDirty.value) { pendingNavAction.value = 'back'; confirmOpen.value = true }
  else void router.push({ name: APP_ROUTES.ADMIN.CHILDREN.USERS.NAME })
}

function onDiscard() {
  if (isDirty.value) { pendingNavAction.value = 'discard'; confirmOpen.value = true }
  else discardChanges()
}

function onConfirmUnsaved() {
  confirmOpen.value = false
  if (pendingNavAction.value === 'back') void router.push({ name: APP_ROUTES.ADMIN.CHILDREN.USERS.NAME })
  else if (pendingNavAction.value === 'discard') discardChanges()
  pendingNavAction.value = null
}

async function saveChanges() {
  submitting.value = true
  try {
    await updateUser(userId, toUpdatePayload(editForm))
    await user.execute()
    syncFormFromUser()
  } finally {
    submitting.value = false
  }
}

async function onAssignRoles(roles: string[]) {
  assigning.value = true
  try {
    await assignRoles(userId, { Roles: roles })
    await user.execute()
  } finally {
    assigning.value = false
  }
}

onMounted(async () => {
  if (!userId) return
  await user.execute()
  syncFormFromUser()
})
</script>
```

- [ ] **Step 2: Thêm route `admin:user-detail` trong `routes.ts`**

Đặt ngay sau block route `admin:users` (đã sửa ở Task 11):

```ts
            {
                path: APP_ROUTES.ADMIN.CHILDREN.USER_DETAIL.PATH,
                name: APP_ROUTES.ADMIN.CHILDREN.USER_DETAIL.NAME,
                component: () => import('@/modules/user/views/UserDetailView.vue'),
                meta: {
                    title: 'Chi tiết người dùng',
                    requiresAuth: true,
                    roles: [SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ORG_ADMIN],
                },
            },
```

- [ ] **Step 3: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 error.

- [ ] **Step 4: Kiểm thử thủ công**

Trên `npm run dev`, từ list "Người dùng" bấm "Sửa" trên 1 row → vào trang chi tiết:
- Tab "Tổng quan": sửa Họ/Tên/SĐT → nút "Lưu thay đổi" bật lên → Lưu → toast thành công, dữ liệu cập nhật, nút Lưu tắt lại.
- Bấm "Quay lại" khi có thay đổi chưa lưu → hiện dialog xác nhận "Bỏ thay đổi?".
- Tab "Roles": chọn 1-2 role trong dropdown (không thấy `SuperAdmin`, không thấy role đã có) → "Gán role" → toast thành công, chip role hiện tại cập nhật, dropdown "Gán thêm role" không còn hiện role vừa gán.
- Vào lại URL `/admin/users/00000000-0000-0000-0000-000000000000` (id không tồn tại) → hiện `AppEmptyState` "Không tìm thấy người dùng".

- [ ] **Step 5: Commit**

```bash
cd NDTCore.FE
git add src/modules/user/views/UserDetailView.vue src/router/routes.ts
git commit -m "feat: wire UserDetailView (overview edit, role assignment) and admin:user-detail route"
```

---

## Self-Review Checklist (đã chạy khi viết plan)

- **Spec coverage:** List (Task 9/11) ✓, Create (Task 10/11) ✓, Edit profile (Task 12/14) ✓, Delete (Task 11) ✓, Assign roles add-only (Task 13/14) ✓, 2 endpoint BE mới (Task 2/3) ✓, doc fix (Task 1) ✓, filter Keyword+IsActive+IsLocked không có Role (Task 8) ✓, router/nav đã scaffold được nối đúng (Task 11/14) ✓.
- **Placeholder scan:** không còn "TBD"/"tương tự Task N" — toàn bộ code trong mỗi step là code đầy đủ.
- **Type consistency:** `UserViewModel`/`UserDetailViewModel`/`CreateUserFormModel`/`UserOverviewFormModel` dùng nhất quán tên field xuyên suốt Task 4 → 14; `userService`/`useUser` method name khớp giữa Task 6 và Task 7, 9, 11, 14.
