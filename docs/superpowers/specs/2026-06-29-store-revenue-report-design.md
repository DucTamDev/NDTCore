# Báo cáo Doanh thu theo Store — Design

**Goal:** Thêm chức năng báo cáo doanh thu theo Store: trang List (toàn bộ Store user có quyền xem, kèm doanh thu/số đơn tổng quan theo khoảng thời gian) và trang Detail (1 Store, KPI + biểu đồ xu hướng + bảng chi tiết theo bucket Ngày/Tuần/Tháng, so sánh kỳ trước).

**Tech Stack:** .NET 8 + EF Core 8 + MediatR (BE, module mới `NDTCore.Report`); Vue 3 (Composition API) + TypeScript + Vuetify 3 + Pinia + Chart.js/vue-chartjs (FE, module mới `report`).

---

## 1. Bối cảnh hiện tại (đã khảo sát codebase)

- **Order module dùng SQL Server qua EF Core** (`NdtOrderDbContext`), **không phải MongoDB** — mọi aggregation viết bằng LINQ `GROUP BY`, không dùng aggregation pipeline.
- **Doanh thu tính ở cấp Order, không phải OrderItem**: dùng `Order.TotalAmount` (`NDTCore.Order.Domain/Entities/Order.cs:110`) = `Subtotal - DiscountAmount + TaxAmount + DeliveryFee` — đây là số tiền khách thực trả, đã có sẵn trên Order, không cần tự cộng lại từ `OrderItem.LineNetAmount`. Aggregation chỉ cần `GROUP BY` trên bảng `Order`, không cần join `OrderItem`.
- `Order.Status` (string): `Pending | Confirmed | Completed | Cancelled`. **Chỉ tính doanh thu khi `Status == "Completed"`** (không xét `PaymentStatus`).
- `AppBrandUser`, `AppFranchiseeUser`, `AppStoreUser` đều **đã tồn tại** (Brand/Store Domain) — không có entity nào là placeholder cần tạo mới.
- Role constants tại `NDTCore.BuildingBlocks.Core/Constants/SystemRoles.cs`: `SuperAdmin, OrgAdmin, BrandManager, BrandAccountant, FranchiseeOwner, StoreManager, Cashier, OrderStaff, OrgUser, Customer, Guest, Integration`. Claim role nằm ở JWT claim `"role"`.
- `AppStore` có `Code` (mã store) và `TimeZone` (string?, có thể null).
- **Module encapsulation**: tất cả module dùng chung 1 database (`DefaultConnection`) nhưng **không bao giờ** query trực tiếp DbContext/entity của module khác — chỉ gọi qua service interface expose trong `*.Contracts` (ví dụ `IStoreService`, `IBrandService`, `IFranchiseeService`). Pattern này áp dụng cho cả module `Report` mới.
- Không có module Report/Analytics nào hiện hữu. Pattern CQRS tham khảo: `GetPagedOrdersQueryHandler` (`NDTCore.Order.Application/Features/Orders/GetPagedOrders/`).
- FE: chưa có chart library nào được cài. Module/trang tham khảo cấu trúc: `modules/order/views/OrdersView.vue` (list + filter + table + pagination) và `OrderDetailView.vue` (header + card layout).

---

## 2. Logic phân quyền truy cập Store (Access Scope)

Mỗi user chỉ có đúng 1 role nghiệp vụ tại 1 thời điểm → scope Store xác định theo đúng 1 nhánh lookup, không cần union nhiều nguồn.

| Role | Nguồn xác định Store | Logic |
|---|---|---|
| OrgAdmin / SuperAdmin | Không qua bảng nào | Thấy tất cả Store toàn Org |
| BrandManager | `AppBrandUser` qua `IBrandService` | Lookup `BrandId` theo `UserId` → lấy tất cả Store thuộc `BrandId` |
| FranchiseeOwner | `AppFranchiseeUser` qua `IFranchiseeService` | Lookup `FranchiseeId` theo `UserId` → lấy tất cả Store thuộc `FranchiseeId` |
| StoreManager / Cashier | `AppStoreUser` qua `IStoreService` | Lookup trực tiếp `StoreId` theo `UserId` |

Scope áp dụng cho cả List và Detail — Detail chỉ cho xem nếu `storeId` truyền vào nằm trong phạm vi scope của user (`403 Forbidden` nếu không).

> Nếu `IStoreService` chưa có method lookup `StoreId[]` theo `UserId` qua `AppStoreUser`, cần bổ sung (mirror pattern `GetFranchiseeByUserIdAsync`).

---

## 3. Backend

### 3.1. Module mới `NDTCore.Report`

