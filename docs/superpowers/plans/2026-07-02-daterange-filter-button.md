# Gộp Filter "Khoảng thời gian" Thành 1 Nút — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi filter `daterange` dùng chung trong `AppDataFilter.vue` từ 2 nút chọn ngày riêng (từ/đến) thành 1 nút duy nhất, mở dropdown chứa `v-date-picker` range, hiển thị giá trị đã chọn ngay trên label nút (`dd/MM/yyyy - dd/MM/yyyy`).

**Architecture:** Sửa duy nhất `AppDataFilter.vue` (component UI dùng chung). Thêm 2 object `reactive` theo field key để quản lý trạng thái menu mở/đóng và draft ngày đang chọn trong lịch; chỉ commit ra `modelValue` khi bấm "Áp dụng". Contract giá trị filter (`[string, string]` dạng `YYYY-MM-DD`) không đổi nên mọi consumer khác (`StoreRevenueListView.vue`, `OrdersView.vue`, `useStoreRevenueList.ts`, `date-range.util.ts`) giữ nguyên.

**Tech Stack:** Vue 3 (Composition API) + TypeScript strict + Vuetify 3 (`v-btn`, `v-menu`, `v-date-picker` với `multiple="range"`).

## Global Constraints

- FE: TypeScript strict, không dùng `any`.
- Không viết comment giải thích WHAT — chỉ viết khi WHY không rõ.
- Trước khi commit FE: chạy `npx vue-tsc --build` để đảm bảo không có type error.
- Không đổi contract giá trị emit của field `daterange` (`[string, string]` dạng `YYYY-MM-DD`, hoặc `null`) — mọi view tiêu thụ giữ nguyên logic đọc filter.
- Không sửa BE (đã xác nhận `GetPagedStoreRevenue` xử lý offset đúng qua kiểu `DateTimeOffset`, xem spec mục 1).

---

### Task 1: Thay UI filter `daterange` trong `AppDataFilter.vue`

**Files:**
- Modify: `NDTCore.FE/src/components/ui/components/AppDataFilter.vue`

**Interfaces:**
- Consumes: `FilterField` (`key`, `label`, `type`), `ActiveFilters`, `FilterValue` từ `../types` (không đổi); `APP_DATA_FILTER_EMIT.UPDATE_MODEL_VALUE` từ `../constants/emit-keys` (không đổi).
- Produces: Không có API mới hướng ra ngoài component — `update(key, value)` nội bộ vẫn emit `APP_DATA_FILTER_EMIT.UPDATE_MODEL_VALUE` với `value` dạng `[string, string] | null` giống hệt hành vi cũ, nên `StoreRevenueListView.vue` và `OrdersView.vue` không cần đổi gì.

- [ ] **Step 1: Đọc file hiện tại để xác nhận vị trí sửa**

Không cần chạy lệnh — file đã biết nội dung đầy đủ (24 dòng script, 125 dòng template hiện có tại `NDTCore.FE/src/components/ui/components/AppDataFilter.vue`).

- [ ] **Step 2: Sửa phần `<script setup>` — bỏ `getDateRange`/`updateDateRange`, thêm state + helper cho date-range button**

Thay toàn bộ nội dung `<script setup lang="ts">...</script>` bằng:

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import type { FilterField, ActiveFilters, FilterValue } from '../types'
import { APP_DATA_FILTER_EMIT } from '../constants/emit-keys'
import type { AppDataFilterEmits } from '../types/emit.types'

const props = defineProps<{
  fields: FilterField[]
  modelValue: ActiveFilters
}>()

const emit = defineEmits<AppDataFilterEmits>()

const update = (key: string, value: FilterValue) => {
  emit(APP_DATA_FILTER_EMIT.UPDATE_MODEL_VALUE, { ...props.modelValue, [key]: value })
}

const getStr = (key: string): string => (props.modelValue[key] as string | null) ?? ''

const getStrArr = (key: string): string[] => (props.modelValue[key] as string[] | null) ?? []

const getFieldValue = (key: string): string | null => {
  return props.modelValue[key] as string | null
}

const menuOpen = reactive<Record<string, boolean>>({})
const draftDates = reactive<Record<string, Date[]>>({})

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDmy(key: string): string {
  const [y, m, d] = key.split('-')
  return `${d}/${m}/${y}`
}

