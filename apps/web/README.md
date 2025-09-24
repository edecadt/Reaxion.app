# Reaxion Web Client

Next.js 15 interface for Reaxion.app with a Shadcn-inspired component system built on Tailwind CSS v4.

## Tech stack

- **Next.js 15** with the App Router and Turbopack dev server
- **Tailwind CSS v4** using CSS variables for theming
- **Custom Shadcn-style components** in `src/components/ui`
- **Local storage auth context** for lightweight session persistence

## Development

```bash
pnpm --filter web dev
```

The web client reads the backend endpoint from `NEXT_PUBLIC_API_URL` (see `apps/web/.env`). The default is `http://localhost:8080`.

### Linting & formatting

```bash
pnpm --filter web lint
pnpm format # runs repo-wide prettier rules
```

## Project structure

- `src/app` – Next.js routes and layouts
- `src/components/ui` – Reusable UI primitives mirroring Shadcn APIs (button, card, input, badge, alert, …)
- `src/lib/api.ts` – REST helper for talking to the Nest backend

## Styling guidelines

- Components consume design tokens via CSS variables (`--primary`, `--foreground`, etc.) defined in `src/app/globals.css`
- Prefer using the primitives from `src/components/ui` instead of raw Tailwind classes for consistency

## Auth flow

Registration and login POST to the Nest `/auth` endpoints and persist the returned `{ token, user }` payload in `localStorage`. The navbar reflects the current session instantly.
