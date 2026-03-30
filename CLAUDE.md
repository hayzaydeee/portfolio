@AGENTS.md

## Tailwind v4 — Canonical Class Syntax

Always use canonical Tailwind v4 utility class forms. Never use hex literals or legacy bracket syntax for anything that maps to the scale.

### Color tokens

| Wrong | Correct |
|---|---|
| `text-[#1E6B3C]` | `text-accent` (if token is in `@theme`) |
| `bg-[var(--color-accent)]` | `bg-accent` |
| `bg-[(--color-accent)]` | `bg-accent` |
| `bg-(--color-accent)` | `bg-accent` (prefer named token when available) |
| `text-(--color-accent-light)` | `text-accent-light` |
| `text-(--color-text-muted)` | `text-text-muted` |
| `text-(--color-base-dark)` | `text-base-dark` |
| `border-black/[0.05]` | `border-black/5` |

**Rule**: If a CSS variable is declared in `@theme`, use its **generated utility name** (`accent`, `accent-light`, `base-dark`, `text-muted`, etc.). Only use `(--var)` shorthand for `:root`-only tokens that have no generated utility (e.g. `bg-(--lobby-surface)`, `text-(--lobby-text)`).

### Spacing & sizing

Never use `[Xpx]` or `[Xrem]` when an equivalent Tailwind scale value exists.

| Wrong | Correct |
|---|---|
| `mt-[2px]` | `mt-0.5` |
| `mt-[4px]` | `mt-1` |
| `p-[8px]` | `p-2` |
| `px-[12px]` | `px-3` |
| `gap-[6px]` | `gap-1.5` |
| `w-[100%]` | `w-full` |
| `h-[100vh]` | `h-screen` |
| `opacity-[0.5]` | `opacity-50` |

Only use `[Xpx]` for values with **no scale equivalent** (e.g. `text-[10px]`, `w-[340px]`, `rounded-[3px]`).

### Arbitrary variants — NEVER use unless no other option exists

`[&_pre]:!bg-transparent`, `[&_code]:!m-0` — these are almost always the wrong approach. Before reaching for an arbitrary variant:
1. Can you restructure the HTML so the element is directly targeted?
2. Can you add a class directly to the element?
3. Can you write a `@layer components` rule in `globals.css`?

Arbitrary variants are a last resort, not a default tool.

### `style={{}}` inline — NEVER for values that Tailwind can express

Never write `style={{ color: "var(--x)" }}`, `style={{ background: "#hex" }}`, etc. when a Tailwind class can express the same thing.

| Wrong | Correct |
|---|---|
| `style={{ color: "var(--workshop-text)" }}` | `text-(--workshop-text)` |
| `style={{ background: "#0A120D" }}` | `bg-(--workshop-base)` (use the token) |
| `style={{ background: "var(--accent)" }}` | Map to a token in `:root` or `@theme`, then use the class |

`style={{}}` is only acceptable for: truly dynamic values computed at runtime (e.g. `transform: translateX(${x}px)`), or multi-property shorthand with no Tailwind equivalent.
