# Store Revenue DateRange Scope Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Store Revenue List no longer filters by date at all — always shows all-time revenue per store, requiring the backend's `From`/`To` to become optional. (2) Store Revenue Detail replaces its "Tùy chỉnh" toggle-button-with-two-date-inputs with a standalone "Khoảng Thời gian" button using the same `v-date-picker`-range UI already built for Order List. (3) That UI (button + menu + range picker + Hủy/Áp dụng) is extracted from `AppDataFilter.vue` into a shared `AppDateRangeMenu.vue` component so both places can use it.

**Architecture:** BE change first (nullable `From`/`To` on the List-only filter DTO, conditional `WHERE` clauses) since FE List depends on the backend accepting no date bound. Then FE: extract the shared component (pure refactor, no behavior change — verified by Order List and Store Revenue List still working identically through `AppDataFilter.vue`), then remove the List page's date filter entirely, then wire the Detail page's new standalone button on top of the now-available shared component.

**Tech Stack:** .NET 8 + EF Core (BE) — Vue 3 (Composition API) + TypeScript strict + Vuetify 3 (FE).

## Global Constraints

- BE: XML doc bắt buộc song ngữ VN/EN cho mọi class/interface/method/property, kể cả private.
- BE: Trước khi commit, `dotnet build NDTCore.sln` phải sạch.
- FE: TypeScript strict, không dùng `any`.
- FE: Không viết comment giải thích WHAT — chỉ viết khi WHY không rõ.
- FE: Trước khi commit, `npx vue-tsc --build` phải sạch.
- Chỉ `StoreRevenueFilterDto`/List query đổi nullable — `StoreRevenueDetailFilterDto`/Detail giữ nguyên bắt buộc `From`/`To` không đổi.
- Contract format ngày gửi BE không đổi (`YYYY-MM-DDTHH:mm:ss±HH:mm`, qua `toRangeStart`/`toRangeEnd` từ `@/core/utils/date-range.util`).

---

### Task 1: BE — Cho phép `From`/`To` tùy chọn ở Store Revenue List

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Report/NDTCore.Report.Contracts/Models/StoreRevenueFilterDto.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Report/NDTCore.Report.Application/Features/StoreRevenue/GetStoreRevenueList/GetStoreRevenueListQueryValidator.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Contracts/Interfaces/Services/IOrderRevenueReportService.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Services/OrderRevenueReportService.cs`
- Modify: `NDTCore.BE/src/NDTCore.API/Controllers/Modules/Report/Admin/ReportController.cs` (chỉ XML doc)

**Interfaces:**
- Produces: `StoreRevenueFilterDto.From`/`To` kiểu `DateTimeOffset?`; `IOrderRevenueReportService.GetRevenueByStoreAsync(IReadOnlyCollection<int> storeIds, DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct = default)`. Tiêu thụ bởi Task 3 (FE List gửi `From: null, To: null`).
- Không đổi: `GetRevenueBucketsAsync`, `StoreRevenueDetailFilterDto`, `GetStoreRevenueDetailQuery*` — Detail vẫn bắt buộc `From`/`To`.

- [ ] **Step 1: Đổi `StoreRevenueFilterDto.From`/`To` sang nullable**

Thay toàn bộ nội dung `NDTCore.BE/src/NDTCore.Modules/NDTCore.Report/NDTCore.Report.Contracts/Models/StoreRevenueFilterDto.cs`:

```csharp
using NDTCore.BuildingBlocks.Abstractions.Requests;

namespace NDTCore.Report.Contracts.Models;

/// <summary>
/// VN: Tham số lọc dùng để truy vấn danh sách báo cáo doanh thu store, kèm thông tin phân trang kế thừa từ <see cref="PagedRequest"/>. <br />
/// EN: Filter parameters used to query the store revenue report list, including paging information inherited from <see cref="PagedRequest"/>.
/// </summary>
public sealed class StoreRevenueFilterDto : PagedRequest
{
    /// <summary>
    /// VN: Lấy hoặc đặt thời điểm bắt đầu của khoảng thời gian báo cáo; <see langword="null"/> nếu không giới hạn. <br />
    /// EN: Gets or sets the start of the report's date range; <see langword="null"/> if unbounded.
    /// </summary>
    public DateTimeOffset? From { get; set; }

