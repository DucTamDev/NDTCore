# .claude Directory Template

```
project/
├── CLAUDE.md                          # commit   | Tài liệu chính của project: context, conventions, commands hay dùng.
│                                      #           | Claude Code load tự động mỗi session, không cần gọi thủ công.
├── CLAUDE.local.md                    # gitignore | Personal prefs của từng dev: editor, style riêng.
│                                      #           | Tạo thủ công, không commit.
├── .mcp.json                          # commit   | Danh sách MCP servers dùng chung cho cả team.
│                                      #           | Secrets đặt trong env var, không hardcode vào file này.
├── .worktreeinclude                   # commit   | Danh sách gitignored files cần copy vào git worktree mới.
│                                      #           | Thường gồm .env, appsettings.local.json, secrets.json.
│
└── .claude/
    ├── settings.json                  # commit   | Cấu hình enforced cho cả team: allowed/denied bash commands,
    │                                  #           | hooks, env vars, model mặc định. Khác CLAUDE.md ở chỗ đây là
    │                                  #           | machine-readable config, không phải guidance text.
    ├── settings.local.json            # gitignore | Personal overrides của từng dev.
    │                                  #           | Auto-gitignored bởi Claude Code, không cần thêm vào .gitignore.
    │
    ├── rules/                         # commit   | Instructions bổ sung, chia theo topic hoặc file scope.
    │   └── <topic>.md                 #           | Không có paths: → load lúc session start (global).
    │                                  #           | Có paths: → chỉ load khi file matching mở vào context.
    │                                  #           | Subdirectory được discover tự động, không cần khai báo.
    │
    ├── skills/                        # commit   | Reusable prompts, invoke bằng /name trong chat.
    │   └── <name>/                    #           | Dùng folder để bundle thêm supporting files
    │       └── SKILL.md               #           | (references, examples, checklists).
    │                                  #           | Claude có thể tự auto-invoke nếu description đủ rõ.
    │
    ├── agents/                        # commit   | Mỗi file định nghĩa 1 subagent chạy độc lập.
    │   └── <name>.md                  #           | Subagent có context window riêng, tool access riêng,
    │                                  #           | model riêng. Claude tự delegate khi phù hợp.
    │
    ├── agent-memory/                  # commit   | Persistent memory cho subagents có memory: project.
    │   └── <agent-name>/              #           | Claude tự tạo và ghi MEMORY.md, không viết tay.
    │       └── MEMORY.md              #           | Chỉ tạo folder này khi agent thực sự cần nhớ state.
    │
    ├── workflows/                     # commit   | Dynamic workflow scripts dạng JS.
    │   └── <name>.js                  #           | Claude tự tạo từ lệnh /workflows, không viết tay.
    │                                  #           | Mỗi file trở thành 1 /<name> slash command.
    │
    └── output-styles/                 # commit   | Định nghĩa format output tùy chỉnh.
        └── <name>.md                  #           | Áp dụng khi outputStyle được set trong settings.json.
                                       #           | Nếu chỉ dùng cá nhân, đặt ở global ~/.claude thay vì đây.

backend/
├── CLAUDE.md                          # commit   | Context riêng cho backend: commands, module conventions,
│                                      #           | patterns. Load tự động khi làm việc trong thư mục này.
├── CLAUDE.local.md                    # gitignore | Personal prefs cho backend của từng dev.
│
└── .claude/
    ├── settings.json                  # commit   | Override root settings, chỉ áp dụng trong backend.
    ├── settings.local.json            # gitignore | Personal overrides cho backend.
    ├── rules/                         # commit   | Path-scoped rules cho backend files.
    ├── skills/                        # commit   | Backend-specific skills.
    ├── agents/                        # commit   | Backend-specific subagents.
    ├── agent-memory/                  # commit   | Memory cho backend agents.
    ├── workflows/                     # commit   | Backend-specific workflows.
    └── output-styles/                 # commit   | Backend-specific output styles.

frontend/
├── CLAUDE.md                          # commit   | Context riêng cho frontend: commands, component conventions,
│                                      #           | patterns. Load tự động khi làm việc trong thư mục này.
├── CLAUDE.local.md                    # gitignore | Personal prefs cho frontend của từng dev.
│
└── .claude/
    ├── settings.json                  # commit   | Override root settings, chỉ áp dụng trong frontend.
    ├── settings.local.json            # gitignore | Personal overrides cho frontend.
    ├── rules/                         # commit   | Path-scoped rules cho frontend files.
    ├── skills/                        # commit   | Frontend-specific skills.
    ├── agents/                        # commit   | Frontend-specific subagents.
    ├── agent-memory/                  # commit   | Memory cho frontend agents.
    ├── workflows/                     # commit   | Frontend-specific workflows.
    └── output-styles/                 # commit   | Frontend-specific output styles.

```

---

## Ghi chú

### Thứ tự ưu tiên settings

```
managed-settings.json (enterprise)
  > CLI flags
    > settings.local.json (project)
      > settings.json (project)
        > settings.json (global ~/.claude)
```

### .gitignore cần thêm

```gitignore
CLAUDE.local.md
.claude/settings.local.json
```