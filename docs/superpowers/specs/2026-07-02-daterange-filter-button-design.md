# Gộp Filter "Khoảng thời gian" Thành 1 Nút — Design

**Goal:** Đổi filter `daterange` dùng chung (`AppDataFilter.vue`) từ 2 nút chọn ngày riêng (từ ngày / đến ngày) thành 1 nút duy nhất mở dropdown chứa date-range picker, hiển thị giá trị đã chọn ngay trên label nút. Áp dụng cho mọi nơi dùng `type: 'daterange'` (Báo cáo doanh thu theo cửa hàng + Order List).

**Tech Stack:** Vue 3 + Vuetify 3 (FE only — không đổi BE).

---

## 1. Bối cảnh hiện tại

`AppDataFilter.vue` render field có `type: 'daterange'` bằng 2 `v-text-field type="date"` riêng biệt (label "... từ" / "... đến"), emit giá trị dạng `[fromDateKey, toDateKey]` (`YYYY-MM-DD`) qua `updateDateRange()`.

([AppDataFilter.vue:101-121](../../../NDTCore.FE/src/components/ui/components/AppDataFilter.vue))

2 nơi dùng field type này:

- `store-revenue-list.constants.ts:23` — `{ key: 'dateRange', label: 'Khoảng thời gian', type: 'daterange' }`
- `order-list.constants.ts:69` — `{ key: 'dateRange', label: 'Ngày tạo', type: 'daterange' }`

Cả 2 view tiêu thụ giá trị filter đều đọc `params.filters['dateRange'] as [string, string] | null` rồi tự convert sang chuỗi gửi BE — **không phụ thuộc vào cách render UI**, nên đổi UI không ảnh hưởng contract này.

**Đã xác nhận, không cần sửa:**

- FE gửi local-time kèm offset: `toRangeStart`/`toRangeEnd` ([date-range.util.ts:29-35](../../../NDTCore.FE/src/modules/report/utils/date-range.util.ts)) đã tạo ISO string dạng `${dateKey}T00:00:00+07:00` — đúng yêu cầu "kèm timezone offset, không tự convert UTC ở FE".
- BE xử lý offset: `StoreRevenueFilterDto.From/To` là `DateTimeOffset` ([StoreRevenueFilterDto.cs:15-21](../../../NDTCore.BE/src/NDTCore.Modules/NDTCore.Report/NDTCore.Report.Contracts/Models/StoreRevenueFilterDto.cs)), và `Order.CreatedAt` cũng là `DateTimeOffset` (cột SQL `datetimeoffset`). `OrderRevenueReportService.GetRevenueByStoreAsync` so sánh trực tiếp `o.CreatedAt >= from && o.CreatedAt <= to` giữa hai `DateTimeOffset` ([OrderRevenueReportService.cs:50-55](../../../NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Services/OrderRevenueReportService.cs)) — SQL Server so sánh `datetimeoffset` theo đúng thời điểm UTC tuyệt đối bất kể offset gửi lên, nên `GetPagedStoreRevenue` đã xử lý đúng, **không cần sửa BE**.

---

## 2. Quyết định thiết kế (đã chốt)

| Điểm | Quyết định |
|---|---|
| Phạm vi sửa | Sửa chung trong `AppDataFilter.vue` — áp dụng cho cả Order List lẫn Store Revenue List |
| Kiểu picker | Vuetify `v-date-picker` với `multiple="range"` (1 lịch, chọn ngày bắt đầu rồi ngày kết thúc) |
| Preset nhanh | Không có — chỉ lịch chọn range đơn giản |
| Cơ chế commit | Draft state riêng — chỉ commit (emit) khi bấm "Áp dụng"; bấm "Hủy" hoặc click ra ngoài → đóng menu, giữ nguyên giá trị cũ |
| Label nút khi chưa chọn | Hiển thị `field.label` (placeholder tĩnh, như hiện tại) |
| Label nút khi đã chọn | `dd/MM/yyyy - dd/MM/yyyy`, ví dụ `01/07/2026 - 02/07/2026` |
| Contract giá trị emit | Không đổi — vẫn `[string, string]` dạng `YYYY-MM-DD` |

