# Product Module UI — Store & Tags Tab Redesign

**Date:** 2026-06-06  
**Scope:** NDTCore.FE + NDTCore.BE (Product module)  
**Status:** Approved

---

## Goals

1. Replace chip-group display in `ProductTagsTab` with a standard `AppDataTable`.
2. Replace the two-column inline-form layout in `ProductStoreOverridesTab` and `OptionStoreOverridesTab` with a single unified paginated `AppDataTable` (availability + price merged per StoreId row).
3. Add Edit and Delete row actions to the Store tab.
4. Add an "Add Store" button that opens a modal form for create/edit.
5. Support server-side pagination for store overrides (new BE paged endpoints).

---

## Decisions

| Question | Decision |
|---|---|
| Store tab layout | Single unified table (StoreId, IsAvailable, Price) — merge by StoreId |
| Pagination approach | Server-side — new paged GET endpoints on BE |
| Tags tab Edit action | None — Delete (unassign) only |
| Mutations (Add/Edit/Delete) | Reuse existing separate upsert/delete endpoints (Approach A) |

---

## Section 1 — Backend

### New query folders

**`NDTCore.Product.Application/Features/StoreOverrides/GetProductStoreOverridesPaged/`**

| File | Purpose |
|---|---|
| `GetProductStoreOverridesPagedQuery.cs` | `record(int ProductId, PagedRequest Filter) : IQuery<PaginatedCollection<StoreOverrideItemVm>>` |
| `GetProductStoreOverridesPagedQueryHandler.cs` | Fetches all availability + prices from existing repos, LINQ outer-joins by StoreId in memory, applies Skip/Take, returns `PaginatedCollection<StoreOverrideItemVm>` |
| `GetProductStoreOverridesPagedQueryValidator.cs` | Validates `PageNumber >= 1`, `PageSize` in `[1, 100]` |

**`NDTCore.Product.Application/Features/StoreOverrides/GetOptionStoreOverridesPaged/`**

Identical shape using `IOptionStoreAvailabilityRepository` + `IOptionStorePriceRepository`.

### New VM

**`NDTCore.Product.Contracts/ViewModels/StoreOverrides/StoreOverrideItemVm.cs`**

```csharp
public sealed record StoreOverrideItemVm(int StoreId, bool IsAvailable, decimal? Price);
```

### New controller endpoints

Added to `StoreOverrideController`:

```
GET api/admin/store-overrides/products/{productId}/paged?PageNumber=1&PageSize=20
GET api/admin/store-overrides/options/{optionId}/paged?PageNumber=1&PageSize=20
```

No changes to existing upsert/delete endpoints.

---

## Section 2 — Frontend Data Layer

### DTOs (`store-overrides.dto.ts`)

Add:
```ts
export interface StoreOverrideItemDto {
  StoreId: number
  IsAvailable: boolean
  Price: number | null
}
```

### API (`store-overrides.api.ts`)

Add two paged GET methods:
- `getProductPagedAsync(productId, params: { PageNumber, PageSize }): Promise<PagedApiResponse<StoreOverrideItemDto>>`
- `getOptionPagedAsync(optionId, params: { PageNumber, PageSize }): Promise<PagedApiResponse<StoreOverrideItemDto>>`

### Service (`store-overrides.service.ts`)

Add corresponding service methods that unwrap the paged response.

### Composables (`useStoreOverrides.ts`)

Add two new composables (existing composables unchanged):

**`useProductStoreOverridesPaged(productId: number)`**
- State: `items`, `isLoading`, `isSubmitting`, `pageNumber`, `pageSize`, `totalPages`, `totalItems`
- Methods: `loadPaged()`, `upsertAvailability`, `removeAvailability`, `upsertPrice`, `removePrice` (re-exported from existing composable)

**`useOptionStoreOverridesPaged(optionId: number)`** — identical shape.

### API Endpoints constant

Add the two new paged endpoint paths to `API_ENDPOINTS.PRODUCT.STORE_OVERRIDE_API`.

### Constants (`constants/store-overrides.constants.ts`) — new file

```ts
STORE_OVERRIDE_LIST_COLUMNS: TableColumn[] = [
  { key: 'StoreId',      title: 'Store ID',   width: '80px' },
  { key: 'IsAvailable',  title: 'Khả dụng',   width: '120px', align: 'center' },
  { key: 'Price',        title: 'Giá override', width: '130px', align: 'end' },
  { key: 'actions',      title: '',            width: '90px',  align: 'end' },
]

STORE_OVERRIDE_ROW_ACTION = { EDIT: 'edit', DELETE: 'delete' }

STORE_OVERRIDE_ROW_ACTIONS: RowAction<StoreOverrideItemDto>[] = [
  { key: 'edit',   label: 'Chỉnh sửa', icon: 'mdi-pencil-outline',  color: 'secondary' },
  { key: 'delete', label: 'Xóa',       icon: 'mdi-delete-outline',   color: 'error' },
]
```

