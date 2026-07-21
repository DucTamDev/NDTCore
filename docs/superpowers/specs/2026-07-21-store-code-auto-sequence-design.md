# Store Code Auto-Sequence — Design Spec

## Goal

Khi tạo cửa hàng mới, `Code` (mã cửa hàng) được BE tự sinh tuần tự (`000001`, `000002`, ...) thay vì admin phải tự nhập tay như hiện tại. Loại bỏ hoàn toàn khả năng nhập sai/trùng mã do gõ tay.

## Bối cảnh hiện trạng (đã khảo sát)

- `CreateStoreCommand`/`CreateStoreRequest` hiện yêu cầu client gửi `Code` (bắt buộc, tối đa 50 ký tự, chỉ chữ/số/`-`/`_`). `CreateStoreCommandHandler` kiểm tra trùng `Code` trong cùng tenant trước khi insert, trả `Error.Conflict` nếu trùng.
- DB có unique index `(TenantId, Code)` trên bảng `AppStores` (`AppStoreConfiguration.cs`).
- `Code` **bất biến sau khi tạo** — `UpdateStoreCommand`/Handler không có field `Code`, không cho sửa lại.
- Không có seeder/convention có sẵn nào cho `Code` — dữ liệu test hiện tại (`CUAHANG_854678`...) là nhập tay thủ công qua API, không phải từ script trong repo.
- FE (`StoreForm.vue`) có ô "Mã cửa hàng" nhưng **chỉ hiện khi tạo mới** (`v-if="!isEdit"`), không có validate client-side (chỉ validate server-side). Field này thuộc `CreateStoreFormModel`, gửi qua `toCreatePayload()` trong `store.adapter.ts`.
- Module **Order** đã có sẵn pattern sinh số tuần tự tương tự cho `OrderNumber`, dùng làm khuôn mẫu trực tiếp cho spec này:
  - `IAppOrderRepository.GetNextOrderSequenceAsync(tenantId, storeId, orderDate, ...)` — đếm bằng `COUNT` với `IgnoreQueryFilters()` (đếm cả bản ghi đã xóa mềm, tránh cấp lại số cũ).
  - `OrderNumberFormatter.Build(...)` — format chuỗi số thành mã cuối cùng.
  - Handler gọi 2 hàm trên theo thứ tự: đếm → format → gán.

## Thiết kế

### 1. BE — Bỏ `Code` khỏi input, tự sinh trong handler

**`CreateStoreRequest.cs`**: xóa property `Code`.

**`CreateStoreCommand.cs`**: xóa property `Code` (không còn nhận từ request).

**`CreateStoreCommandValidator.cs`**: xóa toàn bộ 3 rule `RuleFor(x => x.Code)` (NotEmpty/MaximumLength/Matches).

**`IAppStoreRepository`**: thêm method mới

```csharp
/// <summary>
/// VN: Đếm số store hiện có (kể cả đã xóa mềm) trong một tenant, dùng để sinh Code tuần tự tiếp theo. <br />
/// EN: Counts existing stores (including soft-deleted) within a tenant, used to generate the next sequential Code.
/// </summary>
Task<int> GetNextStoreSequenceAsync(Guid tenantId, CancellationToken cancellationToken = default);
```

**`AppStoreRepository.cs`** implementation:

```csharp
public async Task<int> GetNextStoreSequenceAsync(Guid tenantId, CancellationToken cancellationToken = default)
{
    var count = await DbContext.Set<AppStore>()
        .IgnoreQueryFilters()
        .CountAsync(s => s.TenantId == tenantId, cancellationToken);

    return count + 1;
}
```

`IgnoreQueryFilters()` đếm cả store đã xóa mềm — đảm bảo Code không bao giờ bị cấp lại (tránh đụng độ với unique index `(TenantId, Code)` nếu store cũ đã bị xóa nhưng row vẫn còn trong DB).

**`CreateStoreCommandHandler.cs`**: trước khi tạo entity `AppStore`, gọi `GetNextStoreSequenceAsync(tenantId)`, format `sequence.ToString("D6")`, gán vào `store.Code`. Bỏ bước kiểm tra trùng `Code` hiện có (không còn cần thiết vì Code không đến từ client nữa — nhưng giữ nguyên unique index ở DB làm lưới an toàn cuối cùng cho race condition).

**Race condition (chấp nhận được, giống hệt rủi ro đã có ở `OrderNumber`)**: đếm bằng `COUNT` có thể trùng nếu 2 request tạo store cùng tenant chạy đồng thời. Nếu trùng, unique index DB sẽ chặn insert, EF ném exception → admin thấy lỗi, thử tạo lại. Tần suất tạo store rất thấp (thao tác admin, không phải luồng POS tần suất cao) nên không cần retry-loop hay DB `SEQUENCE` object — nhất quán với cách `OrderNumber` đang chấp nhận rủi ro này.

### 2. FE — Bỏ input "Mã cửa hàng" khỏi form tạo

**`StoreForm.vue`**: xóa toàn bộ khối `<v-col v-if="!isEdit">` chứa input "Mã cửa hàng".

**`models/dtos/create-store.dto.ts`**: xóa `Code` khỏi `CreateStoreRequest`.

**`store.adapter.ts`**: `toCreatePayload()` không còn gửi `Code`. Xóa `code` khỏi `CreateStoreFormModel`/`emptyForm()` nếu xác nhận không còn dùng ở nơi nào khác (edit form hiện không hiển thị field này — sẽ verify chính xác lúc viết implementation plan).

**Không đổi**: `CreateStoreResponse`/`StoreViewModel` vẫn có `code` — `StoreDetailView.vue` (header) và cột Code trong `StoreList.vue` tiếp tục hiển thị đúng, giờ là giá trị BE tự sinh.

## Ngoài phạm vi

- Không đổi định dạng/logic sinh `OrderNumber` (module Order) — chỉ tham khảo pattern, không sửa code hiện có.
- Không thêm khả năng admin tự chọn/sửa `Code` sau khi tạo — giữ nguyên tính bất biến hiện tại.
- Không thêm cơ chế preview mã trước khi submit — mã chỉ xuất hiện sau khi tạo thành công.
- Không xử lý backfill/đổi lại `Code` cho các store đã tồn tại — chỉ áp dụng cho store tạo mới sau khi tính năng này lên.

## Kiểm thử

- BE: `dotnet build NDTCore.sln` sạch; kiểm thử thủ công qua curl — tạo liên tiếp vài store cùng tenant, xác nhận `Code` tăng dần đúng `000001`, `000002`...; tạo store ở tenant khác, xác nhận đếm lại từ `000001` (độc lập theo tenant); xóa mềm 1 store rồi tạo store mới, xác nhận Code mới không trùng với Code đã xóa.
- FE: `npx vue-tsc --build` sạch; kiểm tra trực quan form tạo cửa hàng không còn ô "Mã cửa hàng"; sau khi tạo thành công, xác nhận trang chi tiết cửa hàng hiển thị đúng mã BE vừa sinh.
