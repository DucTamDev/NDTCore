# Store Revenue Detail Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `StoreRevenueDetailView.vue` (header, filter bar, KPI cards, charts, table) and add a date-range preset feature (Hôm nay/Hôm qua/7 ngày/30 ngày/Tháng này/Tùy chỉnh) that doesn't exist yet.

**Architecture:** Pure FE change confined to the existing `report` module. No new files outside `utils`/`constants` additions; no API/composable/route changes. The new preset state (`datePreset`) lives in the view only — `fromDate`/`toDate` (already-existing refs) remain the single source of truth that `loadDetail`/`onExport` consume, so the fetch/export call sites never change.

**Tech Stack:** Vue 3 (Composition API) + TypeScript + Vuetify 3 + Chart.js/vue-chartjs (already installed, no new dependency). Vitest for the new pure-function tests (already configured, `npm run test:unit` / `npx vitest run`).

## Global Constraints

- Do not rename `loadDetail`, `onExport`, `fetchDetail`, `exportDetail`, `onFilterChange` — only call `onFilterChange()` from new preset handlers.
- No new npm dependency.
- Reuse `AppPageHeader`/`AppBreadcrumb`/`AppDataTable`/`AppEmptyState` — no copies.
- New date-preset utils go into the existing `NDTCore.FE/src/modules/report/utils/date-range.util.ts` — no new util file.
- `RevenueBucketViewModel`/`BucketGranularityDto` shapes do not change.
- Moving the export buttons out of `AppPageHeader` into a table toolbar is a **deliberate, scoped exception** for this one view only — do not propagate this pattern to `StoreRevenueListView.vue` or any other page.
- Spec reference: `docs/superpowers/specs/2026-06-30-store-revenue-detail-redesign-design.md`.

---

### Task 1: Date-range preset utility functions

**Files:**
- Modify: `NDTCore.FE/src/modules/report/utils/date-range.util.ts`
- Create: `NDTCore.FE/src/modules/report/utils/date-range.util.test.ts`

**Interfaces:**
- Consumes: existing `toDateKey(date: Date): string` (already in the file, local-date getters, no `toISOString()`).
- Produces (for Task 5 to consume):
  - `todayKey(): string`
  - `yesterdayKey(): string`
  - `last7DaysKeys(): [string, string]` — 7-day inclusive range ending today
  - `last30DaysKeys(): [string, string]` — 30-day inclusive range ending today

- [ ] **Step 1: Write the failing tests**

Create `NDTCore.FE/src/modules/report/utils/date-range.util.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { todayKey, yesterdayKey, last7DaysKeys, last30DaysKeys } from './date-range.util'

describe('date-range.util presets', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, 5, 30)) // June 30, 2026 (month is 0-indexed)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('todayKey returns the current local date', () => {
        expect(todayKey()).toBe('2026-06-30')
    })

    it('yesterdayKey rolls back across a month boundary correctly', () => {
        vi.setSystemTime(new Date(2026, 6, 1)) // July 1, 2026
        expect(yesterdayKey()).toBe('2026-06-30')
    })

    it('last7DaysKeys returns a 7-day inclusive range ending today', () => {
        expect(last7DaysKeys()).toEqual(['2026-06-24', '2026-06-30'])
    })

    it('last30DaysKeys returns a 30-day inclusive range ending today', () => {
        expect(last30DaysKeys()).toEqual(['2026-06-01', '2026-06-30'])
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/modules/report/utils/date-range.util.test.ts`
Expected: FAIL — `todayKey`/`yesterdayKey`/`last7DaysKeys`/`last30DaysKeys` are not exported from `./date-range.util` (TS2305 / import error).

- [ ] **Step 3: Implement the functions**

Append to `NDTCore.FE/src/modules/report/utils/date-range.util.ts` (after the existing `toRangeEnd` function, keep everything already in the file unchanged):

```ts
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/modules/report/utils/date-range.util.test.ts`
Expected: PASS — 4/4 tests passing.

- [ ] **Step 5: Type-check and commit**

Run: `npx vue-tsc --build` from `NDTCore.FE` — expect 0 errors.

```bash
git add src/modules/report/utils/date-range.util.ts src/modules/report/utils/date-range.util.test.ts
git commit -m "feat: add date-range preset utility functions"
```

---

### Task 2: `DatePreset` type + `DATE_PRESET_OPTIONS` constant

