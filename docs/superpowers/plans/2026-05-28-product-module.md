# Product Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng toàn bộ Product Module cho NDTCore — bao gồm BE (Clean Architecture + CQRS) và FE (Vue 3 + TypeScript + Vuetify) — chia theo từng entity group có thể ship độc lập.

**Architecture:** Modular monolith — mỗi entity group là một Phase độc lập. BE theo pattern Brand module (DbContext → EF Config → Repository → CQRS → Controller). FE theo pattern Brand module (DTO → API → Service → Store → Component → View → Route).

**Tech Stack:** .NET 8 · EF Core · MediatR · FluentValidation · Vue 3 · TypeScript · Pinia · Vuetify 3 · Axios

**Domain entities đã tồn tại** (tất cả trong `NDTCore.Product.Domain/Entities/`): `Category`, `Tag`, `Product`, `ProductImage`, `OptionGroup`, `Option`, `ProductTag`, `ProductOptionGroup`, `ProductOptionConfig`, `ProductStore`, `ProductStorePrice`, `OptionStoreAvailability`, `OptionStorePrice`.

---

## Scope Check — 5 Plans Độc Lập

Module Product đủ lớn để tách thành 5 sub-plan ship được riêng biệt:

| Plan | Scope | Phụ thuộc |
|---|---|---|
| **A (Plan này)** | Category + Tag — reference data | Không có |
| **B** | OptionGroup + Option | Không có |
| **C** | Product Core + ProductImage | Category (Plan A) |
| **D** | Product Relations (ProductTag, ProductOptionGroup, ProductOptionConfig) | Plan A + B + C |
| **E** | Store Overrides (ProductStore, ProductStorePrice, OptionStoreAvailability, OptionStorePrice) | Plan C + B |

> **Plan này (A) triển khai Category + Tag** — hoàn chỉnh từ DbContext đến FE View.
> Plans B–E sẽ được tạo riêng sau.

---

## File Structure — Plan A

### Backend (BE)
```
NDTCore.BE/src/
├── NDTCore.Modules/NDTCore.Product/
│   ├── NDTCore.Product.Domain/                      ✅ DONE
│   ├── NDTCore.Product.Contracts/
│   │   ├── Interfaces/Repositories/
│   │   │   ├── ICategoryRepository.cs               CREATE
│   │   │   ├── ITagRepository.cs                    CREATE
│   │   │   └── IProductUnitOfWork.cs                CREATE
│   │   ├── Models/
│   │   │   ├── Categories/CategoryFilterDto.cs       CREATE
│   │   │   └── Tags/TagFilterDto.cs                  CREATE
│   │   └── ViewModels/
│   │       ├── Categories/
│   │       │   ├── CreateCategoryRequest.cs          CREATE
│   │       │   ├── CreateCategoryResponse.cs         CREATE
│   │       │   ├── UpdateCategoryRequest.cs          CREATE
│   │       │   ├── UpdateCategoryResponse.cs         CREATE
│   │       │   ├── DeleteCategoryResponse.cs         CREATE
│   │       │   └── GetCategoryResponse.cs            CREATE
│   │       └── Tags/
│   │           ├── CreateTagRequest.cs               CREATE
│   │           ├── CreateTagResponse.cs              CREATE
│   │           ├── UpdateTagRequest.cs               CREATE
│   │           ├── UpdateTagResponse.cs              CREATE
│   │           ├── DeleteTagResponse.cs              CREATE
│   │           └── GetTagResponse.cs                 CREATE
│   ├── NDTCore.Product.Application/
│   │   ├── Features/
│   │   │   ├── Categories/
│   │   │   │   ├── CreateCategory/ (Command + Validator + Handler)  CREATE
│   │   │   │   ├── UpdateCategory/ (Command + Validator + Handler)  CREATE
│   │   │   │   ├── DeleteCategory/ (Command + Validator + Handler)  CREATE
│   │   │   │   ├── GetCategoryById/ (Query + Validator + Handler)   CREATE
│   │   │   │   └── GetPagedCategories/ (Query + Validator + Handler) CREATE
│   │   │   └── Tags/
│   │   │       ├── CreateTag/ ...                    CREATE
│   │   │       ├── UpdateTag/ ...                    CREATE
│   │   │       ├── DeleteTag/ ...                    CREATE
│   │   │       ├── GetTagById/ ...                   CREATE
│   │   │       └── GetPagedTags/ ...                 CREATE
│   │   ├── MapperProfiles/ProductMapperProfile.cs    CREATE
│   │   └── ServiceCollectionExtensions.cs           MODIFY
│   └── NDTCore.Product.Infrastructure/
│       ├── Persistence/
│       │   ├── Context/NdtProductDbContext.cs        CREATE
│       │   └── Configurations/
│       │       ├── CategoryConfiguration.cs          CREATE
│       │       └── TagConfiguration.cs              CREATE
│       ├── Repositories/
│       │   ├── CategoryRepository.cs                CREATE
│       │   ├── TagRepository.cs                     CREATE
│       │   └── ProductUnitOfWork.cs                 CREATE
│       └── ServiceCollectionExtensions.cs           MODIFY
├── NDTCore.API/
│   └── Controllers/Products/
│       ├── CategoryController.cs                    CREATE
│       └── TagController.cs                         CREATE
```

### Frontend (FE)
```
NDTCore.FE/src/
├── core/
│   ├── constants/api.constants.ts                   MODIFY (add PRODUCT section)
│   └── api/clients/product.client.ts               CREATE
└── modules/product/
    ├── api/
    │   ├── category.api.ts                         CREATE
    │   └── tag.api.ts                              CREATE
    ├── models/
    │   ├── dtos/
    │   │   ├── category.dto.ts                     CREATE
    │   │   ├── tag.dto.ts                          CREATE
    │   │   └── _index.ts                           CREATE
    │   ├── view-models/
    │   │   ├── category.view-model.ts              CREATE
    │   │   ├── tag.view-model.ts                   CREATE
    │   │   └── _index.ts                           CREATE
    │   └── form-models/
    │       ├── category.model.ts                   CREATE
    │       └── tag.model.ts                        CREATE
    ├── mappers/
    │   ├── category.mapper.ts                      CREATE
    │   └── tag.mapper.ts                           CREATE
    ├── services/
    │   ├── category.service.ts                     CREATE
    │   └── tag.service.ts                          CREATE
    ├── stores/
    │   ├── category.store.ts                       CREATE
    │   └── tag.store.ts                            CREATE
    ├── composables/
    │   ├── useCategory.ts                          CREATE
    │   └── useTag.ts                               CREATE
    ├── constants/
    │   ├── category-list.constants.ts              CREATE
    │   └── tag-list.constants.ts                   CREATE
    ├── enums/
    │   └── _index.ts                               CREATE
    ├── components/
    │   ├── CategoryList.vue                        CREATE
    │   ├── CategoryForm.vue                        CREATE
    │   ├── TagList.vue                             CREATE
    │   └── TagForm.vue                             CREATE
    └── views/
        ├── CategoriesView.vue                      CREATE
        └── TagsView.vue                            CREATE
```

---

## Phase 0: DbContext + EF Configurations (Foundation)

> Tất cả entity configurations đặt trong Plan này (kể cả Category, Tag). Các Plan sau chỉ MODIFY DbContext để thêm DbSet.

---

### Task 1: Tạo NdtProductDbContext

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/Persistence/Context/NdtProductDbContext.cs`

- [ ] **Step 1: Tạo DbContext**

```csharp
using Microsoft.EntityFrameworkCore;
using NDTCore.Product.Domain.Common;
using NDTCore.Product.Domain.Entities;
using NDTCore.Product.Infrastructure.Persistence.Configurations;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using System.Linq.Expressions;

namespace NDTCore.Product.Infrastructure.Persistence.Context;

public class NdtProductDbContext : DbContext
{
    private readonly INdtContextAccessor _contextAccessor;

    public NdtProductDbContext(DbContextOptions<NdtProductDbContext> options, INdtContextAccessor contextAccessor)
        : base(options)
    {
        _contextAccessor = contextAccessor;
    }

    /// <summary>
    /// VN: Danh mục sản phẩm. <br />
    /// EN: Product categories.
    /// </summary>
    public DbSet<Category> Categories => Set<Category>();

    /// <summary>
    /// VN: Nhãn phân loại sản phẩm. <br />
    /// EN: Product tags.
    /// </summary>
    public DbSet<Tag> Tags => Set<Tag>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        ApplyBaseConfigurations(modelBuilder);
        modelBuilder.ApplyConfiguration(new CategoryConfiguration());
        modelBuilder.ApplyConfiguration(new TagConfiguration());
        ApplyGlobalTenantFilter(modelBuilder);
    }

    private void ApplyGlobalTenantFilter(ModelBuilder modelBuilder)
    {
        var multiTenantEntityTypes = modelBuilder.Model
            .GetEntityTypes()
            .Where(t => typeof(IMultiTenant).IsAssignableFrom(t.ClrType));

        foreach (var entityType in multiTenantEntityTypes)
        {
            var param = Expression.Parameter(entityType.ClrType, "e");
            var tenantIdProp = Expression.Property(param, nameof(IMultiTenant.TenantId));
            var getTenantId = Expression.Call(
                Expression.Constant(_contextAccessor),
                typeof(INdtContextAccessor).GetMethod(nameof(INdtContextAccessor.GetTenantId))!
            );
            var body = Expression.Equal(tenantIdProp, getTenantId);
            entityType.SetQueryFilter(Expression.Lambda(body, param));
        }
    }

    private static void ApplyBaseConfigurations(ModelBuilder modelBuilder)
    {
        var entityTypes = modelBuilder.Model.GetEntityTypes()
            .Select(t => t.ClrType)
            .Where(t => t.IsClass && !t.IsAbstract)
            .ToList();

        foreach (var entityType in entityTypes)
        {
            var builder = modelBuilder.Entity(entityType);

            if (typeof(IAuditableEntity).IsAssignableFrom(entityType))
            {
                builder.Property(nameof(IAuditableEntity.CreatedBy)).HasMaxLength(256);
                builder.Property(nameof(IAuditableEntity.UpdatedBy)).HasMaxLength(256);
                builder.Property(nameof(IAuditableEntity.CreatedAt)).IsRequired(false);
                builder.Property(nameof(IAuditableEntity.UpdatedAt)).IsRequired(false);
            }

            if (typeof(ISoftDeletable).IsAssignableFrom(entityType))
            {
                builder.Property<bool>(nameof(ISoftDeletable.IsDeleted))
                    .IsRequired()
                    .HasDefaultValue(false);
                builder.Property(nameof(ISoftDeletable.DeletedBy)).HasMaxLength(256);

                var parameter = Expression.Parameter(entityType, "e");
                var isDeletedExpr = Expression.Equal(
                    Expression.Property(parameter, nameof(ISoftDeletable.IsDeleted)),
                    Expression.Constant(false)
                );
                builder.HasQueryFilter(Expression.Lambda(isDeletedExpr, parameter));
            }
        }
    }
}
```

- [ ] **Step 2: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/Persistence/Context/NdtProductDbContext.cs
git commit -m "feat(product): add NdtProductDbContext skeleton"
```