function dateRangeLabel(field: FilterField): string {
  const val = props.modelValue[field.key] as [string, string] | null
  return val?.[0] && val?.[1] ? `${formatDmy(val[0])} - ${formatDmy(val[1])}` : field.label
}

function onDateRangeMenuUpdate(key: string, isOpen: boolean): void {
  menuOpen[key] = isOpen
  if (isOpen) {
    const val = props.modelValue[key] as [string, string] | null
    draftDates[key] = val?.[0] && val?.[1] ? [parseDateKey(val[0]), parseDateKey(val[1])] : []
  }
}

function onDraftDatesChange(key: string, value: Date[]): void {
  draftDates[key] = value
}

function applyDateRange(key: string): void {
  const dates = [...(draftDates[key] ?? [])].sort((a, b) => a.getTime() - b.getTime())
  update(key, dates.length ? [toDateKey(dates[0]), toDateKey(dates[dates.length - 1])] : null)
  menuOpen[key] = false
}

function cancelDateRange(key: string): void {
  menuOpen[key] = false
}
</script>
```

`getDateRange`/`updateDateRange` bị xóa vì không còn nơi nào dùng sau khi thay template ở Step 3.

- [ ] **Step 3: Sửa phần `<template>` — thay block `daterange`, giữ nguyên các block khác**

Trong `<template>`, tìm block:

```html
      <!-- daterange -->
      <template v-else-if="field.type === 'daterange'">
        <v-text-field
          :model-value="getDateRange(field.key, 0)"
          :label="`${field.label} từ`"
          type="date"
          density="compact"
          hide-details="auto"
          style="min-width: 160px; max-width: 200px; flex: 0 0 auto"
          @update:model-value="updateDateRange(field.key, 0, $event ?? '')"
        />
        <v-text-field
          :model-value="getDateRange(field.key, 1)"
          :label="`${field.label} đến`"
          type="date"
          density="compact"
          hide-details="auto"
          style="min-width: 160px; max-width: 200px; flex: 0 0 auto"
          @update:model-value="updateDateRange(field.key, 1, $event ?? '')"
        />
      </template>
```

Thay bằng:

```html
      <!-- daterange -->
      <template v-else-if="field.type === 'daterange'">
        <v-btn
          variant="outlined"
          prepend-icon="mdi-calendar-range"
          class="text-none"
          style="min-width: 220px; flex: 0 0 auto"
        >
          {{ dateRangeLabel(field) }}
          <v-menu
            :model-value="menuOpen[field.key] ?? false"
            activator="parent"
            location="bottom start"
            :close-on-content-click="false"
            @update:model-value="onDateRangeMenuUpdate(field.key, $event)"
          >
            <v-card min-width="300">
              <v-date-picker
                :model-value="draftDates[field.key] ?? []"
                :multiple="'range'"
                hide-header
                show-adjacent-months
                @update:model-value="onDraftDatesChange(field.key, $event)"
              />
              <v-card-actions class="justify-end">
                <v-btn variant="text" @click="cancelDateRange(field.key)">Hủy</v-btn>
                <v-btn variant="flat" color="primary" @click="applyDateRange(field.key)">Áp dụng</v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
        </v-btn>
      </template>