4-layer structure chuẩn (Domain / Application / Infrastructure / Contracts), giống các module hiện có. Domain layer của Report module không cần entity riêng (báo cáo là read-only, không persist) — chỉ cần Application (CQRS handlers) + Contracts (DTO).

### 3.2. Cross-module: Order expose aggregate-query service

Thêm vào `NDTCore.Order.Contracts`:

```csharp
public interface IOrderRevenueReportService
{
    /// <summary>
    /// VN: Tổng doanh thu (Order.TotalAmount) và số đơn hàng Completed, group theo StoreId, trong khoảng [from, to]. <br/>
    /// EN: Total revenue (Order.TotalAmount) and Completed order count, grouped by StoreId, within [from, to].
    /// </summary>
    Task<IReadOnlyList<StoreRevenueAggregate>> GetRevenueByStoreAsync(
        IReadOnlyCollection<int> storeIds, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken = default);

    /// <summary>
    /// VN: Doanh thu/số đơn theo bucket thời gian (Ngày/Tuần/Tháng) cho 1 Store, trong khoảng [from, to]. Bucket được truncate theo offset của chính <paramref name="from"/>/<paramref name="to"/> (offset client gửi lên), không tra timezone của Store. <br/>
    /// EN: Revenue/order count per time bucket (Day/Week/Month) for 1 Store, within [from, to]. Buckets are truncated using the offset carried by <paramref name="from"/>/<paramref name="to"/> (the client's offset), not the Store's configured timezone.
    /// </summary>
    Task<IReadOnlyList<RevenueBucketAggregate>> GetRevenueBucketsAsync(
        int storeId, DateTimeOffset from, DateTimeOffset to, BucketGranularity granularity, CancellationToken cancellationToken = default);
}

public record StoreRevenueAggregate(int StoreId, decimal Revenue, int OrderCount);

public record RevenueBucketAggregate(DateOnly BucketStart, decimal Revenue, int OrderCount);

public enum BucketGranularity { Day, Week, Month }
```

- Implementation trong `NDTCore.Order.Infrastructure`, dùng EF Core LINQ `GROUP BY` trực tiếp trên bảng `Order` của `NdtOrderDbContext` (`WHERE Status == "Completed"`, `SUM(TotalAmount)`) — **không join `OrderItem`**. Đây là duy nhất 1 query SQL cho mỗi lời gọi — không pull raw data ra rồi tính tổng ở application layer.
- `GetRevenueBucketsAsync` group theo bucket trong **timezone của client** — FE gửi `from`/`to` dạng `DateTimeOffset` kèm offset của browser người dùng (không phải timezone của Store); BE dùng đúng offset đó để truncate theo Day/Week/Month, không tra `Store.TimeZone`. Tuần bắt đầu **Thứ 2** (ISO 8601).
- Report module **không** tham chiếu `NdtOrderDbContext` hay entity Order — chỉ inject `IOrderRevenueReportService`, giữ đúng encapsulation pattern hiện có.

### 3.3. Endpoint — List

```
GET /api/reports/store-revenue?search=&from=&to=&sort=&page=&pageSize=
```

`GetStoreRevenueListQueryHandler`:
1. Resolve `storeIds` theo scope (mục 2).
2. Lấy danh sách Store trong scope qua `IStoreService`, áp `search` (theo `Name`/`Code`).
3. Gọi `IOrderRevenueReportService.GetRevenueByStoreAsync(storeIds, from, to)` cho **toàn bộ** `storeIds` đã filter theo search (chưa paginate) — vì `sort` theo Doanh thu/Số đơn cần có revenue trước khi paginate.
4. Join revenue vào Store info, áp `sort`, rồi paginate.
5. Trả `PaginatedCollection<StoreRevenueListItemDto>` (theo pattern `GetPagedOrders`).

### 3.4. Endpoint — Detail

```
GET /api/reports/store-revenue/{storeId}?from=&to=&granularity=day|week|month
```

`GetStoreRevenueDetailQueryHandler`:
1. Validate `storeId` nằm trong scope (403 nếu không).
2. Tính kỳ trước: `from_prev`, `to_prev` = kỳ liền trước, cùng độ dài với `[from, to]`.
3. Gọi `GetRevenueBucketsAsync(storeId, from, to, granularity)` cho kỳ hiện tại — `from`/`to` mang offset client gửi lên, dùng luôn offset đó để truncate bucket.
4. Gọi lại `GetRevenueBucketsAsync(storeId, from_prev, to_prev, granularity)` cho kỳ trước (`from_prev`/`to_prev` giữ cùng offset với `from`/`to`) — **2 lời gọi riêng biệt**, mỗi lời gọi trả bucket đã chuẩn theo đúng range của nó (tránh nhập nhằng bucket vắt ranh giới giữa 2 kỳ nếu gộp chung 1 range).
5. KPI cards tính từ tổng kỳ hiện tại:
   - Tổng doanh thu = Σ Revenue các bucket kỳ hiện tại.
   - Tổng số đơn hàng = Σ OrderCount các bucket kỳ hiện tại.
   - AOV = Tổng doanh thu / Tổng số đơn hàng (0 nếu không có đơn).
   - Tăng trưởng % = `(DoanhThu_hiện_tại − DoanhThu_trước) / DoanhThu_trước × 100`; nếu `DoanhThu_trước == 0` → **`null`** (FE hiển thị "—").