---

### Task 2: EF Configuration — Category

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/Persistence/Configurations/CategoryConfiguration.cs`

- [ ] **Step 1: Tạo CategoryConfiguration**

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NDTCore.Product.Domain.Entities;

namespace NDTCore.Product.Infrastructure.Persistence.Configurations;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories", "Product");

        builder.HasKey(e => e.Id);

        // ----- PROPERTIES -----
        builder.Property(e => e.TenantId).IsRequired();

        builder.Property(e => e.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(e => e.Slug)
            .IsRequired()
            .HasMaxLength(250);

        builder.Property(e => e.Description)
            .HasMaxLength(1000);

        builder.Property(e => e.ImageUrl)
            .HasMaxLength(2000);

        builder.Property(e => e.DisplayOrder)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(e => e.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        // ----- RELATIONSHIPS -----
        builder.HasOne(e => e.Parent)
            .WithMany(e => e.Children)
            .HasForeignKey(e => e.ParentId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);

        // ----- INDEXES -----
        builder.HasIndex(e => e.TenantId)
            .HasDatabaseName("IX_Categories_TenantId");

        builder.HasIndex(e => new { e.TenantId, e.Slug })
            .IsUnique()
            .HasDatabaseName("IX_Categories_TenantId_Slug");

        builder.HasIndex(e => new { e.TenantId, e.ParentId })
            .HasDatabaseName("IX_Categories_TenantId_ParentId");

        builder.HasIndex(e => new { e.TenantId, e.IsActive })
            .HasDatabaseName("IX_Categories_TenantId_IsActive");
    }
}
```

- [ ] **Step 2: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/Persistence/Configurations/CategoryConfiguration.cs
git commit -m "feat(product): add CategoryConfiguration"
```

---

### Task 3: EF Configuration — Tag

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/Persistence/Configurations/TagConfiguration.cs`

- [ ] **Step 1: Tạo TagConfiguration**

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NDTCore.Product.Domain.Entities;

namespace NDTCore.Product.Infrastructure.Persistence.Configurations;

