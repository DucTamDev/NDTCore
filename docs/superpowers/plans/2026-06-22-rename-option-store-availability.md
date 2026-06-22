# Rename OptionStoreAvailability → OptionStore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi tên entity `OptionStoreAvailability` (BE) thành `OptionStore`, cùng mọi class/file/identifier trực tiếp đại diện cho entity này (repository, EF config, DbSet, table, index/constraint names, Command/Handler/Validator, Contracts ViewModel, DTO frontend), không đổi logic nghiệp vụ.

**Architecture:** Đây là rename thuần (không đổi hành vi), nên mỗi task dùng bước "verify build / grep" thay cho TDD red-green. Toàn bộ quy ước đặt tên mới được suy ra **chính xác theo khuôn mẫu đã có sẵn trong code**: entity song song `ProductStore` (đã không có suffix "Availability" nhưng route/label/local-var vẫn giữ từ "availability"). Mọi quyết định rename trong plan này đối chiếu 1:1 với `ProductStore`/`GetProductStoreOverridesQueryHandler`/`RemoveProductStoreCommandHandler` để đảm bảo nhất quán tuyệt đối với pattern hiện có — không suy đoán tên mới.

**Tech Stack:** .NET 8 (EF Core, MediatR, FluentValidation, SQL Server) + Vue 3/TypeScript.

## Global Constraints

- Không đổi `IsAvailable` property, route `/availability`, controller action method names (`UpsertOptionAvailability`, `RemoveOptionAvailability`), composable function/ref names (`useOptionStoreOverrides`, `availability`, `upsertAvailability`, `removeAvailability`) — đây là nhãn nghiệp vụ độc lập với tên entity (xác nhận qua parity với `ProductStore`).
- Không đổi `OptionStorePrice`, `ProductStore`, `ProductStorePrice` và mọi class liên quan — entity khác.
- Không đổi `GetOptionStoreOverridesQuery/Handler`, `GetOptionStoreOverridesPagedQuery/Handler`, `OptionStoreOverviewResponse`/`OptionStoreOverviewDto`, `StoreOverrideController`, `OptionStoreOverridesTab.vue`, folder `Features/StoreOverrides/` — khái niệm rộng hơn (gộp Availability + Price).
- Không sửa migration cũ đã apply (`20260615053923_NdtCoreProductMigration.cs`) — chỉ tạo migration mới.
- Không sửa các file docs lịch sử (`docs/superpowers/plans/*.md`, `docs/superpowers/specs/*.md`) — theo xác nhận của user.
- XML doc bắt buộc song ngữ VN/EN cho mọi class/interface/method/property theo `NDTCore.BE/CLAUDE.md`.
- FE: TypeScript strict, DTO field names PascalCase khớp backend, theo `NDTCore.FE/.claude/rules/convention.md`.

---

### Task 1: Domain layer — rename entity `OptionStoreAvailability` → `OptionStore`

**Files:**
- Rename: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Domain/Entities/OptionStoreAvailability.cs` → `OptionStore.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Domain/Entities/Option.cs:36,129`

**Interfaces:**
- Produces: class `OptionStore` (namespace `NDTCore.Product.Domain.Entities`), properties `TenantId`, `StoreId`, `OptionId`, `IsAvailable`, nav `Option`

- [ ] **Step 1: Rename file + class**

`OptionStore.cs` (nội dung mới, thay thế `OptionStoreAvailability.cs`):

```csharp
namespace NDTCore.Product.Domain.Entities;

/// <summary>
/// VN: Bật/tắt từng option tại cửa hàng cụ thể. Nếu không có bản ghi → mặc định theo <see cref="Option.IsActive"/>. Thường dùng khi topping hết hàng tại một chi nhánh nhưng vẫn bán ở nơi khác. <br />
/// EN: Toggles a specific option at a store. If absent, defaults to <see cref="Option.IsActive"/>. Typically used when a topping runs out at one branch but remains available elsewhere.
/// </summary>
public class OptionStore
{
    /// <summary>
    /// VN: Định danh tenant sở hữu bản ghi này. <br />
    /// EN: Identifier of the tenant that owns this record.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// VN: Định danh cửa hàng (PK1) — tham chiếu cross-domain sang Store domain. <br />
    /// EN: Store identifier (PK1) — cross-domain reference to the Store domain.
    /// </summary>
    public int StoreId { get; set; }

    /// <summary>
    /// VN: Định danh option (PK2). <br />
    /// EN: Option identifier (PK2).
    /// </summary>
    public int OptionId { get; set; }

    /// <summary>
    /// VN: Option có khả dụng tại cửa hàng này không. <br />
    /// EN: Whether the option is available at this store.
    /// </summary>
    public bool IsAvailable { get; set; }

    // ── Relationships ──────────────────────────────────────────────────────

