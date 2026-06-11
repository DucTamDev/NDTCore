# Product UI — Store & Tags Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Product Tags tab to a DataTable, and replace the Store tab (both Product and Option detail pages) with a unified paginated DataTable backed by two new server-side paged BE endpoints.

**Architecture:** Two new CQRS query handlers on the BE merge availability + price records by StoreId in memory and return a `PaginatedCollection<StoreOverrideItemVm>`. The FE adds a paged data layer (DTO → API → Service → Composable) on top of these endpoints, then rewrites three tab components using shared `AppDataTable` / `AppPagination` / `AppDialog` / `AppRowActions` primitives.

**Tech Stack:** .NET 8 / MediatR / FluentValidation (BE); Vue 3 + TypeScript + Vuetify 3 / Pinia (FE)

---

## File Map

### Backend — create

| File | Responsibility |
|---|---|
| `NDTCore.Product.Contracts/ViewModels/StoreOverrides/StoreOverrideItemVm.cs` | Unified per-store VM (StoreId, IsAvailable?, Price?) |
| `…Application/Features/StoreOverrides/GetProductStoreOverridesPaged/GetProductStoreOverridesPagedQuery.cs` | Query record |
| `…/GetProductStoreOverridesPagedQueryHandler.cs` | Handler — merges + paginates |
| `…/GetProductStoreOverridesPagedQueryValidator.cs` | FluentValidation |
| `…Application/Features/StoreOverrides/GetOptionStoreOverridesPaged/GetOptionStoreOverridesPagedQuery.cs` | Query record |
| `…/GetOptionStoreOverridesPagedQueryHandler.cs` | Handler |
| `…/GetOptionStoreOverridesPagedQueryValidator.cs` | FluentValidation |

### Backend — modify

| File | Change |
|---|---|
| `NDTCore.API/Controllers/Modules/Product/Admin/StoreOverrideController.cs` | Add 2 paged GET endpoints |

### Frontend — modify

| File | Change |
|---|---|
| `src/core/constants/api.constants.ts` | Add 2 paged endpoint path functions |
| `src/modules/product/models/dtos/store-overrides.dto.ts` | Add `StoreOverrideItemDto` |
| `src/modules/product/api/store-overrides.api.ts` | Add 2 paged GET methods |
| `src/modules/product/services/store-overrides.service.ts` | Add 2 paged service methods |
| `src/modules/product/composables/useStoreOverrides.ts` | Add 2 new paged composables |

### Frontend — create

| File | Responsibility |
|---|---|
| `src/modules/product/constants/store-overrides.constants.ts` | Columns, row actions, emit keys |

### Frontend — rewrite

| File | Change |
|---|---|
| `src/modules/product/components/product/ProductTagsTab.vue` | Replace chip-group with AppDataTable |
| `src/modules/product/components/product/ProductStoreOverridesTab.vue` | Replace two-column inline layout with unified paged table |
| `src/modules/product/components/option/OptionStoreOverridesTab.vue` | Same as above, option variant |

---

## Task 1: BE — StoreOverrideItemVm + Product paged query

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/ViewModels/StoreOverrides/StoreOverrideItemVm.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/StoreOverrides/GetProductStoreOverridesPaged/GetProductStoreOverridesPagedQuery.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/StoreOverrides/GetProductStoreOverridesPaged/GetProductStoreOverridesPagedQueryHandler.cs`
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/StoreOverrides/GetProductStoreOverridesPaged/GetProductStoreOverridesPagedQueryValidator.cs`

- [ ] **Step 1: Create StoreOverrideItemVm**

```csharp
// NDTCore.Product.Contracts/ViewModels/StoreOverrides/StoreOverrideItemVm.cs
namespace NDTCore.Product.Contracts.ViewModels.StoreOverrides;

/// <summary>
/// VN: Bản ghi override tổng hợp (khả dụng + giá) cho một cửa hàng. <br />
/// EN: Unified override record (availability + price) for a single store.
/// </summary>
public sealed record StoreOverrideItemVm(int StoreId, bool? IsAvailable, decimal? Price);
```

- [ ] **Step 2: Create the paged query record**

```csharp
// …/GetProductStoreOverridesPaged/GetProductStoreOverridesPagedQuery.cs
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Abstractions.Requests;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.Product.Contracts.ViewModels.StoreOverrides;

namespace NDTCore.Product.Application.Features.StoreOverrides.GetProductStoreOverridesPaged;

public sealed record GetProductStoreOverridesPagedQuery(int ProductId, PagedRequest Filter)
    : IQuery<PaginatedCollection<StoreOverrideItemVm>>;
```

- [ ] **Step 3: Create the handler**

