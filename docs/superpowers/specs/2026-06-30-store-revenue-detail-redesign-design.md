# Redesign UI + Date Range Preset cho StoreRevenueDetailView — Design

**Goal:** Redesign giao diện trang `StoreRevenueDetailView.vue` (header, filter bar, KPI cards, charts, bảng chi tiết) và bổ sung tính năng **preset khoảng thời gian** (Hôm nay/Hôm qua/7 ngày/30 ngày/Tháng này/Tùy chỉnh) — tính năng mới, hiện code chỉ có 2 input ngày trần.

**Tech Stack:** Vue 3 (Composition API) + TypeScript + Vuetify 3. Không thêm dependency mới (Chart.js/vue-chartjs đã có sẵn, đủ cho yêu cầu nét đứt + legend).

**Phạm vi:** Chỉ sửa `StoreRevenueDetailView.vue`, `RevenueKpiCards.vue`, `RevenueTrendChart.vue`, `RevenueOrderChart.vue`, `date-range.util.ts`, `store-revenue-detail.constants.ts` (FE module `report`). Giữ nguyên hoàn toàn: composable `useStoreRevenueDetail`, các hàm `loadDetail`/`onExport`/`fetchDetail`/`exportDetail`/`onFilterChange`, API contract, route params, breadcrumb logic, shape `RevenueBucketViewModel`/`BucketGranularityDto`.

---

## 1. Bối cảnh hiện tại (đã khảo sát code thật)

- `StoreRevenueDetailView.vue` hiện có: `AppPageHeader` (title/breadcrumb + 2 nút export trong default slot), card info Store (4 cột), card filter (granularity tabs + 2 `v-text-field type="date"` trần, không có preset), `RevenueKpiCards`, 2 chart `md="6"` 50:50, `AppDataTable` cho bucket.
- `RevenueKpiCards.vue` đã dùng `v-row`/`v-col` (`cols="12" sm="6" md="3"`), mỗi card đã có `class="border"` (viền mờ sẵn) — **không cần đổi sang CSS grid**.
- `RevenueTrendChart.vue`/`RevenueOrderChart.vue` dùng **Chart.js + vue-chartjs** (đã cài từ trước, không cần thêm lib). Legend đã hiển thị sẵn (`plugins.legend.position: 'top'`). Màu hiện hardcode hex: "Kỳ này" `#1867C0`, "Kỳ trước" `#9E9E9E`, cả 2 đều nét liền (`tension: 0.3`, không có `borderDash`).
- `date-range.util.ts` hiện có `toDateKey()`, `currentMonthDateKeys()`, `toRangeStart()`, `toRangeEnd()` — pattern trả `[string, string]` cho khoảng ngày, `string` cho 1 ngày, dùng local-date getters (không qua `toISOString()`).
- Design token màu: `src/plugins/vuetify/tokens/color.ts` có token ngữ nghĩa `primary` và `onSurfaceVariant` (gray, đổi theo light/dark theme) — dùng `useTheme()` (`@/plugins/vuetify/theme`, đã có pattern dùng ở `AppBar.vue`) để resolve giá trị runtime cho Chart.js (Chart.js cần chuỗi màu thật, không tự đọc CSS variable).
- `AppPageHeader.vue`: default slot dành riêng cho action button (title bên trái, action bên phải) — **100% các trang trong hệ thống** (`ProductsView`, `OrdersView`, `CategoriesView`, …) đặt action button ở đây, không trang nào dùng toolbar riêng trên bảng. Trang này sẽ là **ngoại lệ có chủ đích** theo yêu cầu — không áp dụng lại pattern này cho trang khác nếu không có yêu cầu tương tự.
- `STORE_REVENUE_BUCKET_COLUMNS`/`GRANULARITY_TAB_OPTIONS` đã có trong `store-revenue-detail.constants.ts`.

---

## 2. Header info card

Giữ nguyên 4 cột (Store/Code/Franchisee/Brand). Thêm 1 dòng ở góc phải card, hiển thị khoảng thời gian đang xem, format `dd/MM/yyyy – dd/MM/yyyy` (dùng lại kiểu format của `formatBucketLabel` hiện có, không viết formatter mới), tự cập nhật theo `fromDate`/`toDate` hiện tại.

---

