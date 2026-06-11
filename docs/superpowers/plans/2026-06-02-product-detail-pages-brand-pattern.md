# Product Detail Pages — Brand Pattern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor all 5 Product entity detail pages (Category, Tag, OptionGroup, Option, Product) to follow the Brand pattern: inline editing in an OverviewTab, audit history section, row-click navigates to detail page.

**Architecture:** Each entity gets a `{Entity}OverviewTab.vue` component (inline editable form + history card + toolbar with isDirty save/discard). `{Entity}DetailView.vue` gains reactive form state and passes it to the tab. List views change row-click from opening a dialog to navigating to the detail page.

**Tech Stack:** Vue 3 Composition API · TypeScript · Vuetify 3 · Pinia · vue-router

---

## Key patterns from Brand module

**BrandDetailView pattern:**
```typescript
const editForm = reactive<BrandFormModel>({ name: '', isActive: true, ... })
const snapshot = ref<BrandFormModel | null>(null)

function syncFormFromBrand() {
  const mapped = brandMapper.toFormModel(brand.data.value)
  Object.assign(editForm, mapped)
  snapshot.value = { ...editForm }
}

const isDirty = computed(() =>
  editForm.name !== snapshot.value?.name || editForm.isActive !== snapshot.value?.isActive ...
)

async function saveChanges() {
  submitting.value = true
  try {
    const ok = await updateBrand(brandId, toRequest(editForm))
    if (ok) { await brand.execute(); syncFormFromBrand() }
  } finally { submitting.value = false }
}
```

**BrandOverviewTab props:**
```typescript
defineProps<{
  brand: BrandViewModel
  form: BrandFormModel
  errors: Partial<Record<keyof BrandFormModel, string>>
  isDirty: boolean
  submitting: boolean
}>()
defineEmits<{
  'update:form': [field: keyof BrandFormModel, value: unknown]
  save: []
  discard: []
}>()
```

**Toolbar template (copy exactly):**
```vue
<div class="d-flex align-center justify-space-between ga-2 pa-3 px-4">
  <v-btn variant="text" rounded="lg" size="small" prepend-icon="mdi-arrow-left" @click="handleBack">
    Quay lại
  </v-btn>
  <div class="d-flex align-center ga-2">
    <v-slide-x-reverse-transition>
      <v-btn v-if="props.isDirty" variant="text" rounded="lg" size="small"
             :disabled="props.submitting" @click="handleDiscard">
        Hủy thay đổi
      </v-btn>
    </v-slide-x-reverse-transition>
    <v-btn color="primary" variant="flat" rounded="lg" size="small"
           prepend-icon="mdi-content-save-outline"
           :loading="props.submitting" :disabled="!props.isDirty"
           @click="emit('save')">
      Lưu thay đổi
    </v-btn>
  </div>
</div>
```

**History section template (copy exactly):**
```vue
<v-col cols="12">
  <v-card elevation="0" rounded="lg" class="info-card">
    <v-list-item class="bg-surface-variant py-3">
      <template #prepend>
        <v-sheet rounded="md" width="32" height="32" class="d-flex align-center justify-center mr-1">
          <v-icon icon="mdi-history" size="16" color="primary" />
        </v-sheet>
      </template>
      <v-list-item-title class="font-weight-semibold">Lịch sử</v-list-item-title>
    </v-list-item>
    <v-divider />
    <v-row no-gutters>
      <v-col cols="12" sm="6">
        <v-list lines="two" density="comfortable">
          <v-list-item min-height="60">
            <template #prepend><v-icon icon="mdi-clock-plus-outline" size="18" class="mr-1 opacity-40" /></template>
            <v-list-item-title class="mb-1">Tạo lúc</v-list-item-title>
            <v-list-item-subtitle class="font-weight-medium text-high-emphasis">
              {{ formatDate(props.entity.createdAt) }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-col>
      <v-divider vertical />
      <v-col cols="12" sm="6">
        <v-list lines="two" density="comfortable">
          <v-list-item min-height="60">
            <template #prepend><v-icon icon="mdi-account-plus-outline" size="18" class="mr-1 opacity-40" /></template>
            <v-list-item-title class="mb-1">Tạo bởi</v-list-item-title>
            <v-list-item-subtitle class="font-weight-medium text-high-emphasis">
              {{ props.entity.createdBy || '---' }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-col>
      <v-divider />
      <v-col cols="12" sm="6">
        <v-list lines="two" density="comfortable">
          <v-list-item min-height="60">
            <template #prepend><v-icon icon="mdi-clock-edit-outline" size="18" class="mr-1 opacity-40" /></template>
            <v-list-item-title class="mb-1">Cập nhật lúc</v-list-item-title>
            <v-list-item-subtitle class="font-weight-medium text-high-emphasis">
              {{ formatDate(props.entity.updatedAt) }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-col>
      <v-divider vertical />
      <v-col cols="12" sm="6">
        <v-list lines="two" density="comfortable">
          <v-list-item min-height="60">
            <template #prepend><v-icon icon="mdi-account-edit-outline" size="18" class="mr-1 opacity-40" /></template>
            <v-list-item-title class="mb-1">Cập nhật bởi</v-list-item-title>
            <v-list-item-subtitle class="font-weight-medium text-high-emphasis">
              {{ props.entity.updatedBy || '---' }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-col>
    </v-row>
  </v-card>
</v-col>
```

**Info card CSS (add to every OverviewTab `<style scoped>`):**
```css
.info-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  transition: border-color 0.2s ease;
}
.info-card--dirty {
  border-color: rgb(var(--v-theme-primary));
}
```

---

## Task 0: Shared utility — formatProductDate

**Files:**
- Create: `src/modules/product/utils/product.utils.ts`

- [ ] **Step 1: Create the utility**

```typescript
export function formatProductDate(value: string | null | undefined): string {
  if (!value) return '---'
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```
Expected: no new errors.

---

## Task 1: Category — OverviewTab + DetailView + ListView

**Files:**
- Create: `src/modules/product/components/CategoryOverviewTab.vue`
- Modify: `src/modules/product/views/CategoryDetailView.vue`
- Modify: `src/modules/product/views/CategoriesView.vue`
- Modify: `src/modules/product/components/CategoryList.vue`
- Modify: `src/modules/product/constants/category-list.constants.ts`

### Step 1: Add DETAIL to category-list.constants.ts

Read `src/modules/product/constants/category-list.constants.ts`. 

In `CATEGORY_ROW_ACTION`, add `DETAIL: 'detail'`:
```typescript
export const CATEGORY_ROW_ACTION = {
  DETAIL: 'detail',
  EDIT: 'edit',
  DELETE: 'delete',
} as const
```

In `CATEGORY_ROW_ACTIONS`, replace the EDIT action with DETAIL:
```typescript
export const CATEGORY_ROW_ACTIONS: RowAction<CategoryViewModel>[] = [
  { key: CATEGORY_ROW_ACTION.DETAIL, label: 'Xem chi tiết', icon: 'mdi-eye-outline', color: 'default' },
  { key: CATEGORY_ROW_ACTION.DELETE, label: 'Xóa', icon: 'mdi-delete-outline', color: 'error' },
]
```

### Step 2: Update CategoryList.vue — row-click → DETAIL

Read `src/modules/product/components/CategoryList.vue`. Change `@row-click`:
```vue
@row-click="(item) => emit(CATEGORY_LIST_EMIT.ROW_ACTION, CATEGORY_ROW_ACTION.DETAIL, item)"
```