---

## 3. Thay đổi chi tiết

### 3.1. `AppDataFilter.vue` — thay block `daterange`

Xóa `getDateRange()`/`updateDateRange()` (không còn dùng), thay bằng:

- State cục bộ theo field key, khai báo bằng `reactive()` (không phải `ref()`, để truy cập trực tiếp `obj[key]` trong template mà không cần `.value`; không cần khai báo trước từng key nhờ Vue 3 Proxy reactivity):
  ```ts
  const menuOpen = reactive<Record<string, boolean>>({})
  const draftDates = reactive<Record<string, Date[]>>({})
  ```

- Helper thuần chuỗi (không qua `Date`/timezone để tránh lệch ngày do offset trình duyệt):
  ```ts
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
  ```

- Label nút:
  ```ts
  function dateRangeLabel(field: FilterField): string {
    const val = props.modelValue[field.key] as [string, string] | null
    return val?.[0] && val?.[1] ? `${formatDmy(val[0])} - ${formatDmy(val[1])}` : field.label
  }
  ```

- Mở menu → init draft từ giá trị hiện tại (rỗng nếu chưa có):
  ```ts
  function onDateRangeMenuUpdate(key: string, isOpen: boolean): void {
    menuOpen[key] = isOpen
    if (isOpen) {
      const val = props.modelValue[key] as [string, string] | null
      draftDates[key] = val?.[0] && val?.[1] ? [parseDateKey(val[0]), parseDateKey(val[1])] : []
    }
  }
  ```

- Áp dụng → sort draft, lấy phần tử đầu/cuối làm from/to, emit, đóng menu:
  ```ts
  function applyDateRange(key: string): void {
    const dates = [...(draftDates[key] ?? [])].sort((a, b) => a.getTime() - b.getTime())
    update(key, dates.length ? [toDateKey(dates[0]), toDateKey(dates[dates.length - 1])] : null)
    menuOpen[key] = false
  }
  function cancelDateRange(key: string): void {
    menuOpen[key] = false
  }
  ```

- Template:
  ```html
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
            multiple="range"
            hide-header
            show-adjacent-months
            @update:model-value="draftDates[field.key] = $event"
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

### 3.2. Không đổi

- `FilterField`/`FilterType`/`ActiveFilters` (`types/filter.ts`).
- `store-revenue-list.constants.ts`, `order-list.constants.ts` — vẫn khai báo `type: 'daterange'` như cũ.
- `StoreRevenueListView.vue`, `useStoreRevenueList.ts`, `OrdersView.vue`, `date-range.util.ts` — logic đọc/convert filter giữ nguyên vì contract giá trị không đổi.
- BE — không đổi (đã xác nhận xử lý offset đúng ở mục 1).

---

## 4. Testing

- `npm run type-check` (đặc biệt kiểu `Date[]` cho `v-date-picker multiple="range"`).
- Test thủ công trên dev server, cả 2 trang:
  - **Store Revenue List**: mở nút "Khoảng thời gian" → chọn range trên lịch → bấm "Áp dụng" → label nút cập nhật đúng `dd/MM/yyyy - dd/MM/yyyy` → bấm "Tìm kiếm" → kết quả đúng theo range. Bấm "Xóa lọc" → về lại mặc định tháng hiện tại.
  - **Order List**: tương tự với field "Ngày tạo" — verify giá trị gửi BE (`FromDate`/`ToDate`) không đổi format so với trước (không có offset — giữ nguyên hành vi cũ của trang này, ngoài phạm vi task).
  - Mở menu, chọn dở dang, bấm ra ngoài (click outside) → verify giá trị filter cũ không đổi, label không cập nhật.