```

Toàn bộ file sau khi sửa (tham khảo để đối chiếu vị trí, các block `text`/`select`/`multiselect`/`date` giữ nguyên y hệt bản gốc):

```vue
<template>
  <div class="d-flex flex-wrap ga-2">
    <template v-for="field in fields" :key="field.key">
      <!-- text -->
      <v-text-field
        v-if="field.type === 'text'"
        :model-value="getStr(field.key)"
        :label="field.label"
        :placeholder="field.placeholder"
        density="compact"
        hide-details="auto"
        clearable
        persistent-clear
        style="min-width: 180px; max-width: 280px; flex: 0 0 auto"
        @update:model-value="update(field.key, $event ?? null)"
        @keyup.enter="emit(APP_DATA_FILTER_EMIT.SEARCH)"
      />

      <!-- select -->
      <v-select
        v-else-if="field.type === 'select'"
        :model-value="getFieldValue(field.key)"
        :items="field.options ?? []"
        item-title="label"
        item-value="value"
        :label="field.label"
        density="compact"
        hide-details="auto"
        style="min-width: 160px; max-width: 240px; flex: 0 0 auto"
        @update:model-value="update(field.key, $event ?? null)"
      />

      <!-- multiselect -->
      <v-select
        v-else-if="field.type === 'multiselect'"
        :model-value="getStrArr(field.key)"
        :items="field.options ?? []"
        item-title="label"
        item-value="value"
        :label="field.label"
        density="compact"
        hide-details="auto"
        multiple
        chips
        closable-chips
        style="min-width: 200px; max-width: 320px; flex: 0 0 auto"
        @update:model-value="update(field.key, ($event as string[])?.length ? $event : null)"
      />

      <!-- date -->
      <v-text-field
        v-else-if="field.type === 'date'"
        :model-value="getStr(field.key)"
        :label="field.label"
        type="date"
        density="compact"
        hide-details="auto"
        clearable
        persistent-clear
        style="min-width: 160px; max-width: 200px; flex: 0 0 auto"
        @update:model-value="update(field.key, $event || null)"
      />

      <!-- daterange -->
      <template v-else-if="field.type === 'daterange'">
        <v-btn
          variant="outlined"
          prepend-icon="mdi-calendar-range"
          class="text-none"
          style="min-width: 220px; flex: 0 0 auto"
        >
          {{ dateRangeLabel(field) }}
          <v-menu
            :model-value="menuOpen[field.key] ?? false"
            activator="parent"
            location="bottom start"
            :close-on-content-click="false"
            @update:model-value="onDateRangeMenuUpdate(field.key, $event)"
          >
            <v-card min-width="300">
              <v-date-picker
                :model-value="draftDates[field.key] ?? []"
                :multiple="'range'"
                hide-header
                show-adjacent-months
                @update:model-value="onDraftDatesChange(field.key, $event)"
              />
              <v-card-actions class="justify-end">
                <v-btn variant="text" @click="cancelDateRange(field.key)">Hủy</v-btn>
                <v-btn variant="flat" color="primary" @click="applyDateRange(field.key)">Áp dụng</v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
        </v-btn>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import type { FilterField, ActiveFilters, FilterValue } from '../types'
import { APP_DATA_FILTER_EMIT } from '../constants/emit-keys'
import type { AppDataFilterEmits } from '../types/emit.types'

const props = defineProps<{
  fields: FilterField[]
  modelValue: ActiveFilters
}>()

const emit = defineEmits<AppDataFilterEmits>()

const update = (key: string, value: FilterValue) => {
  emit(APP_DATA_FILTER_EMIT.UPDATE_MODEL_VALUE, { ...props.modelValue, [key]: value })
}

const getStr = (key: string): string => (props.modelValue[key] as string | null) ?? ''

const getStrArr = (key: string): string[] => (props.modelValue[key] as string[] | null) ?? []

const getFieldValue = (key: string): string | null => {
  return props.modelValue[key] as string | null
}

const menuOpen = reactive<Record<string, boolean>>({})
const draftDates = reactive<Record<string, Date[]>>({})

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDmy(key: string): string {
  const [y, m, d] = key.split('-')
  return `${d}/${m}/${y}`
}

function dateRangeLabel(field: FilterField): string {
  const val = props.modelValue[field.key] as [string, string] | null
  return val?.[0] && val?.[1] ? `${formatDmy(val[0])} - ${formatDmy(val[1])}` : field.label
}

function onDateRangeMenuUpdate(key: string, isOpen: boolean): void {
  menuOpen[key] = isOpen
  if (isOpen) {
    const val = props.modelValue[key] as [string, string] | null
    draftDates[key] = val?.[0] && val?.[1] ? [parseDateKey(val[0]), parseDateKey(val[1])] : []
  }
}

function onDraftDatesChange(key: string, value: Date[]): void {
  draftDates[key] = value
}

function applyDateRange(key: string): void {
  const dates = [...(draftDates[key] ?? [])].sort((a, b) => a.getTime() - b.getTime())
  update(key, dates.length ? [toDateKey(dates[0]), toDateKey(dates[dates.length - 1])] : null)
  menuOpen[key] = false
}