**Files:**
- Modify: `NDTCore.FE/src/modules/report/constants/store-revenue-detail.constants.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (for Task 5 to consume):
  - `export type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'custom'`
  - `export interface DatePresetOption { value: DatePreset; label: string }`
  - `export const DATE_PRESET_OPTIONS: DatePresetOption[]` — 6 entries, in this exact order: today, yesterday, last7, last30, thisMonth, custom.

- [ ] **Step 1: Add the type and constant**

Add to `NDTCore.FE/src/modules/report/constants/store-revenue-detail.constants.ts` (after the existing `GRANULARITY_TAB_OPTIONS` block, keep everything already in the file unchanged):

```ts
export type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'custom'

export interface DatePresetOption {
    value: DatePreset
    label: string
}

export const DATE_PRESET_OPTIONS: DatePresetOption[] = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'yesterday', label: 'Hôm qua' },
    { value: 'last7', label: '7 ngày gần nhất' },
    { value: 'last30', label: '30 ngày gần nhất' },
    { value: 'thisMonth', label: 'Tháng này' },
    { value: 'custom', label: 'Tùy chỉnh' },
]
```

- [ ] **Step 2: Type-check**

Run: `npx vue-tsc --build` from `NDTCore.FE` — expect 0 errors (this file has no consumers yet until Task 5, so it just needs to compile standalone).

- [ ] **Step 3: Commit**

```bash
git add src/modules/report/constants/store-revenue-detail.constants.ts
git commit -m "feat: add DatePreset type and DATE_PRESET_OPTIONS constant"
```

---

### Task 3: Chart colors via Vuetify theme tokens + dashed "previous period" line

**Files:**
- Modify: `NDTCore.FE/src/modules/report/components/RevenueTrendChart.vue`
- Modify: `NDTCore.FE/src/modules/report/components/RevenueOrderChart.vue`

**Interfaces:**
- Consumes: Vuetify's built-in `useTheme()` from the `vuetify` package (NOT the app's own `@/plugins/vuetify/theme` `useTheme()` — alias the import to avoid the name collision). `theme.current.value.colors.primary` and `theme.current.value.colors['on-surface-variant']` resolve to hex strings reactively for the active Vuetify theme (confirmed registered under the kebab-case key `'on-surface-variant'` in `NDTCore.FE/src/plugins/vuetify/build-colors.ts:42`).
- Produces: no change to the components' public props (`currentBuckets`/`previousBuckets` on `RevenueTrendChart`, `buckets` on `RevenueOrderChart` stay identical) — Task 5 doesn't need to change how it uses these components.

- [ ] **Step 1: Update `RevenueTrendChart.vue`**

Replace the `<script setup lang="ts">` block in `NDTCore.FE/src/modules/report/components/RevenueTrendChart.vue` (the `<script lang="ts">` block with `Chart.register(...)` above it stays unchanged):

```ts
<script setup lang="ts">
import { computed } from 'vue'
import { useTheme as useVuetifyTheme } from 'vuetify'
import { Line } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import type { RevenueBucketViewModel } from '@/modules/report/models/view-models/store-revenue.view-model'

interface Props {
    currentBuckets: RevenueBucketViewModel[]
    previousBuckets: RevenueBucketViewModel[]
}

const props = defineProps<Props>()

const vuetifyTheme = useVuetifyTheme()
const currentColor = computed(() => vuetifyTheme.current.value.colors.primary)
const previousColor = computed(() => vuetifyTheme.current.value.colors['on-surface-variant'])

function formatBucketLabel(bucketStart: string): string {
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(bucketStart))
}

const chartData = computed<ChartData<'line'>>(() => ({
    labels: props.currentBuckets.map((b) => formatBucketLabel(b.bucketStart)),
    datasets: [
        {
            label: 'Kỳ này',
            data: props.currentBuckets.map((b) => b.revenue),
            borderColor: currentColor.value,
            backgroundColor: currentColor.value,
            tension: 0.3,
        },
        {
            label: 'Kỳ trước',
            data: props.previousBuckets.map((b) => b.revenue),
            borderColor: previousColor.value,
            backgroundColor: previousColor.value,
            borderDash: [6, 4],
            tension: 0.3,
        },
    ],
}))