### Step 3: Create `CategoryOverviewTab.vue`

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { AppDialog } from '@/components/ui'
import { APP_ROUTES } from '@/core/constants/_index'
import type { CategoryViewModel } from '../models/view-models/category.view-model'
import type { CategoryFormModel } from '../models/form-models/category.model'
import { formatProductDate } from '../utils/product.utils'

const props = defineProps<{
  category: CategoryViewModel
  form: CategoryFormModel
  errors: Partial<Record<keyof CategoryFormModel, string>>
  isDirty: boolean
  submitting: boolean
  parentOptions: { id: number; name: string }[]
}>()

const emit = defineEmits<{
  'update:form': [field: keyof CategoryFormModel, value: unknown]
  save: []
  discard: []
}>()

const router = useRouter()
type PendingAction = 'back' | 'discard'
const isConfirmOpen = ref(false)
const pendingAction = ref<PendingAction | null>(null)

function openConfirm(action: PendingAction) {
  pendingAction.value = action
  isConfirmOpen.value = true
}

function onConfirm() {
  isConfirmOpen.value = false
  if (pendingAction.value === 'back') {
    void router.push({ name: APP_ROUTES.PRODUCT.CATEGORIES.NAME })
  } else if (pendingAction.value === 'discard') {
    emit('discard')
  }
  pendingAction.value = null
}

function handleBack() {
  if (props.isDirty) openConfirm('back')
  else void router.push({ name: APP_ROUTES.PRODUCT.CATEGORIES.NAME })
}

function handleDiscard() { openConfirm('discard') }
</script>

