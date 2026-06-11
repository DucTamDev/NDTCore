# FE Plans D+E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement FE for Plans D (Product Relations: Tags/OptionGroups/OptionConfigs per Product) and E (Store Overrides), plus add detail pages for Product/Category/OptionGroup/Option, and enhance existing list/form components.

**Architecture:** Follows existing module pattern — DTO → API → Service → Composable → View/Component. Detail views use the BrandDetailView pattern: `useAsyncState` + hero card + `v-tabs`/`v-window` + separate tab components. New routes added under `AdminLayout`.

**Tech Stack:** Vue 3 · TypeScript · Pinia · Vuetify 3 · Axios · Vue Router 4

---

## File Map

### New Files
```
NDTCore.FE/src/
├── core/constants/
│   ├── app-routes.constants.ts          MODIFY — add CATEGORY_DETAIL, OPTION_GROUP_DETAIL, OPTION_DETAIL
│   └── api.constants.ts                 MODIFY — add Plan D + Plan E API endpoints
├── modules/product/
│   ├── models/dtos/
│   │   ├── product-relations.dto.ts     CREATE — Plan D request/response types
│   │   └── store-overrides.dto.ts       CREATE — Plan E request/response types
│   ├── api/
│   │   ├── product-relations.api.ts     CREATE
│   │   └── store-overrides.api.ts       CREATE
│   ├── services/
│   │   ├── product-relations.service.ts CREATE
│   │   └── store-overrides.service.ts   CREATE
│   ├── composables/
│   │   ├── useProductRelations.ts       CREATE
│   │   └── useStoreOverrides.ts         CREATE
│   ├── components/
│   │   ├── ProductTagsTab.vue           CREATE
│   │   ├── ProductOptionGroupsTab.vue   CREATE
│   │   ├── ProductOptionConfigsTab.vue  CREATE
│   │   ├── ProductStoreOverridesTab.vue CREATE
│   │   └── OptionStoreOverridesTab.vue  CREATE
│   ├── views/
│   │   ├── ProductDetailView.vue        CREATE
│   │   ├── CategoryDetailView.vue       CREATE
│   │   ├── OptionGroupDetailView.vue    CREATE
│   │   └── OptionDetailView.vue         CREATE
│   ├── components/
│   │   └── OptionForm.vue               MODIFY — add groupId selector
│   └── views/
│       ├── OptionsView.vue              MODIFY — add GroupId filter
│       └── CategoriesView.vue           MODIFY — add ParentId filter
└── router/routes.ts                     MODIFY — register 4 detail routes
```

---

## Task 1: Route + API Constants

**Files:**
- Modify: `src/core/constants/app-routes.constants.ts`
- Modify: `src/core/constants/api.constants.ts`

- [ ] **Step 1: Add detail route constants**

In `app-routes.constants.ts`, add inside the `PRODUCT` block (after `OPTIONS`):

```typescript
CATEGORY_DETAIL: {
    NAME: 'admin:product-category-detail',
    PATH: 'product/categories/:id',
},
OPTION_GROUP_DETAIL: {
    NAME: 'admin:product-option-group-detail',
    PATH: 'product/option-groups/:id',
},
OPTION_DETAIL: {
    NAME: 'admin:product-option-detail',
    PATH: 'product/options/:id',
},
```

(`PRODUCT_DETAIL` for products already exists at `products/:id`.)

- [ ] **Step 2: Add Plan D API endpoints**

In `api.constants.ts`, inside `PRODUCT.PRODUCT_API`, add after `DELETE_IMAGE`:

```typescript
GET_TAGS: (id: number) => `/admin/products/${id}/tags`,
ASSIGN_TAG: (id: number) => `/admin/products/${id}/tags`,
REMOVE_TAG: (id: number, tagId: number) => `/admin/products/${id}/tags/${tagId}`,
GET_OPTION_GROUPS: (id: number) => `/admin/products/${id}/option-groups`,
ASSIGN_OPTION_GROUP: (id: number) => `/admin/products/${id}/option-groups`,
UPDATE_OPTION_GROUP: (id: number, groupId: number) => `/admin/products/${id}/option-groups/${groupId}`,
REMOVE_OPTION_GROUP: (id: number, groupId: number) => `/admin/products/${id}/option-groups/${groupId}`,
GET_OPTION_CONFIGS: (id: number) => `/admin/products/${id}/option-configs`,
UPSERT_OPTION_CONFIG: (id: number) => `/admin/products/${id}/option-configs`,
REMOVE_OPTION_CONFIG: (id: number, optionId: number) => `/admin/products/${id}/option-configs/${optionId}`,
```

- [ ] **Step 3: Add Plan E API endpoints**

In `api.constants.ts`, inside `PRODUCT.PRODUCT_API`, add:

```typescript
GET_STORE_OVERRIDES: (id: number) => `/admin/products/${id}/stores`,
UPSERT_STORE: (id: number) => `/admin/products/${id}/stores`,
REMOVE_STORE: (id: number, storeId: number) => `/admin/products/${id}/stores/${storeId}`,
UPSERT_STORE_PRICE: (id: number) => `/admin/products/${id}/store-prices`,
REMOVE_STORE_PRICE: (id: number, storeId: number) => `/admin/products/${id}/store-prices/${storeId}`,
```

In `api.constants.ts`, inside `PRODUCT.OPTION_API`, add:

```typescript
GET_STORE_AVAILABILITY: (id: number) => `/admin/options/${id}/store-availability`,
UPSERT_STORE_AVAILABILITY: (id: number) => `/admin/options/${id}/store-availability`,
REMOVE_STORE_AVAILABILITY: (id: number, storeId: number) => `/admin/options/${id}/store-availability/${storeId}`,
UPSERT_STORE_PRICE: (id: number) => `/admin/options/${id}/store-prices`,
REMOVE_STORE_PRICE: (id: number, storeId: number) => `/admin/options/${id}/store-prices/${storeId}`,
```

- [ ] **Step 4: Commit**

```bash
git add src/core/constants/
git commit -m "feat(product-fe): add detail route constants and Plan D+E API endpoints"
```

---

## Task 2: Plan D DTOs

**Files:**
- Create: `src/modules/product/models/dtos/product-relations.dto.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/modules/product/models/dtos/product-relations.dto.ts

export interface ProductTagDto {
    ProductId: number
    TagId: number
    TagName: string
}

export interface AssignTagRequest {
    TagId: number
}

export interface ProductOptionGroupDto {
    ProductId: number
    GroupId: number
    GroupName: string
    IsRequired: boolean
    MinSelect: number
    MaxSelect: number
    DisplayOrder: number
}

export interface AssignOptionGroupRequest {
    GroupId: number
    IsRequired: boolean
    MinSelect: number
    MaxSelect: number
    DisplayOrder: number
}

export interface UpdateProductOptionGroupRequest {
    IsRequired: boolean
    MinSelect: number
    MaxSelect: number
    DisplayOrder: number
}

export interface ProductOptionConfigDto {
    ProductId: number
    OptionId: number
    OptionName: string
    CustomPrice: number | null
    IsDefault: boolean
    IsHidden: boolean
}

export interface UpsertOptionConfigRequest {
    OptionId: number
    CustomPrice: number | null
    IsDefault: boolean
    IsHidden: boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/product/models/dtos/product-relations.dto.ts
git commit -m "feat(product-fe): add Plan D DTOs"
```

---

## Task 3: Plan E DTOs

**Files:**
- Create: `src/modules/product/models/dtos/store-overrides.dto.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/modules/product/models/dtos/store-overrides.dto.ts

export interface ProductStoreDto {
    StoreId: number
    ProductId: number
    IsAvailable: boolean
}

export interface UpsertProductStoreRequest {
    StoreId: number
    IsAvailable: boolean
}

export interface ProductStorePriceDto {
    StoreId: number
    ProductId: number
    Price: number
}

export interface UpsertProductStorePriceRequest {
    StoreId: number
    Price: number
}

export interface OptionStoreAvailabilityDto {
    StoreId: number
    OptionId: number
    IsAvailable: boolean
}

export interface UpsertOptionStoreAvailabilityRequest {
    StoreId: number
    IsAvailable: boolean
}

export interface OptionStorePriceDto {
    StoreId: number
    OptionId: number
    Price: number
}

export interface UpsertOptionStorePriceRequest {
    StoreId: number
    Price: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/product/models/dtos/store-overrides.dto.ts
git commit -m "feat(product-fe): add Plan E DTOs"
```

---

## Task 4: Plan D API + Service + Composable

**Files:**
- Create: `src/modules/product/api/product-relations.api.ts`
- Create: `src/modules/product/services/product-relations.service.ts`
- Create: `src/modules/product/composables/useProductRelations.ts`

- [ ] **Step 1: Create `product-relations.api.ts`**

```typescript
// src/modules/product/api/product-relations.api.ts
import { API_ENDPOINTS } from '@/core/constants/api.constants'
import type { ApiResponse } from '@/core/api/dtos/common.dtos'
import { productClient } from '@/core/api/clients/product.client'
import type {
    ProductTagDto,
    AssignTagRequest,
    ProductOptionGroupDto,
    AssignOptionGroupRequest,
    UpdateProductOptionGroupRequest,
    ProductOptionConfigDto,
    UpsertOptionConfigRequest,
} from '../models/dtos/product-relations.dto'

const EP = API_ENDPOINTS.PRODUCT.PRODUCT_API

export const productRelationsApi = {
    // Tags
    getTagsAsync(productId: number): Promise<ApiResponse<ProductTagDto[]>> {
        return productClient.get(EP.GET_TAGS(productId))
    },
    assignTagAsync(productId: number, payload: AssignTagRequest): Promise<ApiResponse<ProductTagDto>> {
        return productClient.post(EP.ASSIGN_TAG(productId), payload)
    },
    removeTagAsync(productId: number, tagId: number): Promise<ApiResponse<ProductTagDto>> {
        return productClient.delete(EP.REMOVE_TAG(productId, tagId))
    },
    // Option Groups
    getOptionGroupsAsync(productId: number): Promise<ApiResponse<ProductOptionGroupDto[]>> {
        return productClient.get(EP.GET_OPTION_GROUPS(productId))
    },
    assignOptionGroupAsync(productId: number, payload: AssignOptionGroupRequest): Promise<ApiResponse<ProductOptionGroupDto>> {
        return productClient.post(EP.ASSIGN_OPTION_GROUP(productId), payload)
    },
    updateOptionGroupAsync(productId: number, groupId: number, payload: UpdateProductOptionGroupRequest): Promise<ApiResponse<ProductOptionGroupDto>> {
        return productClient.put(EP.UPDATE_OPTION_GROUP(productId, groupId), payload)
    },
    removeOptionGroupAsync(productId: number, groupId: number): Promise<ApiResponse<ProductOptionGroupDto>> {
        return productClient.delete(EP.REMOVE_OPTION_GROUP(productId, groupId))
    },
    // Option Configs
    getOptionConfigsAsync(productId: number): Promise<ApiResponse<ProductOptionConfigDto[]>> {
        return productClient.get(EP.GET_OPTION_CONFIGS(productId))
    },
    upsertOptionConfigAsync(productId: number, payload: UpsertOptionConfigRequest): Promise<ApiResponse<ProductOptionConfigDto>> {
        return productClient.post(EP.UPSERT_OPTION_CONFIG(productId), payload)
    },
    removeOptionConfigAsync(productId: number, optionId: number): Promise<ApiResponse<ProductOptionConfigDto>> {
        return productClient.delete(EP.REMOVE_OPTION_CONFIG(productId, optionId))
    },
}
```