public class TagConfiguration : IEntityTypeConfiguration<Tag>
{
    public void Configure(EntityTypeBuilder<Tag> builder)
    {
        builder.ToTable("Tags", "Product");

        builder.HasKey(e => e.Id);

        // ----- PROPERTIES -----
        builder.Property(e => e.TenantId).IsRequired();

        builder.Property(e => e.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(e => e.TextColor)
            .HasMaxLength(7);   // #RRGGBB

        builder.Property(e => e.ColorHex)
            .HasMaxLength(7);

        builder.Property(e => e.IconUrl)
            .HasMaxLength(2000);

        builder.Property(e => e.DisplayOrder)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(e => e.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        // ----- INDEXES -----
        builder.HasIndex(e => e.TenantId)
            .HasDatabaseName("IX_Tags_TenantId");

        builder.HasIndex(e => new { e.TenantId, e.Name })
            .IsUnique()
            .HasDatabaseName("IX_Tags_TenantId_Name");

        builder.HasIndex(e => new { e.TenantId, e.IsActive })
            .HasDatabaseName("IX_Tags_TenantId_IsActive");
    }
}
```

- [ ] **Step 2: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/Persistence/Configurations/TagConfiguration.cs
git commit -m "feat(product): add TagConfiguration"
```

---

### Task 4: Đăng ký DbContext trong DI

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/ServiceCollectionExtensions.cs`

- [ ] **Step 1: Cập nhật ServiceCollectionExtensions**

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Infrastructure.Persistence.Context;
using NDTCore.Product.Infrastructure.Repositories;

namespace NDTCore.Product.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddProductInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<NdtProductDbContext>(options =>
            options.UseSqlServer(
                configuration.GetConnectionString("DefaultConnection"),
                sql => sql.MigrationsAssembly(typeof(NdtProductDbContext).Assembly.FullName)));

        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<ITagRepository, TagRepository>();
        services.AddScoped<IProductUnitOfWork, ProductUnitOfWork>();

        return services;
    }
}
```

- [ ] **Step 2: Build để kiểm tra compile errors**
```bash
dotnet build NDTCore.BE/src/NDTCore.sln
```
Expected: Errors về missing interfaces (chưa tạo). Bình thường ở bước này.

- [ ] **Step 3: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/ServiceCollectionExtensions.cs
git commit -m "feat(product): register Product infrastructure services"
```

---

## Phase 1: Category — BE

---

### Task 5: Repository Interface — IProductUnitOfWork + ICategoryRepository

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/Interfaces/Repositories/IProductUnitOfWork.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/Interfaces/Repositories/ICategoryRepository.cs`

- [ ] **Step 1: Tạo IProductUnitOfWork**

```csharp
using NDTCore.BuildingBlocks.Abstractions.Persistence;

namespace NDTCore.Product.Contracts.Interfaces.Repositories;

/// <summary>
/// VN: Unit of Work cho Product module — gộp tất cả repository thao tác trong một transaction. <br />
/// EN: Unit of Work for the Product module — groups all repository operations within a single transaction.
/// </summary>
public interface IProductUnitOfWork : IUnitOfWork
{
    ICategoryRepository Categories { get; }
    ITagRepository Tags { get; }
}
```

- [ ] **Step 2: Tạo CategoryFilterDto**
  
  File: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/Models/Categories/CategoryFilterDto.cs`

```csharp
using NDTCore.BuildingBlocks.Core.Pagination;

namespace NDTCore.Product.Contracts.Models.Categories;

/// <summary>
/// VN: Điều kiện lọc danh sách danh mục. <br />
/// EN: Filter criteria for the category list.
/// </summary>
public class CategoryFilterDto : PaginationFilter
{
    /// <summary>
    /// VN: Tìm kiếm theo tên (contains, case-insensitive). <br />
    /// EN: Search by name (contains, case-insensitive).
    /// </summary>
    public string? Search { get; set; }

    /// <summary>
    /// VN: Lọc theo danh mục cha; null = lấy tất cả. <br />
    /// EN: Filter by parent category; null = all categories.
    /// </summary>
    public int? ParentId { get; set; }

    /// <summary>
    /// VN: Lọc theo trạng thái hiển thị; null = tất cả. <br />
    /// EN: Filter by active status; null = all.
    /// </summary>
    public bool? IsActive { get; set; }
}
```

- [ ] **Step 3: Tạo ICategoryRepository**

```csharp
using NDTCore.BuildingBlocks.Abstractions.Persistence;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.Product.Contracts.Models.Categories;
using NDTCore.Product.Domain.Entities;

namespace NDTCore.Product.Contracts.Interfaces.Repositories;

/// <summary>
/// VN: Contract truy cập dữ liệu đặc thù cho entity <see cref="Category"/>. <br />
/// EN: Data-access contract specific to the <see cref="Category"/> entity.
/// </summary>
public interface ICategoryRepository : IRepository<Category, int>
{
    /// <summary>
    /// VN: Lấy danh mục theo ID với change-tracking — dùng khi cần cập nhật. <br />
    /// EN: Retrieves a category by ID with change-tracking — use when updating.
    /// </summary>
    Task<Category?> GetByIdTrackedAsync(int id, CancellationToken ct = default);

    /// <summary>
    /// VN: Kiểm tra slug đã tồn tại trong tenant chưa. <br />
    /// EN: Checks whether the slug already exists for the current tenant.
    /// </summary>
    Task<bool> SlugExistsAsync(string slug, CancellationToken ct = default);

    /// <summary>
    /// VN: Kiểm tra slug đã tồn tại, bỏ qua category đang cập nhật. <br />
    /// EN: Checks slug uniqueness, excluding the category being updated.
    /// </summary>
    Task<bool> SlugExistsAsync(string slug, int excludeId, CancellationToken ct = default);

    /// <summary>
    /// VN: Lấy danh mục phân trang theo điều kiện lọc. <br />
    /// EN: Gets a paginated list of categories matching the filter.
    /// </summary>
    Task<PaginatedCollection<Category>> GetPagedAsync(
        CategoryFilterDto filter,
        CancellationToken ct = default);

    /// <summary>
    /// VN: Kiểm tra danh mục có danh mục con chưa bị xoá không. <br />
    /// EN: Checks whether the category has any non-deleted child categories.
    /// </summary>
    Task<bool> HasChildrenAsync(int id, CancellationToken ct = default);
}
```

- [ ] **Step 4: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/
git commit -m "feat(product): add ICategoryRepository and IProductUnitOfWork contracts"
```

---

### Task 6: ViewModels — Category Requests & Responses

**Files:**
- Create: `NDTCore.Product.Contracts/ViewModels/Categories/CreateCategoryRequest.cs`
- Create: `NDTCore.Product.Contracts/ViewModels/Categories/CreateCategoryResponse.cs`
- Create: `NDTCore.Product.Contracts/ViewModels/Categories/UpdateCategoryRequest.cs`
- Create: `NDTCore.Product.Contracts/ViewModels/Categories/UpdateCategoryResponse.cs`
- Create: `NDTCore.Product.Contracts/ViewModels/Categories/DeleteCategoryResponse.cs`
- Create: `NDTCore.Product.Contracts/ViewModels/Categories/GetCategoryResponse.cs`

- [ ] **Step 1: Tạo ViewModels**

```csharp
// CreateCategoryRequest.cs
namespace NDTCore.Product.Contracts.ViewModels.Categories;

public sealed class CreateCategoryRequest
{
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int? ParentId { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
```

```csharp
// CreateCategoryResponse.cs
namespace NDTCore.Product.Contracts.ViewModels.Categories;

public sealed class CreateCategoryResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int? ParentId { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
}
```

```csharp
// UpdateCategoryRequest.cs
namespace NDTCore.Product.Contracts.ViewModels.Categories;

public sealed class UpdateCategoryRequest
{
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int? ParentId { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
}
```

```csharp
// UpdateCategoryResponse.cs
namespace NDTCore.Product.Contracts.ViewModels.Categories;

public sealed class UpdateCategoryResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int? ParentId { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}
```

```csharp
// DeleteCategoryResponse.cs
namespace NDTCore.Product.Contracts.ViewModels.Categories;

public sealed class DeleteCategoryResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTimeOffset? DeletedAt { get; set; }
}
```

```csharp
// GetCategoryResponse.cs
namespace NDTCore.Product.Contracts.ViewModels.Categories;

public sealed class GetCategoryResponse
{
    public int Id { get; set; }
    public Guid TenantId { get; set; }
    public int? ParentId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }
}
```

- [ ] **Step 2: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/ViewModels/Categories/
git commit -m "feat(product): add Category ViewModels"
```

---

### Task 7: Repository Implementation — CategoryRepository + ProductUnitOfWork

**Files:**
- Create: `NDTCore.Product.Infrastructure/Repositories/CategoryRepository.cs`
- Create: `NDTCore.Product.Infrastructure/Repositories/ProductUnitOfWork.cs`

- [ ] **Step 1: Tạo CategoryRepository**

```csharp
using Microsoft.EntityFrameworkCore;
using NDTCore.BuildingBlocks.Abstractions.Persistence;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.Models.Categories;
using NDTCore.Product.Domain.Entities;
using NDTCore.Product.Infrastructure.Persistence.Context;

namespace NDTCore.Product.Infrastructure.Repositories;

public class CategoryRepository : GenericRepository<Category, int, NdtProductDbContext>, ICategoryRepository
{
    public CategoryRepository(NdtProductDbContext context) : base(context) { }

    public async Task<Category?> GetByIdTrackedAsync(int id, CancellationToken ct = default)
        => await Context.Categories
            .FirstOrDefaultAsync(c => c.Id == id, ct);

    public async Task<bool> SlugExistsAsync(string slug, CancellationToken ct = default)
        => await Context.Categories
            .AsNoTracking()
            .AnyAsync(c => c.Slug == slug, ct);

    public async Task<bool> SlugExistsAsync(string slug, int excludeId, CancellationToken ct = default)
        => await Context.Categories
            .AsNoTracking()
            .AnyAsync(c => c.Slug == slug && c.Id != excludeId, ct);

    public async Task<PaginatedCollection<Category>> GetPagedAsync(
        CategoryFilterDto filter,
        CancellationToken ct = default)
    {
        var query = Context.Categories.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(filter.Search))
            query = query.Where(c => c.Name.Contains(filter.Search));

        if (filter.ParentId.HasValue)
            query = query.Where(c => c.ParentId == filter.ParentId.Value);

        if (filter.IsActive.HasValue)
            query = query.Where(c => c.IsActive == filter.IsActive.Value);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.Name)
            .Skip((filter.PageNumber - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(ct);

        return new PaginatedCollection<Category>(items, new PaginationMetadata(totalCount, filter.PageNumber, filter.PageSize));
    }

    public async Task<bool> HasChildrenAsync(int id, CancellationToken ct = default)
        => await Context.Categories
            .AsNoTracking()
            .AnyAsync(c => c.ParentId == id, ct);
}
```

- [ ] **Step 2: Tạo ProductUnitOfWork**

```csharp
using NDTCore.BuildingBlocks.Abstractions.Persistence;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Infrastructure.Persistence.Context;

namespace NDTCore.Product.Infrastructure.Repositories;

public class ProductUnitOfWork : UnitOfWork<NdtProductDbContext>, IProductUnitOfWork
{
    public ICategoryRepository Categories { get; }
    public ITagRepository Tags { get; }

    public ProductUnitOfWork(
        NdtProductDbContext context,
        ICategoryRepository categoryRepository,
        ITagRepository tagRepository)
        : base(context)
    {
        Categories = categoryRepository;
        Tags = tagRepository;
    }
}
```

- [ ] **Step 3: Build**
```bash
dotnet build NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/NDTCore.Product.Infrastructure.csproj
```
Expected: Build thành công (sau khi tạo đủ interfaces ở Task 5).

- [ ] **Step 4: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/Repositories/
git commit -m "feat(product): add CategoryRepository and ProductUnitOfWork"
```

---

### Task 8: CQRS — GetPagedCategories

**Files:**
- Create: `NDTCore.Product.Application/Features/Categories/GetPagedCategories/GetPagedCategoriesQuery.cs`
- Create: `NDTCore.Product.Application/Features/Categories/GetPagedCategories/GetPagedCategoriesQueryValidator.cs`
- Create: `NDTCore.Product.Application/Features/Categories/GetPagedCategories/GetPagedCategoriesQueryHandler.cs`

- [ ] **Step 1: Tạo Query**

```csharp
// GetPagedCategoriesQuery.cs
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.Product.Contracts.Models.Categories;
using NDTCore.Product.Contracts.ViewModels.Categories;

namespace NDTCore.Product.Application.Features.Categories.GetPagedCategories;

public sealed record GetPagedCategoriesQuery(CategoryFilterDto Filter)
    : IQuery<PaginatedCollection<GetCategoryResponse>>;
```

- [ ] **Step 2: Tạo Validator**

```csharp
// GetPagedCategoriesQueryValidator.cs
using FluentValidation;

namespace NDTCore.Product.Application.Features.Categories.GetPagedCategories;

public sealed class GetPagedCategoriesQueryValidator : AbstractValidator<GetPagedCategoriesQuery>
{
    public GetPagedCategoriesQueryValidator()
    {
        RuleFor(x => x.Filter.PageNumber)
            .GreaterThan(0).WithMessage("PageNumber must be greater than 0.");

        RuleFor(x => x.Filter.PageSize)
            .InclusiveBetween(1, 100).WithMessage("PageSize must be between 1 and 100.");
    }
}
```

- [ ] **Step 3: Tạo Handler**

```csharp
// GetPagedCategoriesQueryHandler.cs
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.Categories;

namespace NDTCore.Product.Application.Features.Categories.GetPagedCategories;

public sealed class GetPagedCategoriesQueryHandler
    : IQueryHandler<GetPagedCategoriesQuery, PaginatedCollection<GetCategoryResponse>>
{
    private readonly ILogger<GetPagedCategoriesQueryHandler> _logger;
    private readonly ICategoryRepository _categoryRepository;

    public GetPagedCategoriesQueryHandler(
        ILogger<GetPagedCategoriesQueryHandler> logger,
        ICategoryRepository categoryRepository)
    {
        _logger = logger;
        _categoryRepository = categoryRepository;
    }

    public async Task<Result<PaginatedCollection<GetCategoryResponse>>> Handle(
        GetPagedCategoriesQuery request,
        CancellationToken cancellationToken)
    {
        var paged = await _categoryRepository.GetPagedAsync(request.Filter, cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Category page loaded: PageNumber={PageNumber}, PageSize={PageSize}, Total={Total}",
            nameof(GetPagedCategoriesQueryHandler),
            nameof(Handle),
            request.Filter.PageNumber,
            request.Filter.PageSize,
            paged.PaginationMetadata.TotalCount);

        var items = paged.Items.Select(c => new GetCategoryResponse
        {
            Id = c.Id,
            TenantId = c.TenantId,
            ParentId = c.ParentId,
            Name = c.Name,
            Slug = c.Slug ?? string.Empty,
            Description = c.Description,
            ImageUrl = c.ImageUrl,
            DisplayOrder = c.DisplayOrder,
            IsActive = c.IsActive,
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt,
            CreatedBy = c.CreatedBy,
            UpdatedBy = c.UpdatedBy,
        }).ToList();

        return Result<PaginatedCollection<GetCategoryResponse>>.Success(
            new PaginatedCollection<GetCategoryResponse>(items, paged.PaginationMetadata));
    }
}
```

- [ ] **Step 4: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/Categories/GetPagedCategories/
git commit -m "feat(product): add GetPagedCategories query"
```

---

### Task 9: CQRS — GetCategoryById

**Files:**
- Create: `NDTCore.Product.Application/Features/Categories/GetCategoryById/GetCategoryByIdQuery.cs`
- Create: `NDTCore.Product.Application/Features/Categories/GetCategoryById/GetCategoryByIdQueryValidator.cs`
- Create: `NDTCore.Product.Application/Features/Categories/GetCategoryById/GetCategoryByIdQueryHandler.cs`

- [ ] **Step 1: Tạo Query + Validator + Handler**

```csharp
// GetCategoryByIdQuery.cs
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.Product.Contracts.ViewModels.Categories;

namespace NDTCore.Product.Application.Features.Categories.GetCategoryById;

public sealed record GetCategoryByIdQuery(int Id) : IQuery<GetCategoryResponse>;
```

```csharp
// GetCategoryByIdQueryValidator.cs
using FluentValidation;

namespace NDTCore.Product.Application.Features.Categories.GetCategoryById;

public sealed class GetCategoryByIdQueryValidator : AbstractValidator<GetCategoryByIdQuery>
{
    public GetCategoryByIdQueryValidator()
    {
        RuleFor(x => x.Id).GreaterThan(0).WithMessage("Id must be greater than 0.");
    }
}
```

```csharp
// GetCategoryByIdQueryHandler.cs
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.Categories;

namespace NDTCore.Product.Application.Features.Categories.GetCategoryById;

public sealed class GetCategoryByIdQueryHandler : IQueryHandler<GetCategoryByIdQuery, GetCategoryResponse>
{
    private readonly ILogger<GetCategoryByIdQueryHandler> _logger;
    private readonly ICategoryRepository _categoryRepository;

    public GetCategoryByIdQueryHandler(
        ILogger<GetCategoryByIdQueryHandler> logger,
        ICategoryRepository categoryRepository)
    {
        _logger = logger;
        _categoryRepository = categoryRepository;
    }

    public async Task<Result<GetCategoryResponse>> Handle(
        GetCategoryByIdQuery request,
        CancellationToken cancellationToken)
    {
        var category = await _categoryRepository.GetByIdAsync(request.Id, cancellationToken);

        if (category is null)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Category not found: CategoryId={CategoryId}",
                nameof(GetCategoryByIdQueryHandler),
                nameof(Handle),
                request.Id);
            return Result<GetCategoryResponse>.Failure("CATEGORY_NOT_FOUND", "Category not found.");
        }

        return Result<GetCategoryResponse>.Success(new GetCategoryResponse
        {
            Id = category.Id,
            TenantId = category.TenantId,
            ParentId = category.ParentId,
            Name = category.Name,
            Slug = category.Slug ?? string.Empty,
            Description = category.Description,
            ImageUrl = category.ImageUrl,
            DisplayOrder = category.DisplayOrder,
            IsActive = category.IsActive,
            CreatedAt = category.CreatedAt,
            UpdatedAt = category.UpdatedAt,
            CreatedBy = category.CreatedBy,
            UpdatedBy = category.UpdatedBy,
        });
    }
}
```

- [ ] **Step 2: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/Categories/GetCategoryById/
git commit -m "feat(product): add GetCategoryById query"
```

---

### Task 10: CQRS — CreateCategory

**Files:**
- Create: `NDTCore.Product.Application/Features/Categories/CreateCategory/CreateCategoryCommand.cs`
- Create: `NDTCore.Product.Application/Features/Categories/CreateCategory/CreateCategoryCommandValidator.cs`
- Create: `NDTCore.Product.Application/Features/Categories/CreateCategory/CreateCategoryCommandHandler.cs`

- [ ] **Step 1: Tạo Command + Validator + Handler**

```csharp
// CreateCategoryCommand.cs
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.Product.Contracts.ViewModels.Categories;

namespace NDTCore.Product.Application.Features.Categories.CreateCategory;

public sealed record CreateCategoryCommand(CreateCategoryRequest Request) : ICommand<CreateCategoryResponse>;
```

```csharp
// CreateCategoryCommandValidator.cs
using FluentValidation;

namespace NDTCore.Product.Application.Features.Categories.CreateCategory;

public sealed class CreateCategoryCommandValidator : AbstractValidator<CreateCategoryCommand>
{
    public CreateCategoryCommandValidator()
    {
        RuleFor(x => x.Request.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(200).WithMessage("Name must not exceed 200 characters.");

        RuleFor(x => x.Request.Slug)
            .NotEmpty().WithMessage("Slug is required.")
            .MaximumLength(250).WithMessage("Slug must not exceed 250 characters.")
            .Matches(@"^[a-z0-9]+(?:-[a-z0-9]+)*$").WithMessage("Slug must be lowercase alphanumeric with hyphens only.");

        RuleFor(x => x.Request.Description)
            .MaximumLength(1000).When(x => x.Request.Description is not null);

        RuleFor(x => x.Request.DisplayOrder)
            .GreaterThanOrEqualTo(0).WithMessage("DisplayOrder must be >= 0.");
    }
}
```