function cancelDateRange(key: string): void {
  menuOpen[key] = false
}
</script>
```

- [ ] **Step 4: Chạy type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: Không có lỗi output (exit code 0). Nếu báo lỗi type ở `:multiple="'range'"` hoặc `@update:model-value="onDraftDatesChange(field.key, $event)"` (ví dụ generic của `v-date-picker` không suy luận đúng `Date[]`), sửa bằng cách ép kiểu tường minh tại chỗ gọi:

```ts
function onDraftDatesChange(key: string, value: unknown): void {
  draftDates[key] = value as Date[]
}
```

- [ ] **Step 5: Chạy lint**

Run: `cd NDTCore.FE && npm run lint`
Expected: Không có lỗi (oxlint + eslint tự fix những gì fix được, không còn lỗi còn lại).

- [ ] **Step 6: Commit**

```bash
git add NDTCore.FE/src/components/ui/components/AppDataFilter.vue
git commit -m "feat: gop filter khoang thoi gian thanh 1 nut date-range picker"
```

---

### Task 2: Kiểm thử thủ công trên dev server (Store Revenue List + Order List)

**Files:** Không sửa file — chỉ chạy và quan sát ứng dụng.

**Interfaces:**
- Consumes: Kết quả build từ Task 1 (`AppDataFilter.vue` đã cập nhật), route sẵn có `Báo cáo doanh thu theo cửa hàng` (`StoreRevenueListView.vue`) và `Order List` (`OrdersView.vue`).
- Produces: Xác nhận bằng quan sát trực tiếp trên trình duyệt — không có deliverable code.

- [ ] **Step 1: Khởi động dev server**

Run: `cd NDTCore.FE && npm run dev`
Expected: Server chạy ở `http://localhost:5173` (hoặc cổng hiển thị trong log), không có lỗi compile.

- [ ] **Step 2: Test trang Báo cáo doanh thu theo cửa hàng**

Trong trình duyệt, vào route báo cáo doanh thu theo cửa hàng (menu Dashboard → Doanh thu). Thực hiện:
1. Quan sát nút "Khoảng thời gian" hiển thị mặc định range tháng hiện tại theo format `dd/MM/yyyy - dd/MM/yyyy` (vì `onMounted` gọi `applyCurrentMonthDefault()` set sẵn `dateRange`).
2. Bấm nút → menu mở, lịch hiển thị đúng range đang chọn (draft init từ giá trị hiện tại).
3. Chọn 1 ngày bắt đầu khác, 1 ngày kết thúc khác trên lịch → bấm "Áp dụng" → menu đóng, label nút cập nhật đúng theo range mới.
4. Bấm "Tìm kiếm" → bảng load lại dữ liệu đúng theo range mới (kiểm tra qua Network tab: request `GetPagedStoreRevenue` có `From`/`To` dạng ISO kèm offset, ví dụ `...T00:00:00+07:00`).
5. Bấm nút lại, chọn range khác nhưng bấm "Hủy" (hoặc click ra ngoài menu) → menu đóng, label nút **không đổi** (vẫn giữ range đã áp dụng ở bước 3).
6. Bấm "Xóa lọc" → label nút quay về range tháng hiện tại (mặc định).

Expected: Tất cả 6 bước đúng như mô tả, không có lỗi console.

- [ ] **Step 3: Test trang Order List**

Vào route danh sách đơn hàng (Order List). Thực hiện tương tự bước 2–5 ở Step 2 với field "Ngày tạo":
1. Chọn range trên lịch → "Áp dụng" → label nút cập nhật đúng `dd/MM/yyyy - dd/MM/yyyy`.
2. Bấm "Tìm kiếm" → verify qua Network tab request có `FromDate`/`ToDate` dạng `YYYY-MM-DDT00:00:00` / `YYYY-MM-DDT23:59:59` (không có offset — giữ nguyên hành vi cũ của trang này, vì `OrdersView.vue` không nằm trong phạm vi sửa của task này).

Expected: Nút gộp hoạt động đúng, giá trị gửi BE không đổi format so với trước khi sửa UI.

- [ ] **Step 4: Dừng dev server**

Dừng process `npm run dev` (Ctrl+C hoặc kill terminal).
