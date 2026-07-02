# Order List DateRange Fix + Store Revenue Detail Default Preset — Design

**Goal:** (1) Sửa filter "Khoảng thời gian" ở trang Order List: đổi label placeholder, bỏ default ban đầu, gửi local time kèm offset lên BE để tránh lệch giờ khi server chạy UTC. (2) Đổi preset mặc định của trang Store Revenue Detail từ "Tháng này" sang "Hôm nay".

**Tech Stack:** Vue 3 + TypeScript (FE only — không đổi BE).

---

## 1. Bối cảnh & xác nhận BE

`OrderFilterDto.FromDate`/`ToDate` đã là `DateTimeOffset?` ([OrderFilterDto.cs:33-39](../../../NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Contracts/Models/Orders/OrderFilterDto.cs)), và `AppOrderRepository` so sánh trực tiếp `o.CreatedAt >= filter.FromDate.Value` / `o.CreatedAt <= filter.ToDate.Value` giữa hai `DateTimeOffset` ([AppOrderRepository.cs:104-108](../../../NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Repositories/AppOrderRepository.cs)) — giống hệt pattern `Store Revenue` đã xác nhận đúng trước đó. **Không cần sửa BE.**

**Vấn đề thực tế đang tồn tại (lý do request này hợp lý):** `OrderController.GetPagedOrders` dùng `[FromQuery] OrderFilterDto filter` ([OrderController.cs:50-51](../../../NDTCore.BE/src/NDTCore.API/Controllers/Modules/Order/Admin/OrderController.cs)). FE hiện gửi chuỗi **không có offset** (`${dateRange[0]}T00:00:00`, xem [OrdersView.vue:150-151](../../../NDTCore.FE/src/modules/order/views/OrdersView.vue)). Khi ASP.NET Core bind query-string thành `DateTimeOffset`, chuỗi thiếu offset được hiểu theo **giờ local của máy chủ chạy API** — nếu server chạy múi giờ UTC (phổ biến với container/cloud VM), filter sẽ lệch 7 tiếng so với ý định người dùng VN. Gửi kèm offset (giống Store Revenue) khắc phục dứt điểm, không phụ thuộc timezone máy chủ.

---

## 2. Quyết định thiết kế (đã chốt)

| Điểm | Quyết định |
|---|---|
| Vị trí helper dùng chung | Chuyển `toDateKey`, `localOffsetSuffix`, `toRangeStart`, `toRangeEnd` từ `modules/report/utils/date-range.util.ts` sang `core/utils/date-range.util.ts` |
| Order List — label khi chưa chọn | Đổi field `dateRange` trong `order-list.constants.ts` từ `label: 'Ngày tạo'` → `label: 'Khoảng thời gian'` |
| Order List — default ban đầu | Bỏ hẳn default "hôm nay" — `dateRange` giữ `null` (mặc định của `useFilters`) |
| Order List — nút "Xóa lọc" | Cũng về `null` (đồng bộ với default mới) — bỏ luôn lời gọi set-today, không xử lý riêng |
| Order List — value gửi BE | Dùng `toRangeStart`/`toRangeEnd` (từ core) thay vì tự nối chuỗi không offset |
| Store Revenue Detail — default preset | `'thisMonth'` → `'today'`, tái dùng `applyPreset('today')` sẵn có trong `onMounted` thay vì set trực tiếp |

---

## 3. Thay đổi chi tiết

### 3.1. Tạo `core/utils/date-range.util.ts` (file mới)

Di chuyển nguyên vẹn 4 hàm từ `modules/report/utils/date-range.util.ts`:

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

### 3.2. `modules/report/utils/date-range.util.ts` — bỏ 4 hàm đã chuyển, import `toDateKey` từ core

Giữ lại `currentMonthDateKeys`, `todayKey`, `yesterdayKey`, `last7DaysKeys`, `last30DaysKeys` — tất cả đổi sang `import { toDateKey } from '@/core/utils/date-range.util'` thay vì định nghĩa cục bộ. `toRangeStart`/`toRangeEnd`/`localOffsetSuffix` bị xóa khỏi file này.