```csharp
// CreateCategoryCommandHandler.cs
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Abstractions.Contexts;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.Categories;
using NDTCore.Product.Domain.Entities;

namespace NDTCore.Product.Application.Features.Categories.CreateCategory;

public sealed class CreateCategoryCommandHandler : ICommandHandler<CreateCategoryCommand, CreateCategoryResponse>
{
    private readonly ILogger<CreateCategoryCommandHandler> _logger;
    private readonly IProductUnitOfWork _unitOfWork;
    private readonly INdtContextAccessor _contextAccessor;

    public CreateCategoryCommandHandler(
        ILogger<CreateCategoryCommandHandler> logger,
        IProductUnitOfWork unitOfWork,
        INdtContextAccessor contextAccessor)
    {
        _logger = logger;
        _unitOfWork = unitOfWork;
        _contextAccessor = contextAccessor;
    }

    public async Task<Result<CreateCategoryResponse>> Handle(
        CreateCategoryCommand request,
        CancellationToken cancellationToken)
    {
        var req = request.Request;

        var slugExists = await _unitOfWork.Categories.SlugExistsAsync(req.Slug, cancellationToken);
        if (slugExists)
            return Result<CreateCategoryResponse>.Failure("SLUG_EXISTS", $"Slug '{req.Slug}' already exists.");

        var category = new Category
        {
            TenantId = _contextAccessor.GetTenantId(),
            ParentId = req.ParentId,
            Name = req.Name,
            Slug = req.Slug,
            Description = req.Description,
            ImageUrl = req.ImageUrl,
            DisplayOrder = req.DisplayOrder,
            IsActive = req.IsActive,
        };

        await _unitOfWork.Categories.AddAsync(category, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Category created: CategoryId={CategoryId}, Name={Name}",
            nameof(CreateCategoryCommandHandler),
            nameof(Handle),
            category.Id,
            category.Name);

        return Result<CreateCategoryResponse>.Success(new CreateCategoryResponse
        {
            Id = category.Id,
            Name = category.Name,
            Slug = category.Slug ?? string.Empty,
            ParentId = category.ParentId,
            IsActive = category.IsActive,
            CreatedAt = category.CreatedAt,
        });
    }
}
```

- [ ] **Step 2: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/Categories/CreateCategory/
git commit -m "feat(product): add CreateCategory command"
```

---

### Task 11: CQRS — UpdateCategory

**Files:**
- Create: `NDTCore.Product.Application/Features/Categories/UpdateCategory/UpdateCategoryCommand.cs`
- Create: `NDTCore.Product.Application/Features/Categories/UpdateCategory/UpdateCategoryCommandValidator.cs`
- Create: `NDTCore.Product.Application/Features/Categories/UpdateCategory/UpdateCategoryCommandHandler.cs`

- [ ] **Step 1: Tạo Command + Validator + Handler**

```csharp
// UpdateCategoryCommand.cs
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.Product.Contracts.ViewModels.Categories;

namespace NDTCore.Product.Application.Features.Categories.UpdateCategory;

public sealed record UpdateCategoryCommand(int Id, UpdateCategoryRequest Request) : ICommand<UpdateCategoryResponse>;
```

```csharp
// UpdateCategoryCommandValidator.cs
using FluentValidation;

namespace NDTCore.Product.Application.Features.Categories.UpdateCategory;

public sealed class UpdateCategoryCommandValidator : AbstractValidator<UpdateCategoryCommand>
{
    public UpdateCategoryCommandValidator()
    {
        RuleFor(x => x.Id).GreaterThan(0).WithMessage("Id must be greater than 0.");

        RuleFor(x => x.Request.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(200).WithMessage("Name must not exceed 200 characters.");

        RuleFor(x => x.Request.Slug)
            .NotEmpty().WithMessage("Slug is required.")
            .MaximumLength(250).WithMessage("Slug must not exceed 250 characters.")
            .Matches(@"^[a-z0-9]+(?:-[a-z0-9]+)*$").WithMessage("Slug must be lowercase alphanumeric with hyphens only.");

        RuleFor(x => x.Request.Description)
            .MaximumLength(1000).When(x => x.Request.Description is not null);

        RuleFor(x => x.Request.DisplayOrder)
            .GreaterThanOrEqualTo(0).WithMessage("DisplayOrder must be >= 0.");
    }
}
```

```csharp
// UpdateCategoryCommandHandler.cs
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.Categories;

namespace NDTCore.Product.Application.Features.Categories.UpdateCategory;

public sealed class UpdateCategoryCommandHandler : ICommandHandler<UpdateCategoryCommand, UpdateCategoryResponse>
{
    private readonly ILogger<UpdateCategoryCommandHandler> _logger;
    private readonly IProductUnitOfWork _unitOfWork;

    public UpdateCategoryCommandHandler(
        ILogger<UpdateCategoryCommandHandler> logger,
        IProductUnitOfWork unitOfWork)
    {
        _logger = logger;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateCategoryResponse>> Handle(
        UpdateCategoryCommand request,
        CancellationToken cancellationToken)
    {
        var category = await _unitOfWork.Categories.GetByIdTrackedAsync(request.Id, cancellationToken);
        if (category is null)
            return Result<UpdateCategoryResponse>.Failure("CATEGORY_NOT_FOUND", "Category not found.");

        var req = request.Request;
        var slugExists = await _unitOfWork.Categories.SlugExistsAsync(req.Slug, request.Id, cancellationToken);
        if (slugExists)
            return Result<UpdateCategoryResponse>.Failure("SLUG_EXISTS", $"Slug '{req.Slug}' already exists.");

        // Prevent circular parent reference
        if (req.ParentId.HasValue && req.ParentId.Value == request.Id)
            return Result<UpdateCategoryResponse>.Failure("INVALID_PARENT", "A category cannot be its own parent.");

        category.Name = req.Name;
        category.Slug = req.Slug;
        category.Description = req.Description;
        category.ImageUrl = req.ImageUrl;
        category.ParentId = req.ParentId;
        category.DisplayOrder = req.DisplayOrder;
        category.IsActive = req.IsActive;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Category updated: CategoryId={CategoryId}, Name={Name}",
            nameof(UpdateCategoryCommandHandler),
            nameof(Handle),
            category.Id,
            category.Name);

        return Result<UpdateCategoryResponse>.Success(new UpdateCategoryResponse
        {
            Id = category.Id,
            Name = category.Name,
            Slug = category.Slug ?? string.Empty,
            ParentId = category.ParentId,
            IsActive = category.IsActive,
            UpdatedAt = category.UpdatedAt,
        });
    }
}
```

- [ ] **Step 2: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/Categories/UpdateCategory/
git commit -m "feat(product): add UpdateCategory command"
```

---

### Task 12: CQRS — DeleteCategory

**Files:**
- Create: `NDTCore.Product.Application/Features/Categories/DeleteCategory/DeleteCategoryCommand.cs`
- Create: `NDTCore.Product.Application/Features/Categories/DeleteCategory/DeleteCategoryCommandValidator.cs`
- Create: `NDTCore.Product.Application/Features/Categories/DeleteCategory/DeleteCategoryCommandHandler.cs`

- [ ] **Step 1: Tạo Command + Validator + Handler**

```csharp
// DeleteCategoryCommand.cs
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.Product.Contracts.ViewModels.Categories;

namespace NDTCore.Product.Application.Features.Categories.DeleteCategory;

public sealed record DeleteCategoryCommand(int Id, string DeletedBy) : ICommand<DeleteCategoryResponse>;
```

```csharp
// DeleteCategoryCommandValidator.cs
using FluentValidation;

namespace NDTCore.Product.Application.Features.Categories.DeleteCategory;

public sealed class DeleteCategoryCommandValidator : AbstractValidator<DeleteCategoryCommand>
{
    public DeleteCategoryCommandValidator()
    {
        RuleFor(x => x.Id).GreaterThan(0).WithMessage("Id must be greater than 0.");
        RuleFor(x => x.DeletedBy).NotEmpty().WithMessage("DeletedBy is required.");
    }
}
```

```csharp
// DeleteCategoryCommandHandler.cs
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.Categories;

namespace NDTCore.Product.Application.Features.Categories.DeleteCategory;

public sealed class DeleteCategoryCommandHandler : ICommandHandler<DeleteCategoryCommand, DeleteCategoryResponse>
{
    private readonly ILogger<DeleteCategoryCommandHandler> _logger;
    private readonly IProductUnitOfWork _unitOfWork;

    public DeleteCategoryCommandHandler(
        ILogger<DeleteCategoryCommandHandler> logger,
        IProductUnitOfWork unitOfWork)
    {
        _logger = logger;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DeleteCategoryResponse>> Handle(
        DeleteCategoryCommand request,
        CancellationToken cancellationToken)
    {
        var category = await _unitOfWork.Categories.GetByIdTrackedAsync(request.Id, cancellationToken);
        if (category is null)
            return Result<DeleteCategoryResponse>.Failure("CATEGORY_NOT_FOUND", "Category not found.");

        var hasChildren = await _unitOfWork.Categories.HasChildrenAsync(request.Id, cancellationToken);
        if (hasChildren)
            return Result<DeleteCategoryResponse>.Failure(
                "CATEGORY_HAS_CHILDREN",
                "Cannot delete a category that has sub-categories. Remove child categories first.");

        category.IsDeleted = true;
        category.DeletedAt = DateTimeOffset.UtcNow;
        category.DeletedBy = request.DeletedBy;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Category deleted: CategoryId={CategoryId}, DeletedBy={DeletedBy}",
            nameof(DeleteCategoryCommandHandler),
            nameof(Handle),
            category.Id,
            request.DeletedBy);

        return Result<DeleteCategoryResponse>.Success(new DeleteCategoryResponse
        {
            Id = category.Id,
            Name = category.Name,
            DeletedAt = category.DeletedAt,
        });
    }
}
```

- [ ] **Step 2: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/Categories/DeleteCategory/
git commit -m "feat(product): add DeleteCategory command"
```

---

### Task 13: Application DI Registration — Category

**Files:**
- Modify: `NDTCore.Product.Application/ServiceCollectionExtensions.cs`

- [ ] **Step 1: Cập nhật Application DI**

```csharp
using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;

namespace NDTCore.Product.Application;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddProductApplicationServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));

        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

        return services;
    }
}
```

- [ ] **Step 2: Full build**
```bash
dotnet build NDTCore.BE/src/NDTCore.sln
```
Expected: Build success.

- [ ] **Step 3: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/ServiceCollectionExtensions.cs
git commit -m "feat(product): register MediatR and validators for Product Application"
```

---

### Task 14: Controller — CategoryController

**Files:**
- Create: `NDTCore.BE/src/NDTCore.API/Controllers/Products/CategoryController.cs`