    /// <summary>
    /// VN: Lấy hoặc đặt thời điểm kết thúc của khoảng thời gian báo cáo; <see langword="null"/> nếu không giới hạn. <br />
    /// EN: Gets or sets the end of the report's date range; <see langword="null"/> if unbounded.
    /// </summary>
    public DateTimeOffset? To { get; set; }
}
```

- [ ] **Step 2: Guard validation `To >= From` chỉ khi cả 2 có giá trị**

Trong `NDTCore.BE/src/NDTCore.Modules/NDTCore.Report/NDTCore.Report.Application/Features/StoreRevenue/GetStoreRevenueList/GetStoreRevenueListQueryValidator.cs`, tìm:

```csharp
        RuleFor(x => x.Filter.To)
            .GreaterThanOrEqualTo(x => x.Filter.From)
            .WithMessage("To must be greater than or equal to From.");
```

Thay bằng:

```csharp
        RuleFor(x => x.Filter.To)
            .GreaterThanOrEqualTo(x => x.Filter.From)
            .When(x => x.Filter.From.HasValue && x.Filter.To.HasValue)
            .WithMessage("To must be greater than or equal to From.");
```

- [ ] **Step 3: Đổi signature `IOrderRevenueReportService.GetRevenueByStoreAsync` sang nullable**

Trong `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Contracts/Interfaces/Services/IOrderRevenueReportService.cs`, tìm:

```csharp
    /// <summary>
    /// VN: Lấy doanh thu tổng hợp theo từng cửa hàng trong khoảng thời gian. <br />
    /// EN: Retrieves aggregated revenue by store for a given time range.
    /// </summary>
    /// <param name="storeIds">VN: Danh sách ID cửa hàng. <br /> EN: List of store IDs.</param>
    /// <param name="from">VN: Ngày bắt đầu (bao gồm). <br /> EN: Start date (inclusive).</param>
    /// <param name="to">VN: Ngày kết thúc (bao gồm). <br /> EN: End date (inclusive).</param>
    /// <param name="cancellationToken">VN: Token để hủy tác vụ. <br /> EN: Token to cancel the operation.</param>
    /// <returns>VN: Danh sách các aggregate doanh thu theo cửa hàng. <br /> EN: List of store revenue aggregates.</returns>
    Task<IReadOnlyList<StoreRevenueAggregate>> GetRevenueByStoreAsync(
        IReadOnlyCollection<int> storeIds, DateTimeOffset from, DateTimeOffset to,
        CancellationToken cancellationToken = default);
```

Thay bằng:

```csharp
    /// <summary>
    /// VN: Lấy doanh thu tổng hợp theo từng cửa hàng trong khoảng thời gian. <br />
    /// EN: Retrieves aggregated revenue by store for a given time range.
    /// </summary>
    /// <param name="storeIds">VN: Danh sách ID cửa hàng. <br /> EN: List of store IDs.</param>
    /// <param name="from">VN: Ngày bắt đầu (bao gồm); <see langword="null"/> nếu không giới hạn. <br /> EN: Start date (inclusive); <see langword="null"/> if unbounded.</param>
    /// <param name="to">VN: Ngày kết thúc (bao gồm); <see langword="null"/> nếu không giới hạn. <br /> EN: End date (inclusive); <see langword="null"/> if unbounded.</param>
    /// <param name="cancellationToken">VN: Token để hủy tác vụ. <br /> EN: Token to cancel the operation.</param>
    /// <returns>VN: Danh sách các aggregate doanh thu theo cửa hàng. <br /> EN: List of store revenue aggregates.</returns>
    Task<IReadOnlyList<StoreRevenueAggregate>> GetRevenueByStoreAsync(
        IReadOnlyCollection<int> storeIds, DateTimeOffset? from, DateTimeOffset? to,
        CancellationToken cancellationToken = default);