- [ ] **Step 2: Create `product-relations.service.ts`**

```typescript
// src/modules/product/services/product-relations.service.ts
import { productRelationsApi } from '../api/product-relations.api'
import type {
    ProductTagDto,
    AssignTagRequest,
    ProductOptionGroupDto,
    AssignOptionGroupRequest,
    UpdateProductOptionGroupRequest,
    ProductOptionConfigDto,
    UpsertOptionConfigRequest,
} from '../models/dtos/product-relations.dto'

class ProductRelationsService {
    async getTagsAsync(productId: number): Promise<ProductTagDto[]> {
        const r = await productRelationsApi.getTagsAsync(productId)
        return r.Data ?? []
    }
    async assignTagAsync(productId: number, payload: AssignTagRequest): Promise<ProductTagDto | null> {
        const r = await productRelationsApi.assignTagAsync(productId, payload)
        return r.Data ?? null
    }
    async removeTagAsync(productId: number, tagId: number): Promise<boolean> {
        await productRelationsApi.removeTagAsync(productId, tagId)
        return true
    }
    async getOptionGroupsAsync(productId: number): Promise<ProductOptionGroupDto[]> {
        const r = await productRelationsApi.getOptionGroupsAsync(productId)
        return r.Data ?? []
    }
    async assignOptionGroupAsync(productId: number, payload: AssignOptionGroupRequest): Promise<ProductOptionGroupDto | null> {
        const r = await productRelationsApi.assignOptionGroupAsync(productId, payload)
        return r.Data ?? null
    }
    async updateOptionGroupAsync(productId: number, groupId: number, payload: UpdateProductOptionGroupRequest): Promise<ProductOptionGroupDto | null> {
        const r = await productRelationsApi.updateOptionGroupAsync(productId, groupId, payload)
        return r.Data ?? null
    }
    async removeOptionGroupAsync(productId: number, groupId: number): Promise<boolean> {
        await productRelationsApi.removeOptionGroupAsync(productId, groupId)
        return true
    }
    async getOptionConfigsAsync(productId: number): Promise<ProductOptionConfigDto[]> {
        const r = await productRelationsApi.getOptionConfigsAsync(productId)
        return r.Data ?? []
    }
    async upsertOptionConfigAsync(productId: number, payload: UpsertOptionConfigRequest): Promise<ProductOptionConfigDto | null> {
        const r = await productRelationsApi.upsertOptionConfigAsync(productId, payload)
        return r.Data ?? null
    }
    async removeOptionConfigAsync(productId: number, optionId: number): Promise<boolean> {
        await productRelationsApi.removeOptionConfigAsync(productId, optionId)
        return true
    }
}

export const productRelationsService = new ProductRelationsService()
```

- [ ] **Step 3: Create `useProductRelations.ts`**

```typescript
// src/modules/product/composables/useProductRelations.ts
import { ref } from 'vue'
import { productRelationsService } from '../services/product-relations.service'
import { useToastNotification } from '@/composables/useToastNotification'
import type {
    ProductTagDto,
    AssignTagRequest,
    ProductOptionGroupDto,
    AssignOptionGroupRequest,
    UpdateProductOptionGroupRequest,
    ProductOptionConfigDto,
    UpsertOptionConfigRequest,
} from '../models/dtos/product-relations.dto'

export function useProductRelations(productId: number) {
    const toast = useToastNotification()
    const isLoading = ref(false)
    const isSubmitting = ref(false)

    const tags = ref<ProductTagDto[]>([])
    const optionGroups = ref<ProductOptionGroupDto[]>([])
    const optionConfigs = ref<ProductOptionConfigDto[]>([])

    async function loadTags() {
        isLoading.value = true
        try { tags.value = await productRelationsService.getTagsAsync(productId) }
        catch { toast.error('Không thể tải danh sách tags.') }
        finally { isLoading.value = false }
    }

    async function assignTag(payload: AssignTagRequest): Promise<boolean> {
        isSubmitting.value = true
        try {
            const r = await productRelationsService.assignTagAsync(productId, payload)
            if (r) { toast.success('Gán tag thành công.'); return true }
            return false
        } catch { toast.error('Gán tag thất bại.'); return false }
        finally { isSubmitting.value = false }
    }

    async function removeTag(tagId: number): Promise<boolean> {
        try {
            await productRelationsService.removeTagAsync(productId, tagId)
            toast.success('Bỏ tag thành công.')
            return true
        } catch { toast.error('Bỏ tag thất bại.'); return false }
    }

    async function loadOptionGroups() {
        isLoading.value = true
        try { optionGroups.value = await productRelationsService.getOptionGroupsAsync(productId) }
        catch { toast.error('Không thể tải nhóm option.') }
        finally { isLoading.value = false }
    }

    async function assignOptionGroup(payload: AssignOptionGroupRequest): Promise<boolean> {
        isSubmitting.value = true
        try {
            const r = await productRelationsService.assignOptionGroupAsync(productId, payload)
            if (r) { toast.success('Gán nhóm option thành công.'); return true }
            return false
        } catch { toast.error('Gán nhóm option thất bại.'); return false }
        finally { isSubmitting.value = false }
    }

    async function updateOptionGroup(groupId: number, payload: UpdateProductOptionGroupRequest): Promise<boolean> {
        isSubmitting.value = true
        try {
            const r = await productRelationsService.updateOptionGroupAsync(productId, groupId, payload)
            if (r) { toast.success('Cập nhật nhóm option thành công.'); return true }
            return false
        } catch { toast.error('Cập nhật thất bại.'); return false }
        finally { isSubmitting.value = false }
    }

    async function removeOptionGroup(groupId: number): Promise<boolean> {
        try {
            await productRelationsService.removeOptionGroupAsync(productId, groupId)
            toast.success('Bỏ nhóm option thành công.')
            return true
        } catch { toast.error('Bỏ nhóm option thất bại.'); return false }
    }

    async function loadOptionConfigs() {
        isLoading.value = true
        try { optionConfigs.value = await productRelationsService.getOptionConfigsAsync(productId) }
        catch { toast.error('Không thể tải cấu hình option.') }
        finally { isLoading.value = false }
    }

    async function upsertOptionConfig(payload: UpsertOptionConfigRequest): Promise<boolean> {
        isSubmitting.value = true
        try {
            const r = await productRelationsService.upsertOptionConfigAsync(productId, payload)
            if (r) { toast.success('Lưu cấu hình option thành công.'); return true }
            return false
        } catch { toast.error('Lưu cấu hình option thất bại.'); return false }
        finally { isSubmitting.value = false }
    }

    async function removeOptionConfig(optionId: number): Promise<boolean> {
        try {
            await productRelationsService.removeOptionConfigAsync(productId, optionId)
            toast.success('Xóa cấu hình option thành công.')
            return true
        } catch { toast.error('Xóa cấu hình option thất bại.'); return false }
    }

    return {
        isLoading, isSubmitting,
        tags, optionGroups, optionConfigs,
        loadTags, assignTag, removeTag,
        loadOptionGroups, assignOptionGroup, updateOptionGroup, removeOptionGroup,
        loadOptionConfigs, upsertOptionConfig, removeOptionConfig,
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/product/api/product-relations.api.ts
git add src/modules/product/services/product-relations.service.ts
git add src/modules/product/composables/useProductRelations.ts
git commit -m "feat(product-fe): add Plan D API, service, composable"
```

---

## Task 5: Plan E API + Service + Composable

**Files:**
- Create: `src/modules/product/api/store-overrides.api.ts`
- Create: `src/modules/product/services/store-overrides.service.ts`
- Create: `src/modules/product/composables/useStoreOverrides.ts`

- [ ] **Step 1: Create `store-overrides.api.ts`**

```typescript
// src/modules/product/api/store-overrides.api.ts
import { API_ENDPOINTS } from '@/core/constants/api.constants'
import type { ApiResponse } from '@/core/api/dtos/common.dtos'
import { productClient } from '@/core/api/clients/product.client'
import type {
    ProductStoreDto,
    UpsertProductStoreRequest,
    ProductStorePriceDto,
    UpsertProductStorePriceRequest,
    OptionStoreAvailabilityDto,
    UpsertOptionStoreAvailabilityRequest,
    OptionStorePriceDto,
    UpsertOptionStorePriceRequest,
} from '../models/dtos/store-overrides.dto'

const PROD = API_ENDPOINTS.PRODUCT.PRODUCT_API
const OPT = API_ENDPOINTS.PRODUCT.OPTION_API

export const storeOverridesApi = {
    // Product stores
    getProductStoresAsync(productId: number): Promise<ApiResponse<ProductStoreDto[]>> {
        return productClient.get(PROD.GET_STORE_OVERRIDES(productId))
    },
    upsertProductStoreAsync(productId: number, payload: UpsertProductStoreRequest): Promise<ApiResponse<ProductStoreDto>> {
        return productClient.put(PROD.UPSERT_STORE(productId), payload)
    },
    removeProductStoreAsync(productId: number, storeId: number): Promise<ApiResponse<ProductStoreDto>> {
        return productClient.delete(PROD.REMOVE_STORE(productId, storeId))
    },
    // Product store prices
    upsertProductStorePriceAsync(productId: number, payload: UpsertProductStorePriceRequest): Promise<ApiResponse<ProductStorePriceDto>> {
        return productClient.put(PROD.UPSERT_STORE_PRICE(productId), payload)
    },
    removeProductStorePriceAsync(productId: number, storeId: number): Promise<ApiResponse<ProductStorePriceDto>> {
        return productClient.delete(PROD.REMOVE_STORE_PRICE(productId, storeId))
    },
    // Option store availability
    getOptionStoreAvailabilityAsync(optionId: number): Promise<ApiResponse<OptionStoreAvailabilityDto[]>> {
        return productClient.get(OPT.GET_STORE_AVAILABILITY(optionId))
    },
    upsertOptionStoreAvailabilityAsync(optionId: number, payload: UpsertOptionStoreAvailabilityRequest): Promise<ApiResponse<OptionStoreAvailabilityDto>> {
        return productClient.put(OPT.UPSERT_STORE_AVAILABILITY(optionId), payload)
    },
    removeOptionStoreAvailabilityAsync(optionId: number, storeId: number): Promise<ApiResponse<OptionStoreAvailabilityDto>> {
        return productClient.delete(OPT.REMOVE_STORE_AVAILABILITY(optionId, storeId))
    },
    // Option store prices
    upsertOptionStorePriceAsync(optionId: number, payload: UpsertOptionStorePriceRequest): Promise<ApiResponse<OptionStorePriceDto>> {
        return productClient.put(OPT.UPSERT_STORE_PRICE(optionId), payload)
    },
    removeOptionStorePriceAsync(optionId: number, storeId: number): Promise<ApiResponse<OptionStorePriceDto>> {
        return productClient.delete(OPT.REMOVE_STORE_PRICE(optionId, storeId))
    },
}
```

- [ ] **Step 2: Create `store-overrides.service.ts`**

