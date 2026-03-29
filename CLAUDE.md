@AGENTS.md

## Tailwind v4 — Canonical Class Syntax

Always use canonical Tailwind v4 utility class forms. Never use hex literals or legacy bracket-var syntax.

| Wrong | Correct |
|---|---|
| `text-[#1E6B3C]` | `text-accent` (if token is in `@theme`) |
| `bg-[var(--color-accent)]` | `bg-accent` |
| `bg-[(--color-accent)]` | `bg-accent` |
| `bg-(--color-accent)` | `bg-accent` (prefer named token when available) |
| `text-(--color-accent-light)` | `text-accent-light` |
| `border-black/[0.05]` | `border-black/5` |

**Rule**: If a CSS variable is declared in `@theme`, use its generated utility name (`accent`, `accent-light`, `base-dark`, etc.). Only use `(--var)` shorthand for `:root`-only tokens that have no generated utility (e.g. `bg-(--lobby-surface)`).