```

Không đổi `GetRevenueBucketsAsync` trong cùng file — chỉ đổi `GetRevenueByStoreAsync`.

- [ ] **Step 4: Implement conditional filtering trong `OrderRevenueReportService.GetRevenueByStoreAsync`**

Trong `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Services/OrderRevenueReportService.cs`, tìm:

```csharp
    /// <inheritdoc/>
    /// <remarks>
    /// VN: Cửa hàng không có đơn hàng phù hợp sẽ không xuất hiện trong kết quả trả về —
    /// caller (handler ở tầng trên) chịu trách nhiệm left-join với danh sách cửa hàng đầy đủ
    /// và gán mặc định Revenue=0, OrderCount=0 cho các cửa hàng bị thiếu. <br />
    /// EN: Stores with no matching orders are simply absent from the returned list — the caller
    /// (an upper-layer handler) is responsible for left-joining against the full store list and
    /// defaulting missing entries to Revenue=0, OrderCount=0.
    /// </remarks>
    public async Task<IReadOnlyList<StoreRevenueAggregate>> GetRevenueByStoreAsync(
        IReadOnlyCollection<int> storeIds, DateTimeOffset from, DateTimeOffset to,
        CancellationToken cancellationToken = default)
    {
        _logger.LogDebug(
            "[{ClassName}.{FunctionName}] Aggregating revenue by store: StoreCount={StoreCount}, From={From}, To={To}",
            nameof(OrderRevenueReportService),
            nameof(GetRevenueByStoreAsync),
            storeIds.Count,
            from,
            to);

        return await _context.Orders.AsNoTracking()
            .Where(o => storeIds.Contains(o.StoreId) && o.Status == OrderStatus.Completed
                        && o.CreatedAt >= from && o.CreatedAt <= to)
            .GroupBy(o => o.StoreId)
            .Select(g => new StoreRevenueAggregate(g.Key, g.Sum(o => o.TotalAmount), g.Count()))
            .ToListAsync(cancellationToken);
    }
```

Thay bằng:

```csharp
    /// <inheritdoc/>
    /// <remarks>
    /// VN: Cửa hàng không có đơn hàng phù hợp sẽ không xuất hiện trong kết quả trả về —
    /// caller (handler ở tầng trên) chịu trách nhiệm left-join với danh sách cửa hàng đầy đủ
    /// và gán mặc định Revenue=0, OrderCount=0 cho các cửa hàng bị thiếu. <br />
    /// EN: Stores with no matching orders are simply absent from the returned list — the caller
    /// (an upper-layer handler) is responsible for left-joining against the full store list and
    /// defaulting missing entries to Revenue=0, OrderCount=0.
    /// </remarks>
    public async Task<IReadOnlyList<StoreRevenueAggregate>> GetRevenueByStoreAsync(
        IReadOnlyCollection<int> storeIds, DateTimeOffset? from, DateTimeOffset? to,
        CancellationToken cancellationToken = default)
    {
        _logger.LogDebug(
            "[{ClassName}.{FunctionName}] Aggregating revenue by store: StoreCount={StoreCount}, From={From}, To={To}",
            nameof(OrderRevenueReportService),
            nameof(GetRevenueByStoreAsync),
            storeIds.Count,
            from,
            to);

        var query = _context.Orders.AsNoTracking()
            .Where(o => storeIds.Contains(o.StoreId) && o.Status == OrderStatus.Completed);

        if (from.HasValue)
            query = query.Where(o => o.CreatedAt >= from.Value);

        if (to.HasValue)
            query = query.Where(o => o.CreatedAt <= to.Value);

        return await query
            .GroupBy(o => o.StoreId)
            .Select(g => new StoreRevenueAggregate(g.Key, g.Sum(o => o.TotalAmount), g.Count()))
            .ToListAsync(cancellationToken);
    }
