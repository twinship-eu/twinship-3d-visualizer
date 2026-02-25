# AI Guidelines

High-level guidance for AI-assisted development in this project.

## Quick Reference

- **Project setup & conventions**: See [README.md](README.md)
- **Detailed coding rules**: See [.cursor/rules/README.md](.cursor/rules/README.md)
- **Branch naming & commits**: See [README.md](README.md#branch-naming-convention)

## Rules System

### How It Works

- **Cursor IDE**: Automatically applies rules from `.cursor/rules/*.mdc` based on file context
- **Claude Code**: References auto-generated `CLAUDE.md` file
- **Syncing**: Run `npm run sync:claude-rules` after editing rules

### Available Rules

See [.cursor/rules/README.md](.cursor/rules/README.md) for detailed documentation on each rule.

| Rule File                  | Scope           | Purpose                                       |
| -------------------------- | --------------- | --------------------------------------------- |
| `coding-standards.mdc`     | Always          | Core coding principles and error handling     |
| `typescript-patterns.mdc`  | `*.ts` files    | TypeScript conventions and type safety        |
| `react-patterns.mdc`       | `*.tsx` files   | React/Next.js component patterns              |
| `imports.mdc`              | `*.ts, *.tsx`   | Import organization and structure             |
| `naming-conventions.mdc`   | Always          | File, function, and variable naming           |
| `styling.mdc`              | `*.tsx, *.css`  | Tailwind CSS and styling patterns             |
| `data-fetching.mdc`        | `*.ts, *.tsx`   | SWR patterns, query hooks, mutations          |
| `url-state-management.mdc` | `*.ts, *.tsx`   | URL/query params state with nuqs              |
| `state-management.mdc`     | `*.ts, *.tsx`   | Global client state with zustand (rare use)   |
| `constants-config.mdc`     | Always          | Configuration and constants management        |
| `page-structure.mdc`       | `**/page.tsx`   | Page organization and container pattern       |
| `shared-components.mdc`    | `**/*.tsx`      | Shared layout components, PageWrapper pattern |
| `custom-hooks.mdc`         | `**/hooks/*.ts` | Custom UI hooks (not data fetching)           |

## State Management Decision Tree

**Choose the right tool for the job:**

1. **Is it server data?** → Use **SWR** (see `data-fetching.mdc`)
2. **Should it be in the URL?** → Use **nuqs** (see `url-state-management.mdc`)
3. **Is it local to one component/page?** → Use **useState** (see `react-patterns.mdc`)
4. **Cross-page persistent client state?** → Use **zustand** - RARE (see `state-management.mdc`)

> **Important**: zustand should be used rarely. Always exhaust options 1-3 first.

## Code Formatting

- **Tool**: Prettier with automatic Tailwind class sorting
- **Commands**: `npm run format` or `npm run format:check`
- **Config**: See [README.md](README.md#code-formatting) for details

### ⚠️ Protected Directories

**Do NOT format** these existing feature directories (maintain their current style):

- `features/chat/`
- `features/map/`
- `features/route-analysis/`
- `features/sidebar/`
- `features/top-bar/`

These are excluded in `.prettierignore` to preserve their existing formatting.

## File Organization

Feature-based structure - see `.cursor/rules/README.md` for details:

```text
features/
  [feature-name]/
    [feature-name].tsx           # Main component
    [feature-name]-types.ts      # Type definitions
    [feature-name]-config.ts     # Constants (multi-file use)
    [feature-name]-state.ts      # Zustand store (rare)
    [feature-name]-mock.ts       # Mock data
    components/                  # Feature components
    queries/                     # SWR data fetching
    hooks/                       # Custom UI hooks
    lib/                         # Utilities
```

## Key Principles

- **Colocate** related files in feature folders
- **Prefer `type`** over `interface` (except declaration merging)
- **Use `cn()`** utility for conditional Tailwind classes
- **Keep files under 300 lines** - split when exceeding
- **Named exports** for better refactoring (except Next.js pages)
- **No barrel exports** - avoid circular dependencies

## Workflow

### Adding/Modifying Rules

1. Edit `.mdc` file in `.cursor/rules/`
2. Run `npm run sync:claude-rules`
3. Commit both `.mdc` and `CLAUDE.md`

### For Detailed Information

- **Setup & configuration**: [README.md](README.md)
- **Coding conventions**: [.cursor/rules/README.md](.cursor/rules/README.md)
- **Individual rules**: [.cursor/rules/](.cursor/rules/) directory