    /// <summary>
    /// VN: Option được kiểm soát sẵn có. <br />
    /// EN: The option whose availability is being controlled.
    /// </summary>
    public Option Option { get; set; } = null!;
}
```

- [ ] **Step 2: Update navigation property trong `Option.cs`**

`Option.cs:36` — sửa cref trong XML doc của `Price`:
```csharp
// Old: /// EN: Default extra price; ... or <see cref="OptionStorePrice.OverridePrice"/>.
// (giữ nguyên dòng này — không liên quan tới OptionStoreAvailability)
```
(Dòng 36 chỉ tham chiếu `OptionStorePrice`, không cần sửa — bỏ qua.)

`Option.cs:125-129` — sửa nav property:
```csharp
// Old:
/// <summary>
/// VN: Tập hợp bản ghi kiểm soát sẵn có của option theo từng cửa hàng. <br />
/// EN: Collection of per-store option availability overrides.
/// </summary>
public ICollection<OptionStoreAvailability> OptionStoreAvailabilities { get; set; } = [];

// New:
/// <summary>
/// VN: Tập hợp bản ghi kiểm soát sẵn có của option theo từng cửa hàng. <br />
/// EN: Collection of per-store option availability overrides.
/// </summary>
public ICollection<OptionStore> OptionStores { get; set; } = [];
```

- [ ] **Step 3: Verify (chưa build được — các layer khác còn tham chiếu tên cũ, sẽ build ở Task 8)**

---

### Task 2: Infrastructure layer — Configuration, DbContext, Repository, DI

**Files:**
- Rename: `Configurations/OptionStoreAvailabilityConfiguration.cs` → `OptionStoreConfiguration.cs`
- Modify: `Persistence/Context/NdtProductDbContext.cs:68-69,100`
- Rename: `Repositories/OptionStoreAvailabilityRepository.cs` → `OptionStoreRepository.cs`
- Modify: `ServiceCollectionExtensions.cs:35`
- Modify: `Persistence/Configurations/OptionConfiguration.cs:52` (found during Task 2 review — configures the inverse side of the relationship from `Option`, missed in initial scan)
- Modify: `Repositories/PosCatalogRepository.cs:85` (found during Task 2 review — separate read-only repository querying the DbSet directly, missed in initial scan)

**⚠️ Gap found during task review:** Task 1 renamed `Option.OptionStoreAvailabilities` → `Option.OptionStores`, and Task 2 renames the DbContext's `DbSet<OptionStoreAvailability> OptionStoreAvailabilities` → `DbSet<OptionStore> OptionStores`. Two consumers of these members elsewhere in the Infrastructure project were missed by the initial file scan and must be fixed in this same task:
- `OptionConfiguration.cs:52` — `builder.HasMany(e => e.OptionStoreAvailabilities)` → `builder.HasMany(e => e.OptionStores)` (lambda param `osa` → `os` for clarity, optional)
- `PosCatalogRepository.cs:85` — `_context.OptionStoreAvailabilities` → `_context.OptionStores`. The local variable `optionStoreAvailabilityMap` (lines 84, 94, 134, 141, 182, 200) and its `Dictionary<int, bool>` parameter name stay unchanged — same precedent as `useStoreOverrides.ts`'s `availability` ref: "availability" is a business label decoupled from the entity class name, not the entity itself.

- [ ] **Step 1: `OptionStoreConfiguration.cs`** (thay thế `OptionStoreAvailabilityConfiguration.cs`)

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NDTCore.Product.Domain.Entities;

namespace NDTCore.Product.Infrastructure.Persistence.Configurations;

/// <summary>
/// StoreId là logical cross-domain FK — không có EF navigation, không có DB constraint.
/// </summary>
public class OptionStoreConfiguration : IEntityTypeConfiguration<OptionStore>
{
    public void Configure(EntityTypeBuilder<OptionStore> builder)
    {
        builder.ToTable("OptionStores", "Product");

        builder.HasKey(e => new { e.StoreId, e.OptionId });

        // ----- PROPERTIES -----
        builder.Property(e => e.TenantId).IsRequired();
        builder.Property(e => e.StoreId).IsRequired();
        builder.Property(e => e.OptionId).IsRequired();

        builder.Property(e => e.IsAvailable)
            .IsRequired()
            .HasDefaultValue(true);

        // ----- RELATIONSHIPS -----
        // StoreId: cross-domain logical FK — no EF relationship, no DB constraint
        builder.HasOne(e => e.Option)
            .WithMany(o => o.OptionStores)
            .HasForeignKey(e => e.OptionId)
            .OnDelete(DeleteBehavior.Cascade);

        // ----- INDEXES -----
        builder.HasIndex(e => e.TenantId)
            .HasDatabaseName("IX_OptionStores_TenantId");

        builder.HasIndex(e => e.OptionId)
            .HasDatabaseName("IX_OptionStores_OptionId");

        builder.HasIndex(e => new { e.TenantId, e.StoreId })
            .HasDatabaseName("IX_OptionStores_TenantId_StoreId");

        builder.HasIndex(e => new { e.StoreId, e.IsAvailable })
            .HasDatabaseName("IX_OptionStores_StoreId_IsAvailable");
    }
}
```

- [ ] **Step 2: `NdtProductDbContext.cs`**