- [ ] **Step 1: Tạo CategoryController**

```csharp
using MediatR;
using Microsoft.AspNetCore.Mvc;
using NDTCore.BuildingBlocks.Security.Authorization;
using NDTCore.Product.Application.Features.Categories.CreateCategory;
using NDTCore.Product.Application.Features.Categories.DeleteCategory;
using NDTCore.Product.Application.Features.Categories.GetCategoryById;
using NDTCore.Product.Application.Features.Categories.GetPagedCategories;
using NDTCore.Product.Application.Features.Categories.UpdateCategory;
using NDTCore.Product.Contracts.Models.Categories;
using NDTCore.Product.Contracts.ViewModels.Categories;

namespace NDTCore.API.Controllers.Products;

[ApiController]
[Route("admin/product/categories")]
public class CategoryController : ControllerBase
{
    private readonly IMediator _mediator;

    public CategoryController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>GET /admin/product/categories?pageNumber=1&pageSize=20</summary>
    [HttpGet]
    [RequiresPermission("ProductCategory.Read.All")]
    public async Task<IActionResult> GetPaged([FromQuery] CategoryFilterDto filter, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetPagedCategoriesQuery(filter), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(result.Error);
    }

    /// <summary>GET /admin/product/categories/{id}</summary>
    [HttpGet("{id:int}")]
    [RequiresPermission("ProductCategory.Read.All")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetCategoryByIdQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : NotFound(result.Error);
    }

    /// <summary>POST /admin/product/categories</summary>
    [HttpPost]
    [RequiresPermission("ProductCategory.Create.All")]
    public async Task<IActionResult> Create([FromBody] CreateCategoryRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(new CreateCategoryCommand(request), ct);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>PUT /admin/product/categories/{id}</summary>
    [HttpPut("{id:int}")]
    [RequiresPermission("ProductCategory.Update.All")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCategoryRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(new UpdateCategoryCommand(id, request), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(result.Error);
    }

    /// <summary>DELETE /admin/product/categories/{id}</summary>
    [HttpDelete("{id:int}")]
    [RequiresPermission("ProductCategory.Delete.All")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var userId = User.FindFirst("sub")?.Value ?? "system";
        var result = await _mediator.Send(new DeleteCategoryCommand(id, userId), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(result.Error);
    }
}
```

- [ ] **Step 2: Full build + run**
```bash
dotnet build NDTCore.BE/src/NDTCore.sln
dotnet run --project NDTCore.BE/src/NDTCore.API
```
Test endpoints: GET `/admin/product/categories` → 200 (empty list).

- [ ] **Step 3: Commit**
```bash
git add NDTCore.BE/src/NDTCore.API/Controllers/Products/CategoryController.cs
git commit -m "feat(product): add CategoryController with full CRUD endpoints"
```

---

## Phase 2: Tag — BE

### Task 15: ITagRepository + TagFilterDto + Tag ViewModels

**Files:**
- Create: `NDTCore.Product.Contracts/Interfaces/Repositories/ITagRepository.cs`
- Create: `NDTCore.Product.Contracts/Models/Tags/TagFilterDto.cs`
- Create: `NDTCore.Product.Contracts/ViewModels/Tags/` (6 files)

- [ ] **Step 1: TagFilterDto**

```csharp
// TagFilterDto.cs
using NDTCore.BuildingBlocks.Core.Pagination;

namespace NDTCore.Product.Contracts.Models.Tags;

public class TagFilterDto : PaginationFilter
{
    public string? Search { get; set; }
    public bool? IsActive { get; set; }
}
```

- [ ] **Step 2: ITagRepository**

```csharp
using NDTCore.BuildingBlocks.Abstractions.Persistence;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.Product.Contracts.Models.Tags;
using NDTCore.Product.Domain.Entities;

namespace NDTCore.Product.Contracts.Interfaces.Repositories;

public interface ITagRepository : IRepository<Tag, int>
{
    Task<Tag?> GetByIdTrackedAsync(int id, CancellationToken ct = default);
    Task<bool> NameExistsAsync(string name, CancellationToken ct = default);
    Task<bool> NameExistsAsync(string name, int excludeId, CancellationToken ct = default);
    Task<PaginatedCollection<Tag>> GetPagedAsync(TagFilterDto filter, CancellationToken ct = default);
}
```

- [ ] **Step 3: Tag ViewModels — 6 files**

```csharp
// GetTagResponse.cs
namespace NDTCore.Product.Contracts.ViewModels.Tags;

public sealed class GetTagResponse
{
    public int Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? TextColor { get; set; }
    public string? ColorHex { get; set; }
    public string? IconUrl { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }
}
```

```csharp
// CreateTagRequest.cs
namespace NDTCore.Product.Contracts.ViewModels.Tags;

public sealed class CreateTagRequest
{
    public required string Name { get; set; }
    public string? TextColor { get; set; }   // Hex #RRGGBB
    public string? ColorHex { get; set; }   // Hex #RRGGBB
    public string? IconUrl { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
```

```csharp
// CreateTagResponse.cs
namespace NDTCore.Product.Contracts.ViewModels.Tags;

public sealed class CreateTagResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ColorHex { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
}
```

```csharp
// UpdateTagRequest.cs
namespace NDTCore.Product.Contracts.ViewModels.Tags;

public sealed class UpdateTagRequest
{
    public required string Name { get; set; }
    public string? TextColor { get; set; }
    public string? ColorHex { get; set; }
    public string? IconUrl { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
}
```

```csharp
// UpdateTagResponse.cs
namespace NDTCore.Product.Contracts.ViewModels.Tags;

public sealed class UpdateTagResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ColorHex { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}
```

```csharp
// DeleteTagResponse.cs
namespace NDTCore.Product.Contracts.ViewModels.Tags;

public sealed class DeleteTagResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTimeOffset? DeletedAt { get; set; }
}
```

- [ ] **Step 4: Commit**
```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/
git commit -m "feat(product): add ITagRepository, TagFilterDto, Tag ViewModels"
```

---

### Task 16: TagRepository + Tag CQRS + TagController

**Files:**
- Create: `NDTCore.Product.Infrastructure/Repositories/TagRepository.cs`
- Create: `NDTCore.Product.Application/Features/Tags/` (5 feature folders × 3 files = 15 files)
- Create: `NDTCore.API/Controllers/Products/TagController.cs`

- [ ] **Step 1: TagRepository**

```csharp
using Microsoft.EntityFrameworkCore;
using NDTCore.BuildingBlocks.Abstractions.Persistence;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.Models.Tags;
using NDTCore.Product.Domain.Entities;
using NDTCore.Product.Infrastructure.Persistence.Context;

namespace NDTCore.Product.Infrastructure.Repositories;

public class TagRepository : GenericRepository<Tag, int, NdtProductDbContext>, ITagRepository
{
    public TagRepository(NdtProductDbContext context) : base(context) { }

    public async Task<Tag?> GetByIdTrackedAsync(int id, CancellationToken ct = default)
        => await Context.Tags.FirstOrDefaultAsync(t => t.Id == id, ct);

    public async Task<bool> NameExistsAsync(string name, CancellationToken ct = default)
        => await Context.Tags.AsNoTracking().AnyAsync(t => t.Name == name, ct);

    public async Task<bool> NameExistsAsync(string name, int excludeId, CancellationToken ct = default)
        => await Context.Tags.AsNoTracking().AnyAsync(t => t.Name == name && t.Id != excludeId, ct);

    public async Task<PaginatedCollection<Tag>> GetPagedAsync(TagFilterDto filter, CancellationToken ct = default)
    {
        var query = Context.Tags.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(filter.Search))
            query = query.Where(t => t.Name.Contains(filter.Search));

        if (filter.IsActive.HasValue)
            query = query.Where(t => t.IsActive == filter.IsActive.Value);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderBy(t => t.DisplayOrder)
            .ThenBy(t => t.Name)
            .Skip((filter.PageNumber - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(ct);

        return new PaginatedCollection<Tag>(items, new PaginationMetadata(totalCount, filter.PageNumber, filter.PageSize));
    }
}
```

- [ ] **Step 2: GetPagedTags Query + Validator + Handler**

```csharp
// GetPagedTagsQuery.cs
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.Product.Contracts.Models.Tags;
using NDTCore.Product.Contracts.ViewModels.Tags;

namespace NDTCore.Product.Application.Features.Tags.GetPagedTags;

public sealed record GetPagedTagsQuery(TagFilterDto Filter) : IQuery<PaginatedCollection<GetTagResponse>>;
```

```csharp
// GetPagedTagsQueryValidator.cs
using FluentValidation;

namespace NDTCore.Product.Application.Features.Tags.GetPagedTags;

public sealed class GetPagedTagsQueryValidator : AbstractValidator<GetPagedTagsQuery>
{
    public GetPagedTagsQueryValidator()
    {
        RuleFor(x => x.Filter.PageNumber).GreaterThan(0);
        RuleFor(x => x.Filter.PageSize).InclusiveBetween(1, 100);
    }
}
```

```csharp
// GetPagedTagsQueryHandler.cs
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.Tags;

namespace NDTCore.Product.Application.Features.Tags.GetPagedTags;

public sealed class GetPagedTagsQueryHandler : IQueryHandler<GetPagedTagsQuery, PaginatedCollection<GetTagResponse>>
{
    private readonly ILogger<GetPagedTagsQueryHandler> _logger;
    private readonly ITagRepository _tagRepository;

    public GetPagedTagsQueryHandler(ILogger<GetPagedTagsQueryHandler> logger, ITagRepository tagRepository)
    {
        _logger = logger;
        _tagRepository = tagRepository;
    }

    public async Task<Result<PaginatedCollection<GetTagResponse>>> Handle(GetPagedTagsQuery request, CancellationToken cancellationToken)
    {
        var paged = await _tagRepository.GetPagedAsync(request.Filter, cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] Tag page loaded: PageNumber={PageNumber}, PageSize={PageSize}, Total={Total}",
            nameof(GetPagedTagsQueryHandler), nameof(Handle),
            request.Filter.PageNumber, request.Filter.PageSize, paged.PaginationMetadata.TotalCount);

        var items = paged.Items.Select(t => new GetTagResponse
        {
            Id = t.Id, TenantId = t.TenantId, Name = t.Name,
            TextColor = t.TextColor, ColorHex = t.ColorHex, IconUrl = t.IconUrl,
            DisplayOrder = t.DisplayOrder, IsActive = t.IsActive,
            CreatedAt = t.CreatedAt, UpdatedAt = t.UpdatedAt,
            CreatedBy = t.CreatedBy, UpdatedBy = t.UpdatedBy,
        }).ToList();

        return Result<PaginatedCollection<GetTagResponse>>.Success(
            new PaginatedCollection<GetTagResponse>(items, paged.PaginationMetadata));
    }
}
```

- [ ] **Step 3: GetTagById + CreateTag + UpdateTag + DeleteTag**