```

Không đổi `GetRevenueBucketsAsync` trong cùng file.

- [ ] **Step 5: Cập nhật XML doc ở `ReportController.cs` (không đổi logic)**

Trong `NDTCore.BE/src/NDTCore.API/Controllers/Modules/Report/Admin/ReportController.cs`, tìm đoạn doc của `GetStoreRevenueList`:

```csharp
    /// <param name="filter">
    /// VN: Tham số lọc (từ, đến, pageNumber, pageSize). <br />
    /// EN: Filter parameters (from, to, pageNumber, pageSize).
    /// </param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>
    /// VN: Trả về 200 OK chứa PagedApiResponse với danh sách doanh thu store; 400 nếu từ > đến; 403 nếu không có quyền; 5xx nếu lỗi server. <br />
    /// EN: Returns 200 OK with PagedApiResponse containing store revenue list; 400 if from > to; 403 if unauthorized; 5xx on server error.
    /// </returns>
    [HttpGet]
    public async Task<IActionResult> GetStoreRevenueList(
```

Thay bằng:

```csharp
    /// <param name="filter">
    /// VN: Tham số lọc (từ, đến, pageNumber, pageSize). From/To là tùy chọn — bỏ trống nếu không muốn giới hạn theo thời gian. <br />
    /// EN: Filter parameters (from, to, pageNumber, pageSize). From/To are optional — omit them to return all-time data.
    /// </param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>
    /// VN: Trả về 200 OK chứa PagedApiResponse với danh sách doanh thu store; 400 nếu từ > đến; 403 nếu không có quyền; 5xx nếu lỗi server. <br />
    /// EN: Returns 200 OK with PagedApiResponse containing store revenue list; 400 if from > to; 403 if unauthorized; 5xx on server error.
    /// </returns>
    [HttpGet]
    public async Task<IActionResult> GetStoreRevenueList(
```

Tìm đoạn doc của `ExportStoreRevenueList`:

```csharp
    /// <param name="filter">
    /// VN: Tham số lọc và sắp xếp (pageNumber/pageSize của filter bị bỏ qua — luôn xuất toàn bộ tập dữ liệu). <br />
    /// EN: Filter and sort parameters (the filter's pageNumber/pageSize are ignored — the full data set is always exported).
    /// </param>
```

(đây là doc của method `ExportStoreRevenueList`, ngay trước `[HttpGet("export")]`) — thay bằng:

```csharp
    /// <param name="filter">
    /// VN: Tham số lọc và sắp xếp (pageNumber/pageSize của filter bị bỏ qua — luôn xuất toàn bộ tập dữ liệu). From/To là tùy chọn — bỏ trống nếu không muốn giới hạn theo thời gian. <br />
    /// EN: Filter and sort parameters (the filter's pageNumber/pageSize are ignored — the full data set is always exported). From/To are optional — omit them to return all-time data.
    /// </param>
```

Không đổi method body nào trong file này.

- [ ] **Step 6: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 7: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Report/NDTCore.Report.Contracts/Models/StoreRevenueFilterDto.cs src/NDTCore.Modules/NDTCore.Report/NDTCore.Report.Application/Features/StoreRevenue/GetStoreRevenueList/GetStoreRevenueListQueryValidator.cs src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Contracts/Interfaces/Services/IOrderRevenueReportService.cs src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Services/OrderRevenueReportService.cs src/NDTCore.API/Controllers/Modules/Report/Admin/ReportController.cs
git commit -m "feat: cho phep From/To tuy chon o Store Revenue List de tra ve doanh thu all-time"
```

---

### Task 2: FE — Tách `AppDateRangeMenu.vue` thành component dùng chung

**Files:**
- Create: `NDTCore.FE/src/components/ui/components/AppDateRangeMenu.vue`
- Modify: `NDTCore.FE/src/components/ui/index.ts`
- Modify: `NDTCore.FE/src/components/ui/components/AppDataFilter.vue`

**Interfaces:**
- Produces: `AppDateRangeMenu` component — Props `{ modelValue: [string, string] | null; label: string }`, Emits `{ 'update:modelValue': [value: [string, string] | null] }`. Tiêu thụ bởi Task 4 (Store Revenue Detail).
- Consumes: Không có gì từ Task 1 — hoàn toàn độc lập với BE.

- [ ] **Step 1: Tạo `AppDateRangeMenu.vue`**

Tạo file `NDTCore.FE/src/components/ui/components/AppDateRangeMenu.vue`:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  modelValue: [string, string] | null
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: [string, string] | null]
}>()

const menuOpen = ref(false)
const draftDates = ref<Date[]>([])

function parseDateKey(key: string): Date {
  const parts = key.split('-').map(Number)
  return new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1)
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

const displayLabel = computed(() => {
  const val = props.modelValue
  return val?.[0] && val?.[1] ? `${formatDmy(val[0])} - ${formatDmy(val[1])}` : props.label
})

function onMenuUpdate(isOpen: boolean): void {
  menuOpen.value = isOpen
  if (isOpen) {
    const val = props.modelValue
    draftDates.value = val?.[0] && val?.[1] ? [parseDateKey(val[0]), parseDateKey(val[1])] : []
  }
}

function onDraftDatesChange(value: Date[]): void {
  draftDates.value = value
}