const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'top' },
    },
    scales: {
        y: { beginAtZero: true },
    },
}
</script>
```

- [ ] **Step 2: Update `RevenueOrderChart.vue`**

Replace the `<script setup lang="ts">` block in `NDTCore.FE/src/modules/report/components/RevenueOrderChart.vue` (the `<script lang="ts">` block with `Chart.register(...)` above it stays unchanged):

```ts
<script setup lang="ts">
import { computed } from 'vue'
import { useTheme as useVuetifyTheme } from 'vuetify'
import { Bar } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import type { RevenueBucketViewModel } from '@/modules/report/models/view-models/store-revenue.view-model'

interface Props {
    buckets: RevenueBucketViewModel[]
}

const props = defineProps<Props>()

const vuetifyTheme = useVuetifyTheme()
const barColor = computed(() => vuetifyTheme.current.value.colors.primary)

function formatBucketLabel(bucketStart: string): string {
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(bucketStart))
}

const chartData = computed<ChartData<'bar'>>(() => ({
    labels: props.buckets.map((b) => formatBucketLabel(b.bucketStart)),
    datasets: [
        {
            label: 'Số đơn',
            data: props.buckets.map((b) => b.orderCount),
            backgroundColor: barColor.value,
        },
    ],
}))

const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'top' },
    },
    scales: {
        y: { beginAtZero: true },
    },
}
</script>
```

- [ ] **Step 3: Type-check**

Run: `npx vue-tsc --build` from `NDTCore.FE` — expect 0 errors. (If `vuetify`'s `useTheme` import resolves to a different export shape than expected, check `node_modules/vuetify/lib/framework.mjs`'s `useTheme` return type — it must expose `.current` as a `Ref`/`ComputedRef` with a `.colors` record; this is Vuetify's documented public API and has been stable across 3.x.)

- [ ] **Step 4: Manual visual check**

Run `npm run dev`, navigate to a store's Detail page. Confirm: the "Kỳ trước" line in the trend chart is visibly dashed and a neutral gray (not the old hardcoded `#9E9E9E` — visually it may look similar since `on-surface-variant` is also a gray tone, but confirm it's now driven by the theme, e.g. by toggling dark mode if the app's theme switcher is reachable and observing the chart color change). "Kỳ này" line and the bar chart should render in the app's primary brand color.

- [ ] **Step 5: Commit**

```bash
git add src/modules/report/components/RevenueTrendChart.vue src/modules/report/components/RevenueOrderChart.vue
git commit -m "feat: use theme tokens and dashed line for revenue chart colors"
```

---

### Task 4: KPI Cards text style + explicit growth sign

**Files:**
- Modify: `NDTCore.FE/src/modules/report/components/RevenueKpiCards.vue`

**Interfaces:**
- Consumes: unchanged props (`detail: StoreRevenueDetailViewModel | null`, `loading: boolean`).
- Produces: no prop/interface change — Task 5 doesn't need to change how it uses `<RevenueKpiCards>`.

- [ ] **Step 1: Update the template's text classes**

In `NDTCore.FE/src/modules/report/components/RevenueKpiCards.vue`, change the `<template>` block's label/value classes (keep the `v-row`/`v-col`/`class="border"` layout exactly as-is — only the inner text classes change):

```html
<template>
    <v-row>
        <v-col v-for="card in cards" :key="card.label" cols="12" sm="6" md="3">
            <v-card rounded="lg" variant="flat" class="border">
                <v-card-text v-if="loading">
                    <v-skeleton-loader type="text" width="60%" />
                    <v-skeleton-loader type="heading" class="mt-2" />
                </v-card-text>

                <v-card-text v-else>
                    <div class="text-caption text-medium-emphasis">{{ card.label }}</div>
                    <div class="d-flex align-center ga-2 mt-1">
                        <v-icon v-if="card.icon" :icon="card.icon" :color="card.color" size="20" />
                        <span class="text-h5 font-weight-medium" :class="card.color ? `text-${card.color}` : undefined">{{ card.value }}</span>
                    </div>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>
</template>
```

- [ ] **Step 2: Add the explicit `+`/`−` sign to the growth value**

In the same file's `<script setup lang="ts">`, replace `formatGrowth`:

```ts
function formatGrowth(growthPercent: number | null): { value: string; icon?: string; color?: 'success' | 'error' } {
    if (growthPercent === null) {
        return { value: '—' }
    }
    if (growthPercent > 0) {
        return { value: `+${growthPercent.toFixed(1)}%`, icon: 'mdi-arrow-up', color: 'success' }
    }
    if (growthPercent < 0) {
        return { value: `−${Math.abs(growthPercent).toFixed(1)}%`, icon: 'mdi-arrow-down', color: 'error' }
    }
    return { value: `${growthPercent.toFixed(1)}%` }
}
```

