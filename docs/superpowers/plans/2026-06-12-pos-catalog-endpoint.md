# POS Catalog Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `GET /api/pos/store/{storeId}/catalog` trả về toàn bộ categories + products (kèm resolved pricing và option groups) cho màn hình POS.

**Architecture:** Handler `GetPosCatalogQuery` nằm trong `NDTCore.Product.Application`; repository `PosCatalogRepository` query trực tiếp `NdtProductDbContext` với multi-query approach (tránh cartesian explosion); controller `PosController` route `api/pos` trong `NDTCore.API`. Tenant filter và soft-delete filter được tự động apply bởi DbContext.

**Tech Stack:** .NET 8, EF Core (AsNoTracking), MediatR (ISender), ASP.NET Core `[Authorize(Roles=...)]`

---

## File Map

| Action | File |
|---|---|
| Create | `NDTCore.Product.Contracts/ViewModels/Pos/PosCatalogResponse.cs` |
| Create | `NDTCore.Product.Contracts/Interfaces/Repositories/IPosCatalogRepository.cs` |
| Create | `NDTCore.Product.Application/Features/Pos/GetPosCatalog/GetPosCatalogQuery.cs` |
| Create | `NDTCore.Product.Application/Features/Pos/GetPosCatalog/GetPosCatalogQueryHandler.cs` |
| Create | `NDTCore.Product.Infrastructure/Persistence/Repositories/PosCatalogRepository.cs` |
| Modify | `NDTCore.Product.Infrastructure/ServiceCollectionExtensions.cs` |
| Create | `NDTCore.API/Controllers/Modules/Pos/PosController.cs` |

Exact base paths (all under `NDTCore.BE/src/`):
- `NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/`
- `NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/`
- `NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/`
- `NDTCore.API/`

---

## Task 1: Response DTOs (Contracts layer)

**Files:**
- Create: `NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/ViewModels/Pos/PosCatalogResponse.cs`

- [ ] **Step 1: Create the file**

