# Product Detail Pages — Brand Pattern

> **Hệ thống:** NDTCore FE — Product Module  
> **Phiên bản:** 1.0 — Tháng 6/2026  
> **Phạm vi:** 5 entity (Category, Tag, OptionGroup, Option, Product) × 3 layer (DetailView, OverviewTab, ListViews)

---

## 1. Mục tiêu

Đồng nhất tất cả detail pages trong Product module theo pattern của `BrandDetailView` / `BrandOverviewTab`:

- **Inline editing** trong Tab "Tổng quan" — không dùng dialog
- **Lịch sử** (createdAt / createdBy / updatedAt / updatedBy) hiển thị ở cuối tab Tổng quan
- **isDirty pattern** — toolbar với "Quay lại" / "Hủy thay đổi" / "Lưu thay đổi"
- **Row click** trên list → navigate đến detail page (không mở dialog)

---

## 2. Pattern chuẩn (Brand)

### 2.1 Cấu trúc file

```
{Entity}DetailView.vue               ← container (hero header + tabs)
  └── Tab "Tổng quan"
        └── {Entity}OverviewTab.vue  ← inline form + lịch sử + toolbar
  └── Tab(s) khác                    ← data liên quan
```

### 2.2 OverviewTab — Toolbar

```
[ ← Quay lại ]                    [ Hủy thay đổi* ] [ Lưu thay đổi ]
                                   *chỉ hiện khi isDirty
```

- **Quay lại**: nếu isDirty → hiện confirm dialog "Bỏ thay đổi?"; ngược lại navigate thẳng
- **Hủy thay đổi**: hiện confirm dialog; sau confirm → `syncFormFromEntity()`
- **Lưu thay đổi**: disabled khi `!isDirty`, loading khi đang submit

### 2.3 isDirty pattern

```typescript
const editForm = reactive<EntityFormModel>({ ... })
const snapshot = ref<EntityFormModel | null>(null)

function syncFormFromEntity() {
  // copy entity data vào editForm + lưu snapshot
  Object.assign(editForm, mapper.toFormModel(entity.data.value))
  snapshot.value = { ...editForm }
}

const isDirty = computed(() => {
  if (!snapshot.value) return false
  return /* so sánh từng field của editForm vs snapshot */
})
```

### 2.4 Section Lịch sử (cuối OverviewTab)

Card "Lịch sử" với 4 ô (2×2 grid):
- Tạo lúc · Tạo bởi
- Cập nhật lúc · Cập nhật bởi

Data từ ViewModel: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`.

### 2.5 Confirm dialog (unsaved changes)

Dùng `AppDialog` (có sẵn) với:
- title: "Bỏ thay đổi?"
- body: "Bạn có thay đổi chưa được lưu. Nếu tiếp tục, các thay đổi sẽ bị mất."
- confirm-label: "Bỏ thay đổi" / cancel-label: "Ở lại"

### 2.6 List view — Row navigation

- Row click → `router.push({ name: ENTITY_DETAIL.NAME, params: { id: item.id } })`
- Remove edit dialog (`AppDialog` + Form) khỏi list view
- Giữ nguyên delete action (confirm dialog) trên list

---

## 3. Category

### 3.1 CategoryOverviewTab.vue

**Props:**
```typescript
interface Props {
  category: CategoryViewModel
  form: CategoryFormModel
  errors: Partial<Record<keyof CategoryFormModel, string>>
  isDirty: boolean
  submitting: boolean
  parentOptions: { id: number; name: string }[]  // active-only, excluding self
}
```

**Emits:** `update:form(field, value)` · `save` · `discard`

**Form fields:**

| Field | Component | Notes |
|-------|-----------|-------|
| Tên danh mục | `v-text-field` | required |
| Slug | `v-text-field` | auto-gen từ name, editable |
| Danh mục cha | `v-autocomplete` | items = parentOptions |
| Thứ tự hiển thị | `v-text-field type="number"` | ≥ 0 |
| Trạng thái | `v-btn-toggle` | Hoạt động / Ẩn |

**Lịch sử:** createdAt, createdBy, updatedAt, updatedBy.

### 3.2 CategoryDetailView.vue — Tabs

| Tab | Value | Nội dung |
|-----|-------|----------|
| Tổng quan | `overview` | `CategoryOverviewTab` |
| Danh mục con | `children` | danh sách sub-categories (conditional: chỉ hiện nếu có) |
| Sản phẩm | `products` | danh sách sản phẩm thuộc danh mục |

Tab "Danh mục con" chỉ render khi `children.length > 0`.

### 3.3 CategoriesView — List changes

- Click row → navigate to `CATEGORY_DETAIL`
- Remove dialog + `CategoryForm` import
- Giữ delete action trong `onRowAction`

---

## 4. Tag

### 4.1 TagOverviewTab.vue

**Props:**
```typescript
interface Props {
  tag: TagViewModel
  form: TagFormModel
  errors: Partial<Record<keyof TagFormModel, string>>
  isDirty: boolean
  submitting: boolean
}
```

**Emits:** `update:form(field, value)` · `save` · `discard`

**Form fields:**

| Field | Component | Notes |
|-------|-----------|-------|
| Tên nhãn | `v-text-field` | required |
| Màu nền (ColorHex) | `v-text-field` | `#RRGGBB`, preview swatch |
| Màu chữ (TextColor) | `v-text-field` | `#RRGGBB`, preview swatch |
| Preview | `v-chip` (reactive) | live preview pill |
| Thứ tự | `v-text-field type="number"` | ≥ 0 |
| Trạng thái | `v-btn-toggle` | Hoạt động / Ẩn |