function apply(): void {
  const dates = [...draftDates.value].sort((a, b) => a.getTime() - b.getTime())
  const [first, last] = [dates[0], dates[dates.length - 1]]
  emit('update:modelValue', first && last ? [toDateKey(first), toDateKey(last)] : null)
  menuOpen.value = false
}

function cancel(): void {
  menuOpen.value = false
}
</script>

<template>
  <v-btn
    variant="outlined"
    prepend-icon="mdi-calendar-range"
    class="text-none align-self-center"
    style="min-width: 220px; flex: 0 0 auto"
    height="40"
  >
    {{ displayLabel }}
    <v-menu
      :model-value="menuOpen"
      activator="parent"
      location="bottom start"
      :close-on-content-click="false"
      @update:model-value="onMenuUpdate"
    >
      <v-card min-width="300" border="sm">
        <v-date-picker
          :model-value="draftDates"
          :multiple="'range'"
          hide-header
          show-adjacent-months
          @update:model-value="onDraftDatesChange"
        />
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="cancel">Hủy</v-btn>
          <v-btn variant="flat" color="primary" @click="apply">Áp dụng</v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>
  </v-btn>
</template>
```

- [ ] **Step 2: Export component qua barrel**

Trong `NDTCore.FE/src/components/ui/index.ts`, tìm dòng:

```ts
export { default as AppDataFilter } from './components/AppDataFilter.vue'
```

Thêm ngay sau dòng đó:

```ts
export { default as AppDateRangeMenu } from './components/AppDateRangeMenu.vue'
```

- [ ] **Step 3: `AppDataFilter.vue` dùng lại `AppDateRangeMenu` thay vì logic inline**

Thay toàn bộ nội dung `NDTCore.FE/src/components/ui/components/AppDataFilter.vue`:

```vue
<script setup lang="ts">
import type { FilterField, ActiveFilters, FilterValue } from '../types'
import { APP_DATA_FILTER_EMIT } from '../constants/emit-keys'
import type { AppDataFilterEmits } from '../types/emit.types'
import AppDateRangeMenu from './AppDateRangeMenu.vue'

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
</script>

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
        <AppDateRangeMenu
          :model-value="modelValue[field.key] as [string, string] | null"
          :label="field.label"
          @update:model-value="update(field.key, $event)"
        />
      </template>
    </template>
  </div>
