# User Management (BE + FE) — Design Spec

## Goal

Xây dựng màn hình quản lý user cho admin (`SuperAdmin`/`OrgAdmin`): danh sách phân trang, tạo mới, sửa profile, xoá mềm, gán role — hoàn thiện phần FE hiện đang trống (`UsersView.vue` rỗng, route `admin:users` tạm trỏ `ComingSoonView.vue`), và bổ sung 2 endpoint BE còn thiếu mà FE đã scaffold sẵn contract.

Đây là phần tiếp theo của nhánh `feature/user-management-access-control` (đã có sẵn 4 fix authorization: `CreateUser`, `AdminGetUserByEmail`, và bỏ `[Authorize(Policy = "AdminOnly")]` chết ở `AdminControllerBase`).

## Bối cảnh hiện trạng (đã khảo sát)

- **FE đã scaffold sẵn nhưng chưa nối:** route `admin:users` (path `users`) và `admin:user-detail` (path `users/:id`) đã có trong `APP_ROUTES`, đã giới hạn role `[SuperAdmin, OrgAdmin]` trong `routes.ts`; menu "Người dùng" đã có trong `menu-config.constants.ts`; `API_ENDPOINTS.IDENTITY.USERS_API.GET_PAGED = '/admin/users'` đã định nghĩa. Route hiện trỏ `ComingSoonView.vue`.
- **FE module `user`** hiện chỉ có self-profile (`getProfileAsync`, `user.store.ts`, `UserProfileDto`) — chưa có api/service/composable/component nào cho admin CRUD.
- **BE `UsersController`** đã có `CreateUser` (POST), `UpdateUser` (PUT `{id}`), `DeleteUser` (DELETE `{id}`), `AssignRoles` (PUT `{id}/roles`), `GetProfile`, `GetByEmail` — nhưng **chưa có endpoint list phân trang** và **chưa có get-by-id**.
- `IUserRepository.GetPagedAsync(UserFilterDto)` và `GetByIdWithRolesAsync(id)` đã tồn tại ở Infrastructure, chỉ chưa có Application handler + Controller endpoint nào gọi tới.
- `UserFilterDto` đã có `Keyword` (kế thừa `PagedRequest`), `IsActive`, `IsLocked`, `RoleNames`, `CreatedAfter`, `CreatedBefore`.
- `AssignRolesRequest.cs` có doc comment sai: ghi "thay thế hoàn toàn roles hiện tại" nhưng `AssignRolesCommandHandler` thực tế chỉ **ADD** role chưa có, không xoá role hiện tại (đã xác nhận khi review handler).
- FE roles hiện chỉ là danh sách tĩnh cố định `SYSTEM_ROLES` (khớp `SystemRoles` bên BE) — không có UI/API tạo role tuỳ ý, nên không cần thêm endpoint list-role cho việc gán role.

## Thiết kế

### 1. BE — thêm 2 query còn thiếu (branch `feature/user-management-access-control`)

**`GetPagedUsersQuery`** (`NDTCore.Identity.Application/Features/Users/GetPagedUsers/`) — theo đúng pattern `GetPagedStoresQuery`:

```csharp
public sealed record GetPagedUsersQuery(UserFilterDto Filter) : IQuery<PaginatedCollection<UserDto>>;
```

- Handler: gọi `_userRepository.GetPagedAsync(request.Filter, cancellationToken)`, map `AppUser` → `UserDto` (đã có sẵn field `Roles` — lấy từ `AppUserRoles`).
- Áp role check SuperAdmin/OrgAdmin giống 4 handler đã fix (không phải role này → `Error.Forbidden`).
- Controller: `[HttpGet]` trên `UsersController` — `GetPagedUsers([FromQuery] UserFilterDto filter)` → `new GetPagedUsersQuery(filter)` → `PagedResult(result)`.

**`AdminGetUserByIdQuery`** (`NDTCore.Identity.Application/Features/Users/AdminGetUserById/`) — giống hệt `AdminGetUserByEmailQueryHandler` nhưng khoá theo `Guid Id`, dùng `GetByIdWithRolesAsync` thay vì `GetByEmailWithRolesAsync`, trả `AdminUserDetailResponse` (tái dùng DTO có sẵn).

- Áp role check SuperAdmin/OrgAdmin giống các handler khác.
- Controller: `[HttpGet("{id:guid}")]` trên `UsersController` (khác verb với `PUT`/`DELETE`/`PUT .../roles` đã có ở cùng route `{id:guid}` — không xung đột).

**Sửa doc sai:** `AssignRolesRequest.cs` — đổi "thay thế hoàn toàn roles hiện tại" thành "chỉ thêm role chưa có, không xoá role hiện tại" cho khớp hành vi thật.

### 2. FE — cấu trúc module `user` (mirror module `store`)

