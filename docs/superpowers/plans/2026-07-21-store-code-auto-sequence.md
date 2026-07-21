# Store Code Auto-Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi tạo cửa hàng mới, `Code` được BE tự sinh tuần tự (`000001`, `000002`, ...) theo từng tenant, thay vì admin phải tự nhập tay.

**Architecture:** BE thêm 1 method đếm store hiện có (kể cả đã xóa mềm) trong tenant để tính số tiếp theo, mirror đúng pattern `GetNextOrderSequenceAsync` đã có ở module Order. `CreateStoreCommandHandler` gọi method này thay vì nhận `Code` từ client. FE bỏ ô nhập "Mã cửa hàng" khỏi form tạo và không gửi `Code` trong payload nữa — `StoreFormModel.code` vẫn giữ nguyên trong type (dùng chung cho form edit qua `toForm()`), chỉ không còn hiển thị/gửi đi ở luồng tạo.

**Tech Stack:** .NET 8 + EF Core 8 (BE, CQRS/MediatR/FluentValidation) — Vue 3 (Composition API) + TypeScript strict + Vuetify 3 (FE).

## Global Constraints

- BE: XML doc bắt buộc song ngữ VN/EN cho method mới, theo đúng format `VN: ... <br /> EN: ...` đã dùng xuyên suốt `IAppStoreRepository`.
- BE: Trước khi commit, `dotnet build NDTCore.sln` phải sạch (0 Error).
- FE: TypeScript strict, không dùng `any`.
- FE: Trước khi commit, `npx vue-tsc --build` phải sạch (exit code 0).
- Đếm bằng `IgnoreQueryFilters()` (đếm cả store đã xóa mềm) — đảm bảo Code không bao giờ bị cấp lại, tránh đụng độ với unique index `(TenantId, Code)` đã có sẵn ở DB.
- Đếm riêng theo từng tenant — mỗi tenant bắt đầu từ `000001` độc lập.
- Không thêm cơ chế retry/DB `SEQUENCE` object cho race condition — chấp nhận rủi ro nhỏ giống hệt cách `OrderNumber` hiện tại đang chấp nhận (unique index DB là lưới an toàn cuối, không cần thêm gì).
- Không tách `StoreFormModel` thành 2 type riêng cho create/edit — giữ nguyên field `code` trong type chung, chỉ bỏ UI nhập ở luồng tạo.
- Không đổi bất kỳ hành vi nào của `Code` khi update store (đã bất biến từ trước, giữ nguyên).

---

### Task 1: BE — Repository: `GetNextStoreSequenceAsync`

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/Interfaces/Repositories/IAppStoreRepository.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/Repositories/AppStoreRepository.cs`

**Interfaces:**
- Produces: `IAppStoreRepository.GetNextStoreSequenceAsync(Guid tenantId, CancellationToken cancellationToken = default) : Task<int>` — dùng bởi Task 2.

- [ ] **Step 1: Thêm method vào `IAppStoreRepository.cs`**

Tìm dòng cuối cùng của interface (trước dấu `}` đóng):

```csharp
    /// <summary>
    /// VN: Lấy danh sách ID của tất cả store do một franchisee vận hành. <br />
    /// EN: Returns the IDs of all stores operated by the specified franchisee.
    /// </summary>
    Task<List<int>> GetStoreIdsByFranchiseeIdAsync(int franchiseeId, CancellationToken cancellationToken = default);
}
```

Thay bằng:

```csharp
    /// <summary>
    /// VN: Lấy danh sách ID của tất cả store do một franchisee vận hành. <br />
    /// EN: Returns the IDs of all stores operated by the specified franchisee.
    /// </summary>
    Task<List<int>> GetStoreIdsByFranchiseeIdAsync(int franchiseeId, CancellationToken cancellationToken = default);

    /// <summary>
    /// VN: Đếm số store hiện có (kể cả đã xóa mềm) trong một tenant, dùng để sinh Code tuần tự tiếp theo
    ///     (kết quả = số lượng hiện tại + 1). Đếm cả store đã xóa mềm để tránh cấp lại Code đã dùng. <br />
    /// EN: Counts existing stores (including soft-deleted) within a tenant, used to generate the next
    ///     sequential Code (result = current count + 1). Includes soft-deleted stores to avoid reusing a Code.
    /// </summary>
    /// <param name="tenantId">
    /// VN: ID của tenant cần đếm. <br />
    /// EN: The tenant ID to count within.
    /// </param>
    /// <param name="cancellationToken">
    /// VN: Token để huỷ thao tác bất đồng bộ. <br />
    /// EN: A token to cancel the asynchronous operation.
    /// </param>
    Task<int> GetNextStoreSequenceAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
