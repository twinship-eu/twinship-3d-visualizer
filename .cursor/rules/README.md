# Cursor Rules

This directory contains coding rules that guide AI assistants when working on this project.

## How Rules Work

- **Cursor** automatically applies rules based on file context and `alwaysApply` setting
- **Claude Code** can reference these rules for consistency
- Rules use `.mdc` format with YAML frontmatter

## Rule Files

| File                      | Applies To      | Purpose                                                |
| ------------------------- | --------------- | ------------------------------------------------------ |
| `coding-standards.mdc`    | Always          | Core principles, error handling, code organization     |
| `typescript-patterns.mdc` | `*.ts` files    | Type safety, prefer types over interfaces, null safety |
| `react-patterns.mdc`      | `*.tsx` files   | Component structure, hooks, Server/Client components   |
| `imports.mdc`             | `*.ts, *.tsx`   | Import order and organization                          |
| `naming-conventions.mdc`  | Always          | File, function, variable naming standards              |
| `styling.mdc`             | `*.tsx, *.css`  | Tailwind CSS patterns and responsive design            |
| `data-fetching.mdc`       | `*.ts, *.tsx`   | SWR patterns, query hooks, mutations                   |
| `constants-config.mdc`    | Always          | Configuration management, constants organization       |
| `page-structure.mdc`      | `**/page.tsx`   | Page organization, container pattern, mock data        |
| `shared-components.mdc`   | `**/*.tsx`      | Shared layout components, PageWrapper pattern          |
| `custom-hooks.mdc`        | `**/hooks/*.ts` | Custom UI hooks (not data fetching)                    |

## Adding New Rules

1. Create a new `.mdc` file in this directory
2. Add YAML frontmatter:

   ```yaml
   ---
   description: Brief description
   globs: "**/*.ext" # or omit for alwaysApply
   alwaysApply: false # true for universal rules
   ---
   ```

3. Write concise, actionable content with examples
4. Keep under 50 lines when possible
5. Update this README and `AGENTS.md`

## Best Practices

- **One concern per rule** - Split large topics into focused files
- **Show examples** - Include ✅ GOOD and ❌ BAD examples
- **Be specific** - Use file patterns to target relevant code
- **Stay concise** - Developers and AI both prefer brief, clear rules
- **Avoid duplication** - Don't repeat what's in README.md

## Key Conventions

### Component Props

- Internal use only: `type Props`
- Exported for reuse: `export type ComponentNameProps`

### Type Organization

- Group feature types in `[feature-name]-types.ts` files
- Export shared types, keep component-specific types local

### Constants & Configuration

- Multi-file usage: `[feature-name]-config.ts`
- Single-file usage: Top of the file

### Data Fetching

- Use SWR for all data fetching
- Query hooks in `queries/` folder
- Name pattern: `use[Resource]Query`, `use[Action]Mutation`

### Custom Hooks

- UI/behavior hooks in `hooks/` folder
- NOT for data fetching (use `queries/` instead)
- Examples: useToggle, useLocalStorage, useMediaQuery

### Mock Data

- Store in `[feature-name]-mock.ts` files
- Never define mock data in pages

### Page Structure

- Pages only gather components
- No logic, state, or hooks at page level
- Use container components for page-level logic

### Shared Components

- Use `PageWrapper` for consistent page layouts
- Avoid repeating layout styles
- Store shared UI components in `components/ui/`

## References

- [Cursor Rules Documentation](https://docs.cursor.com/context/rules)
- See `AGENTS.md` for the complete rule index
- See `README.md` for project conventions