Tạo 4 feature folders còn lại theo cùng pattern với Category (Task 9–12), với các khác biệt sau:
- `GetTagById` → map `Tag` → `GetTagResponse`
- `CreateTag` → validate: `Name` unique trong tenant (`_unitOfWork.Tags.NameExistsAsync`), `ColorHex`/`TextColor` phải là hex hợp lệ nếu có: `Matches(@"^#[0-9A-Fa-f]{6}$")`
- `UpdateTag` → validate uniqueness bỏ qua self; map fields Tag
- `DeleteTag` → không có constraint; chỉ soft-delete

- [ ] **Step 4: TagController**

```csharp
using MediatR;
using Microsoft.AspNetCore.Mvc;
using NDTCore.BuildingBlocks.Security.Authorization;
using NDTCore.Product.Application.Features.Tags.CreateTag;
using NDTCore.Product.Application.Features.Tags.DeleteTag;
using NDTCore.Product.Application.Features.Tags.GetPagedTags;
using NDTCore.Product.Application.Features.Tags.GetTagById;
using NDTCore.Product.Application.Features.Tags.UpdateTag;
using NDTCore.Product.Contracts.Models.Tags;
using NDTCore.Product.Contracts.ViewModels.Tags;

namespace NDTCore.API.Controllers.Products;

[ApiController]
[Route("admin/product/tags")]
public class TagController : ControllerBase
{
    private readonly IMediator _mediator;
    public TagController(IMediator mediator) { _mediator = mediator; }

    [HttpGet]
    [RequiresPermission("ProductTag.Read.All")]
    public async Task<IActionResult> GetPaged([FromQuery] TagFilterDto filter, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetPagedTagsQuery(filter), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(result.Error);
    }

    [HttpGet("{id:int}")]
    [RequiresPermission("ProductTag.Read.All")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetTagByIdQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : NotFound(result.Error);
    }

    [HttpPost]
    [RequiresPermission("ProductTag.Create.All")]
    public async Task<IActionResult> Create([FromBody] CreateTagRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(new CreateTagCommand(request), ct);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:int}")]
    [RequiresPermission("ProductTag.Update.All")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTagRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(new UpdateTagCommand(id, request), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(result.Error);
    }

    [HttpDelete("{id:int}")]
    [RequiresPermission("ProductTag.Delete.All")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var userId = User.FindFirst("sub")?.Value ?? "system";
        var result = await _mediator.Send(new DeleteTagCommand(id, userId), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(result.Error);
    }
}
```

- [ ] **Step 5: EF Migration**
```bash
cd NDTCore.BE/src/NDTCore.API
dotnet ef migrations add AddProductModule_CategoryTag \
    --context NdtProductDbContext \
    --project ../NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure \
    --startup-project . \
    --output-dir Persistence/Migrations/ProductDb
dotnet ef database update --context NdtProductDbContext --project ../NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure --startup-project .
```

- [ ] **Step 6: Full build + run + smoke test**
```bash
dotnet build NDTCore.BE/src/NDTCore.sln
# Smoke test with curl:
# curl -X GET http://localhost:5000/admin/product/categories -H "Authorization: Bearer <token>"
# curl -X GET http://localhost:5000/admin/product/tags
```

- [ ] **Step 7: Commit**
```bash
git add NDTCore.BE/src/
git commit -m "feat(product): complete Category + Tag BE — CQRS, Repositories, Controllers, Migration"
```

---

## Phase 3: Category + Tag — FE

---

### Task 17: FE Foundation — API Client + API Endpoints

**Files:**
- Create: `NDTCore.FE/src/core/api/clients/product.client.ts`
- Modify: `NDTCore.FE/src/core/constants/api.constants.ts`

- [ ] **Step 1: Tạo ProductClient**

```typescript
// src/core/api/clients/product.client.ts
import { ApiClient } from './api.client'

class ProductClient extends ApiClient {
    constructor() {
        super(import.meta.env.VITE_PRODUCT_API_URL ?? import.meta.env.VITE_API_BASE_URL)
    }
}

export const productClient = new ProductClient()
```

- [ ] **Step 2: Thêm PRODUCT section vào api.constants.ts**

```typescript
// Thêm vào API_ENDPOINTS object trong src/core/constants/api.constants.ts
PRODUCT: {
    CATEGORY_API: {
        GET_PAGED: '/admin/product/categories',
        CREATE: '/admin/product/categories',
        GET_BY_ID: (id: number) => `/admin/product/categories/${id}`,
        UPDATE: (id: number) => `/admin/product/categories/${id}`,
        DELETE: (id: number) => `/admin/product/categories/${id}`,
    },
    TAG_API: {
        GET_PAGED: '/admin/product/tags',
        CREATE: '/admin/product/tags',
        GET_BY_ID: (id: number) => `/admin/product/tags/${id}`,
        UPDATE: (id: number) => `/admin/product/tags/${id}`,
        DELETE: (id: number) => `/admin/product/tags/${id}`,
    },
},
```

- [ ] **Step 3: Commit**
```bash
git add NDTCore.FE/src/core/api/clients/product.client.ts NDTCore.FE/src/core/constants/api.constants.ts
git commit -m "feat(product-fe): add ProductClient and PRODUCT API endpoints"
```

---

### Task 18: FE Category — DTOs, ViewModel, Mapper

**Files:**
- Create: `NDTCore.FE/src/modules/product/models/dtos/category.dto.ts`
- Create: `NDTCore.FE/src/modules/product/models/view-models/category.view-model.ts`
- Create: `NDTCore.FE/src/modules/product/models/form-models/category.model.ts`
- Create: `NDTCore.FE/src/modules/product/mappers/category.mapper.ts`

- [ ] **Step 1: Tạo CategoryDto (khớp chính xác với BE response)**

```typescript
// src/modules/product/models/dtos/category.dto.ts

export interface CategoryDto {
    Id: number
    TenantId: string
    ParentId: number | null
    Name: string
    Slug: string
    Description: string | null
    ImageUrl: string | null
    DisplayOrder: number
    IsActive: boolean
    CreatedAt: string | null
    UpdatedAt: string | null
    CreatedBy: string | null
    UpdatedBy: string | null
}

export interface CategoryFilterDto {
    PageNumber: number
    PageSize: number
    Search?: string | null
    ParentId?: number | null
    IsActive?: boolean | null
}

export interface CreateCategoryRequest {
    Name: string
    Slug: string
    Description?: string | null
    ImageUrl?: string | null
    ParentId?: number | null
    DisplayOrder: number
    IsActive: boolean
}

export interface CreateCategoryResponse {
    Id: number
    Name: string
    Slug: string
    ParentId: number | null
    IsActive: boolean
    CreatedAt: string | null
}

export interface UpdateCategoryRequest {
    Name: string
    Slug: string
    Description?: string | null
    ImageUrl?: string | null
    ParentId?: number | null
    DisplayOrder: number
    IsActive: boolean
}

export interface UpdateCategoryResponse {
    Id: number
    Name: string
    Slug: string
    ParentId: number | null
    IsActive: boolean
    UpdatedAt: string | null
}

export interface DeleteCategoryResponse {
    Id: number
    Name: string
    DeletedAt: string | null
}
```

- [ ] **Step 2: CategoryViewModel (camelCase, FE-internal)**

```typescript
// src/modules/product/models/view-models/category.view-model.ts
export interface CategoryViewModel {
    id: number
    tenantId: string
    parentId: number | null
    name: string
    slug: string
    description: string | null
    imageUrl: string | null
    displayOrder: number
    isActive: boolean
    createdAt: string | null
    updatedAt: string | null
    createdBy: string | null
    updatedBy: string | null
}
```

- [ ] **Step 3: CategoryFormModel (form state)**

```typescript
// src/modules/product/models/form-models/category.model.ts
export interface CategoryFormModel {
    name: string
    slug: string
    description: string
    imageUrl: string
    parentId: number | null
    displayOrder: number
    isActive: boolean
}

export function createEmptyCategoryForm(): CategoryFormModel {
    return {
        name: '',
        slug: '',
        description: '',
        imageUrl: '',
        parentId: null,
        displayOrder: 0,
        isActive: true,
    }
}
```

- [ ] **Step 4: CategoryMapper**

```typescript
// src/modules/product/mappers/category.mapper.ts
import type { CategoryDto, CreateCategoryResponse, UpdateCategoryResponse } from '../models/dtos/category.dto'
import type { CategoryViewModel } from '../models/view-models/category.view-model'

const toViewModel = (dto: CategoryDto): CategoryViewModel => ({
    id: dto.Id,
    tenantId: dto.TenantId,
    parentId: dto.ParentId,
    name: dto.Name,
    slug: dto.Slug,
    description: dto.Description,
    imageUrl: dto.ImageUrl,
    displayOrder: dto.DisplayOrder,
    isActive: dto.IsActive,
    createdAt: dto.CreatedAt,
    updatedAt: dto.UpdatedAt,
    createdBy: dto.CreatedBy,
    updatedBy: dto.UpdatedBy,
})

const toViewModels = (dtos: CategoryDto[]): CategoryViewModel[] => dtos.map(toViewModel)

const createResponseToViewModel = (dto: CreateCategoryResponse): CategoryViewModel => ({
    id: dto.Id,
    tenantId: '',
    parentId: dto.ParentId,
    name: dto.Name,
    slug: dto.Slug,
    description: null,
    imageUrl: null,
    displayOrder: 0,
    isActive: dto.IsActive,
    createdAt: dto.CreatedAt,
    updatedAt: null,
    createdBy: null,
    updatedBy: null,
})

const updateResponseToViewModel = (dto: UpdateCategoryResponse): Partial<CategoryViewModel> => ({
    id: dto.Id,
    name: dto.Name,
    slug: dto.Slug,
    parentId: dto.ParentId,
    isActive: dto.IsActive,
    updatedAt: dto.UpdatedAt,
})

export const categoryMapper = { toViewModel, toViewModels, createResponseToViewModel, updateResponseToViewModel }
```

- [ ] **Step 5: Commit**
```bash
git add NDTCore.FE/src/modules/product/models/ NDTCore.FE/src/modules/product/mappers/
git commit -m "feat(product-fe): add Category DTOs, ViewModel, FormModel, Mapper"
```

---

### Task 19: FE Category — API, Service, Store, Composable

**Files:**
- Create: `src/modules/product/api/category.api.ts`
- Create: `src/modules/product/services/category.service.ts`
- Create: `src/modules/product/stores/category.store.ts`
- Create: `src/modules/product/composables/useCategory.ts`

- [ ] **Step 1: category.api.ts**

```typescript
// src/modules/product/api/category.api.ts
import { API_ENDPOINTS } from '@/core/constants/api.constants'
import type { ApiResponse, PagedApiResponse } from '@/core/models/common.dto'
import { productClient } from '@/core/api/clients/product.client'
import type {
    CategoryDto,
    CategoryFilterDto,
    CreateCategoryRequest,
    CreateCategoryResponse,
    UpdateCategoryRequest,
    UpdateCategoryResponse,
    DeleteCategoryResponse,
} from '../models/dtos/category.dto'

export const categoryApi = {
    getPagedAsync(params: CategoryFilterDto): Promise<PagedApiResponse<CategoryDto>> {
        return productClient.get(API_ENDPOINTS.PRODUCT.CATEGORY_API.GET_PAGED, params)
    },
    getByIdAsync(id: number): Promise<ApiResponse<CategoryDto>> {
        return productClient.get(API_ENDPOINTS.PRODUCT.CATEGORY_API.GET_BY_ID(id))
    },
    createAsync(payload: CreateCategoryRequest): Promise<ApiResponse<CreateCategoryResponse>> {
        return productClient.post(API_ENDPOINTS.PRODUCT.CATEGORY_API.CREATE, payload)
    },
    updateAsync(id: number, payload: UpdateCategoryRequest): Promise<ApiResponse<UpdateCategoryResponse>> {
        return productClient.put(API_ENDPOINTS.PRODUCT.CATEGORY_API.UPDATE(id), payload)
    },
    deleteAsync(id: number): Promise<ApiResponse<DeleteCategoryResponse>> {
        return productClient.delete(API_ENDPOINTS.PRODUCT.CATEGORY_API.DELETE(id))
    },
}
```