```

- [ ] **Step 2: Thêm implementation vào `AppStoreRepository.cs`**

Tìm:

```csharp
    /// <inheritdoc />
    public async Task<List<int>> GetStoreIdsByBrandIdAsync(int brandId, CancellationToken cancellationToken = default)
        => await DbContext.Set<AppStore>()
            .Where(s => !s.IsDeleted && s.BrandId == brandId)
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);
```

Thêm ngay sau (giữ nguyên method trên, chỉ chèn thêm method mới liền kề — nếu vị trí thực tế trong file khác với đoạn trích trên, chèn method mới vào cuối class, ngay trước dấu `}` đóng class):

```csharp
    /// <inheritdoc />
    public async Task<List<int>> GetStoreIdsByBrandIdAsync(int brandId, CancellationToken cancellationToken = default)
        => await DbContext.Set<AppStore>()
            .Where(s => !s.IsDeleted && s.BrandId == brandId)
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<int> GetNextStoreSequenceAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var count = await DbContext.Set<AppStore>()
            .IgnoreQueryFilters()
            .CountAsync(s => s.TenantId == tenantId, cancellationToken);

        return count + 1;
    }
```

- [ ] **Step 3: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 4: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/Interfaces/Repositories/IAppStoreRepository.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Infrastructure/Repositories/AppStoreRepository.cs
git commit -m "feat: them GetNextStoreSequenceAsync de sinh ma cua hang tuan tu"
```

---

### Task 2: BE — `CreateStoreCommand`: bỏ Code khỏi input, tự sinh trong handler

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Stores/CreateStoreRequest.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/CreateStore/CreateStoreCommand.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/CreateStore/CreateStoreCommandValidator.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/CreateStore/CreateStoreCommandHandler.cs`

**Interfaces:**
- Consumes: `IAppStoreRepository.GetNextStoreSequenceAsync(Guid, CancellationToken)` (Task 1).
- Produces: `CreateStoreRequest`/`CreateStoreCommand` không còn field `Code` — client (FE, Task 3) không được gửi field này nữa (nếu gửi cũng bị JSON binding bỏ qua vì property không tồn tại).

- [ ] **Step 1: Bỏ `Code` khỏi `CreateStoreRequest.cs`**

Tìm:

```csharp
    public string Name { get; set; } = default!;
    public string Code { get; set; } = default!;
    public string? Slug { get; set; }
```

Thay bằng:

```csharp
    public string Name { get; set; } = default!;
    public string? Slug { get; set; }
```

- [ ] **Step 2: Bỏ `Code` khỏi `CreateStoreCommand.cs`**

Tìm trong constructor:

```csharp
        Name = request.Name;
        Code = request.Code;
        Slug = request.Slug;
```

Thay bằng:

```csharp
        Name = request.Name;
        Slug = request.Slug;
```

Tìm trong property list:

```csharp
    public string Name { get; init; }
    public string Code { get; init; }
    public string? Slug { get; init; }
```

Thay bằng:

```csharp
    public string Name { get; init; }
    public string? Slug { get; init; }
```

- [ ] **Step 3: Bỏ rule validate `Code` trong `CreateStoreCommandValidator.cs`**

Tìm:

```csharp
        RuleFor(x => x.Code)
            .NotEmpty()
                .WithMessage("Code is required.")
            .MaximumLength(50)
                .WithMessage("Code must not exceed 50 characters.")
            .Matches(@"^[a-zA-Z0-9_-]+$")
                .WithMessage("Code must contain only letters, digits, hyphens, or underscores.");

        RuleFor(x => x.Slug)
```

Thay bằng:

```csharp
        RuleFor(x => x.Slug)
