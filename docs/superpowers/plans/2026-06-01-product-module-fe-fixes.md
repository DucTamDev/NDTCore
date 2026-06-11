# Product Module — FE Bug Fixes & Spec Gaps

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address all FE spec gaps and bugs found in the Product module code review: missing shared components (AppConfirmDialog, AppCurrencyField), data-layer bugs (customPrice null coercion, MaxSelect validation, dropdown filtering, store price list not loaded), missing TagDetailView, and missing/incomplete panels in CategoryDetailView, OptionDetailView, OptionGroupDetailView plus filter bars in list views.

**Architecture:** Feature-first. New shared components go to `src/components/ui/components/`. Each task is scoped to one file or one logical concern. Tasks 1–2 (shared components) must be completed before tasks that use them. Tasks 3–7 are data layer and can be done in any order. Tasks 8–14 are view-layer additions.

**Tech Stack:** Vue 3 (Composition API) · TypeScript · Vuetify 3 · Pinia · vue-router

**Prerequisites:** BE fixes plan task 4 (GET store override endpoints) must be deployed before Task 7 of this plan.

---

## File Map

| File | Change |
|------|--------|
| `src/components/ui/components/AppConfirmDialog.vue` | **Create** confirm dialog wrapper |
| `src/components/ui/index.ts` | Export AppConfirmDialog + AppCurrencyField |
| `src/components/ui/components/AppCurrencyField.vue` | **Create** currency input component |
| `src/modules/product/components/ProductOptionConfigsTab.vue` | Fix CustomPrice null→0 |
| `src/modules/product/components/ProductOptionGroupsTab.vue` | MaxSelect >= MinSelect + filter assigned |
| `src/modules/product/components/ProductTagsTab.vue` | Filter already-assigned tags |
| `src/modules/product/api/store-overrides.api.ts` | Fix URLs + add GET overview |
| `src/core/constants/api.constants.ts` | Add/fix store override API constants |
| `src/modules/product/services/store-overrides.service.ts` | Add getProductOverviewAsync + getOptionOverviewAsync |
| `src/modules/product/composables/useStoreOverrides.ts` | Add prices ref + loadPrices |
| `src/modules/product/components/ProductStoreOverridesTab.vue` | Show/delete price list |
| `src/modules/product/components/OptionStoreOverridesTab.vue` | Show/delete price list |
| `src/modules/product/views/TagDetailView.vue` | **Create** |
| `src/core/constants/app-routes.constants.ts` | Add TAG_DETAIL route constant |
| `src/router/routes.ts` | Register TAG_DETAIL route |
| `src/modules/product/views/CategoryDetailView.vue` | Edit/Delete buttons + products widget + conditional subcategories |
| `src/modules/product/views/OptionDetailView.vue` | ProductOptionConfig read-only widget |
| `src/modules/product/views/OptionGroupDetailView.vue` | Products-using-group panel |
| `src/modules/product/views/CategoriesView.vue` | Add search input |
| `src/modules/product/views/ProductsView.vue` | Add filter bar (search + category + status) |
| `src/modules/product/components/CategoryForm.vue` | Active-only parent filter + self-exclusion |
| `src/modules/product/components/TagForm.vue` | Live combined color preview pill |

---

## Task 1: AppConfirmDialog Shared Component

**Why:** Every delete/unlink action in the product module fires immediately with no confirmation. `AppConfirmDialog` is the prerequisite for all fixes — build it first.

**Files:**
- Create: `src/components/ui/components/AppConfirmDialog.vue`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Create `AppConfirmDialog.vue`**

  ```vue
  <script setup lang="ts">
  import AppDialog from './AppDialog.vue'

  const props = defineProps<{
    modelValue: boolean
    title: string
    message: string
    confirmLabel?: string
    confirmVariant?: 'danger' | 'primary'
    loading?: boolean
  }>()

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    confirm: []
    cancel: []
  }>()

  function onConfirm() {
    emit('confirm')
    emit('update:modelValue', false)
  }

  function onCancel() {
    emit('cancel')
    emit('update:modelValue', false)
  }
  </script>

  <template>
    <v-dialog
      :model-value="modelValue"
      max-width="440px"
      :persistent="loading"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <v-card>
        <v-card-title class="pa-4 pb-2 text-h6">{{ title }}</v-card-title>
        <v-card-text class="pa-4 pt-1 text-body-2">{{ message }}</v-card-text>
        <v-card-actions class="pa-4 pt-0 ga-2 justify-end">
          <v-btn variant="text" :disabled="loading" @click="onCancel">Hủy</v-btn>
          <v-btn
            :color="confirmVariant === 'danger' ? 'error' : 'primary'"
            variant="flat"
            :loading="loading"
            @click="onConfirm"
          >
            {{ confirmLabel ?? 'Xác nhận xoá' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </template>
  ```

- [ ] **Step 2: Export from UI barrel**

  Open `src/components/ui/index.ts`. Add `AppConfirmDialog` to the exports alongside `AppDialog`:

  ```typescript
  export { default as AppConfirmDialog } from './components/AppConfirmDialog.vue'
  ```

- [ ] **Step 3: Apply AppConfirmDialog to CategoriesView delete action**

  In `src/modules/product/views/CategoriesView.vue`:

  Add import at top of `<script setup>`:
  ```typescript
  import { AppConfirmDialog } from '@/components/ui'
  ```

  Add state refs (after existing refs):
  ```typescript
  const confirmOpen = ref(false)
  const confirmItem = ref<CategoryViewModel | null>(null)
  ```

  Replace the delete branch in `onRowAction`:
  ```typescript
  } else if (key === CATEGORY_ROW_ACTION.DELETE) {
    confirmItem.value = item
    confirmOpen.value = true
  }
  ```

  Add confirm handler:
  ```typescript
  async function onConfirmDelete() {
    if (!confirmItem.value) return
    const ok = await deleteCategory(confirmItem.value.id)
    if (ok) fetchData()
  }
  ```

  Add `AppConfirmDialog` to template (inside the `<div class="d-flex flex-column ga-4">` wrapper, after the `AppDialog`):
  ```vue
  <AppConfirmDialog
    v-model="confirmOpen"
    title="Xoá danh mục"
    :message="`Bạn có chắc muốn xoá danh mục '${confirmItem?.name}'? Hành động này không thể hoàn tác.`"
    confirm-label="Xác nhận xoá"
    confirm-variant="danger"
    @confirm="onConfirmDelete"
  />
  ```

- [ ] **Step 4: Apply the same pattern to TagsView, OptionsView, OptionGroupsView, ProductsView**

  Repeat Step 3 for each view. The pattern is identical: add `confirmOpen` + `confirmItem` refs, swap direct delete call with setting `confirmOpen = true`, add `AppConfirmDialog` in template.

  For `TagsView.vue` — wrap `deleteTag(item.id)` call at line 109–111.
  For `OptionsView.vue` — wrap `deleteOption(item.id)` call at line 131–133.
  For `OptionGroupsView.vue` — wrap both `deleteOptionGroup` (line 202–208) and `deleteOption` (line 285–287).
  For `ProductsView.vue` — wrap `deleteProduct(item.id)` call at line 124–126.

- [ ] **Step 5: Apply AppConfirmDialog to tab components (unlink actions)**

  For `ProductTagsTab.vue`: replace `@click:close="onRemove(t.TagId)"` with:
  ```vue
  @click:close="() => { confirmTagId = t.TagId; confirmTagOpen = true }"
  ```
  Add state:
  ```typescript
  const confirmTagOpen = ref(false)
  const confirmTagId = ref<number | null>(null)
  ```
  Add handler:
  ```typescript
  async function onConfirmRemove() {
    if (confirmTagId.value == null) return
    const ok = await removeTag(confirmTagId.value)
    if (ok) await loadTags()
  }
  ```
  Add `AppConfirmDialog` to template.

  Repeat for `ProductOptionGroupsTab.vue` (unlink OptionGroup) and `ProductOptionConfigsTab.vue` (remove config) and `ProductStoreOverridesTab.vue` (remove store) and `OptionStoreOverridesTab.vue` (remove availability).