```csharp
// Old (dòng 68-69):
/// <summary>VN: Trạng thái sẵn có của option theo cửa hàng. EN: Per-store option availability overrides.</summary>
public DbSet<OptionStoreAvailability> OptionStoreAvailabilities => Set<OptionStoreAvailability>();

// New:
/// <summary>VN: Trạng thái sẵn có của option theo cửa hàng. EN: Per-store option availability overrides.</summary>
public DbSet<OptionStore> OptionStores => Set<OptionStore>();
```

```csharp
// Old (dòng 100):
modelBuilder.ApplyConfiguration(new OptionStoreAvailabilityConfiguration());

// New:
modelBuilder.ApplyConfiguration(new OptionStoreConfiguration());
```

- [ ] **Step 3: `OptionStoreRepository.cs`** (thay thế `OptionStoreAvailabilityRepository.cs`)

```csharp
using Microsoft.EntityFrameworkCore;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Domain.Entities;
using NDTCore.Product.Infrastructure.Persistence.Context;

namespace NDTCore.Product.Infrastructure.Repositories;

/// <summary>
/// VN: EF Core implementation của <see cref="IOptionStoreRepository"/>. <br />
/// EN: EF Core implementation of <see cref="IOptionStoreRepository"/>.
/// </summary>
public sealed class OptionStoreRepository : IOptionStoreRepository
{
    private readonly NdtProductDbContext _dbContext;

    public OptionStoreRepository(NdtProductDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<OptionStore?> FindAsync(int optionId, int storeId, CancellationToken ct = default)
        => await _dbContext.OptionStores
            .FirstOrDefaultAsync(osa => osa.OptionId == optionId && osa.StoreId == storeId, ct);

    public async Task AddAsync(OptionStore entity, CancellationToken ct = default)
        => await _dbContext.OptionStores.AddAsync(entity, ct);

    public void Remove(OptionStore entity)
        => _dbContext.OptionStores.Remove(entity);

    public async Task<List<OptionStore>> GetByOptionIdAsync(int optionId, CancellationToken ct = default)
        => await _dbContext.OptionStores
            .AsNoTracking()
            .Where(a => a.OptionId == optionId)
            .ToListAsync(ct);
}
```

- [ ] **Step 4: `ServiceCollectionExtensions.cs:35`**

```csharp
// Old:
services.AddScoped<IOptionStoreAvailabilityRepository, OptionStoreAvailabilityRepository>();

// New:
services.AddScoped<IOptionStoreRepository, OptionStoreRepository>();
```

---

### Task 3: Contracts layer — Repository interface, Request/Response, nested Vm

**Files:**
- Rename: `Interfaces/Repositories/IOptionStoreAvailabilityRepository.cs` → `IOptionStoreRepository.cs`
- Rename: `ViewModels/StoreOverrides/UpsertOptionStoreAvailabilityRequest.cs` → `UpsertOptionStoreRequest.cs`
- Rename: `ViewModels/StoreOverrides/UpsertOptionStoreAvailabilityResponse.cs` → `UpsertOptionStoreResponse.cs`
- Modify: `ViewModels/StoreOverrides/OptionStoreOverviewResponse.cs:16`

- [ ] **Step 1: `IOptionStoreRepository.cs`**

```csharp
using NDTCore.Product.Domain.Entities;

namespace NDTCore.Product.Contracts.Interfaces.Repositories;

/// <summary>
/// VN: Contract truy cập dữ liệu cho bảng OptionStore (override sẵn có option theo cửa hàng). <br />
/// EN: Data-access contract for the OptionStore table (per-store option availability overrides).
/// </summary>
public interface IOptionStoreRepository
{
    Task<OptionStore?> FindAsync(int optionId, int storeId, CancellationToken ct = default);

    Task AddAsync(OptionStore entity, CancellationToken ct = default);

    void Remove(OptionStore entity);

    /// <summary>
    /// VN: Lấy toàn bộ bản ghi khả dụng theo cửa hàng của một option. <br />
    /// EN: Gets all per-store availability records for an option.
    /// </summary>
    Task<List<OptionStore>> GetByOptionIdAsync(int optionId, CancellationToken ct = default);
}
```

- [ ] **Step 2: `UpsertOptionStoreRequest.cs`**

```csharp
namespace NDTCore.Product.Contracts.ViewModels.StoreOverrides;

public sealed class UpsertOptionStoreRequest
{
    public int StoreId { get; set; }
    public bool IsAvailable { get; set; }
}
```

- [ ] **Step 3: `UpsertOptionStoreResponse.cs`**

```csharp
namespace NDTCore.Product.Contracts.ViewModels.StoreOverrides;

public sealed class UpsertOptionStoreResponse
{
    public int StoreId { get; set; }
    public int OptionId { get; set; }
    public bool IsAvailable { get; set; }
}
```

- [ ] **Step 4: `OptionStoreOverviewResponse.cs:16`** — chỉ đổi nested Vm, giữ record `OptionStoreOverviewResponse` và field `Availability`/`Prices`

