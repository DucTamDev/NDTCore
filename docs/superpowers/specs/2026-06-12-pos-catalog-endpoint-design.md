# POS Catalog Endpoint — Design Spec

**Date:** 2026-06-12  
**Status:** Approved  

---

## Problem

FE POS module gọi `GET /api/pos/store/{storeId}/catalog` nhưng BE chưa implement endpoint này. Mọi call trả về 404, khiến POS không hiển thị được sản phẩm.

---

## Decision

Thêm endpoint mới vào **Product module** (không tạo module POS riêng trên BE). Handler nằm trong `NDTCore.Product.Application`, controller trong `NDTCore.API`. FE không thay đổi.

---

## Endpoint

```
GET /api/pos/store/{storeId}/catalog
Authorization: Bearer {token}
Roles:         Cashier | StoreStaff | FranchiseeOwner | Admin
```

**Response:** `PosCatalogResponse` — khớp với `PosCatalogDto` FE đang expect.

---

## Architecture

### Luồng request

```
FE → GET /api/pos/store/{storeId}/catalog
   → PosController  (NDTCore.API/Controllers/Modules/Pos/)
   → GetPosCatalogQuery { StoreId }  (MediatR)
   → GetPosCatalogQueryHandler  (NDTCore.Product.Application/Features/Pos/GetPosCatalog/)
   → IPosCatalogRepository  (NDTCore.Product.Contracts/Interfaces/Repositories/)
   → PosCatalogRepository  (NDTCore.Product.Infrastructure/Persistence/Repositories/)
   → NdtProductDbContext
   → PosCatalogResponse → FE
```

### Files mới

```
NDTCore.Product.Application/
└── Features/Pos/GetPosCatalog/
    ├── GetPosCatalogQuery.cs           — record: StoreId (int)
    ├── GetPosCatalogQueryHandler.cs    — handler chính
    └── PosCatalogResponse.cs           — response DTOs (PosCatalogResponse, PosProductResult, PosCategoryResult, PosOptionGroupResult, PosOptionResult, PosTagResult)

NDTCore.Product.Contracts/
└── Interfaces/Repositories/
    └── IPosCatalogRepository.cs        — GetCatalogAsync(storeId, tenantId, cancellationToken)

NDTCore.Product.Infrastructure/
└── Persistence/Repositories/
    └── PosCatalogRepository.cs         — EF implementation, AsNoTracking

NDTCore.API/
└── Controllers/Modules/Pos/
    └── PosController.cs                — [Route("api/pos")], [Authorize(Roles = "...")]
```

---

## Data Query

Repository load toàn bộ catalog trong **một query duy nhất** (không N+1):

```
Products (IsActive = true, IsDeleted = false, tenant filter auto)
  LEFT JOIN ProductStores            ON StoreId = @storeId
  LEFT JOIN ProductStorePrices       ON StoreId = @storeId
  LEFT JOIN ProductOptionGroups
    → OptionGroup
      → Options
          LEFT JOIN ProductOptionConfigs   ON ProductId = product.Id
          LEFT JOIN OptionStoreAvailabilities ON StoreId = @storeId
          LEFT JOIN OptionStorePrices      ON StoreId = @storeId
  LEFT JOIN ProductTags → Tag
  LEFT JOIN ProductImages            ON IsMain = true
  LEFT JOIN Category
```

---

## Business Rules

### Product visibility

```
Visible = Product.IsActive == true
        AND (ProductStore.IsAvailable ?? true) == true
```

Nếu không có row `ProductStore` cho store này → product được coi là available (fallback `true`).

### ResolvedPrice — Product

```
ResolvedPrice = ProductStorePrice.Price ?? Product.BasePrice
```

### ResolvedPrice — Option (3 tầng)

```
ResolvedPrice = OptionStorePrice.Price (cho store này)
             ?? ProductOptionConfig.CustomPrice (cho product + option này)
             ?? Option.DefaultPrice
```

### Option IsAvailable

```
IsAvailable = OptionStoreAvailability.IsAvailable (cho store này)
           ?? Option.IsActive
```

### Categories

- Chỉ trả về category có ít nhất 1 product visible.
- `ProductCount` = số product visible trong category đó.
- Cấu trúc cây: `Children[]` (parent–child theo `ParentId`).

### Image

Lấy ảnh có `IsMain = true`. Nếu không có → `ImageUrl = null`.

---

## Authorization

```csharp
[Authorize(Roles = "Cashier,StoreStaff,FranchiseeOwner,Admin")]
```

- Tenant filter trong `NdtProductDbContext` tự động giới hạn data theo tenant của token.
- Store membership validation (kiểm tra user có thuộc store đó không) để follow-up — không nằm trong scope này.

---

## Response Shape

Khớp với `PosCatalogDto` FE (`pos-catalog.dto.ts`):

```csharp
record PosCatalogResponse
{
    List<PosCategoryResult> Categories;
    List<PosProductResult>  Products;
}

record PosCategoryResult
{
    int                    Id;
    int?                   ParentId;
    string                 Name;
    int                    ProductCount;
    List<PosCategoryResult> Children;
}

record PosProductResult
{
    int                      Id;
    int?                     CategoryId;
    string                   Name;
    string?                  ShortDescription;
    decimal                  ResolvedPrice;
    bool                     IsAvailable;
    int                      DisplayOrder;
    string?                  ImageUrl;
    List<PosTagResult>       Tags;
    List<PosOptionGroupResult> OptionGroups;
}

record PosOptionGroupResult
{
    int                  GroupId;
    string               GroupName;
    string               UiType;       // "SingleSelect" | "MultiSelect"
    bool                 IsRequired;
    int                  MinSelect;
    int                  MaxSelect;
    int                  DisplayOrder;
    List<PosOptionResult> Options;
}

record PosOptionResult
{
    int     Id;
    string  Name;
    decimal ResolvedPrice;
    bool    IsDefault;
    bool    IsAvailable;
}

record PosTagResult
{
    int     Id;
    string  Name;
    string? ColorHex;
    string? TextColor;
}
```

---

## FE Changes

**Không có.** FE đã gọi đúng endpoint, đúng shape. Chỉ cần verify `VITE_ORDER_BASE_URL` trong `.env.development` trỏ cùng host với BE (`https://localhost:44392/api`).

---

## Out of Scope

- `GET /api/pos/store/{storeId}/status` — store shift/status
- `POST /api/pos/orders` — tạo order
- `GET /api/pos/store/{storeId}/orders` — order history
- Store membership validation (kiểm tra user có thuộc store)
