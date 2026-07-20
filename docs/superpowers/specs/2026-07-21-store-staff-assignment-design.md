# Store Staff Assignment — Design Spec

## Goal

Cho phép SuperAdmin/OrgAdmin (toàn quyền) và FranchiseeOwner (giới hạn trong franchisee của mình) gán/gỡ user (đã có role `StoreManager`/`Cashier`/`OrderStaff`) làm thành viên của một cửa hàng, thông qua một tab "Nhân viên" trong trang chi tiết cửa hàng.

Đây là mảnh còn thiếu của tính năng **store-access-by-role** (`docs/superpowers/specs/2026-07-05-store-access-by-role-design.md`, đã implement): cơ chế scope quyền theo `AppStoreUser` (giới hạn danh sách store, tạo đơn POS theo store mà user là thành viên) đã hoạt động, nhưng **chưa từng có API/UI nào để thực sự tạo bản ghi `AppStoreUser`** — bảng này hiện trống với mọi user thật (kể cả user seed `orderstaff@ndtcore.com`), nên tính năng scope-by-role trên thực tế luôn trả về danh sách rỗng cho `StoreManager`/`Cashier`/`OrderStaff`.

## Bối cảnh hiện trạng (đã khảo sát)

- `AppStoreUser` (`NDTCore.Store.Domain.Entities`) hiện chỉ có `TenantId`, `StoreId`, `UserId` — composite PK `(StoreId, UserId)`, cascade delete theo Store, không có audit field, không có navigation tới `AppUser` (module isolation).
- `IAppStoreRepository.GetStoreIdsByUserIdAsync(userId)` đã tồn tại (dùng cho scope quyền), nhưng **không có method write nào** cho `AppStoreUser` — không có repository riêng cho entity này.
- FE có sẵn 1 trang placeholder: `StoreMembersView.vue` (route `store-members`, top-level, role `SuperAdmin/OrgAdmin/FranchiseeOwner`) render `StoreMemberList.vue` — component này chỉ là `AppEmptyState` báo "tính năng đang phát triển". Không có API file, composable, hay mapper nào cho store member.
- `StoreDetailView.vue` hiện chỉ có 1 tab "Tổng quan" (`StoreOverviewTab.vue`).
- **Precedent gần như y hệt đã có sẵn và đang chạy tốt**: module Brand có `AppFranchiseeUser` (shape tương tự `AppStoreUser`, không audit field) với đầy đủ CRUD:
  - `GetFranchiseeMembersQueryHandler` — liệt kê member, enrich tên/email/role qua `IUserService.GetUsersByIdsAsync(userIds)` (Identity module, đã public, không cần cross-module contract mới — `IIdentityModuleContract` hiện là interface rỗng/chưa implement, không dùng).
  - `AssignUsersToFranchiseeCommandHandler` — nhận `List<Guid> UserIds`, bỏ qua user đã là thành viên (không lỗi trùng), insert hàng loạt qua `IFranchiseeUserRepository.AddRangeAsync`.
  - `RemoveUserFromFranchiseeCommandHandler` — tìm bản ghi theo `(FranchiseeId, UserId)`, 404 nếu không phải thành viên, xóa qua `.Remove(entity)`.
  - `IFranchiseeUserRepository` — interface gọn: `GetByFranchiseeIdAsync`, `GetByFranchiseeIdAndUserIdsAsync`, `ExistsAsync`, `AddRangeAsync`, `Remove`.
  - Controller: `POST {base}/{id}/users` (assign), `DELETE {base}/{id}/users/{userId}` (remove), dưới `FranchiseeController`.
  - **Khác biệt cần thêm cho Store** (Franchisee precedent không có): (1) check role StoreManager/Cashier/OrderStaff của user trước khi cho gán, (2) check scope FranchiseeOwner chỉ được thao tác trên store thuộc franchisee của mình.