- [ ] **Step 6: Run type-check**

  ```bash
  npm run type-check
  ```
  Expected: No errors.

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/ui/components/AppConfirmDialog.vue src/components/ui/index.ts
  git add src/modules/product/views/CategoriesView.vue src/modules/product/views/TagsView.vue
  git add src/modules/product/views/OptionsView.vue src/modules/product/views/OptionGroupsView.vue
  git add src/modules/product/views/ProductsView.vue
  git add src/modules/product/components/ProductTagsTab.vue src/modules/product/components/ProductOptionGroupsTab.vue
  git add src/modules/product/components/ProductOptionConfigsTab.vue
  git add src/modules/product/components/ProductStoreOverridesTab.vue src/modules/product/components/OptionStoreOverridesTab.vue
  git commit -m "feat(product): add AppConfirmDialog and wire to all delete/unlink actions

  All destructive actions in the product module were firing immediately on click
  with no confirmation step. AppConfirmDialog is a thin v-dialog wrapper with
  confirm/cancel events. Wired to 10 handlers across 9 files."
  ```

---

## Task 2: AppCurrencyField Shared Component

**Why:** All price inputs use raw `<v-text-field type="number">` with no locale formatting. `AppCurrencyField` provides vi-VN formatted display, number v-model (not string), ≥0 validation, and nullable support.

**Files:**
- Create: `src/components/ui/components/AppCurrencyField.vue`
- Modify: `src/components/ui/index.ts`
- Modify: `src/modules/product/components/ProductForm.vue` (basePrice, costPrice)
- Modify: `src/modules/product/components/OptionForm.vue` (defaultPrice)

- [ ] **Step 1: Create `AppCurrencyField.vue`**

  ```vue
  <script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    modelValue: number | null
    label?: string
    required?: boolean
    nullable?: boolean
    disabled?: boolean
    hint?: string
  }>()

  const emit = defineEmits<{
    'update:modelValue': [value: number | null]
  }>()

  // Format for display: "1.000.000 ₫"
  const displayValue = computed(() =>
    props.modelValue != null
      ? props.modelValue.toLocaleString('vi-VN')
      : ''
  )

  function onInput(raw: string) {
    const cleaned = raw.replace(/\./g, '').replace(/[^\d]/g, '')
    if (cleaned === '') {
      emit('update:modelValue', props.nullable ? null : 0)
      return
    }
    const num = parseInt(cleaned, 10)
    emit('update:modelValue', isNaN(num) ? 0 : num)
  }

  const rules = computed(() => {
    const r: ((v: string) => true | string)[] = []
    if (props.required) {
      r.push((v) => (v !== '' && v !== null) || 'Trường này là bắt buộc')
    }
    if (!props.nullable) {
      r.push((v) => {
        const n = parseInt(v.replace(/\./g, ''), 10)
        return (!isNaN(n) && n >= 0) || 'Giá phải ≥ 0'
      })
    }
    return r
  })
  </script>

  <template>
    <v-text-field
      :model-value="displayValue"
      :label="label"
      :rules="rules"
      :disabled="disabled"
      :hint="hint"
      suffix="₫"
      inputmode="numeric"
      @update:model-value="onInput"
    />
  </template>
  ```

- [ ] **Step 2: Export from barrel**

  Add to `src/components/ui/index.ts`:
  ```typescript
  export { default as AppCurrencyField } from './components/AppCurrencyField.vue'
  ```

- [ ] **Step 3: Replace price inputs in `ProductForm.vue`**

  Add import: `import { AppCurrencyField } from '@/components/ui'`

  Replace the `basePrice` field (currently `<v-text-field type="number" suffix="₫">`):
  ```vue
  <AppCurrencyField
    v-model="form.basePrice"
    label="Giá gốc *"
    :required="true"
  />
  ```

  Replace the `costPrice` field:
  ```vue
  <AppCurrencyField
    v-model="form.costPrice"
    label="Giá vốn"
    :nullable="true"
  />
  ```

- [ ] **Step 4: Replace price input in `OptionForm.vue`**

  Add import: `import { AppCurrencyField } from '@/components/ui'`

  Replace `defaultPrice` field:
  ```vue
  <AppCurrencyField
    v-model="form.defaultPrice"
    label="Giá mặc định"
  />
  ```

- [ ] **Step 5: Run type-check**

  ```bash
  npm run type-check
  ```
  Expected: No errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/ui/components/AppCurrencyField.vue src/components/ui/index.ts
  git add src/modules/product/components/ProductForm.vue src/modules/product/components/OptionForm.vue
  git commit -m "feat(product): add AppCurrencyField with vi-VN locale formatting

  Price inputs were raw number fields with no locale format. AppCurrencyField formats
  1000000 as '1.000.000 ₫', accepts number v-model (not string), and supports nullable
  for optional price fields. Applied to ProductForm (basePrice, costPrice) and OptionForm."
  ```

---

## Task 3: Fix CustomPrice Null Coercion in ProductOptionConfigsTab

**Why:** `v-model.number` coerces a cleared `<v-text-field>` to `0` instead of `null`. This makes "no custom price" send `CustomPrice: 0` to the API, which the backend treats as an explicit zero-price override rather than "use default price."

**Files:**
- Modify: `src/modules/product/components/ProductOptionConfigsTab.vue`

- [ ] **Step 1: Replace the `CustomPrice` field with AppCurrencyField**

  The field is at line 73–79 in `ProductOptionConfigsTab.vue`. Replace the entire `<v-text-field>` for CustomPrice with:

  ```vue
  <AppCurrencyField
    v-model="form.CustomPrice"
    label="Giá tùy chỉnh"
    :nullable="true"
    hint="Để trống = dùng giá mặc định của option"
  />
  ```

  Add import at top: `import { AppDialog, AppCurrencyField } from '@/components/ui'`

  The `form.CustomPrice` is typed `number | null` — `AppCurrencyField` with `:nullable="true"` correctly returns `null` when the field is cleared.