(Uses the U+2212 minus sign `−`, not a hyphen, for the negative case — `Math.abs` avoids a double-negative like `--5.0%` since `toFixed` on a negative number already includes a leading `-`.)

- [ ] **Step 3: Type-check**

Run: `npx vue-tsc --build` from `NDTCore.FE` — expect 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/report/components/RevenueKpiCards.vue
git commit -m "feat: restyle KPI card text and add explicit growth sign"
```

---

### Task 5: `StoreRevenueDetailView.vue` — header time-range display + date preset filter bar

**Files:**
- Modify: `NDTCore.FE/src/modules/report/views/StoreRevenueDetailView.vue`

**Interfaces:**
- Consumes:
  - Task 1's `todayKey`, `yesterdayKey`, `last7DaysKeys`, `last30DaysKeys` (plus the already-existing `toDateKey`, `currentMonthDateKeys`, `toRangeStart`, `toRangeEnd`).
  - Task 2's `DatePreset` type and `DATE_PRESET_OPTIONS` constant.
- Produces: no change to `loadDetail`/`onFilterChange`/`fetchDetail`'s signatures — Task 6 (which touches the export buttons in the same file) builds on top of this task's output.

This task replaces the existing header info card and filter card. It does NOT touch the KPI cards row, the charts row, or the `AppPageHeader`/export-button block — those are Task 6's concern (export buttons) and already-done Tasks 3/4 (charts/KPI internals, no caller-side change needed).

- [ ] **Step 1: Replace the header info card and filter card in the template**

In `NDTCore.FE/src/modules/report/views/StoreRevenueDetailView.vue`, replace the two `<v-card rounded="lg">` blocks that currently contain the Store info and the granularity/date filter (everything between the closing `</AppPageHeader>` and the `<RevenueKpiCards ...>` line) with:

```html
        <v-card rounded="lg">
            <v-card-text class="d-flex flex-wrap justify-space-between ga-6">
                <div class="d-flex flex-wrap ga-6">
                    <div>
                        <div class="text-caption text-medium-emphasis">Cửa hàng</div>
                        <div>{{ detail?.storeName ?? '—' }}</div>
                    </div>
                    <div>
                        <div class="text-caption text-medium-emphasis">Mã cửa hàng</div>
                        <div>{{ detail?.storeCode ?? '—' }}</div>
                    </div>
                    <div>
                        <div class="text-caption text-medium-emphasis">Franchisee</div>
                        <div>{{ detail?.franchiseeName ?? '—' }}</div>
                    </div>
                    <div>
                        <div class="text-caption text-medium-emphasis">Brand</div>
                        <div>{{ detail?.brandName ?? '—' }}</div>
                    </div>
                </div>
                <div class="text-body-2 text-medium-emphasis align-self-end">
                    {{ fromDate && toDate ? `${formatBucketLabel(fromDate)} – ${formatBucketLabel(toDate)}` : '—' }}
                </div>
            </v-card-text>
        </v-card>

        <v-card rounded="lg">
            <v-card-text class="d-flex flex-wrap align-center ga-4 border-b">
                <v-btn-toggle
                    :model-value="datePreset"
                    mandatory
                    density="compact"
                    color="primary"
                    @update:model-value="onPresetToggle"
                >
                    <v-btn
                        v-for="option in DATE_PRESET_OPTIONS.filter((o) => o.value !== 'custom')"
                        :key="option.value"
                        :value="option.value"
                        class="text-none"
                    >
                        {{ option.label }}
                    </v-btn>
                    <v-btn value="custom" class="text-none">
                        {{ customRangeLabel || 'Tùy chỉnh' }}
                        <v-menu
                            v-model="isCustomMenuOpen"
                            activator="parent"
                            location="bottom end"
                            :close-on-content-click="false"
                            @update:model-value="onCustomMenuToggle"
                        >
                            <v-card min-width="280">
                                <v-card-text class="d-flex flex-column ga-3">
                                    <div class="text-caption font-weight-medium">Chọn khoảng thời gian</div>
                                    <v-text-field
                                        v-model="draftFromDate"
                                        label="Từ ngày"
                                        type="date"
                                        :max="maxDate"
                                        density="compact"
                                        hide-details="auto"
                                    />
                                    <v-text-field
                                        v-model="draftToDate"
                                        label="Đến ngày"
                                        type="date"
                                        :max="maxDate"
                                        density="compact"
                                        hide-details="auto"
                                    />
                                    <div class="text-caption text-error" style="min-height: 20px">
                                        {{ customRangeError }}
                                    </div>
                                    <div class="d-flex justify-end ga-2">
                                        <v-btn variant="text" @click="cancelCustomRange">Hủy</v-btn>
                                        <v-btn variant="flat" color="primary" @click="applyCustomRange">Áp dụng</v-btn>
                                    </div>
                                </v-card-text>
                            </v-card>
                        </v-menu>
                    </v-btn>
                </v-btn-toggle>

                <v-spacer />

                <v-tabs v-model="granularity" color="primary" density="compact" @update:model-value="onFilterChange">
                    <v-tab v-for="option in GRANULARITY_TAB_OPTIONS" :key="option.value" :value="option.value" class="text-none">
                        {{ option.label }}
                    </v-tab>
                </v-tabs>
            </v-card-text>
        </v-card>