```csharp
namespace NDTCore.Product.Contracts.ViewModels.Pos;

/// <summary>
/// VN: Phản hồi catalog POS — danh mục và sản phẩm đã resolve giá theo cửa hàng. <br />
/// EN: POS catalog response — categories and products with store-resolved pricing.
/// </summary>
public sealed record PosCatalogResponse
{
    /// <summary>
    /// VN: Danh sách danh mục (cấu trúc cây). <br />
    /// EN: Category list (tree structure).
    /// </summary>
    public List<PosCategoryResult> Categories { get; init; } = [];

    /// <summary>
    /// VN: Danh sách sản phẩm hiển thị tại cửa hàng. <br />
    /// EN: List of products visible at the store.
    /// </summary>
    public List<PosProductResult> Products { get; init; } = [];
}

/// <summary>
/// VN: Danh mục trong catalog POS, kèm số lượng sản phẩm và danh mục con. <br />
/// EN: POS catalog category with product count and child categories.
/// </summary>
public sealed record PosCategoryResult
{
    /// <summary>VN: Định danh danh mục. EN: Category identifier.</summary>
    public int Id { get; init; }

    /// <summary>VN: Định danh danh mục cha; null nếu là gốc. EN: Parent category id; null if root.</summary>
    public int? ParentId { get; init; }

    /// <summary>VN: Tên danh mục. EN: Category name.</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>VN: Số sản phẩm visible thuộc danh mục này. EN: Count of visible products in this category.</summary>
    public int ProductCount { get; init; }

    /// <summary>VN: Danh mục con. EN: Child categories.</summary>
    public List<PosCategoryResult> Children { get; init; } = [];
}

/// <summary>
/// VN: Sản phẩm trong catalog POS — giá và sẵn có đã được resolve theo cửa hàng. <br />
/// EN: POS product — price and availability resolved per store.
/// </summary>
public sealed record PosProductResult
{
    /// <summary>VN: Định danh sản phẩm. EN: Product identifier.</summary>
    public int Id { get; init; }

    /// <summary>VN: Định danh danh mục; null nếu chưa phân loại. EN: Category id; null if uncategorized.</summary>
    public int? CategoryId { get; init; }

    /// <summary>VN: Tên sản phẩm. EN: Product name.</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>VN: Mô tả ngắn. EN: Short description.</summary>
    public string? ShortDescription { get; init; }

    /// <summary>
    /// VN: Giá đã resolve — ưu tiên giá cửa hàng, fallback về giá gốc. <br />
    /// EN: Resolved price — store price takes precedence, falls back to base price.
    /// </summary>
    public decimal ResolvedPrice { get; init; }

    /// <summary>VN: Sản phẩm có thể bán tại cửa hàng này. EN: Whether the product is available at this store.</summary>
    public bool IsAvailable { get; init; }

    /// <summary>VN: Thứ tự hiển thị. EN: Display order.</summary>
    public int DisplayOrder { get; init; }

    /// <summary>VN: URL ảnh chính. EN: Main image URL.</summary>
    public string? ImageUrl { get; init; }

    /// <summary>VN: Nhãn gắn với sản phẩm. EN: Tags applied to the product.</summary>
    public List<PosTagResult> Tags { get; init; } = [];

    /// <summary>VN: Nhóm option của sản phẩm. EN: Option groups for the product.</summary>
    public List<PosOptionGroupResult> OptionGroups { get; init; } = [];
}

/// <summary>
/// VN: Nhóm option trong catalog POS. <br />
/// EN: Option group in the POS catalog.
/// </summary>
public sealed record PosOptionGroupResult
{
    /// <summary>VN: Định danh nhóm option. EN: Option group identifier.</summary>
    public int GroupId { get; init; }

    /// <summary>VN: Tên nhóm option. EN: Option group name.</summary>
    public string GroupName { get; init; } = string.Empty;

    /// <summary>VN: Kiểu UI — SingleSelect hoặc MultiSelect. EN: UI type — SingleSelect or MultiSelect.</summary>
    public string UiType { get; init; } = string.Empty;

    /// <summary>VN: Bắt buộc chọn. EN: Whether selection is required.</summary>
    public bool IsRequired { get; init; }

    /// <summary>VN: Số lựa chọn tối thiểu. EN: Minimum number of selections.</summary>
    public int MinSelect { get; init; }

    /// <summary>VN: Số lựa chọn tối đa. EN: Maximum number of selections.</summary>
    public int MaxSelect { get; init; }

    /// <summary>VN: Thứ tự hiển thị. EN: Display order.</summary>
    public int DisplayOrder { get; init; }

    /// <summary>VN: Danh sách lựa chọn. EN: List of options.</summary>
    public List<PosOptionResult> Options { get; init; } = [];
}

/// <summary>
/// VN: Lựa chọn trong nhóm option — giá đã resolve theo 3 tầng. <br />
/// EN: Option in a group — price resolved across 3 tiers.
/// </summary>
public sealed record PosOptionResult
{
    /// <summary>VN: Định danh lựa chọn. EN: Option identifier.</summary>
    public int Id { get; init; }

    /// <summary>VN: Tên lựa chọn. EN: Option name.</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// VN: Giá đã resolve — ưu tiên: giá cửa hàng → giá config theo sản phẩm → giá mặc định. <br />
    /// EN: Resolved price — priority: store price → per-product config price → default price.
    /// </summary>
    public decimal ResolvedPrice { get; init; }

    /// <summary>VN: Lựa chọn mặc định cho sản phẩm này. EN: Whether this is the default option for the product.</summary>
    public bool IsDefault { get; init; }

    /// <summary>VN: Lựa chọn khả dụng tại cửa hàng này. EN: Whether the option is available at this store.</summary>
    public bool IsAvailable { get; init; }
}

/// <summary>
/// VN: Nhãn sản phẩm trong catalog POS. <br />
/// EN: Product tag in the POS catalog.
/// </summary>
public sealed record PosTagResult
{
    /// <summary>VN: Định danh nhãn. EN: Tag identifier.</summary>
    public int Id { get; init; }

    /// <summary>VN: Tên nhãn. EN: Tag name.</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>VN: Màu nền hex. EN: Background color hex.</summary>
    public string? ColorHex { get; init; }

    /// <summary>VN: Màu chữ. EN: Text color.</summary>
    public string? TextColor { get; init; }
}
```

- [ ] **Step 2: Build để kiểm tra**

```bash
cd NDTCore.BE/src && dotnet build NDTCore.sln
```