- `GetPagedUsers` (Identity module, `/api/admin/users`) đã hỗ trợ sẵn filter `RoleNames: string[]` ở cả BE (`UserFilterDto.RoleNames`, áp dụng trong `UserRepository.ApplyFilters`) và FE (`UserFilterDto.RoleNames` DTO) — dùng lại được ngay cho ô tìm user theo role, không cần endpoint tìm-kiếm-user mới.
- `AppUserRole` (Identity module) đã có sẵn 2 cột audit tương tự mong muốn: `AssignedAt: DateTimeOffset`, `AssignedBy: string?` — dùng làm khuôn mẫu type cho `AppStoreUser`.

## Quyết định đã chốt với user

- UI: tab "Nhân viên" trong `StoreDetailView.vue` — **không** dùng trang độc lập `StoreMembersView.vue` (sẽ xóa hẳn trang này + route + component placeholder).
- Chỉ cho gán user đã có role `StoreManager`/`Cashier`/`OrderStaff` — không cho gán tùy ý user khác (vd SuperAdmin, FranchiseeOwner).
- Quyền quản lý (gán/gỡ): SuperAdmin/OrgAdmin — toàn bộ store; FranchiseeOwner — chỉ store thuộc franchisee của mình. Vai trò khác không được thao tác.
- Thêm audit field `AssignedAt`/`AssignedBy` vào `AppStoreUser` (cần 1 EF migration).

## Thiết kế

### 1. BE — Domain: mở rộng `AppStoreUser`

`NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Domain/Entities/AppStoreUser.cs` — thêm 2 property (giống hệt shape `AppUserRole.AssignedAt`/`AssignedBy`):

```csharp
public DateTimeOffset AssignedAt { get; set; }
public string? AssignedBy { get; set; }
```

Cập nhật `AppStoreUserConfiguration.cs` (EF Fluent API) nếu cần khai báo `IsRequired()` cho `AssignedAt`. Handler ghi (Task Assign) luôn set 2 field này tường minh khi tạo bản ghi (`AssignedAt = DateTimeOffset.UtcNow`, `AssignedBy = _contextAccessor.Context.UserId`) — không dựa vào default value SQL, tránh lặp lại lỗi `TenantId = Guid.Empty` đã gặp với `AppUserRole` (nơi Identity's `UserManager.AddToRolesAsync` không biết set các cột tùy biến). Ở đây write đi thẳng qua repository tự viết, không qua UserManager, nên không có rủi ro tương tự.

### 2. BE — Repository mới `IAppStoreUserRepository`

`NDTCore.Store.Contracts/Interfaces/Repositories/IAppStoreUserRepository.cs` (copy shape `IFranchiseeUserRepository`):

```csharp
public interface IAppStoreUserRepository
{
    Task<List<AppStoreUser>> GetByStoreIdAsync(int storeId, CancellationToken cancellationToken = default);
    Task<List<AppStoreUser>> GetByStoreIdAndUserIdsAsync(
        int storeId, IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(int storeId, Guid userId, CancellationToken cancellationToken = default);
    Task AddRangeAsync(IEnumerable<AppStoreUser> entities, CancellationToken cancellationToken = default);
    void Remove(AppStoreUser entity);
}
```

Implementation: `NDTCore.Store.Infrastructure/Repositories/AppStoreUserRepository.cs`. Đăng ký DI trong `AddStoreRepositories` (cùng chỗ với `IAppStoreRepository` hiện có).

### 3. BE — 3 tính năng Application (CQRS)

Tất cả đặt trong `NDTCore.Store.Application/Features/Stores/` (thư mục con mới, ví dụ `GetStoreMembers/`, `AssignStoreMembers/`, `RemoveStoreMember/`), theo đúng cấu trúc `Command/Query + Handler + Validator` đã dùng xuyên suốt module.

**Scope-check dùng chung**: 1 static helper class mới `StoreMemberScopeValidator` trong `NDTCore.Store.Application/Common/` (dùng chung cho cả 3 handler bên dưới — cùng module nên không có rủi ro phụ thuộc ngược, khác với case `GetPosStoreStatusQueryHandler`/`GetPosCatalogQueryHandler` phải viết cục bộ riêng vì đó là module khác không được phụ thuộc `Order.Application`). Cấu trúc tương tự `OrderScopeValidator` đã có:

```text
- SuperAdmin/OrgAdmin → cho phép, không cần load thêm gì.
- FranchiseeOwner → load store, load franchisee của caller (IFranchiseeService.GetFranchiseeByUserIdAsync),
  so store.FranchiseeId với franchisee.Id, Forbidden nếu khác/không có franchisee.
- Role khác → Forbidden ngay.
```

**a) `GetStoreMembersQuery(int StoreId)` → `List<StoreMemberResponse>`**
- Scope-check → load store (404 nếu không tồn tại/khác tenant) → `_storeUserRepository.GetByStoreIdAsync(storeId)` → lấy `userIds` → `_userService.GetUsersByIdsAsync(userIds)` (Identity, `NDTCore.Identity.Contracts.Interfaces.Services`, đã public) → join thành `StoreMemberResponse { UserId, FullName, Email, UserName, AvatarUrl, IsActive, Roles, AssignedAt }` (giống hệt `FranchiseeMemberResponse`).

