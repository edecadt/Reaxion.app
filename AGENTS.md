# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by Turborepo + pnpm (Node >= 18).
- `apps/backend` — NestJS API (TypeScript). Tests in `apps/backend/test`.
- `apps/web` — Next.js app (TypeScript) with `src/` and `public/`.
- `apps/mobile` — Expo (React Native) app.
- `packages/common` — Shared TypeScript utilities.
- `packages/eslint-config`, `packages/typescript-config` — shared configs.
- `services/` — reserved for future services; avoid edits unless needed.
- Do not modify generated output: `dist/`, `.next/`, `build/`.

## Build, Test, and Development Commands
- Install deps: `pnpm i`
- Dev (all apps): `pnpm dev`
- Build (all): `pnpm build`
- Lint (all): `pnpm lint`  • Fix: `pnpm lint --fix`
- Format: `pnpm format`
- Type checks: `pnpm check-types`
- Target a single app: `pnpm turbo run dev --filter=web` (examples: `backend`, `mobile`, `packages/common`)
- Backend tests: `pnpm turbo run test --filter=backend` or `pnpm --filter backend test`

## Coding Style & Naming Conventions
- TypeScript-first, 2-space indentation.
- ESLint extends repo presets in `packages/eslint-config` with import ordering enforced.
- Filenames: kebab-case. React components: PascalCase.
- Nest files follow `*.module|service|controller.ts` naming.
- Run `pnpm lint` and `pnpm format` before pushing.

## Testing Guidelines
- Backend uses Jest (`*.spec.ts`). Place unit tests near related services/controllers.
- Run backend tests via the commands above; keep tests deterministic and focused.
- Web/Mobile have no runner prewired; add per app if needed (Vitest/RTL/Playwright acceptable).

## Commit & Pull Request Guidelines
- Conventional Commits enforced via commitlint (e.g., `feat(auth): add JWT login`).
- Husky + lint-staged run ESLint/Prettier on staged files.
- Branch names: `AREA-123-feature-name`, `feature/...`, or `fix/...` (see `HOWTOCONTRIBUTE.md`).
- PRs: clear description, link issues, screenshots for UI changes, pass CI, request ≥1 review. Use Squash & Merge only.

## Security & Configuration
- Use per-app `.env*` files (not committed). Turbo caches `.env*` as inputs.
- Never commit secrets/tokens. Prefer local `.env` and CI-managed secrets.

## Agent-Specific Notes
- Keep changes scoped to the correct app/package; follow existing patterns and shared configs.
- Align with repo tooling; avoid introducing new linters/formatters.
- Do not modify generated outputs or unrelated files.
