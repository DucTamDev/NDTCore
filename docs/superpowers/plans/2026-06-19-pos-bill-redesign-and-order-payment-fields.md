# POS Bill Redesign & Order Payment Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ServiceType.Delivery`, `DeliveryFee`, `AmountReceived`/`ChangeAmount` to the Order create/read flow end-to-end (BE Domain → Contracts → Application → FE DTOs/stores/UI), expose store `Phone` (hotline) on the POS status endpoint, and rewrite `build-bill-html.util.ts` as a modern, flexbox-based bill layout optimized for 58mm/80mm thermal printers.

**Architecture:** Backend changes follow the existing 4-layer-per-module flow (Domain entity → EF configuration → migration → Contracts DTOs → Application command/query/validator/handler). Frontend changes follow `enum → constants → DTO → store → component → bill util` so each layer's consumers always see types that already exist in an earlier task.

**Tech Stack:** .NET 8 (EF Core, MediatR, FluentValidation) for BE; Vue 3 Composition API + Pinia + TypeScript strict for FE.

## Global Constraints

- BE: every new `class`/`interface`/`method`/`property` (including private) needs bilingual XML doc (`VN: ... <br /> EN: ...`), per `NDTCore.BE/CLAUDE.md`.
- BE: `TotalAmount = Subtotal - DiscountAmount + TaxAmount + DeliveryFee` (changed formula, was without `DeliveryFee`).
- BE: EF migration output directory is `Persistence/Migrations/OrderDb` (NOT the generic `Persistence/Migrations` shown in `NDTCore.BE/CLAUDE.md`'s template command) — this is the real convention already used by every existing Order-module migration (verified via `20260618082303_Add_OrderServiceType.cs`, namespace `NDTCore.Order.Infrastructure.Persistence.Migrations.OrderDb`).
- BE: cash-payment validation (`AmountReceived >= TotalAmount`) happens in `CreateOrderCommandHandler`, not the validator — `TotalAmount` isn't known until items are summed in the handler.
- FE: TypeScript strict, no `any`; DTOs mirror backend field names and order exactly (no renames) per `NDTCore.FE/.claude/rules/convention.md` §9.
- FE: errors surface automatically via the global `ApiClient` Axios interceptor — no new try/catch or `handleApiError` calls are needed anywhere in this plan.
- No automated test suite exists for the Order/Store BE modules or the FE `pos` module (confirmed via glob: `**/*Tests*/**/*.cs` and `**/*.test.ts` both return zero files). Per `NDTCore.BE/.claude/rules/git-workflow.md` and `NDTCore.FE/CLAUDE.md`, the verification step for every task is **build/type-check**, not a unit test run:
  - BE: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
  - FE: `cd NDTCore.FE && npx vue-tsc --build`
- Commit message format: `<type>: <short description>` (types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`), per `.claude/rules/git-workflow.md`. One commit per task.

---

### Task 1: `ServiceType` domain constant — add `Delivery`

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Domain/Constants/ServiceType.cs`

**Interfaces:**
- Produces: `ServiceType.Delivery` (`const string` = `"Delivery"`), `ServiceType.IsValid(string)` now also accepts `"Delivery"`. Later tasks (3, 4, 5, 6) reference `ServiceType.Delivery`.

- [ ] **Step 1: Add the constant and update `IsValid`**

Replace the full file content:

```csharp
namespace NDTCore.Order.Domain.Constants;

/// <summary>
/// VN: Hằng số loại hình phục vụ đơn hàng, lưu dạng string trong DB. <br />
/// EN: String constants representing order service type, stored as string in the database.
/// </summary>
public static class ServiceType
{
    /// <summary>VN: Mang đi. EN: Take away.</summary>
    public const string TakeAway = "TakeAway";

    /// <summary>VN: Ngồi lại tại quán. EN: Dine in at the store.</summary>
    public const string DineIn = "DineIn";

    /// <summary>VN: Giao hàng. EN: Delivery.</summary>
    public const string Delivery = "Delivery";

    /// <summary>
    /// VN: Xác định xem giá trị đã cho có phải là loại hình phục vụ hợp lệ không. <br />
    /// EN: Determines whether the given value is a valid service type.
    /// </summary>
    public static bool IsValid(string value) => value is TakeAway or DineIn or Delivery;
}
```

- [ ] **Step 2: Verify build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Domain/Constants/ServiceType.cs
git commit -m "feat: add Delivery service type constant"
```

---

### Task 2: `Order` entity + EF configuration + migration — `DeliveryFee`/`AmountReceived`/`ChangeAmount`

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Domain/Entities/Order.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Persistence/Configurations/OrderConfiguration.cs`
- Create (via EF tooling): migration under `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Persistence/Migrations/OrderDb/`

**Interfaces:**
- Produces: `Order.DeliveryFee` (`decimal`), `Order.AmountReceived` (`decimal?`), `Order.ChangeAmount` (`decimal?`). Tasks 3–6 read/write these properties on the `Order` entity (aliased `OrderEntity` in Application-layer files).

- [ ] **Step 1: Add the three properties to `Order.cs`**

In the `// ── Pricing ──` region, replace:

```csharp
    /// <summary>
    /// VN: Tổng thuế áp dụng cho đơn hàng; ≥ 0. <br />
    /// EN: Total tax applied to the order; ≥ 0.
    /// </summary>
    public decimal TaxAmount { get; set; }

    /// <summary>
    /// VN: Số tiền phải trả sau cùng = Subtotal - DiscountAmount + TaxAmount; ≥ 0. <br />
    /// EN: Final amount due = Subtotal - DiscountAmount + TaxAmount; ≥ 0.
    /// </summary>
    public decimal TotalAmount { get; set; }
```

with:

```csharp
    /// <summary>
    /// VN: Tổng thuế áp dụng cho đơn hàng; ≥ 0. <br />
    /// EN: Total tax applied to the order; ≥ 0.
    /// </summary>
    public decimal TaxAmount { get; set; }

    /// <summary>
    /// VN: Phí giao hàng, chỉ có giá trị khi ServiceType là Delivery, mặc định 0. <br />
    /// EN: Delivery fee, only meaningful when ServiceType is Delivery, defaults to 0.
    /// </summary>
    public decimal DeliveryFee { get; set; }

    /// <summary>
    /// VN: Số tiền phải trả sau cùng = Subtotal - DiscountAmount + TaxAmount + DeliveryFee; ≥ 0. <br />
    /// EN: Final amount due = Subtotal - DiscountAmount + TaxAmount + DeliveryFee; ≥ 0.
    /// </summary>
    public decimal TotalAmount { get; set; }
```

In the `// ── Payment ──` region, replace:

```csharp
    /// <summary>
    /// VN: Trạng thái thanh toán; xem <see cref="PaymentStatus"/>. <br />
    /// EN: Payment status; see <see cref="PaymentStatus"/>.
    /// </summary>
    public string? PaymentStatus { get; set; }

    /// <summary>
    /// VN: Thời điểm thanh toán thành công; null nếu chưa thanh toán. <br />
    /// EN: Timestamp when payment was confirmed; null if not yet paid.
    /// </summary>
    public DateTimeOffset? PaidAt { get; set; }
```

with:

```csharp
    /// <summary>
    /// VN: Trạng thái thanh toán; xem <see cref="PaymentStatus"/>. <br />
    /// EN: Payment status; see <see cref="PaymentStatus"/>.
    /// </summary>
    public string? PaymentStatus { get; set; }

    /// <summary>
    /// VN: Số tiền khách đưa khi thanh toán bằng tiền mặt, <see langword="null"/> nếu không phải Cash. <br />
    /// EN: Amount received from customer for cash payment, <see langword="null"/> when payment method is not Cash.
    /// </summary>
    public decimal? AmountReceived { get; set; }

    /// <summary>
    /// VN: Tiền thừa trả khách, tính server-side = AmountReceived - TotalAmount, <see langword="null"/> nếu không phải Cash. <br />
    /// EN: Change returned to customer, server-computed as AmountReceived - TotalAmount, <see langword="null"/> when payment method is not Cash.
    /// </summary>
    public decimal? ChangeAmount { get; set; }

    /// <summary>
    /// VN: Thời điểm thanh toán thành công; null nếu chưa thanh toán. <br />
    /// EN: Timestamp when payment was confirmed; null if not yet paid.
    /// </summary>
    public DateTimeOffset? PaidAt { get; set; }
```

- [ ] **Step 2: Add EF configuration**

In `OrderConfiguration.cs`, replace:

```csharp
        // ----- PRICING -----
        builder.Property(o => o.Subtotal).IsRequired().HasPrecision(18, 2);
        builder.Property(o => o.DiscountAmount).IsRequired().HasPrecision(18, 2);
        builder.Property(o => o.TaxAmount).IsRequired().HasPrecision(18, 2);
        builder.Property(o => o.TotalAmount).IsRequired().HasPrecision(18, 2);

        // ----- PAYMENT -----
        builder.Property(o => o.PaymentMethod).HasMaxLength(50);
        builder.Property(o => o.PaymentStatus).HasMaxLength(50);
```

with:

```csharp
        // ----- PRICING -----
        builder.Property(o => o.Subtotal).IsRequired().HasPrecision(18, 2);
        builder.Property(o => o.DiscountAmount).IsRequired().HasPrecision(18, 2);
        builder.Property(o => o.TaxAmount).IsRequired().HasPrecision(18, 2);
        builder.Property(o => o.DeliveryFee).IsRequired().HasPrecision(18, 2);
        builder.Property(o => o.TotalAmount).IsRequired().HasPrecision(18, 2);

        // ----- PAYMENT -----
        builder.Property(o => o.PaymentMethod).HasMaxLength(50);
        builder.Property(o => o.PaymentStatus).HasMaxLength(50);
        builder.Property(o => o.AmountReceived).HasPrecision(18, 2);
        builder.Property(o => o.ChangeAmount).HasPrecision(18, 2);
```

- [ ] **Step 3: Verify build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Generate the EF migration**

Run from `NDTCore.BE/src/NDTCore.API/`:

```bash
cd NDTCore.BE/src/NDTCore.API
dotnet ef migrations add Add_OrderDeliveryFeeAndCashPayment \
  --context NdtOrderContext \
  --project ../NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure \
  --startup-project . \
  --output-dir Persistence/Migrations/OrderDb
```

Expected: a new file `Persistence/Migrations/OrderDb/<timestamp>_Add_OrderDeliveryFeeAndCashPayment.cs` is created (namespace `NDTCore.Order.Infrastructure.Persistence.Migrations.OrderDb`) containing `migrationBuilder.AddColumn<decimal>` calls for `DeliveryFee` (not nullable, precision 18,2), `AmountReceived` and `ChangeAmount` (nullable, precision 18,2) on table `Orders` schema `Order`, plus the matching `.Designer.cs` and an updated `NdtOrderContextModelSnapshot.cs`.

- [ ] **Step 5: Verify build again (post-migration)**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Domain/Entities/Order.cs
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Persistence/Configurations/OrderConfiguration.cs
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Infrastructure/Persistence/Migrations/OrderDb/
git commit -m "feat: add DeliveryFee, AmountReceived, ChangeAmount to Order entity"
```

---

### Task 3: `CreateOrderRequest` + `CreateOrderCommand` — plumb `DeliveryFee`/`AmountReceived`

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Contracts/ViewModels/Orders/CreateOrderRequest.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommand.cs`

**Interfaces:**
- Consumes: nothing new from earlier tasks (pure DTO plumbing).
- Produces: `CreateOrderRequest.DeliveryFee` (`decimal`), `CreateOrderRequest.AmountReceived` (`decimal?`), and the same two properties on `CreateOrderCommand`. Tasks 4 and 5 read `request.DeliveryFee` / `request.AmountReceived` off the command.

- [ ] **Step 1: Update `CreateOrderRequest.cs`**

Replace the full file content:

```csharp
namespace NDTCore.Order.Contracts.ViewModels.Orders;

/// <summary>
/// VN: Dữ liệu đầu vào để tạo một đơn hàng mới. <br />
/// EN: Input data for creating a new order.
/// </summary>
public class CreateOrderRequest
{
    /// <summary>
    /// VN: ID cửa hàng thực hiện giao dịch. <br />
    /// EN: ID of the store processing this order.
    /// </summary>
    public int StoreId { get; set; }

    /// <summary>
    /// VN: Kênh đặt hàng (Pos, Online, Kiosk); null mặc định là Pos. <br />
    /// EN: Order channel (Pos, Online, Kiosk); null defaults to Pos.
    /// </summary>
    public string? Channel { get; set; }

    /// <summary>
    /// VN: Tên khách hàng; null nếu khách vãng lai. <br />
    /// EN: Customer name; null for walk-in customers.
    /// </summary>
    public string? CustomerName { get; set; }

    /// <summary>
    /// VN: Số điện thoại khách hàng; null nếu không có. <br />
    /// EN: Customer phone number; null if not provided.
    /// </summary>
    public string? CustomerPhone { get; set; }

    /// <summary>
    /// VN: Ghi chú chung cho đơn hàng. <br />
    /// EN: General note for the order.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// VN: Tổng giảm giá áp dụng cho toàn đơn; ≥ 0. <br />
    /// EN: Total discount applied to the whole order; ≥ 0.
    /// </summary>
    public decimal DiscountAmount { get; set; }

    /// <summary>
    /// VN: Tổng thuế áp dụng cho toàn đơn; ≥ 0. <br />
    /// EN: Total tax applied to the whole order; ≥ 0.
    /// </summary>
    public decimal TaxAmount { get; set; }

    /// <summary>
    /// VN: Phí giao hàng, chỉ có ý nghĩa khi ServiceType là Delivery; ≥ 0, mặc định 0. <br />
    /// EN: Delivery fee, only meaningful when ServiceType is Delivery; ≥ 0, defaults to 0.
    /// </summary>
    public decimal DeliveryFee { get; set; }

    /// <summary>
    /// VN: Phương thức thanh toán (Cash, Card, Transfer, EWallet); null mặc định là Cash. <br />
    /// EN: Payment method (Cash, Card, Transfer, EWallet); null defaults to Cash.
    /// </summary>
    public string? PaymentMethod { get; set; }

    /// <summary>
    /// VN: Trạng thái thanh toán (Unpaid, Paid); null mặc định là Unpaid. <br />
    /// EN: Payment status (Unpaid, Paid); null defaults to Unpaid.
    /// </summary>
    public string? PaymentStatus { get; set; }

    /// <summary>
    /// VN: Số tiền khách đưa khi thanh toán bằng tiền mặt; bắt buộc khi PaymentMethod là Cash và PaymentStatus là Paid. <br />
    /// EN: Amount received from customer for cash payment; required when PaymentMethod is Cash and PaymentStatus is Paid.
    /// </summary>
    public decimal? AmountReceived { get; set; }

    /// <summary>
    /// VN: Loại hình phục vụ (TakeAway, DineIn, Delivery); null mặc định là TakeAway. <br />
    /// EN: Service type (TakeAway, DineIn, Delivery); null defaults to TakeAway.
    /// </summary>
    public string? ServiceType { get; set; }

    /// <summary>
    /// VN: Danh sách các dòng sản phẩm trong đơn hàng; phải có ít nhất 1. <br />
    /// EN: List of product line items in the order; must have at least 1.
    /// </summary>
    public List<CreateOrderItemRequest> Items { get; set; } = [];
}
```

- [ ] **Step 2: Update `CreateOrderCommand.cs`**

Replace the full file content:

```csharp
using NDTCore.BuildingBlocks.Abstractions.CQRS;
using NDTCore.Order.Contracts.ViewModels.Orders;

namespace NDTCore.Order.Application.Features.Orders.CreateOrder;

/// <summary>
/// VN: Command tạo mới một đơn hàng với danh sách dòng sản phẩm và option. <br />
/// EN: Command to create a new order with line items and options.
/// </summary>
public sealed record CreateOrderCommand : ICommand<CreateOrderResponse>
{
    /// <summary>
    /// VN: Khởi tạo command từ request đầu vào. <br />
    /// EN: Initializes the command from the input request.
    /// </summary>
    public CreateOrderCommand(CreateOrderRequest request)
    {
        StoreId = request.StoreId;
        Channel = request.Channel;
        CustomerName = request.CustomerName;
        CustomerPhone = request.CustomerPhone;
        Note = request.Note;
        DiscountAmount = request.DiscountAmount;
        TaxAmount = request.TaxAmount;
        DeliveryFee = request.DeliveryFee;
        PaymentMethod = request.PaymentMethod;
        PaymentStatus = request.PaymentStatus;
        AmountReceived = request.AmountReceived;
        ServiceType = request.ServiceType;
        Items = request.Items;
    }

    /// <inheritdoc cref="CreateOrderRequest.StoreId"/>
    public int StoreId { get; init; }

    /// <inheritdoc cref="CreateOrderRequest.Channel"/>
    public string? Channel { get; init; }

    /// <inheritdoc cref="CreateOrderRequest.CustomerName"/>
    public string? CustomerName { get; init; }

    /// <inheritdoc cref="CreateOrderRequest.CustomerPhone"/>
    public string? CustomerPhone { get; init; }

    /// <inheritdoc cref="CreateOrderRequest.Note"/>
    public string? Note { get; init; }

    /// <inheritdoc cref="CreateOrderRequest.DiscountAmount"/>
    public decimal DiscountAmount { get; init; }

    /// <inheritdoc cref="CreateOrderRequest.TaxAmount"/>
    public decimal TaxAmount { get; init; }

    /// <inheritdoc cref="CreateOrderRequest.DeliveryFee"/>
    public decimal DeliveryFee { get; init; }

    /// <inheritdoc cref="CreateOrderRequest.PaymentMethod"/>
    public string? PaymentMethod { get; init; }

    /// <inheritdoc cref="CreateOrderRequest.PaymentStatus"/>
    public string? PaymentStatus { get; init; }

    /// <inheritdoc cref="CreateOrderRequest.AmountReceived"/>
    public decimal? AmountReceived { get; init; }

    /// <inheritdoc cref="CreateOrderRequest.ServiceType"/>
    public string? ServiceType { get; init; }

    /// <inheritdoc cref="CreateOrderRequest.Items"/>
    public IReadOnlyList<CreateOrderItemRequest> Items { get; init; }
}
```

- [ ] **Step 3: Verify build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Contracts/ViewModels/Orders/CreateOrderRequest.cs
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommand.cs
git commit -m "feat: add DeliveryFee and AmountReceived to CreateOrderRequest/Command"
```

---

### Task 4: `CreateOrderCommandValidator` — new rules

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommandValidator.cs`

**Interfaces:**
- Consumes: `CreateOrderCommand.DeliveryFee`, `CreateOrderCommand.AmountReceived`, `CreateOrderCommand.PaymentMethod`, `CreateOrderCommand.PaymentStatus` (Task 3), `ServiceType.Delivery` (Task 1).
- Produces: nothing consumed by later tasks — this validator is terminal in the FluentValidation pipeline.

- [ ] **Step 1: Replace the full file content**

```csharp
using FluentValidation;
using NDTCore.Order.Domain.Constants;

namespace NDTCore.Order.Application.Features.Orders.CreateOrder;

/// <summary>
/// VN: Validator cho <see cref="CreateOrderCommand"/>. <br />
/// EN: Validator for <see cref="CreateOrderCommand"/>.
/// </summary>
public sealed class CreateOrderCommandValidator : AbstractValidator<CreateOrderCommand>
{
    /// <summary>
    /// VN: Khởi tạo các rule validation cho <see cref="CreateOrderCommand"/>. <br />
    /// EN: Initializes validation rules for <see cref="CreateOrderCommand"/>.
    /// </summary>
    public CreateOrderCommandValidator()
    {
        RuleFor(x => x.StoreId)
            .GreaterThan(0)
            .WithMessage("StoreId must be greater than 0.");

        RuleFor(x => x.Channel)
            .Must(c => c == null || OrderChannel.IsValid(c))
            .WithMessage($"Channel must be one of: {OrderChannel.Pos}, {OrderChannel.Online}, {OrderChannel.Kiosk}.")
            .When(x => x.Channel is not null);

        RuleFor(x => x.CustomerName)
            .MaximumLength(200)
            .WithMessage("CustomerName must not exceed 200 characters.")
            .When(x => x.CustomerName is not null);

        RuleFor(x => x.CustomerPhone)
            .MaximumLength(20)
            .WithMessage("CustomerPhone must not exceed 20 characters.")
            .When(x => x.CustomerPhone is not null);

        RuleFor(x => x.DiscountAmount)
            .GreaterThanOrEqualTo(0)
            .WithMessage("DiscountAmount must be >= 0.");

        RuleFor(x => x.TaxAmount)
            .GreaterThanOrEqualTo(0)
            .WithMessage("TaxAmount must be >= 0.");

        RuleFor(x => x.DeliveryFee)
            .GreaterThanOrEqualTo(0)
            .WithMessage("DeliveryFee must be >= 0.");

        RuleFor(x => x.PaymentMethod)
            .Must(p => p == null || PaymentMethod.IsValid(p))
            .WithMessage($"PaymentMethod must be one of: {PaymentMethod.Cash}, {PaymentMethod.Card}, {PaymentMethod.Transfer}, {PaymentMethod.EWallet}.")
            .When(x => x.PaymentMethod is not null);

        RuleFor(x => x.PaymentStatus)
            .Must(p => p == null || PaymentStatus.IsValid(p))
            .WithMessage($"PaymentStatus must be one of: {PaymentStatus.Unpaid}, {PaymentStatus.Paid}, {PaymentStatus.Refunded}.")
            .When(x => x.PaymentStatus is not null);

        RuleFor(x => x.AmountReceived)
            .NotNull()
            .WithMessage("AmountReceived is required when PaymentMethod is Cash and PaymentStatus is Paid.")
            .When(x => x.PaymentMethod == PaymentMethod.Cash && x.PaymentStatus == PaymentStatus.Paid);

        RuleFor(x => x.ServiceType)
            .Must(s => s == null || ServiceType.IsValid(s))
            .WithMessage($"ServiceType must be one of: {ServiceType.TakeAway}, {ServiceType.DineIn}, {ServiceType.Delivery}.")
            .When(x => x.ServiceType is not null);

        RuleFor(x => x.Items)
            .NotEmpty()
            .WithMessage("Order must contain at least one item.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.ProductId)
                .GreaterThan(0)
                .WithMessage("ProductId must be greater than 0.");

            item.RuleFor(i => i.ProductCode)
                .NotEmpty()
                .MaximumLength(100)
                .WithMessage("ProductCode is required and must not exceed 100 characters.");

            item.RuleFor(i => i.ProductName)
                .NotEmpty()
                .MaximumLength(200)
                .WithMessage("ProductName is required and must not exceed 200 characters.");

            item.RuleFor(i => i.RegularPrice)
                .GreaterThanOrEqualTo(0)
                .WithMessage("RegularPrice must be >= 0.");

            item.RuleFor(i => i.Quantity)
                .GreaterThan(0)
                .WithMessage("Quantity must be at least 1.");

            item.RuleFor(i => i.DiscountAmount)
                .GreaterThanOrEqualTo(0)
                .WithMessage("Item DiscountAmount must be >= 0.");
        });
    }
}
```

- [ ] **Step 2: Verify build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommandValidator.cs
git commit -m "feat: validate DeliveryFee and AmountReceived in CreateOrderCommandValidator"
```

---

### Task 5: `CreateOrderCommandHandler` — formula change, cash validation, entity init

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommandHandler.cs`

**Interfaces:**
- Consumes: `CreateOrderCommand.DeliveryFee`/`AmountReceived` (Task 3), `Order.DeliveryFee`/`AmountReceived`/`ChangeAmount` (Task 2), `Error.Validation(string)` (existing, already in scope via `NDTCore.BuildingBlocks.Core.Results`).
- Produces: nothing new consumed by later tasks — `CreateOrderResponse` shape is unchanged (still `Id`, `OrderNumber`, `Status`, `TotalAmount`, `CreatedAt`).

- [ ] **Step 1: Replace the `Handle` method body**

Replace the section from `var subtotalOrder = ...` through the `OrderEntity` initializer (lines 90–116 of the current file) with:

```csharp
        var subtotalOrder = items.Sum(i => i.LineNetAmount);
        var totalAmount = subtotalOrder - request.DiscountAmount + request.TaxAmount + request.DeliveryFee;

        var paymentMethod = request.PaymentMethod ?? PaymentMethod.Cash;
        var paymentStatus = request.PaymentStatus ?? PaymentStatus.Unpaid;

        decimal? changeAmount = null;

        if (paymentMethod == PaymentMethod.Cash && paymentStatus == PaymentStatus.Paid)
        {
            if (request.AmountReceived is null || request.AmountReceived < totalAmount)
            {
                return Result<CreateOrderResponse>.Failure(
                    Error.Validation("AmountReceived must be greater than or equal to TotalAmount when paying by cash."));
            }

            changeAmount = request.AmountReceived.Value - totalAmount;
        }

        var order = new OrderEntity
        {
            TenantId = tenantId,
            StoreId = request.StoreId,
            OrderNumber = orderNumber,
            Status = OrderStatus.Completed,
            Channel = request.Channel ?? OrderChannel.Pos,
            ServiceType = request.ServiceType ?? ServiceType.TakeAway,
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
            Note = request.Note,
            Subtotal = subtotalOrder,
            DiscountAmount = request.DiscountAmount,
            TaxAmount = request.TaxAmount,
            DeliveryFee = request.DeliveryFee,
            TotalAmount = totalAmount,
            PaymentMethod = paymentMethod,
            PaymentStatus = paymentStatus,
            PaidAt = paymentStatus == PaymentStatus.Paid ? now : null,
            AmountReceived = paymentMethod == PaymentMethod.Cash ? request.AmountReceived : null,
            ChangeAmount = paymentMethod == PaymentMethod.Cash ? changeAmount : null,
            CreatedAt = now,
            CreatedBy = userEmail,
            OrderItems = items,
        };
```

This replaces the old `var paymentStatus = request.PaymentStatus ?? PaymentStatus.Unpaid;` line and the old `OrderEntity` initializer entirely — `paymentStatus` is now declared earlier alongside the new `paymentMethod` variable, and both are reused so the Cash/Paid comparison and the entity assignment use the same defaulted values (avoids re-evaluating `request.PaymentMethod ?? PaymentMethod.Cash` twice and avoids the bug where a `null` `request.PaymentMethod` — which defaults to Cash — would otherwise fail the `== PaymentMethod.Cash` check).

- [ ] **Step 2: Verify build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/CreateOrder/CreateOrderCommandHandler.cs
git commit -m "feat: include DeliveryFee in TotalAmount and validate cash AmountReceived"
```

---

### Task 6: `GetOrderResponse` + `GetOrderByIdQueryHandler` — read-flow mapping

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Contracts/ViewModels/Orders/GetOrderResponse.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/GetOrderById/GetOrderByIdQueryHandler.cs`

**Interfaces:**
- Consumes: `Order.ServiceType`/`DeliveryFee`/`AmountReceived`/`ChangeAmount` (Task 2), `ServiceType.TakeAway` (Task 1).
- Produces: `GetOrderResponse.ServiceType` (`string`, non-nullable), `GetOrderResponse.DeliveryFee` (`decimal`), `GetOrderResponse.AmountReceived`/`ChangeAmount` (`decimal?`). Task 9 (FE `GetOrderDetailDto`) mirrors these field names and types exactly; Task 13 (`build-bill-html.util.ts`) reads `order.ServiceType`, `order.DeliveryFee`, `order.AmountReceived`, `order.ChangeAmount`.

- [ ] **Step 1: Update `GetOrderResponse.cs`**

Replace the `GetOrderResponse` class body:

```csharp
public class GetOrderResponse
{
    public int Id { get; set; }
    public Guid TenantId { get; set; }
    public int StoreId { get; set; }
    public string OrderNumber { get; set; } = default!;
    public string Status { get; set; } = default!;
    public string? Channel { get; set; }

    /// <summary>
    /// VN: Loại hình phục vụ; xem <see cref="Domain.Constants.ServiceType"/>. <br />
    /// EN: Service type; see <see cref="Domain.Constants.ServiceType"/>.
    /// </summary>
    public string ServiceType { get; set; } = default!;

    public string? CustomerName { get; set; }
    public string? CustomerPhone { get; set; }
    public string? Note { get; set; }
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxAmount { get; set; }

    /// <summary>
    /// VN: Phí giao hàng, chỉ có giá trị khi ServiceType là Delivery, mặc định 0. <br />
    /// EN: Delivery fee, only meaningful when ServiceType is Delivery, defaults to 0.
    /// </summary>
    public decimal DeliveryFee { get; set; }

    public decimal TotalAmount { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PaymentStatus { get; set; }

    /// <summary>
    /// VN: Số tiền khách đưa khi thanh toán bằng tiền mặt, <see langword="null"/> nếu không phải Cash. <br />
    /// EN: Amount received from customer for cash payment, <see langword="null"/> when payment method is not Cash.
    /// </summary>
    public decimal? AmountReceived { get; set; }

    /// <summary>
    /// VN: Tiền thừa trả khách, <see langword="null"/> nếu không phải Cash. <br />
    /// EN: Change returned to customer, <see langword="null"/> when payment method is not Cash.
    /// </summary>
    public decimal? ChangeAmount { get; set; }

    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public string? CancelledReason { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    /// <summary>VN: Danh sách dòng sản phẩm. EN: Order line items.</summary>
    public List<GetOrderItemResponse> Items { get; set; } = [];
}
```

(`GetOrderItemResponse` and `GetOrderItemOptionResponse` below it are unchanged.)

- [ ] **Step 2: Update `GetOrderByIdQueryHandler.cs`**

Add the import at the top of the file:

```csharp
using NDTCore.Order.Domain.Constants;
```

Replace the `MapToResponse` mapping object:

```csharp
    private static GetOrderResponse MapToResponse(OrderEntity o) => new()
    {
        Id = o.Id,
        TenantId = o.TenantId,
        StoreId = o.StoreId,
        OrderNumber = o.OrderNumber,
        Status = o.Status,
        Channel = o.Channel,
        ServiceType = o.ServiceType ?? ServiceType.TakeAway,
        CustomerName = o.CustomerName,
        CustomerPhone = o.CustomerPhone,
        Note = o.Note,
        Subtotal = o.Subtotal,
        DiscountAmount = o.DiscountAmount,
        TaxAmount = o.TaxAmount,
        DeliveryFee = o.DeliveryFee,
        TotalAmount = o.TotalAmount,
        PaymentMethod = o.PaymentMethod,
        PaymentStatus = o.PaymentStatus,
        AmountReceived = o.AmountReceived,
        ChangeAmount = o.ChangeAmount,
        PaidAt = o.PaidAt,
        CancelledAt = o.CancelledAt,
        CancelledReason = o.CancelledReason,
        CreatedAt = o.CreatedAt,
        CreatedBy = o.CreatedBy,
        UpdatedAt = o.UpdatedAt,
        UpdatedBy = o.UpdatedBy,
        Items = o.OrderItems.Select(i => new GetOrderItemResponse
        {
            Id = i.Id,
            ProductId = i.ProductId,
            ProductCode = i.ProductCode,
            ProductName = i.ProductName,
            RegularPrice = i.RegularPrice,
            OptionsAmount = i.OptionsAmount,
            SalePrice = i.SalePrice,
            Quantity = i.Quantity,
            LineAmount = i.LineAmount,
            DiscountAmount = i.DiscountAmount,
            LineNetAmount = i.LineNetAmount,
            Note = i.Note,
            Options = i.OrderItemOptions.Select(opt => new GetOrderItemOptionResponse
            {
                Id = opt.Id,
                OptionId = opt.OptionId,
                GroupName = opt.GroupName,
                OptionName = opt.OptionName,
                Price = opt.Price,
            }).ToList(),
        }).ToList(),
    };
```

- [ ] **Step 3: Verify build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Contracts/ViewModels/Orders/GetOrderResponse.cs
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Order/NDTCore.Order.Application/Features/Orders/GetOrderById/GetOrderByIdQueryHandler.cs
git commit -m "feat: expose ServiceType, DeliveryFee, AmountReceived, ChangeAmount in GetOrderResponse"
```

---

### Task 7: `PosStoreStatusResponse` + `GetPosStoreStatusQueryHandler` — expose store hotline

**Files:**
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Pos/PosStoreStatusResponse.cs`
- Modify: `NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Pos/GetPosStoreStatus/GetPosStoreStatusQueryHandler.cs`

**Interfaces:**
- Consumes: `AppStore.Phone` (`string?`, already exists at `NDTCore.Store.Domain/Entities/AppStore.cs:115` — no entity change needed).
- Produces: `PosStoreStatusResponse.Phone` (`string?`, `init`-only — this file uses `sealed record` with `init` accessors, distinct from `GetOrderResponse`'s mutable `set`). Task 9 (FE `PosStoreStatusDto`) mirrors this as `Phone: string | null`.

- [ ] **Step 1: Add `Phone` to `PosStoreStatusResponse.cs`**

Insert after the `Province` property and before `IsAcceptingOrders`:

```csharp
    /// <summary>
    /// VN: Tỉnh/Thành phố của cửa hàng; <see langword="null"/> nếu chưa thiết lập. <br />
    /// EN: Store province; <see langword="null"/> if not set.
    /// </summary>
    public string? Province { get; init; }

    /// <summary>
    /// VN: Số điện thoại (hotline) của cửa hàng; <see langword="null"/> nếu chưa thiết lập. <br />
    /// EN: Store phone number (hotline); <see langword="null"/> if not set.
    /// </summary>
    public string? Phone { get; init; }

    /// <summary>
    /// VN: Cửa hàng đang nhận đơn hàng. <br />
    /// EN: Whether the store is currently accepting orders.
    /// </summary>
    public bool IsAcceptingOrders { get; init; }
```

- [ ] **Step 2: Map `Phone` in `GetPosStoreStatusQueryHandler.cs`**

Replace the response object initializer:

```csharp
        return Result<PosStoreStatusResponse>.Success(new PosStoreStatusResponse
        {
            StoreId           = store.Id,
            StoreName         = store.Name,
            LogoUrl           = store.LogoUrl,
            Address           = store.Address,
            City              = store.City,
            District          = store.District,
            Province          = store.Province,
            Phone             = store.Phone,
            IsAcceptingOrders = store.IsAcceptingOrders,
            HasOpenShift      = true,  // Shift management not yet implemented — always open
            ShiftId           = null,
            ShiftOpenedAt     = null,
            ShiftOpenedBy     = null,
        });
```

- [ ] **Step 3: Verify build**

Run: `cd NDTCore.BE/src && dotnet build NDTCore.sln`
Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Contracts/ViewModels/Pos/PosStoreStatusResponse.cs
git add NDTCore.BE/src/NDTCore.Modules/NDTCore.Store/NDTCore.Store.Application/Features/Pos/GetPosStoreStatus/GetPosStoreStatusQueryHandler.cs
git commit -m "feat: expose store Phone in PosStoreStatusResponse"
```

---

### Task 8: FE `service-type.enum.ts` + `pos-order-panel.constants.ts`

**Files:**
- Modify: `NDTCore.FE/src/modules/pos/enums/service-type.enum.ts`
- Modify: `NDTCore.FE/src/modules/pos/constants/pos-order-panel.constants.ts`

**Interfaces:**
- Produces: `ServiceType.Delivery` (FE enum member), `POS_SERVICE_TYPE_OPTIONS` includes a `Delivery` entry. Task 12 (`PosOrderPanel.vue`) renders this option and compares against `ServiceType.Delivery`.

- [ ] **Step 1: Add `Delivery` to the enum**

Replace the full file content of `service-type.enum.ts`:

```ts
export enum ServiceType {
    TakeAway = 'TakeAway',
    DineIn = 'DineIn',
    Delivery = 'Delivery',
}
```

- [ ] **Step 2: Add the option to `POS_SERVICE_TYPE_OPTIONS`**

Replace the full file content of `pos-order-panel.constants.ts`:

```ts
import { PaymentMethod, PaymentStatus, ServiceType } from '../enums/_index'

export const POS_PAYMENT_METHOD_OPTIONS = [
    { value: PaymentMethod.Cash, label: 'Tiền mặt', icon: 'mdi-cash' },
    { value: PaymentMethod.Transfer, label: 'Chuyển khoản', icon: 'mdi-bank-transfer' },
] as const

export const POS_PAYMENT_STATUS_OPTIONS = [
    { value: PaymentStatus.Unpaid, label: 'Chưa thanh toán', icon: 'mdi-clock-outline' },
    { value: PaymentStatus.Paid, label: 'Đã thanh toán', icon: 'mdi-check-circle-outline' },
] as const

export const POS_SERVICE_TYPE_OPTIONS = [
    { value: ServiceType.TakeAway, label: 'Mang đi', icon: 'mdi-walk' },
    { value: ServiceType.DineIn, label: 'Ngồi lại', icon: 'mdi-silverware-fork-knife' },
    { value: ServiceType.Delivery, label: 'Giao hàng', icon: 'mdi-moped' },
] as const
```

- [ ] **Step 3: Verify type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add NDTCore.FE/src/modules/pos/enums/service-type.enum.ts
git add NDTCore.FE/src/modules/pos/constants/pos-order-panel.constants.ts
git commit -m "feat: add Delivery service type option to POS UI"
```

---

### Task 9: FE DTOs — `pos-order.dto.ts` + `pos-shift.dto.ts`

**Files:**
- Modify: `NDTCore.FE/src/modules/pos/models/dtos/pos-order.dto.ts`
- Modify: `NDTCore.FE/src/modules/pos/models/dtos/pos-shift.dto.ts`

**Interfaces:**
- Consumes: BE field names/types from Task 3 (`CreateOrderRequest`), Task 6 (`GetOrderResponse`), Task 7 (`PosStoreStatusResponse`) — mirrored exactly per FE convention §9.
- Produces: `CreatePosOrderRequest.DeliveryFee`/`AmountReceived`, `GetOrderDetailDto.ServiceType`/`DeliveryFee`/`AmountReceived`/`ChangeAmount`, `PosStoreStatusDto.Phone`. Task 10 (`pos-cart.store.ts`), Task 12 (`PosOrderPanel.vue`), Task 13 (`build-bill-html.util.ts`), Task 11 (`pos-shift.store.ts`) all consume these.

- [ ] **Step 1: Update `pos-order.dto.ts`**

Replace the full file content:

```ts
import type { PaymentMethod, PaymentStatus, ServiceType } from '../../enums/_index'

export interface CreatePosOrderItemOptionRequest {
    OptionId: number
    GroupName: string | null
    OptionName: string
    Price: number
}

export interface CreatePosOrderItemRequest {
    ProductId: number
    ProductCode: string
    ProductName: string
    RegularPrice: number
    Quantity: number
    DiscountAmount: number
    Note: string | null
    Options: CreatePosOrderItemOptionRequest[]
}

export interface CreatePosOrderRequest {
    StoreId: number
    Channel: string | null
    CustomerName: string | null
    CustomerPhone: string | null
    Note: string | null
    DiscountAmount: number
    TaxAmount: number
    DeliveryFee: number
    PaymentMethod: PaymentMethod
    PaymentStatus: PaymentStatus
    AmountReceived: number | null
    ServiceType: ServiceType
    Items: CreatePosOrderItemRequest[]
}

export interface CreatePosOrderResponse {
    Id: number
    OrderNumber: string
    Status: string
    TotalAmount: number
    CreatedAt: string
}

export interface PosOrderHistoryItemDto {
    Id: number
    OrderNumber: string
    Status: string
    TotalAmount: number
    ItemSummary: string
    CreatedAt: string
}

export interface GetOrderItemOptionDto {
    Id: number
    OptionId: number
    GroupName: string | null
    OptionName: string
    Price: number
}

export interface GetOrderItemDto {
    Id: number
    ProductId: number
    ProductCode: string
    ProductName: string
    RegularPrice: number
    OptionsAmount: number
    SalePrice: number
    Quantity: number
    LineAmount: number
    DiscountAmount: number
    LineNetAmount: number
    Note: string | null
    Options: GetOrderItemOptionDto[]
}

export interface GetOrderDetailDto {
    Id: number
    TenantId: string
    StoreId: number
    OrderNumber: string
    Status: string
    Channel: string | null
    ServiceType: string
    CustomerName: string | null
    CustomerPhone: string | null
    Note: string | null
    Subtotal: number
    DiscountAmount: number
    TaxAmount: number
    DeliveryFee: number
    TotalAmount: number
    PaymentMethod: string | null
    PaymentStatus: string | null
    AmountReceived: number | null
    ChangeAmount: number | null
    PaidAt: string | null
    CancelledAt: string | null
    CancelledReason: string | null
    CreatedAt: string | null
    CreatedBy: string | null
    UpdatedAt: string | null
    UpdatedBy: string | null
    Items: GetOrderItemDto[]
}
```

- [ ] **Step 2: Update `pos-shift.dto.ts`**

Replace the full file content:

```ts
export interface PosStoreStatusDto {
    StoreId: number
    StoreName: string
    LogoUrl: string | null
    Address: string | null
    City: string | null
    District: string | null
    Province: string | null
    Phone: string | null
    IsAcceptingOrders: boolean
    HasOpenShift: boolean
    ShiftId: number | null
    ShiftOpenedAt: string | null
    ShiftOpenedBy: string | null
}
```

- [ ] **Step 3: Verify type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 errors (note: this will surface errors in `build-bill-html.util.ts` if it referenced removed/renamed fields — it does not yet, since Task 13 hasn't run; the existing file only reads fields that still exist with the same names).

- [ ] **Step 4: Commit**

```bash
git add NDTCore.FE/src/modules/pos/models/dtos/pos-order.dto.ts
git add NDTCore.FE/src/modules/pos/models/dtos/pos-shift.dto.ts
git commit -m "feat: add DeliveryFee, AmountReceived, ChangeAmount, ServiceType, Phone to POS DTOs"
```

---

### Task 10: FE `pos-cart.store.ts` — `deliveryFee`, `amountReceived`, `changeAmount`

**Files:**
- Modify: `NDTCore.FE/src/modules/pos/stores/pos-cart.store.ts`

**Interfaces:**
- Consumes: nothing new from DTOs (cart state is FE-internal, not a DTO).
- Produces: `usePosCartStore().deliveryFee` (`Ref<number>`), `.amountReceived` (`Ref<number | null>`), `.changeAmount` (`ComputedRef<number | null>`), updated `.totalAmount` (`ComputedRef<number>`, now includes `deliveryFee`). Task 12 (`PosOrderPanel.vue`) binds all three and reads `.totalAmount`.

- [ ] **Step 1: Replace the full file content**

```ts
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { PosCartItem } from '../models/types/pos-cart.types'
import { PaymentMethod, PaymentStatus, ServiceType } from '../enums/_index'

export const usePosCartStore = defineStore('pos-cart', () => {
    const items          = ref<PosCartItem[]>([])
    const customerName   = ref('')
    const customerPhone  = ref('')
    const orderNote      = ref('')
    const paymentMethod  = ref<PaymentMethod>(PaymentMethod.Cash)
    const paymentStatus  = ref<PaymentStatus>(PaymentStatus.Unpaid)
    const serviceType    = ref<ServiceType>(ServiceType.TakeAway)
    const deliveryFee    = ref(0)
    const amountReceived = ref<number | null>(null)

    const itemCount = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))

    const totalAmount = computed(() =>
        items.value.reduce((sum, item) => {
            const optionTotal = item.selectedOptions.reduce((s, o) => s + o.resolvedPrice, 0)
            return sum + (item.resolvedPrice + optionTotal) * item.quantity
        }, 0) + deliveryFee.value,
    )

    const changeAmount = computed(() =>
        amountReceived.value !== null ? amountReceived.value - totalAmount.value : null,
    )

    watch(serviceType, (value) => {
        if (value !== ServiceType.Delivery) deliveryFee.value = 0
    })

    watch(paymentMethod, (value) => {
        if (value !== PaymentMethod.Cash) amountReceived.value = null
    })

    function addItem(item: PosCartItem): void {
        items.value.push(item)
    }

    function updateItem(uid: string, updated: PosCartItem): void {
        const idx = items.value.findIndex((i) => i.uid === uid)
        if (idx !== -1) items.value[idx] = updated
    }

    function removeItem(uid: string): void {
        items.value = items.value.filter((i) => i.uid !== uid)
    }

    function updateQuantity(uid: string, quantity: number): void {
        const item = items.value.find((i) => i.uid === uid)
        if (item && quantity >= 1) item.quantity = quantity
    }

    function clearCart(): void {
        items.value          = []
        customerName.value   = ''
        customerPhone.value  = ''
        orderNote.value      = ''
        paymentMethod.value  = PaymentMethod.Cash
        paymentStatus.value  = PaymentStatus.Unpaid
        serviceType.value    = ServiceType.TakeAway
        deliveryFee.value    = 0
        amountReceived.value = null
    }

    function $reset(): void {
        clearCart()
    }

    return {
        items, customerName, customerPhone, orderNote, paymentMethod, paymentStatus, serviceType,
        deliveryFee, amountReceived,
        itemCount, totalAmount, changeAmount,
        addItem, updateItem, removeItem, updateQuantity, clearCart, $reset,
    }
})
```

- [ ] **Step 2: Verify type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.FE/src/modules/pos/stores/pos-cart.store.ts
git commit -m "feat: add deliveryFee, amountReceived, changeAmount to pos-cart store"
```

---

### Task 11: FE `pos-shift.store.ts` — `hotline`

**Files:**
- Modify: `NDTCore.FE/src/modules/pos/stores/pos-shift.store.ts`

**Interfaces:**
- Consumes: `PosStoreStatusDto.Phone` (Task 9).
- Produces: `usePosShiftStore().hotline` (`ComputedRef<string | null>`). Task 12 reads `shiftStore.hotline` indirectly via Task 14's `usePrintBill.ts`.

- [ ] **Step 1: Add the `hotline` computed**

Replace the full file content:

```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { posService } from '../services/pos.service'
import type { PosStoreStatusDto } from '../models/dtos/pos-shift.dto'

export const usePosShiftStore = defineStore('pos-shift', () => {
    const status    = ref<PosStoreStatusDto | null>(null)
    const isLoading = ref(false)

    const storeName         = computed(() => status.value?.StoreName ?? '')
    const logoUrl           = computed(() => status.value?.LogoUrl ?? null)
    const address           = computed(() => {
        if (!status.value) return ''
        return [status.value.Address, status.value.District, status.value.City, status.value.Province]
            .filter(Boolean)
            .join(', ')
    })
    const hotline           = computed(() => status.value?.Phone ?? null)
    const isAcceptingOrders = computed(() => status.value?.IsAcceptingOrders ?? false)
    const hasOpenShift      = computed(() => status.value?.HasOpenShift ?? false)
    const shiftId           = computed(() => status.value?.ShiftId ?? null)
    const shiftOpenedAt     = computed(() => status.value?.ShiftOpenedAt ?? null)
    const shiftOpenedBy     = computed(() => status.value?.ShiftOpenedBy ?? null)
    const canCreateOrder    = computed(() => isAcceptingOrders.value && hasOpenShift.value)

    async function fetchStatus(storeId: number): Promise<void> {
        isLoading.value = true
        try {
            status.value = await posService.getStoreStatusAsync(storeId)
        } finally {
            isLoading.value = false
        }
    }

    function $reset(): void {
        status.value    = null
        isLoading.value = false
    }

    return {
        status, isLoading,
        storeName, logoUrl, address, hotline, isAcceptingOrders, hasOpenShift,
        shiftId, shiftOpenedAt, shiftOpenedBy, canCreateOrder,
        fetchStatus, $reset,
    }
})
```

- [ ] **Step 2: Verify type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.FE/src/modules/pos/stores/pos-shift.store.ts
git commit -m "feat: expose store hotline in pos-shift store"
```

---

### Task 12: `PosOrderPanel.vue` — delivery fee / cash inputs + payload

**Files:**
- Modify: `NDTCore.FE/src/modules/pos/components/PosOrderPanel.vue`

**Interfaces:**
- Consumes: `cartStore.deliveryFee`/`amountReceived`/`changeAmount` (Task 10), `ServiceType.Delivery`/`PaymentMethod.Cash` (Tasks 8 and existing `payment-method.enum.ts`), `CreatePosOrderRequest.DeliveryFee`/`AmountReceived` (Task 9).
- Produces: nothing consumed by later tasks (leaf component).

- [ ] **Step 1: Add the delivery-fee input to the template**

In the "Service type / Payment method / Payment status" block, insert a new `v-text-field` right after the "Loại đơn" `v-btn-toggle` closes (after its `</div>`) and before the "Phương thức thanh toán" `<div>`:

```html
      <div>
        <span class="text-caption text-medium-emphasis">Loại đơn</span>
        <v-btn-toggle
          v-model="cartStore.serviceType"
          mandatory
          divided
          rounded="lg"
          density="comfortable"
          class="w-100 mt-1 bg-surface-light"
        >
          <v-btn
            v-for="opt in POS_SERVICE_TYPE_OPTIONS"
            :key="opt.value"
            :value="opt.value"
            :color="cartStore.serviceType === opt.value ? 'primary' : undefined"
            :variant="cartStore.serviceType === opt.value ? 'flat' : 'text'"
            class="text-none"
            style="flex: 1 1 0%; min-width: 0"
            :prepend-icon="opt.icon"
          >
            {{ opt.label }}
          </v-btn>
        </v-btn-toggle>
      </div>

      <v-text-field
        v-if="cartStore.serviceType === ServiceType.Delivery"
        v-model.number="cartStore.deliveryFee"
        label="Phí giao hàng"
        type="number"
        density="compact"
        variant="outlined"
        hide-details
        suffix="₫"
      />

      <div>
        <span class="text-caption text-medium-emphasis">Phương thức thanh toán</span>
        <v-btn-toggle
          v-model="cartStore.paymentMethod"
          mandatory
          divided
          rounded="lg"
          density="comfortable"
          class="w-100 mt-1 bg-surface-light"
        >
          <v-btn
            v-for="opt in POS_PAYMENT_METHOD_OPTIONS"
            :key="opt.value"
            :value="opt.value"
            :color="cartStore.paymentMethod === opt.value ? 'primary' : undefined"
            :variant="cartStore.paymentMethod === opt.value ? 'flat' : 'text'"
            class="text-none"
            style="flex: 1 1 0%; min-width: 0"
            :prepend-icon="opt.icon"
          >
            {{ opt.label }}
          </v-btn>
        </v-btn-toggle>
      </div>

      <div v-if="cartStore.paymentMethod === PaymentMethod.Cash">
        <v-text-field
          v-model.number="cartStore.amountReceived"
          label="Số tiền khách đưa"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          suffix="₫"
        />
        <div
          v-if="cartStore.changeAmount !== null"
          class="text-body-2 mt-1"
          :class="cartStore.changeAmount < 0 ? 'text-error' : 'text-medium-emphasis'"
        >
          Tiền thừa: {{ cartStore.changeAmount.toLocaleString('vi-VN') }}₫
        </div>
      </div>

      <div>
        <span class="text-caption text-medium-emphasis">Trạng thái thanh toán</span>
        <v-btn-toggle
          v-model="cartStore.paymentStatus"
          mandatory
          divided
          rounded="lg"
          density="comfortable"
          class="w-100 mt-1 bg-surface-light"
        >
          <v-btn
            v-for="opt in POS_PAYMENT_STATUS_OPTIONS"
            :key="opt.value"
            :value="opt.value"
            :color="cartStore.paymentStatus === opt.value ? 'primary' : undefined"
            :variant="cartStore.paymentStatus === opt.value ? 'flat' : 'text'"
            class="text-none"
            style="flex: 1 1 0%; min-width: 0"
            :prepend-icon="opt.icon"
          >
            {{ opt.label }}
          </v-btn>
        </v-btn-toggle>
      </div>
```

- [ ] **Step 2: Import the enums and update the payload in `<script setup>`**

Add this import alongside the existing constants import:

```ts
import { PaymentMethod, ServiceType } from '../enums/_index'
```

Replace the `payload` object inside `submitOrder()`:

```ts
        const payload = {
            StoreId:        props.storeId,
            Channel:        null,
            CustomerName:   cartStore.customerName || null,
            CustomerPhone:  cartStore.customerPhone || null,
            Note:           cartStore.orderNote || null,
            DiscountAmount: 0,
            TaxAmount:      0,
            DeliveryFee:    cartStore.deliveryFee,
            PaymentMethod:  cartStore.paymentMethod,
            PaymentStatus:  cartStore.paymentStatus,
            AmountReceived: cartStore.amountReceived,
            ServiceType:    cartStore.serviceType,
            Items:          cartStore.items.map((i) => ({
                ProductId:      i.productId,
                ProductCode:    i.productCode,
                ProductName:    i.productName,
                RegularPrice:   i.resolvedPrice,
                Quantity:       i.quantity,
                DiscountAmount: 0,
                Note:           i.note || null,
                Options:        i.selectedOptions.map((o) => ({
                    OptionId:   o.optionId,
                    GroupName:  o.groupName,
                    OptionName: o.optionName,
                    Price:      o.resolvedPrice,
                })),
            })),
        }
```

- [ ] **Step 3: Verify type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add NDTCore.FE/src/modules/pos/components/PosOrderPanel.vue
git commit -m "feat: add delivery fee and cash amount inputs to PosOrderPanel"
```

---

### Task 13: `build-bill-html.util.ts` — full rewrite (modern/minimal, 58/80mm)

**Files:**
- Modify: `NDTCore.FE/src/modules/pos/utils/build-bill-html.util.ts`

**Interfaces:**
- Consumes: `GetOrderDetailDto`, `GetOrderItemDto`, `GetOrderItemOptionDto` (Task 9).
- Produces: `BillStoreInfo` now includes `hotline: string | null`. Task 14 (`usePrintBill.ts`) passes this field.

- [ ] **Step 1: Replace the full file content**

```ts
import type { GetOrderDetailDto, GetOrderItemDto, GetOrderItemOptionDto } from '../models/dtos/pos-order.dto'

export interface BillStoreInfo {
    name: string
    logoUrl: string | null
    address: string
    hotline: string | null
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
    Cash: 'Tiền mặt',
    Card: 'Thẻ',
    Transfer: 'Chuyển khoản',
    EWallet: 'Ví điện tử',
}

const SERVICE_TYPE_LABEL: Record<string, string> = {
    TakeAway: 'Mang đi',
    DineIn: 'Ngồi lại',
    Delivery: 'Giao hàng',
}

function formatCurrency(value: number): string {
    return `${value.toLocaleString('vi-VN')}₫`
}

function formatDateTime(iso: string | null): string {
    if (!iso) return ''
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function isSizeOption(o: GetOrderItemOptionDto): boolean {
    return (o.GroupName ?? '').toLowerCase() === 'size'
}

function renderItemBlock(item: GetOrderItemDto, index: number): string {
    const sizeOption = item.Options.find(isSizeOption)
    const sizeSuffix = sizeOption ? ` (${sizeOption.OptionName})` : ''
    const toppingOptions = item.Options.filter((o) => !isSizeOption(o))

    const quantityLine = item.Quantity > 1
        ? `<div class="bill-item-sub">SL: ${item.Quantity} x ${formatCurrency(item.SalePrice)}</div>`
        : ''

    const toppingLines = toppingOptions
        .map((o) => o.Price > 0
            ? `<div class="bill-item-sub">+ ${o.OptionName} +${formatCurrency(o.Price)}</div>`
            : `<div class="bill-item-sub">- ${o.OptionName}</div>`)
        .join('')

    return `
        <div class="bill-item">
            <div class="bill-row">
                <span>${index}. ${item.ProductName}${sizeSuffix}</span>
                <span class="bill-item-amount">${formatCurrency(item.LineNetAmount)}</span>
            </div>
            ${quantityLine}
            ${toppingLines}
        </div>
    `
}

export function buildBillHtml(order: GetOrderDetailDto, store: BillStoreInfo): string {
    const itemBlocks = order.Items.map((item, idx) => renderItemBlock(item, idx + 1)).join('')
    const totalQuantity = order.Items.reduce((sum, item) => sum + item.Quantity, 0)

    const addressLine = store.address
        ? `<div class="bill-store-address">${store.address}</div>`
        : ''
    const hotlineLine = store.hotline
        ? `<div class="bill-store-hotline">ĐT: ${store.hotline}</div>`
        : ''

    const cashierLine = order.CreatedBy
        ? `<div class="bill-row"><span>Thu ngân</span><span>${order.CreatedBy}</span></div>`
        : ''
    const serviceTypeLabel = SERVICE_TYPE_LABEL[order.ServiceType] ?? order.ServiceType

    const discountLine = order.DiscountAmount > 0
        ? `<div class="bill-row"><span>Giảm giá</span><span>-${formatCurrency(order.DiscountAmount)}</span></div>`
        : ''
    const deliveryFeeLine = order.DeliveryFee > 0
        ? `<div class="bill-row"><span>Phí giao hàng</span><span>${formatCurrency(order.DeliveryFee)}</span></div>`
        : ''

    const paymentMethodLabel = order.PaymentMethod
        ? PAYMENT_METHOD_LABEL[order.PaymentMethod] ?? order.PaymentMethod
        : ''
    const cashPaymentLines = order.PaymentMethod === 'Cash' && order.AmountReceived !== null && order.ChangeAmount !== null
        ? `
        <div class="bill-row"><span>Số tiền nhận</span><span>${formatCurrency(order.AmountReceived)}</span></div>
        <div class="bill-row"><span>Tiền thừa</span><span>${formatCurrency(order.ChangeAmount)}</span></div>`
        : ''

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>Bill ${order.OrderNumber}</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 0; padding: 16px; }
    .bill-header { text-align: center; margin-bottom: 10px; }
    .bill-logo { max-width: 80px; max-height: 80px; margin-bottom: 8px; }
    .bill-store-name { font-size: 16px; font-weight: bold; letter-spacing: 0.5px; }
    .bill-store-address, .bill-store-hotline { font-size: 11px; color: #444; }
    .bill-divider { border-top: 1px dashed #000; margin: 8px 0; }
    .bill-row { display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0; }
    .bill-products-label { font-size: 12px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 4px; }
    .bill-item { margin: 6px 0; }
    .bill-item-amount { font-weight: 600; }
    .bill-item-sub { font-size: 11px; color: #666; padding-left: 10px; margin: 1px 0; }
    .bill-total { display: flex; justify-content: space-between; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; font-size: 16px; font-weight: bold; margin: 6px 0; }
    .bill-footer { text-align: center; font-style: italic; margin-top: 12px; margin-bottom: 16px; }
</style>
</head>
<body>
    <div class="bill-header">
        ${store.logoUrl ? `<img class="bill-logo" src="${store.logoUrl}" />` : ''}
        <div class="bill-store-name">${store.name}</div>
        ${addressLine}
        ${hotlineLine}
    </div>

    <div class="bill-divider"></div>

    <div class="bill-row"><span>Mã đơn</span><span>#${order.OrderNumber}</span></div>
    <div class="bill-row"><span>Thời gian</span><span>${formatDateTime(order.CreatedAt)}</span></div>
    ${cashierLine}
    <div class="bill-row"><span>Hình thức</span><span>${serviceTypeLabel}</span></div>

    <div class="bill-divider"></div>

    <div class="bill-products">
        <div class="bill-products-label">SẢN PHẨM</div>
        ${itemBlocks}
    </div>

    <div class="bill-divider"></div>

    <div class="bill-summary">
        <div class="bill-row"><span>Tổng số lượng</span><span>${totalQuantity}</span></div>
        <div class="bill-row"><span>Tạm tính</span><span>${formatCurrency(order.Subtotal)}</span></div>
        ${discountLine}
        ${deliveryFeeLine}
        <div class="bill-total"><span>TỔNG THANH TOÁN</span><span>${formatCurrency(order.TotalAmount)}</span></div>
    </div>

    <div class="bill-payment">
        <div class="bill-row"><span>Phương thức</span><span>${paymentMethodLabel}</span></div>
        ${cashPaymentLines}
    </div>

    <div class="bill-divider"></div>

    <div class="bill-footer">Cảm ơn quý khách! Hẹn gặp lại lần sau</div>
</body>
</html>
    `
}
```

- [ ] **Step 2: Verify type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 errors. (This task intentionally leaves `usePrintBill.ts` passing an object without `hotline` — that mismatch is fixed in Task 14, the very next task. If Task 14 has not run yet, `vue-tsc` will report a missing-property error in `usePrintBill.ts`; that is expected and resolved by Task 14, not by this task.)

- [ ] **Step 3: Commit**

```bash
git add NDTCore.FE/src/modules/pos/utils/build-bill-html.util.ts
git commit -m "feat: redesign POS bill layout for 58/80mm thermal printers"
```

---

### Task 14: `usePrintBill.ts` — pass `hotline` through

**Files:**
- Modify: `NDTCore.FE/src/modules/pos/composables/usePrintBill.ts`

**Interfaces:**
- Consumes: `shiftStore.hotline` (Task 11), `BillStoreInfo.hotline` (Task 13).
- Produces: nothing consumed by later tasks (last task in the plan).

- [ ] **Step 1: Replace the full file content**

```ts
import { ref } from 'vue'
import { useToastNotification } from '@/composables/useToastNotification'
import { posService } from '../services/pos.service'
import { usePosShiftStore } from '../stores/pos-shift.store'
import { buildBillHtml } from '../utils/build-bill-html.util'
import { printHtmlViaIframe } from '../utils/print-iframe.util'

export function usePrintBill() {
    const toast = useToastNotification()
    const shiftStore = usePosShiftStore()
    const isPrinting = ref(false)

    async function printBill(orderId: number): Promise<void> {
        isPrinting.value = true
        try {
            const order = await posService.getOrderByIdAsync(orderId)
            if (!order) {
                toast.error('Không tải được chi tiết đơn hàng.')
                return
            }
            const html = buildBillHtml(order, {
                name: shiftStore.storeName,
                logoUrl: shiftStore.logoUrl,
                address: shiftStore.address,
                hotline: shiftStore.hotline,
            })
            printHtmlViaIframe(html)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'In bill thất bại.')
        } finally {
            isPrinting.value = false
        }
    }

    return { isPrinting, printBill }
}
```

- [ ] **Step 2: Verify type-check**

Run: `cd NDTCore.FE && npx vue-tsc --build`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add NDTCore.FE/src/modules/pos/composables/usePrintBill.ts
git commit -m "feat: pass store hotline to bill builder"
```

---

## Final End-to-End Verification

After all 14 tasks are complete:

```bash
cd NDTCore.BE/src && dotnet build NDTCore.sln
cd NDTCore.FE && npx vue-tsc --build
```

Both must report 0 errors. Manually smoke-test in the running app (not automatable without a test harness):
1. Create a POS order with `ServiceType = Delivery`, a non-zero delivery fee, `PaymentMethod = Cash`, `PaymentStatus = Paid`, and an `AmountReceived` ≥ total — confirm it succeeds and the change amount shown matches `AmountReceived - TotalAmount`.
2. Try the same with `AmountReceived` less than the total — confirm the API call fails and a toast appears (no new FE code needed for this, per Global Constraints).
3. Print the bill for that order — confirm the new layout renders item size/topping indentation, the delivery fee line, the cash/change lines, and the store hotline correctly on the print preview.