**b) `AssignStoreMembersCommand(int StoreId, AssignStoreMembersRequest Request)`** — `Request = { UserIds: List<Guid> }`
- Scope-check → load store (404) → `_userService.GetUsersByIdsAsync(request.UserIds)`:
  - Nếu thiếu UserId nào (không tồn tại) → `Error.NotFound` liệt kê.
  - Nếu user tồn tại nhưng **không có** role `StoreManager`/`Cashier`/`OrderStaff` nào → `Error.Forbidden` liệt kê user không hợp lệ (kèm role hiện có, để dễ debug).
- Diff với `GetByStoreIdAndUserIdsAsync` hiện có → chỉ insert `UserIds` chưa là thành viên (bỏ qua trùng, không lỗi — giống Franchisee).
- Insert `AppStoreUser` mới với `AssignedAt = UtcNow`, `AssignedBy = context.UserId`, `TenantId = context.TenantId` → `SaveChangesAsync` qua `IStoreUnitOfWork`.

**c) `RemoveStoreMemberCommand(int StoreId, Guid UserId)`**
- Scope-check → tìm bản ghi qua `GetByStoreIdAndUserIdsAsync(storeId, [userId])` → 404 nếu không phải thành viên → `.Remove(entity)` → save.

### 4. BE — Controller

Thêm vào `NDTCore.API/Controllers/Modules/Store/Admin/StoreController.cs` (đã có Create/GetPaged/GetById/Update/Delete), theo đúng route pattern `FranchiseeController`:

```text
GET    /api/admin/stores/{id:int}/members
POST   /api/admin/stores/{id:int}/members       body: { UserIds: Guid[] }
DELETE /api/admin/stores/{id:int}/members/{userId:guid}
```

### 5. BE — Migration

```bash
# Từ NDTCore.BE/src/NDTCore.API/
dotnet ef migrations add AddAppStoreUserAssignmentAudit \
  --context NdtStoreContext \
  --project ../NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure \
  --startup-project . \
  --output-dir Persistence/Migrations
```

### 6. FE — Tab "Nhân viên" trong `StoreDetailView.vue`

Thêm tab thứ 2 song song "Tổng quan" (giữ nguyên toàn bộ cấu trúc/logic tab hiện có):

```vue
<v-tab value="members" class="text-none" rounded="lg">
  <v-icon start icon="mdi-account-group-outline" size="18" />
  Nhân viên
</v-tab>
...
<v-window-item value="members">
  <StoreStaffTab :store-id="store.data.value.id" />
</v-window-item>
```