- [ ] **Step 2: category.service.ts**

```typescript
// src/modules/product/services/category.service.ts
import { categoryApi } from '../api/category.api'
import { categoryMapper } from '../mappers/category.mapper'
import type { CategoryFilterDto, CreateCategoryRequest, UpdateCategoryRequest } from '../models/dtos/category.dto'
import type { CategoryViewModel } from '../models/view-models/category.view-model'
import type { PagedResult } from '@/core/types/pagination.types'

class CategoryService {
    async getPagedAsync(filter: CategoryFilterDto): Promise<PagedResult<CategoryViewModel>> {
        const response = await categoryApi.getPagedAsync(filter)
        return {
            items: categoryMapper.toViewModels(response.Data ?? []),
            pageNumber: response.PageNumber,
            pageSize: response.PageSize,
            totalCount: response.TotalCount,
            totalPages: response.TotalPages,
            hasPreviousPage: response.HasPreviousPage,
            hasNextPage: response.HasNextPage,
        }
    }

    async getByIdAsync(id: number): Promise<CategoryViewModel | null> {
        const response = await categoryApi.getByIdAsync(id)
        return response.Data ? categoryMapper.toViewModel(response.Data) : null
    }

    async createAsync(payload: CreateCategoryRequest): Promise<CategoryViewModel | null> {
        const response = await categoryApi.createAsync(payload)
        return response.Data ? categoryMapper.createResponseToViewModel(response.Data) : null
    }

    async updateAsync(id: number, payload: UpdateCategoryRequest): Promise<Partial<CategoryViewModel> | null> {
        const response = await categoryApi.updateAsync(id, payload)
        return response.Data ? categoryMapper.updateResponseToViewModel(response.Data) : null
    }

    async deleteAsync(id: number): Promise<void> {
        await categoryApi.deleteAsync(id)
    }
}

export const categoryService = new CategoryService()
```

- [ ] **Step 3: category.store.ts**

```typescript
// src/modules/product/stores/category.store.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { categoryService } from '../services/category.service'
import type { CategoryViewModel } from '../models/view-models/category.view-model'
import type { CategoryFilterDto } from '../models/dtos/category.dto'

export const useCategoryStore = defineStore('product-category', () => {
    const items = ref<CategoryViewModel[]>([])
    const total = ref(0)
    const isLoading = ref(false)

    async function fetchPaged(filter: CategoryFilterDto) {
        isLoading.value = true
        try {
            const result = await categoryService.getPagedAsync(filter)
            items.value = result.items
            total.value = result.totalCount
        } finally {
            isLoading.value = false
        }
    }

    function $reset() {
        items.value = []
        total.value = 0
        isLoading.value = false
    }

    return { items, total, isLoading, fetchPaged, $reset }
})
```

- [ ] **Step 4: useCategory.ts**

```typescript
// src/modules/product/composables/useCategory.ts
import { ref } from 'vue'
import { useCategoryStore } from '../stores/category.store'
import { categoryService } from '../services/category.service'
import { useToastNotification } from '@/composables/useToastNotification'
import type { CategoryFilterDto, CreateCategoryRequest, UpdateCategoryRequest } from '../models/dtos/category.dto'

export function useCategory() {
    const store = useCategoryStore()
    const toast = useToastNotification()
    const isSubmitting = ref(false)

    async function loadCategories(filter: CategoryFilterDto) {
        await store.fetchPaged(filter)
    }

    async function createCategory(payload: CreateCategoryRequest): Promise<boolean> {
        isSubmitting.value = true
        try {
            const result = await categoryService.createAsync(payload)
            if (result) {
                toast.success('Category created successfully.')
                return true
            }
            return false
        } catch {
            toast.error('Failed to create category.')
            return false
        } finally {
            isSubmitting.value = false
        }
    }

    async function updateCategory(id: number, payload: UpdateCategoryRequest): Promise<boolean> {
        isSubmitting.value = true
        try {
            const result = await categoryService.updateAsync(id, payload)
            if (result) {
                toast.success('Category updated successfully.')
                return true
            }
            return false
        } catch {
            toast.error('Failed to update category.')
            return false
        } finally {
            isSubmitting.value = false
        }
    }

    async function deleteCategory(id: number): Promise<boolean> {
        try {
            await categoryService.deleteAsync(id)
            toast.success('Category deleted successfully.')
            return true
        } catch {
            toast.error('Failed to delete category.')
            return false
        }
    }

    return {
        items: store.items,
        total: store.total,
        isLoading: store.isLoading,
        isSubmitting,
        loadCategories,
        createCategory,
        updateCategory,
        deleteCategory,
    }
}
```

- [ ] **Step 5: Commit**
```bash
git add NDTCore.FE/src/modules/product/api/ NDTCore.FE/src/modules/product/services/ NDTCore.FE/src/modules/product/stores/ NDTCore.FE/src/modules/product/composables/
git commit -m "feat(product-fe): add Category API, Service, Store, Composable"
```

---

### Task 20: FE Category — Constants + Components + View + Route

**Files:**
- Create: `src/modules/product/constants/category-list.constants.ts`
- Create: `src/modules/product/components/CategoryList.vue`
- Create: `src/modules/product/components/CategoryForm.vue`
- Create: `src/modules/product/views/CategoriesView.vue`
- Modify: `src/router/routes.ts` (thêm route `/admin/product/categories`)

- [ ] **Step 1: category-list.constants.ts**

```typescript
// src/modules/product/constants/category-list.constants.ts
import type { DataTableHeader } from '@/core/types'

export const CATEGORY_TABLE_HEADERS: DataTableHeader[] = [
    { title: 'ID', key: 'id', width: '80px', sortable: true },
    { title: 'Name', key: 'name', sortable: true },
    { title: 'Slug', key: 'slug', sortable: false },
    { title: 'Parent', key: 'parentId', sortable: false },
    { title: 'Order', key: 'displayOrder', width: '80px', sortable: true },
    { title: 'Active', key: 'isActive', width: '100px', sortable: true },
    { title: 'Created', key: 'createdAt', width: '160px', sortable: true },
    { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
]

export const CATEGORY_PAGE_SIZE_OPTIONS = [10, 20, 50] as const
```

- [ ] **Step 2: CategoryList.vue**

```vue
<!-- src/modules/product/components/CategoryList.vue -->
<template>
  <AppDataTable
    :headers="CATEGORY_TABLE_HEADERS"
    :items="items"
    :total-items="total"
    :loading="isLoading"
    v-model:page="pagination.page"
    v-model:items-per-page="pagination.pageSize"
    @update:options="onTableOptions"
  >
    <template #item.isActive="{ item }">
      <AppStatusChip :active="item.isActive" />
    </template>
    <template #item.actions="{ item }">
      <AppRowActions
        @edit="emit('edit', item)"
        @delete="emit('delete', item)"
      />
    </template>
  </AppDataTable>
</template>

<script setup lang="ts">
import { AppDataTable, AppStatusChip, AppRowActions } from '@/components/ui/components'
import { CATEGORY_TABLE_HEADERS } from '../constants/category-list.constants'
import type { CategoryViewModel } from '../models/view-models/category.view-model'

interface Props {
  items: CategoryViewModel[]
  total: number
  isLoading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  edit: [item: CategoryViewModel]
  delete: [item: CategoryViewModel]
}>()

const pagination = defineModel<{ page: number; pageSize: number }>('pagination', {
  default: () => ({ page: 1, pageSize: 20 }),
})

function onTableOptions(options: { page: number; itemsPerPage: number }) {
  pagination.value.page = options.page
  pagination.value.pageSize = options.itemsPerPage
}
</script>
```

- [ ] **Step 3: CategoryForm.vue**

```vue
<!-- src/modules/product/components/CategoryForm.vue -->
<template>
  <v-form ref="formRef" @submit.prevent="onSubmit">
    <v-row>
      <v-col cols="12" md="8">
        <v-text-field
          v-model="form.name"
          label="Name *"
          :rules="[rules.required, rules.maxLength(200)]"
          @input="autoSlug"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field
          v-model="form.slug"
          label="Slug *"
          :rules="[rules.required, rules.slug]"
          hint="lowercase, hyphens only"
          persistent-hint
        />
      </v-col>
      <v-col cols="12">
        <v-textarea
          v-model="form.description"
          label="Description"
          rows="3"
          :rules="[rules.maxLength(1000)]"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-select
          v-model="form.parentId"
          :items="parentOptions"
          item-title="name"
          item-value="id"
          label="Parent Category"
          clearable
        />
      </v-col>
      <v-col cols="12" md="3">
        <v-text-field
          v-model.number="form.displayOrder"
          label="Display Order"
          type="number"
          min="0"
        />
      </v-col>
      <v-col cols="12" md="3">
        <v-switch v-model="form.isActive" label="Active" color="primary" />
      </v-col>
    </v-row>

    <v-card-actions class="px-0 pt-4">
      <v-spacer />
      <v-btn @click="emit('cancel')">Cancel</v-btn>
      <v-btn type="submit" color="primary" :loading="isSubmitting">
        {{ isEditMode ? 'Update' : 'Create' }}
      </v-btn>
    </v-card-actions>
  </v-form>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFormValidation } from '@/composables/useFormValidation'
import type { CategoryFormModel } from '../models/form-models/category.model'
import type { CategoryViewModel } from '../models/view-models/category.view-model'

interface Props {
  modelValue: CategoryFormModel
  isSubmitting: boolean
  parentOptions: Pick<CategoryViewModel, 'id' | 'name'>[]
  editId?: number | null
}

const props = withDefaults(defineProps<Props>(), { editId: null })
const emit = defineEmits<{
  'update:modelValue': [value: CategoryFormModel]
  submit: [form: CategoryFormModel]
  cancel: []
}>()

const form = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const isEditMode = computed(() => props.editId !== null)

const formRef = ref()
const { rules } = useFormValidation()

function autoSlug() {
  if (!isEditMode.value) {
    form.value.slug = form.value.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }
}

async function onSubmit() {
  const { valid } = await formRef.value?.validate()
  if (valid) emit('submit', form.value)
}
</script>
```

- [ ] **Step 4: CategoriesView.vue**