```typescript
// src/modules/product/services/store-overrides.service.ts
import { storeOverridesApi } from '../api/store-overrides.api'
import type {
    ProductStoreDto,
    UpsertProductStoreRequest,
    ProductStorePriceDto,
    UpsertProductStorePriceRequest,
    OptionStoreAvailabilityDto,
    UpsertOptionStoreAvailabilityRequest,
    OptionStorePriceDto,
    UpsertOptionStorePriceRequest,
} from '../models/dtos/store-overrides.dto'

class StoreOverridesService {
    async getProductStoresAsync(productId: number): Promise<ProductStoreDto[]> {
        const r = await storeOverridesApi.getProductStoresAsync(productId)
        return r.Data ?? []
    }
    async upsertProductStoreAsync(productId: number, payload: UpsertProductStoreRequest): Promise<ProductStoreDto | null> {
        const r = await storeOverridesApi.upsertProductStoreAsync(productId, payload)
        return r.Data ?? null
    }
    async removeProductStoreAsync(productId: number, storeId: number): Promise<boolean> {
        await storeOverridesApi.removeProductStoreAsync(productId, storeId)
        return true
    }
    async upsertProductStorePriceAsync(productId: number, payload: UpsertProductStorePriceRequest): Promise<ProductStorePriceDto | null> {
        const r = await storeOverridesApi.upsertProductStorePriceAsync(productId, payload)
        return r.Data ?? null
    }
    async removeProductStorePriceAsync(productId: number, storeId: number): Promise<boolean> {
        await storeOverridesApi.removeProductStorePriceAsync(productId, storeId)
        return true
    }
    async getOptionStoreAvailabilityAsync(optionId: number): Promise<OptionStoreAvailabilityDto[]> {
        const r = await storeOverridesApi.getOptionStoreAvailabilityAsync(optionId)
        return r.Data ?? []
    }
    async upsertOptionStoreAvailabilityAsync(optionId: number, payload: UpsertOptionStoreAvailabilityRequest): Promise<OptionStoreAvailabilityDto | null> {
        const r = await storeOverridesApi.upsertOptionStoreAvailabilityAsync(optionId, payload)
        return r.Data ?? null
    }
    async removeOptionStoreAvailabilityAsync(optionId: number, storeId: number): Promise<boolean> {
        await storeOverridesApi.removeOptionStoreAvailabilityAsync(optionId, storeId)
        return true
    }
    async upsertOptionStorePriceAsync(optionId: number, payload: UpsertOptionStorePriceRequest): Promise<OptionStorePriceDto | null> {
        const r = await storeOverridesApi.upsertOptionStorePriceAsync(optionId, payload)
        return r.Data ?? null
    }
    async removeOptionStorePriceAsync(optionId: number, storeId: number): Promise<boolean> {
        await storeOverridesApi.removeOptionStorePriceAsync(optionId, storeId)
        return true
    }
}

export const storeOverridesService = new StoreOverridesService()
```

- [ ] **Step 3: Create `useStoreOverrides.ts`**

```typescript
// src/modules/product/composables/useStoreOverrides.ts
import { ref } from 'vue'
import { storeOverridesService } from '../services/store-overrides.service'
import { useToastNotification } from '@/composables/useToastNotification'
import type {
    ProductStoreDto,
    UpsertProductStoreRequest,
    UpsertProductStorePriceRequest,
    OptionStoreAvailabilityDto,
    UpsertOptionStoreAvailabilityRequest,
    UpsertOptionStorePriceRequest,
} from '../models/dtos/store-overrides.dto'

export function useProductStoreOverrides(productId: number) {
    const toast = useToastNotification()
    const isLoading = ref(false)
    const isSubmitting = ref(false)
    const stores = ref<ProductStoreDto[]>([])

    async function loadStores() {
        isLoading.value = true
        try { stores.value = await storeOverridesService.getProductStoresAsync(productId) }
        catch { toast.error('Không thể tải thông tin cửa hàng.') }
        finally { isLoading.value = false }
    }

    async function upsertStore(payload: UpsertProductStoreRequest): Promise<boolean> {
        isSubmitting.value = true
        try {
            const r = await storeOverridesService.upsertProductStoreAsync(productId, payload)
            if (r) { toast.success('Lưu thành công.'); return true }
            return false
        } catch { toast.error('Lưu thất bại.'); return false }
        finally { isSubmitting.value = false }
    }

    async function removeStore(storeId: number): Promise<boolean> {
        try {
            await storeOverridesService.removeProductStoreAsync(productId, storeId)
            toast.success('Xóa thành công.')
            return true
        } catch { toast.error('Xóa thất bại.'); return false }
    }

    async function upsertStorePrice(payload: UpsertProductStorePriceRequest): Promise<boolean> {
        isSubmitting.value = true
        try {
            const r = await storeOverridesService.upsertProductStorePriceAsync(productId, payload)
            if (r) { toast.success('Cập nhật giá thành công.'); return true }
            return false
        } catch { toast.error('Cập nhật giá thất bại.'); return false }
        finally { isSubmitting.value = false }
    }

    async function removeStorePrice(storeId: number): Promise<boolean> {
        try {
            await storeOverridesService.removeProductStorePriceAsync(productId, storeId)
            toast.success('Xóa giá thành công.')
            return true
        } catch { toast.error('Xóa giá thất bại.'); return false }
    }

    return { isLoading, isSubmitting, stores, loadStores, upsertStore, removeStore, upsertStorePrice, removeStorePrice }
}

export function useOptionStoreOverrides(optionId: number) {
    const toast = useToastNotification()
    const isLoading = ref(false)
    const isSubmitting = ref(false)
    const availability = ref<OptionStoreAvailabilityDto[]>([])

    async function loadAvailability() {
        isLoading.value = true
        try { availability.value = await storeOverridesService.getOptionStoreAvailabilityAsync(optionId) }
        catch { toast.error('Không thể tải thông tin availability.') }
        finally { isLoading.value = false }
    }

    async function upsertAvailability(payload: UpsertOptionStoreAvailabilityRequest): Promise<boolean> {
        isSubmitting.value = true
        try {
            const r = await storeOverridesService.upsertOptionStoreAvailabilityAsync(optionId, payload)
            if (r) { toast.success('Lưu thành công.'); return true }
            return false
        } catch { toast.error('Lưu thất bại.'); return false }
        finally { isSubmitting.value = false }
    }

    async function removeAvailability(storeId: number): Promise<boolean> {
        try {
            await storeOverridesService.removeOptionStoreAvailabilityAsync(optionId, storeId)
            toast.success('Xóa thành công.')
            return true
        } catch { toast.error('Xóa thất bại.'); return false }
    }

    async function upsertPrice(payload: UpsertOptionStorePriceRequest): Promise<boolean> {
        isSubmitting.value = true
        try {
            const r = await storeOverridesService.upsertOptionStorePriceAsync(optionId, payload)
            if (r) { toast.success('Cập nhật giá thành công.'); return true }
            return false
        } catch { toast.error('Cập nhật giá thất bại.'); return false }
        finally { isSubmitting.value = false }
    }

    async function removePrice(storeId: number): Promise<boolean> {
        try {
            await storeOverridesService.removeOptionStorePriceAsync(optionId, storeId)
            toast.success('Xóa giá thành công.')
            return true
        } catch { toast.error('Xóa giá thất bại.'); return false }
    }

    return { isLoading, isSubmitting, availability, loadAvailability, upsertAvailability, removeAvailability, upsertPrice, removePrice }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/product/api/store-overrides.api.ts
git add src/modules/product/services/store-overrides.service.ts
git add src/modules/product/composables/useStoreOverrides.ts
git commit -m "feat(product-fe): add Plan E API, service, composable"
```

---

## Task 6: ProductDetailView + Tab Components

**Files:**
- Create: `src/modules/product/views/ProductDetailView.vue`
- Create: `src/modules/product/components/ProductTagsTab.vue`
- Create: `src/modules/product/components/ProductOptionGroupsTab.vue`
- Create: `src/modules/product/components/ProductOptionConfigsTab.vue`
- Create: `src/modules/product/components/ProductStoreOverridesTab.vue`

- [ ] **Step 1: Create `ProductTagsTab.vue`**

```vue
<!-- src/modules/product/components/ProductTagsTab.vue -->
<template>
    <div class="pa-4 d-flex flex-column ga-4">
        <div class="d-flex align-center justify-space-between">
            <span class="text-subtitle-2 text-medium-emphasis">Tags đang gán</span>
            <v-btn size="small" color="primary" prepend-icon="mdi-plus" @click="showAssign = true">
                Gán tag
            </v-btn>
        </div>

        <v-progress-linear v-if="isLoading" indeterminate color="primary" />

        <v-chip-group v-if="tags.length">
            <v-chip
                v-for="t in tags"
                :key="t.TagId"
                closable
                :disabled="isSubmitting"
                @click:close="onRemove(t.TagId)"
            >
                {{ t.TagName }}
            </v-chip>
        </v-chip-group>
        <v-alert v-else-if="!isLoading" type="info" variant="tonal" density="compact">
            Chưa có tag nào được gán.
        </v-alert>

        <AppDialog v-model="showAssign" title="Gán tag" :hide-actions="true" max-width="500px">
            <div class="pa-2 d-flex flex-column ga-3">
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
                    <v-btn color="primary" :loading="isSubmitting" :disabled="!selectedTagId" @click="onAssign">
                        Gán
                    </v-btn>
                </div>
            </div>
        </AppDialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { AppDialog } from '@/components/ui'
import { useProductRelations } from '../composables/useProductRelations'
import { useTagStore } from '../stores/tag.store'

const props = defineProps<{ productId: number }>()

const { isLoading, isSubmitting, tags, loadTags, assignTag, removeTag } = useProductRelations(props.productId)
const tagStore = useTagStore()
const availableTags = ref<{ id: number; name: string }[]>([])
const showAssign = ref(false)
const selectedTagId = ref<number | null>(null)

async function onAssign() {
    if (!selectedTagId.value) return
    const ok = await assignTag({ TagId: selectedTagId.value })
    if (ok) { showAssign.value = false; selectedTagId.value = null; await loadTags() }
}

async function onRemove(tagId: number) {
    const ok = await removeTag(tagId)
    if (ok) await loadTags()
}

onMounted(async () => {
    await tagStore.fetchPaged({ PageNumber: 1, PageSize: 200 })
    availableTags.value = tagStore.items.map(t => ({ id: t.id, name: t.name }))
    await loadTags()
})
</script>
```

- [ ] **Step 2: Create `ProductOptionGroupsTab.vue`**