Expected: build thành công, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/ViewModels/Pos/PosCatalogResponse.cs
git commit -m "feat(product): add POS catalog response DTOs"
```

---

## Task 2: Repository Interface (Contracts layer)

**Files:**
- Create: `NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/Interfaces/Repositories/IPosCatalogRepository.cs`

- [ ] **Step 1: Create the file**

```csharp
using NDTCore.Product.Contracts.ViewModels.Pos;

namespace NDTCore.Product.Contracts.Interfaces.Repositories;

/// <summary>
/// VN: Repository đọc catalog sản phẩm cho màn hình POS. Chỉ đọc — không có write operations. <br />
/// EN: Read-only repository for loading the POS product catalog.
/// </summary>
public interface IPosCatalogRepository
{
    /// <summary>
    /// VN: Tải toàn bộ catalog sản phẩm cho một cửa hàng — bao gồm danh mục, sản phẩm, option groups và giá đã resolve. <br />
    /// EN: Loads the full product catalog for a store — including categories, products, option groups, and resolved pricing.
    /// </summary>
    /// <param name="storeId">VN: Định danh cửa hàng. EN: Store identifier.</param>
    /// <param name="cancellationToken">VN: Token huỷ thao tác. EN: Cancellation token.</param>
    /// <returns>
    /// VN: PosCatalogResponse chứa danh mục (cây) và sản phẩm (flat list). <br />
    /// EN: PosCatalogResponse containing categories (tree) and products (flat list).
    /// </returns>
    Task<PosCatalogResponse> GetCatalogAsync(int storeId, CancellationToken cancellationToken = default);
}
```

- [ ] **Step 2: Build**

```bash
cd NDTCore.BE/src && dotnet build NDTCore.sln
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/Interfaces/Repositories/IPosCatalogRepository.cs
git commit -m "feat(product): add IPosCatalogRepository interface"
```

---

## Task 3: Query + Handler (Application layer)

**Files:**
- Create: `NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/Pos/GetPosCatalog/GetPosCatalogQuery.cs`
- Create: `NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/Pos/GetPosCatalog/GetPosCatalogQueryHandler.cs`

- [ ] **Step 1: Tạo thư mục và query record**

```csharp
// GetPosCatalogQuery.cs
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.Product.Contracts.ViewModels.Pos;

namespace NDTCore.Product.Application.Features.Pos.GetPosCatalog;

/// <summary>
/// VN: Query lấy catalog sản phẩm cho màn hình POS của một cửa hàng cụ thể. <br />
/// EN: Query to load the POS product catalog for a specific store.
/// </summary>
/// <param name="StoreId">VN: Định danh cửa hàng. EN: Store identifier.</param>
public sealed record GetPosCatalogQuery(int StoreId) : IQuery<PosCatalogResponse>;
```

- [ ] **Step 2: Tạo handler**

```csharp
// GetPosCatalogQueryHandler.cs
using Microsoft.Extensions.Logging;
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.Pos;

namespace NDTCore.Product.Application.Features.Pos.GetPosCatalog;

/// <summary>
/// VN: Xử lý query lấy catalog POS — uỷ thác hoàn toàn cho repository. <br />
/// EN: Handles the POS catalog query — fully delegates to the repository.
/// </summary>
public sealed class GetPosCatalogQueryHandler : IQueryHandler<GetPosCatalogQuery, PosCatalogResponse>
{
    private readonly ILogger<GetPosCatalogQueryHandler> _logger;
    private readonly IPosCatalogRepository _posCatalogRepository;

    /// <summary>
    /// VN: Khởi tạo handler với logger và repository. <br />
    /// EN: Initializes the handler with logger and repository.
    /// </summary>
    public GetPosCatalogQueryHandler(
        ILogger<GetPosCatalogQueryHandler> logger,
        IPosCatalogRepository posCatalogRepository)
    {
        _logger = logger;
        _posCatalogRepository = posCatalogRepository;
    }

