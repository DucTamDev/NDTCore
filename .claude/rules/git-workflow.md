---
description: Git workflow rules — apply when making commits or reviewing changes in the NDTCore project
---

# Git Workflow

## Commit Message Format

```
<type>: <short description>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`

## Rules

- Một commit = một việc rõ ràng
- Không commit file generated (migrations chạy xong thì commit riêng)
- Không commit `appsettings.Development.json` hay `.env.local`
- Trước khi commit BE: chạy `dotnet build` để đảm bảo không có lỗi compile
- Trước khi commit FE: chạy `npx vue-tsc --build` để đảm bảo không có type error