```vue
<!-- src/modules/product/components/ProductOptionGroupsTab.vue -->
<template>
    <div class="pa-4 d-flex flex-column ga-4">
        <div class="d-flex align-center justify-space-between">
            <span class="text-subtitle-2 text-medium-emphasis">Nhóm option đã gán</span>
            <v-btn size="small" color="primary" prepend-icon="mdi-plus" @click="openAssignDialog">
                Gán nhóm
            </v-btn>
        </div>

        <v-progress-linear v-if="isLoading" indeterminate color="primary" />

        <v-table v-if="optionGroups.length" density="compact">
            <thead>
                <tr>
                    <th>Nhóm</th>
                    <th class="text-center">Bắt buộc</th>
                    <th class="text-center">Min</th>
                    <th class="text-center">Max</th>
                    <th class="text-center">Thứ tự</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="og in optionGroups" :key="og.GroupId">
                    <td>{{ og.GroupName }}</td>
                    <td class="text-center">
                        <v-icon :color="og.IsRequired ? 'success' : 'grey'" :icon="og.IsRequired ? 'mdi-check' : 'mdi-minus'" />
                    </td>
                    <td class="text-center">{{ og.MinSelect }}</td>
                    <td class="text-center">{{ og.MaxSelect }}</td>
                    <td class="text-center">{{ og.DisplayOrder }}</td>
                    <td class="text-end">
                        <v-btn size="x-small" icon="mdi-pencil-outline" variant="text" color="primary" @click="openEditDialog(og)" />
                        <v-btn size="x-small" icon="mdi-delete-outline" variant="text" color="error" @click="onRemove(og.GroupId)" />
                    </td>
                </tr>
            </tbody>
        </v-table>
        <v-alert v-else-if="!isLoading" type="info" variant="tonal" density="compact">
            Chưa có nhóm option nào được gán.
        </v-alert>

        <!-- Assign dialog -->
        <AppDialog v-model="showAssign" title="Gán nhóm option" :hide-actions="true" max-width="500px">
            <div class="pa-2 d-flex flex-column ga-3">
                <v-autocomplete v-model="assignForm.GroupId" :items="allGroups" item-value="id" item-title="name" label="Nhóm option *" />
                <v-row>
                    <v-col cols="6"><v-text-field v-model.number="assignForm.MinSelect" label="Min select" type="number" min="0" /></v-col>
                    <v-col cols="6"><v-text-field v-model.number="assignForm.MaxSelect" label="Max select" type="number" min="0" /></v-col>
                </v-row>
                <v-row>
                    <v-col cols="6"><v-text-field v-model.number="assignForm.DisplayOrder" label="Thứ tự" type="number" min="0" /></v-col>
                    <v-col cols="6" class="d-flex align-center"><v-switch v-model="assignForm.IsRequired" label="Bắt buộc" color="primary" /></v-col>
                </v-row>
                <div class="d-flex justify-end ga-2">
                    <v-btn variant="text" @click="showAssign = false">Hủy</v-btn>
                    <v-btn color="primary" :loading="isSubmitting" @click="onAssign">Gán</v-btn>
                </div>
            </div>
        </AppDialog>

        <!-- Edit dialog -->
        <AppDialog v-model="showEdit" title="Cập nhật nhóm option" :hide-actions="true" max-width="500px">
            <div class="pa-2 d-flex flex-column ga-3">
                <v-row>
                    <v-col cols="6"><v-text-field v-model.number="editForm.MinSelect" label="Min select" type="number" min="0" /></v-col>
                    <v-col cols="6"><v-text-field v-model.number="editForm.MaxSelect" label="Max select" type="number" min="0" /></v-col>
                </v-row>
                <v-row>
                    <v-col cols="6"><v-text-field v-model.number="editForm.DisplayOrder" label="Thứ tự" type="number" min="0" /></v-col>
                    <v-col cols="6" class="d-flex align-center"><v-switch v-model="editForm.IsRequired" label="Bắt buộc" color="primary" /></v-col>
                </v-row>
                <div class="d-flex justify-end ga-2">
                    <v-btn variant="text" @click="showEdit = false">Hủy</v-btn>
                    <v-btn color="primary" :loading="isSubmitting" @click="onUpdate">Cập nhật</v-btn>
                </div>
            </div>
        </AppDialog>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { AppDialog } from '@/components/ui'
import { useProductRelations } from '../composables/useProductRelations'
import { useOptionGroupStore } from '../stores/option-group.store'
import type { ProductOptionGroupDto } from '../models/dtos/product-relations.dto'

const props = defineProps<{ productId: number }>()
const { isLoading, isSubmitting, optionGroups, loadOptionGroups, assignOptionGroup, updateOptionGroup, removeOptionGroup } = useProductRelations(props.productId)

const groupStore = useOptionGroupStore()
const allGroups = ref<{ id: number; name: string }[]>([])

const showAssign = ref(false)
const assignForm = reactive({ GroupId: 0, IsRequired: false, MinSelect: 0, MaxSelect: 1, DisplayOrder: 0 })

const showEdit = ref(false)
const editGroupId = ref(0)
const editForm = reactive({ IsRequired: false, MinSelect: 0, MaxSelect: 1, DisplayOrder: 0 })

function openAssignDialog() {
    Object.assign(assignForm, { GroupId: 0, IsRequired: false, MinSelect: 0, MaxSelect: 1, DisplayOrder: 0 })
    showAssign.value = true
}

function openEditDialog(og: ProductOptionGroupDto) {
    editGroupId.value = og.GroupId
    Object.assign(editForm, { IsRequired: og.IsRequired, MinSelect: og.MinSelect, MaxSelect: og.MaxSelect, DisplayOrder: og.DisplayOrder })
    showEdit.value = true
}

async function onAssign() {
    const ok = await assignOptionGroup({ ...assignForm })
    if (ok) { showAssign.value = false; await loadOptionGroups() }
}

async function onUpdate() {
    const ok = await updateOptionGroup(editGroupId.value, { ...editForm })
    if (ok) { showEdit.value = false; await loadOptionGroups() }
}

async function onRemove(groupId: number) {
    const ok = await removeOptionGroup(groupId)
    if (ok) await loadOptionGroups()
}

onMounted(async () => {
    await groupStore.fetchPaged({ PageNumber: 1, PageSize: 200 })
    allGroups.value = groupStore.items.map(g => ({ id: g.id, name: g.name }))
    await loadOptionGroups()
})
</script>
```

- [ ] **Step 3: Create `ProductOptionConfigsTab.vue`**

```vue
<!-- src/modules/product/components/ProductOptionConfigsTab.vue -->
<template>
    <div class="pa-4 d-flex flex-column ga-4">
        <div class="d-flex align-center justify-space-between">
            <span class="text-subtitle-2 text-medium-emphasis">Cấu hình option</span>
            <v-btn size="small" color="primary" prepend-icon="mdi-plus" @click="openDialog(null)">
                Thêm / cập nhật
            </v-btn>
        </div>

        <v-progress-linear v-if="isLoading" indeterminate color="primary" />

        <v-table v-if="optionConfigs.length" density="compact">
            <thead>
                <tr>
                    <th>Option</th>
                    <th class="text-end">Giá tùy chỉnh</th>
                    <th class="text-center">Mặc định</th>
                    <th class="text-center">Ẩn</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="cfg in optionConfigs" :key="cfg.OptionId">
                    <td>{{ cfg.OptionName }}</td>
                    <td class="text-end">{{ cfg.CustomPrice != null ? cfg.CustomPrice.toLocaleString() : '—' }}</td>
                    <td class="text-center"><v-icon :color="cfg.IsDefault ? 'success' : 'grey'" :icon="cfg.IsDefault ? 'mdi-check' : 'mdi-minus'" /></td>
                    <td class="text-center"><v-icon :color="cfg.IsHidden ? 'error' : 'grey'" :icon="cfg.IsHidden ? 'mdi-eye-off' : 'mdi-eye'" /></td>
                    <td class="text-end">
                        <v-btn size="x-small" icon="mdi-pencil-outline" variant="text" color="primary" @click="openDialog(cfg)" />
                        <v-btn size="x-small" icon="mdi-delete-outline" variant="text" color="error" @click="onRemove(cfg.OptionId)" />
                    </td>
                </tr>
            </tbody>
        </v-table>
        <v-alert v-else-if="!isLoading" type="info" variant="tonal" density="compact">
            Chưa có cấu hình option nào.
        </v-alert>

        <AppDialog v-model="showDialog" title="Cấu hình option" :hide-actions="true" max-width="500px">
            <div class="pa-2 d-flex flex-column ga-3">
                <v-autocomplete v-model="form.OptionId" :items="allOptions" item-value="id" item-title="name" label="Option *" :disabled="!!editCfg" />
                <v-text-field v-model.number="form.CustomPrice" label="Giá tùy chỉnh" type="number" min="0" clearable />
                <v-row>
                    <v-col cols="6"><v-switch v-model="form.IsDefault" label="Mặc định" color="primary" /></v-col>
                    <v-col cols="6"><v-switch v-model="form.IsHidden" label="Ẩn" color="error" /></v-col>
                </v-row>
                <div class="d-flex justify-end ga-2">
                    <v-btn variant="text" @click="showDialog = false">Hủy</v-btn>
                    <v-btn color="primary" :loading="isSubmitting" @click="onUpsert">Lưu</v-btn>
                </div>
            </div>
        </AppDialog>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { AppDialog } from '@/components/ui'
import { useProductRelations } from '../composables/useProductRelations'
import { useOptionStore } from '../stores/option.store'
import type { ProductOptionConfigDto } from '../models/dtos/product-relations.dto'

const props = defineProps<{ productId: number }>()
const { isLoading, isSubmitting, optionConfigs, loadOptionConfigs, upsertOptionConfig, removeOptionConfig } = useProductRelations(props.productId)

const optionStore = useOptionStore()
const allOptions = ref<{ id: number; name: string }[]>([])
const showDialog = ref(false)
const editCfg = ref<ProductOptionConfigDto | null>(null)
const form = reactive({ OptionId: 0, CustomPrice: null as number | null, IsDefault: false, IsHidden: false })

function openDialog(cfg: ProductOptionConfigDto | null) {
    editCfg.value = cfg
    if (cfg) {
        Object.assign(form, { OptionId: cfg.OptionId, CustomPrice: cfg.CustomPrice, IsDefault: cfg.IsDefault, IsHidden: cfg.IsHidden })
    } else {
        Object.assign(form, { OptionId: 0, CustomPrice: null, IsDefault: false, IsHidden: false })
    }
    showDialog.value = true
}

async function onUpsert() {
    const ok = await upsertOptionConfig({ OptionId: form.OptionId, CustomPrice: form.CustomPrice, IsDefault: form.IsDefault, IsHidden: form.IsHidden })
    if (ok) { showDialog.value = false; await loadOptionConfigs() }
}

async function onRemove(optionId: number) {
    const ok = await removeOptionConfig(optionId)
    if (ok) await loadOptionConfigs()
}

onMounted(async () => {
    await optionStore.fetchPaged({ PageNumber: 1, PageSize: 500 })
    allOptions.value = optionStore.items.map(o => ({ id: o.id, name: o.name }))
    await loadOptionConfigs()
})
</script>
```

- [ ] **Step 4: Create `ProductStoreOverridesTab.vue`**