---

## Section 3 — Frontend Components

### ProductTagsTab.vue (rewrite)

**Changes from current:**
- Remove `v-chip-group` + `v-chip` display
- Add `AppDataTable` with columns: ID (60px), Tag Name (minWidth 150px), Actions (end, 80px)
- Row actions: Delete only (`mdi-tag-off-outline`, error) → `AppConfirmDialog` → `removeTag(tagId)` → reload
- "Gán tag" button (unchanged) → existing `AppDialog` with `v-autocomplete`
- No pagination — continues loading all at once via `loadTags()`
- Empty state via `AppEmptyState` slot in the table

**State unchanged:** uses existing `useProductRelations(productId)` composable.

---

### ProductStoreOverridesTab.vue (rewrite)

**Replaces:** two-column card layout with separate inline forms.

**New layout:**
```
┌─────────────────────────────────────┐
│                      [ + Thêm cửa hàng ] │
│ AppDataTable                         │
│  StoreId │ Khả dụng │ Giá │ Actions  │
│  ...                                  │
│ AppPagination                         │
└─────────────────────────────────────┘
```

**AppDialog — Add/Edit Store (size: sm)**

| Field | Component | Notes |
|---|---|---|
| Store ID | `v-text-field` (number) | Required; **disabled** when editing |
| Khả dụng | `v-switch` | Default `true` |
| Giá override | `AppCurrencyField` | Optional — nullable |

**Save logic on submit:**
1. Call `upsertAvailability(storeId, isAvailable)` — always
2. If `price != null` → call `upsertPrice(storeId, price)`
3. If `price == null` **and the row being edited previously had a price** → call `removePrice(storeId)` (404 silently ignored)
4. On all-success: close modal, call `loadPaged()`

**Delete row action:**
1. `AppConfirmDialog` confirmation
2. Call `removeAvailability(storeId)` then `removePrice(storeId)` (404 on price silently ignored — may not have a price record)
3. On success: call `loadPaged()`

**Composable:** `useProductStoreOverridesPaged(productId)` (new).

---

### OptionStoreOverridesTab.vue (rewrite)

Identical structure and logic to `ProductStoreOverridesTab`.  
**Composable:** `useOptionStoreOverridesPaged(optionId)` (new).

---

## Files Changed / Created

### Backend

| Action | Path |
|---|---|
| Create | `...Application/Features/StoreOverrides/GetProductStoreOverridesPaged/GetProductStoreOverridesPagedQuery.cs` |
| Create | `...Application/Features/StoreOverrides/GetProductStoreOverridesPaged/GetProductStoreOverridesPagedQueryHandler.cs` |
| Create | `...Application/Features/StoreOverrides/GetProductStoreOverridesPaged/GetProductStoreOverridesPagedQueryValidator.cs` |
| Create | `...Application/Features/StoreOverrides/GetOptionStoreOverridesPaged/GetOptionStoreOverridesPagedQuery.cs` |
| Create | `...Application/Features/StoreOverrides/GetOptionStoreOverridesPaged/GetOptionStoreOverridesPagedQueryHandler.cs` |
| Create | `...Application/Features/StoreOverrides/GetOptionStoreOverridesPaged/GetOptionStoreOverridesPagedQueryValidator.cs` |
| Create | `...Contracts/ViewModels/StoreOverrides/StoreOverrideItemVm.cs` |
| Modify | `...NDTCore.API/Controllers/Modules/Product/Admin/StoreOverrideController.cs` |

### Frontend

| Action | Path |
|---|---|
| Modify | `src/modules/product/models/dtos/store-overrides.dto.ts` |
| Modify | `src/modules/product/api/store-overrides.api.ts` |
| Modify | `src/modules/product/services/store-overrides.service.ts` |
| Modify | `src/modules/product/composables/useStoreOverrides.ts` |
| Modify | `src/core/constants/api.constants.ts` (new paged endpoint paths) |
| Create | `src/modules/product/constants/store-overrides.constants.ts` |
| Rewrite | `src/modules/product/components/product/ProductStoreOverridesTab.vue` |
| Rewrite | `src/modules/product/components/option/OptionStoreOverridesTab.vue` |
| Rewrite | `src/modules/product/components/product/ProductTagsTab.vue` |