### 3.3. `StoreRevenueListView.vue`, `StoreRevenueDetailView.vue` — cập nhật import

Đổi import `toDateKey`, `toRangeStart`, `toRangeEnd` sang từ `@/core/utils/date-range.util`. Các hàm còn lại (`currentMonthDateKeys`, `todayKey`, `yesterdayKey`, `last7DaysKeys`, `last30DaysKeys`) vẫn import từ `@/modules/report/utils/date-range.util` như cũ. Không đổi logic nghiệp vụ nào khác trong 2 file này ngoài import path.

### 3.4. `order-list.constants.ts` — đổi label

```ts
{ key: 'dateRange', label: 'Khoảng thời gian', type: 'daterange' },
```

(thay cho `label: 'Ngày tạo'`)

### 3.5. `OrdersView.vue` — bỏ default, dùng `toRangeStart`/`toRangeEnd`

- Import thêm `toRangeStart`, `toRangeEnd` từ `@/core/utils/date-range.util`.
- Đổi `FromDate`/`ToDate` trong `fetchOrders`:
  ```ts
  FromDate: dateRange?.[0] ? toRangeStart(dateRange[0]) : null,
  ToDate: dateRange?.[1] ? toRangeEnd(dateRange[1]) : null,
  ```
- Xóa hoàn toàn hàm `applyTodayDefault()` và cả 2 lời gọi của nó (trong `onResetFilters` và `onMounted`). `resetFilters()` (đã có sẵn trong `useFilters`) tự đưa `dateRange` về `null`, không cần xử lý thêm gì.

### 3.6. `StoreRevenueDetailView.vue` — đổi default preset

```ts
const datePreset = ref<DatePreset>('today') // was 'thisMonth'
```

```ts
onMounted(async () => {
    applyPreset('today')
    granularity.value = 'Day'
    await loadDetail()
})
```

(thay cho việc gọi `currentMonthDateKeys()` trực tiếp — tái dùng `applyPreset` đã định nghĩa sẵn ở trên trong cùng file, tránh lặp logic set `fromDate`/`toDate`/`datePreset`).

### 3.7. Không đổi

- BE — không sửa gì (đã xác nhận đúng ở mục 1).
- `AppDataFilter.vue` — không đổi (label chỉ là dữ liệu field, component đã đọc `field.label` làm placeholder từ trước).
- Cấu trúc `FilterField`/`ActiveFilters`, các field khác của Order List (`keyword`, `status`, `channel`, `storeId`).

---

## 4. Testing

- `npx vue-tsc --build` — đảm bảo không lỗi type sau khi đổi import path ở 4 file (report util, 2 view report, order view).
- `npx vitest run` — 4 test hiện có trong `date-range.util.test.ts` (report module) phải vẫn pass sau khi đổi import `toDateKey` sang core (test chỉ gọi `todayKey`/`yesterdayKey`/`last7DaysKeys`/`last30DaysKeys`, không test trực tiếp `toDateKey`/`toRangeStart`/`toRangeEnd` — không cần thêm test mới cho việc di chuyển file thuần túy).
- Test thủ công trên dev server:
  - **Order List**: load trang lần đầu → nút hiển thị "Khoảng thời gian" (không phải ngày cụ thể), danh sách đơn hàng không bị lọc theo ngày mặc định. Chọn 1 range → "Tìm kiếm" → verify qua Network tab request có `FromDate`/`ToDate` dạng `...T00:00:00+07:00`/`...T23:59:59+07:00`. Bấm "Xóa lọc" → nút quay về "Khoảng thời gian" (không chọn), không tự set lại hôm nay.
  - **Store Revenue Detail**: load trang lần đầu → nút toggle preset đang chọn "Hôm nay" (không phải "Tháng này"), dữ liệu hiển thị đúng của ngày hôm nay.