```csharp
// Old:
public sealed record OptionStoreAvailabilityItemVm(int StoreId, bool IsAvailable);

// New:
public sealed record OptionStoreItemVm(int StoreId, bool IsAvailable);
```
(Dòng 7-8 `List<OptionStoreAvailabilityItemVm> Availability` → `List<OptionStoreItemVm> Availability` — field name `Availability` giữ nguyên, chỉ đổi type tham chiếu.)

---

### Task 4: Application layer — Upsert Command/Handler/Validator

**Files:**
- Rename folder: `Features/StoreOverrides/UpsertOptionStoreAvailability/` → `UpsertOptionStore/`
- Trong đó: `UpsertOptionStoreCommand.cs`, `UpsertOptionStoreCommandHandler.cs`, `UpsertOptionStoreCommandValidator.cs`

- [ ] **Step 1: `UpsertOptionStoreCommand.cs`**

```csharp
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.Product.Contracts.ViewModels.StoreOverrides;

namespace NDTCore.Product.Application.Features.StoreOverrides.UpsertOptionStore;

public sealed record UpsertOptionStoreCommand(int OptionId, UpsertOptionStoreRequest Request)
    : ICommand<UpsertOptionStoreResponse>;
```

- [ ] **Step 2: `UpsertOptionStoreCommandHandler.cs`**

```csharp
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.StoreOverrides;
using NDTCore.Product.Domain.Entities;

namespace NDTCore.Product.Application.Features.StoreOverrides.UpsertOptionStore;

public sealed class UpsertOptionStoreCommandHandler
    : ICommandHandler<UpsertOptionStoreCommand, UpsertOptionStoreResponse>
{
    private readonly ILogger<UpsertOptionStoreCommandHandler> _logger;
    private readonly IProductUnitOfWork _unitOfWork;
    private readonly IOptionStoreRepository _optionStoreRepository;
    private readonly INdtContextAccessor _contextAccessor;

    public UpsertOptionStoreCommandHandler(
        ILogger<UpsertOptionStoreCommandHandler> logger,
        IProductUnitOfWork unitOfWork,
        IOptionStoreRepository optionStoreRepository,
        INdtContextAccessor contextAccessor)
    {
        _logger = logger;
        _unitOfWork = unitOfWork;
        _optionStoreRepository = optionStoreRepository;
        _contextAccessor = contextAccessor;
    }

    public async Task<Result<UpsertOptionStoreResponse>> Handle(
        UpsertOptionStoreCommand request,
        CancellationToken cancellationToken)
    {
        var existing = await _optionStoreRepository.FindAsync(
            request.OptionId, request.Request.StoreId, cancellationToken);

        if (existing is null)
        {
            existing = new OptionStore
            {
                TenantId = _contextAccessor.GetTenantId(),
                OptionId = request.OptionId,
                StoreId = request.Request.StoreId,
            };
            await _optionStoreRepository.AddAsync(existing, cancellationToken);
        }

        existing.IsAvailable = request.Request.IsAvailable;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Option store override upserted: OptionId={OptionId}, StoreId={StoreId}, IsAvailable={IsAvailable}",
            nameof(UpsertOptionStoreCommandHandler),
            nameof(Handle),
            request.OptionId,
            request.Request.StoreId,
            request.Request.IsAvailable);

        return Result<UpsertOptionStoreResponse>.Success(new UpsertOptionStoreResponse
        {
            OptionId = request.OptionId,
            StoreId = request.Request.StoreId,
            IsAvailable = existing.IsAvailable,
        });
    }
}
```

- [ ] **Step 3: `UpsertOptionStoreCommandValidator.cs`**

```csharp
using FluentValidation;

namespace NDTCore.Product.Application.Features.StoreOverrides.UpsertOptionStore;

public sealed class UpsertOptionStoreCommandValidator
    : AbstractValidator<UpsertOptionStoreCommand>
{
    public UpsertOptionStoreCommandValidator()
    {
        RuleFor(x => x.OptionId).GreaterThan(0).WithMessage("OptionId must be greater than 0.");
        RuleFor(x => x.Request.StoreId).GreaterThan(0).WithMessage("StoreId must be greater than 0.");
    }
}
```

---

### Task 5: Application layer — Remove Command/Handler/Validator

**Files:**
- Rename folder: `Features/StoreOverrides/RemoveOptionStoreAvailability/` → `RemoveOptionStore/`
- Trong đó: `RemoveOptionStoreCommand.cs`, `RemoveOptionStoreCommandHandler.cs`, `RemoveOptionStoreCommandValidator.cs`

**Lưu ý quan trọng:** Error code `OPTION_STORE_AVAILABILITY_NOT_FOUND` → `OPTION_STORE_NOT_FOUND` (đối chiếu chính xác với `RemoveProductStoreCommandHandler` dùng `PRODUCT_STORE_NOT_FOUND`). Nếu FE hoặc nơi khác đang so sánh chuỗi error code này, phải cập nhật theo (đã kiểm tra: không có occurrence nào khác ngoài handler này).