`StoreStaffTab.vue` (`src/modules/store/components/store/`) — tab tự quản lý dữ liệu riêng (không qua dirty-tracking/save như tab Tổng quan, tương tự cách `ProductStoreOverridesTab.vue` tự fetch dữ liệu con của nó):
- `onMounted`: fetch danh sách thành viên hiện tại (`GetStoreMembers`).
- Danh sách: mỗi dòng hiển thị tên/email + chip role + nút xóa (mở `AppConfirmDialog` trước khi gọi API xóa).
- Nút "Thêm thành viên" → `AppDialog` chứa `v-autocomplete` (multiple) gọi `getPagedUsersAsync({ RoleNames: ['StoreManager','Cashier','OrderStaff'], Keyword })` debounce theo input, loại user đã là thành viên khỏi kết quả hiển thị → chọn xong bấm "Gán" → gọi `AssignStoreMembers` → refresh danh sách.
- Nút Thêm/Xóa chỉ render khi `useAuth()` cho biết user hiện tại có role SuperAdmin/OrgAdmin/FranchiseeOwner (ẩn UI cho gọn — BE vẫn là chốt chặn thật qua scope-check ở trên).

**File mới**:
- `models/dtos/store-member.dto.ts` — `StoreMemberDto`, `AssignStoreMembersRequest`
- `models/view-models/store-member.view-model.ts` — `StoreMemberViewModel`
- `mappers/store-member.mapper.ts`
- `api/store-member.api.ts` — 3 method (get/assign/remove)
- `services/store-member.service.ts`
- `composables/useStoreMember.ts`
- `components/store/StoreStaffTab.vue`

Chọn tách file riêng (không nhét vào `store.api.ts`/`useStore.ts` hiện có) để tránh phình file, theo đúng nguyên tắc "mỗi file một trách nhiệm rõ ràng" đã áp dụng cho module `user`.

### 7. Dọn dẹp

Xóa: `StoreMembersView.vue`, `StoreMemberList.vue`, entry route `store-members` trong `routes.ts`, `STORE_MEMBERS` trong `app-routes.constants.ts` (kiểm tra không còn tham chiếu nơi khác trước khi xóa), menu item liên quan (nếu có trong nav config).

## Ngoài phạm vi

- Không thêm cột "vai trò tại store" riêng trong `AppStoreUser` — role vẫn là 1 thuộc tính toàn hệ thống của user (Identity module), không theo từng store.
- Không cho phép StoreManager/Cashier tự quản lý thành viên store của mình (chỉ SuperAdmin/OrgAdmin/FranchiseeOwner).
- Không xây picker/autocomplete dùng chung ở `components/ui/` — dùng trực tiếp `v-autocomplete` + `getPagedUsersAsync` trong `StoreStaffTab.vue`, vì đây là nhu cầu cục bộ, chưa có tiền lệ cần tái sử dụng nơi khác.
- Không backfill dữ liệu cho user seed hiện có (`orderstaff@ndtcore.com` sẽ vẫn chưa thuộc store nào cho tới khi admin gán thủ công qua UI mới) — ngoài phạm vi spec này.

## Kiểm thử

- BE: `dotnet build NDTCore.sln` sạch; kiểm thử thủ công qua curl/dev server với các role SuperAdmin, FranchiseeOwner (store trong/ngoài franchisee), OrderStaff (bị chặn hoàn toàn ở 3 endpoint mới); case gán user không có role StoreManager/Cashier/OrderStaff → bị từ chối; gán trùng → không lỗi, không tạo bản ghi trùng; xóa user không phải thành viên → 404.
- FE: `npx vue-tsc --build` sạch; kiểm thử thủ công tab "Nhân viên": load danh sách, thêm thành viên (autocomplete tìm đúng theo role + từ khóa), xóa thành viên (có confirm), ẩn nút Thêm/Xóa khi không đủ quyền.
- Sau khi gán thành công: xác nhận `GET /api/admin/users` (paged list, danh sách "Bán hàng") của user vừa gán giờ trả về đúng store — khép kín vòng với tính năng store-access-by-role đã build trước đó.
