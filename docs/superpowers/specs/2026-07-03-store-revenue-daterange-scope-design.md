# Store Revenue: Bỏ Filter Thời Gian Ở List, Đổi Nút "Tùy Chỉnh" Ở Detail — Design

**Goal:** (1) Trang Store Revenue List bỏ hẳn filter/nút khoảng thời gian — luôn hiển thị doanh thu toàn thời gian (all-time) của từng cửa hàng, cần nới lỏng contract BE vì `From`/`To` hiện bắt buộc. (2) Trang Store Revenue Detail đổi nút "Tùy chỉnh" (đang nằm trong nhóm toggle preset, dùng 2 ô nhập ngày) thành nút "Khoảng Thời gian" độc lập, dùng chung UI với nút daterange đã làm ở Order List. (3) Tách phần UI đó (nút + menu + `v-date-picker` range + Hủy/Áp dụng) hiện đang nằm trong `AppDataFilter.vue` thành component dùng chung `AppDateRangeMenu.vue`, vì giờ có 2 nơi cần.

**Tech Stack:** .NET 8 (BE: nới lỏng 1 DTO + 1 validator + 1 service) + Vue 3/TypeScript (FE).

---

## 1. Bối cảnh hiện tại

- `StoreRevenueFilterDto.From`/`To` là `DateTimeOffset` **không nullable** ([StoreRevenueFilterDto.cs:15-21](../../../NDTCore.BE/src/NDTCore.Modules/NDTCore.Report/NDTCore.Report.Contracts/Models/StoreRevenueFilterDto.cs)) — FE hiện luôn phải gửi 1 range hợp lệ (mặc định tháng hiện tại).
- `OrderRevenueReportService.GetRevenueByStoreAsync` filter cứng `o.CreatedAt >= from && o.CreatedAt <= to` ([OrderRevenueReportService.cs:50-55](../../../NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Services/OrderRevenueReportService.cs)) — không có đường nào bỏ qua điều kiện ngày.
- Endpoint export List (`GET /api/reports/store-revenue/export`, [ReportController.cs:120-148](../../../NDTCore.BE/src/NDTCore.API/Controllers/Modules/Report/Admin/ReportController.cs)) gọi lại chính `GetStoreRevenueListQuery` nhiều lần để lấy toàn bộ dữ liệu ([ReportController.cs:242-283](../../../NDTCore.BE/src/NDTCore.API/Controllers/Modules/Report/Admin/ReportController.cs)) — không có logic filter riêng, nên nới lỏng ở tầng Query/Handler sẽ tự động áp dụng cho cả export, không cần sửa `ReportController` (ngoại trừ XML doc).
- `StoreRevenueDetailFilterDto` (dùng cho trang Detail) là **DTO khác**, không bị ảnh hưởng — trang Detail vẫn luôn cần From/To bắt buộc như hiện tại.
- `AppDataFilter.vue` hiện có toàn bộ logic nút-gộp-daterange (menu + `v-date-picker` range + Hủy/Áp dụng) viết inline, chỉ dùng cho field `type: 'daterange'` ([AppDataFilter.vue:26-72, 138-170](../../../NDTCore.FE/src/components/ui/components/AppDataFilter.vue)).
- `StoreRevenueDetailView.vue` có nút "Tùy chỉnh" là 1 `v-btn` bên trong `v-btn-toggle` cùng 5 preset khác, chứa 2 `v-text-field type="date"` trong menu riêng ([StoreRevenueDetailView.vue:49-104](../../../NDTCore.FE/src/modules/report/views/StoreRevenueDetailView.vue)).

---

## 2. Quyết định thiết kế (đã chốt)

| Điểm | Quyết định |
|---|---|
| Phạm vi BE | Chỉ `StoreRevenueFilterDto`/List query — không đổi `StoreRevenueDetailFilterDto`/Detail |
| `From`/`To` List | Đổi sang nullable (`DateTimeOffset?`); `null` = không giới hạn theo thời gian |
| Validation `To >= From` | Chỉ áp dụng khi cả 2 có giá trị (`.When(...)`) |
| List page — filter UI | Bỏ hẳn field `dateRange` khỏi `buildStoreRevenueFilterFields()`, chỉ còn `keyword` |
| List page — giá trị gửi BE | Luôn `From: null, To: null` — không còn logic default "tháng hiện tại" |
| Component dùng chung | Tách `AppDateRangeMenu.vue` (props `modelValue`/`label`, emit `update:modelValue`) từ `AppDataFilter.vue`, `AppDataFilter.vue` gọi lại component này cho `daterange` field |
| Detail page — nút "Tùy chỉnh" | Bỏ khỏi `v-btn-toggle` (toggle chỉ còn 5 preset cố định); thay bằng `<AppDateRangeMenu label="Khoảng Thời gian">` đặt ngay sau nhóm toggle, độc lập |
| Detail page — đồng bộ hiển thị | Khi bấm 1 trong 5 preset, reset `customRange` về `null` để nút "Khoảng Thời gian" quay lại placeholder (tránh label cũ bị stale) |
| Detail page — giới hạn ngày tương lai | Bỏ `:max="maxDate"` (constraint cũ trên 2 text-field) — đồng bộ theo đúng pattern chung của `AppDateRangeMenu` (không giới hạn, giống Order List) |