</template>
```

- [ ] **Step 4: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: exit code 0, no errors.

- [ ] **Step 5: Chạy test hiện có (không bị ảnh hưởng nhưng verify không hỏng gì)**

Run: `cd NDTCore.FE && npx vitest run`
Expected: tất cả test hiện có pass (không có test nào cho `AppDataFilter.vue`/`AppDateRangeMenu.vue`, đây chỉ là bước xác nhận không phá vỡ suite khác).

- [ ] **Step 6: Commit**

```bash
cd NDTCore.FE
git add src/components/ui/components/AppDateRangeMenu.vue src/components/ui/index.ts src/components/ui/components/AppDataFilter.vue
git commit -m "refactor: tach AppDateRangeMenu thanh component dung chung tu AppDataFilter"
```

---

### Task 3: FE — Store Revenue List bỏ hẳn filter khoảng thời gian

**Files:**
- Modify: `NDTCore.FE/src/modules/report/constants/store-revenue-list.constants.ts`
- Modify: `NDTCore.FE/src/modules/report/models/dtos/store-revenue.dto.ts`
- Modify: `NDTCore.FE/src/modules/report/views/StoreRevenueListView.vue`

**Interfaces:**
- Consumes: BE (Task 1) accepting `From: null, To: null` trong `StoreRevenueFilterDto` để trả về doanh thu all-time.
- Không tạo interface mới cho task khác.

- [ ] **Step 1: Bỏ field `dateRange` khỏi filter fields**

Trong `NDTCore.FE/src/modules/report/constants/store-revenue-list.constants.ts`, tìm:

```ts
export function buildStoreRevenueFilterFields(): FilterField[] {
    return [
        { key: 'keyword', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã cửa hàng, tên cửa hàng...' },
        { key: 'dateRange', label: 'Khoảng thời gian', type: 'daterange' },
    ]
}
```

Thay bằng:

```ts
export function buildStoreRevenueFilterFields(): FilterField[] {
    return [
        { key: 'keyword', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã cửa hàng, tên cửa hàng...' },
    ]
}
```

- [ ] **Step 2: `From`/`To` thành optional trong DTO**

Trong `NDTCore.FE/src/modules/report/models/dtos/store-revenue.dto.ts`, tìm:

```ts
export interface StoreRevenueFilterDto {
    PageNumber: number
    PageSize: number
    From: string
    To: string
    Keyword?: string | null
    SortBy?: string | null
    SortDirection?: string | null
}
```

Thay bằng:

```ts
export interface StoreRevenueFilterDto {
    PageNumber: number
    PageSize: number
    From?: string | null
    To?: string | null
    Keyword?: string | null
    SortBy?: string | null
    SortDirection?: string | null
}
```

- [ ] **Step 3: `StoreRevenueListView.vue` — bỏ toàn bộ logic dateRange**

Thay toàn bộ nội dung `<script setup lang="ts">...</script>` của `NDTCore.FE/src/modules/report/views/StoreRevenueListView.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
    AppBreadcrumb,
    AppPageHeader,
    AppFilterBar,
    AppDataFilter,
    AppDataTable,
    AppPagination,
    AppRowActions,
    AppEmptyState,
} from '@/components/ui'
import { useListPage } from '@/components/ui/composables'
import type { ListPageParams } from '@/components/ui/composables'
import { APP_ROUTES, DEFAULT_PAGINATION } from '@/core/constants/_index'
import { downloadBlob } from '@/core/utils/download.util'
import { useStoreRevenueList } from '@/modules/report/composables/useStoreRevenueList'
import {
    STORE_REVENUE_LIST_COLUMNS,
    STORE_REVENUE_LIST_ROW_ACTIONS,
    STORE_REVENUE_ROW_ACTION,
    buildStoreRevenueFilterFields,
} from '@/modules/report/constants/store-revenue-list.constants'
import { toDateKey } from '@/core/utils/date-range.util'
import type { StoreRevenueListItemViewModel } from '@/modules/report/models/view-models/store-revenue.view-model'

const router = useRouter()
const { getPagedStoreRevenue, exportStoreRevenueList } = useStoreRevenueList()

const filterFields = buildStoreRevenueFilterFields()

// Scope is resolved entirely server-side for this endpoint, so no requiresStoreScope workaround is needed here.
const fetchStoreRevenue = async (
    params: ListPageParams,
): Promise<{ items: StoreRevenueListItemViewModel[]; total: number }> => {
    const result = await getPagedStoreRevenue({
        PageNumber: params.pageNumber,
        PageSize: params.pageSize,
        From: null,
        To: null,
        Keyword: (params.filters['keyword'] as string | null) ?? null,
        SortBy: params.sortBy?.key ?? null,
        SortDirection: params.sortBy?.order ?? null,
    })
    return { items: result.items, total: result.totalCount }
}

const listPage = useListPage<StoreRevenueListItemViewModel>({
    fetchFn: fetchStoreRevenue,
    keyField: 'storeId',
    defaultPageSize: DEFAULT_PAGINATION.LIMIT,
})

const viewItems = computed<StoreRevenueListItemViewModel[]>(() => listPage.items.value ?? [])

const onResetFilters = async () => {
    listPage.filters.resetFilters()
    listPage.pagination.reset()
    await listPage.refresh()
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
}

function onRowAction(actionKey: string, item: StoreRevenueListItemViewModel): void {
    if (actionKey === STORE_REVENUE_ROW_ACTION.VIEW) {
        void router.push({
            name: APP_ROUTES.ADMIN.CHILDREN.REPORTS_STORE_REVENUE_DETAIL.NAME,
            params: { storeId: item.storeId },
        })
    }
}

const exporting = ref(false)

async function onExport(format: 'excel' | 'csv'): Promise<void> {
    exporting.value = true
    try {
        const blob = await exportStoreRevenueList({
            PageNumber: listPage.pagination.pageNumber.value,
            PageSize: listPage.pagination.pageSize.value,
            From: null,
            To: null,
            Keyword: (listPage.filters.activeFilters.value['keyword'] as string | null) ?? null,
            SortBy: listPage.sortBy.value?.key ?? null,
            SortDirection: listPage.sortBy.value?.order ?? null,
            format,
        })
        const today = toDateKey(new Date())
        const extension = format === 'excel' ? 'xlsx' : 'csv'
        downloadBlob(blob, `bao-cao-doanh-thu-${today}.${extension}`)
    } finally {
        exporting.value = false
    }
}

onMounted(async () => {
    await listPage.refresh()
})
</script>
```

Phần `<template>` của file này **không đổi** — vẫn dùng `AppDataFilter :fields="filterFields"` như cũ, chỉ là `filterFields` giờ không còn field `dateRange` (Task 3 Step 1) nên `AppDataFilter` sẽ tự động không render nút đó nữa.

- [ ] **Step 4: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: exit code 0, no errors.

- [ ] **Step 5: Commit**

```bash
cd NDTCore.FE
git add src/modules/report/constants/store-revenue-list.constants.ts src/modules/report/models/dtos/store-revenue.dto.ts src/modules/report/views/StoreRevenueListView.vue
git commit -m "feat: bo filter khoang thoi gian o Store Revenue List, luon hien thi doanh thu all-time"
```

---

### Task 4: FE — Store Revenue Detail dùng nút "Khoảng Thời gian" độc lập

**Files:**
- Modify: `NDTCore.FE/src/modules/report/constants/store-revenue-detail.constants.ts`
- Modify: `NDTCore.FE/src/modules/report/views/StoreRevenueDetailView.vue`

**Interfaces:**
- Consumes: `AppDateRangeMenu` component từ Task 2 (`Props: { modelValue: [string,string]|null; label: string }`, `Emits: { 'update:modelValue': [value: [string,string]|null] }`).

- [ ] **Step 1: Bỏ entry `custom` khỏi `DATE_PRESET_OPTIONS`**

Trong `NDTCore.FE/src/modules/report/constants/store-revenue-detail.constants.ts`, tìm:

```ts
export const DATE_PRESET_OPTIONS: DatePresetOption[] = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'yesterday', label: 'Hôm qua' },
    { value: 'last7', label: '7 ngày gần nhất' },
    { value: 'last30', label: '30 ngày gần nhất' },
    { value: 'thisMonth', label: 'Tháng này' },
    { value: 'custom', label: 'Tùy chỉnh' },
]
```

Thay bằng:

```ts
export const DATE_PRESET_OPTIONS: DatePresetOption[] = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'yesterday', label: 'Hôm qua' },
    { value: 'last7', label: '7 ngày gần nhất' },
    { value: 'last30', label: '30 ngày gần nhất' },
    { value: 'thisMonth', label: 'Tháng này' },
]
```

`export type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'custom'` ở trên **không đổi** — vẫn giữ giá trị `'custom'` trong type vì `StoreRevenueDetailView.vue` còn dùng nó để track state nội bộ.

- [ ] **Step 2: Sửa `<template>` — bỏ nút "Tùy chỉnh" khỏi toggle, thêm `AppDateRangeMenu` độc lập**

Trong `NDTCore.FE/src/modules/report/views/StoreRevenueDetailView.vue`, tìm khối:

```html
                <v-btn-toggle
                    :model-value="datePreset"
                    density="compact"
                    color="primary"
                    variant="outlined"
                    divided
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
```

Thay bằng:

```html
                <v-btn-toggle
                    :model-value="datePreset"
                    density="compact"
                    color="primary"
                    variant="outlined"
                    divided
                    @update:model-value="onPresetToggle"
                >
                    <v-btn
                        v-for="option in DATE_PRESET_OPTIONS"
                        :key="option.value"
                        :value="option.value"
                        class="text-none"
                    >
                        {{ option.label }}
                    </v-btn>
                </v-btn-toggle>

                <AppDateRangeMenu
                    :model-value="customRange"
                    label="Khoảng Thời gian"
                    @update:model-value="onCustomRangeApply"
                />

                <v-spacer />
