# Order List DateRange Fix + Store Revenue Detail Default Preset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Fix Order List's "Khoảng thời gian" filter — placeholder label, no default range on load, and send local time with UTC offset to the backend. (2) Change Store Revenue Detail's default date preset from "Tháng này" to "Hôm nay".

**Architecture:** Extract the offset-aware date-range helpers (`toDateKey`, `toRangeStart`, `toRangeEnd`) out of the report module into `core/utils/`, since Order List needs the exact same helpers Store Revenue already uses and cross-module imports between `modules/*` are not allowed by this repo's dependency direction rules (`modules → core`, never `module → module`). Then wire Order List to use them and fix its default-filter behavior; separately flip Store Revenue Detail's initial preset.

**Tech Stack:** Vue 3 (Composition API) + TypeScript strict. FE only — no backend changes (already confirmed correct for both Order and Store Revenue: `DateTimeOffset` columns compared directly against `DateTimeOffset` query params).

## Global Constraints

- FE: TypeScript strict, không dùng `any`.
- Không viết comment giải thích WHAT — chỉ viết khi WHY không rõ.
- Trước khi commit FE: chạy `npx vue-tsc --build` để đảm bảo không có type error.
- Core (`core/utils/`) không được phụ thuộc ngược vào `modules/*` (dependency direction: `modules → core`, không có chiều ngược lại).
- Không sửa BE — đã xác nhận `OrderFilterDto.FromDate/ToDate` và `StoreRevenueFilterDto.From/To` đều là `DateTimeOffset`, so sánh trực tiếp với cột `DateTimeOffset` trong DB, không cần convert thủ công miễn FE gửi đúng offset.

---

### Task 1: Extract shared date-range-with-offset helpers to `core/utils/`

**Files:**
- Create: `NDTCore.FE/src/core/utils/date-range.util.ts`
- Modify: `NDTCore.FE/src/modules/report/utils/date-range.util.ts`
- Modify: `NDTCore.FE/src/modules/report/views/StoreRevenueListView.vue:117`
- Modify: `NDTCore.FE/src/modules/report/views/StoreRevenueDetailView.vue:208-217`

**Interfaces:**
- Produces (from new `core/utils/date-range.util.ts`): `toDateKey(date: Date): string`, `toRangeStart(dateKey: string): string`, `toRangeEnd(dateKey: string): string` — identical signatures/behavior to what previously lived in the report module.
- Consumed by: Task 2 (`OrdersView.vue` will import `toRangeStart`/`toRangeEnd` from this new core file).

- [ ] **Step 1: Create the new core utility file**

Create `NDTCore.FE/src/core/utils/date-range.util.ts`:

```ts
export function toDateKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

// getTimezoneOffset() returns minutes BEHIND UTC (positive = west of UTC), so it must be negated
// to get the actual UTC offset (positive = east of UTC, e.g. +07:00 for vi-VN).
function localOffsetSuffix(): string {
    const offsetMinutes = -new Date().getTimezoneOffset()
    const sign = offsetMinutes >= 0 ? '+' : '-'
    const abs = Math.abs(offsetMinutes)
    const hours = String(Math.floor(abs / 60)).padStart(2, '0')
    const minutes = String(abs % 60).padStart(2, '0')
    return `${sign}${hours}:${minutes}`
}

// Backend compares this against a DateTimeOffset column, so From/To must always carry the
// browser's real UTC offset — never a bare local-time string (server may run in a different timezone).
export function toRangeStart(dateKey: string): string {
    return `${dateKey}T00:00:00${localOffsetSuffix()}`
}

export function toRangeEnd(dateKey: string): string {
    return `${dateKey}T23:59:59${localOffsetSuffix()}`
}
```

- [ ] **Step 2: Remove the moved functions from the report module's util, import `toDateKey` from core**

Replace the full contents of `NDTCore.FE/src/modules/report/utils/date-range.util.ts` with:

```ts
import { toDateKey } from '@/core/utils/date-range.util'

// new Date(year, month + 1, 0) rolls back to the last day of `month` — avoids an off-by-one.
export function currentMonthDateKeys(): [string, string] {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return [toDateKey(firstDay), toDateKey(lastDay)]
}

export function todayKey(): string {
    return toDateKey(new Date())
}

export function yesterdayKey(): string {
    const now = new Date()
    return toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
}

// Inclusive of today — e.g. "7 ngày gần nhất" spans today and the 6 days before it.
export function last7DaysKeys(): [string, string] {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    return [toDateKey(from), toDateKey(now)]
}

export function last30DaysKeys(): [string, string] {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
    return [toDateKey(from), toDateKey(now)]
}
```

- [ ] **Step 3: Update `StoreRevenueListView.vue` import**

In `NDTCore.FE/src/modules/report/views/StoreRevenueListView.vue`, find line 117:

```ts
import { toDateKey, currentMonthDateKeys, toRangeStart, toRangeEnd } from '@/modules/report/utils/date-range.util'
```

Replace with:

```ts
import { toDateKey, toRangeStart, toRangeEnd } from '@/core/utils/date-range.util'
import { currentMonthDateKeys } from '@/modules/report/utils/date-range.util'
```

No other line in this file changes — `toDateKey`, `toRangeStart`, `toRangeEnd`, `currentMonthDateKeys` are still called with the exact same names elsewhere in the file.

- [ ] **Step 4: Update `StoreRevenueDetailView.vue` import**

In `NDTCore.FE/src/modules/report/views/StoreRevenueDetailView.vue`, find lines 208-217:

```ts
import {
    toDateKey,
    currentMonthDateKeys,
    todayKey,
    yesterdayKey,
    last7DaysKeys,
    last30DaysKeys,
    toRangeStart,
    toRangeEnd,
} from '@/modules/report/utils/date-range.util'
```

Replace with:

```ts
import { toDateKey, toRangeStart, toRangeEnd } from '@/core/utils/date-range.util'
import {
    currentMonthDateKeys,
    todayKey,
    yesterdayKey,
    last7DaysKeys,
    last30DaysKeys,
} from '@/modules/report/utils/date-range.util'
```

No other line in this file changes in this task (the default-preset change is Task 3, done later on top of this).

- [ ] **Step 5: Run the existing test suite for the moved functions**

Run: `cd NDTCore.FE && npx vitest run src/modules/report/utils/date-range.util.test.ts`
Expected: `4 tests | 4 passed` — the test file only imports `todayKey`, `yesterdayKey`, `last7DaysKeys`, `last30DaysKeys` (unchanged public behavior), so it must still pass unmodified.

- [ ] **Step 6: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: exit code 0, no errors.

- [ ] **Step 7: Commit**

```bash
cd NDTCore.FE
git add src/core/utils/date-range.util.ts src/modules/report/utils/date-range.util.ts src/modules/report/views/StoreRevenueListView.vue src/modules/report/views/StoreRevenueDetailView.vue
git commit -m "refactor: move date-range offset helpers to core/utils for cross-module reuse"
```

---

### Task 2: Fix Order List "Khoảng thời gian" filter

**Files:**
- Modify: `NDTCore.FE/src/modules/order/constants/order-list.constants.ts:69`
- Modify: `NDTCore.FE/src/modules/order/views/OrdersView.vue`

**Interfaces:**
- Consumes: `toRangeStart(dateKey: string): string`, `toRangeEnd(dateKey: string): string` from `@/core/utils/date-range.util` (produced by Task 1 — must be complete and committed first).

- [ ] **Step 1: Change the filter field label**

In `NDTCore.FE/src/modules/order/constants/order-list.constants.ts`, line 69, change:

```ts
        { key: 'dateRange', label: 'Ngày tạo', type: 'daterange' },
```

to:

```ts
        { key: 'dateRange', label: 'Khoảng thời gian', type: 'daterange' },
```

- [ ] **Step 2: Import the offset-aware range helpers in `OrdersView.vue`**

In `NDTCore.FE/src/modules/order/views/OrdersView.vue`, add this import after the existing `import type { OrderViewModel } from '@/modules/order/models/view-models/order.view-model'` line (line 122):

```ts
import { toRangeStart, toRangeEnd } from '@/core/utils/date-range.util'
```

- [ ] **Step 3: Send offset-aware `FromDate`/`ToDate`**

In the same file, inside `fetchOrders`, change:

```ts
        FromDate: dateRange?.[0] ? `${dateRange[0]}T00:00:00` : null,
        ToDate: dateRange?.[1] ? `${dateRange[1]}T23:59:59` : null,
```

to:

```ts
        FromDate: dateRange?.[0] ? toRangeStart(dateRange[0]) : null,
        ToDate: dateRange?.[1] ? toRangeEnd(dateRange[1]) : null,
```

- [ ] **Step 4: Remove the "default to today" behavior**

In the same file, delete the entire `applyTodayDefault` function:

```ts
function applyTodayDefault(): void {
    const today = new Date().toISOString().slice(0, 10)
    listPage.filters.setFilter('dateRange', [today, today])
}
```

Then remove its two call sites. First, in `onResetFilters`, change:

```ts
const onResetFilters = async () => {
    listPage.filters.resetFilters()
    applyTodayDefault()
    applyDefaultStoreIfRestricted()
    listPage.pagination.reset()
    await refreshIfScoped()
}
```

to:

```ts
const onResetFilters = async () => {
    listPage.filters.resetFilters()
    applyDefaultStoreIfRestricted()
    listPage.pagination.reset()
    await refreshIfScoped()
}
```

Second, in `onMounted`, change:

```ts
onMounted(async () => {
    const storesResult = await getPagedStores({ PageNumber: 1, PageSize: 200 })
    storeCodeById.value = Object.fromEntries(storesResult.items.map((s) => [s.id, s.code]))
    firstScopedStoreId.value = storesResult.items[0]?.id ?? null

    applyDefaultStoreIfRestricted()
    applyTodayDefault()
    await refreshIfScoped()
})
```

to:

```ts
onMounted(async () => {
    const storesResult = await getPagedStores({ PageNumber: 1, PageSize: 200 })
    storeCodeById.value = Object.fromEntries(storesResult.items.map((s) => [s.id, s.code]))
    firstScopedStoreId.value = storesResult.items[0]?.id ?? null

    applyDefaultStoreIfRestricted()
    await refreshIfScoped()
})
```

`listPage.filters.resetFilters()` (called by `onResetFilters`) and the initial state of `useFilters` (used internally by `useListPage`, called once when `OrdersView.vue` sets up `listPage`) both already default every field — including `dateRange` — to `null`, so no replacement default-setting code is needed.

- [ ] **Step 5: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: exit code 0, no errors.

- [ ] **Step 6: Lint**

Run: `cd NDTCore.FE && npm run lint`
Expected: no new errors introduced in `order-list.constants.ts` or `OrdersView.vue` (any pre-existing unrelated errors elsewhere are not this task's concern — verify by checking the file names in the lint output, not just the exit code).

- [ ] **Step 7: Commit**

```bash
cd NDTCore.FE
git add src/modules/order/constants/order-list.constants.ts src/modules/order/views/OrdersView.vue
git commit -m "fix: gui local time kem offset va bo default ngay hom nay cho filter khoang thoi gian o Order List"
```

---

### Task 3: Change Store Revenue Detail's default preset to "Hôm nay"

**Files:**
- Modify: `NDTCore.FE/src/modules/report/views/StoreRevenueDetailView.vue`

**Interfaces:**
- Consumes: `applyPreset(preset: DatePreset): void` — already defined in this file (sets `fromDate`, `toDate`, and `datePreset` for the given preset, including the `'today'` case which calls `todayKey()` for both bounds). No new interface is introduced by this task.

- [ ] **Step 1: Change the initial `datePreset` ref**

In `NDTCore.FE/src/modules/report/views/StoreRevenueDetailView.vue`, change:

```ts
const datePreset = ref<DatePreset>('thisMonth')
```

to:

```ts
const datePreset = ref<DatePreset>('today')
```

- [ ] **Step 2: Use `applyPreset('today')` in `onMounted` instead of setting the month range directly**

Change:

```ts
onMounted(async () => {
    const [from, to] = currentMonthDateKeys()
    fromDate.value = from
    toDate.value = to
    granularity.value = 'Day'
    await loadDetail()
})
```

to:

```ts
onMounted(async () => {
    applyPreset('today')
    granularity.value = 'Day'
    await loadDetail()
})
```

`currentMonthDateKeys` stays imported and used elsewhere in this file (`applyPreset`'s `'thisMonth'` branch), so its import does not change.

- [ ] **Step 3: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: exit code 0, no errors.

- [ ] **Step 4: Commit**

```bash
cd NDTCore.FE
git add src/modules/report/views/StoreRevenueDetailView.vue
git commit -m "fix: doi default preset Store Revenue Detail tu Thang nay sang Hom nay"
```

---

### Task 4: Manual verification on dev server

**Files:** None — this task only runs and observes the app.

**Interfaces:**
- Consumes: The committed results of Tasks 1-3.

- [ ] **Step 1: Start the dev server (skip if one is already running for this repo)**

Run: `cd NDTCore.FE && npm run dev`
Expected: Vite starts and serves on a local port without compile errors. If a dev server for this repo is already running (check with `curl -sf -o /dev/null http://localhost:5173 && echo RUNNING`), reuse it instead of starting a second instance.

- [ ] **Step 2: Verify Order List**

In the browser, open the Order List page (Đơn hàng):
1. On first load, the date-range button reads "Khoảng thời gian" (not a specific date), and the order list is not filtered by date.
2. Click the button, pick a range, click "Áp dụng" — button label updates to `dd/MM/yyyy - dd/MM/yyyy`.
3. Click "Tìm kiếm" — in the Network tab, confirm the request's `FromDate`/`ToDate` query params look like `...T00:00:00+07:00` / `...T23:59:59+07:00` (or whatever the browser's real UTC offset is), and the returned orders match the selected range.
4. Click "Xóa lọc" — button returns to "Khoảng thời gian" (not re-defaulted to today), and the list is no longer date-filtered.

Expected: All 4 steps behave as described, no console errors.

- [ ] **Step 3: Verify Store Revenue Detail**

In the browser, open any store's Store Revenue Detail page:
1. On first load, the preset toggle shows "Hôm nay" selected (not "Tháng này"), and the displayed data covers only today.

Expected: Step 1 behaves as described, no console errors.