```csharp
// …/GetProductStoreOverridesPaged/GetProductStoreOverridesPagedQueryHandler.cs
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.StoreOverrides;

namespace NDTCore.Product.Application.Features.StoreOverrides.GetProductStoreOverridesPaged;

public sealed class GetProductStoreOverridesPagedQueryHandler
    : IQueryHandler<GetProductStoreOverridesPagedQuery, PaginatedCollection<StoreOverrideItemVm>>
{
    private readonly IProductStoreRepository _storeRepo;
    private readonly IProductStorePriceRepository _priceRepo;

    public GetProductStoreOverridesPagedQueryHandler(
        IProductStoreRepository storeRepo,
        IProductStorePriceRepository priceRepo)
    {
        _storeRepo = storeRepo;
        _priceRepo = priceRepo;
    }

    public async Task<Result<PaginatedCollection<StoreOverrideItemVm>>> Handle(
        GetProductStoreOverridesPagedQuery request,
        CancellationToken cancellationToken)
    {
        var availability = await _storeRepo.GetByProductIdAsync(request.ProductId, cancellationToken);
        var prices       = await _priceRepo.GetByProductIdAsync(request.ProductId, cancellationToken);

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
            priceMap.TryGetValue(storeId, out var pr) ? pr.Price      : null
        )).ToList();

        return Result<PaginatedCollection<StoreOverrideItemVm>>.Success(
            new PaginatedCollection<StoreOverrideItemVm>(
                items,
                PaginationMetadata.Create(pageNumber, pageSize, total)));
    }
}
```

- [ ] **Step 4: Create the validator**

```csharp
// …/GetProductStoreOverridesPaged/GetProductStoreOverridesPagedQueryValidator.cs
using FluentValidation;

namespace NDTCore.Product.Application.Features.StoreOverrides.GetProductStoreOverridesPaged;

public sealed class GetProductStoreOverridesPagedQueryValidator
    : AbstractValidator<GetProductStoreOverridesPagedQuery>
{
    public GetProductStoreOverridesPagedQueryValidator()
    {
        RuleFor(x => x.Filter.PageNumber)
            .GreaterThan(0).WithMessage("PageNumber must be greater than 0.");

        RuleFor(x => x.Filter.PageSize)
            .InclusiveBetween(1, 100).WithMessage("PageSize must be between 1 and 100.");
    }
}
```

- [ ] **Step 5: Build to verify**

```bash
dotnet build NDTCore.BE/src/NDTCore.sln
```

Expected: Build succeeded, 0 errors.

---

## Task 2: BE — Option paged query

**Files:**
- Create: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/StoreOverrides/GetOptionStoreOverridesPaged/GetOptionStoreOverridesPagedQuery.cs`
- Create: `…/GetOptionStoreOverridesPagedQueryHandler.cs`
- Create: `…/GetOptionStoreOverridesPagedQueryValidator.cs`

- [ ] **Step 1: Create the query record**

```csharp
// …/GetOptionStoreOverridesPaged/GetOptionStoreOverridesPagedQuery.cs
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Abstractions.Requests;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.Product.Contracts.ViewModels.StoreOverrides;

namespace NDTCore.Product.Application.Features.StoreOverrides.GetOptionStoreOverridesPaged;

public sealed record GetOptionStoreOverridesPagedQuery(int OptionId, PagedRequest Filter)
    : IQuery<PaginatedCollection<StoreOverrideItemVm>>;
```

- [ ] **Step 2: Create the handler**

```csharp
// …/GetOptionStoreOverridesPaged/GetOptionStoreOverridesPagedQueryHandler.cs
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.BuildingBlocks.Core.Pagination;
using NDTCore.BuildingBlocks.Core.Results;
using NDTCore.Product.Contracts.Interfaces.Repositories;
using NDTCore.Product.Contracts.ViewModels.StoreOverrides;

namespace NDTCore.Product.Application.Features.StoreOverrides.GetOptionStoreOverridesPaged;

public sealed class GetOptionStoreOverridesPagedQueryHandler
    : IQueryHandler<GetOptionStoreOverridesPagedQuery, PaginatedCollection<StoreOverrideItemVm>>
{
    private readonly IOptionStoreAvailabilityRepository _availRepo;
    private readonly IOptionStorePriceRepository        _priceRepo;

    public GetOptionStoreOverridesPagedQueryHandler(
        IOptionStoreAvailabilityRepository availRepo,
        IOptionStorePriceRepository priceRepo)
    {
        _availRepo = availRepo;
        _priceRepo = priceRepo;
    }

    public async Task<Result<PaginatedCollection<StoreOverrideItemVm>>> Handle(
        GetOptionStoreOverridesPagedQuery request,
        CancellationToken cancellationToken)
    {
        var availability = await _availRepo.GetByOptionIdAsync(request.OptionId, cancellationToken);
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
            priceMap.TryGetValue(storeId, out var pr) ? pr.Price       : null
        )).ToList();

        return Result<PaginatedCollection<StoreOverrideItemVm>>.Success(
            new PaginatedCollection<StoreOverrideItemVm>(
                items,
                PaginationMetadata.Create(pageNumber, pageSize, total)));
    }
}
```

- [ ] **Step 3: Create the validator**

```csharp
// …/GetOptionStoreOverridesPaged/GetOptionStoreOverridesPagedQueryValidator.cs
using FluentValidation;

namespace NDTCore.Product.Application.Features.StoreOverrides.GetOptionStoreOverridesPaged;