```vue
<!-- src/modules/product/components/ProductStoreOverridesTab.vue -->
<template>
    <div class="pa-4 d-flex flex-column ga-4">
        <v-row>
            <!-- Availability column -->
            <v-col cols="12" md="6">
                <v-card variant="outlined" rounded="lg">
                    <v-card-title class="text-subtitle-2 pa-3">Khả dụng theo cửa hàng</v-card-title>
                    <v-divider />
                    <v-card-text>
                        <v-progress-linear v-if="isLoading" indeterminate color="primary" class="mb-2" />
                        <v-table density="compact" v-if="stores.length">
                            <thead><tr><th>Store ID</th><th class="text-center">Khả dụng</th><th></th></tr></thead>
                            <tbody>
                                <tr v-for="s in stores" :key="s.StoreId">
                                    <td>{{ s.StoreId }}</td>
                                    <td class="text-center">
                                        <v-icon :color="s.IsAvailable ? 'success' : 'error'" :icon="s.IsAvailable ? 'mdi-check-circle' : 'mdi-close-circle'" />
                                    </td>
                                    <td class="text-end">
                                        <v-btn size="x-small" icon="mdi-delete-outline" variant="text" color="error" @click="onRemoveStore(s.StoreId)" />
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                        <v-alert v-else-if="!isLoading" type="info" variant="tonal" density="compact" class="mb-2">Chưa có cài đặt.</v-alert>
                        <div class="d-flex ga-2 mt-2">
                            <v-text-field v-model.number="newStoreId" label="Store ID" type="number" density="compact" hide-details />
                            <v-switch v-model="newIsAvailable" label="Khả dụng" color="primary" hide-details />
                            <v-btn color="primary" size="small" :loading="isSubmitting" @click="onUpsertStore">Lưu</v-btn>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>

            <!-- Price column -->
            <v-col cols="12" md="6">
                <v-card variant="outlined" rounded="lg">
                    <v-card-title class="text-subtitle-2 pa-3">Giá theo cửa hàng</v-card-title>
                    <v-divider />
                    <v-card-text>
                        <p class="text-body-2 text-medium-emphasis mb-3">
                            Thêm/sửa giá cho từng cửa hàng bằng Store ID bên dưới.
                        </p>
                        <div class="d-flex ga-2">
                            <v-text-field v-model.number="priceStoreId" label="Store ID" type="number" density="compact" hide-details />
                            <v-text-field v-model.number="priceValue" label="Giá" type="number" density="compact" hide-details />
                            <v-btn color="primary" size="small" :loading="isSubmitting" @click="onUpsertPrice">Lưu</v-btn>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProductStoreOverrides } from '../composables/useStoreOverrides'

const props = defineProps<{ productId: number }>()
const { isLoading, isSubmitting, stores, loadStores, upsertStore, removeStore, upsertStorePrice, removeStorePrice } =
    useProductStoreOverrides(props.productId)

const newStoreId = ref(0)
const newIsAvailable = ref(true)
const priceStoreId = ref(0)
const priceValue = ref(0)

async function onUpsertStore() {
    const ok = await upsertStore({ StoreId: newStoreId.value, IsAvailable: newIsAvailable.value })
    if (ok) { newStoreId.value = 0; await loadStores() }
}

async function onRemoveStore(storeId: number) {
    const ok = await removeStore(storeId)
    if (ok) await loadStores()
}

async function onUpsertPrice() {
    await upsertStorePrice({ StoreId: priceStoreId.value, Price: priceValue.value })
    priceStoreId.value = 0
    priceValue.value = 0
}

onMounted(loadStores)
</script>
```

- [ ] **Step 5: Create `ProductDetailView.vue`**

```vue
<!-- src/modules/product/views/ProductDetailView.vue -->
<template>
    <div class="d-flex flex-column ga-5">
        <template v-if="product.loading.value">
            <v-skeleton-loader type="heading" />
            <v-skeleton-loader type="card" height="120" />
            <v-skeleton-loader type="card" />
        </template>

        <template v-else-if="product.data.value">
            <v-card variant="tonal" color="primary" rounded="lg" flat>
                <v-card-text class="pa-5">
                    <AppBreadcrumb
                        :items="[
                            { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                            { title: 'Sản phẩm', to: { name: APP_ROUTES.PRODUCT.PRODUCTS.NAME } },
                            { title: product.data.value.name, disabled: true },
                        ]"
                    />
                    <div class="d-flex align-center ga-3 mt-3">
                        <v-sheet rounded="lg" width="52" height="52" class="d-flex align-center justify-center flex-shrink-0">
                            <v-icon icon="mdi-package-variant-closed" size="28" color="primary" />
                        </v-sheet>
                        <div>
                            <div class="text-h6 font-weight-bold">{{ product.data.value.name }}</div>
                            <div class="text-body-2 text-medium-emphasis">SKU: {{ product.data.value.sku }}</div>
                        </div>
                    </div>
                </v-card-text>
            </v-card>

            <v-card rounded="lg" elevation="1">
                <v-tabs v-model="activeTab" color="primary" class="px-2">
                    <v-tab value="info" class="text-none" rounded="lg">
                        <v-icon start icon="mdi-information-outline" size="18" />Thông tin
                    </v-tab>
                    <v-tab value="tags" class="text-none" rounded="lg">
                        <v-icon start icon="mdi-tag-multiple-outline" size="18" />Tags
                    </v-tab>
                    <v-tab value="option-groups" class="text-none" rounded="lg">
                        <v-icon start icon="mdi-tune-variant" size="18" />Nhóm option
                    </v-tab>
                    <v-tab value="option-configs" class="text-none" rounded="lg">
                        <v-icon start icon="mdi-cog-outline" size="18" />Cấu hình option
                    </v-tab>
                    <v-tab value="stores" class="text-none" rounded="lg">
                        <v-icon start icon="mdi-store-outline" size="18" />Cửa hàng
                    </v-tab>
                </v-tabs>
                <v-divider />
                <v-window v-model="activeTab">
                    <v-window-item value="info">
                        <div class="pa-4">
                            <v-row>
                                <v-col cols="12" md="6">
                                    <v-list density="compact">
                                        <v-list-item title="Tên" :subtitle="product.data.value.name" />
                                        <v-list-item title="SKU" :subtitle="product.data.value.sku" />
                                        <v-list-item title="Slug" :subtitle="product.data.value.slug ?? '—'" />
                                        <v-list-item title="Danh mục" :subtitle="product.data.value.categoryId?.toString() ?? '—'" />
                                    </v-list>
                                </v-col>
                                <v-col cols="12" md="6">
                                    <v-list density="compact">
                                        <v-list-item title="Giá cơ bản" :subtitle="product.data.value.basePrice?.toLocaleString() ?? '—'" />
                                        <v-list-item title="Giá vốn" :subtitle="product.data.value.costPrice?.toLocaleString() ?? '—'" />
                                        <v-list-item title="Trạng thái" :subtitle="product.data.value.isActive ? 'Hiển thị' : 'Ẩn'" />
                                        <v-list-item title="Nổi bật" :subtitle="product.data.value.isFeatured ? 'Có' : 'Không'" />
                                    </v-list>
                                </v-col>
                            </v-row>
                            <div class="d-flex justify-end mt-2">
                                <v-btn color="primary" prepend-icon="mdi-pencil-outline" @click="$router.push({ name: APP_ROUTES.PRODUCT.PRODUCTS.NAME })">
                                    Chỉnh sửa
                                </v-btn>
                            </div>
                        </div>
                    </v-window-item>
                    <v-window-item value="tags">
                        <ProductTagsTab :product-id="productId" />
                    </v-window-item>
                    <v-window-item value="option-groups">
                        <ProductOptionGroupsTab :product-id="productId" />
                    </v-window-item>
                    <v-window-item value="option-configs">
                        <ProductOptionConfigsTab :product-id="productId" />
                    </v-window-item>
                    <v-window-item value="stores">
                        <ProductStoreOverridesTab :product-id="productId" />
                    </v-window-item>
                </v-window>
            </v-card>
        </template>

        <AppEmptyState
            v-else-if="!product.loading.value"
            icon="mdi-package-variant-closed-remove"
            title="Không tìm thấy sản phẩm"
            description="Sản phẩm này không tồn tại hoặc đã bị xóa."
        >
            <template #actions>
                <v-btn color="primary" prepend-icon="mdi-arrow-left" :to="{ name: APP_ROUTES.PRODUCT.PRODUCTS.NAME }">
                    Quay lại danh sách
                </v-btn>
            </template>
        </AppEmptyState>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { AppBreadcrumb, AppEmptyState } from '@/components/ui'
import { useAsyncState } from '@/composables/useAsyncState'
import { APP_ROUTES } from '@/core/constants/_index'
import { productService } from '../services/product.service'
import ProductTagsTab from '../components/ProductTagsTab.vue'
import ProductOptionGroupsTab from '../components/ProductOptionGroupsTab.vue'
import ProductOptionConfigsTab from '../components/ProductOptionConfigsTab.vue'
import ProductStoreOverridesTab from '../components/ProductStoreOverridesTab.vue'

const route = useRoute()
const productId = Number(route.params['id'])
const activeTab = ref('info')
const product = useAsyncState(() => productService.getByIdAsync(productId))
onMounted(() => product.execute())
</script>
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/product/components/ProductTagsTab.vue
git add src/modules/product/components/ProductOptionGroupsTab.vue
git add src/modules/product/components/ProductOptionConfigsTab.vue
git add src/modules/product/components/ProductStoreOverridesTab.vue
git add src/modules/product/views/ProductDetailView.vue
git commit -m "feat(product-fe): add ProductDetailView with Plans D+E tabs"
```

---

## Task 7: CategoryDetailView

**Files:**
- Create: `src/modules/product/views/CategoryDetailView.vue`

- [ ] **Step 1: Create `CategoryDetailView.vue`**

```vue
<!-- src/modules/product/views/CategoryDetailView.vue -->
<template>
    <div class="d-flex flex-column ga-5">
        <template v-if="category.loading.value">
            <v-skeleton-loader type="heading" />
            <v-skeleton-loader type="card" height="120" />
        </template>

        <template v-else-if="category.data.value">
            <v-card variant="tonal" color="primary" rounded="lg" flat>
                <v-card-text class="pa-5">
                    <AppBreadcrumb
                        :items="[
                            { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                            { title: 'Danh mục', to: { name: APP_ROUTES.PRODUCT.CATEGORIES.NAME } },
                            { title: category.data.value.name, disabled: true },
                        ]"
                    />
                    <div class="d-flex align-center ga-3 mt-3">
                        <v-sheet rounded="lg" width="52" height="52" class="d-flex align-center justify-center flex-shrink-0">
                            <v-icon icon="mdi-shape-outline" size="28" color="primary" />
                        </v-sheet>
                        <div>
                            <div class="text-h6 font-weight-bold">{{ category.data.value.name }}</div>
                            <div class="text-body-2 text-medium-emphasis">{{ category.data.value.slug }}</div>
                        </div>
                        <v-spacer />
                        <AppStatusChip :config="category.data.value.isActive ? STATUS.active : STATUS.inactive" />
                    </div>
                </v-card-text>
            </v-card>

            <v-card rounded="lg" elevation="1">
                <v-tabs v-model="activeTab" color="primary" class="px-2">
                    <v-tab value="info" class="text-none" rounded="lg">
                        <v-icon start icon="mdi-information-outline" size="18" />Thông tin
                    </v-tab>
                    <v-tab value="children" class="text-none" rounded="lg">
                        <v-icon start icon="mdi-sitemap-outline" size="18" />Danh mục con
                    </v-tab>
                </v-tabs>
                <v-divider />
                <v-window v-model="activeTab">
                    <v-window-item value="info">
                        <div class="pa-4">
                            <v-row>
                                <v-col cols="12" md="6">
                                    <v-list density="compact">
                                        <v-list-item title="Tên" :subtitle="category.data.value.name" />
                                        <v-list-item title="Slug" :subtitle="category.data.value.slug" />
                                        <v-list-item title="Thứ tự" :subtitle="category.data.value.displayOrder.toString()" />
                                    </v-list>
                                </v-col>
                                <v-col cols="12" md="6">
                                    <v-list density="compact">
                                        <v-list-item title="Mô tả" :subtitle="category.data.value.description ?? '—'" />
                                        <v-list-item title="Tạo lúc" :subtitle="category.data.value.createdAt ?? '—'" />
                                        <v-list-item title="Cập nhật" :subtitle="category.data.value.updatedAt ?? '—'" />
                                    </v-list>
                                </v-col>
                            </v-row>
                        </div>
                    </v-window-item>
                    <v-window-item value="children">
                        <div class="pa-4">
                            <CategoryList
                                :items="children"
                                :loading="childrenLoading"
                                :page-number="1"
                                :page-size="100"
                                :total-pages="1"
                                :total-items="children.length"
                                @row-action="onChildAction"
                            />
                        </div>
                    </v-window-item>
                </v-window>
            </v-card>
        </template>

        <AppEmptyState
            v-else-if="!category.loading.value"
            icon="mdi-shape-remove"
            title="Không tìm thấy danh mục"
        >
            <template #actions>
                <v-btn color="primary" prepend-icon="mdi-arrow-left" :to="{ name: APP_ROUTES.PRODUCT.CATEGORIES.NAME }">
                    Quay lại
                </v-btn>
            </template>
        </AppEmptyState>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppBreadcrumb, AppEmptyState, AppStatusChip } from '@/components/ui'
import { useAsyncState } from '@/composables/useAsyncState'
import { APP_ROUTES } from '@/core/constants/_index'
import { categoryService } from '../services/category.service'
import CategoryList from '../components/CategoryList.vue'
import type { CategoryViewModel } from '../models/view-models/category.view-model'

const route = useRoute()
const router = useRouter()
const categoryId = Number(route.params['id'])
const activeTab = ref('info')

const STATUS = {
    active: { label: 'Hiển thị', color: 'success', icon: 'mdi-check-circle-outline', variant: 'tonal' as const },
    inactive: { label: 'Ẩn', color: 'default', icon: 'mdi-minus-circle-outline', variant: 'tonal' as const },
}

const category = useAsyncState(() => categoryService.getByIdAsync(categoryId))
const children = ref<CategoryViewModel[]>([])
const childrenLoading = ref(false)

async function loadChildren() {
    childrenLoading.value = true
    try {
        const result = await categoryService.getPagedAsync({ PageNumber: 1, PageSize: 100, ParentId: categoryId })
        children.value = result.items
    } finally {
        childrenLoading.value = false }
}

function onChildAction(key: string, item: CategoryViewModel) {
    if (key === 'detail') router.push({ name: APP_ROUTES.PRODUCT.CATEGORY_DETAIL.NAME, params: { id: item.id } })
}

onMounted(async () => {
    await category.execute()
    await loadChildren()
})
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/product/views/CategoryDetailView.vue
git commit -m "feat(product-fe): add CategoryDetailView"
```