## 3. Filter bar — Date Range Preset (tính năng mới)

### 3.1. State mới

```ts
type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'custom'
const datePreset = ref<DatePreset>('thisMonth')
```

### 3.2. Util mới trong `date-range.util.ts` (theo đúng pattern `currentMonthDateKeys()` — trả `[string, string]`, dùng local-date getters)

```ts
export function todayKey(): string { /* toDateKey(new Date()) */ }
export function yesterdayKey(): string { /* toDateKey(new Date hôm qua) */ }
export function last7DaysKeys(): [string, string] { /* [hôm nay - 6 ngày, hôm nay] */ }
export function last30DaysKeys(): [string, string] { /* [hôm nay - 29 ngày, hôm nay] */ }
```

(`last7Days`/`last30Days` tính từ hôm nay lùi về N-1 ngày, bao gồm cả hôm nay — ví dụ "7 ngày gần nhất" = 7 ngày tính cả hôm nay, không phải 7 ngày trước hôm nay.)

### 3.3. UI: `v-btn-toggle` mandatory + popup "Tùy chỉnh"

- `v-btn-toggle v-model="datePreset" mandatory density="compact"` chứa 6 nút: Hôm nay / Hôm qua / 7 ngày gần nhất / 30 ngày gần nhất / Tháng này / Tùy chỉnh. Đặt bên trái 2 date field hiện có, trong cùng `v-card` filter, thêm `class="border-b"` để tách với KPI bên dưới.
- 2 `v-text-field type="date"` (`fromDate`/`toDate`) hiện có: **giữ nguyên, không tạo field mới** — nhưng ẩn khỏi layout chính khi `datePreset !== 'custom'` (vẫn giữ giá trị nội bộ để dùng cho fetch/export), chỉ hiện trong popup "Tùy chỉnh".

### 3.4. Hành vi chọn preset (trừ "Tùy chỉnh")

Click 1 trong 5 preset đầu → gọi util tương ứng → set `fromDate`/`toDate` → `datePreset.value = <preset>` → gọi `onFilterChange()`.

### 3.5. Hành vi nút "Tùy chỉnh" (chi tiết từng bước)

1. Nút "Tùy chỉnh" đứng cuối `v-btn-toggle`, style giống các nút khác khi chưa active.
2. Click → mở `v-menu` (`activator` = chính nút này, `location="bottom end"`), nội dung từ trên xuống:
   - Tiêu đề `text-caption font-weight-medium`: "Chọn khoảng thời gian"
   - Input "Từ ngày" — tái dùng `v-text-field v-model="fromDate"` hiện có, thêm `:max` = hôm nay
   - Input "Đến ngày" — tái dùng `v-text-field v-model="toDate"` hiện có, thêm `:max` = hôm nay
   - Dòng lỗi `text-caption text-error`, `min-height` cố định (vd `20px`) để không nhảy layout, ẩn khi không có lỗi
   - Hàng nút căn phải: **Hủy** (variant text/outlined) + **Áp dụng** (variant filled, color primary)
3. Trong popup, sửa ngày: **không validate khi gõ**, chỉ validate khi bấm "Áp dụng".
4. Bấm "Áp dụng":
   - Nếu `fromDate > toDate` → hiện lỗi "Từ ngày phải nhỏ hơn hoặc bằng đến ngày.", **không đóng popup**, không gọi API.
   - Nếu hợp lệ → xóa lỗi, đóng popup, `datePreset.value = 'custom'`, label nút "Tùy chỉnh" đổi thành range rút gọn (vd "15/06 – 22/06", dùng lại kiểu format của `formatBucketLabel`), gọi `onFilterChange()`.
5. Bấm "Hủy" → đóng popup ngay, **không lưu** thay đổi gì (giữ `fromDate`/`toDate`/`datePreset` như trước khi mở popup — nếu đã gõ dở thì bỏ qua giá trị gõ dở, cần lưu snapshot khi mở popup để revert khi Hủy).
6. Click ra ngoài / Esc → coi như "Hủy" (hành vi mặc định của `v-menu`, không cần xử lý thêm — nhưng vẫn cần đảm bảo logic "revert nếu không Áp dụng" áp dụng cho cả trường hợp này, không chỉ riêng nút Hủy).
7. Mở lại "Tùy chỉnh" sau khi đã Áp dụng 1 lần → popup pre-fill đúng `fromDate`/`toDate` đang active (không reset).