```vue
<!-- src/modules/product/views/CategoriesView.vue -->
<template>
  <v-container fluid>
    <AppBreadcrumb :items="breadcrumbs" />

    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">Categories</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
        New Category
      </v-btn>
    </div>

    <CategoryList
      :items="items"
      :total="total"
      :is-loading="isLoading"
      v-model:pagination="pagination"
      @edit="openEditDialog"
      @delete="confirmDelete"
    />

    <!-- Create / Edit Dialog -->
    <AppDialog v-model="dialogOpen" :title="dialogTitle" max-width="700">
      <CategoryForm
        v-model="formModel"
        :is-submitting="isSubmitting"
        :parent-options="parentOptions"
        :edit-id="editId"
        @submit="onFormSubmit"
        @cancel="dialogOpen = false"
      />
    </AppDialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { AppBreadcrumb, AppDialog } from '@/components/ui/components'
import CategoryList from '../components/CategoryList.vue'
import CategoryForm from '../components/CategoryForm.vue'
import { useCategory } from '../composables/useCategory'
import { createEmptyCategoryForm } from '../models/form-models/category.model'
import type { CategoryViewModel } from '../models/view-models/category.view-model'
import type { CreateCategoryRequest, UpdateCategoryRequest } from '../models/dtos/category.dto'

const breadcrumbs = [
  { title: 'Dashboard', to: '/admin/dashboard' },
  { title: 'Products', disabled: false },
  { title: 'Categories', disabled: true },
]

const { items, total, isLoading, isSubmitting, loadCategories, createCategory, updateCategory, deleteCategory } = useCategory()

const pagination = ref({ page: 1, pageSize: 20 })
const dialogOpen = ref(false)
const editId = ref<number | null>(null)
const formModel = ref(createEmptyCategoryForm())

const dialogTitle = computed(() => (editId.value ? 'Edit Category' : 'New Category'))
const parentOptions = computed(() => items.value.map(c => ({ id: c.id, name: c.name })))

async function fetchData() {
  await loadCategories({
    PageNumber: pagination.value.page,
    PageSize: pagination.value.pageSize,
  })
}

watch(pagination, fetchData, { deep: true })
onMounted(fetchData)

function openCreateDialog() {
  editId.value = null
  formModel.value = createEmptyCategoryForm()
  dialogOpen.value = true
}

function openEditDialog(item: CategoryViewModel) {
  editId.value = item.id
  formModel.value = {
    name: item.name,
    slug: item.slug,
    description: item.description ?? '',
    imageUrl: item.imageUrl ?? '',
    parentId: item.parentId,
    displayOrder: item.displayOrder,
    isActive: item.isActive,
  }
  dialogOpen.value = true
}

async function onFormSubmit(form: typeof formModel.value) {
  if (editId.value) {
    const payload: UpdateCategoryRequest = { ...form, Name: form.name, Slug: form.slug, DisplayOrder: form.displayOrder, IsActive: form.isActive }
    const ok = await updateCategory(editId.value, payload as unknown as UpdateCategoryRequest)
    if (ok) { dialogOpen.value = false; fetchData() }
  } else {
    const payload: CreateCategoryRequest = { Name: form.name, Slug: form.slug, Description: form.description || null, ImageUrl: form.imageUrl || null, ParentId: form.parentId, DisplayOrder: form.displayOrder, IsActive: form.isActive }
    const ok = await createCategory(payload)
    if (ok) { dialogOpen.value = false; fetchData() }
  }
}

async function confirmDelete(item: CategoryViewModel) {
  const ok = await deleteCategory(item.id)
  if (ok) fetchData()
}
</script>
```

- [ ] **Step 5: Thêm route vào router**

Trong `src/router/routes.ts` thêm vào AdminLayout children:
```typescript
{
  path: 'product/categories',
  name: APP_ROUTES.PRODUCT.CATEGORIES,
  component: () => import('@/modules/product/views/CategoriesView.vue'),
  meta: { requiresAuth: true, title: 'Categories', breadcrumb: 'Categories' },
},
```

Và trong `src/core/constants/app-routes.constants.ts`:
```typescript
PRODUCT: {
    CATEGORIES: 'product-categories',
    TAGS: 'product-tags',
},
```

- [ ] **Step 6: Dev server smoke test**
```bash
cd NDTCore.FE && npm run dev
# Mở http://localhost:5173/admin/product/categories
# Kiểm tra: danh sách load, dialog tạo mới mở, form submit gọi đúng API
```

- [ ] **Step 7: Commit**
```bash
git add NDTCore.FE/src/modules/product/ NDTCore.FE/src/router/ NDTCore.FE/src/core/constants/
git commit -m "feat(product-fe): add Category List, Form, View, Route"
```

---

### Task 21: FE Tag — Full Stack (DTOs → View → Route)

**Files:** Mirror Category pattern với các khác biệt sau.

**Key differences so với Category:**

- [ ] **Step 1: tag.dto.ts — thêm fields màu sắc**

```typescript
// src/modules/product/models/dtos/tag.dto.ts
export interface TagDto {
    Id: number
    TenantId: string
    Name: string
    TextColor: string | null   // Hex #RRGGBB
    ColorHex: string | null    // Hex #RRGGBB
    IconUrl: string | null
    DisplayOrder: number
    IsActive: boolean
    CreatedAt: string | null
    UpdatedAt: string | null
    CreatedBy: string | null
    UpdatedBy: string | null
}

export interface TagFilterDto {
    PageNumber: number
    PageSize: number
    Search?: string | null
    IsActive?: boolean | null
}

export interface CreateTagRequest {
    Name: string
    TextColor?: string | null
    ColorHex?: string | null
    IconUrl?: string | null
    DisplayOrder: number
    IsActive: boolean
}

export interface UpdateTagRequest {
    Name: string
    TextColor?: string | null
    ColorHex?: string | null
    IconUrl?: string | null
    DisplayOrder: number
    IsActive: boolean
}

export interface CreateTagResponse { Id: number; Name: string; ColorHex: string | null; IsActive: boolean; CreatedAt: string | null }
export interface UpdateTagResponse { Id: number; Name: string; ColorHex: string | null; IsActive: boolean; UpdatedAt: string | null }
export interface DeleteTagResponse { Id: number; Name: string; DeletedAt: string | null }
```

- [ ] **Step 2: TagForm.vue — thêm color picker fields**

Trong form thêm 2 fields `TextColor` và `ColorHex`:
```vue
<v-col cols="12" md="4">
  <v-text-field
    v-model="form.textColor"
    label="Text Color (Hex)"
    placeholder="#FFFFFF"
    :rules="[rules.hex]"
  >
    <template #append-inner>
      <v-icon :color="form.textColor || 'grey'">mdi-circle</v-icon>
    </template>
  </v-text-field>
</v-col>
<v-col cols="12" md="4">
  <v-text-field
    v-model="form.colorHex"
    label="Background Color (Hex)"
    placeholder="#FF6B35"
    :rules="[rules.hex]"
  >
    <template #append-inner>
      <v-icon :color="form.colorHex || 'grey'">mdi-circle</v-icon>
    </template>
  </v-text-field>
</v-col>
```

Rule hex validator trong `useFormValidation` (hoặc add inline):
```typescript
const hexRule = (v: string | null) =>
    !v || /^#[0-9A-Fa-f]{6}$/.test(v) || 'Must be a valid hex color (#RRGGBB)'
```

- [ ] **Step 3: tag-list.constants.ts**

```typescript
export const TAG_TABLE_HEADERS: DataTableHeader[] = [
    { title: 'ID', key: 'id', width: '80px' },
    { title: 'Name', key: 'name' },
    { title: 'Color', key: 'colorHex', width: '100px' },
    { title: 'Order', key: 'displayOrder', width: '80px' },
    { title: 'Active', key: 'isActive', width: '100px' },
    { title: 'Actions', key: 'actions', align: 'end' },
]
```

- [ ] **Step 4: TagsView.vue, TagList.vue, TagForm.vue, tag.api.ts, tag.service.ts, tag.store.ts, useTag.ts, tag.mapper.ts, tag.view-model.ts**

Tạo các file này theo đúng pattern của Category, chỉ thay `Category` → `Tag`, thêm fields `textColor`, `colorHex`, `iconUrl`. Không có `parentId`. Route path: `/admin/product/tags`.

- [ ] **Step 5: Dev server smoke test**
```bash
npm run dev
# Test /admin/product/tags
```

- [ ] **Step 6: Commit**
```bash
git add NDTCore.FE/src/modules/product/
git commit -m "feat(product-fe): add Tag DTOs, API, Service, Store, Components, View, Route"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:**
  - Category CRUD (BE + FE): ✅ Tasks 1–14, 17–20
  - Tag CRUD (BE + FE): ✅ Tasks 15–16, 21
  - EF Configurations: ✅ Tasks 2–3
  - DbContext + DI: ✅ Tasks 1, 4, 13
  - Migration: ✅ Task 16 Step 5
  - FE API client: ✅ Task 17
  - FE Routes: ✅ Tasks 20, 21

- [ ] **Gaps identified:**
  - Swagger/OpenAPI documentation cho controllers → thêm XML comments sau khi implement
  - Permissions `ProductCategory.*` và `ProductTag.*` cần seed vào `AppPermission` table → làm ở DB seed task
  - `ProductImage`, `OptionGroup`, `Option`, `Product`, Store Overrides → Plans B–E

- [ ] **Type consistency:**
  - `GetCategoryResponse` dùng xuyên suốt Tasks 8, 9, 10, 14 ✅
  - `CategoryViewModel` dùng xuyên suốt Tasks 18, 19, 20 ✅
  - `IProductUnitOfWork` khai báo Tasks 5, 7, 10, 11, 12 ✅

---

## Plans B–E — Scope Outline

### Plan B: OptionGroup + Option
- BE: `OptionGroupConfiguration`, `OptionConfiguration`, `IOptionGroupRepository`, `IOptionRepository`, CQRS (5 features × 2 entities), Controllers
- FE: DTOs + API + components + views cho OptionGroup list/form, Option list/form (nested trong OptionGroup detail)
- Dependency: Không có

### Plan C: Product Core + ProductImage
- BE: `ProductConfiguration`, `ProductImageConfiguration`, `IProductRepository`, Product CQRS (CRUD + GetProductsByCategory + GetFeaturedProducts), ProductImage (upload/delete append-only), Controller
- FE: Product list/form (với category picker, tag chips), ProductImage manager component
- Dependency: Plan A (Category + Tag)

### Plan D: Product Relations (ProductTag + ProductOptionGroup + ProductOptionConfig)
- BE: 3 junction configurations, Commands (AssignTagToProduct, RemoveTagFromProduct, AssignOptionGroupToProduct, UpdateProductOptionGroup, RemoveOptionGroupFromProduct, UpsertProductOptionConfig, RemoveProductOptionConfig)
- FE: Tags tab trong ProductDetail, OptionGroups tab với constraint editor, Option config editor per-product
- Dependency: Plan A + B + C

### Plan E: Store Overrides
- BE: 4 configurations (ProductStore, ProductStorePrice, OptionStoreAvailability, OptionStorePrice), UpsertXxx Commands (idempotent), GetStoreMenuQuery (full menu build với fallback chain)
- FE: StoreMenu tab trong Store detail — toggle product availability, override price per store
- Dependency: Plan C + B