---

## 3. Thay đổi chi tiết

### 3.1. BE — `StoreRevenueFilterDto.cs`

```csharp
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

### 3.2. BE — `GetStoreRevenueListQueryValidator.cs`

```csharp
RuleFor(x => x.Filter.To)
    .GreaterThanOrEqualTo(x => x.Filter.From)
    .When(x => x.Filter.From.HasValue && x.Filter.To.HasValue)
    .WithMessage("To must be greater than or equal to From.");
```

### 3.3. BE — `IOrderRevenueReportService.cs`

Đổi signature `GetRevenueByStoreAsync` (giữ nguyên `GetRevenueBucketsAsync` — dùng cho Detail, không đổi):

```csharp
/// <param name="from">VN: Ngày bắt đầu (bao gồm); <see langword="null"/> nếu không giới hạn. <br /> EN: Start date (inclusive); <see langword="null"/> if unbounded.</param>
/// <param name="to">VN: Ngày kết thúc (bao gồm); <see langword="null"/> nếu không giới hạn. <br /> EN: End date (inclusive); <see langword="null"/> if unbounded.</param>
Task<IReadOnlyList<StoreRevenueAggregate>> GetRevenueByStoreAsync(
    IReadOnlyCollection<int> storeIds, DateTimeOffset? from, DateTimeOffset? to,
    CancellationToken cancellationToken = default);
```

### 3.4. BE — `OrderRevenueReportService.GetRevenueByStoreAsync`

```csharp
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

`GetStoreRevenueListQueryHandler.cs` không cần sửa — vẫn gọi `_orderRevenueReportService.GetRevenueByStoreAsync(..., filter.From, filter.To, cancellationToken)`, biên dịch được ngay vì cả 2 vế đều đổi sang nullable cùng lúc.

### 3.5. BE — `ReportController.cs` (chỉ update XML doc)

Cập nhật doc `filter` param của `GetStoreRevenueList` và `ExportStoreRevenueList` để nêu rõ From/To giờ tùy chọn (thêm 1 câu "VN: From/To là tùy chọn — bỏ trống nếu không muốn giới hạn theo thời gian." / "EN: From/To are optional — omit to return all-time data."). Không đổi logic.

### 3.6. FE — `store-revenue-list.constants.ts`

```ts
export function buildStoreRevenueFilterFields(): FilterField[] {
    return [
        { key: 'keyword', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã cửa hàng, tên cửa hàng...' },
    ]
}
```

### 3.7. FE — `store-revenue.dto.ts`

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

### 3.8. FE — `StoreRevenueListView.vue`

- Xóa `defaultDateRange()`, `applyCurrentMonthDefault()`.
- `fetchStoreRevenue`: bỏ dòng đọc `dateRange`, gửi `From: null, To: null`.
- `onExport`: tương tự, `From: null, To: null`.
- `onResetFilters`, `onMounted`: bỏ lời gọi `applyCurrentMonthDefault()`.
- Import: bỏ `toRangeStart`, `toRangeEnd` (từ core) và `currentMonthDateKeys` (từ report util) — không còn dùng. Giữ `toDateKey` (vẫn dùng cho tên file export).

### 3.9. FE — Tách `AppDateRangeMenu.vue` (component mới)

Tạo `NDTCore.FE/src/components/ui/components/AppDateRangeMenu.vue`, chuyển nguyên logic hiện có trong `AppDataFilter.vue` sang dạng single-instance (không cần `Record<string, ...>` theo field key nữa vì mỗi component instance đã tự cô lập state), giữ nguyên các chỉnh sửa UI đã có (`align-self-center`, `height="40"`, `border="sm"`):

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

Thêm export vào `components/ui/index.ts`:

```ts
export { default as AppDateRangeMenu } from './components/AppDateRangeMenu.vue'
```

### 3.10. FE — `AppDataFilter.vue` dùng lại `AppDateRangeMenu`