public sealed class GetOptionStoreOverridesPagedQueryValidator
    : AbstractValidator<GetOptionStoreOverridesPagedQuery>
{
    public GetOptionStoreOverridesPagedQueryValidator()
    {
        RuleFor(x => x.Filter.PageNumber)
            .GreaterThan(0).WithMessage("PageNumber must be greater than 0.");

        RuleFor(x => x.Filter.PageSize)
            .InclusiveBetween(1, 100).WithMessage("PageSize must be between 1 and 100.");
    }
}
```

- [ ] **Step 4: Build to verify**

```bash
dotnet build NDTCore.BE/src/NDTCore.sln
```

Expected: Build succeeded, 0 errors.

---

## Task 3: BE — Controller endpoints + commit

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.API/Controllers/Modules/Product/Admin/StoreOverrideController.cs`

- [ ] **Step 1: Add using directives at the top of the file**

Add to the existing using block:
```csharp
using NDTCore.Product.Application.Features.StoreOverrides.GetProductStoreOverridesPaged;
using NDTCore.Product.Application.Features.StoreOverrides.GetOptionStoreOverridesPaged;
using NDTCore.BuildingBlocks.Abstractions.Requests;
```

- [ ] **Step 2: Add two new endpoints after the existing overview endpoints**

Insert after the `GetOptionOverview` action (after line 50 in the original file):

```csharp
    /// <summary>GET api/admin/store-overrides/products/{productId}/paged</summary>
    [HttpGet("products/{productId:int}/paged")]
    public async Task<IActionResult> GetProductStoreOverridesPaged(
        [FromRoute] int productId,
        [FromQuery] PagedRequest filter,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(
            new GetProductStoreOverridesPagedQuery(productId, filter), cancellationToken);
        return PagedResult(result);
    }

    /// <summary>GET api/admin/store-overrides/options/{optionId}/paged</summary>
    [HttpGet("options/{optionId:int}/paged")]
    public async Task<IActionResult> GetOptionStoreOverridesPaged(
        [FromRoute] int optionId,
        [FromQuery] PagedRequest filter,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(
            new GetOptionStoreOverridesPagedQuery(optionId, filter), cancellationToken);
        return PagedResult(result);
    }
```

- [ ] **Step 3: Build to verify**

```bash
dotnet build NDTCore.BE/src/NDTCore.sln
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit BE changes**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Contracts/ViewModels/StoreOverrides/StoreOverrideItemVm.cs
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/StoreOverrides/GetProductStoreOverridesPaged/
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Product/NDTCore.Product.Application/Features/StoreOverrides/GetOptionStoreOverridesPaged/
git add NDTCore.BE/src/NDTCore.API/Controllers/Modules/Product/Admin/StoreOverrideController.cs
git commit -m "feat(product): add paged store-overrides endpoints for product and option"
```

---

## Task 4: FE — Data layer (constants, DTO, API, service, composable)

**Files:**
- Modify: `NDTCore.FE/src/core/constants/api.constants.ts`
- Modify: `NDTCore.FE/src/modules/product/models/dtos/store-overrides.dto.ts`
- Modify: `NDTCore.FE/src/modules/product/api/store-overrides.api.ts`
- Modify: `NDTCore.FE/src/modules/product/services/store-overrides.service.ts`
- Modify: `NDTCore.FE/src/modules/product/composables/useStoreOverrides.ts`

- [ ] **Step 1: Add endpoint path constants**

In `src/core/constants/api.constants.ts`, inside `STORE_OVERRIDE_API`, add after `REMOVE_OPTION_PRICE`:

```ts
GET_PRODUCT_PAGED: (productId: number) =>
    `/admin/store-overrides/products/${productId}/paged`,
GET_OPTION_PAGED: (optionId: number) =>
    `/admin/store-overrides/options/${optionId}/paged`,
```

- [ ] **Step 2: Add the DTO**

In `src/modules/product/models/dtos/store-overrides.dto.ts`, append:

```ts
export interface StoreOverrideItemDto {
    StoreId: number
    IsAvailable: boolean | null
    Price: number | null
}
```

- [ ] **Step 3: Add paged API methods**

In `src/modules/product/api/store-overrides.api.ts`, add to the `storeOverridesApi` object:

```ts
getProductPagedAsync(
    productId: number,
    params: { PageNumber: number; PageSize: number },
): Promise<PagedApiResponse<StoreOverrideItemDto>> {
    return productClient.get(EP.GET_PRODUCT_PAGED(productId), { params })
},
getOptionPagedAsync(
    optionId: number,
    params: { PageNumber: number; PageSize: number },
): Promise<PagedApiResponse<StoreOverrideItemDto>> {
    return productClient.get(EP.GET_OPTION_PAGED(optionId), { params })
},
```

Also add the import at the top:
```ts
import type { PagedApiResponse } from '@/core/models/common.dto'
import type { ..., StoreOverrideItemDto } from '../models/dtos/store-overrides.dto'
```

- [ ] **Step 4: Add service methods**

In `src/modules/product/services/store-overrides.service.ts`, add to `StoreOverridesService`:

```ts
async getProductPagedAsync(
    productId: number,
    params: { PageNumber: number; PageSize: number },
): Promise<{ items: StoreOverrideItemDto[]; pageNumber: number; pageSize: number; totalPages: number; totalCount: number }> {
    const r = await storeOverridesApi.getProductPagedAsync(productId, params)
    return {
        items: (r.Data ?? []) as StoreOverrideItemDto[],
        pageNumber: r.PageNumber,
        pageSize: r.PageSize,
        totalPages: r.TotalPages,
        totalCount: r.TotalCount,
    }
}

async getOptionPagedAsync(
    optionId: number,
    params: { PageNumber: number; PageSize: number },
): Promise<{ items: StoreOverrideItemDto[]; pageNumber: number; pageSize: number; totalPages: number; totalCount: number }> {
    const r = await storeOverridesApi.getOptionPagedAsync(optionId, params)
    return {
        items: (r.Data ?? []) as StoreOverrideItemDto[],
        pageNumber: r.PageNumber,
        pageSize: r.PageSize,
        totalPages: r.TotalPages,
        totalCount: r.TotalCount,
    }
}
```

Also add the import at the top of the service file:
```ts
import type { ..., StoreOverrideItemDto } from '../models/dtos/store-overrides.dto'
```

- [ ] **Step 5: Add paged composables**

Append to `src/modules/product/composables/useStoreOverrides.ts`:

```ts
export function useProductStoreOverridesPaged(productId: number) {
    const toast = useToastNotification()
    const isLoading    = ref(false)
    const isSubmitting = ref(false)
    const items        = ref<StoreOverrideItemDto[]>([])
    const pageNumber   = ref(1)
    const pageSize     = ref(20)
    const totalPages   = ref(0)
    const totalItems   = ref(0)

    async function loadPaged() {
        isLoading.value = true
        try {
            const result = await storeOverridesService.getProductPagedAsync(productId, {
                PageNumber: pageNumber.value,
                PageSize: pageSize.value,
            })
            items.value      = result.items
            pageNumber.value = result.pageNumber
            pageSize.value   = result.pageSize
            totalPages.value = result.totalPages
            totalItems.value = result.totalCount
        } catch {
            toast.error('Không thể tải danh sách cửa hàng.')
        } finally {
            isLoading.value = false
        }
    }

    // Re-use existing mutation helpers
    const { upsertAvailability, removeAvailability, upsertPrice, removePrice } =
        useProductStoreOverrides(productId)

    async function removeStoreRow(storeId: number): Promise<boolean> {
        let ok = await removeAvailability(storeId)
        try {
            await storeOverridesService.removeProductPriceAsync(productId, storeId)
        } catch {
            // price record may not exist — ignore
        }
        return ok
    }

    return {
        isLoading, isSubmitting, items,
        pageNumber, pageSize, totalPages, totalItems,
        loadPaged, upsertAvailability, removeAvailability,
        upsertPrice, removePrice, removeStoreRow,
    }
}

export function useOptionStoreOverridesPaged(optionId: number) {
    const toast = useToastNotification()
    const isLoading    = ref(false)
    const isSubmitting = ref(false)
    const items        = ref<StoreOverrideItemDto[]>([])
    const pageNumber   = ref(1)
    const pageSize     = ref(20)
    const totalPages   = ref(0)
    const totalItems   = ref(0)

    async function loadPaged() {
        isLoading.value = true
        try {
            const result = await storeOverridesService.getOptionPagedAsync(optionId, {
                PageNumber: pageNumber.value,
                PageSize: pageSize.value,
            })
            items.value      = result.items
            pageNumber.value = result.pageNumber
            pageSize.value   = result.pageSize
            totalPages.value = result.totalPages
            totalItems.value = result.totalCount
        } catch {
            toast.error('Không thể tải danh sách cửa hàng.')
        } finally {
            isLoading.value = false
        }
    }

    const { upsertAvailability, removeAvailability, upsertPrice, removePrice } =
        useOptionStoreOverrides(optionId)

    async function removeStoreRow(storeId: number): Promise<boolean> {
        let ok = await removeAvailability(storeId)
        try {
            await storeOverridesService.removeOptionPriceAsync(optionId, storeId)
        } catch {
            // price record may not exist — ignore
        }
        return ok
    }

    return {
        isLoading, isSubmitting, items,
        pageNumber, pageSize, totalPages, totalItems,
        loadPaged, upsertAvailability, removeAvailability,
        upsertPrice, removePrice, removeStoreRow,
    }
}
```

Also add the import for `StoreOverrideItemDto` at the top of `useStoreOverrides.ts`:
```ts
import type { ..., StoreOverrideItemDto } from '../models/dtos/store-overrides.dto'
```

- [ ] **Step 6: Type-check**

```bash
cd NDTCore.FE && npm run type-check
```

Expected: No errors.

- [ ] **Step 7: Commit data layer**

```bash
git add NDTCore.FE/src/core/constants/api.constants.ts
git add NDTCore.FE/src/modules/product/models/dtos/store-overrides.dto.ts
git add NDTCore.FE/src/modules/product/api/store-overrides.api.ts
git add NDTCore.FE/src/modules/product/services/store-overrides.service.ts
git add NDTCore.FE/src/modules/product/composables/useStoreOverrides.ts
git commit -m "feat(product): add paged store-overrides data layer (dto, api, service, composables)"
```

---

## Task 5: FE — store-overrides.constants.ts

**Files:**
- Create: `NDTCore.FE/src/modules/product/constants/store-overrides.constants.ts`

- [ ] **Step 1: Create the constants file**