```

- [ ] **Step 4: Sửa `CreateStoreCommandHandler.cs` — bỏ check trùng Code, tự sinh Code**

Tìm:

```csharp
        var tenantId = context.TenantId;
        var userEmail = context.Email;

        var codeExists = await _storeRepository.ExistsAsync(
            s => s.Code == request.Code && s.TenantId == tenantId,
            cancellationToken);

        if (codeExists)
        {
            _logger.LogWarning(
                "[{ClassName}.{FunctionName}] Store code already exists: Code={Code}, TenantId={TenantId}",
                nameof(CreateStoreCommandHandler),
                nameof(Handle),
                request.Code,
                tenantId);

            return Result<CreateStoreResponse>.Failure(
                Error.Conflict($"A store with code '{request.Code}' already exists."));
        }

        var now = DateTimeOffset.UtcNow;

        var store = new AppStore
        {
            BrandId = request.BrandId,
            FranchiseeId = request.FranchiseeId,
            Name = request.Name,
            Code = request.Code,
            Slug = request.Slug,
```

Thay bằng:

```csharp
        var tenantId = context.TenantId;
        var userEmail = context.Email;

        var sequence = await _storeRepository.GetNextStoreSequenceAsync(tenantId, cancellationToken);
        var code = sequence.ToString("D6");

        var now = DateTimeOffset.UtcNow;

        var store = new AppStore
        {
            BrandId = request.BrandId,
            FranchiseeId = request.FranchiseeId,
            Name = request.Name,
            Code = code,
            Slug = request.Slug,
```

> Sau bước này, `Error.Conflict` do trùng Code về lý thuyết vẫn có thể xảy ra ở tầng DB (unique index `(TenantId, Code)`) nếu 2 request tạo store cùng tenant chạy đồng thời — chấp nhận được (xem Global Constraints), không cần xử lý thêm trong handler.

- [ ] **Step 5: Build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 6: Kiểm thử thủ công qua curl**

Run `cd NDTCore.BE/src/NDTCore.API && dotnet run --urls "http://localhost:5048"`, đăng nhập SuperAdmin (`admin@ndtcore.com`/`Admin@12345678`, `POST /api/admin/auth/login`), sau đó tạo liên tiếp 2 store (thay `<TOKEN>` bằng `AccessToken`, lấy `<BRAND_ID>` hợp lệ từ `GET /api/admin/brand?PageNumber=1&PageSize=5`):

```bash
curl -s "http://localhost:5048/api/admin/store" -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"BrandId":<BRAND_ID>,"Name":"QA Test Store 1","IsActive":true,"IsAcceptingOrders":true}'
curl -s "http://localhost:5048/api/admin/store" -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"BrandId":<BRAND_ID>,"Name":"QA Test Store 2","IsActive":true,"IsAcceptingOrders":true}'
```

Expected: cả 2 request đều `200`, `Code` trong response tăng dần liên tiếp (vd `000005`, `000006` — tuỳ số store hiện có trong tenant), không cần gửi `Code` trong body.

Kiểm tra thêm kịch bản xóa mềm không bị cấp lại mã: xóa mềm store vừa tạo thứ 2 (`Code` vd `000006`), rồi tạo thêm 1 store mới:

```bash
curl -s "http://localhost:5048/api/admin/store/<STORE_2_ID>" -X DELETE -H "Authorization: Bearer <TOKEN>"
curl -s "http://localhost:5048/api/admin/store" -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"BrandId":<BRAND_ID>,"Name":"QA Test Store 3","IsActive":true,"IsAcceptingOrders":true}'
```

Expected: store mới có `Code` = `000007` (tiếp tục tăng từ số đã xóa, **không** cấp lại `000006` đã bị xóa mềm). Xóa store QA còn lại vừa tạo sau khi test xong (`DELETE /api/admin/store/{id}`). Dừng server.

- [ ] **Step 7: Commit**

```bash
cd NDTCore.BE
git add src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Stores/CreateStoreRequest.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/CreateStore/CreateStoreCommand.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/CreateStore/CreateStoreCommandValidator.cs src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Stores/CreateStore/CreateStoreCommandHandler.cs
git commit -m "feat: tu sinh Code khi tao cua hang, bo nhap tay tu client"
```

---

### Task 3: FE — Bỏ ô nhập "Mã cửa hàng" khỏi form tạo

**Files:**
- Modify: `NDTCore.FE/src/modules/store/components/store/StoreForm.vue`
- Modify: `NDTCore.FE/src/modules/store/models/dtos/create-store.dto.ts`
- Modify: `NDTCore.FE/src/modules/store/adapters/store.adapter.ts`

**Interfaces:**
- Consumes: Task 2 (BE không còn nhận `Code` trong `CreateStoreRequest`).
- Produces: form tạo cửa hàng không còn field "Mã cửa hàng". `StoreFormModel.code` **giữ nguyên trong type** (không xóa) — vẫn dùng bởi `toForm()` khi load dữ liệu store đã tồn tại (edit), chỉ không còn xuất hiện trong `CreateStoreRequest`/`toCreatePayload()`.

- [ ] **Step 1: Bỏ v-col "Mã cửa hàng" trong `StoreForm.vue`**

Tìm:

```vue
        <v-col v-if="!isEdit" cols="12" md="6">
          <v-text-field
            :model-value="localForm.code"
            label="Mã cửa hàng *"
            variant="solo-filled"
            flat
            @update:model-value="update('code', $event)"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="localForm.slug"