Xóa khỏi `<script setup>`: `menuOpen`, `draftDates`, `parseDateKey`, `toDateKey`, `formatDmy`, `dateRangeLabel`, `onDateRangeMenuUpdate`, `onDraftDatesChange`, `applyDateRange`, `cancelDateRange` (toàn bộ logic daterange chuyển sang component mới), thêm import `AppDateRangeMenu` từ `'./AppDateRangeMenu.vue'`. Thay block template `daterange`:

```html
<template v-else-if="field.type === 'daterange'">
  <AppDateRangeMenu
    :model-value="modelValue[field.key] as [string, string] | null"
    :label="field.label"
    @update:model-value="update(field.key, $event)"
  />
</template>
```

Các block `text`/`select`/`multiselect`/`date` giữ nguyên không đổi.

### 3.11. FE — `store-revenue-detail.constants.ts`

Bỏ entry `custom` khỏi `DATE_PRESET_OPTIONS` (giữ nguyên `DatePreset` type — vẫn cần giá trị `'custom'` để track state nội bộ):

```ts
export const DATE_PRESET_OPTIONS: DatePresetOption[] = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'yesterday', label: 'Hôm qua' },
    { value: 'last7', label: '7 ngày gần nhất' },
    { value: 'last30', label: '30 ngày gần nhất' },
    { value: 'thisMonth', label: 'Tháng này' },
]
```

### 3.12. FE — `StoreRevenueDetailView.vue`

Template: xóa `v-btn value="custom"` (và toàn bộ `v-menu`/`v-card` bên trong nó) khỏi `v-btn-toggle`; `v-for` không cần `.filter((o) => o.value !== 'custom')` nữa (danh sách đã không còn `custom`). Thêm ngay sau `</v-btn-toggle>`:

```html
<AppDateRangeMenu
    :model-value="customRange"
    label="Khoảng Thời gian"
    @update:model-value="onCustomRangeApply"
/>
```

Script: xóa `isCustomMenuOpen`, `draftFromDate`, `draftToDate`, `customRangeError`, `customRangeLabel`, `maxDate`, `onCustomMenuToggle`, `cancelCustomRange`, `applyCustomRange`. Thêm:

```ts
const customRange = ref<[string, string] | null>(null)

async function onCustomRangeApply(value: [string, string] | null): Promise<void> {
    if (!value) return
    fromDate.value = value[0]
    toDate.value = value[1]
    datePreset.value = 'custom'
    customRange.value = value
    await onFilterChange()
}
```

`onPresetToggle` thêm dòng reset `customRange.value = null` khi 1 preset hợp lệ được chọn:

```ts
async function onPresetToggle(preset: DatePreset | null): Promise<void> {
    if (preset === null) return
    applyPreset(preset)
    customRange.value = null
    await onFilterChange()
}
```

(bỏ luôn nhánh `preset === 'custom'` cũ vì `'custom'` không còn là giá trị hợp lệ của `v-btn-toggle` nữa.)

Import thêm `AppDateRangeMenu` từ `@/components/ui`.

### 3.13. Không đổi

- `StoreRevenueDetailFilterDto`, `GetStoreRevenueDetailQuery*`, `GetRevenueBucketsAsync` — Detail vẫn luôn cần From/To bắt buộc.
- `useStoreRevenueList.ts`, `useStoreRevenueDetail.ts`, `report.service.ts` — chỉ truyền dữ liệu qua, không có logic ngày tháng.
- `RevenueKpiCards.vue`, `RevenueTrendChart.vue`, `RevenueOrderChart.vue` — không liên quan.

---

## 4. Testing

- BE: build lại `dotnet build NDTCore.sln`, đảm bảo không lỗi compile ở `NDTCore.Report`/`NDTCore.Order` do đổi nullable.
- FE: `npx vue-tsc --build`, `npx vitest run` (không có test nào phụ thuộc các hàm/field bị xóa).
- Test thủ công trên dev server:
  - **Store Revenue List**: không còn nút/field khoảng thời gian nào trong filter bar; danh sách hiển thị doanh thu all-time từng cửa hàng; "Xuất Excel/CSV" cũng xuất all-time.
  - **Store Revenue Detail**: nhóm toggle chỉ còn 5 nút preset; nút "Khoảng Thời gian" đứng riêng ngay sau, mặc định hiển thị placeholder "Khoảng Thời gian"; chọn range → label cập nhật, dữ liệu load đúng theo range; bấm 1 preset bất kỳ → nút "Khoảng Thời gian" quay lại placeholder (không còn hiện range cũ).