- [ ] **Step 1: `RemoveOptionStoreCommand.cs`**

```csharp
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.Product.Contracts.ViewModels.StoreOverrides;

namespace NDTCore.Product.Application.Features.StoreOverrides.RemoveOptionStore;

public sealed record RemoveOptionStoreCommand(int OptionId, int StoreId)
    : ICommand<UpsertOptionStoreResponse>;
```

- [ ] **Step 2: `RemoveOptionStoreCommandHandler.cs`**

```csharp
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.StoreOverrides;

namespace NDTCore.Product.Application.Features.StoreOverrides.RemoveOptionStore;

public sealed class RemoveOptionStoreCommandHandler
    : ICommandHandler<RemoveOptionStoreCommand, UpsertOptionStoreResponse>
{
    private readonly ILogger<RemoveOptionStoreCommandHandler> _logger;
    private readonly IProductUnitOfWork _unitOfWork;
    private readonly IOptionStoreRepository _optionStoreRepository;

    public RemoveOptionStoreCommandHandler(
        ILogger<RemoveOptionStoreCommandHandler> logger,
        IProductUnitOfWork unitOfWork,
        IOptionStoreRepository optionStoreRepository)
    {
        _logger = logger;
        _unitOfWork = unitOfWork;
        _optionStoreRepository = optionStoreRepository;
    }

    public async Task<Result<UpsertOptionStoreResponse>> Handle(
        RemoveOptionStoreCommand request,
        CancellationToken cancellationToken)
    {
        var record = await _optionStoreRepository.FindAsync(
            request.OptionId, request.StoreId, cancellationToken);

        if (record is null)
            return Result<UpsertOptionStoreResponse>.Failure(
                "OPTION_STORE_NOT_FOUND", "Option store override not found.");

        _optionStoreRepository.Remove(record);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Option store override removed: OptionId={OptionId}, StoreId={StoreId}",
            nameof(RemoveOptionStoreCommandHandler),
            nameof(Handle),
            request.OptionId,
            request.StoreId);

        return Result<UpsertOptionStoreResponse>.Success(new UpsertOptionStoreResponse
        {
            OptionId = request.OptionId,
            StoreId = request.StoreId,
            IsAvailable = record.IsAvailable,
        });
    }
}
```

- [ ] **Step 3: `RemoveOptionStoreCommandValidator.cs`**

```csharp
using FluentValidation;

namespace NDTCore.Product.Application.Features.StoreOverrides.RemoveOptionStore;

public sealed class RemoveOptionStoreCommandValidator
    : AbstractValidator<RemoveOptionStoreCommand>
{
    public RemoveOptionStoreCommandValidator()
    {
        RuleFor(x => x.OptionId).GreaterThan(0).WithMessage("OptionId must be greater than 0.");
        RuleFor(x => x.StoreId).GreaterThan(0).WithMessage("StoreId must be greater than 0.");
    }
}
```

---

### Task 6: Application layer — Get/GetPaged handlers (KHÔNG đổi folder/class)

**Files:**
- Modify: `Features/StoreOverrides/GetOptionStoreOverrides/GetOptionStoreOverridesQueryHandler.cs`
- Modify: `Features/StoreOverrides/GetOptionStoreOverridesPaged/GetOptionStoreOverridesPagedQueryHandler.cs`

**Lý do tên field đổi thành `_storeRepo` (không phải `_optionStoreRepo`):** đối chiếu chính xác với `GetProductStoreOverridesQueryHandler` dùng field `_storeRepo` (không phải `_productStoreRepo`). Biến local `availability` giữ nguyên — Product-side cũng dùng tên này dù entity là `ProductStore`.

- [ ] **Step 1: `GetOptionStoreOverridesQueryHandler.cs`**

```csharp
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.StoreOverrides;

namespace NDTCore.Product.Application.Features.StoreOverrides.GetOptionStoreOverrides;

public sealed class GetOptionStoreOverridesQueryHandler
    : IQueryHandler<GetOptionStoreOverridesQuery, GetOptionStoreOverridesResponse>
{
    private readonly IOptionStoreRepository _storeRepo;
    private readonly IOptionStorePriceRepository _priceRepo;

    public GetOptionStoreOverridesQueryHandler(
        IOptionStoreRepository storeRepo,
        IOptionStorePriceRepository priceRepo)
    {
        _storeRepo = storeRepo;
        _priceRepo = priceRepo;
    }

    public async Task<Result<GetOptionStoreOverridesResponse>> Handle(
        GetOptionStoreOverridesQuery request,
        CancellationToken cancellationToken)
    {
        var availability = await _storeRepo.GetByOptionIdAsync(request.OptionId, cancellationToken);
        var prices = await _priceRepo.GetByOptionIdAsync(request.OptionId, cancellationToken);

        return Result<GetOptionStoreOverridesResponse>.Success(new GetOptionStoreOverridesResponse(
            availability.Select(a => new OptionStoreItemVm(a.StoreId, a.IsAvailable)).ToList(),
            prices.Select(p => new OptionStorePriceItemVm(p.StoreId, p.OverridePrice)).ToList()
        ));
    }
}
```