```ts
// src/modules/product/constants/store-overrides.constants.ts
import type { TableColumn, RowAction } from '@/components/ui'
import type { StoreOverrideItemDto } from '../models/dtos/store-overrides.dto'

export const STORE_OVERRIDE_ROW_ACTION = {
    EDIT:   'edit',
    DELETE: 'delete',
} as const

export const STORE_OVERRIDE_LIST_COLUMNS: TableColumn[] = [
    { key: 'StoreId',      title: 'Store ID',     width: '100px' },
    { key: 'IsAvailable',  title: 'Khả dụng',     width: '120px', align: 'center' },
    { key: 'Price',        title: 'Giá override',  width: '150px', align: 'end', hideBelow: 'sm' },
    { key: 'actions',      title: '',             width: '90px',  align: 'end' },
]

export const STORE_OVERRIDE_ROW_ACTIONS: RowAction<StoreOverrideItemDto>[] = [
    { key: STORE_OVERRIDE_ROW_ACTION.EDIT,   label: 'Chỉnh sửa', icon: 'mdi-pencil-outline', color: 'secondary' },
    { key: STORE_OVERRIDE_ROW_ACTION.DELETE, label: 'Xóa',       icon: 'mdi-delete-outline',  color: 'error' },
]
```

- [ ] **Step 2: Type-check**

```bash
cd NDTCore.FE && npm run type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.FE/src/modules/product/constants/store-overrides.constants.ts
git commit -m "feat(product): add store-overrides table constants"
```

---

## Task 6: FE — Rewrite ProductTagsTab.vue

**Files:**
- Rewrite: `NDTCore.FE/src/modules/product/components/product/ProductTagsTab.vue`

- [ ] **Step 1: Replace the component**

```vue
<!-- src/modules/product/components/product/ProductTagsTab.vue -->
<template>
    <div class="pa-4 d-flex flex-column ga-4">
        <div class="d-flex align-center justify-space-between">
            <span class="text-subtitle-2 text-medium-emphasis">Tags đang gán</span>
            <v-btn size="small" color="primary" prepend-icon="mdi-plus" @click="showAssign = true">
                Gán tag
            </v-btn>
        </div>

        <v-card variant="outlined" rounded="lg">
            <AppDataTable
                :items="(tags as Record<string, unknown>[])"
                :columns="TAG_ASSIGNED_COLUMNS"
                :loading="isLoading"
                item-key="TagId"
            >
                <template #[`item.actions`]="{ item }">
                    <div class="d-flex justify-end" @click.stop>
                        <v-tooltip text="Gỡ tag" location="top">
                            <template #activator="{ props: tp }">
                                <v-btn
                                    v-bind="tp"
                                    icon="mdi-tag-off-outline"
                                    color="error"
                                    size="small"
                                    variant="text"
                                    :disabled="isSubmitting"
                                    @click="openConfirm(Number(item['TagId']))"
                                />
                            </template>
                        </v-tooltip>
                    </div>
                </template>

                <template #empty>
                    <AppEmptyState
                        icon="mdi-tag-off-outline"
                        title="Chưa có tag nào được gán"
                        description="Nhấn 'Gán tag' để thêm tag cho sản phẩm."
                    />
                </template>
            </AppDataTable>
        </v-card>

        <!-- Assign dialog -->
        <AppDialog v-model="showAssign" title="Gán tag" :hide-actions="true" size="sm">
            <div class="d-flex flex-column ga-3">
                <v-autocomplete
                    v-model="selectedTagId"
                    :items="availableTags"
                    item-value="id"
                    item-title="name"
                    label="Chọn tag"
                    clearable
                />
                <div class="d-flex justify-end ga-2">
                    <v-btn variant="text" @click="showAssign = false">Hủy</v-btn>
                    <v-btn
                        color="primary"
                        :loading="isSubmitting"
                        :disabled="!selectedTagId"
                        @click="onAssign"
                    >
                        Gán
                    </v-btn>
                </div>
            </div>
        </AppDialog>

        <AppConfirmDialog
            v-model="confirmOpen"
            title="Gỡ tag"
            message="Bạn có chắc muốn gỡ tag này khỏi sản phẩm?"
            confirm-label="Xác nhận gỡ"
            confirm-variant="danger"
            @confirm="onConfirmRemove"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { TableColumn } from '@/components/ui'
import { AppDialog, AppConfirmDialog, AppDataTable, AppEmptyState } from '@/components/ui'
import { useProductRelations } from '../../composables/useProductRelations'
import { useTagStore } from '../../stores/tag.store'

const props = defineProps<{ productId: number }>()

const TAG_ASSIGNED_COLUMNS: TableColumn[] = [
    { key: 'TagId',   title: 'ID',       width: '70px' },
    { key: 'TagName', title: 'Tên tag',  minWidth: '150px' },
    { key: 'actions', title: '',         width: '70px', align: 'end' },
]

const { isLoading, isSubmitting, tags, loadTags, assignTag, removeTag } =
    useProductRelations(props.productId)

const tagStore = useTagStore()
const availableTags = ref<{ id: number; name: string }[]>([])
const showAssign    = ref(false)
const selectedTagId = ref<number | null>(null)
const confirmOpen   = ref(false)
const confirmTagId  = ref<number | null>(null)

function openConfirm(tagId: number) {
    confirmTagId.value = tagId
    confirmOpen.value  = true
}

async function onAssign() {
    if (!selectedTagId.value) return
    const ok = await assignTag({ TagId: selectedTagId.value })
    if (ok) {
        showAssign.value    = false
        selectedTagId.value = null
        await loadTags()
        refreshAvailable()
    }
}

async function onConfirmRemove() {
    if (confirmTagId.value == null) return
    const ok = await removeTag(confirmTagId.value)
    if (ok) {
        await loadTags()
        refreshAvailable()
    }
    confirmTagId.value = null
}

function refreshAvailable() {
    const assignedIds = new Set(tags.value.map((t) => t.TagId))
    availableTags.value = tagStore.items
        .filter((t) => !assignedIds.has(t.id))
        .map((t) => ({ id: t.id, name: t.name }))
}

onMounted(async () => {
    await tagStore.fetchPaged({ PageNumber: 1, PageSize: 200 })
    await loadTags()
    refreshAvailable()
})
</script>
```