    /// <inheritdoc/>
    public async Task<Result<PosCatalogResponse>> Handle(
        GetPosCatalogQuery request,
        CancellationToken cancellationToken)
    {
        var catalog = await _posCatalogRepository.GetCatalogAsync(request.StoreId, cancellationToken);

        _logger.LogInformation(
            "[{ClassName}.{FunctionName}] POS catalog loaded: StoreId={StoreId}, Products={ProductCount}, Categories={CategoryCount}",
            nameof(GetPosCatalogQueryHandler),
            nameof(Handle),
            request.StoreId,
            catalog.Products.Count,
            catalog.Categories.Count);

        return Result<PosCatalogResponse>.Success(catalog);
    }
}
```

- [ ] **Step 3: Build**

```bash
cd NDTCore.BE/src && dotnet build NDTCore.sln
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/Pos/GetPosCatalog/
git commit -m "feat(product): add GetPosCatalogQuery and handler"
```

---

## Task 4: Repository Implementation (Infrastructure layer)

**Files:**
- Create: `NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/Persistence/Repositories/PosCatalogRepository.cs`

- [ ] **Step 1: Tạo repository — phần khai báo + GetCatalogAsync chính**

```csharp
using Microsoft.EntityFrameworkCore;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.Pos;
using NDTCore.Product.Domain.Entities;
using NDTCore.Product.Infrastructure.Persistence.Context;
using ProductEntity = NDTCore.Product.Domain.Entities.Product;

namespace NDTCore.Product.Infrastructure.Persistence.Repositories;

/// <summary>
/// VN: Repository đọc catalog sản phẩm cho POS — dùng AsNoTracking, không ghi. <br />
/// EN: Read-only POS catalog repository — uses AsNoTracking, no writes.
/// </summary>
public sealed class PosCatalogRepository : IPosCatalogRepository
{
    private readonly NdtProductDbContext _context;