### 3.6. Lưu ý kỹ thuật cho bước 5/6 (snapshot revert)

Cần 1 cặp ref tạm (vd `draftFromDate`/`draftToDate`) cho 2 input trong popup, tách biệt khỏi `fromDate`/`toDate` thật — `v-menu` mở thì copy giá trị thật vào draft; "Áp dụng" hợp lệ thì copy draft → thật rồi mới gọi `onFilterChange()`; "Hủy"/đóng popup không qua "Áp dụng" thì không đụng tới giá trị thật. (Đây là điểm khác với mô tả "tái dùng input hiện có" theo nghĩa tái dùng *type field*, không phải tái dùng *chung 1 ref* với layout chính — nếu dùng chung 1 ref, gõ dở rồi Hủy sẽ không revert được.)

---

## 4. KPI Cards (`RevenueKpiCards.vue`)

- **Không đổi layout** — giữ `v-row`/`v-col` (`cols="12" sm="6" md="3"`) và `class="border"` hiện có.
- Đổi style chữ: label từ `text-body-2 text-medium-emphasis` → `text-caption text-medium-emphasis`; value từ `text-h6 font-weight-bold` → `text-h5 font-weight-medium`.
- KPI "Tăng trưởng": thêm dấu `+`/`−` tường minh trước số % (vd `+12.3%` / `−5.0%`), giữ màu `success`/`error` theo dấu như hiện có.

---

## 5. Charts (`RevenueTrendChart.vue`, `RevenueOrderChart.vue`)

- Giữ nguyên layout 2 `v-col md="6"` (50:50) trong `StoreRevenueDetailView.vue`.
- `RevenueTrendChart.vue`: dataset "Kỳ trước" thêm `borderDash: [6, 4]` (Chart.js built-in, không cần lib mới). Màu "Kỳ này"/"Kỳ trước" đổi từ hex cứng sang resolve runtime từ token `primary`/`onSurfaceVariant` qua `useTheme()` (`@/plugins/vuetify/theme`).
- `RevenueOrderChart.vue`: không có series "kỳ trước" (giữ nguyên, chỉ current period) — không cần đổi màu/dash, có thể đổi màu bar sang token `primary` cho nhất quán (tùy chọn, không bắt buộc).
- Legend đã hiển thị sẵn, không cần thêm code.

---

## 6. Bảng chi tiết — di chuyển nút Export (ngoại lệ có chủ đích)

- 2 nút "Xuất Excel"/"Xuất CSV" di chuyển từ `AppPageHeader` default slot xuống `v-card-title` (flex `justify-space-between align-center`) ngay phía trên `AppDataTable`, cùng `v-card` — title bên trái (vd "Bảng chi tiết"), 2 nút bên phải.
- **Đây là ngoại lệ có chủ đích** so với convention toàn hệ thống (100% trang khác đặt action button trong `AppPageHeader`) — chỉ áp dụng cho trang này theo yêu cầu, không áp dụng lại cho trang khác.
- `AppPageHeader` sau khi bỏ 2 nút export sẽ không còn nội dung trong default slot — bỏ hẳn phần đó, không để slot rỗng.

---

## 7. Ràng buộc (đã chốt, không đổi)

- Không đổi tên `loadDetail`/`onExport`/`fetchDetail`/`exportDetail`/`onFilterChange` — chỉ gọi thêm `onFilterChange()` từ các handler preset mới.
- Không thêm dependency mới.
- Tái dùng `AppPageHeader`/`AppBreadcrumb`/`AppDataTable`/`AppEmptyState` — không tạo bản sao.
- Util ngày mới thêm vào `date-range.util.ts` hiện có, theo đúng pattern `currentMonthDateKeys()` — không tạo file util riêng.
- Giữ shape `RevenueBucketViewModel`/`BucketGranularityDto` không đổi.

## 8. Ngoài phạm vi

- Không đổi API backend, route, hoặc cấu trúc dữ liệu DTO/ViewModel.
- Không áp dụng lại pattern "export button ở table toolbar" cho `StoreRevenueListView.vue` hoặc các trang khác — chỉ riêng `StoreRevenueDetailView.vue`.