```

(Note: the granularity tabs moved from the left side to the right side of this card, and the preset toggle takes the left side where the 2 raw date fields used to be — the 2 raw date fields are no longer rendered directly in the main layout; they only appear inside the "Tùy chỉnh" popup, per the spec. The header's time-range display reuses the `formatBucketLabel(bucketStart: string): string` function that already exists, unchanged, further down in this same file's `<script setup>` — do not write a new formatter. It's guarded with `fromDate && toDate ?` because `fromDate`/`toDate` are empty strings before `onMounted` runs its first `loadDetail()`, and `formatBucketLabel('')` would call `new Date('')` → `Invalid Date` → `Intl.DateTimeFormat.format()` can throw on some engines for an invalid date.)

- [ ] **Step 2: Update the `<script setup lang="ts">` imports**

In the same file, replace the import block:

```ts
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { AppBreadcrumb, AppPageHeader, AppDataTable, AppEmptyState } from '@/components/ui'
import { APP_ROUTES } from '@/core/constants/_index'
import { downloadBlob } from '@/core/utils/download.util'
import { useStoreRevenueDetail } from '@/modules/report/composables/useStoreRevenueDetail'
import {
    STORE_REVENUE_BUCKET_COLUMNS,
    GRANULARITY_TAB_OPTIONS,
    DATE_PRESET_OPTIONS,
    type DatePreset,
} from '@/modules/report/constants/store-revenue-detail.constants'
import RevenueKpiCards from '@/modules/report/components/RevenueKpiCards.vue'
import RevenueTrendChart from '@/modules/report/components/RevenueTrendChart.vue'
import RevenueOrderChart from '@/modules/report/components/RevenueOrderChart.vue'
import type { RevenueBucketViewModel } from '@/modules/report/models/view-models/store-revenue.view-model'
import type { BucketGranularityDto } from '@/modules/report/models/dtos/store-revenue.dto'
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

- [ ] **Step 3: Add the new state and preset/custom-range logic**

In the same file's `<script setup lang="ts">`, after the existing `const fromDate = ref('')` / `const toDate = ref('')` lines, add:

```ts
const datePreset = ref<DatePreset>('thisMonth')
const isCustomMenuOpen = ref(false)
const draftFromDate = ref('')
const draftToDate = ref('')
const customRangeError = ref('')
const customRangeLabel = ref('')

const maxDate = computed(() => todayKey())

function applyPreset(preset: DatePreset): void {
    if (preset === 'today') {
        const key = todayKey()
        fromDate.value = key
        toDate.value = key
    } else if (preset === 'yesterday') {
        const key = yesterdayKey()
        fromDate.value = key
        toDate.value = key
    } else if (preset === 'last7') {
        const [from, to] = last7DaysKeys()
        fromDate.value = from
        toDate.value = to
    } else if (preset === 'last30') {
        const [from, to] = last30DaysKeys()
        fromDate.value = from
        toDate.value = to
    } else if (preset === 'thisMonth') {
        const [from, to] = currentMonthDateKeys()
        fromDate.value = from
        toDate.value = to
    }
    datePreset.value = preset
}

async function onPresetToggle(preset: DatePreset | null): Promise<void> {
    if (preset === null || preset === 'custom') return
    applyPreset(preset)
    await onFilterChange()
}

function onCustomMenuToggle(isOpen: boolean): void {
    if (isOpen) {
        draftFromDate.value = fromDate.value
        draftToDate.value = toDate.value
        customRangeError.value = ''
    }
}

function cancelCustomRange(): void {
    isCustomMenuOpen.value = false
}

async function applyCustomRange(): Promise<void> {
    if (draftFromDate.value > draftToDate.value) {
        customRangeError.value = 'Từ ngày phải nhỏ hơn hoặc bằng đến ngày.'
        return
    }
    customRangeError.value = ''
    fromDate.value = draftFromDate.value
    toDate.value = draftToDate.value
    datePreset.value = 'custom'
    customRangeLabel.value = `${formatBucketLabel(fromDate.value)} – ${formatBucketLabel(toDate.value)}`
    isCustomMenuOpen.value = false
    await onFilterChange()
}
```