```

- [ ] **Step 3: Sửa `<script setup>` — bỏ state/hàm cũ của "Tùy chỉnh", thêm state/hàm mới**

Tìm import component (đầu file):

```ts
import { AppBreadcrumb, AppPageHeader, AppDataTable, AppEmptyState } from '@/components/ui'
```

Thay bằng:

```ts
import { AppBreadcrumb, AppPageHeader, AppDataTable, AppEmptyState, AppDateRangeMenu } from '@/components/ui'
```

Tìm khối state:

```ts
const datePreset = ref<DatePreset>('today')
const isCustomMenuOpen = ref(false)
const draftFromDate = ref('')
const draftToDate = ref('')
const customRangeError = ref('')
const customRangeLabel = ref('')

const maxDate = computed(() => todayKey())
```

Thay bằng:

```ts
const datePreset = ref<DatePreset>('today')
const customRange = ref<[string, string] | null>(null)
```

Tìm hàm `onPresetToggle`:

```ts
async function onPresetToggle(preset: DatePreset | null): Promise<void> {
    if (preset === null || preset === 'custom') return
    applyPreset(preset)
    await onFilterChange()
}
```

Thay bằng:

```ts
async function onPresetToggle(preset: DatePreset | null): Promise<void> {
    if (preset === null) return
    applyPreset(preset)
    customRange.value = null
    await onFilterChange()
}
```

Tìm khối 3 hàm liên quan đến menu "Tùy chỉnh" cũ:

```ts
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