<template>
  <div>
    <!-- Toolbar -->
    <div class="d-flex align-center justify-space-between ga-2 pa-3 px-4">
      <v-btn variant="text" rounded="lg" size="small" prepend-icon="mdi-arrow-left" @click="handleBack">
        Quay lại
      </v-btn>
      <div class="d-flex align-center ga-2">
        <v-slide-x-reverse-transition>
          <v-btn v-if="props.isDirty" variant="text" rounded="lg" size="small"
                 :disabled="props.submitting" @click="handleDiscard">
            Hủy thay đổi
          </v-btn>
        </v-slide-x-reverse-transition>
        <v-btn color="primary" variant="flat" rounded="lg" size="small"
               prepend-icon="mdi-content-save-outline"
               :loading="props.submitting" :disabled="!props.isDirty"
               @click="emit('save')">
          Lưu thay đổi
        </v-btn>
      </div>
    </div>

    <v-divider />

    <div class="pa-5">
      <v-row>
        <!-- Thông tin cơ bản -->
        <v-col cols="12" md="6">
          <v-card elevation="0" rounded="lg" :class="['info-card', props.isDirty ? 'info-card--dirty' : '']">
            <v-list-item class="bg-surface-variant py-3">
              <template #prepend>
                <v-sheet rounded="md" width="32" height="32" class="d-flex align-center justify-center mr-1">
                  <v-icon icon="mdi-card-account-details-outline" size="16" color="primary" />
                </v-sheet>
              </template>
              <v-list-item-title class="font-weight-semibold">Thông tin cơ bản</v-list-item-title>
            </v-list-item>
            <v-divider />
            <div class="pa-4 d-flex flex-column ga-4">
              <v-text-field
                :model-value="props.form.name"
                label="Tên danh mục *"
                variant="outlined" color="primary" density="comfortable"
                :error-messages="props.errors.name ? [props.errors.name] : []"
                prepend-inner-icon="mdi-shape-outline"
                @update:model-value="emit('update:form', 'name', $event)"
              />
              <v-text-field
                :model-value="props.form.slug"
                label="Slug"
                variant="outlined" color="primary" density="comfortable"
                prepend-inner-icon="mdi-link-variant"
                clearable
                @update:model-value="emit('update:form', 'slug', $event || '')"
              />
              <v-text-field
                :model-value="props.form.description"
                label="Mô tả"
                variant="outlined" color="primary" density="comfortable"
                prepend-inner-icon="mdi-text"
                clearable
                @update:model-value="emit('update:form', 'description', $event || '')"
              />
              <v-autocomplete
                :model-value="props.form.parentId"
                :items="props.parentOptions.filter((p) => p.id !== props.category.id)"
                item-value="id"
                item-title="name"
                label="Danh mục cha"
                variant="outlined" color="primary" density="comfortable"
                prepend-inner-icon="mdi-sitemap-outline"
                clearable
                @update:model-value="emit('update:form', 'parentId', $event ?? null)"
              />
            </div>
          </v-card>
        </v-col>

        <!-- Cài đặt -->
        <v-col cols="12" md="6">
          <v-card elevation="0" rounded="lg" :class="['info-card', props.isDirty ? 'info-card--dirty' : '']">
            <v-list-item class="bg-surface-variant py-3">
              <template #prepend>
                <v-sheet rounded="md" width="32" height="32" class="d-flex align-center justify-center mr-1">
                  <v-icon icon="mdi-cog-outline" size="16" color="primary" />
                </v-sheet>
              </template>
              <v-list-item-title class="font-weight-semibold">Cài đặt</v-list-item-title>
            </v-list-item>
            <v-divider />
            <div class="pa-4 d-flex flex-column ga-4">
              <v-text-field
                :model-value="props.form.displayOrder"
                label="Thứ tự hiển thị"
                type="number"
                variant="outlined" color="primary" density="comfortable"
                prepend-inner-icon="mdi-sort-numeric-ascending"
                @update:model-value="emit('update:form', 'displayOrder', Number($event))"
              />
              <div>
                <div class="text-caption text-medium-emphasis mb-2 ml-1">Trạng thái</div>
                <v-btn-toggle
                  :model-value="props.form.isActive ? 'active' : 'inactive'"
                  density="comfortable" rounded="lg" mandatory class="w-100"
                  @update:model-value="emit('update:form', 'isActive', $event === 'active')"
                >
                  <v-btn value="active" :color="props.form.isActive ? 'primary' : undefined"
                         variant="outlined" class="text-none flex-1-1" prepend-icon="mdi-check-circle-outline">
                    Hoạt động
                  </v-btn>
                  <v-btn value="inactive" :color="!props.form.isActive ? 'error' : undefined"
                         variant="outlined" class="text-none flex-1-1" prepend-icon="mdi-close-circle-outline">
                    Ẩn
                  </v-btn>
                </v-btn-toggle>
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Lịch sử -->
        <v-col cols="12">
          <v-card elevation="0" rounded="lg" class="info-card">
            <v-list-item class="bg-surface-variant py-3">
              <template #prepend>
                <v-sheet rounded="md" width="32" height="32" class="d-flex align-center justify-center mr-1">
                  <v-icon icon="mdi-history" size="16" color="primary" />
                </v-sheet>
              </template>
              <v-list-item-title class="font-weight-semibold">Lịch sử</v-list-item-title>
            </v-list-item>
            <v-divider />
            <v-row no-gutters>
              <v-col cols="12" sm="6">
                <v-list lines="two" density="comfortable">
                  <v-list-item min-height="60">
                    <template #prepend><v-icon icon="mdi-clock-plus-outline" size="18" class="mr-1 opacity-40" /></template>
                    <v-list-item-title class="mb-1">Tạo lúc</v-list-item-title>
                    <v-list-item-subtitle class="font-weight-medium text-high-emphasis">{{ formatProductDate(props.category.createdAt) }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
              <v-divider vertical />
              <v-col cols="12" sm="6">
                <v-list lines="two" density="comfortable">
                  <v-list-item min-height="60">
                    <template #prepend><v-icon icon="mdi-account-plus-outline" size="18" class="mr-1 opacity-40" /></template>
                    <v-list-item-title class="mb-1">Tạo bởi</v-list-item-title>
                    <v-list-item-subtitle class="font-weight-medium text-high-emphasis">{{ props.category.createdBy || '---' }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
              <v-divider />
              <v-col cols="12" sm="6">
                <v-list lines="two" density="comfortable">
                  <v-list-item min-height="60">
                    <template #prepend><v-icon icon="mdi-clock-edit-outline" size="18" class="mr-1 opacity-40" /></template>
                    <v-list-item-title class="mb-1">Cập nhật lúc</v-list-item-title>
                    <v-list-item-subtitle class="font-weight-medium text-high-emphasis">{{ formatProductDate(props.category.updatedAt) }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
              <v-divider vertical />
              <v-col cols="12" sm="6">
                <v-list lines="two" density="comfortable">
                  <v-list-item min-height="60">
                    <template #prepend><v-icon icon="mdi-account-edit-outline" size="18" class="mr-1 opacity-40" /></template>
                    <v-list-item-title class="mb-1">Cập nhật bởi</v-list-item-title>
                    <v-list-item-subtitle class="font-weight-medium text-high-emphasis">{{ props.category.updatedBy || '---' }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <AppDialog
      v-model="isConfirmOpen"
      title="Bỏ thay đổi?"
      size="sm"
      confirm-label="Bỏ thay đổi"
      cancel-label="Ở lại"
      @confirm="onConfirm"
      @cancel="isConfirmOpen = false"
    >
      Bạn có thay đổi chưa được lưu. Nếu tiếp tục, các thay đổi sẽ bị mất.
    </AppDialog>
  </div>
</template>

<style scoped>
.info-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  transition: border-color 0.2s ease;
}
.info-card--dirty { border-color: rgb(var(--v-theme-primary)); }
</style>
```

### Step 4: Rewrite CategoryDetailView.vue

Replace the entire file:

```vue
<template>
  <div class="d-flex flex-column ga-5">
    <template v-if="category.loading.value">
      <v-skeleton-loader type="heading" />
      <v-skeleton-loader type="card" height="120" />
      <v-skeleton-loader type="card" />
    </template>

    <template v-else-if="category.data.value">
      <!-- Hero header -->
      <v-card variant="tonal" color="primary" rounded="lg" flat>
        <v-card-text class="pa-5">
          <AppBreadcrumb :items="[
            { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
            { title: 'Danh mục', to: { name: APP_ROUTES.PRODUCT.CATEGORIES.NAME } },
            { title: category.data.value.name, disabled: true },
          ]" />
          <div class="d-flex align-center ga-3 mt-3">
            <v-sheet rounded="lg" width="52" height="52" class="d-flex align-center justify-center flex-shrink-0">
              <v-icon icon="mdi-shape-outline" size="28" color="primary" />
            </v-sheet>
            <div>
              <div class="text-h6 font-weight-bold text-high-emphasis">{{ category.data.value.name }}</div>
              <div class="text-body-2 text-medium-emphasis mt-1">{{ category.data.value.slug || '—' }}</div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- Tabs -->
      <v-card rounded="lg" elevation="1">
        <v-tabs v-model="activeTab" color="primary" class="px-2">
          <v-tab value="overview" class="text-none" rounded="lg">
            <v-icon start icon="mdi-information-outline" size="18" />
            Tổng quan
          </v-tab>
          <v-tab v-if="children.length > 0" value="children" class="text-none" rounded="lg">
            <v-icon start icon="mdi-sitemap-outline" size="18" />
            Danh mục con ({{ children.length }})
          </v-tab>
          <v-tab value="products" class="text-none" rounded="lg">
            <v-icon start icon="mdi-package-variant-closed" size="18" />
            Sản phẩm
          </v-tab>
        </v-tabs>
        <v-divider />
        <v-window v-model="activeTab">
          <v-window-item value="overview">
            <CategoryOverviewTab
              :category="category.data.value"
              :form="editForm"
              :errors="formErrors"
              :is-dirty="isDirty"
              :submitting="submitting"
              :parent-options="parentOptions"
              @update:form="onFormUpdate"
              @save="saveChanges"
              @discard="discardChanges"
            />
          </v-window-item>
          <v-window-item v-if="children.length > 0" value="children">
            <div class="pa-4">
              <v-progress-linear v-if="childrenLoading" indeterminate color="primary" class="mb-3" />
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
          <v-window-item value="products">
            <div class="pa-4">
              <v-progress-linear v-if="productsLoading" indeterminate color="primary" class="mb-2" />
              <v-list v-if="categoryProducts.length" density="compact">
                <v-list-item
                  v-for="p in categoryProducts"
                  :key="p.id"
                  :title="p.name"
                  :subtitle="`${p.basePrice.toLocaleString('vi-VN')} ₫`"
                  :to="{ name: APP_ROUTES.PRODUCT.PRODUCT_DETAIL.NAME, params: { id: p.id } }"
                />
              </v-list>
              <v-alert v-else-if="!productsLoading" type="info" variant="tonal" density="compact">
                Chưa có sản phẩm nào.
              </v-alert>
            </div>
          </v-window-item>
        </v-window>
      </v-card>
    </template>

    <AppEmptyState v-else-if="!category.loading.value" icon="mdi-shape-remove"
      title="Không tìm thấy danh mục" description="Danh mục này không tồn tại hoặc đã bị xóa.">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-arrow-left"
               :to="{ name: APP_ROUTES.PRODUCT.CATEGORIES.NAME }">
          Quay lại danh sách
        </v-btn>
      </template>
    </AppEmptyState>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppBreadcrumb, AppEmptyState } from '@/components/ui'
import { useAsyncState } from '@/composables/useAsyncState'
import { APP_ROUTES } from '@/core/constants/_index'
import { categoryService } from '../services/category.service'
import { productService } from '../services/product.service'
import { useCategory } from '../composables/useCategory'
import { createEmptyCategoryForm } from '../models/form-models/category.model'
import { CATEGORY_ROW_ACTION } from '../constants/category-list.constants'
import CategoryList from '../components/CategoryList.vue'
import CategoryOverviewTab from '../components/CategoryOverviewTab.vue'
import type { CategoryViewModel } from '../models/view-models/category.view-model'
import type { CategoryFormModel } from '../models/form-models/category.model'
import type { UpdateCategoryRequest } from '../models/dtos/category.dto'

const route = useRoute()
const router = useRouter()
const categoryId = Number(route.params['id'])
const activeTab = ref('overview')

const category = useAsyncState(() => categoryService.getByIdAsync(categoryId))
const { updateCategory } = useCategory()

// ── Inline form ───────────────────────────────────────────────
const editForm = reactive<CategoryFormModel>(createEmptyCategoryForm())
const snapshot = ref<CategoryFormModel | null>(null)

function syncFormFromCategory() {
  if (!category.data.value) return
  editForm.name = category.data.value.name
  editForm.slug = category.data.value.slug ?? ''
  editForm.description = category.data.value.description ?? ''
  editForm.imageUrl = category.data.value.imageUrl ?? ''
  editForm.parentId = category.data.value.parentId
  editForm.displayOrder = category.data.value.displayOrder
  editForm.isActive = category.data.value.isActive
  snapshot.value = { ...editForm }
}

const isDirty = computed(() => {
  if (!snapshot.value) return false
  return (
    editForm.name !== snapshot.value.name ||
    editForm.slug !== snapshot.value.slug ||
    editForm.description !== snapshot.value.description ||
    editForm.parentId !== snapshot.value.parentId ||
    editForm.displayOrder !== snapshot.value.displayOrder ||
    editForm.isActive !== snapshot.value.isActive
  )
})

const formErrors = reactive<Partial<Record<keyof CategoryFormModel, string>>>({})

function onFormUpdate(field: keyof CategoryFormModel, value: unknown) {
  ;(editForm as Record<string, unknown>)[field] = value
  if (field === 'name' && typeof value === 'string' && value.trim()) delete formErrors.name
}

const submitting = ref(false)

function discardChanges() {
  syncFormFromCategory()
  formErrors.name = undefined
}

async function saveChanges() {
  formErrors.name = editForm.name?.trim() ? undefined : 'Tên danh mục là bắt buộc'
  if (formErrors.name) return
  submitting.value = true
  try {
    const payload: UpdateCategoryRequest = {
      Name: editForm.name.trim(),
      Slug: editForm.slug || null,
      Description: editForm.description || null,
      ImageUrl: editForm.imageUrl || null,
      ParentId: editForm.parentId,
      DisplayOrder: editForm.displayOrder,
      IsActive: editForm.isActive,
    }
    const ok = await updateCategory(categoryId, payload)
    if (ok) { await category.execute(); syncFormFromCategory() }
  } finally {
    submitting.value = false
  }
}

// ── Parent options (active-only, excluding self) ──────────────
const parentOptions = ref<{ id: number; name: string }[]>([])

async function loadParentOptions() {
  const result = await categoryService.getPagedAsync({ PageNumber: 1, PageSize: 200, IsActive: true })
  parentOptions.value = result.items
    .filter((c) => c.id !== categoryId)
    .map((c) => ({ id: c.id, name: c.name }))
}

// ── Sub-categories ─────────────────────────────────────────────
const children = ref<CategoryViewModel[]>([])
const childrenLoading = ref(false)

async function loadChildren() {
  childrenLoading.value = true
  try {
    const result = await categoryService.getPagedAsync({ PageNumber: 1, PageSize: 100, ParentId: categoryId })
    children.value = result.items
  } finally {
    childrenLoading.value = false
  }
}

function onChildAction(key: string, item: CategoryViewModel) {
  if (key === CATEGORY_ROW_ACTION.DETAIL) {
    router.push({ name: APP_ROUTES.PRODUCT.CATEGORY_DETAIL.NAME, params: { id: item.id } })
  }
}

// ── Products ───────────────────────────────────────────────────
const categoryProducts = ref<{ id: number; name: string; basePrice: number }[]>([])
const productsLoading = ref(false)

async function loadCategoryProducts() {
  productsLoading.value = true
  try {
    const result = await productService.getPagedAsync({ PageNumber: 1, PageSize: 10, CategoryId: categoryId })
    categoryProducts.value = result.items.map((p) => ({ id: p.id, name: p.name, basePrice: p.basePrice }))
  } finally {
    productsLoading.value = false
  }
}

onMounted(async () => {
  await category.execute()
  syncFormFromCategory()
  await Promise.all([loadChildren(), loadCategoryProducts(), loadParentOptions()])
})
</script>
```

### Step 5: Update CategoriesView.vue — remove edit dialog, row → detail

Read `src/modules/product/views/CategoriesView.vue`. Make these changes:

1. In `onRowAction`, replace the `CATEGORY_ROW_ACTION.EDIT` branch with `CATEGORY_ROW_ACTION.DETAIL`:
```typescript
function onRowAction(key: string, item: CategoryViewModel) {
  if (key === CATEGORY_ROW_ACTION.DETAIL) {
    router.push({ name: APP_ROUTES.PRODUCT.CATEGORY_DETAIL.NAME, params: { id: item.id } })
  } else if (key === CATEGORY_ROW_ACTION.DELETE) {
    confirmItem.value = item
    confirmOpen.value = true
  }
}
```

2. Remove `openEditDialog`, `editId`, `editOpen`, `dialogTitle` computed, and the edit branch in `onFormSubmit` (keep only the create path). The dialog now only serves for creating:
```typescript
function openCreateDialog() {
  formModel.value = createEmptyCategoryForm()
  dialogOpen.value = true
}

async function onFormSubmit(form: typeof formModel.value) {
  const payload: CreateCategoryRequest = {
    Name: form.name,
    Slug: form.slug || null,
    Description: form.description || null,
    ImageUrl: form.imageUrl || null,
    ParentId: form.parentId,
    DisplayOrder: form.displayOrder,
    IsActive: form.isActive,
  }
  const result = await createCategory(payload)
  if (result) { dialogOpen.value = false; fetchData() }
}
```

3. Remove `editId` ref. Change dialog title to static `"Thêm danh mục"`.

4. Add `useRouter` import and `const router = useRouter()`.

### Step 6: Type-check

```bash
npm run type-check
```
Expected: no new errors from the files you changed.

---

## Task 2: Tag — OverviewTab + DetailView + ListView

**Files:**
- Create: `src/modules/product/components/TagOverviewTab.vue`
- Modify: `src/modules/product/views/TagDetailView.vue`
- Modify: `src/modules/product/views/TagsView.vue`
- Modify: `src/modules/product/constants/tag-list.constants.ts`

### Step 1: Update tag-list.constants.ts — remove EDIT from ROW_ACTIONS

Read `src/modules/product/constants/tag-list.constants.ts`. `TAG_ROW_ACTION` already has `DETAIL`. Update `TAG_ROW_ACTIONS` to remove the EDIT action:

```typescript
export const TAG_ROW_ACTIONS: RowAction<TagViewModel>[] = [
  { key: TAG_ROW_ACTION.DETAIL, label: 'Xem chi tiết', icon: 'mdi-eye-outline', color: 'default' },
  { key: TAG_ROW_ACTION.DELETE, label: 'Xóa', icon: 'mdi-delete-outline', color: 'error' },
]
```

### Step 2: Create `TagOverviewTab.vue`

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { AppDialog } from '@/components/ui'
import { APP_ROUTES } from '@/core/constants/_index'
import type { TagViewModel } from '../models/view-models/tag.view-model'
import type { TagFormModel } from '../models/form-models/tag.model'
import { formatProductDate } from '../utils/product.utils'

const props = defineProps<{
  tag: TagViewModel
  form: TagFormModel
  errors: Partial<Record<keyof TagFormModel, string>>
  isDirty: boolean
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:form': [field: keyof TagFormModel, value: unknown]
  save: []
  discard: []
}>()

const router = useRouter()
type PendingAction = 'back' | 'discard'
const isConfirmOpen = ref(false)
const pendingAction = ref<PendingAction | null>(null)

function openConfirm(action: PendingAction) { pendingAction.value = action; isConfirmOpen.value = true }

function onConfirm() {
  isConfirmOpen.value = false
  if (pendingAction.value === 'back') void router.push({ name: APP_ROUTES.PRODUCT.TAGS.NAME })
  else if (pendingAction.value === 'discard') emit('discard')
  pendingAction.value = null
}

function handleBack() {
  if (props.isDirty) openConfirm('back')
  else void router.push({ name: APP_ROUTES.PRODUCT.TAGS.NAME })
}

function handleDiscard() { openConfirm('discard') }
</script>

<template>
  <div>
    <!-- Toolbar -->
    <div class="d-flex align-center justify-space-between ga-2 pa-3 px-4">
      <v-btn variant="text" rounded="lg" size="small" prepend-icon="mdi-arrow-left" @click="handleBack">Quay lại</v-btn>
      <div class="d-flex align-center ga-2">
        <v-slide-x-reverse-transition>
          <v-btn v-if="props.isDirty" variant="text" rounded="lg" size="small"
                 :disabled="props.submitting" @click="handleDiscard">Hủy thay đổi</v-btn>
        </v-slide-x-reverse-transition>
        <v-btn color="primary" variant="flat" rounded="lg" size="small"
               prepend-icon="mdi-content-save-outline"
               :loading="props.submitting" :disabled="!props.isDirty"
               @click="emit('save')">Lưu thay đổi</v-btn>
      </div>
    </div>
    <v-divider />

    <div class="pa-5">
      <v-row>
        <!-- Thông tin -->
        <v-col cols="12" md="6">
          <v-card elevation="0" rounded="lg" :class="['info-card', props.isDirty ? 'info-card--dirty' : '']">
            <v-list-item class="bg-surface-variant py-3">
              <template #prepend>
                <v-sheet rounded="md" width="32" height="32" class="d-flex align-center justify-center mr-1">
                  <v-icon icon="mdi-card-account-details-outline" size="16" color="primary" />
                </v-sheet>
              </template>
              <v-list-item-title class="font-weight-semibold">Thông tin nhãn</v-list-item-title>
            </v-list-item>
            <v-divider />
            <div class="pa-4 d-flex flex-column ga-4">
              <v-text-field :model-value="props.form.name" label="Tên nhãn *"
                variant="outlined" color="primary" density="comfortable"
                :error-messages="props.errors.name ? [props.errors.name] : []"
                prepend-inner-icon="mdi-tag-outline"
                @update:model-value="emit('update:form', 'name', $event)" />

              <div class="d-flex ga-2 align-start">
                <v-text-field :model-value="props.form.colorHex" label="Màu nền (#RRGGBB)"
                  variant="outlined" color="primary" density="comfortable"
                  prepend-inner-icon="mdi-palette-outline" clearable
                  @update:model-value="emit('update:form', 'colorHex', $event || '')" />
                <v-sheet v-if="props.form.colorHex" :style="{ backgroundColor: props.form.colorHex }"
                  width="44" height="44" rounded="md" class="flex-shrink-0 mt-1" />
              </div>

              <div class="d-flex ga-2 align-start">
                <v-text-field :model-value="props.form.textColor" label="Màu chữ (#RRGGBB)"
                  variant="outlined" color="primary" density="comfortable"
                  prepend-inner-icon="mdi-format-color-text" clearable
                  @update:model-value="emit('update:form', 'textColor', $event || '')" />
                <v-sheet v-if="props.form.textColor" :style="{ backgroundColor: props.form.textColor }"
                  width="44" height="44" rounded="md" class="flex-shrink-0 mt-1" />
              </div>

              <!-- Live preview -->
              <div class="d-flex align-center ga-3">
                <span class="text-body-2 text-medium-emphasis">Preview:</span>
                <v-chip :style="{ backgroundColor: props.form.colorHex || '#E0E0E0', color: props.form.textColor || '#000000' }" size="small">
                  {{ props.form.name || 'Tên nhãn' }}
                </v-chip>
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Cài đặt -->
        <v-col cols="12" md="6">
          <v-card elevation="0" rounded="lg" :class="['info-card', props.isDirty ? 'info-card--dirty' : '']">
            <v-list-item class="bg-surface-variant py-3">
              <template #prepend>
                <v-sheet rounded="md" width="32" height="32" class="d-flex align-center justify-center mr-1">
                  <v-icon icon="mdi-cog-outline" size="16" color="primary" />
                </v-sheet>
              </template>
              <v-list-item-title class="font-weight-semibold">Cài đặt</v-list-item-title>
            </v-list-item>
            <v-divider />
            <div class="pa-4 d-flex flex-column ga-4">
              <v-text-field :model-value="props.form.displayOrder" label="Thứ tự hiển thị"
                type="number" variant="outlined" color="primary" density="comfortable"
                prepend-inner-icon="mdi-sort-numeric-ascending"
                @update:model-value="emit('update:form', 'displayOrder', Number($event))" />
              <div>
                <div class="text-caption text-medium-emphasis mb-2 ml-1">Trạng thái</div>
                <v-btn-toggle :model-value="props.form.isActive ? 'active' : 'inactive'"
                  density="comfortable" rounded="lg" mandatory class="w-100"
                  @update:model-value="emit('update:form', 'isActive', $event === 'active')">
                  <v-btn value="active" :color="props.form.isActive ? 'primary' : undefined"
                    variant="outlined" class="text-none flex-1-1" prepend-icon="mdi-check-circle-outline">Hoạt động</v-btn>
                  <v-btn value="inactive" :color="!props.form.isActive ? 'error' : undefined"
                    variant="outlined" class="text-none flex-1-1" prepend-icon="mdi-close-circle-outline">Ẩn</v-btn>
                </v-btn-toggle>
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Lịch sử -->
        <v-col cols="12">
          <v-card elevation="0" rounded="lg" class="info-card">
            <v-list-item class="bg-surface-variant py-3">
              <template #prepend>
                <v-sheet rounded="md" width="32" height="32" class="d-flex align-center justify-center mr-1">
                  <v-icon icon="mdi-history" size="16" color="primary" />
                </v-sheet>
              </template>
              <v-list-item-title class="font-weight-semibold">Lịch sử</v-list-item-title>
            </v-list-item>
            <v-divider />
            <v-row no-gutters>
              <v-col cols="12" sm="6">
                <v-list lines="two" density="comfortable">
                  <v-list-item min-height="60">
                    <template #prepend><v-icon icon="mdi-clock-plus-outline" size="18" class="mr-1 opacity-40" /></template>
                    <v-list-item-title class="mb-1">Tạo lúc</v-list-item-title>
                    <v-list-item-subtitle class="font-weight-medium text-high-emphasis">{{ formatProductDate(props.tag.createdAt) }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
              <v-divider vertical />
              <v-col cols="12" sm="6">
                <v-list lines="two" density="comfortable">
                  <v-list-item min-height="60">
                    <template #prepend><v-icon icon="mdi-account-plus-outline" size="18" class="mr-1 opacity-40" /></template>
                    <v-list-item-title class="mb-1">Tạo bởi</v-list-item-title>
                    <v-list-item-subtitle class="font-weight-medium text-high-emphasis">{{ props.tag.createdBy || '---' }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
              <v-divider />
              <v-col cols="12" sm="6">
                <v-list lines="two" density="comfortable">
                  <v-list-item min-height="60">
                    <template #prepend><v-icon icon="mdi-clock-edit-outline" size="18" class="mr-1 opacity-40" /></template>
                    <v-list-item-title class="mb-1">Cập nhật lúc</v-list-item-title>
                    <v-list-item-subtitle class="font-weight-medium text-high-emphasis">{{ formatProductDate(props.tag.updatedAt) }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
              <v-divider vertical />
              <v-col cols="12" sm="6">
                <v-list lines="two" density="comfortable">
                  <v-list-item min-height="60">
                    <template #prepend><v-icon icon="mdi-account-edit-outline" size="18" class="mr-1 opacity-40" /></template>
                    <v-list-item-title class="mb-1">Cập nhật bởi</v-list-item-title>
                    <v-list-item-subtitle class="font-weight-medium text-high-emphasis">{{ props.tag.updatedBy || '---' }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <AppDialog v-model="isConfirmOpen" title="Bỏ thay đổi?" size="sm"
      confirm-label="Bỏ thay đổi" cancel-label="Ở lại"
      @confirm="onConfirm" @cancel="isConfirmOpen = false">
      Bạn có thay đổi chưa được lưu. Nếu tiếp tục, các thay đổi sẽ bị mất.
    </AppDialog>
  </div>
</template>

<style scoped>
.info-card { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); transition: border-color 0.2s ease; }
.info-card--dirty { border-color: rgb(var(--v-theme-primary)); }
</style>
```

### Step 3: Rewrite TagDetailView.vue

Replace the entire file with the Brand pattern — load tag, sync form, tabs: overview + (products placeholder):

```vue
<template>
  <div class="d-flex flex-column ga-5">
    <template v-if="tag.loading.value">
      <v-skeleton-loader type="heading" />
      <v-skeleton-loader type="card" height="120" />
      <v-skeleton-loader type="card" />
    </template>

    <template v-else-if="tag.data.value">
      <v-card variant="tonal" color="primary" rounded="lg" flat>
        <v-card-text class="pa-5">
          <AppBreadcrumb :items="[
            { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
            { title: 'Nhãn', to: { name: APP_ROUTES.PRODUCT.TAGS.NAME } },
            { title: tag.data.value.name, disabled: true },
          ]" />
          <div class="d-flex align-center ga-3 mt-3">
            <v-sheet rounded="lg" width="52" height="52" class="d-flex align-center justify-center flex-shrink-0">
              <v-icon icon="mdi-tag-outline" size="28" color="primary" />
            </v-sheet>
            <div class="d-flex align-center ga-2">
              <div class="text-h6 font-weight-bold text-high-emphasis">{{ tag.data.value.name }}</div>
              <v-chip :style="{ backgroundColor: tag.data.value.colorHex ?? '#E0E0E0', color: tag.data.value.textColor ?? '#000' }" size="small">
                {{ tag.data.value.name }}
              </v-chip>
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
        </v-tabs>
        <v-divider />
        <v-window v-model="activeTab">
          <v-window-item value="overview">
            <TagOverviewTab
              :tag="tag.data.value"
              :form="editForm"
              :errors="formErrors"
              :is-dirty="isDirty"
              :submitting="submitting"
              @update:form="onFormUpdate"
              @save="saveChanges"
              @discard="discardChanges"
            />
          </v-window-item>
        </v-window>
      </v-card>
    </template>

    <AppEmptyState v-else-if="!tag.loading.value" icon="mdi-tag-remove"
      title="Không tìm thấy nhãn" description="Nhãn này không tồn tại hoặc đã bị xóa.">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-arrow-left" :to="{ name: APP_ROUTES.PRODUCT.TAGS.NAME }">
          Quay lại danh sách
        </v-btn>
      </template>
    </AppEmptyState>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { AppBreadcrumb, AppEmptyState } from '@/components/ui'
import { useAsyncState } from '@/composables/useAsyncState'
import { APP_ROUTES } from '@/core/constants/_index'
import { tagService } from '../services/tag.service'
import { useTag } from '../composables/useTag'
import { createEmptyTagForm } from '../models/form-models/tag.model'
import TagOverviewTab from '../components/TagOverviewTab.vue'
import type { TagFormModel } from '../models/form-models/tag.model'
import type { UpdateTagRequest } from '../models/dtos/tag.dto'

const route = useRoute()
const tagId = Number(route.params['id'])
const activeTab = ref('overview')

const tag = useAsyncState(() => tagService.getByIdAsync(tagId))
const { updateTag } = useTag()

const editForm = reactive<TagFormModel>(createEmptyTagForm())
const snapshot = ref<TagFormModel | null>(null)

function syncFormFromTag() {
  if (!tag.data.value) return
  editForm.name = tag.data.value.name
  editForm.colorHex = tag.data.value.colorHex ?? ''
  editForm.textColor = tag.data.value.textColor ?? ''
  editForm.iconUrl = tag.data.value.iconUrl ?? ''
  editForm.displayOrder = tag.data.value.displayOrder
  editForm.isActive = tag.data.value.isActive
  snapshot.value = { ...editForm }
}

const isDirty = computed(() => {
  if (!snapshot.value) return false
  return (
    editForm.name !== snapshot.value.name ||
    editForm.colorHex !== snapshot.value.colorHex ||
    editForm.textColor !== snapshot.value.textColor ||
    editForm.displayOrder !== snapshot.value.displayOrder ||
    editForm.isActive !== snapshot.value.isActive
  )
})

const formErrors = reactive<Partial<Record<keyof TagFormModel, string>>>({})

function onFormUpdate(field: keyof TagFormModel, value: unknown) {
  ;(editForm as Record<string, unknown>)[field] = value
  if (field === 'name' && typeof value === 'string' && value.trim()) delete formErrors.name
}

const submitting = ref(false)

function discardChanges() { syncFormFromTag(); formErrors.name = undefined }

async function saveChanges() {
  formErrors.name = editForm.name?.trim() ? undefined : 'Tên nhãn là bắt buộc'
  if (formErrors.name) return
  submitting.value = true
  try {
    const payload: UpdateTagRequest = {
      Name: editForm.name.trim(),
      ColorHex: editForm.colorHex || null,
      TextColor: editForm.textColor || null,
      IconUrl: editForm.iconUrl || null,
      DisplayOrder: editForm.displayOrder,
      IsActive: editForm.isActive,
    }
    const ok = await updateTag(tagId, payload)
    if (ok) { await tag.execute(); syncFormFromTag() }
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await tag.execute()
  syncFormFromTag()
})
</script>
```

### Step 4: Update TagsView.vue — row → detail, remove edit dialog

Read `src/modules/product/views/TagsView.vue`. In `onRowAction`:
```typescript
async function onRowAction(key: string, item: TagViewModel) {
  if (key === TAG_ROW_ACTION.DETAIL) {
    router.push({ name: APP_ROUTES.PRODUCT.TAG_DETAIL.NAME, params: { id: item.id } })
  } else if (key === TAG_ROW_ACTION.DELETE) {
    confirmItem.value = item
    confirmOpen.value = true
  }
}
```

Remove: `openEditDialog`, edit branch in `onRowAction`, the edit portion of `onFormSubmit`. The `AppDialog` + `TagForm` now only handles creation. Remove `editId` ref. Change dialog title to static `"Thêm nhãn"`. Add `useRouter` if not present.

### Step 5: Type-check

```bash
npm run type-check
```

---

## Task 3: OptionGroup — OverviewTab + DetailView + ListView

**Files:**
- Create: `src/modules/product/components/OptionGroupOverviewTab.vue`
- Modify: `src/modules/product/views/OptionGroupDetailView.vue`
- Modify: `src/modules/product/views/OptionGroupsView.vue`
- Modify: `src/modules/product/constants/option-group-list.constants.ts`

### Step 1: Update option-group-list.constants.ts — remove EDIT from ROW_ACTIONS

Read the file. `OPTION_GROUP_ROW_ACTION` already has DETAIL. Update `OPTION_GROUP_ROW_ACTIONS`:
```typescript
export const OPTION_GROUP_ROW_ACTIONS: RowAction<OptionGroupViewModel>[] = [
  { key: OPTION_GROUP_ROW_ACTION.DETAIL, label: 'Xem chi tiết', icon: 'mdi-eye-outline', color: 'default' },
  { key: OPTION_GROUP_ROW_ACTION.DELETE, label: 'Xóa', icon: 'mdi-delete-outline', color: 'error' },
]
```

Also check `OptionGroupList.vue` — change `@row-click` to emit DETAIL (same pattern as CategoryList).

### Step 2: Create `OptionGroupOverviewTab.vue`

Same structure as `CategoryOverviewTab.vue`. Props: `group: OptionGroupViewModel`, `form: OptionGroupFormModel`, `errors`, `isDirty`, `submitting`. Emits: `update:form`, `save`, `discard`.

Back navigation goes to `APP_ROUTES.PRODUCT.OPTION_GROUPS.NAME`.

Form fields in "Thông tin cơ bản" card:
```vue
<v-text-field :model-value="props.form.name" label="Tên nhóm *"
  variant="outlined" color="primary" density="comfortable"
  :error-messages="props.errors.name ? [props.errors.name] : []"
  prepend-inner-icon="mdi-tune-variant"
  @update:model-value="emit('update:form', 'name', $event)" />

<v-textarea :model-value="props.form.description" label="Mô tả"
  variant="outlined" color="primary" density="comfortable"
  prepend-inner-icon="mdi-text" rows="3" clearable
  @update:model-value="emit('update:form', 'description', $event || '')" />

<div>
  <div class="text-caption text-medium-emphasis mb-2 ml-1">Kiểu UI</div>
  <v-btn-toggle :model-value="props.form.uiType"
    density="comfortable" rounded="lg" mandatory class="w-100"
    @update:model-value="emit('update:form', 'uiType', $event)">
    <v-btn value="SingleSelect" variant="outlined" class="text-none flex-1-1"
      :color="props.form.uiType === 'SingleSelect' ? 'primary' : undefined"
      prepend-icon="mdi-radiobox-marked">Chọn một</v-btn>
    <v-btn value="MultiSelect" variant="outlined" class="text-none flex-1-1"
      :color="props.form.uiType === 'MultiSelect' ? 'primary' : undefined"
      prepend-icon="mdi-checkbox-marked-outline">Chọn nhiều</v-btn>
  </v-btn-toggle>
</div>
```

"Cài đặt" card: displayOrder + isActive toggle (same as Category).
"Lịch sử" card: same template, prop is `props.group`.

### Step 3: Rewrite OptionGroupDetailView.vue

Keep the tabs structure (overview + options). Convert info tab to use `OptionGroupOverviewTab`. Add inline form state with these isDirty fields: `name`, `uiType`, `description`, `displayOrder`, `isActive`. Keep the Options tab with `OptionList` + create/edit option dialogs as they are. Keep the productUsages card below.

Key `syncFormFromGroup`:
```typescript
function syncFormFromGroup() {
  if (!group.data.value) return
  editForm.name = group.data.value.name
  editForm.uiType = group.data.value.uiType
  editForm.description = group.data.value.description ?? ''
  editForm.displayOrder = group.data.value.displayOrder
  editForm.isActive = group.data.value.isActive
  snapshot.value = { ...editForm }
}
```

`saveChanges` calls `updateOptionGroup(groupId, { Name, UiType, Description, DisplayOrder, IsActive })` then `await group.execute(); syncFormFromGroup()`.

### Step 4: Update OptionGroupsView.vue — row → detail, remove edit dialog

Same pattern. In `onRowAction`, DETAIL navigates to `APP_ROUTES.PRODUCT.OPTION_GROUP_DETAIL.NAME`. Remove edit dialog state. Keep create dialog + delete action.

### Step 5: Type-check

```bash
npm run type-check
```

---

## Task 4: Option — OverviewTab + DetailView + ListView

**Files:**
- Create: `src/modules/product/components/OptionOverviewTab.vue`
- Modify: `src/modules/product/views/OptionDetailView.vue`
- Modify: `src/modules/product/views/OptionsView.vue`
- Modify: `src/modules/product/constants/option-list.constants.ts`

### Step 1: Add DETAIL to option-list.constants.ts

Read the file. Add `DETAIL: 'detail'` to `OPTION_ROW_ACTION`. Update `OPTION_ROW_ACTIONS`:
```typescript
export const OPTION_ROW_ACTION = {
  DETAIL: 'detail',
  EDIT: 'edit',
  DELETE: 'delete',
} as const

export const OPTION_ROW_ACTIONS: RowAction<OptionViewModel>[] = [
  { key: OPTION_ROW_ACTION.DETAIL, label: 'Xem chi tiết', icon: 'mdi-eye-outline', color: 'default' },
  { key: OPTION_ROW_ACTION.DELETE, label: 'Xóa', icon: 'mdi-delete-outline', color: 'error' },
]
```

Also update `OptionList.vue` — change `@row-click` to emit `OPTION_ROW_ACTION.DETAIL`.

### Step 2: Create `OptionOverviewTab.vue`

Props: `option: OptionViewModel`, `form: OptionFormModel`, `errors`, `isDirty`, `submitting`, `groupOptions: { id: number; name: string }[]`.

Back navigation to `APP_ROUTES.PRODUCT.OPTIONS.NAME`.

Form fields in "Thông tin cơ bản" card:
```vue
<v-text-field :model-value="props.form.name" label="Tên option *"
  variant="outlined" color="primary" density="comfortable"
  :error-messages="props.errors.name ? [props.errors.name] : []"
  prepend-inner-icon="mdi-checkbox-marked-outline"
  @update:model-value="emit('update:form', 'name', $event)" />

<v-autocomplete :model-value="props.form.groupId"
  :items="props.groupOptions" item-value="id" item-title="name"
  label="Nhóm option *" variant="outlined" color="primary" density="comfortable"
  prepend-inner-icon="mdi-tune-variant"
  @update:model-value="emit('update:form', 'groupId', $event ?? null)" />

<AppCurrencyField :model-value="props.form.defaultPrice" label="Giá mặc định"
  @update:model-value="emit('update:form', 'defaultPrice', $event ?? 0)" />

<v-text-field :model-value="props.form.description" label="Mô tả"
  variant="outlined" color="primary" density="comfortable"
  prepend-inner-icon="mdi-text" clearable
  @update:model-value="emit('update:form', 'description', $event || '')" />
```

Add import: `import { AppCurrencyField } from '@/components/ui'`

"Cài đặt" card: displayOrder + isActive toggle.
"Lịch sử" card with `props.option`.

### Step 3: Rewrite OptionDetailView.vue

Keep tabs: overview + stores. Convert info tab to use `OptionOverviewTab`. Keep `OptionStoreOverridesTab` in stores tab. Keep the productConfigs card above the tabs card (it's already there as a standalone card).

Add inline form state. `syncFormFromOption`:
```typescript
function syncFormFromOption() {
  if (!option.data.value) return
  editForm.groupId = option.data.value.groupId
  editForm.name = option.data.value.name
  editForm.defaultPrice = option.data.value.defaultPrice
  editForm.description = option.data.value.description ?? ''
  editForm.imageUrl = option.data.value.imageUrl ?? ''
  editForm.displayOrder = option.data.value.displayOrder
  editForm.isActive = option.data.value.isActive
  snapshot.value = { ...editForm }
}
```

isDirty compares: `name`, `groupId`, `defaultPrice`, `description`, `displayOrder`, `isActive`.

Load groupOptions in onMounted from `optionGroupService.getPagedAsync({ PageNumber: 1, PageSize: 200 })`.

`saveChanges` calls `updateOption(optionId, { Name, DefaultPrice, Description, ImageUrl, DisplayOrder, IsActive })`.

### Step 4: Update OptionsView.vue — row → detail, remove edit dialog

In `onRowAction`, `OPTION_ROW_ACTION.DETAIL` → navigate to `APP_ROUTES.PRODUCT.OPTION_DETAIL.NAME`. Remove edit dialog state. Keep create dialog + delete action.

### Step 5: Type-check

```bash
npm run type-check
```

---

## Task 5: Product — OverviewTab + DetailView + ListView

**Files:**
- Create: `src/modules/product/components/ProductOverviewTab.vue`
- Modify: `src/modules/product/views/ProductDetailView.vue`
- Modify: `src/modules/product/views/ProductsView.vue`
- Modify: `src/modules/product/constants/product-list.constants.ts`

### Step 1: Update product-list.constants.ts — remove EDIT from ROW_ACTIONS

Read the file. `PRODUCT_ROW_ACTION` already has DETAIL. Update `PRODUCT_ROW_ACTIONS`:
```typescript
export const PRODUCT_ROW_ACTIONS: RowAction<ProductViewModel>[] = [
  { key: PRODUCT_ROW_ACTION.DETAIL, label: 'Xem chi tiết', icon: 'mdi-eye-outline', color: 'default' },
  { key: PRODUCT_ROW_ACTION.DELETE, label: 'Xóa', icon: 'mdi-delete-outline', color: 'error' },
]
```

Also update `ProductList.vue` — change `@row-click` to emit `PRODUCT_ROW_ACTION.DETAIL`.

### Step 2: Create `ProductOverviewTab.vue`

Props: `product: ProductViewModel`, `form: ProductFormModel`, `errors`, `isDirty`, `submitting`, `categoryOptions: { id: number; name: string }[]`.

Back navigation to `APP_ROUTES.PRODUCT.PRODUCTS.NAME`.

Form layout — two cards side by side, plus history:

**Card "Thông tin cơ bản":**
```vue
<v-text-field :model-value="props.form.name" label="Tên sản phẩm *"
  variant="outlined" color="primary" density="comfortable"
  :error-messages="props.errors.name ? [props.errors.name] : []"
  prepend-inner-icon="mdi-package-variant-closed"
  @update:model-value="emit('update:form', 'name', $event)" />

<v-text-field :model-value="props.form.sku" label="SKU *"
  variant="outlined" color="primary" density="comfortable"
  prepend-inner-icon="mdi-barcode"
  @update:model-value="emit('update:form', 'sku', $event)" />

<v-text-field :model-value="props.form.slug" label="Slug"
  variant="outlined" color="primary" density="comfortable"
  prepend-inner-icon="mdi-link-variant" clearable
  @update:model-value="emit('update:form', 'slug', $event || '')" />

<v-autocomplete :model-value="props.form.categoryId"
  :items="props.categoryOptions" item-value="id" item-title="name"
  label="Danh mục" variant="outlined" color="primary" density="comfortable"
  prepend-inner-icon="mdi-shape-outline" clearable
  @update:model-value="emit('update:form', 'categoryId', $event ?? null)" />

<v-textarea :model-value="props.form.shortDescription" label="Mô tả ngắn"
  variant="outlined" color="primary" density="comfortable"
  prepend-inner-icon="mdi-text-short" rows="2" clearable
  @update:model-value="emit('update:form', 'shortDescription', $event || '')" />

<AppCurrencyField :model-value="props.form.basePrice" label="Giá gốc *" :required="true"
  @update:model-value="emit('update:form', 'basePrice', $event ?? 0)" />

<AppCurrencyField :model-value="props.form.costPrice" label="Giá vốn" :nullable="true"
  @update:model-value="emit('update:form', 'costPrice', $event)" />
```

**Card "Cài đặt":**
```vue
<v-text-field :model-value="props.form.displayOrder" label="Thứ tự"
  type="number" variant="outlined" color="primary" density="comfortable"
  prepend-inner-icon="mdi-sort-numeric-ascending"
  @update:model-value="emit('update:form', 'displayOrder', Number($event))" />

<!-- Trạng thái toggle (Đang bán / Ngừng bán) -->
<div>
  <div class="text-caption text-medium-emphasis mb-2 ml-1">Trạng thái</div>
  <v-btn-toggle :model-value="props.form.isActive ? 'active' : 'inactive'"
    density="comfortable" rounded="lg" mandatory class="w-100"
    @update:model-value="emit('update:form', 'isActive', $event === 'active')">
    <v-btn value="active" :color="props.form.isActive ? 'primary' : undefined"
      variant="outlined" class="text-none flex-1-1" prepend-icon="mdi-storefront-outline">Đang bán</v-btn>
    <v-btn value="inactive" :color="!props.form.isActive ? 'error' : undefined"
      variant="outlined" class="text-none flex-1-1" prepend-icon="mdi-store-off-outline">Ngừng bán</v-btn>
  </v-btn-toggle>
</div>

<!-- Nổi bật switch -->
<v-switch :model-value="props.form.isFeatured" label="Nổi bật" color="primary"
  density="comfortable" hide-details
  @update:model-value="emit('update:form', 'isFeatured', $event)" />
```

Add imports: `import { AppCurrencyField } from '@/components/ui'`

"Lịch sử" card with `props.product`.

### Step 3: Rewrite ProductDetailView.vue

Keep all existing tabs (tags, option-groups, option-configs, stores). Replace the "info" tab with "overview" tab using `ProductOverviewTab`. Add inline form state.

`syncFormFromProduct`:
```typescript
function syncFormFromProduct() {
  if (!product.data.value) return
  editForm.categoryId = product.data.value.categoryId
  editForm.sku = product.data.value.sku
  editForm.name = product.data.value.name
  editForm.slug = product.data.value.slug ?? ''
  editForm.description = product.data.value.description ?? ''
  editForm.shortDescription = product.data.value.shortDescription ?? ''
  editForm.basePrice = product.data.value.basePrice
  editForm.costPrice = product.data.value.costPrice
  editForm.isActive = product.data.value.isActive
  editForm.displayOrder = product.data.value.displayOrder
  editForm.isFeatured = product.data.value.isFeatured
  snapshot.value = { ...editForm }
}
```

isDirty compares all above fields.

Load `categoryOptions` in onMounted from `categoryService.getPagedAsync({ PageNumber: 1, PageSize: 200, IsActive: true })`.

`saveChanges`:
```typescript
const payload: UpdateProductRequest = {
  CategoryId: editForm.categoryId,
  Name: editForm.name.trim(),
  Sku: editForm.sku.trim(), // Note: check if UpdateProductRequest has Sku field (was added in earlier session)
  Slug: editForm.slug || null,
  Description: editForm.description || null,
  ShortDescription: editForm.shortDescription || null,
  BasePrice: editForm.basePrice,
  CostPrice: editForm.costPrice,
  IsActive: editForm.isActive,
  DisplayOrder: editForm.displayOrder,
  IsFeatured: editForm.isFeatured,
}
const ok = await updateProduct(productId, payload)
if (ok) { await product.execute(); syncFormFromProduct() }
```

### Step 4: Update ProductsView.vue — row → detail, remove edit dialog

In `onRowAction`, `PRODUCT_ROW_ACTION.DETAIL` → navigate to `APP_ROUTES.PRODUCT.PRODUCT_DETAIL.NAME`. Remove edit dialog + edit state. Keep "Thêm sản phẩm" create dialog + delete action.

### Step 5: Final type-check

```bash
npm run type-check
```

Expected: no errors from the modified files.

---

## Self-Review vs Spec

| Spec requirement | Task |
|---|---|
| CategoryOverviewTab with inline form + history | Task 1 |
| TagOverviewTab with inline form + color preview + history | Task 2 |
| OptionGroupOverviewTab with inline form + history | Task 3 |
| OptionOverviewTab with inline form + AppCurrencyField + history | Task 4 |
| ProductOverviewTab with inline form + AppCurrencyField + history | Task 5 |
| isDirty + save/discard toolbar on all OverviewTabs | Tasks 1-5 |
| Confirm dialog on back/discard when dirty | Tasks 1-5 |
| Row click → detail page (not dialog) | Tasks 1-5 |
| Create dialog kept on list views | Tasks 1-5 |
| formatProductDate utility | Task 0 |
| Conditional subcategories tab | Task 1 |