(`onPresetToggle`'s no-op on `'custom'` is intentional: clicking the "Tùy chỉnh" button only opens its `v-menu` via `activator="parent"` — `datePreset` only changes to `'custom'` inside `applyCustomRange`, after validation passes. `v-btn-toggle` is bound one-way (`:model-value`, not `v-model`), so it never auto-switches to "custom" just from the click — it stays showing whatever `datePreset` actually is until `applyCustomRange` updates it.)

- [ ] **Step 4: Confirm `onMounted` needs no change**

This view's existing `onMounted` block already sets the default range via `currentMonthDateKeys()` — no edit needed here, since `datePreset` is already initialized to `'thisMonth'` by its `ref<DatePreset>('thisMonth')` declaration in Step 3, matching the default `onMounted` range. Just confirm the existing block (already in the file, unchanged) still reads exactly as follows after Steps 1–3:

```ts
onMounted(async () => {
    const [from, to] = currentMonthDateKeys()
    fromDate.value = from
    toDate.value = to
    granularity.value = 'Day'
    await loadDetail()
})
```

- [ ] **Step 5: Type-check**

Run: `npx vue-tsc --build` from `NDTCore.FE` — expect 0 errors.

- [ ] **Step 6: Manual check**

Run `npm run dev`, open a store's Detail page. Confirm:
- On load, "Tháng này" preset shows as active/pressed in the toggle, and the header card shows the current month's date range.
- Clicking "Hôm nay"/"Hôm qua"/"7 ngày gần nhất"/"30 ngày gần nhất" each re-fetches and updates the displayed range text.
- Clicking "Tùy chỉnh" opens a popup with the 2 date inputs pre-filled with the currently active range.
- Setting `from > to` and clicking "Áp dụng" shows the inline error and keeps the popup open.
- Setting a valid range and clicking "Áp dụng" closes the popup, updates the "Tùy chỉnh" button's label to the short range text, makes it the active/pressed toggle button, and re-fetches data.
- Clicking "Hủy" (or clicking outside, or Esc) after editing the dates without applying discards the edit — reopening "Tùy chỉnh" shows the previously-applied range, not the discarded edit.

- [ ] **Step 7: Commit**

```bash
git add src/modules/report/views/StoreRevenueDetailView.vue
git commit -m "feat: add date range presets and time-range display to store revenue detail"
```

---

### Task 6: `StoreRevenueDetailView.vue` — move export buttons to a table toolbar

**Files:**
- Modify: `NDTCore.FE/src/modules/report/views/StoreRevenueDetailView.vue`

**Interfaces:**
- Consumes: the existing `onExport(format: 'excel' | 'csv'): Promise<void>` and `exporting: Ref<boolean>` (both already defined in this file's script — unchanged by this task).
- Produces: nothing new for later tasks (this is the last task in the plan).

- [ ] **Step 1: Remove the 2 export buttons from `AppPageHeader`**

In `NDTCore.FE/src/modules/report/views/StoreRevenueDetailView.vue`, change the `<AppPageHeader>` block from:

```html
        <AppPageHeader
            :title="detail ? `Doanh thu - ${detail.storeName}` : 'Doanh thu cửa hàng'"
            subtitle="Chi tiết doanh thu cửa hàng"
        >
            <template #breadcrumb>
                <AppBreadcrumb
                    :items="[
                        { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                        {
                            title: 'Doanh thu',
                            to: `/${APP_ROUTES.ADMIN.BASE.PATH}/${APP_ROUTES.ADMIN.CHILDREN.REPORTS_STORE_REVENUE.PATH}`,
                        },
                        { title: detail?.storeName ?? '...', disabled: true },
                    ]"
                />
            </template>

            <v-btn
                variant="outlined"
                prepend-icon="mdi-file-excel-outline"
                :loading="exporting"
                @click="onExport('excel')"
            >
                Xuất Excel
            </v-btn>
            <v-btn
                variant="outlined"
                prepend-icon="mdi-file-delimited-outline"
                :loading="exporting"
                @click="onExport('csv')"
            >
                Xuất CSV
            </v-btn>
        </AppPageHeader>
```

to:

```html
        <AppPageHeader
            :title="detail ? `Doanh thu - ${detail.storeName}` : 'Doanh thu cửa hàng'"
            subtitle="Chi tiết doanh thu cửa hàng"
        >
            <template #breadcrumb>
                <AppBreadcrumb
                    :items="[
                        { title: 'Dashboard', to: APP_ROUTES.ADMIN.BASE.PATH },
                        {
                            title: 'Doanh thu',
                            to: `/${APP_ROUTES.ADMIN.BASE.PATH}/${APP_ROUTES.ADMIN.CHILDREN.REPORTS_STORE_REVENUE.PATH}`,
                        },
                        { title: detail?.storeName ?? '...', disabled: true },
                    ]"
                />
            </template>
        </AppPageHeader>
```

(The default slot is now empty, so it's removed entirely — `AppPageHeader.vue:14` only renders its action-button area when `$slots.default` exists, so omitting the slot content is correct and doesn't leave a stray empty row.)

- [ ] **Step 2: Add a table toolbar with the 2 export buttons above `AppDataTable`**

Change the bucket-table `<v-card rounded="lg">` block from:

```html
        <v-card rounded="lg">
            <AppDataTable
```

to:

```html
        <v-card rounded="lg">
            <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
                <span class="text-body-1 font-weight-bold">Bảng chi tiết</span>
                <div class="d-flex ga-2">
                    <v-btn
                        variant="outlined"
                        prepend-icon="mdi-file-excel-outline"
                        :loading="exporting"
                        @click="onExport('excel')"
                    >
                        Xuất Excel
                    </v-btn>
                    <v-btn
                        variant="outlined"
                        prepend-icon="mdi-file-delimited-outline"
                        :loading="exporting"
                        @click="onExport('csv')"
                    >
                        Xuất CSV
                    </v-btn>
                </div>
            </v-card-title>
            <AppDataTable
```

(The rest of that `<v-card>` block — `:items`, `:columns`, the `#item.*` slots, the `#empty` slot, and the closing `</AppDataTable></v-card>` tags — stays exactly as it already is; only the opening is changed to insert the `<v-card-title>` toolbar.)

- [ ] **Step 3: Type-check**

Run: `npx vue-tsc --build` from `NDTCore.FE` — expect 0 errors.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open a store's Detail page. Confirm: `AppPageHeader` now shows only the title/breadcrumb (no buttons), and "Xuất Excel"/"Xuất CSV" buttons appear in a toolbar row directly above the bucket table, right-aligned, and still trigger a real file download when clicked (same behavior as before, just relocated).

- [ ] **Step 5: Commit**

```bash
git add src/modules/report/views/StoreRevenueDetailView.vue
git commit -m "feat: move export buttons from page header to table toolbar"
```

---

## Self-Review Notes (for the plan author, already applied above)

- **Spec coverage:** Section 2 (header time-range) → Task 5 Step 1. Section 3 (presets + custom popup, including the draft-ref revert-on-cancel subtlety from spec §3.6) → Task 5 Steps 1–3. Section 4 (KPI text/sign, no grid change) → Task 4. Section 5 (chart dash + token colors) → Task 3. Section 6 (export button relocation, deliberate exception) → Task 6. Section 7 constraints (no renamed functions, no new deps, reused components, util location, unchanged ViewModel shapes) → honored throughout; verified by grep-checking the current file contents before writing each task's diff.
- **Type consistency:** `DatePreset` defined once in Task 2, imported and used identically in Task 5 (`ref<DatePreset>`, `applyPreset(preset: DatePreset)`, `onPresetToggle(preset: DatePreset | null)`). `last7DaysKeys`/`last30DaysKeys` return `[string, string]` in Task 1 and are destructured identically (`const [from, to] = ...`) in Task 5.
- **No placeholders:** every step shows complete, copy-pasteable code — no "add validation" or "similar to Task N" placeholders.