- [ ] **Step 2: `GetOptionStoreOverridesPagedQueryHandler.cs`**

```csharp
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.StoreOverrides;

namespace NDTCore.Product.Application.Features.StoreOverrides.GetOptionStoreOverridesPaged;

public sealed class GetOptionStoreOverridesPagedQueryHandler
    : IQueryHandler<GetOptionStoreOverridesPagedQuery, PaginatedCollection<StoreOverrideItemVm>>
{
    private readonly IOptionStoreRepository _storeRepo;
    private readonly IOptionStorePriceRepository        _priceRepo;
    private readonly ILogger<GetOptionStoreOverridesPagedQueryHandler> _logger;

    public GetOptionStoreOverridesPagedQueryHandler(
        IOptionStoreRepository storeRepo,
        IOptionStorePriceRepository priceRepo,
        ILogger<GetOptionStoreOverridesPagedQueryHandler> logger)
    {
        _storeRepo = storeRepo;
        _priceRepo = priceRepo;
        _logger    = logger;
    }

    public async Task<Result<PaginatedCollection<StoreOverrideItemVm>>> Handle(
        GetOptionStoreOverridesPagedQuery request,
        CancellationToken cancellationToken)
    {
        var availability = await _storeRepo.GetByOptionIdAsync(request.OptionId, cancellationToken);
        var prices       = await _priceRepo.GetByOptionIdAsync(request.OptionId, cancellationToken);

        var allStoreIds = availability.Select(a => a.StoreId)
            .Union(prices.Select(p => p.StoreId))
            .OrderBy(id => id)
            .ToList();

        var total      = allStoreIds.Count;
        var pageNumber = request.Filter.PageNumber;
        var pageSize   = request.Filter.PageSize;

        var pagedIds = allStoreIds
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var availMap = availability.ToDictionary(a => a.StoreId);
        var priceMap = prices.ToDictionary(p => p.StoreId);

        var items = pagedIds.Select(storeId => new StoreOverrideItemVm(
            storeId,
            availMap.TryGetValue(storeId, out var av) ? av.IsAvailable : null,
            priceMap.TryGetValue(storeId, out var pr) ? pr.OverridePrice : null
        )).ToList();

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Store overrides page loaded: OptionId={OptionId}, PageNumber={PageNumber}, TotalCount={TotalCount}",
            nameof(GetOptionStoreOverridesPagedQueryHandler),
            nameof(Handle),
            request.OptionId,
            pageNumber,
            total);

        return Result<PaginatedCollection<StoreOverrideItemVm>>.Success(
            new PaginatedCollection<StoreOverrideItemVm>(
                items,
                PaginationMetadata.Create(pageNumber, pageSize, total)));
    }
}
```

---

### Task 7: API layer — Controller using/type updates

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.API/Controllers/Modules/Product/Admin/StoreOverrideController.cs:10,14,140,151`

**Không đổi:** class `StoreOverrideController`, route prefix, action method names (`UpsertOptionAvailability`, `RemoveOptionAvailability`), route path `/availability`.

- [ ] **Step 1: Sửa using statements**

```csharp
// Old (dòng 10):
using NDTCore.Product.Application.Features.StoreOverrides.RemoveOptionStoreAvailability;
// New:
using NDTCore.Product.Application.Features.StoreOverrides.RemoveOptionStore;

// Old (dòng 14):
using NDTCore.Product.Application.Features.StoreOverrides.UpsertOptionStoreAvailability;
// New:
using NDTCore.Product.Application.Features.StoreOverrides.UpsertOptionStore;
```

- [ ] **Step 2: Sửa type tham chiếu trong action method**

```csharp
// UpsertOptionAvailability (dòng 136,140):
// Old:
[FromBody] UpsertOptionStoreAvailabilityRequest request,
...
var result = await _mediator.Send(new UpsertOptionStoreAvailabilityCommand(optionId, request), cancellationToken);
// New:
[FromBody] UpsertOptionStoreRequest request,
...
var result = await _mediator.Send(new UpsertOptionStoreCommand(optionId, request), cancellationToken);

