# Frontend Design System

This project uses Tailwind utilities plus small internal React components. Plain CSS is reserved for root, body, and base element rules in `frontend/src/styles.css`.

## Goals

- Keep frontend styling predictable without adding a UI library.
- Prefer shared internal components for repeated UI behavior.
- Keep page-specific layout close to the page that owns it.
- Avoid global CSS selectors for component or route styling.

## Structure

| Layer | Location | Use |
|---|---|---|
| Base globals | `frontend/src/styles.css` | Tailwind import, root/body defaults, base form/code element rules |
| Shared primitives | `frontend/src/components/` | Buttons, cards, pills, modal, text helpers, copied code |
| Shared patterns | `frontend/src/components/` | Page shells, sections, tables, status rows, filter/pager bars |
| Feature UI | `frontend/src/features/**` | Feature-specific forms, panels, modals, and page sections |
| Route pages | `frontend/src/pages/` | Page composition and route-owned layout |
| Local class constants | Same component file | One-off repeated class strings or conditional class maps |

The project currently keeps shared primitives and patterns in a flat `frontend/src/components/` folder. Do not introduce `components/ui/` or `components/patterns/` unless the component list becomes hard to navigate.

## Styling Rules

- Use Tailwind utilities for component and page styling.
- Do not add component-specific CSS files.
- Do not add global classes for page or component styling.
- Keep `frontend/src/styles.css` limited to base/global element rules.
- Use `cx` from `frontend/src/lib/cx.ts` for conditional classes.
- Keep local class constants unexported and in the component file that uses them.
- Prefer existing components before creating new ones.
- Add a shared component only when the same structure or behavior appears in multiple places.

## Shared Components

Use these before writing bespoke markup:

- `Page`: route-level header, title, eyebrow, and optional action.
- `Card`: primary white card surface.
- `Section`: grouped content block inside a page.
- `Button` / `IconButton`: button variants and icon-only actions.
- `ButtonRow`: wrapping button groups.
- `Pill`: compact status/category label.
- `Text`: shared muted, error, and eyebrow text helpers.
- `Modal`: portal-backed dialog shell.
- `DataTable`: workflow-style table shell, wrapper, rows, and action cells.
- `StatusRow`: compact label/value/status presentation.
- `ListPagerFilterBar`: list filtering and pagination controls.
- `JsonPreview`: formatted JSON/code preview surface.

If a shared component needs a new variant, add the smallest variant that matches an existing repeated need. Do not introduce a variant system dependency unless the current component API becomes difficult to maintain.

## Page-Specific Layout

For one route or one feature surface, inline Tailwind classes are preferred. Local constants are acceptable when they avoid duplicated long strings or make conditional states easier to read.

Good local constants:

```tsx
const labelClass = "grid gap-2 font-bold text-slate-700";
const inputClass = "w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-950";
```

Avoid exporting these constants or moving them into shared files unless more than one feature uses the same structure.

## Forms

- Use global base input styles for ordinary inputs.
- Add Tailwind classes locally when a form needs a special layout or visual treatment.
- Keep inline validation near the field or form when the user needs to compare the error with entered values.
- Use toast errors for transient action failures that should not occupy page layout.

## Tables And Lists

- Use `DataTable` for tabular workflow/history/list surfaces.
- Use compact cards/lists instead of tables when the content is entity-detail oriented, narrow, or action-heavy.
- Preserve the shared table visual style: rounded bordered wrapper, uppercase slate header row, `border-t` body rows, and `px-4 py-3` cells.

## Tokens

This repo does not currently define a Tailwind config or CSS token layer. Use Tailwind's default scale directly unless a repeated value becomes a real maintenance issue.

Add tokens only when there is a concrete need, such as a brand color used across many surfaces or a spacing/type rule that cannot be expressed clearly with Tailwind defaults.

## Do Not Add Yet

- A UI library.
- `cva` or another variant helper dependency.
- A Tailwind config solely for organization.
- Global component utility classes like `.section-h2` or `.text-muted-light`.
- New folder taxonomy purely for aesthetics.

These can be reconsidered if the component set grows enough that the current simple structure becomes painful.

## Verification

For frontend styling changes, run:

```bash
npm --prefix frontend run build
```

For docs-only changes, inspect the rendered Markdown diff and skip the frontend build unless code or package files changed.