- [ ] **Step 2: Type-check**

```bash
cd NDTCore.FE && npm run type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.FE/src/modules/product/components/product/ProductTagsTab.vue
git commit -m "feat(product): replace chip-group with AppDataTable in ProductTagsTab"
```

---

## Task 7: FE — Rewrite ProductStoreOverridesTab.vue

**Files:**
- Rewrite: `NDTCore.FE/src/modules/product/components/product/ProductStoreOverridesTab.vue`

- [ ] **Step 1: Replace the component**

```vue
<!-- src/modules/product/components/product/ProductStoreOverridesTab.vue -->
<template>
    <div class="pa-4 d-flex flex-column ga-4">
        <div class="d-flex justify-end">
            <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openAdd">
                Thêm cửa hàng
            </v-btn>
        </div>

        <v-card variant="outlined" rounded="lg">
            <AppDataTable
                :items="(items as Record<string, unknown>[])"
                :columns="STORE_OVERRIDE_LIST_COLUMNS"
                :loading="isLoading"
                item-key="StoreId"
            >
                <template #[`item.IsAvailable`]="{ item }">
                    <template v-if="item['IsAvailable'] != null">
                        <v-icon
                            :color="item['IsAvailable'] ? 'success' : 'error'"
                            :icon="item['IsAvailable'] ? 'mdi-check-circle' : 'mdi-close-circle'"
                        />
                    </template>
                    <span v-else class="text-medium-emphasis text-caption">—</span>
                </template>

                <template #[`item.Price`]="{ item }">
                    <span v-if="item['Price'] != null">
                        {{ Number(item['Price']).toLocaleString('vi-VN') }} ₫
                    </span>
                    <span v-else class="text-medium-emphasis text-caption">—</span>
                </template>

                <template #[`item.actions`]="{ item }">
                    <AppRowActions
                        :actions="STORE_OVERRIDE_ROW_ACTIONS"
                        :item="(item as StoreOverrideItemDto)"
                        @action="(key) => onRowAction(key, item as StoreOverrideItemDto)"
                    />
                </template>

                <template #empty>
                    <AppEmptyState
                        icon="mdi-store-off-outline"
                        title="Chưa có override cửa hàng"
                        description="Nhấn 'Thêm cửa hàng' để cấu hình override cho cửa hàng."
                    />
                </template>
            </AppDataTable>

            <v-divider />

            <AppPagination
                :page-number="pageNumber"
                :page-size="pageSize"
                :total-pages="totalPages"
                :total-items="totalItems"
                @update:page-number="onPageChange"
                @update:page-size="onPageSizeChange"
            />
        </v-card>

        <!-- Add / Edit dialog -->
        <AppDialog
            v-model="dialogOpen"
            :title="editingRow ? 'Chỉnh sửa cửa hàng' : 'Thêm cửa hàng'"
            size="sm"
            :loading="isSubmitting"
            confirm-label="Lưu"
            @confirm="onSave"
        >
            <div class="d-flex flex-column ga-4 pt-1">
                <v-text-field
                    v-model.number="form.storeId"
                    label="Store ID"
                    type="number"
                    :disabled="!!editingRow"
                    :rules="[v => (v != null && v > 0) || 'Store ID phải lớn hơn 0']"
                    density="compact"
                    variant="outlined"
                />
                <v-switch
                    v-model="form.isAvailable"
                    label="Khả dụng"
                    color="primary"
                    hide-details
                    inset
                />
                <AppCurrencyField
                    v-model="form.price"
                    label="Giá override (để trống nếu không cần)"
                    :nullable="true"
                />
            </div>
        </AppDialog>

        <AppConfirmDialog
            v-model="confirmOpen"
            title="Xóa override"
            :message="`Xóa tất cả override cho Store ID ${confirmStoreId}?`"
            confirm-label="Xóa"
            confirm-variant="danger"
            @confirm="onConfirmDelete"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import {
    AppDataTable, AppPagination, AppRowActions,
    AppDialog, AppConfirmDialog, AppCurrencyField, AppEmptyState,
} from '@/components/ui'
import {
    STORE_OVERRIDE_LIST_COLUMNS,
    STORE_OVERRIDE_ROW_ACTION,
    STORE_OVERRIDE_ROW_ACTIONS,
} from '../../constants/store-overrides.constants'
import { useProductStoreOverridesPaged } from '../../composables/useStoreOverrides'
import type { StoreOverrideItemDto } from '../../models/dtos/store-overrides.dto'

const props = defineProps<{ productId: number }>()

const {
    isLoading, isSubmitting, items,
    pageNumber, pageSize, totalPages, totalItems,
    loadPaged, upsertAvailability, upsertPrice, removeStoreRow,
} = useProductStoreOverridesPaged(props.productId)

const dialogOpen    = ref(false)
const confirmOpen   = ref(false)
const confirmStoreId = ref(0)
const editingRow    = ref<StoreOverrideItemDto | null>(null)
const originalPrice = ref<number | null>(null)

const form = reactive({
    storeId:     0,
    isAvailable: true,
    price:       null as number | null,
})

function openAdd() {
    editingRow.value    = null
    originalPrice.value = null
    Object.assign(form, { storeId: 0, isAvailable: true, price: null })
    dialogOpen.value = true
}

function openEdit(row: StoreOverrideItemDto) {
    editingRow.value    = row
    originalPrice.value = row.Price
    Object.assign(form, {
        storeId:     row.StoreId,
        isAvailable: row.IsAvailable ?? true,
        price:       row.Price,
    })
    dialogOpen.value = true
}

function onRowAction(key: string, row: StoreOverrideItemDto) {
    if (key === STORE_OVERRIDE_ROW_ACTION.EDIT)   openEdit(row)
    if (key === STORE_OVERRIDE_ROW_ACTION.DELETE) {
        confirmStoreId.value = row.StoreId
        confirmOpen.value    = true
    }
}

async function onSave() {
    const { storeId, isAvailable, price } = form
    const okAvail = await upsertAvailability(storeId, isAvailable)
    if (!okAvail) return

    if (price != null) {
        await upsertPrice(storeId, price)
    } else if (editingRow.value && originalPrice.value != null) {
        // price was cleared during edit → remove existing price record
        try {
            const { removePrice } = useProductStoreOverridesPaged(props.productId)
            await removePrice(storeId)
        } catch { /* ignore 404 */ }
    }

    dialogOpen.value = false
    await loadPaged()
}

async function onConfirmDelete() {
    await removeStoreRow(confirmStoreId.value)
    await loadPaged()
}

async function onPageChange(page: number) {
    pageNumber.value = page
    await loadPaged()
}

async function onPageSizeChange(size: number) {
    pageSize.value   = size
    pageNumber.value = 1
    await loadPaged()
}

onMounted(loadPaged)
</script>
```