---

## Task 8: OptionGroupDetailView

**Files:**
- Create: `src/modules/product/views/OptionGroupDetailView.vue`

- [ ] **Step 1: Create `OptionGroupDetailView.vue`**

```vue
<!-- src/modules/product/views/OptionGroupDetailView.vue -->
<template>
    <div class="d-flex flex-column ga-5">
        <template v-if="group.loading.value">
            <v-skeleton-loader type="heading" />
            <v-skeleton-loader type="card" height="120" />
            <v-skeleton-loader type="card" />
        </template>

        <template v-else-if="group.data.value">
            <v-card variant="tonal" color="primary" rounded="lg" flat>
                <v-card-text class="pa-5">
                    <AppBreadcrumb
                        :items="[
                            { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                            { title: 'Nhóm option', to: { name: APP_ROUTES.PRODUCT.OPTION_GROUPS.NAME } },
                            { title: group.data.value.name, disabled: true },
                        ]"
                    />
                    <div class="d-flex align-center ga-3 mt-3">
                        <v-sheet rounded="lg" width="52" height="52" class="d-flex align-center justify-center flex-shrink-0">
                            <v-icon icon="mdi-tune-variant" size="28" color="primary" />
                        </v-sheet>
                        <div>
                            <div class="text-h6 font-weight-bold">{{ group.data.value.name }}</div>
                            <div class="text-body-2 text-medium-emphasis">{{ group.data.value.uiType }}</div>
                        </div>
                    </div>
                </v-card-text>
            </v-card>

            <v-card rounded="lg" elevation="1">
                <v-tabs v-model="activeTab" color="primary" class="px-2">
                    <v-tab value="info" class="text-none" rounded="lg">
                        <v-icon start icon="mdi-information-outline" size="18" />Thông tin
                    </v-tab>
                    <v-tab value="options" class="text-none" rounded="lg">
                        <v-icon start icon="mdi-checkbox-multiple-marked-outline" size="18" />Options
                    </v-tab>
                </v-tabs>
                <v-divider />
                <v-window v-model="activeTab">
                    <v-window-item value="info">
                        <div class="pa-4">
                            <v-list density="compact">
                                <v-list-item title="Tên" :subtitle="group.data.value.name" />
                                <v-list-item title="Kiểu UI" :subtitle="group.data.value.uiType" />
                                <v-list-item title="Mô tả" :subtitle="group.data.value.description ?? '—'" />
                                <v-list-item title="Thứ tự" :subtitle="group.data.value.displayOrder.toString()" />
                                <v-list-item title="Tạo lúc" :subtitle="group.data.value.createdAt ?? '—'" />
                            </v-list>
                        </div>
                    </v-window-item>
                    <v-window-item value="options">
                        <div class="pa-4 d-flex flex-column ga-4">
                            <div class="d-flex justify-end">
                                <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreateOption">
                                    Thêm option
                                </v-btn>
                            </div>
                            <OptionList
                                :items="optionItems"
                                :loading="optionIsLoading"
                                :page-number="optionPage"
                                :page-size="optionPageSize"
                                :total-pages="optionTotalPages"
                                :total-items="optionTotal"
                                @page-change="(p) => { optionPage = p; fetchOptions() }"
                                @page-size-change="(s) => { optionPageSize = s; optionPage = 1; fetchOptions() }"
                                @row-action="onOptionAction"
                            />
                        </div>
                    </v-window-item>
                </v-window>
            </v-card>
        </template>

        <AppEmptyState
            v-else-if="!group.loading.value"
            icon="mdi-tune-off"
            title="Không tìm thấy nhóm option"
        >
            <template #actions>
                <v-btn color="primary" prepend-icon="mdi-arrow-left" :to="{ name: APP_ROUTES.PRODUCT.OPTION_GROUPS.NAME }">
                    Quay lại
                </v-btn>
            </template>
        </AppEmptyState>

        <!-- Create/Edit Option Dialog -->
        <AppDialog v-model="dialogOpen" :title="editId ? 'Sửa option' : 'Thêm option'" :hide-actions="true" max-width="700px">
            <OptionForm
                v-model="optionFormModel"
                :is-submitting="optionIsSubmitting"
                :edit-id="editId"
                :group-options="[]"
                @submit="onOptionFormSubmit"
                @cancel="dialogOpen = false"
            />
        </AppDialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppBreadcrumb, AppEmptyState, AppDialog } from '@/components/ui'
import { useAsyncState } from '@/composables/useAsyncState'
import { APP_ROUTES } from '@/core/constants/_index'
import { optionGroupService } from '../services/option-group.service'
import { useOption } from '../composables/useOption'
import { createEmptyOptionForm } from '../models/form-models/option.model'
import { OPTION_ROW_ACTION } from '../constants/option-list.constants'
import OptionList from '../components/OptionList.vue'
import OptionForm from '../components/OptionForm.vue'
import type { OptionViewModel } from '../models/view-models/option.view-model'
import type { CreateOptionRequest, UpdateOptionRequest } from '../models/dtos/option.dto'

const route = useRoute()
const groupId = Number(route.params['id'])
const activeTab = ref('info')

const group = useAsyncState(() => optionGroupService.getByIdAsync(groupId))

const {
    items: optionItems, total: optionTotal, isLoading: optionIsLoading, isSubmitting: optionIsSubmitting,
    loadOptions, createOption, updateOption, deleteOption,
} = useOption()

const optionPage = ref(1)
const optionPageSize = ref(20)
const optionTotalPages = computed(() => Math.max(1, Math.ceil(optionTotal.value / optionPageSize.value)))
const dialogOpen = ref(false)
const editId = ref<number | null>(null)
const optionFormModel = ref(createEmptyOptionForm(groupId))

async function fetchOptions() {
    await loadOptions({ PageNumber: optionPage.value, PageSize: optionPageSize.value, GroupId: groupId })
}

function openCreateOption() {
    editId.value = null
    optionFormModel.value = createEmptyOptionForm(groupId)
    dialogOpen.value = true
}

async function onOptionAction(key: string, item: OptionViewModel) {
    if (key === OPTION_ROW_ACTION.EDIT) {
        editId.value = item.id
        optionFormModel.value = { groupId: item.groupId, name: item.name, defaultPrice: item.defaultPrice, description: item.description ?? '', imageUrl: item.imageUrl ?? '', displayOrder: item.displayOrder, isActive: item.isActive }
        dialogOpen.value = true
    } else if (key === OPTION_ROW_ACTION.DELETE) {
        const ok = await deleteOption(item.id)
        if (ok) fetchOptions()
    }
}

async function onOptionFormSubmit(form: typeof optionFormModel.value) {
    if (editId.value) {
        const payload: UpdateOptionRequest = { Name: form.name, DefaultPrice: form.defaultPrice, Description: form.description || null, ImageUrl: form.imageUrl || null, DisplayOrder: form.displayOrder, IsActive: form.isActive }
        const ok = await updateOption(editId.value, payload)
        if (ok) { dialogOpen.value = false; fetchOptions() }
    } else {
        const payload: CreateOptionRequest = { GroupId: groupId, Name: form.name, DefaultPrice: form.defaultPrice, Description: form.description || null, ImageUrl: form.imageUrl || null, DisplayOrder: form.displayOrder, IsActive: form.isActive }
        const result = await createOption(payload)
        if (result) { dialogOpen.value = false; fetchOptions() }
    }
}

onMounted(async () => {
    await group.execute()
    await fetchOptions()
})
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/product/views/OptionGroupDetailView.vue
git commit -m "feat(product-fe): add OptionGroupDetailView"
```

---

## Task 9: OptionDetailView + OptionStoreOverridesTab

**Files:**
- Create: `src/modules/product/components/OptionStoreOverridesTab.vue`
- Create: `src/modules/product/views/OptionDetailView.vue`

- [ ] **Step 1: Create `OptionStoreOverridesTab.vue`**

```vue
<!-- src/modules/product/components/OptionStoreOverridesTab.vue -->
<template>
    <div class="pa-4 d-flex flex-column ga-4">
        <v-row>
            <v-col cols="12" md="6">
                <v-card variant="outlined" rounded="lg">
                    <v-card-title class="text-subtitle-2 pa-3">Khả dụng theo cửa hàng</v-card-title>
                    <v-divider />
                    <v-card-text>
                        <v-progress-linear v-if="isLoading" indeterminate color="primary" class="mb-2" />
                        <v-table density="compact" v-if="availability.length">
                            <thead><tr><th>Store ID</th><th class="text-center">Khả dụng</th><th></th></tr></thead>
                            <tbody>
                                <tr v-for="a in availability" :key="a.StoreId">
                                    <td>{{ a.StoreId }}</td>
                                    <td class="text-center">
                                        <v-icon :color="a.IsAvailable ? 'success' : 'error'" :icon="a.IsAvailable ? 'mdi-check-circle' : 'mdi-close-circle'" />
                                    </td>
                                    <td class="text-end">
                                        <v-btn size="x-small" icon="mdi-delete-outline" variant="text" color="error" @click="onRemove(a.StoreId)" />
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                        <v-alert v-else-if="!isLoading" type="info" variant="tonal" density="compact" class="mb-2">Chưa có cài đặt.</v-alert>
                        <div class="d-flex ga-2 mt-2">
                            <v-text-field v-model.number="newStoreId" label="Store ID" type="number" density="compact" hide-details />
                            <v-switch v-model="newIsAvailable" label="Khả dụng" color="primary" hide-details />
                            <v-btn color="primary" size="small" :loading="isSubmitting" @click="onUpsert">Lưu</v-btn>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
            <v-col cols="12" md="6">
                <v-card variant="outlined" rounded="lg">
                    <v-card-title class="text-subtitle-2 pa-3">Giá theo cửa hàng</v-card-title>
                    <v-divider />
                    <v-card-text>
                        <div class="d-flex ga-2">
                            <v-text-field v-model.number="priceStoreId" label="Store ID" type="number" density="compact" hide-details />
                            <v-text-field v-model.number="priceValue" label="Giá" type="number" density="compact" hide-details />
                            <v-btn color="primary" size="small" :loading="isSubmitting" @click="onUpsertPrice">Lưu</v-btn>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useOptionStoreOverrides } from '../composables/useStoreOverrides'

const props = defineProps<{ optionId: number }>()
const { isLoading, isSubmitting, availability, loadAvailability, upsertAvailability, removeAvailability, upsertPrice } =
    useOptionStoreOverrides(props.optionId)

const newStoreId = ref(0)
const newIsAvailable = ref(true)
const priceStoreId = ref(0)
const priceValue = ref(0)

async function onUpsert() {
    const ok = await upsertAvailability({ StoreId: newStoreId.value, IsAvailable: newIsAvailable.value })
    if (ok) { newStoreId.value = 0; await loadAvailability() }
}

async function onRemove(storeId: number) {
    const ok = await removeAvailability(storeId)
    if (ok) await loadAvailability()
}

async function onUpsertPrice() {
    await upsertPrice({ StoreId: priceStoreId.value, Price: priceValue.value })
    priceStoreId.value = 0; priceValue.value = 0
}

onMounted(loadAvailability)
</script>
```