Thay bằng:

```ts
async function onCustomRangeApply(value: [string, string] | null): Promise<void> {
    if (!value) return
    fromDate.value = value[0]
    toDate.value = value[1]
    datePreset.value = 'custom'
    customRange.value = value
    await onFilterChange()
}
```

`todayKey` vẫn còn dùng ở `applyPreset`'s `'today'` branch, nên import của nó **không đổi**. `formatBucketLabel` vẫn dùng ở nơi khác trong file (label tổng quan `fromDate`/`toDate` phía trên) nên **không xóa** hàm này — chỉ xóa lời gọi nó trong `applyCustomRange` (đã xóa nguyên hàm đó).

- [ ] **Step 4: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: exit code 0, no errors.

- [ ] **Step 5: Commit**

```bash
cd NDTCore.FE
git add src/modules/report/constants/store-revenue-detail.constants.ts src/modules/report/views/StoreRevenueDetailView.vue
git commit -m "feat: doi nut Tuy chinh thanh nut Khoang Thoi gian doc lap o Store Revenue Detail"
```

---

### Task 5: Kiểm thử thủ công trên dev server

**Files:** Không sửa file — chỉ chạy backend + frontend và quan sát.

**Interfaces:**
- Consumes: Kết quả của Task 1-4.

- [ ] **Step 1: Chạy BE**

Run: `cd NDTCore.BE/src/NDTCore.API && dotnet run`
Expected: API khởi động không lỗi.

- [ ] **Step 2: Chạy FE dev server (bỏ qua nếu đã có sẵn)**

Run: `cd NDTCore.FE && npm run dev`
Expected: Vite serve không lỗi compile.

- [ ] **Step 3: Verify Store Revenue List**

Vào trang Báo cáo doanh thu theo cửa hàng:
1. Filter bar chỉ còn ô "Tìm kiếm" — không còn nút/field khoảng thời gian nào.
2. Danh sách hiển thị doanh thu, số đơn của từng cửa hàng tính trên toàn bộ lịch sử (all-time), không phụ thuộc ngày hiện tại.
3. "Xuất Excel"/"Xuất CSV" tải về file chứa dữ liệu all-time tương ứng.

Expected: Cả 3 bước đúng như mô tả, không có lỗi console, Network tab cho thấy request `GetStoreRevenueList`/`export` không có param `From`/`To` (hoặc gửi rỗng).

- [ ] **Step 4: Verify Store Revenue Detail**

Vào trang chi tiết doanh thu 1 cửa hàng bất kỳ:
1. Nhóm toggle chỉ còn 5 nút: Hôm nay, Hôm qua, 7 ngày gần nhất, 30 ngày gần nhất, Tháng này.
2. Nút "Khoảng Thời gian" đứng riêng ngay sau nhóm toggle, ban đầu hiển thị placeholder "Khoảng Thời gian" (không phải mặc định "Hôm nay" dù toggle đang chọn "Hôm nay").
3. Bấm nút "Khoảng Thời gian" → chọn 1 range trên lịch → "Áp dụng" → label nút cập nhật `dd/MM/yyyy - dd/MM/yyyy`, dữ liệu load đúng theo range đã chọn, không nút preset nào trong toggle còn ở trạng thái active.
4. Bấm 1 preset bất kỳ (ví dụ "7 ngày gần nhất") → nút "Khoảng Thời gian" quay lại placeholder "Khoảng Thời gian" (không còn hiện range cũ).

Expected: Cả 4 bước đúng như mô tả, không có lỗi console.