**Lịch sử:** createdAt, createdBy, updatedAt, updatedBy.

### 4.2 TagDetailView.vue — Tabs

| Tab | Value | Nội dung |
|-----|-------|----------|
| Tổng quan | `overview` | `TagOverviewTab` |
| Sản phẩm | `products` | placeholder (TODO: TagId filter) |

### 4.3 TagsView — List changes

- Click row → navigate to `TAG_DETAIL`
- Remove dialog + `TagForm` import
- Giữ delete action

---

## 5. OptionGroup

### 5.1 OptionGroupOverviewTab.vue

**Props:**
```typescript
interface Props {
  group: OptionGroupViewModel
  form: OptionGroupFormModel
  errors: Partial<Record<keyof OptionGroupFormModel, string>>
  isDirty: boolean
  submitting: boolean
}
```

**Emits:** `update:form(field, value)` · `save` · `discard`

**Form fields:**

| Field | Component | Notes |
|-------|-----------|-------|
| Tên nhóm | `v-text-field` | required |
| Loại UI | `v-btn-toggle` | SingleSelect / MultiSelect |
| Mô tả | `v-textarea` | optional |
| Thứ tự | `v-text-field type="number"` | ≥ 0 |
| Trạng thái | `v-btn-toggle` | Hoạt động / Ẩn |

**Lịch sử:** createdAt, createdBy, updatedAt, updatedBy.

### 5.2 OptionGroupDetailView.vue — Tabs

| Tab | Value | Nội dung |
|-----|-------|----------|
| Tổng quan | `overview` | `OptionGroupOverviewTab` |
| Options | `options` | danh sách options thuộc nhóm |
| Sản phẩm | `products` | placeholder (TODO: GroupId filter) |

### 5.3 OptionGroupsView — List changes

- Click row → navigate to `OPTION_GROUP_DETAIL`
- Remove dialog + `OptionGroupForm` import
- Giữ delete action

---

## 6. Option

### 6.1 OptionOverviewTab.vue

**Props:**
```typescript
interface Props {
  option: OptionViewModel
  form: OptionFormModel
  errors: Partial<Record<keyof OptionFormModel, string>>
  isDirty: boolean
  submitting: boolean
  groupOptions: { id: number; name: string }[]  // all option groups
}
```

**Emits:** `update:form(field, value)` · `save` · `discard`

**Form fields:**

| Field | Component | Notes |
|-------|-----------|-------|
| Tên option | `v-text-field` | required |
| Nhóm | `v-autocomplete` | items = groupOptions |
| Giá mặc định | `AppCurrencyField` | ≥ 0 |
| Thứ tự | `v-text-field type="number"` | ≥ 0 |
| Trạng thái | `v-btn-toggle` | Hoạt động / Ẩn |

**Lịch sử:** createdAt, createdBy, updatedAt, updatedBy.

### 6.2 OptionDetailView.vue — Tabs

| Tab | Value | Nội dung |
|-----|-------|----------|
| Tổng quan | `overview` | `OptionOverviewTab` |
| Cửa hàng | `stores` | `OptionStoreOverridesTab` (đã có) |

### 6.3 OptionsView — List changes

- Click row → navigate to `OPTION_DETAIL`
- Remove dialog + `OptionForm` import
- Giữ delete action

---

## 7. Product

### 7.1 ProductOverviewTab.vue