    /// <summary>
    /// VN: Khởi tạo repository với DbContext. <br />
    /// EN: Initializes the repository with DbContext.
    /// </summary>
    public PosCatalogRepository(NdtProductDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc/>
    public async Task<PosCatalogResponse> GetCatalogAsync(int storeId, CancellationToken cancellationToken = default)
    {
        // 1. Sản phẩm visible: IsActive=true AND không bị ẩn tại store này
        var products = await _context.Products
            .AsNoTracking()
            .Where(p => p.IsActive &&
                        !p.ProductStores.Any(ps => ps.StoreId == storeId && !ps.IsAvailable))
            .Include(p => p.Category)
            .Include(p => p.Images.Where(i => i.IsMain))
            .Include(p => p.ProductTags).ThenInclude(pt => pt.Tag)
            .Include(p => p.ProductOptionGroups)
            .Include(p => p.ProductOptionConfigs)
            .OrderBy(p => p.DisplayOrder)
            .ThenBy(p => p.Name)
            .ToListAsync(cancellationToken);

        if (products.Count == 0)
            return new PosCatalogResponse();

        var productIds = products.Select(p => p.Id).ToList();

        // 2. Load option groups với options (tách query tránh cartesian explosion)
        var groupIds = products
            .SelectMany(p => p.ProductOptionGroups.Select(pog => pog.GroupId))
            .Distinct()
            .ToList();

        var optionGroupMap = groupIds.Count > 0
            ? (await _context.OptionGroups
                .AsNoTracking()
                .Where(og => og.IsActive && groupIds.Contains(og.Id))
                .Include(og => og.Options.Where(o => o.IsActive).OrderBy(o => o.DisplayOrder))
                .ToListAsync(cancellationToken))
                .ToDictionary(og => og.Id)
            : new Dictionary<int, OptionGroup>();

        var optionIds = optionGroupMap.Values
            .SelectMany(og => og.Options.Select(o => o.Id))
            .Distinct()
            .ToList();

        // 3. Store-level overrides
        var productStorePriceMap = (await _context.ProductStorePrices
            .AsNoTracking()
            .Where(psp => psp.StoreId == storeId && productIds.Contains(psp.ProductId))
            .ToListAsync(cancellationToken))
            .ToDictionary(psp => psp.ProductId, psp => psp.Price);

        var optionStorePriceMap = optionIds.Count > 0
            ? (await _context.OptionStorePrices
                .AsNoTracking()
                .Where(osp => osp.StoreId == storeId && optionIds.Contains(osp.OptionId))
                .ToListAsync(cancellationToken))
                .ToDictionary(osp => osp.OptionId, osp => osp.Price)
            : new Dictionary<int, decimal>();

        var optionStoreAvailabilityMap = optionIds.Count > 0
            ? (await _context.OptionStoreAvailabilities
                .AsNoTracking()
                .Where(osa => osa.StoreId == storeId && optionIds.Contains(osa.OptionId))
                .ToListAsync(cancellationToken))
                .ToDictionary(osa => osa.OptionId, osa => osa.IsAvailable)
            : new Dictionary<int, bool>();

        // 4. Map products
        var productResults = products
            .Select(p => MapProduct(p, productStorePriceMap, optionGroupMap, optionStorePriceMap, optionStoreAvailabilityMap))
            .ToList();

        // 5. Category tree — chỉ load category có product visible
        var visibleCategoryIds = products
            .Where(p => p.CategoryId.HasValue)
            .Select(p => p.CategoryId!.Value)
            .Distinct()
            .ToHashSet();

        var categories = visibleCategoryIds.Count > 0
            ? await _context.Categories
                .AsNoTracking()
                .Where(c => c.IsActive && visibleCategoryIds.Contains(c.Id))
                .OrderBy(c => c.DisplayOrder)
                .ThenBy(c => c.Name)
                .ToListAsync(cancellationToken)
            : [];

        var productCountByCategory = products
            .Where(p => p.CategoryId.HasValue)
            .GroupBy(p => p.CategoryId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        return new PosCatalogResponse
        {
            Products = productResults,
            Categories = BuildCategoryTree(categories, productCountByCategory),
        };
    }

    /// <summary>
    /// VN: Map entity sản phẩm sang PosProductResult với giá và option đã resolve. <br />
    /// EN: Maps a product entity to PosProductResult with resolved price and options.
    /// </summary>
    private static PosProductResult MapProduct(
        ProductEntity p,
        Dictionary<int, decimal> productStorePriceMap,
        Dictionary<int, OptionGroup> optionGroupMap,
        Dictionary<int, decimal> optionStorePriceMap,
        Dictionary<int, bool> optionStoreAvailabilityMap)
    {
        var resolvedPrice = productStorePriceMap.GetValueOrDefault(p.Id, p.BasePrice);

        var optionGroups = p.ProductOptionGroups
            .Where(pog => optionGroupMap.ContainsKey(pog.GroupId))
            .OrderBy(pog => pog.DisplayOrder)
            .Select(pog => MapOptionGroup(pog, p.ProductOptionConfigs, optionGroupMap[pog.GroupId], optionStorePriceMap, optionStoreAvailabilityMap))
            .ToList();

        var tags = p.ProductTags
            .Where(pt => pt.Tag is not null)
            .Select(pt => new PosTagResult
            {
                Id       = pt.Tag!.Id,
                Name     = pt.Tag.Name,
                ColorHex = pt.Tag.ColorHex,
                TextColor = pt.Tag.TextColor,
            })
            .ToList();

        return new PosProductResult
        {
            Id               = p.Id,
            CategoryId       = p.CategoryId,
            Name             = p.Name,
            ShortDescription = p.ShortDescription,
            ResolvedPrice    = resolvedPrice,
            IsAvailable      = true,
            DisplayOrder     = p.DisplayOrder,
            ImageUrl         = p.Images.FirstOrDefault()?.Url,
            Tags             = tags,
            OptionGroups     = optionGroups,
        };
    }

    /// <summary>
    /// VN: Map một ProductOptionGroup sang PosOptionGroupResult với danh sách options đã resolve. <br />
    /// EN: Maps a ProductOptionGroup to PosOptionGroupResult with resolved options.
    /// </summary>
    private static PosOptionGroupResult MapOptionGroup(
        ProductOptionGroup pog,
        ICollection<ProductOptionConfig> configs,
        OptionGroup group,
        Dictionary<int, decimal> optionStorePriceMap,
        Dictionary<int, bool> optionStoreAvailabilityMap)
    {
        var options = group.Options.Select(o =>
        {
            // 3-tier price resolution
            decimal resolvedPrice;
            if (optionStorePriceMap.TryGetValue(o.Id, out var storePrice))
                resolvedPrice = storePrice;
            else
            {
                var config = configs.FirstOrDefault(c => c.OptionId == o.Id);
                resolvedPrice = config?.CustomPrice ?? o.DefaultPrice;
            }

            var isAvailable = optionStoreAvailabilityMap.TryGetValue(o.Id, out var storeAvail)
                ? storeAvail
                : o.IsActive;

            var isDefault = configs.Any(c => c.OptionId == o.Id && c.IsDefault);

            return new PosOptionResult
            {
                Id            = o.Id,
                Name          = o.Name,
                ResolvedPrice = resolvedPrice,
                IsDefault     = isDefault,
                IsAvailable   = isAvailable,
            };
        }).ToList();

        return new PosOptionGroupResult
        {
            GroupId     = group.Id,
            GroupName   = group.Name,
            UiType      = group.UiType,
            IsRequired  = pog.IsRequired,
            MinSelect   = pog.MinSelect,
            MaxSelect   = pog.MaxSelect,
            DisplayOrder = pog.DisplayOrder,
            Options     = options,
        };
    }

    /// <summary>
    /// VN: Xây dựng cây danh mục từ danh sách phẳng. <br />
    /// EN: Builds a category tree from a flat list.
    /// </summary>
    private static List<PosCategoryResult> BuildCategoryTree(
        List<Category> categories,
        Dictionary<int, int> productCountByCategory)
    {
        var allIds = categories.Select(c => c.Id).ToHashSet();
        return categories
            .Where(c => c.ParentId == null || !allIds.Contains(c.ParentId.Value))
            .Select(c => MapCategory(c, categories, productCountByCategory))
            .ToList();
    }

    /// <summary>
    /// VN: Map entity Category sang PosCategoryResult, đệ quy cho danh mục con. <br />
    /// EN: Maps a Category entity to PosCategoryResult, recursively for children.
    /// </summary>
    private static PosCategoryResult MapCategory(
        Category c,
        List<Category> all,
        Dictionary<int, int> productCountByCategory)
    {
        var children = all
            .Where(x => x.ParentId == c.Id)
            .Select(x => MapCategory(x, all, productCountByCategory))
            .ToList();

        return new PosCategoryResult
        {
            Id           = c.Id,
            ParentId     = c.ParentId,
            Name         = c.Name,
            ProductCount = productCountByCategory.GetValueOrDefault(c.Id, 0),
            Children     = children,
        };
    }
}
```

- [ ] **Step 2: Build**

```bash
cd NDTCore.BE/src && dotnet build NDTCore.sln
```

Expected: 0 errors. Nếu có lỗi compile liên quan đến navigation properties (e.g. `pog.OptionGroup` không tồn tại), xem Task 4 — Troubleshooting bên dưới.

> **Troubleshooting navigation property:** Nếu `ProductOptionGroup` không có property `OptionGroup`, thêm vào entity:
> ```csharp
> public OptionGroup OptionGroup { get; set; } = null!;
> ```
> và cấu hình EF trong `ProductOptionGroupConfiguration`:
> ```csharp
> builder.HasOne(x => x.OptionGroup).WithMany(og => og.ProductOptionGroups).HasForeignKey(x => x.GroupId);
> ```

- [ ] **Step 3: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/Persistence/Repositories/PosCatalogRepository.cs
git commit -m "feat(product): implement PosCatalogRepository with multi-query EF strategy"
```

---

## Task 5: DI Registration

**Files:**
- Modify: `NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/ServiceCollectionExtensions.cs`

- [ ] **Step 1: Thêm dòng đăng ký `IPosCatalogRepository`**

Mở file `ServiceCollectionExtensions.cs`. Trong phần `services.AddScoped<I...Repository, ...Repository>()`, thêm dòng sau ngay sau `IProductStorePriceRepository`:

```csharp
services.AddScoped<IPosCatalogRepository, PosCatalogRepository>();
```

Và thêm using ở đầu file nếu chưa có:
```csharp
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Infrastructure.Persistence.Repositories;
```

- [ ] **Step 2: Build**

```bash
cd NDTCore.BE/src && dotnet build NDTCore.sln
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Infrastructure/ServiceCollectionExtensions.cs
git commit -m "feat(product): register IPosCatalogRepository in DI"
```

---

## Task 6: POS Controller (NDTCore.API)

**Files:**
- Create: `NDTCore.API/Controllers/Modules/Pos/PosController.cs`

- [ ] **Step 1: Đọc ApiControllerBase để xác nhận pattern inject ISender/IMediator**

Đọc file `NDTCore.API/Controllers/Base/ApiControllerBase.cs` để xác nhận cách inject MediatR (ISender hay IMediator). Nếu `ApiControllerBase` có sẵn `_sender` hay `_mediator` protected field thì dùng lại; nếu không thì inject `ISender` trong constructor.

- [ ] **Step 2: Tạo controller**

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NDTCore.API.Controllers.Base;
using NDTCore.Product.Application.Features.Pos.GetPosCatalog;

namespace NDTCore.API.Controllers.Modules.Pos;

/// <summary>
/// VN: Controller cho các endpoint POS — phục vụ màn hình thu ngân. <br />
/// EN: Controller for POS endpoints — serves the cashier screen.
/// </summary>
[Route("api/pos")]
[Authorize(Roles = "Cashier,StoreStaff,FranchiseeOwner,Admin")]
public sealed class PosController : ApiControllerBase
{
    private readonly ISender _sender;

    /// <summary>
    /// VN: Khởi tạo controller với MediatR sender. <br />
    /// EN: Initializes the controller with MediatR sender.
    /// </summary>
    public PosController(ISender sender)
    {
        _sender = sender;
    }

    /// <summary>
    /// VN: Lấy toàn bộ catalog sản phẩm cho màn hình POS của một cửa hàng. <br />
    /// EN: Gets the full product catalog for a store's POS screen.
    /// </summary>
    /// <param name="storeId">VN: Định danh cửa hàng. EN: Store identifier.</param>
    /// <param name="cancellationToken"><inheritdoc/></param>
    [HttpGet("store/{storeId:int}/catalog")]
    public async Task<IActionResult> GetCatalog(
        [FromRoute] int storeId,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetPosCatalogQuery(storeId), cancellationToken);
        return StatusResult(result);
    }
}
```

> **Note:** Nếu `ApiControllerBase` đã inject ISender/IMediator qua base constructor (không phải trường hợp phổ biến), bỏ constructor injection trong `PosController` và dùng field protected từ base class.

- [ ] **Step 3: Build lần cuối**

```bash
cd NDTCore.BE/src && dotnet build NDTCore.sln
```

Expected: 0 errors, 0 warnings (ngoài nullable warnings đã có sẵn trong project).

- [ ] **Step 4: Commit**

```bash
git add NDTCore.BE/src/NDTCore.API/Controllers/Modules/Pos/PosController.cs
git commit -m "feat(api): add PosController with GET /api/pos/store/{storeId}/catalog"
```

---

## Task 7: Smoke Test

- [ ] **Step 1: Chạy API**

```bash
cd NDTCore.BE/src/NDTCore.API && dotnet run
```

- [ ] **Step 2: Gọi endpoint với token hợp lệ**

Lấy JWT token của user có role `Cashier` hoặc `Admin`, sau đó:

```bash
curl -H "Authorization: Bearer {token}" \
     https://localhost:44392/api/pos/store/1/catalog
```

Expected response:
```json
{
  "data": {
    "categories": [...],
    "products": [...]
  },
  "success": true
}
```

- [ ] **Step 3: Kiểm tra FE**

```bash
cd NDTCore.FE && npm run dev
```

Mở màn hình POS → sản phẩm và danh mục hiển thị đúng.

- [ ] **Step 4: Commit cuối (nếu có fix nhỏ)**

```bash
git add -p
git commit -m "fix(pos): ..."
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Response shape → Task 1. IPosCatalogRepository → Task 2. Handler → Task 3. Repository EF query → Task 4. DI → Task 5. Controller + auth → Task 6.
- [x] **Pricing 3-tier:** `OptionStorePrice.Price ?? ProductOptionConfig.CustomPrice ?? Option.DefaultPrice` — implemented in `MapOptionGroup`.
- [x] **Availability AND logic:** `Product.IsActive && !(ProductStore.IsAvailable == false)` — implemented in LINQ WHERE clause.
- [x] **Image IsMain:** `p.Images.Where(i => i.IsMain)` — implemented in Include filter.
- [x] **Auth roles:** `Cashier,StoreStaff,FranchiseeOwner,Admin` — trên `PosController`.
- [x] **XML docs:** Tất cả class, interface, method, property đều có bilingual XML doc.
- [x] **Tenant filter:** Auto-applied bởi `NdtProductDbContext` — không cần filter thủ công.
- [x] **AsNoTracking:** Tất cả queries trong `PosCatalogRepository` đều dùng `AsNoTracking()`.
- [x] **Type names consistent:** `ProductOptionConfig.CustomPrice`, `Option.DefaultPrice` — dùng nhất quán từ Task 1 đến Task 4.