- [ ] **Step 2: Type-check**

  ```bash
  npm run type-check
  ```
  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/modules/product/components/ProductOptionConfigsTab.vue
  git commit -m "fix(product): CustomPrice null coercion in ProductOptionConfigsTab

  v-model.number coerced cleared input to 0 instead of null, sending an explicit
  zero-price override to the API instead of 'use default price'. Replaced with
  AppCurrencyField (nullable=true) which returns null on empty input."
  ```

---

## Task 4: MaxSelect ≥ MinSelect Validation in ProductOptionGroupsTab

**Why:** No cross-field validation exists for the OptionGroup constraints form. `MinSelect=3, MaxSelect=1` is silently sent to the BE, potentially creating an impossible order constraint.

**Files:**
- Modify: `src/modules/product/components/ProductOptionGroupsTab.vue`

- [ ] **Step 1: Add validation in the assign + update handlers**

  In `ProductOptionGroupsTab.vue`, at the start of the `onAssign` function (before the `await` call):

  ```typescript
  function validateConstraints(min: number, max: number): string | null {
    if (max < min) return `Số chọn tối đa (${max}) phải ≥ số chọn tối thiểu (${min})`
    return null
  }
  ```

  In `onAssign`:
  ```typescript
  async function onAssign() {
    const err = validateConstraints(assignForm.MinSelect, assignForm.MaxSelect)
    if (err) { toast.warning(err); return }
    // ... existing code
  }
  ```

  In `onUpdate` (edit existing constraint):
  ```typescript
  async function onUpdate(groupId: number) {
    const err = validateConstraints(editForm.MinSelect, editForm.MaxSelect)
    if (err) { toast.warning(err); return }
    // ... existing code
  }
  ```

  Add import if not present: `import { useToastNotification } from '@/composables/useToastNotification'`
  Add const: `const toast = useToastNotification()`

- [ ] **Step 2: Type-check**

  ```bash
  npm run type-check
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/modules/product/components/ProductOptionGroupsTab.vue
  git commit -m "fix(product): add MaxSelect >= MinSelect validation in ProductOptionGroupsTab

  No cross-field validation existed; invalid constraints were sent to BE silently.
  Validates before each assign/update call and shows a warning toast if violated."
  ```

---

## Task 5: Filter Already-Assigned Tags & OptionGroups from Dropdowns

**Why:** The tag assign dropdown and option group assign dropdown show all items including already-assigned ones. Users can attempt duplicate assignments. The FE has no guard, and the server error (TAG_ALREADY_ASSIGNED) has no dedicated UI handler.

**Files:**
- Modify: `src/modules/product/components/ProductTagsTab.vue`
- Modify: `src/modules/product/components/ProductOptionGroupsTab.vue`

- [ ] **Step 1: Filter available tags in `ProductTagsTab.vue`**

  In the `onMounted` callback, replace `availableTags.value = tagStore.items.map(...)` with:

  ```typescript
  onMounted(async () => {
    await tagStore.fetchPaged({ PageNumber: 1, PageSize: 200 })
    await loadTags()
    const assignedIds = new Set(tags.value.map((t) => t.TagId))
    availableTags.value = tagStore.items
      .filter((t) => !assignedIds.has(t.id))
      .map((t) => ({ id: t.id, name: t.name }))
  })
  ```

  Also refresh `availableTags` after a successful assign:
  ```typescript
  async function onAssign() {
    if (!selectedTagId.value) return
    const ok = await assignTag({ TagId: selectedTagId.value })
    if (ok) {
      showAssign.value = false
      selectedTagId.value = null
      await loadTags()
      const assignedIds = new Set(tags.value.map((t) => t.TagId))
      availableTags.value = tagStore.items
        .filter((t) => !assignedIds.has(t.id))
        .map((t) => ({ id: t.id, name: t.name }))
    }
  }
  ```

- [ ] **Step 2: Filter available option groups in `ProductOptionGroupsTab.vue`**

  In `onMounted`, replace `allGroups.value = groupStore.items.map(...)` with:

  ```typescript
  onMounted(async () => {
    await groupStore.fetchPaged({ PageNumber: 1, PageSize: 200 })
    await loadOptionGroups()
    const assignedIds = new Set(optionGroups.value.map((og) => og.GroupId))
    allGroups.value = groupStore.items
      .filter((g) => !assignedIds.has(g.id))
      .map((g) => ({ id: g.id, name: g.name }))
  })
  ```

  Also refresh after a successful assign.

- [ ] **Step 3: Type-check**

  ```bash
  npm run type-check
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/modules/product/components/ProductTagsTab.vue src/modules/product/components/ProductOptionGroupsTab.vue
  git commit -m "fix(product): filter already-assigned tags and option groups from assign dropdowns

  Dropdowns showed all items including ones already assigned to the product.
  Now subtracts assigned items from available options after load and after assign."
  ```

---

## Task 6: Fix Store Override URLs + Add Prices List to Override Tabs

**Why:** The FE store-override API constants use `/admin/products/${id}/stores` but the BE controller is at `/admin/store-overrides/products/{id}/stores/{storeId}/availability`. The URLs are completely mismatched so store override upsert/remove don't work. Additionally, existing price overrides are never loaded (no GET call + no list display), so users cannot see or delete them.

> **Prerequisite:** BE plan Task 4 (GET /admin/store-overrides/products/{id}/overview) must be deployed.

**Files:**
- Modify: `src/core/constants/api.constants.ts`
- Modify: `src/modules/product/api/store-overrides.api.ts`
- Modify: `src/modules/product/services/store-overrides.service.ts`
- Modify: `src/modules/product/composables/useStoreOverrides.ts`
- Modify: `src/modules/product/components/ProductStoreOverridesTab.vue`
- Modify: `src/modules/product/components/OptionStoreOverridesTab.vue`

- [ ] **Step 1: Fix API endpoint constants in `api.constants.ts`**

  Find the `PRODUCT` section's store override constants and replace them. The constants live under `API_ENDPOINTS.PRODUCT`. Replace the `PRODUCT_API` store-related constants and the `OPTION_API` store-related constants:

  ```typescript
  STORE_OVERRIDE_API: {
    // Product store overrides
    GET_PRODUCT_OVERVIEW: (productId: number) =>
      `/admin/store-overrides/products/${productId}/overview`,
    UPSERT_PRODUCT_AVAILABILITY: (productId: number, storeId: number) =>
      `/admin/store-overrides/products/${productId}/stores/${storeId}/availability`,
    REMOVE_PRODUCT_AVAILABILITY: (productId: number, storeId: number) =>
      `/admin/store-overrides/products/${productId}/stores/${storeId}/availability`,
    UPSERT_PRODUCT_PRICE: (productId: number, storeId: number) =>
      `/admin/store-overrides/products/${productId}/stores/${storeId}/price`,
    REMOVE_PRODUCT_PRICE: (productId: number, storeId: number) =>
      `/admin/store-overrides/products/${productId}/stores/${storeId}/price`,
    // Option store overrides
    GET_OPTION_OVERVIEW: (optionId: number) =>
      `/admin/store-overrides/options/${optionId}/overview`,
    UPSERT_OPTION_AVAILABILITY: (optionId: number, storeId: number) =>
      `/admin/store-overrides/options/${optionId}/stores/${storeId}/availability`,
    REMOVE_OPTION_AVAILABILITY: (optionId: number, storeId: number) =>
      `/admin/store-overrides/options/${optionId}/stores/${storeId}/availability`,
    UPSERT_OPTION_PRICE: (optionId: number, storeId: number) =>
      `/admin/store-overrides/options/${optionId}/stores/${storeId}/price`,
    REMOVE_OPTION_PRICE: (optionId: number, storeId: number) =>
      `/admin/store-overrides/options/${optionId}/stores/${storeId}/price`,
  },
  ```

  Remove the old `GET_STORE_OVERRIDES`, `UPSERT_STORE`, `REMOVE_STORE`, `UPSERT_STORE_PRICE`, `REMOVE_STORE_PRICE`, `GET_STORE_AVAILABILITY`, `UPSERT_STORE_AVAILABILITY`, `REMOVE_STORE_AVAILABILITY` keys from `PRODUCT_API` and `OPTION_API`.

- [ ] **Step 2: Rewrite `store-overrides.api.ts`**

  ```typescript
  import { API_ENDPOINTS } from '@/core/constants/api.constants'
  import type { ApiResponse } from '@/core/models/common.dto'
  import { productClient } from '@/core/api/clients/product.client'
  import type {
    ProductStoreOverviewDto,
    UpsertProductStoreRequest,
    UpsertProductStorePriceRequest,
    OptionStoreOverviewDto,
    UpsertOptionStoreAvailabilityRequest,
    UpsertOptionStorePriceRequest,
  } from '../models/dtos/store-overrides.dto'

  const EP = API_ENDPOINTS.PRODUCT.STORE_OVERRIDE_API

  export const storeOverridesApi = {
    getProductOverviewAsync(productId: number): Promise<ApiResponse<ProductStoreOverviewDto>> {
      return productClient.get(EP.GET_PRODUCT_OVERVIEW(productId))
    },
    upsertProductAvailabilityAsync(
      productId: number,
      storeId: number,
      payload: UpsertProductStoreRequest,
    ): Promise<ApiResponse<unknown>> {
      return productClient.put(EP.UPSERT_PRODUCT_AVAILABILITY(productId, storeId), payload)
    },
    removeProductAvailabilityAsync(productId: number, storeId: number): Promise<ApiResponse<unknown>> {
      return productClient.delete(EP.REMOVE_PRODUCT_AVAILABILITY(productId, storeId))
    },
    upsertProductPriceAsync(
      productId: number,
      storeId: number,
      payload: UpsertProductStorePriceRequest,
    ): Promise<ApiResponse<unknown>> {
      return productClient.put(EP.UPSERT_PRODUCT_PRICE(productId, storeId), payload)
    },
    removeProductPriceAsync(productId: number, storeId: number): Promise<ApiResponse<unknown>> {
      return productClient.delete(EP.REMOVE_PRODUCT_PRICE(productId, storeId))
    },
    getOptionOverviewAsync(optionId: number): Promise<ApiResponse<OptionStoreOverviewDto>> {
      return productClient.get(EP.GET_OPTION_OVERVIEW(optionId))
    },
    upsertOptionAvailabilityAsync(
      optionId: number,
      storeId: number,
      payload: UpsertOptionStoreAvailabilityRequest,
    ): Promise<ApiResponse<unknown>> {
      return productClient.put(EP.UPSERT_OPTION_AVAILABILITY(optionId, storeId), payload)
    },
    removeOptionAvailabilityAsync(optionId: number, storeId: number): Promise<ApiResponse<unknown>> {
      return productClient.delete(EP.REMOVE_OPTION_AVAILABILITY(optionId, storeId))
    },
    upsertOptionPriceAsync(
      optionId: number,
      storeId: number,
      payload: UpsertOptionStorePriceRequest,
    ): Promise<ApiResponse<unknown>> {
      return productClient.put(EP.UPSERT_OPTION_PRICE(optionId, storeId), payload)
    },
    removeOptionPriceAsync(optionId: number, storeId: number): Promise<ApiResponse<unknown>> {
      return productClient.delete(EP.REMOVE_OPTION_PRICE(optionId, storeId))
    },
  }
  ```

- [ ] **Step 3: Add DTO types for overview responses in `store-overrides.dto.ts`**

  Append to `src/modules/product/models/dtos/store-overrides.dto.ts`:

  ```typescript
  export interface ProductStoreOverviewDto {
    Availability: { StoreId: number; IsAvailable: boolean }[]
    Prices: { StoreId: number; Price: number }[]
  }

  export interface OptionStoreOverviewDto {
    Availability: { StoreId: number; IsAvailable: boolean }[]
    Prices: { StoreId: number; Price: number }[]
  }
  ```

- [ ] **Step 4: Update `store-overrides.service.ts`**

  Rewrite the service to match the new API shape. The key change is that `storeId` is now a parameter (not just in request body for upsert):

  ```typescript
  import { storeOverridesApi } from '../api/store-overrides.api'
  import type {
    ProductStoreOverviewDto,
    UpsertProductStoreRequest,
    UpsertProductStorePriceRequest,
    OptionStoreOverviewDto,
    UpsertOptionStoreAvailabilityRequest,
    UpsertOptionStorePriceRequest,
  } from '../models/dtos/store-overrides.dto'

  class StoreOverridesService {
    async getProductOverviewAsync(productId: number): Promise<ProductStoreOverviewDto> {
      const r = await storeOverridesApi.getProductOverviewAsync(productId)
      return r.Data ?? { Availability: [], Prices: [] }
    }

    async upsertProductAvailabilityAsync(
      productId: number,
      storeId: number,
      payload: UpsertProductStoreRequest,
    ): Promise<boolean> {
      await storeOverridesApi.upsertProductAvailabilityAsync(productId, storeId, payload)
      return true
    }

    async removeProductAvailabilityAsync(productId: number, storeId: number): Promise<boolean> {
      await storeOverridesApi.removeProductAvailabilityAsync(productId, storeId)
      return true
    }

    async upsertProductPriceAsync(
      productId: number,
      storeId: number,
      payload: UpsertProductStorePriceRequest,
    ): Promise<boolean> {
      await storeOverridesApi.upsertProductPriceAsync(productId, storeId, payload)
      return true
    }

    async removeProductPriceAsync(productId: number, storeId: number): Promise<boolean> {
      await storeOverridesApi.removeProductPriceAsync(productId, storeId)
      return true
    }

    async getOptionOverviewAsync(optionId: number): Promise<OptionStoreOverviewDto> {
      const r = await storeOverridesApi.getOptionOverviewAsync(optionId)
      return r.Data ?? { Availability: [], Prices: [] }
    }

    async upsertOptionAvailabilityAsync(
      optionId: number,
      storeId: number,
      payload: UpsertOptionStoreAvailabilityRequest,
    ): Promise<boolean> {
      await storeOverridesApi.upsertOptionAvailabilityAsync(optionId, storeId, payload)
      return true
    }

    async removeOptionAvailabilityAsync(optionId: number, storeId: number): Promise<boolean> {
      await storeOverridesApi.removeOptionAvailabilityAsync(optionId, storeId)
      return true
    }

    async upsertOptionPriceAsync(
      optionId: number,
      storeId: number,
      payload: UpsertOptionStorePriceRequest,
    ): Promise<boolean> {
      await storeOverridesApi.upsertOptionPriceAsync(optionId, storeId, payload)
      return true
    }

    async removeOptionPriceAsync(optionId: number, storeId: number): Promise<boolean> {
      await storeOverridesApi.removeOptionPriceAsync(optionId, storeId)
      return true
    }
  }

  export const storeOverridesService = new StoreOverridesService()
  ```

- [ ] **Step 5: Rewrite `useProductStoreOverrides` in `useStoreOverrides.ts`**

  Replace `useProductStoreOverrides` function with:

  ```typescript
  export function useProductStoreOverrides(productId: number) {
    const toast = useToastNotification()
    const isLoading = ref(false)
    const isSubmitting = ref(false)
    const availability = ref<{ StoreId: number; IsAvailable: boolean }[]>([])
    const prices = ref<{ StoreId: number; Price: number }[]>([])

    async function loadOverview() {
      isLoading.value = true
      try {
        const data = await storeOverridesService.getProductOverviewAsync(productId)
        availability.value = data.Availability
        prices.value = data.Prices
      } catch {
        toast.error('Không thể tải thông tin cửa hàng.')
      } finally {
        isLoading.value = false
      }
    }

    async function upsertAvailability(storeId: number, isAvailable: boolean): Promise<boolean> {
      isSubmitting.value = true
      try {
        await storeOverridesService.upsertProductAvailabilityAsync(productId, storeId, { StoreId: storeId, IsAvailable: isAvailable })
        toast.success('Lưu thành công.')
        return true
      } catch {
        toast.error('Lưu thất bại.')
        return false
      } finally {
        isSubmitting.value = false
      }
    }

    async function removeAvailability(storeId: number): Promise<boolean> {
      try {
        await storeOverridesService.removeProductAvailabilityAsync(productId, storeId)
        toast.success('Xóa thành công.')
        return true
      } catch {
        toast.error('Xóa thất bại.')
        return false
      }
    }

    async function upsertPrice(storeId: number, price: number): Promise<boolean> {
      isSubmitting.value = true
      try {
        await storeOverridesService.upsertProductPriceAsync(productId, storeId, { StoreId: storeId, Price: price })
        toast.success('Cập nhật giá thành công.')
        return true
      } catch {
        toast.error('Cập nhật giá thất bại.')
        return false
      } finally {
        isSubmitting.value = false
      }
    }

    async function removePrice(storeId: number): Promise<boolean> {
      try {
        await storeOverridesService.removeProductPriceAsync(productId, storeId)
        toast.success('Xóa giá thành công.')
        return true
      } catch {
        toast.error('Xóa giá thất bại.')
        return false
      }
    }

    return { isLoading, isSubmitting, availability, prices, loadOverview, upsertAvailability, removeAvailability, upsertPrice, removePrice }
  }
  ```

  Repeat the same refactor for `useOptionStoreOverrides` (replacing `stores` with `availability` + `prices`, calling `storeOverridesService.getOptionOverviewAsync`).

- [ ] **Step 6: Rewrite `ProductStoreOverridesTab.vue`**

  ```vue
  <template>
    <div class="pa-4 d-flex flex-column ga-4">
      <v-progress-linear v-if="isLoading" indeterminate color="primary" />
      <v-row>
        <!-- Availability column -->
        <v-col cols="12" md="6">
          <v-card variant="outlined" rounded="lg">
            <v-card-title class="text-subtitle-2 pa-3">Khả dụng theo cửa hàng</v-card-title>
            <v-divider />
            <v-card-text>
              <v-table v-if="availability.length" density="compact">
                <thead>
                  <tr><th>Store ID</th><th class="text-center">Khả dụng</th><th></th></tr>
                </thead>
                <tbody>
                  <tr v-for="a in availability" :key="a.StoreId">
                    <td>{{ a.StoreId }}</td>
                    <td class="text-center">
                      <v-icon :color="a.IsAvailable ? 'success' : 'error'"
                              :icon="a.IsAvailable ? 'mdi-check-circle' : 'mdi-close-circle'" />
                    </td>
                    <td class="text-end">
                      <v-btn size="x-small" icon="mdi-delete-outline" variant="text" color="error"
                             @click="onRemoveAvailability(a.StoreId)" />
                    </td>
                  </tr>
                </tbody>
              </v-table>
              <v-alert v-else-if="!isLoading" type="info" variant="tonal" density="compact" class="mb-2">
                Chưa có cài đặt.
              </v-alert>
              <div class="d-flex ga-2 mt-2 align-center flex-wrap">
                <v-text-field v-model.number="newStoreId" label="Store ID" type="number"
                              density="compact" hide-details style="max-width:120px" />
                <v-switch v-model="newIsAvailable" label="Khả dụng" color="primary" hide-details />
                <v-btn color="primary" size="small" :loading="isSubmitting" @click="onUpsertAvailability">Lưu</v-btn>
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
              <v-table v-if="prices.length" density="compact">
                <thead>
                  <tr><th>Store ID</th><th class="text-end">Giá</th><th></th></tr>
                </thead>
                <tbody>
                  <tr v-for="p in prices" :key="p.StoreId">
                    <td>{{ p.StoreId }}</td>
                    <td class="text-end">{{ p.Price.toLocaleString('vi-VN') }} ₫</td>
                    <td class="text-end">
                      <v-btn size="x-small" icon="mdi-delete-outline" variant="text" color="error"
                             @click="onRemovePrice(p.StoreId)" />
                    </td>
                  </tr>
                </tbody>
              </v-table>
              <v-alert v-else-if="!isLoading" type="info" variant="tonal" density="compact" class="mb-2">
                Chưa có giá riêng.
              </v-alert>
              <div class="d-flex ga-2 mt-2 align-center flex-wrap">
                <v-text-field v-model.number="priceStoreId" label="Store ID" type="number"
                              density="compact" hide-details style="max-width:120px" />
                <AppCurrencyField v-model="priceValue" label="Giá" style="max-width:160px" />
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
  import { AppCurrencyField } from '@/components/ui'
  import { useProductStoreOverrides } from '../composables/useStoreOverrides'

  const props = defineProps<{ productId: number }>()
  const { isLoading, isSubmitting, availability, prices, loadOverview,
          upsertAvailability, removeAvailability, upsertPrice, removePrice } =
    useProductStoreOverrides(props.productId)

  const newStoreId = ref(0)
  const newIsAvailable = ref(true)
  const priceStoreId = ref(0)
  const priceValue = ref<number>(0)

  async function onUpsertAvailability() {
    const ok = await upsertAvailability(newStoreId.value, newIsAvailable.value)
    if (ok) { newStoreId.value = 0; await loadOverview() }
  }

  async function onRemoveAvailability(storeId: number) {
    const ok = await removeAvailability(storeId)
    if (ok) await loadOverview()
  }

  async function onUpsertPrice() {
    const ok = await upsertPrice(priceStoreId.value, priceValue.value)
    if (ok) { priceStoreId.value = 0; priceValue.value = 0; await loadOverview() }
  }

  async function onRemovePrice(storeId: number) {
    const ok = await removePrice(storeId)
    if (ok) await loadOverview()
  }

  onMounted(loadOverview)
  </script>
  ```

  Apply the same pattern to `OptionStoreOverridesTab.vue` (using `useOptionStoreOverrides`).

- [ ] **Step 7: Type-check**

  ```bash
  npm run type-check
  ```
  Expected: No errors.

- [ ] **Step 8: Commit**

  ```bash
  git add src/core/constants/api.constants.ts
  git add src/modules/product/api/store-overrides.api.ts
  git add src/modules/product/services/store-overrides.service.ts
  git add src/modules/product/composables/useStoreOverrides.ts
  git add src/modules/product/models/dtos/store-overrides.dto.ts
  git add src/modules/product/components/ProductStoreOverridesTab.vue
  git add src/modules/product/components/OptionStoreOverridesTab.vue
  git commit -m "fix(product): fix store override URLs and add price list loading

  FE API constants pointed to /admin/products/{id}/stores but BE controller is at
  /admin/store-overrides/products/{id}/stores/{storeId}/availability. URLs now match.
  Also adds storeId to upsert URL (now route param), and loads + displays existing
  price overrides from the new GET overview endpoint so users can delete them."
  ```

---

## Task 7: TagDetailView — Create Missing Page

**Why:** `TagDetailView.vue` does not exist. The spec requires `/admin/product/tags/:id` showing tag info with a live color preview pill and a products widget (max 5 + "Xem tất cả" link). The view button in TagList currently links nowhere.

**Files:**
- Create: `src/modules/product/views/TagDetailView.vue`
- Modify: `src/core/constants/app-routes.constants.ts`
- Modify: `src/router/routes.ts`
- Modify: `src/modules/product/views/TagsView.vue` (wire the 👁️ view action)

- [ ] **Step 1: Add TAG_DETAIL route constant**

  In `app-routes.constants.ts`, inside the `PRODUCT` block after `TAGS`:

  ```typescript
  TAG_DETAIL: {
    NAME: 'admin:product-tag-detail',
    PATH: 'product/tags/:id',
  },
  ```

- [ ] **Step 2: Register route in `routes.ts`**

  After the existing `TAGS` route registration:

  ```typescript
  {
    path: APP_ROUTES.PRODUCT.TAG_DETAIL.PATH,
    name: APP_ROUTES.PRODUCT.TAG_DETAIL.NAME,
    component: () => import('@/modules/product/views/TagDetailView.vue'),
    meta: {
      title: 'Chi tiết nhãn',
      requiresAuth: true,
      breadcrumbs: [
        { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
        { title: 'Sản phẩm' },
        { title: 'Nhãn', to: { name: APP_ROUTES.PRODUCT.TAGS.NAME } },
        { title: 'Chi tiết', disabled: true },
      ],
    },
  },
  ```

- [ ] **Step 3: Create `TagDetailView.vue`**

  ```vue
  <template>
    <div class="d-flex flex-column ga-5">
      <template v-if="tag.loading.value">
        <v-skeleton-loader type="heading" />
        <v-skeleton-loader type="card" height="120" />
      </template>

      <template v-else-if="tag.data.value">
        <!-- Hero header -->
        <v-card variant="tonal" color="primary" rounded="lg" flat>
          <v-card-text class="pa-5">
            <AppBreadcrumb
              :items="[
                { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                { title: 'Nhãn', to: { name: APP_ROUTES.PRODUCT.TAGS.NAME } },
                { title: tag.data.value.name, disabled: true },
              ]"
            />
            <div class="d-flex align-center ga-3 mt-3">
              <div class="text-h6 font-weight-bold">{{ tag.data.value.name }}</div>
              <!-- Live tag pill preview -->
              <v-chip
                :style="{
                  backgroundColor: tag.data.value.colorHex ?? '#E0E0E0',
                  color: tag.data.value.textColor ?? '#000000',
                }"
                size="small"
              >
                {{ tag.data.value.name }}
              </v-chip>
              <v-spacer />
              <v-btn variant="outlined" prepend-icon="mdi-pencil" @click="openEdit">Sửa</v-btn>
              <v-btn color="error" variant="outlined" prepend-icon="mdi-delete" @click="confirmDeleteOpen = true">
                Xoá
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- Info card -->
        <v-card rounded="lg" elevation="1">
          <v-card-title class="text-subtitle-1 pa-4 pb-2">Thông tin nhãn</v-card-title>
          <v-divider />
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-list density="compact">
                  <v-list-item title="Tên" :subtitle="tag.data.value.name" />
                  <v-list-item title="Màu nền">
                    <template #subtitle>
                      <span class="d-flex align-center ga-2">
                        {{ tag.data.value.colorHex ?? '—' }}
                        <v-sheet
                          v-if="tag.data.value.colorHex"
                          :style="{ backgroundColor: tag.data.value.colorHex }"
                          width="20" height="20" rounded="sm"
                        />
                      </span>
                    </template>
                  </v-list-item>
                  <v-list-item title="Màu chữ">
                    <template #subtitle>
                      <span class="d-flex align-center ga-2">
                        {{ tag.data.value.textColor ?? '—' }}
                        <v-sheet
                          v-if="tag.data.value.textColor"
                          :style="{ backgroundColor: tag.data.value.textColor }"
                          width="20" height="20" rounded="sm"
                        />
                      </span>
                    </template>
                  </v-list-item>
                </v-list>
              </v-col>
              <v-col cols="12" md="6">
                <v-list density="compact">
                  <v-list-item title="Thứ tự" :subtitle="tag.data.value.displayOrder.toString()" />
                  <v-list-item title="Trạng thái" :subtitle="tag.data.value.isActive ? 'Hoạt động' : 'Ẩn'" />
                  <v-list-item title="Ngày tạo" :subtitle="tag.data.value.createdAt ?? '—'" />
                </v-list>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Products using this tag (max 5) -->
        <v-card rounded="lg" elevation="1">
          <v-card-title class="text-subtitle-1 pa-4 pb-2 d-flex align-center justify-space-between">
            <span>Sản phẩm đang dùng nhãn này ({{ tagProductTotal }})</span>
            <v-btn
              v-if="tagProductTotal > 5"
              variant="text"
              size="small"
              :to="{ name: APP_ROUTES.PRODUCT.PRODUCTS.NAME, query: { tagId: tagId } }"
            >
              Xem tất cả →
            </v-btn>
          </v-card-title>
          <v-divider />
          <v-card-text>
            <v-progress-linear v-if="productsLoading" indeterminate color="primary" class="mb-2" />
            <v-list v-if="tagProducts.length" density="compact">
              <v-list-item
                v-for="p in tagProducts"
                :key="p.id"
                :title="p.name"
                :subtitle="`${p.categoryName ?? '—'} · ${p.basePrice.toLocaleString('vi-VN')} ₫`"
                :to="{ name: APP_ROUTES.PRODUCT.PRODUCT_DETAIL.NAME, params: { id: p.id } }"
              />
            </v-list>
            <v-alert v-else-if="!productsLoading" type="info" variant="tonal" density="compact">
              Chưa có sản phẩm nào dùng nhãn này.
            </v-alert>
          </v-card-text>
        </v-card>
      </template>

      <AppEmptyState
        v-else-if="!tag.loading.value"
        icon="mdi-tag-remove"
        title="Không tìm thấy nhãn"
        description="Nhãn này không tồn tại hoặc đã bị xóa."
      >
        <template #actions>
          <v-btn color="primary" prepend-icon="mdi-arrow-left" :to="{ name: APP_ROUTES.PRODUCT.TAGS.NAME }">
            Quay lại danh sách
          </v-btn>
        </template>
      </AppEmptyState>

      <!-- Edit dialog -->
      <AppDialog v-model="editOpen" title="Sửa nhãn" :hide-actions="true" max-width="600px">
        <TagForm
          v-if="editOpen && tag.data.value"
          v-model="editForm"
          :is-submitting="isSubmitting"
          :edit-id="tagId"
          @submit="onEditSubmit"
          @cancel="editOpen = false"
        />
      </AppDialog>

      <!-- Delete confirm -->
      <AppConfirmDialog
        v-model="confirmDeleteOpen"
        title="Xoá nhãn"
        :message="`Bạn có chắc muốn xoá nhãn '${tag.data.value?.name}'? Hành động này không thể hoàn tác.`"
        confirm-label="Xác nhận xoá"
        confirm-variant="danger"
        @confirm="onDelete"
      />
    </div>
  </template>

  <script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { AppBreadcrumb, AppEmptyState, AppDialog, AppConfirmDialog } from '@/components/ui'
  import { useAsyncState } from '@/composables/useAsyncState'
  import { APP_ROUTES } from '@/core/constants/_index'
  import { tagService } from '../services/tag.service'
  import { productService } from '../services/product.service'
  import { useTag } from '../composables/useTag'
  import TagForm from '../components/TagForm.vue'
  import { createEmptyTagForm } from '../models/form-models/tag.model'
  import type { UpdateTagRequest } from '../models/dtos/tag.dto'
  import type { ProductViewModel } from '../models/view-models/product.view-model'

  const route = useRoute()
  const router = useRouter()
  const tagId = Number(route.params['id'])

  const tag = useAsyncState(() => tagService.getByIdAsync(tagId))
  const tagProducts = ref<ProductViewModel[]>([])
  const tagProductTotal = ref(0)
  const productsLoading = ref(false)
  const editOpen = ref(false)
  const editForm = ref(createEmptyTagForm())
  const confirmDeleteOpen = ref(false)
  const { isSubmitting, updateTag, deleteTag } = useTag()

  async function loadTagProducts() {
    productsLoading.value = true
    try {
      const result = await productService.getPagedAsync({
        PageNumber: 1,
        PageSize: 5,
        TagId: tagId,
      })
      tagProducts.value = result.items
      tagProductTotal.value = result.total
    } finally {
      productsLoading.value = false
    }
  }

  function openEdit() {
    if (!tag.data.value) return
    editForm.value = {
      name: tag.data.value.name,
      colorHex: tag.data.value.colorHex ?? '',
      textColor: tag.data.value.textColor ?? '',
      iconUrl: tag.data.value.iconUrl ?? '',
      displayOrder: tag.data.value.displayOrder,
      isActive: tag.data.value.isActive,
    }
    editOpen.value = true
  }

  async function onEditSubmit(form: typeof editForm.value) {
    const payload: UpdateTagRequest = {
      Name: form.name,
      ColorHex: form.colorHex || null,
      TextColor: form.textColor || null,
      IconUrl: form.iconUrl || null,
      DisplayOrder: form.displayOrder,
      IsActive: form.isActive,
    }
    const ok = await updateTag(tagId, payload)
    if (ok) { editOpen.value = false; await tag.execute() }
  }

  async function onDelete() {
    const ok = await deleteTag(tagId)
    if (ok) router.push({ name: APP_ROUTES.PRODUCT.TAGS.NAME })
  }

  onMounted(async () => {
    await tag.execute()
    await loadTagProducts()
  })
  </script>
  ```

  > **Note:** `tagService.getByIdAsync`, `productService.getPagedAsync` with `TagId` filter, and `createEmptyTagForm` must exist. Check `tag.service.ts` and `product.service.ts`; add `TagId?: number` to `ProductFilterDto` if not present (also update BE `ProductFilterDto` and `ProductRepository.GetPagedAsync` to filter by tag).

- [ ] **Step 4: Wire view action in `TagsView.vue`**

  In `TagsView.vue`, locate the `onRowAction` handler. Add the view/detail action:

  ```typescript
  import { useRouter } from 'vue-router'
  const router = useRouter()

  async function onRowAction(key: string, item: TagViewModel) {
    if (key === TAG_ROW_ACTION.DETAIL) {
      router.push({ name: APP_ROUTES.PRODUCT.TAG_DETAIL.NAME, params: { id: item.id } })
    } else if (key === TAG_ROW_ACTION.EDIT) { ... }
    ...
  }
  ```

  Ensure `TAG_ROW_ACTION.DETAIL` exists in `tag-list.constants.ts`. If not, add it:
  ```typescript
  export const TAG_ROW_ACTION = {
    DETAIL: 'detail',
    EDIT: 'edit',
    DELETE: 'delete',
  } as const
  ```

  Ensure TagList renders a 👁️ action row with key `'detail'`.

- [ ] **Step 5: Type-check**

  ```bash
  npm run type-check
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/modules/product/views/TagDetailView.vue
  git add src/core/constants/app-routes.constants.ts src/router/routes.ts
  git add src/modules/product/views/TagsView.vue
  git commit -m "feat(product): create TagDetailView with tag info, color preview pill, products widget"
  ```

---

## Task 8: CategoryDetailView — Edit/Delete Buttons + Products Widget + Conditional Subcategories

**Why:** The spec requires Edit/Delete buttons on the detail page header, a products widget (max 5 + "Xem tất cả"), and the sub-categories tab should only appear when the category has children.

**Files:**
- Modify: `src/modules/product/views/CategoryDetailView.vue`

- [ ] **Step 1: Add Edit/Delete buttons to the hero header**

  In `CategoryDetailView.vue`, inside the hero header after `<v-spacer />` (before `</v-card-text>`):

  ```vue
  <v-btn variant="outlined" prepend-icon="mdi-pencil" @click="openEdit">Sửa</v-btn>
  <v-btn color="error" variant="outlined" prepend-icon="mdi-delete" @click="confirmDeleteOpen = true">
    Xoá
  </v-btn>
  ```

  Add imports and state:
  ```typescript
  import { AppBreadcrumb, AppEmptyState, AppStatusChip, AppDialog, AppConfirmDialog } from '@/components/ui'
  import CategoryForm from '../components/CategoryForm.vue'
  import { useCategory } from '../composables/useCategory'
  import { createEmptyCategoryForm } from '../models/form-models/category.model'
  import type { UpdateCategoryRequest } from '../models/dtos/category.dto'

  const { isSubmitting, updateCategory, deleteCategory } = useCategory()
  const editOpen = ref(false)
  const editForm = ref(createEmptyCategoryForm())
  const confirmDeleteOpen = ref(false)

  function openEdit() {
    if (!category.data.value) return
    editForm.value = {
      name: category.data.value.name,
      slug: category.data.value.slug ?? '',
      description: category.data.value.description ?? '',
      imageUrl: category.data.value.imageUrl ?? '',
      parentId: category.data.value.parentId,
      displayOrder: category.data.value.displayOrder,
      isActive: category.data.value.isActive,
    }
    editOpen.value = true
  }

  async function onEditSubmit(form: typeof editForm.value) {
    const payload: UpdateCategoryRequest = {
      Name: form.name, Slug: form.slug || null, Description: form.description || null,
      ImageUrl: form.imageUrl || null, ParentId: form.parentId,
      DisplayOrder: form.displayOrder, IsActive: form.isActive,
    }
    const ok = await updateCategory(categoryId, payload)
    if (ok) { editOpen.value = false; await category.execute() }
  }

  async function onDelete() {
    const ok = await deleteCategory(categoryId)
    if (ok) router.push({ name: APP_ROUTES.PRODUCT.CATEGORIES.NAME })
  }
  ```

  Add dialogs to template (after the main tabs card):
  ```vue
  <AppDialog v-model="editOpen" title="Sửa danh mục" :hide-actions="true" max-width="700px">
    <CategoryForm v-if="editOpen" v-model="editForm" :is-submitting="isSubmitting"
      :parent-options="[]" :edit-id="categoryId" @submit="onEditSubmit" @cancel="editOpen = false" />
  </AppDialog>

  <AppConfirmDialog
    v-model="confirmDeleteOpen"
    title="Xoá danh mục"
    :message="`Bạn có chắc muốn xoá danh mục '${category.data.value?.name}'?`"
    confirm-variant="danger"
    @confirm="onDelete"
  />
  ```

- [ ] **Step 2: Make sub-categories tab conditional**

  In the `<v-tabs>` block, add `v-if="children.length > 0"` to the "Danh mục con" tab:

  ```vue
  <v-tab v-if="children.length > 0" value="children" class="text-none" rounded="lg">
    <v-icon start icon="mdi-sitemap-outline" size="18" />
    Danh mục con ({{ children.length }})
  </v-tab>
  ```

  Also guard the `v-window-item`:
  ```vue
  <v-window-item v-if="children.length > 0" value="children">
  ```

- [ ] **Step 3: Add products widget**

  Add to script setup:
  ```typescript
  const categoryProducts = ref<{ id: number; name: string; basePrice: number }[]>([])
  const categoryProductTotal = ref(0)
  const productsLoading = ref(false)

  async function loadCategoryProducts() {
    productsLoading.value = true
    try {
      const result = await productService.getPagedAsync({
        PageNumber: 1, PageSize: 5, CategoryId: categoryId,
      })
      categoryProducts.value = result.items.map((p) => ({
        id: p.id, name: p.name, basePrice: p.basePrice,
      }))
      categoryProductTotal.value = result.total
    } finally {
      productsLoading.value = false
    }
  }
  ```

  In `onMounted`, add `await loadCategoryProducts()`.

  Add products widget card in template (after the tabs card):
  ```vue
  <v-card rounded="lg" elevation="1">
    <v-card-title class="text-subtitle-1 pa-4 pb-2 d-flex align-center justify-space-between">
      <span>Sản phẩm thuộc danh mục này ({{ categoryProductTotal }})</span>
      <v-btn
        v-if="categoryProductTotal > 5"
        variant="text" size="small"
        :to="{ name: APP_ROUTES.PRODUCT.PRODUCTS.NAME, query: { categoryId: categoryId } }"
      >
        Xem tất cả →
      </v-btn>
    </v-card-title>
    <v-divider />
    <v-card-text>
      <v-progress-linear v-if="productsLoading" indeterminate color="primary" class="mb-2" />
      <v-list v-if="categoryProducts.length" density="compact">
        <v-list-item
          v-for="p in categoryProducts" :key="p.id"
          :title="p.name"
          :subtitle="`${p.basePrice.toLocaleString('vi-VN')} ₫`"
          :to="{ name: APP_ROUTES.PRODUCT.PRODUCT_DETAIL.NAME, params: { id: p.id } }"
        />
      </v-list>
      <v-alert v-else-if="!productsLoading" type="info" variant="tonal" density="compact">
        Chưa có sản phẩm nào.
      </v-alert>
    </v-card-text>
  </v-card>
  ```

- [ ] **Step 4: Type-check + commit**

  ```bash
  npm run type-check
  git add src/modules/product/views/CategoryDetailView.vue
  git commit -m "feat(product): CategoryDetailView — Edit/Delete buttons, conditional subcategories, products widget"
  ```

---

## Task 9: OptionDetailView — Add ProductOptionConfig Read-Only Widget

**Why:** Spec requires an "Override theo sản phẩm" widget on OptionDetailView showing which products have configured this option (read-only). Currently the view only shows store overrides.

**Files:**
- Modify: `src/modules/product/views/OptionDetailView.vue`

- [ ] **Step 1: Add ProductOptionConfig data loading to script**

  The existing `OptionDetailView.vue` has a "Cửa hàng" tab via `OptionStoreOverridesTab`. Open the file and in the `<script setup>` block add:

  ```typescript
  import { productRelationsService } from '../services/product-relations.service'

  interface ProductConfigItem {
    ProductId: number
    ProductName: string
    CustomPrice: number | null
    IsDefault: boolean
    IsHidden: boolean
  }

  const productConfigs = ref<ProductConfigItem[]>([])
  const configsLoading = ref(false)

  async function loadProductConfigs() {
    configsLoading.value = true
    try {
      productConfigs.value = await productRelationsService.getOptionConfigsByOptionIdAsync(optionId)
    } catch {
      // non-critical widget; silently fail
    } finally {
      configsLoading.value = false
    }
  }
  ```

  Add `await loadProductConfigs()` inside `onMounted`.

  > **Note:** `productRelationsService.getOptionConfigsByOptionIdAsync(optionId)` may not exist yet. Check `product-relations.service.ts`. If missing, add a method that calls `GET /admin/products/{productId}/option-configs` — but this requires knowing the productId. A better approach is a new BE endpoint `GET /admin/options/{optionId}/product-configs`. Add this as a follow-up or use a client-side approach: skip loading if no endpoint exists, add a TODO comment.

- [ ] **Step 2: Add read-only widget to template**

  Inside the existing tab panel or add a new standalone card (before the store overrides tab card):

  ```vue
  <v-card rounded="lg" elevation="1">
    <v-card-title class="text-subtitle-1 pa-4 pb-2">Cấu hình override theo sản phẩm</v-card-title>
    <v-divider />
    <v-card-text>
      <v-progress-linear v-if="configsLoading" indeterminate color="primary" class="mb-2" />
      <v-table v-if="productConfigs.length" density="compact">
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th class="text-end">Giá tùy chỉnh</th>
            <th class="text-center">Mặc định</th>
            <th class="text-center">Ẩn</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cfg in productConfigs" :key="cfg.ProductId">
            <td>{{ cfg.ProductName }}</td>
            <td class="text-end">
              {{ cfg.CustomPrice != null ? cfg.CustomPrice.toLocaleString('vi-VN') + ' ₫' : '—' }}
            </td>
            <td class="text-center">
              <v-icon :icon="cfg.IsDefault ? 'mdi-check' : 'mdi-minus'"
                      :color="cfg.IsDefault ? 'success' : 'grey'" />
            </td>
            <td class="text-center">
              <v-icon :icon="cfg.IsHidden ? 'mdi-eye-off' : 'mdi-eye'"
                      :color="cfg.IsHidden ? 'error' : 'grey'" />
            </td>
          </tr>
        </tbody>
      </v-table>
      <v-alert v-else-if="!configsLoading" type="info" variant="tonal" density="compact">
        Chưa có cấu hình override nào.
      </v-alert>
    </v-card-text>
  </v-card>
  ```

- [ ] **Step 3: Type-check + commit**

  ```bash
  npm run type-check
  git add src/modules/product/views/OptionDetailView.vue
  git commit -m "feat(product): add ProductOptionConfig read-only widget to OptionDetailView"
  ```

---

## Task 10: OptionGroupDetailView — Add Products-Using-Group Panel

**Why:** Spec requires showing which products use this option group and with what constraints (IsRequired, MinSelect, MaxSelect). Currently the detail view only shows group info and the options list.

**Files:**
- Modify: `src/modules/product/views/OptionGroupDetailView.vue`

- [ ] **Step 1: Load products that use this group**

  In script setup, add:

  ```typescript
  interface ProductGroupUsage {
    ProductId: number
    ProductName: string
    IsRequired: boolean
    MinSelect: number
    MaxSelect: number
  }

  const productUsages = ref<ProductGroupUsage[]>([])
  const usagesLoading = ref(false)

  async function loadProductUsages() {
    usagesLoading.value = true
    try {
      // Calls a new BE endpoint: GET /admin/product-option-groups/{groupId}/products
      // If not yet available, skip with empty array
      productUsages.value = await productRelationsService.getProductsByOptionGroupIdAsync(groupId)
    } catch {
      productUsages.value = []
    } finally {
      usagesLoading.value = false
    }
  }
  ```

  Add `await loadProductUsages()` inside `onMounted`.

  > **Note:** `productRelationsService.getProductsByOptionGroupIdAsync(groupId)` requires a new BE endpoint `GET /admin/product-option-groups/{groupId}/products`. Add as a follow-up BE task or implement with a query filter on `ProductOptionGroups` in an existing product query.

- [ ] **Step 2: Add panel to template**

  Append after the options panel:

  ```vue
  <v-card rounded="lg" elevation="1">
    <v-card-title class="text-subtitle-1 pa-4 pb-2">
      Sản phẩm đang dùng nhóm này ({{ productUsages.length }})
    </v-card-title>
    <v-divider />
    <v-card-text>
      <v-progress-linear v-if="usagesLoading" indeterminate color="primary" class="mb-2" />
      <v-table v-if="productUsages.length" density="compact">
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th class="text-center">Bắt buộc</th>
            <th class="text-center">Min</th>
            <th class="text-center">Max</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in productUsages" :key="u.ProductId">
            <td>
              <router-link :to="{ name: APP_ROUTES.PRODUCT.PRODUCT_DETAIL.NAME, params: { id: u.ProductId } }">
                {{ u.ProductName }}
              </router-link>
            </td>
            <td class="text-center">
              <v-icon :icon="u.IsRequired ? 'mdi-check' : 'mdi-minus'"
                      :color="u.IsRequired ? 'success' : 'grey'" />
            </td>
            <td class="text-center">{{ u.MinSelect }}</td>
            <td class="text-center">{{ u.MaxSelect }}</td>
          </tr>
        </tbody>
      </v-table>
      <v-alert v-else-if="!usagesLoading" type="info" variant="tonal" density="compact">
        Chưa có sản phẩm nào dùng nhóm này.
      </v-alert>
    </v-card-text>
  </v-card>
  ```

- [ ] **Step 3: Type-check + commit**

  ```bash
  npm run type-check
  git add src/modules/product/views/OptionGroupDetailView.vue
  git commit -m "feat(product): add products-using-group panel to OptionGroupDetailView"
  ```

---

## Task 11: CategoriesView — Add Search Input

**Why:** The spec requires a free-text search bar on the categories list. Currently only a parent-filter autocomplete exists; there is no name keyword search.

**Files:**
- Modify: `src/modules/product/views/CategoriesView.vue`

- [ ] **Step 1: Add keyword search state and filter bar**

  In script setup, add:
  ```typescript
  const filterKeyword = ref<string | null>(null)
  ```

  Update `fetchData` to include keyword:
  ```typescript
  async function fetchData() {
    await loadCategories({
      PageNumber: page.value,
      PageSize: pageSize.value,
      ParentId: filterParentId.value,
      Keyword: filterKeyword.value || undefined,
    })
  }
  ```

  In template, add a keyword field to the filter bar row (before the parent autocomplete column):
  ```vue
  <v-col cols="12" md="4">
    <v-text-field
      v-model="filterKeyword"
      label="Tìm kiếm theo tên"
      prepend-inner-icon="mdi-magnify"
      clearable
      density="compact"
      hide-details
      @update:model-value="onFilterChange"
      @keyup.enter="onFilterChange"
    />
  </v-col>
  ```

- [ ] **Step 2: Verify `CategoryFilterDto` has `Keyword` field**

  In `src/modules/product/models/dtos/category.dto.ts`, confirm `CategoryFilterDto` (or the equivalent request type) includes `Keyword?: string`. If not, add it. The BE `CategoryFilterDto` already has `Keyword` in its filter model.

- [ ] **Step 3: Type-check + commit**

  ```bash
  npm run type-check
  git add src/modules/product/views/CategoriesView.vue
  git commit -m "feat(product): add keyword search to CategoriesView filter bar"
  ```

---

## Task 12: ProductsView — Add Filter Bar

**Why:** The spec requires search by name, category filter, and status filter on the product list. Currently the view has no filter bar at all.

**Files:**
- Modify: `src/modules/product/views/ProductsView.vue`

- [ ] **Step 1: Add filter state and fetch update**

  In script setup, add:
  ```typescript
  import { useCategoryStore } from '../stores/category.store'

  const filterKeyword = ref<string | null>(null)
  const filterCategoryId = ref<number | null>(null)
  const filterIsActive = ref<boolean | null>(null)

  const categoryStore = useCategoryStore()
  const categoryOptions = computed(() =>
    categoryStore.items.map((c) => ({ id: c.id, name: c.name }))
  )

  const statusOptions = [
    { label: 'Đang bán', value: true },
    { label: 'Ngừng bán', value: false },
  ]
  ```

  Update `fetchData`:
  ```typescript
  async function fetchData() {
    await loadProducts({
      PageNumber: page.value,
      PageSize: pageSize.value,
      Keyword: filterKeyword.value || undefined,
      CategoryId: filterCategoryId.value,
      IsActive: filterIsActive.value,
    })
  }
  ```

  Add `onFilterChange` handler:
  ```typescript
  function onFilterChange() { page.value = 1; fetchData() }
  ```

  Load categories on mount:
  ```typescript
  onMounted(async () => {
    await categoryStore.fetchPaged({ PageNumber: 1, PageSize: 200 })
    fetchData()
  })
  ```

- [ ] **Step 2: Add filter bar to template**

  Add a filter bar card between `AppPageHeader` and `ProductList`:

  ```vue
  <v-card rounded="lg" variant="outlined">
    <v-card-text class="pa-3">
      <v-row dense>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="filterKeyword"
            label="Tìm kiếm tên sản phẩm"
            prepend-inner-icon="mdi-magnify"
            clearable density="compact" hide-details
            @update:model-value="onFilterChange"
            @keyup.enter="onFilterChange"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-autocomplete
            v-model="filterCategoryId"
            :items="categoryOptions"
            item-value="id" item-title="name"
            label="Danh mục"
            clearable density="compact" hide-details
            @update:model-value="onFilterChange"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="filterIsActive"
            :items="statusOptions"
            item-value="value" item-title="label"
            label="Trạng thái"
            clearable density="compact" hide-details
            @update:model-value="onFilterChange"
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
  ```

- [ ] **Step 3: Confirm `ProductFilterDto` has the filter fields**

  Verify `src/modules/product/models/dtos/product.dto.ts` has `Keyword?: string`, `CategoryId?: number | null`, `IsActive?: boolean | null` in the filter DTO. Add if missing.

- [ ] **Step 4: Type-check + commit**

  ```bash
  npm run type-check
  git add src/modules/product/views/ProductsView.vue
  git commit -m "feat(product): add search, category, and status filters to ProductsView"
  ```

---

## Task 13: CategoryForm — Active-Only Parent Filter + Self-Exclusion

**Why:** The parent dropdown shows inactive categories and, when editing, includes the category itself (enabling circular references).

**Files:**
- Modify: `src/modules/product/views/CategoriesView.vue`
- Modify: `src/modules/product/components/CategoryForm.vue`

- [ ] **Step 1: Filter `parentOptions` to active-only in CategoriesView**

  Replace:
  ```typescript
  const parentOptions = computed(() => items.value.map((c) => ({ id: c.id, name: c.name })))
  ```
  With:
  ```typescript
  const parentOptions = computed(() =>
    items.value
      .filter((c) => c.isActive)
      .map((c) => ({ id: c.id, name: c.name }))
  )
  ```

- [ ] **Step 2: Pass editId to CategoryForm for self-exclusion**

  `CategoryForm.vue` already receives `editId` prop. In the parent dropdown `v-select`, add a filter:

  ```vue
  <v-select
    v-model="form.parentId"
    :items="parentOptions.filter((p) => p.id !== editId)"
    ...
  />
  ```

  If `editId` is `null` (create mode), `!== null` is always true so no items are excluded. This correctly handles both create and edit.

- [ ] **Step 3: Type-check + commit**

  ```bash
  npm run type-check
  git add src/modules/product/views/CategoriesView.vue src/modules/product/components/CategoryForm.vue
  git commit -m "fix(product): CategoryForm parent filter - active-only + self-exclusion in edit mode"
  ```

---

## Task 14: TagForm — Live Combined Color Preview Pill

**Why:** The form shows separate color swatches but not the actual rendered tag pill (text on background). Spec requires a live preview of how the tag will look.

**Files:**
- Modify: `src/modules/product/components/TagForm.vue`

- [ ] **Step 1: Add live preview pill to TagForm**

  In `TagForm.vue` template, after the color fields, add a preview section:

  ```vue
  <!-- Live preview -->
  <div class="d-flex align-center ga-3 mt-1">
    <span class="text-body-2 text-medium-emphasis">Preview:</span>
    <v-chip
      :style="{
        backgroundColor: form.colorHex || '#E0E0E0',
        color: form.textColor || '#000000',
      }"
      size="small"
    >
      {{ form.name || 'Tên nhãn' }}
    </v-chip>
  </div>
  ```

  This renders in real-time as the user types/changes colors (reactive via `form.colorHex`, `form.textColor`, `form.name`).

- [ ] **Step 2: Type-check + commit**

  ```bash
  npm run type-check
  git add src/modules/product/components/TagForm.vue
  git commit -m "feat(product): add live combined tag preview pill to TagForm"
  ```

---

## Self-Review vs Spec

| Spec requirement | Task |
|---|---|
| AppConfirmDialog for all delete/unlink | Task 1 |
| AppCurrencyField with vi-VN locale | Task 2 |
| CustomPrice null not 0 | Task 3 |
| MaxSelect >= MinSelect | Task 4 |
| Tag/OptionGroup dropdowns filter assigned | Task 5 |
| Store override URLs correct + prices visible | Task 6 |
| TagDetailView + route | Task 7 |
| CategoryDetailView Edit/Delete/products/conditional-subcategories | Task 8 |
| OptionDetailView ProductOptionConfig widget | Task 9 |
| OptionGroupDetailView products panel | Task 10 |
| CategoriesView search input | Task 11 |
| ProductsView filter bar | Task 12 |
| CategoryForm active-only parent + self-exclusion | Task 13 |
| TagForm live preview pill | Task 14 |

**Not in this plan (follow-up required):**
- ProductForm as standalone Page at `/products/new` and `/products/:id/edit` with image upload section — large refactor requiring route changes, ProductImages API integration, and drag-drop UI
- ProductStatus 3-state enum (Đang bán / Ngừng bán / Nháp) — requires BE schema change + migration
- BE endpoints for `GET /options/{id}/product-configs` and `GET /product-option-groups/{groupId}/products` referenced in Tasks 9–10