// RemoveOptionAvailability (dòng 151):
// Old:
var result = await _mediator.Send(new RemoveOptionStoreAvailabilityCommand(optionId, storeId), cancellationToken);
// New:
var result = await _mediator.Send(new RemoveOptionStoreCommand(optionId, storeId), cancellationToken);
```

---

### Task 8: Backend build + grep verification

- [ ] **Step 1: Build solution**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 Error(s).

- [ ] **Step 2: Grep kiểm tra không còn reference cũ (trừ migration cũ và docs lịch sử đã quyết định giữ nguyên)**

Run (PowerShell, từ root repo):
```powershell
Get-ChildItem -Recurse -Include *.cs -Path NDTCore.BE/src | Select-String "OptionStoreAvailability" | Where-Object { $_.Path -notmatch "Migrations\\ProductDb\\20260615053923" }
```
Expected: không có kết quả nào.

---

### Task 9: EF Core migration mới — rename table/index/constraint

**⚠️ CẢNH BÁO QUAN TRỌNG:** `dotnet ef migrations add` mặc định sẽ sinh `DropTable("OptionStoreAvailabilities")` + `CreateTable("OptionStores", ...)` vì EF differencer coi entity đổi tên là entity bị xóa + entity mới — **DropTable sẽ XÓA TOÀN BỘ DỮ LIỆU** trong bảng. Phải **sửa tay** nội dung `Up()`/`Down()` của migration vừa sinh thành `RenameTable` + `RenameIndex` + `sp_rename` (script bên dưới) để giữ dữ liệu. **Backup database trước khi apply lên production**, vì sau khi rename, mọi code cũ tham chiếu bảng `OptionStoreAvailabilities` sẽ không còn hoạt động — không thể rollback nửa chừng giữa deploy code và migration.

**Files:**
- Create (qua EF CLI, rồi sửa tay): `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/Persistence/Migrations/ProductDb/<timestamp>_RenameOptionStoreAvailabilityToOptionStore.cs`

- [ ] **Step 1: Scaffold migration**

Run (từ `NDTCore.BE/src/`, sau khi Task 1-8 đã build thành công):
```bash
dotnet ef migrations add RenameOptionStoreAvailabilityToOptionStore \
  --context NdtProductDbContext \
  --project NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure \
  --startup-project NDTCore.API \
  --output-dir Persistence/Migrations/ProductDb
```
EF sẽ tự sinh `Designer.cs` + cập nhật `NdtProductDbContextModelSnapshot.cs` đúng theo model mới — **không sửa tay 2 file này**.

- [ ] **Step 2: Sửa tay `Up()`/`Down()` trong file `.cs` vừa sinh**

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.RenameTable(
        name: "OptionStoreAvailabilities",
        schema: "Product",
        newName: "OptionStores",
        newSchema: "Product");

    migrationBuilder.RenameIndex(
        table: "OptionStores",
        schema: "Product",
        name: "IX_OptionStoreAvailabilities_TenantId",
        newName: "IX_OptionStores_TenantId");

    migrationBuilder.RenameIndex(
        table: "OptionStores",
        schema: "Product",
        name: "IX_OptionStoreAvailabilities_OptionId",
        newName: "IX_OptionStores_OptionId");

    migrationBuilder.RenameIndex(
        table: "OptionStores",
        schema: "Product",
        name: "IX_OptionStoreAvailabilities_TenantId_StoreId",
        newName: "IX_OptionStores_TenantId_StoreId");

    migrationBuilder.RenameIndex(
        table: "OptionStores",
        schema: "Product",
        name: "IX_OptionStoreAvailabilities_StoreId_IsAvailable",
        newName: "IX_OptionStores_StoreId_IsAvailable");

    migrationBuilder.Sql(
        "EXEC sp_rename N'[Product].[PK_OptionStoreAvailabilities]', N'PK_OptionStores';");

    migrationBuilder.Sql(
        "EXEC sp_rename N'[Product].[FK_OptionStoreAvailabilities_Options_OptionId]', N'FK_OptionStores_Options_OptionId';");
}

protected override void Down(MigrationBuilder migrationBuilder)
{
    migrationBuilder.Sql(
        "EXEC sp_rename N'[Product].[FK_OptionStores_Options_OptionId]', N'FK_OptionStoreAvailabilities_Options_OptionId';");

    migrationBuilder.Sql(
        "EXEC sp_rename N'[Product].[PK_OptionStores]', N'PK_OptionStoreAvailabilities';");

    migrationBuilder.RenameIndex(
        table: "OptionStores",
        schema: "Product",
        name: "IX_OptionStores_StoreId_IsAvailable",
        newName: "IX_OptionStoreAvailabilities_StoreId_IsAvailable");

    migrationBuilder.RenameIndex(
        table: "OptionStores",
        schema: "Product",
        name: "IX_OptionStores_TenantId_StoreId",
        newName: "IX_OptionStoreAvailabilities_TenantId_StoreId");

    migrationBuilder.RenameIndex(
        table: "OptionStores",
        schema: "Product",
        name: "IX_OptionStores_OptionId",
        newName: "IX_OptionStoreAvailabilities_OptionId");

    migrationBuilder.RenameIndex(
        table: "OptionStores",
        schema: "Product",
        name: "IX_OptionStores_TenantId",
        newName: "IX_OptionStoreAvailabilities_TenantId");

    migrationBuilder.RenameTable(
        name: "OptionStores",
        schema: "Product",
        newName: "OptionStoreAvailabilities",
        newSchema: "Product");
}
```

- [ ] **Step 3: Verify migration script bằng SQL generated**