6. Bảng chi tiết: map theo bucket kỳ hiện tại, AOV theo từng bucket (0 nếu bucket không có đơn).
7. 2 chart FE nhận data: line chart overlay 2 mảng bucket (hiện tại + trước, theo index tương ứng — cùng số điểm dữ liệu vì cùng độ dài kỳ); bar chart chỉ dùng bucket kỳ hiện tại.

### 3.5. Validation & lỗi

- `from > to` hoặc thiếu param bắt buộc → `400 Bad Request` (FluentValidation validator).
- `storeId` không tồn tại hoặc ngoài scope → `403 Forbidden`.
- Store không có đơn hàng trong kỳ → Revenue/OrderCount/AOV = 0, không loại khỏi kết quả, không lỗi.

### 3.6. Export

```
GET /api/reports/store-revenue/export?format=excel|csv&...        (List)
GET /api/reports/store-revenue/{storeId}/export?format=excel|csv|pdf&...   (Detail)
```

- Endpoint riêng (không param `format` trộn vào endpoint JSON chính) — trả file stream.
- List: export toàn bộ kết quả đã filter/sort (không chỉ trang hiện tại).
- Detail: export bảng chi tiết theo bucket đang chọn + KPI summary ở đầu file.
- **Không có permission riêng cho export** — role nào qua được scope check để xem List/Detail thì export được (cùng 1 authorization, không thêm claim mới).

---

## 4. Frontend

Module mới `NDTCore.FE/src/modules/report/`:

```
modules/report/
├── views/
│   ├── StoreRevenueListView.vue
│   └── StoreRevenueDetailView.vue
├── components/
│   ├── RevenueKpiCards.vue
│   ├── RevenueTrendChart.vue      (line chart, overlay kỳ trước, Chart.js)
│   └── RevenueOrderChart.vue      (bar chart, Chart.js)
├── composables/
│   └── useStoreRevenueReport.ts   (gọi API list/detail, theo pattern useListPage())
└── api/
    └── reportApi.ts
```

- **Chart library**: `chart.js` + `vue-chartjs` (MIT, free) — lần đầu thêm chart vào FE, cần thêm dependency vào `package.json`.
- **List view**: tái dùng `AppDataFilter`/`AppFilterBar` (search + date range + sort), `AppDataTable`, `AppPagination`, `AppEmptyState` — theo pattern `OrdersView.vue`. Mặc định Date Range = "Tháng này".
- **Detail view**: header info Store (Tên, Code, Franchisee, Brand) theo pattern breadcrumb/header của `OrderDetailView.vue`; filter (preset date range + tab Ngày/Tuần/Tháng); `RevenueKpiCards` (4 card); 2 chart; bảng chi tiết bên dưới.
- **Routing**: `/reports/store-revenue` (list), `/reports/store-revenue/:storeId` (detail). Thêm menu "Báo cáo" trong nav — vị trí cụ thể xác nhận khi viết plan (tham khảo cấu trúc nav hiện có).
- Icon "Xem chi tiết" trên List → điều hướng Detail kèm `storeId`.

---

## 5. Edge cases (đã chốt)

| Case | Xử lý |
|---|---|
| Doanh thu kỳ trước = 0 | Tăng trưởng % = `null` → FE hiển thị "—" |
| Store không có đơn hàng trong kỳ | Revenue = 0, OrderCount = 0, AOV = 0 — vẫn hiển thị, không lỗi |
| `storeId` ngoài scope user | `403 Forbidden` |
| `from > to` / thiếu param | `400 Bad Request` |
| Bucket timezone | Dùng offset client gửi trong `from`/`to`, không tra `Store.TimeZone` |
| Granularity = Week | Tuần bắt đầu Thứ 2 (ISO 8601) |
| Quyền export | Không tách riêng — ai xem được List/Detail thì export được |

---

## 6. Ngoài phạm vi (không làm ở bản này)

- KPI "Doanh thu thực nhận" / "Hoàn tiền" — chờ module Refund/Order Cancellation.
- Pre-aggregate table riêng cho revenue — query trực tiếp qua `IOrderRevenueReportService` (EF Core LINQ trên Order tables), chưa cần vì volume chưa lớn.
