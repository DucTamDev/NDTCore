# NDTCore

Hệ thống quản lý bán lẻ/POS (Point of Sale) dành cho chuỗi nhà hàng/franchise.

Monorepo gồm hai sub-project độc lập — mỗi thư mục có CLAUDE.md riêng:
- [`NDTCore.BE/`](NDTCore.BE/CLAUDE.md) — .NET 8 backend (Modular Monolith + Clean Architecture)
- [`NDTCore.FE/`](NDTCore.FE/CLAUDE.md) — Vue 3 frontend (Vuetify 3 + Pinia)

---

## Project Structure

```
NDTCore/
├── NDTCore.BE/              # .NET 8 backend
│   └── src/
│       ├── NDTCore.API/         # entry point (ASP.NET Core)
│       ├── NDTCore.BuildingBlocks/  # shared contracts & base classes
│       └── NDTCore.Modules/     # business modules
│           ├── NDTCore.Brand/
│           ├── NDTCore.FileStorage/
│           ├── NDTCore.Identity/
│           ├── NDTCore.Order/
│           ├── NDTCore.Product/
│           ├── NDTCore.Store/
│           └── NDTCore.Tenant/
├── NDTCore.FE/              # Vue 3 frontend
│   └── src/
│       ├── core/            # shared utilities, API clients, auth
│       └── modules/         # business modules (auth, brand, order, pos, product, store, user…)
└── docs/
    ├── superpowers/
    │   ├── specs/           # design specs từ brainstorming sessions
    │   └── plans/           # implementation plans
    └── templates/           # CLAUDE.md, skill templates
```

---

## Modules

| Module | Chức năng |
|---|---|
| **Tenant** | Multi-tenancy root — mỗi tenant là 1 brand chain |
| **Brand** | Quản lý brand, franchisee |
| **Store** | Quản lý cửa hàng |
| **Product** | Sản phẩm, danh mục, option groups, store overrides |
| **Order** | Đơn hàng POS |
| **Identity** | Auth, user, role, permission |
| **FileStorage** | Upload/quản lý file |

---

## Common Commands

```bash
# Backend
cd NDTCore.BE/src && dotnet build NDTCore.sln
cd NDTCore.BE/src && dotnet ef migrations add <Name> --context Ndt<Module>Context --project ../NDTCore.Modules/NDTCore.<Module>/NDTCore.<Module>.Infrastructure --startup-project NDTCore.API --output-dir Persistence/Migrations

# Frontend
cd NDTCore.FE && npm run dev          # dev server
cd NDTCore.FE && npm run type-check   # vue-tsc
cd NDTCore.FE && npm run build        # production build
cd NDTCore.FE && npm run lint         # oxlint + eslint
```

---

## Key Conventions

- Không viết comment giải thích WHAT — chỉ viết khi WHY không rõ
- BE: XML doc **bắt buộc** song ngữ VN/EN cho mọi `class`, `interface`, `method`, `property` (kể cả `private`)
- FE: TypeScript strict, không dùng `any`
- Khi giải thích với user: dùng **tiếng Việt**
- Không thêm feature, abstraction, error handling quá mức cần thiết

## Docs

- Specs: `docs/superpowers/specs/YYYY-MM-DD-<topic>.md`
- Plans: `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`

---

## Claude Configuration (`.claude/`)

```text
.claude/
├── settings.json          # Project-level permissions (pattern-based)
├── settings.local.json    # Local overrides (gitignored)
├── rules/
│   └── git-workflow.md    # Global — commit format & pre-commit checks
└── skills/                # (empty — skills ở NDTCore.BE/ và NDTCore.FE/)
```