**Props:**
```typescript
interface Props {
  product: ProductViewModel
  form: ProductFormModel
  errors: Partial<Record<keyof ProductFormModel, string>>
  isDirty: boolean
  submitting: boolean
  categoryOptions: { id: number; name: string }[]
}
```

**Emits:** `update:form(field, value)` · `save` · `discard`

**Form fields — Section Thông tin cơ bản:**

| Field | Component | Notes |
|-------|-----------|-------|
| Tên sản phẩm | `v-text-field` | required |
| SKU | `v-text-field` | required, unique |
| Slug | `v-text-field` | auto-gen, editable |
| Danh mục | `v-autocomplete` | items = categoryOptions |
| Mô tả ngắn | `v-textarea` | optional |

**Form fields — Section Giá:**

| Field | Component | Notes |
|-------|-----------|-------|
| Giá gốc | `AppCurrencyField` | required, ≥ 0 |
| Giá vốn | `AppCurrencyField` | optional, nullable |

**Form fields — Section Cài đặt:**

| Field | Component | Notes |
|-------|-----------|-------|
| Trạng thái | `v-btn-toggle` | Đang bán / Ngừng bán |
| Nổi bật | `v-switch` | IsFeatured |
| Thứ tự | `v-text-field type="number"` | ≥ 0 |

**Lịch sử:** createdAt, createdBy, updatedAt, updatedBy.

### 7.2 ProductDetailView.vue — Tabs (giữ nguyên các tab đã có)

| Tab | Value | Nội dung |
|-----|-------|----------|
| Tổng quan | `overview` | `ProductOverviewTab` |
| Tags | `tags` | `ProductTagsTab` (đã có) |
| Nhóm option | `option-groups` | `ProductOptionGroupsTab` (đã có) |
| Cấu hình option | `option-configs` | `ProductOptionConfigsTab` (đã có) |
| Cửa hàng | `stores` | `ProductStoreOverridesTab` (đã có) |

### 7.3 ProductsView — List changes

- Click row → navigate to `PRODUCT_DETAIL`
- Remove edit dialog
- Giữ delete action

---

## 8. Shared utilities

### 8.1 formatDate utility

Dùng chung cho tất cả OverviewTab. Đặt tại `src/modules/product/utils/product.utils.ts`:

```typescript
export function formatProductDate(value: string | null | undefined): string {
  if (!value) return '---'
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
```

### 8.2 ViewModel — Audit fields

Tất cả ViewModel cần có: `createdAt: string | null`, `createdBy: string | null`, `updatedAt: string | null`, `updatedBy: string | null`.

Nếu hiện tại chưa có, cần bổ sung vào mapper từ DTO.

---

## 9. Tổng hợp files

| File | Action |
|------|--------|
| `src/modules/product/components/CategoryOverviewTab.vue` | Tạo mới |
| `src/modules/product/components/TagOverviewTab.vue` | Tạo mới |
| `src/modules/product/components/OptionGroupOverviewTab.vue` | Tạo mới |
| `src/modules/product/components/OptionOverviewTab.vue` | Tạo mới |
| `src/modules/product/components/ProductOverviewTab.vue` | Tạo mới |
| `src/modules/product/views/CategoryDetailView.vue` | Sửa — thêm inline form state |
| `src/modules/product/views/TagDetailView.vue` | Sửa — thêm inline form state |
| `src/modules/product/views/OptionGroupDetailView.vue` | Sửa — thêm inline form state |
| `src/modules/product/views/OptionDetailView.vue` | Sửa — thêm inline form state |
| `src/modules/product/views/ProductDetailView.vue` | Sửa — thêm inline form state |
| `src/modules/product/views/CategoriesView.vue` | Sửa — row click → detail, remove dialog |
| `src/modules/product/views/TagsView.vue` | Sửa — row click → detail, remove dialog |
| `src/modules/product/views/OptionGroupsView.vue` | Sửa — row click → detail, remove dialog |
| `src/modules/product/views/OptionsView.vue` | Sửa — row click → detail, remove dialog |
| `src/modules/product/views/ProductsView.vue` | Sửa — row click → detail, remove dialog |
| `src/modules/product/utils/product.utils.ts` | Tạo mới |

---

## 10. Ngoài phạm vi

- Image upload section cho Product (separate plan)
- Slug auto-generation logic (existing `toSlug` util)
- Tag "Sản phẩm" tab — cần BE hỗ trợ TagId filter (TODO)
- OptionGroup "Sản phẩm" tab — cần BE endpoint (TODO)