Run: `dotnet ef migrations script --context NdtProductDbContext --startup-project NDTCore.API -- --idempotent` (hoặc bỏ `--idempotent` nếu chỉ muốn xem script của riêng migration mới) và kiểm tra output chỉ chứa `EXEC sp_rename`/`ALTER TABLE ... RENAME` — không có `DROP TABLE`/`CREATE TABLE` cho `OptionStoreAvailabilities`/`OptionStores`.

- [ ] **Step 4: Apply migration lên DB dev/test (KHÔNG tự ý apply lên production)**

Run: `dotnet ef database update --context NdtProductDbContext --startup-project NDTCore.API`

---

### Task 10: Frontend — DTO rename

**Files:**
- Modify: `NDTCore.FE/src/modules/product/models/dtos/store-overrides.dto.ts:23-32`

- [ ] **Step 1: Đổi tên interface**

```typescript
// Old:
export interface OptionStoreAvailabilityDto {
    StoreId: number
    OptionId: number
    IsAvailable: boolean
}

export interface UpsertOptionStoreAvailabilityRequest {
    StoreId: number
    IsAvailable: boolean
}

// New:
export interface OptionStoreDto {
    StoreId: number
    OptionId: number
    IsAvailable: boolean
}

export interface UpsertOptionStoreRequest {
    StoreId: number
    IsAvailable: boolean
}
```

(`OptionStoreDto` hiện không được import ở đâu khác ngoài định nghĩa — giữ nguyên export để không phá vỡ khả năng dùng trong tương lai.)

---

### Task 11: Frontend — API/service type import update

**Files:**
- Modify: `NDTCore.FE/src/modules/product/api/store-overrides.api.ts:9,46`
- Modify: `NDTCore.FE/src/modules/product/services/store-overrides.service.ts:7,54`

**Không đổi:** tên hàm (`upsertOptionAvailabilityAsync`, `removeOptionAvailabilityAsync`), endpoint constants trong `api.constants.ts`, composable `useStoreOverrides.ts` — theo Global Constraints.

- [ ] **Step 1: `store-overrides.api.ts`**

```typescript
// Old (dòng 9):
    UpsertOptionStoreAvailabilityRequest,
// New:
    UpsertOptionStoreRequest,
```
```typescript
// Old (dòng 46):
        payload: UpsertOptionStoreAvailabilityRequest,
// New:
        payload: UpsertOptionStoreRequest,
```

- [ ] **Step 2: `store-overrides.service.ts`**

```typescript
// Old (dòng 7):
    UpsertOptionStoreAvailabilityRequest,
// New:
    UpsertOptionStoreRequest,
```
```typescript
// Old (dòng 54):
        payload: UpsertOptionStoreAvailabilityRequest,
// New:
        payload: UpsertOptionStoreRequest,
```

- [ ] **Step 3: `useStoreOverrides.ts:7`**

```typescript
// Old:
    UpsertOptionStoreAvailabilityRequest,
// New:
    UpsertOptionStoreRequest,
```
```typescript
// Old (dòng 110):
            const payload: UpsertOptionStoreAvailabilityRequest = { StoreId: storeId, IsAvailable: isAvailable }
// New:
            const payload: UpsertOptionStoreRequest = { StoreId: storeId, IsAvailable: isAvailable }
```

---

### Task 12: Frontend — type-check verification

- [ ] **Step 1: Run type-check**

Run: `cd NDTCore.FE && npm run type-check`
Expected: 0 errors.

- [ ] **Step 2: Grep kiểm tra không còn reference cũ**

Run (PowerShell, từ root repo):
```powershell
Get-ChildItem -Recurse -Include *.ts,*.vue -Path NDTCore.FE/src | Select-String "OptionStoreAvailability"
```
Expected: không có kết quả nào.

---

### Task 13: Docs sống + final verification

**Files:**
- Modify: `docs/designs/pos-design.md:158`
- Modify: `NDTCore.BE/docs/erds/product.md:18`

**Không đổi:** `docs/superpowers/plans/*.md`, `docs/superpowers/specs/*.md` (theo xác nhận của user — snapshot lịch sử).

- [ ] **Step 1: `docs/designs/pos-design.md:158`**

```markdown
<!-- Old: -->
- Option không available tại store: (`OptionStoreAvailability.IsAvailable = false`)
<!-- New: -->
- Option không available tại store: (`OptionStore.IsAvailable = false`)
```

- [ ] **Step 2: `NDTCore.BE/docs/erds/product.md:18`**

```markdown
<!-- Old: -->
OptionStoreAvailability | Override: option availability per store
<!-- New: -->
OptionStore | Override: option availability per store
```

- [ ] **Step 3: Final repo-wide grep (toàn repo, trừ migration cũ + docs lịch sử)**

Run (PowerShell, từ root repo):
```powershell
Get-ChildItem -Recurse -Include *.cs,*.ts,*.vue,*.md -Path NDTCore.BE,NDTCore.FE,docs/designs |
  Select-String "OptionStoreAvailability" |
  Where-Object { $_.Path -notmatch "Migrations\\ProductDb\\20260615053923" }
```
Expected: không có kết quả nào.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: rename OptionStoreAvailability entity to OptionStore"
```