- [ ] **Step 2: Create `OptionDetailView.vue`**

```vue
<!-- src/modules/product/views/OptionDetailView.vue -->
<template>
    <div class="d-flex flex-column ga-5">
        <template v-if="option.loading.value">
            <v-skeleton-loader type="heading" />
            <v-skeleton-loader type="card" height="120" />
        </template>

        <template v-else-if="option.data.value">
            <v-card variant="tonal" color="primary" rounded="lg" flat>
                <v-card-text class="pa-5">
                    <AppBreadcrumb
                        :items="[
                            { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                            { title: 'Options', to: { name: APP_ROUTES.PRODUCT.OPTIONS.NAME } },
                            { title: option.data.value.name, disabled: true },
                        ]"
                    />
                    <div class="d-flex align-center ga-3 mt-3">
                        <v-sheet rounded="lg" width="52" height="52" class="d-flex align-center justify-center flex-shrink-0">
                            <v-icon icon="mdi-checkbox-marked-outline" size="28" color="primary" />
                        </v-sheet>
                        <div>
                            <div class="text-h6 font-weight-bold">{{ option.data.value.name }}</div>
                            <div class="text-body-2 text-medium-emphasis">Giá: {{ option.data.value.defaultPrice?.toLocaleString() }}</div>
                        </div>
                    </div>
                </v-card-text>
            </v-card>

            <v-card rounded="lg" elevation="1">
                <v-tabs v-model="activeTab" color="primary" class="px-2">
                    <v-tab value="info" class="text-none" rounded="lg">
                        <v-icon start icon="mdi-information-outline" size="18" />Thông tin
                    </v-tab>
                    <v-tab value="stores" class="text-none" rounded="lg">
                        <v-icon start icon="mdi-store-outline" size="18" />Cửa hàng
                    </v-tab>
                </v-tabs>
                <v-divider />
                <v-window v-model="activeTab">
                    <v-window-item value="info">
                        <div class="pa-4">
                            <v-list density="compact">
                                <v-list-item title="Tên" :subtitle="option.data.value.name" />
                                <v-list-item title="Nhóm" :subtitle="option.data.value.groupId.toString()" />
                                <v-list-item title="Giá mặc định" :subtitle="option.data.value.defaultPrice?.toLocaleString() ?? '0'" />
                                <v-list-item title="Mô tả" :subtitle="option.data.value.description ?? '—'" />
                                <v-list-item title="Thứ tự" :subtitle="option.data.value.displayOrder.toString()" />
                            </v-list>
                        </div>
                    </v-window-item>
                    <v-window-item value="stores">
                        <OptionStoreOverridesTab :option-id="optionId" />
                    </v-window-item>
                </v-window>
            </v-card>
        </template>

        <AppEmptyState
            v-else-if="!option.loading.value"
            icon="mdi-checkbox-blank-off-outline"
            title="Không tìm thấy option"
        >
            <template #actions>
                <v-btn color="primary" prepend-icon="mdi-arrow-left" :to="{ name: APP_ROUTES.PRODUCT.OPTIONS.NAME }">
                    Quay lại
                </v-btn>
            </template>
        </AppEmptyState>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { AppBreadcrumb, AppEmptyState } from '@/components/ui'
import { useAsyncState } from '@/composables/useAsyncState'
import { APP_ROUTES } from '@/core/constants/_index'
import { optionService } from '../services/option.service'
import OptionStoreOverridesTab from '../components/OptionStoreOverridesTab.vue'

const route = useRoute()
const optionId = Number(route.params['id'])
const activeTab = ref('info')
const option = useAsyncState(() => optionService.getByIdAsync(optionId))
onMounted(() => option.execute())
</script>
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/product/components/OptionStoreOverridesTab.vue
git add src/modules/product/views/OptionDetailView.vue
git commit -m "feat(product-fe): add OptionDetailView with Plan E store overrides"
```

---

## Task 10: Enhancements + Route Registration

**Files:**
- Modify: `src/modules/product/components/OptionForm.vue`
- Modify: `src/modules/product/views/OptionsView.vue`
- Modify: `src/modules/product/views/CategoriesView.vue`
- Modify: `src/modules/product/constants/product-list.constants.ts`
- Modify: `src/modules/product/constants/option-group-list.constants.ts`
- Modify: `src/modules/product/views/OptionGroupsView.vue`
- Modify: `src/modules/product/views/ProductsView.vue`
- Modify: `src/router/routes.ts`

- [ ] **Step 1: Add GroupId selector to `OptionForm.vue`**

Add `groupOptions` prop and a `v-autocomplete` field. Replace the entire file content:

```vue
<!-- src/modules/product/components/OptionForm.vue -->
<template>
    <v-form ref="formRef" @submit.prevent="onSubmit">
        <v-row>
            <v-col cols="12" v-if="!isEditMode">
                <v-autocomplete
                    v-model="form.groupId"
                    :items="groupOptions"
                    item-value="id"
                    item-title="name"
                    label="Nhóm option *"
                    :rules="[(v: number | null) => !!v || 'Vui lòng chọn nhóm option']"
                />
            </v-col>
            <v-col cols="12" md="8">
                <v-text-field
                    v-model="form.name"
                    label="Tên option *"
                    :rules="[rules.required, rules.maxLength(200)]"
                />
            </v-col>
            <v-col cols="12" md="4">
                <v-text-field
                    v-model.number="form.defaultPrice"
                    label="Giá mặc định"
                    type="number"
                    min="0"
                    :rules="[(v: number) => v >= 0 || 'Giá không được âm']"
                />
            </v-col>
            <v-col cols="12">
                <v-textarea
                    v-model="form.description"
                    label="Mô tả"
                    rows="3"
                    :rules="[rules.maxLength(1000)]"
                />
            </v-col>
            <v-col cols="12">
                <v-text-field
                    v-model="form.imageUrl"
                    label="URL hình ảnh"
                    :rules="[rules.maxLength(500)]"
                />
            </v-col>
            <v-col cols="12" md="6">
                <v-text-field
                    v-model.number="form.displayOrder"
                    label="Thứ tự hiển thị"
                    type="number"
                    min="0"
                />
            </v-col>
            <v-col cols="12" md="6" class="d-flex align-center">
                <v-switch v-model="form.isActive" label="Hiển thị" color="primary" />
            </v-col>
        </v-row>

        <div class="d-flex justify-end gap-2 pt-4">
            <v-btn variant="text" @click="emit('cancel')">Hủy</v-btn>
            <v-btn type="submit" color="primary" :loading="isSubmitting">
                {{ isEditMode ? 'Cập nhật' : 'Tạo mới' }}
            </v-btn>
        </div>
    </v-form>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFormValidation } from '@/composables/useFormValidation'
import type { OptionFormModel } from '../models/form-models/option.model'

interface Props {
    modelValue: OptionFormModel
    isSubmitting: boolean
    editId?: number | null
    groupOptions?: { id: number; name: string }[]
}

const props = withDefaults(defineProps<Props>(), { editId: null, groupOptions: () => [] })

const emit = defineEmits<{
    'update:modelValue': [value: OptionFormModel]
    submit: [form: OptionFormModel]
    cancel: []
}>()

const form = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val),
})

const isEditMode = computed(() => props.editId !== null)
const formRef = ref()
const { rules } = useFormValidation()

async function onSubmit() {
    const { valid } = await formRef.value?.validate()
    if (valid) emit('submit', form.value)
}
</script>
```

- [ ] **Step 2: Add OptionGroup filter to `OptionsView.vue`**

Replace the `OptionsView.vue` `<script setup>` section and add a filter toolbar. Full replacement:

```vue
<!-- src/modules/product/views/OptionsView.vue -->
<template>
    <div class="d-flex flex-column ga-4">
        <AppPageHeader
            title="Options"
            subtitle="Quản lý danh sách option cho sản phẩm"
        >
            <template #breadcrumb>
                <AppBreadcrumb
                    :items="[
                        { title: 'Dashboard', to: '/admin' },
                        { title: 'Sản phẩm' },
                        { title: 'Options', disabled: true },
                    ]"
                />
            </template>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
                Thêm option
            </v-btn>
        </AppPageHeader>

        <!-- Filter bar -->
        <v-card rounded="lg" variant="outlined">
            <v-card-text class="pa-3">
                <v-row dense>
                    <v-col cols="12" md="4">
                        <v-autocomplete
                            v-model="filterGroupId"
                            :items="groupOptions"
                            item-value="id"
                            item-title="name"
                            label="Lọc theo nhóm"
                            clearable
                            density="compact"
                            hide-details
                            @update:model-value="onFilterChange"
                        />
                    </v-col>
                </v-row>
            </v-card-text>
        </v-card>

        <OptionList
            :items="items"
            :loading="isLoading"
            :page-number="page"
            :page-size="pageSize"
            :total-pages="totalPages"
            :total-items="total"
            @create="openCreateDialog"
            @page-change="onPageChange"
            @page-size-change="onPageSizeChange"
            @row-action="onRowAction"
        />

        <AppDialog v-model="dialogOpen" :title="dialogTitle" :hide-actions="true" max-width="700px">
            <OptionForm
                v-model="formModel"
                :is-submitting="isSubmitting"
                :edit-id="editId"
                :group-options="groupOptions"
                @submit="onFormSubmit"
                @cancel="dialogOpen = false"
            />
        </AppDialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
    AppBreadcrumb,
    AppPageHeader,
    AppDialog,
} from '@/components/ui'
import OptionList from '../components/OptionList.vue'
import OptionForm from '../components/OptionForm.vue'
import { useOption } from '../composables/useOption'
import { useOptionGroupStore } from '../stores/option-group.store'
import { createEmptyOptionForm } from '../models/form-models/option.model'
import { OPTION_ROW_ACTION } from '../constants/option-list.constants'
import type { OptionViewModel } from '../models/view-models/option.view-model'
import type { CreateOptionRequest, UpdateOptionRequest } from '../models/dtos/option.dto'

const { items, total, isLoading, isSubmitting, loadOptions, createOption, updateOption, deleteOption } = useOption()
const groupStore = useOptionGroupStore()
const groupOptions = computed(() => groupStore.items.map(g => ({ id: g.id, name: g.name })))

const page = ref(1)
const pageSize = ref(20)
const filterGroupId = ref<number | null>(null)
const dialogOpen = ref(false)
const editId = ref<number | null>(null)
const formModel = ref(createEmptyOptionForm())

const dialogTitle = computed(() => (editId.value ? 'Sửa option' : 'Thêm option'))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

async function fetchData() {
    await loadOptions({ PageNumber: page.value, PageSize: pageSize.value, GroupId: filterGroupId.value })
}

function onFilterChange() { page.value = 1; fetchData() }
function onPageChange(p: number) { page.value = p; fetchData() }
function onPageSizeChange(s: number) { pageSize.value = s; page.value = 1; fetchData() }

function openCreateDialog() {
    editId.value = null
    formModel.value = createEmptyOptionForm(filterGroupId.value ?? undefined)
    dialogOpen.value = true
}

function openEditDialog(item: OptionViewModel) {
    editId.value = item.id
    formModel.value = { groupId: item.groupId, name: item.name, defaultPrice: item.defaultPrice, description: item.description ?? '', imageUrl: item.imageUrl ?? '', displayOrder: item.displayOrder, isActive: item.isActive }
    dialogOpen.value = true
}

async function onRowAction(key: string, item: OptionViewModel) {
    if (key === OPTION_ROW_ACTION.EDIT) openEditDialog(item)
    else if (key === OPTION_ROW_ACTION.DELETE) { const ok = await deleteOption(item.id); if (ok) fetchData() }
}

async function onFormSubmit(form: typeof formModel.value) {
    if (editId.value) {
        const payload: UpdateOptionRequest = { Name: form.name, DefaultPrice: form.defaultPrice, Description: form.description || null, ImageUrl: form.imageUrl || null, DisplayOrder: form.displayOrder, IsActive: form.isActive }
        const ok = await updateOption(editId.value, payload)
        if (ok) { dialogOpen.value = false; fetchData() }
    } else {
        if (form.groupId === null) return
        const payload: CreateOptionRequest = { GroupId: form.groupId, Name: form.name, DefaultPrice: form.defaultPrice, Description: form.description || null, ImageUrl: form.imageUrl || null, DisplayOrder: form.displayOrder, IsActive: form.isActive }
        const result = await createOption(payload)
        if (result) { dialogOpen.value = false; fetchData() }
    }
}

onMounted(async () => {
    await groupStore.fetchPaged({ PageNumber: 1, PageSize: 200 })
    fetchData()
})
</script>
```

- [ ] **Step 3: Add ParentId filter to `CategoriesView.vue`**

Add filter bar above the CategoryList. In the `<template>`, add after `AppPageHeader` and before `CategoryList`:

```vue
<!-- Add this block between AppPageHeader and CategoryList -->
<v-card rounded="lg" variant="outlined">
    <v-card-text class="pa-3">
        <v-row dense>
            <v-col cols="12" md="4">
                <v-autocomplete
                    v-model="filterParentId"
                    :items="parentFilterOptions"
                    item-value="id"
                    item-title="name"
                    label="Lọc theo danh mục cha"
                    clearable
                    density="compact"
                    hide-details
                    @update:model-value="onFilterChange"
                />
            </v-col>
        </v-row>
    </v-card-text>
</v-card>
```

In `<script setup>`, add these declarations:

```typescript
const filterParentId = ref<number | null>(null)
const parentFilterOptions = computed(() => items.value.map((c) => ({ id: c.id, name: c.name })))

function onFilterChange() { page.value = 1; fetchData() }
```

Update `fetchData` to pass filter:

```typescript
async function fetchData() {
    await loadCategories({ PageNumber: page.value, PageSize: pageSize.value, ParentId: filterParentId.value })
}
```

- [ ] **Step 4: Add DETAIL action to product and option-group list constants**

In `product-list.constants.ts`, update `PRODUCT_ROW_ACTION` and `PRODUCT_ROW_ACTIONS`:

```typescript
export const PRODUCT_ROW_ACTION = {
    DETAIL: 'detail',
    EDIT: 'edit',
    DELETE: 'delete',
} as const

export const PRODUCT_ROW_ACTIONS: RowAction<ProductViewModel>[] = [
    { key: PRODUCT_ROW_ACTION.DETAIL, label: 'Xem chi tiết', icon: 'mdi-eye-outline', color: 'secondary' },
    { key: PRODUCT_ROW_ACTION.EDIT, label: 'Chỉnh sửa', icon: 'mdi-pencil-outline', color: 'primary' },
    { key: PRODUCT_ROW_ACTION.DELETE, label: 'Xóa', icon: 'mdi-delete-outline', color: 'error' },
]
```

In `option-group-list.constants.ts`, update `OPTION_GROUP_ROW_ACTION` and `OPTION_GROUP_ROW_ACTIONS`:

```typescript
export const OPTION_GROUP_ROW_ACTION = {
    DETAIL: 'detail',
    EDIT: 'edit',
    DELETE: 'delete',
} as const

export const OPTION_GROUP_ROW_ACTIONS: RowAction<OptionGroupViewModel>[] = [
    { key: OPTION_GROUP_ROW_ACTION.DETAIL, label: 'Xem chi tiết', icon: 'mdi-eye-outline', color: 'secondary' },
    { key: OPTION_GROUP_ROW_ACTION.EDIT, label: 'Chỉnh sửa', icon: 'mdi-pencil-outline', color: 'primary' },
    { key: OPTION_GROUP_ROW_ACTION.DELETE, label: 'Xóa', icon: 'mdi-delete-outline', color: 'error' },
]
```

- [ ] **Step 5: Handle DETAIL navigation in `ProductsView.vue`**

Add import: `import { useRouter } from 'vue-router'`
Add: `const router = useRouter()`

Update `onRowAction`:

```typescript
async function onRowAction(key: string, item: ProductViewModel) {
    if (key === PRODUCT_ROW_ACTION.DETAIL) {
        router.push({ name: APP_ROUTES.PRODUCT.PRODUCT_DETAIL.NAME, params: { id: item.id } })
    } else if (key === PRODUCT_ROW_ACTION.EDIT) {
        openEditDialog(item)
    } else if (key === PRODUCT_ROW_ACTION.DELETE) {
        const ok = await deleteProduct(item.id)
        if (ok) fetchData()
    }
}
```

Add import: `import { APP_ROUTES } from '@/core/constants/_index'`

- [ ] **Step 6: Handle DETAIL navigation in `OptionGroupsView.vue`**

Change `onGroupRowAction` to navigate on DETAIL:

```typescript
async function onGroupRowAction(key: string, item: OptionGroupViewModel) {
    if (key === OPTION_GROUP_ROW_ACTION.DETAIL) {
        router.push({ name: APP_ROUTES.PRODUCT.OPTION_GROUP_DETAIL.NAME, params: { id: item.id } })
    } else if (key === OPTION_GROUP_ROW_ACTION.EDIT) {
        openEditGroupDialog(item)
    } else if (key === OPTION_GROUP_ROW_ACTION.DELETE) {
        const ok = await deleteOptionGroup(item.id)
        if (ok) {
            if (selectedGroup.value?.id === item.id) selectedGroup.value = null
            fetchGroupData()
        }
    }
}
```

Add imports: `import { useRouter } from 'vue-router'` and `import { APP_ROUTES } from '@/core/constants/_index'`
Add: `const router = useRouter()`

- [ ] **Step 7: Register new routes in `routes.ts`**

After the `APP_ROUTES.PRODUCT.OPTIONS` route block, add:

```typescript
{
    path: APP_ROUTES.PRODUCT.PRODUCT_DETAIL.PATH,
    name: APP_ROUTES.PRODUCT.PRODUCT_DETAIL.NAME,
    component: () => import('@/modules/product/views/ProductDetailView.vue'),
    meta: { title: 'Chi tiết sản phẩm', requiresAuth: true },
},
{
    path: APP_ROUTES.PRODUCT.CATEGORY_DETAIL.PATH,
    name: APP_ROUTES.PRODUCT.CATEGORY_DETAIL.NAME,
    component: () => import('@/modules/product/views/CategoryDetailView.vue'),
    meta: { title: 'Chi tiết danh mục', requiresAuth: true },
},
{
    path: APP_ROUTES.PRODUCT.OPTION_GROUP_DETAIL.PATH,
    name: APP_ROUTES.PRODUCT.OPTION_GROUP_DETAIL.NAME,
    component: () => import('@/modules/product/views/OptionGroupDetailView.vue'),
    meta: { title: 'Chi tiết nhóm option', requiresAuth: true },
},
{
    path: APP_ROUTES.PRODUCT.OPTION_DETAIL.PATH,
    name: APP_ROUTES.PRODUCT.OPTION_DETAIL.NAME,
    component: () => import('@/modules/product/views/OptionDetailView.vue'),
    meta: { title: 'Chi tiết option', requiresAuth: true },
},
```

- [ ] **Step 8: Type-check**

```bash
cd NDTCore.FE
npm run type-check
```

Fix any TypeScript errors before committing.

- [ ] **Step 9: Commit**

```bash
git add src/modules/product/components/OptionForm.vue
git add src/modules/product/views/OptionsView.vue
git add src/modules/product/views/CategoriesView.vue
git add src/modules/product/constants/product-list.constants.ts
git add src/modules/product/constants/option-group-list.constants.ts
git add src/modules/product/views/OptionGroupsView.vue
git add src/modules/product/views/ProductsView.vue
git add src/router/routes.ts
git commit -m "feat(product-fe): add detail navigation, list filters, OptionForm group selector"
```

---

## Self-Review

**Spec coverage check:**
- ✅ OptionGroup detail page — OptionGroupDetailView.vue (Task 8)
- ✅ Options with OptionGroup filter — OptionsView.vue (Task 10)
- ✅ OptionForm GroupId selector — OptionForm.vue (Task 10)
- ✅ Option detail page — OptionDetailView.vue (Task 9)
- ✅ Category parent filter — CategoriesView.vue (Task 10)
- ✅ Category detail page — CategoryDetailView.vue (Task 7)
- ✅ Product detail page — ProductDetailView.vue (Task 6)
- ✅ Plan D: Tags panel — ProductTagsTab.vue (Task 6)
- ✅ Plan D: OptionGroups panel — ProductOptionGroupsTab.vue (Task 6)
- ✅ Plan D: OptionConfigs panel — ProductOptionConfigsTab.vue (Task 6)
- ✅ Plan E: Product store overrides — ProductStoreOverridesTab.vue (Task 6)
- ✅ Plan E: Option store overrides — OptionStoreOverridesTab.vue (Task 9)

**Notes for implementation:**
- `optionService.getByIdAsync` and `optionGroupService.getByIdAsync` — verify these exist in the respective service files. If not, add them following the `categoryService.getByIdAsync` pattern.
- `useOptionGroupStore` — verify the store export name matches (check `option-group.store.ts`).
- `useOptionStore` — verify the store export name matches (check `option.store.ts`).
- `createEmptyOptionForm` accepts optional groupId param — verify signature in `option.model.ts`.
- API endpoint paths (e.g. `/admin/products/{id}/tags`) must match the actual BE controller routes once Plan D+E controllers are deployed.