```

Thay bằng:

```vue
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="localForm.slug"
```

- [ ] **Step 2: Bỏ `Code` khỏi `CreateStoreRequest` (FE DTO)**

Trong `NDTCore.FE/src/modules/store/models/dtos/create-store.dto.ts`, tìm:

```ts
export interface CreateStoreRequest {
    BrandId: number
    FranchiseeId?: number | null
    Name: string
    Code: string
    Slug?: string | null
```

Thay bằng:

```ts
export interface CreateStoreRequest {
    BrandId: number
    FranchiseeId?: number | null
    Name: string
    Slug?: string | null
```

- [ ] **Step 3: Bỏ `Code` khỏi `toCreatePayload()` trong `store.adapter.ts`**

Tìm:

```ts
export function toCreatePayload(form: StoreFormModel): CreateStoreRequest {
    return {
        BrandId: form.brandId!,
        FranchiseeId: form.franchiseeId ?? null,
        Name: form.name.trim(),
        Code: form.code.trim(),
        Slug: form.slug?.trim() ?? null,
```

Thay bằng:

```ts
export function toCreatePayload(form: StoreFormModel): CreateStoreRequest {
    return {
        BrandId: form.brandId!,
        FranchiseeId: form.franchiseeId ?? null,
        Name: form.name.trim(),
        Slug: form.slug?.trim() ?? null,
```

> Không đổi `toForm()`/`emptyForm()`/`StoreFormModel` — `code` vẫn giữ nguyên ở đó (dùng khi load form edit từ store đã tồn tại), chỉ không còn được gửi đi khi tạo mới.

- [ ] **Step 4: Type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: exit code 0, 0 lỗi.

- [ ] **Step 5: Commit**

```bash
cd NDTCore.FE
git add src/modules/store/components/store/StoreForm.vue src/modules/store/models/dtos/create-store.dto.ts src/modules/store/adapters/store.adapter.ts
git commit -m "feat: bo o nhap Ma cua hang o form tao, BE tu sinh Code"
```

---

### Task 4: Kiểm thử thủ công đầu-cuối trên dev server

**Files:** Không sửa file — chỉ chạy backend + frontend và quan sát.

**Interfaces:**
- Consumes: kết quả Task 1-3.

- [ ] **Step 1: Chạy BE**

Run: `cd NDTCore.BE/src/NDTCore.API && dotnet run`
Expected: API khởi động không lỗi.

- [ ] **Step 2: Chạy FE dev server**

Run: `cd NDTCore.FE && npm run dev`
Expected: Vite serve không lỗi compile.

- [ ] **Step 3: Verify form tạo cửa hàng**

Đăng nhập `admin@ndtcore.com`/`Admin@12345678`, vào "Cửa hàng" → "Tạo cửa hàng":
1. Form không còn ô "Mã cửa hàng" (chỉ còn Thương hiệu, Nhà nhượng quyền, Tên cửa hàng, Slug, ...).
2. Điền Tên cửa hàng + chọn Thương hiệu → Lưu → toast thành công, store mới xuất hiện trong danh sách với `Code` tự sinh (vd `000007`).
3. Tạo thêm 1 store nữa ngay sau đó → xác nhận `Code` mới = `Code` trước + 1 (liên tục tăng).
4. Vào trang chi tiết 1 trong 2 store vừa tạo → xác nhận header hiển thị đúng `Code` tự sinh.

Expected: đúng như mô tả, không có lỗi console.

- [ ] **Step 4: Dọn dẹp**

Xóa 2 store QA vừa tạo ở Step 3 qua UI (nút Xóa trong danh sách). Dừng cả 2 server.

---