- [ ] **Step 2: Type-check**

```bash
cd NDTCore.FE && npm run type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.FE/src/modules/product/components/product/ProductStoreOverridesTab.vue
git commit -m "feat(product): rewrite ProductStoreOverridesTab with paginated AppDataTable"
```

---

## Task 8: FE — Rewrite OptionStoreOverridesTab.vue

**Files:**
- Rewrite: `NDTCore.FE/src/modules/product/components/option/OptionStoreOverridesTab.vue`

- [ ] **Step 1: Replace the component**

```vue
<!-- src/modules/product/components/option/OptionStoreOverridesTab.vue -->
<template>
    <div class="pa-4 d-flex flex-column ga-4">
        <div class="d-flex justify-end">
            <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openAdd">
                Thêm cửa hàng
            </v-btn>
        </div>

        <v-card variant="outlined" rounded="lg">
            <AppDataTable
                :items="(items as Record<string, unknown>[])"
                :columns="STORE_OVERRIDE_LIST_COLUMNS"
                :loading="isLoading"
                item-key="StoreId"
            >
                <template #[`item.IsAvailable`]="{ item }">
                    <template v-if="item['IsAvailable'] != null">
                        <v-icon
                            :color="item['IsAvailable'] ? 'success' : 'error'"
                            :icon="item['IsAvailable'] ? 'mdi-check-circle' : 'mdi-close-circle'"
                        />
                    </template>
                    <span v-else class="text-medium-emphasis text-caption">—</span>
                </template>

                <template #[`item.Price`]="{ item }">
                    <span v-if="item['Price'] != null">
                        {{ Number(item['Price']).toLocaleString('vi-VN') }} ₫
                    </span>
                    <span v-else class="text-medium-emphasis text-caption">—</span>
                </template>

                <template #[`item.actions`]="{ item }">
                    <AppRowActions
                        :actions="STORE_OVERRIDE_ROW_ACTIONS"
                        :item="(item as StoreOverrideItemDto)"
                        @action="(key) => onRowAction(key, item as StoreOverrideItemDto)"
                    />
                </template>

                <template #empty>
                    <AppEmptyState
                        icon="mdi-store-off-outline"
                        title="Chưa có override cửa hàng"
                        description="Nhấn 'Thêm cửa hàng' để cấu hình override cho cửa hàng."
                    />
                </template>
            </AppDataTable>

            <v-divider />

            <AppPagination
                :page-number="pageNumber"
                :page-size="pageSize"
                :total-pages="totalPages"
                :total-items="totalItems"
                @update:page-number="onPageChange"
                @update:page-size="onPageSizeChange"
            />
        </v-card>

        <!-- Add / Edit dialog -->
        <AppDialog
            v-model="dialogOpen"
            :title="editingRow ? 'Chỉnh sửa cửa hàng' : 'Thêm cửa hàng'"
            size="sm"
            :loading="isSubmitting"
            confirm-label="Lưu"
            @confirm="onSave"
        >
            <div class="d-flex flex-column ga-4 pt-1">
                <v-text-field
                    v-model.number="form.storeId"
                    label="Store ID"
                    type="number"
                    :disabled="!!editingRow"
                    :rules="[v => (v != null && v > 0) || 'Store ID phải lớn hơn 0']"
                    density="compact"
                    variant="outlined"
                />
                <v-switch
                    v-model="form.isAvailable"
                    label="Khả dụng"
                    color="primary"
                    hide-details
                    inset
                />
                <AppCurrencyField
                    v-model="form.price"
                    label="Giá override (để trống nếu không cần)"
                    :nullable="true"
                />
            </div>
        </AppDialog>

        <AppConfirmDialog
            v-model="confirmOpen"
            title="Xóa override"
            :message="`Xóa tất cả override cho Store ID ${confirmStoreId}?`"
            confirm-label="Xóa"
            confirm-variant="danger"
            @confirm="onConfirmDelete"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import {
    AppDataTable, AppPagination, AppRowActions,
    AppDialog, AppConfirmDialog, AppCurrencyField, AppEmptyState,
} from '@/components/ui'
import {
    STORE_OVERRIDE_LIST_COLUMNS,
    STORE_OVERRIDE_ROW_ACTION,
    STORE_OVERRIDE_ROW_ACTIONS,
} from '../../constants/store-overrides.constants'
import { useOptionStoreOverridesPaged } from '../../composables/useStoreOverrides'
import type { StoreOverrideItemDto } from '../../models/dtos/store-overrides.dto'

const props = defineProps<{ optionId: number }>()

const {
    isLoading, isSubmitting, items,
    pageNumber, pageSize, totalPages, totalItems,
    loadPaged, upsertAvailability, upsertPrice, removeStoreRow,
} = useOptionStoreOverridesPaged(props.optionId)

const dialogOpen     = ref(false)
const confirmOpen    = ref(false)
const confirmStoreId = ref(0)
const editingRow     = ref<StoreOverrideItemDto | null>(null)
const originalPrice  = ref<number | null>(null)

const form = reactive({
    storeId:     0,
    isAvailable: true,
    price:       null as number | null,
})

function openAdd() {
    editingRow.value    = null
    originalPrice.value = null
    Object.assign(form, { storeId: 0, isAvailable: true, price: null })
    dialogOpen.value = true
}

function openEdit(row: StoreOverrideItemDto) {
    editingRow.value    = row
    originalPrice.value = row.Price
    Object.assign(form, {
        storeId:     row.StoreId,
        isAvailable: row.IsAvailable ?? true,
        price:       row.Price,
    })
    dialogOpen.value = true
}

function onRowAction(key: string, row: StoreOverrideItemDto) {
    if (key === STORE_OVERRIDE_ROW_ACTION.EDIT)   openEdit(row)
    if (key === STORE_OVERRIDE_ROW_ACTION.DELETE) {
        confirmStoreId.value = row.StoreId
        confirmOpen.value    = true
    }
}

async function onSave() {
    const { storeId, isAvailable, price } = form
    const okAvail = await upsertAvailability(storeId, isAvailable)
    if (!okAvail) return

    if (price != null) {
        await upsertPrice(storeId, price)
    } else if (editingRow.value && originalPrice.value != null) {
        try {
            const { removePrice } = useOptionStoreOverridesPaged(props.optionId)
            await removePrice(storeId)
        } catch { /* ignore 404 */ }
    }

    dialogOpen.value = false
    await loadPaged()
}

async function onConfirmDelete() {
    await removeStoreRow(confirmStoreId.value)
    await loadPaged()
}

async function onPageChange(page: number) {
    pageNumber.value = page
    await loadPaged()
}

async function onPageSizeChange(size: number) {
    pageSize.value   = size
    pageNumber.value = 1
    await loadPaged()
}

onMounted(loadPaged)
</script>
```

- [ ] **Step 2: Type-check**

```bash
cd NDTCore.FE && npm run type-check
```

Expected: No errors.

- [ ] **Step 3: Final commit**

```bash
git add NDTCore.FE/src/modules/product/components/option/OptionStoreOverridesTab.vue
git commit -m "feat(product): rewrite OptionStoreOverridesTab with paginated AppDataTable"
```

---

## Self-Review Checklist (done)

| Check | Result |
|---|---|
| All spec requirements covered | ✓ Tags → DataTable (Task 6); Store tabs → unified paged DataTable (Tasks 7–8); BE paged endpoints (Tasks 1–3); Edit/Delete row actions (Tasks 7–8); Add Store modal (Tasks 7–8) |
| No TBD / placeholder steps | ✓ All steps contain complete code |
| Type consistency | ✓ `StoreOverrideItemVm` (BE) ↔ `StoreOverrideItemDto` (FE) share `StoreId/IsAvailable?/Price?`; composable returns are used as typed in components |
| `removeStoreRow` 404 handling | ✓ price delete wrapped in try/catch in both composable and onSave |
| `AppCurrencyField` nullable | ✓ `:nullable="true"` passed; component emits `null` when cleared |