```
modules/user/
├── models/
│   ├── dtos/          user-filter.dto.ts, create-user.dto.ts, update-user.dto.ts,
│   │                  delete-user.dto.ts, assign-roles.dto.ts, admin-user-detail.dto.ts
│   ├── view-models/   user.view-model.ts, user-detail.view-model.ts
│   └── form-models/   user.model.ts (create form), assign-roles.model.ts
├── mappers/           user.mapper.ts, user-detail.mapper.ts
├── adapters/           user.adapter.ts (toForm/toPayload/emptyForm/TRACKED_FIELDS — như store.adapter.ts)
├── api/user.api.ts     + getPagedAsync, getByIdAsync, createAsync, updateAsync, deleteAsync, assignRolesAsync
├── services/user.service.ts   + tương ứng, giữ nguyên getProfileAsync hiện có
├── composables/useUser.ts     (mới — CRUD/list cho admin; tách khỏi user.store.ts vốn chỉ giữ self-profile,
│                                theo quy ước "Pinia store chỉ cho shared/cached state")
├── constants/user-list.constants.ts   (emit keys, columns, row actions, filter fields — KHÔNG có filter Role)
├── components/user/
│   ├── UserList.vue        (giống StoreList.vue — KHÔNG bind row-click → navigate)
│   ├── UserForm.vue        (dialog tạo mới: Email, UserName, Password, FirstName, LastName, Phone, DOB, Gender, IsActive)
│   ├── UserOverviewTab.vue (edit profile: FirstName, LastName, Phone, AvatarUrl (text URL), DOB, Gender, IsActive
│   │                         + AppAuditHistory; Email/UserName hiển thị readonly)
│   └── UserRolesTab.vue    (mới — chip roles hiện tại readonly (không xoá được, BE không hỗ trợ) +
│                             multi-select role tĩnh từ SYSTEM_ROLES (loại SuperAdmin + role đã có) + nút "Gán role")
└── views/
    ├── UsersView.vue       (điền vào file rỗng hiện có — list + create dialog + delete confirm dialog)
    └── UserDetailView.vue  (mới — giống StoreDetailView.vue, 2 tab: "Tổng quan" / "Roles")
```

**Router/nav:**
- `routes.ts`: đổi component route `admin:users` từ `ComingSoonView.vue` → `UsersView.vue`; thêm entry route `admin:user-detail` (`users/:id`) → `UserDetailView.vue`, giữ nguyên `roles: [SuperAdmin, OrgAdmin]` + breadcrumb pattern như các module khác.
- `api.constants.ts`: bổ sung `CREATE`, `GET_BY_ID: (id) => ...`, `UPDATE: (id) => ...`, `DELETE: (id) => ...`, `ASSIGN_ROLES: (id) => ...` vào `IDENTITY.USERS_API` (giữ nguyên `GET_PAGED`, `GET_PROFILE`).

### 3. UX flow

- **List** (`UsersView`): filter **Keyword + IsActive + IsLocked** (không có filter Role). Cột: Họ tên/Email, UserName, Roles (chip), trạng thái, đăng nhập gần nhất. Row actions "Sửa" (điều hướng `user-detail`, không bind row-click) và "Xóa" (confirm dialog).
- **Tạo mới**: dialog `UserForm` từ nút "Tạo user" trên list. Không có field chọn role (BE tự gán `OrgUser`).
- **Sửa** (`UserDetailView` tab "Tổng quan"): PUT profile qua `UpdateUser`. Không đổi được Email/UserName/Password.
- **Gán role** (tab "Roles"): chỉ **thêm**, không xoá — đúng giới hạn thật của `AssignRoles`. Không build nút "xoá role" giả.
- **Xoá**: dựa vào lỗi BE trả về (chặn xoá SuperAdmin/tự xoá chính mình), hiển thị qua toast — không thêm guard phía client.
- **Avatar**: v1 chỉ dùng text field nhập URL, không tích hợp upload ảnh.

## Ngoài phạm vi (đã xác nhận với user)

- Không filter theo Role ở list.
- Không có UI/API tạo role tuỳ ý (roles vẫn là danh sách tĩnh 12 role hệ thống).
- Không tích hợp upload avatar (chỉ text URL).
- Không thêm nút xoá role (BE chưa hỗ trợ).
- Không filter `CreatedAfter`/`CreatedBefore` ở list v1.
- Không thêm guard phía client cho việc xoá SuperAdmin/tự xoá — dựa vào lỗi BE.

## Kiểm thử

- BE: `dotnet build NDTCore.sln` (0 error/warning); test thủ công `GetPagedUsersQuery`/`AdminGetUserByIdQuery` với caller SuperAdmin/OrgAdmin (thành công) và role thấp hơn (Forbidden).
- FE: `npx vue-tsc --build`; kiểm tra trực quan: list phân trang + filter, tạo user mới, sửa profile, gán role (chip cập nhật, không mất role cũ), xoá user (kể cả case bị BE từ chối — SuperAdmin/tự xoá — hiển thị toast lỗi đúng).
