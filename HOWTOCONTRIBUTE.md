# HOWTOCONTRIBUTE.md

Thank you for helping build **Action-Reaction**! This document explains how the monorepo is organised, how to extend it with new services/actions/reactions, and what quality checks are expected before opening a pull request.

## Project Structure

The repository is a pnpm/Turborepo workspace. Key folders:

- `apps/backend` – NestJS API (authentication, workflows, service registry, webhooks).
- `apps/web` – Next.js dashboard used by end users.
- `apps/mobile` – Expo/React Native client (Android APK served from the web app).
- `services/` – Integration packages. Every folder exports a manifest via `createService` from `@area/sdk`.
- `packages/` – Shared utilities (`@reaxion/common` types, SDK helpers, ESLint & TS configs).
- `docs/` – Architecture diagrams, planning decks, service how-tos.

When in doubt, search with `rg` for existing implementations (for example `rg "createAction" services`).

## Local Setup

1. Install dependencies once: `pnpm install` at the repository root.
2. Copy environment files (see `README.md` for details) and start the infrastructure: `docker-compose up postgres redis`.
3. Run the backend with hot reload: `pnpm --filter backend start:dev`.
4. Run the web client: `pnpm --filter web dev`. Optionally launch the mobile client with `pnpm --filter mobile start`.

Swagger is available at `http://localhost:8080/api/docs`; the manifest is at `http://localhost:8080/about.json`.

## Extending the Platform

### Add a New Service

1. Create a folder under `services/<service-id>` using a readable slug (`kebab-case`).
2. Initialise the package (`pnpm init`) and set `"type": "module"` plus `@area/sdk` dependency (see `docs/create-new-service.md` for a ready-made template).
3. Implement `index.ts` with `createService({ id, name, version, description, auth, actions, reactions, webhooks })`.
4. Run `pnpm install` at the repository root so the new package is registered with the workspace.
5. Restart the backend (`pnpm --filter backend start:dev`). The service should appear in `GET /about.json` under `server.services`.

### Add an Action or Reaction to an Existing Service

1. Open the manifest in `services/<service-id>/index.ts`.
2. Use the SDK helpers (`createAction`, `createReaction`, `createWebhook`, `textInput`, `selectInput`, etc.) to describe the new capability.
3. Ensure each item has a stable `id` (used by workflows) and human-friendly `name`/`description`.
4. For actions that poll external APIs, implement the `run` method to return `null` when no trigger should occur and an object matching `output` when it should.
5. For reactions, implement `run` to perform the side effect and return diagnostic data. Use `ctx.logger?.log` for rich logs.
6. Restart (or rely on the file watcher) and confirm the item surfaces in `/about.json` and the web UI catalogue.

### Exposing Data in `/about.json`

- The backend automatically maps `services/<service-id>` manifests to `/about.json` via the `ServiceRegistry`.
- After adding or modifying actions/reactions, hit `GET http://localhost:8080/about.json` and verify the payload contains the new definitions.
- If a service requires runtime handlers (webhooks or custom logic), provide a default export that implements the SDK contract so the registry can load it.

## Testing & Validation Checklist

- **Unit tests**: `pnpm --filter backend test -- --watch=false` or scope to a package. Add tests for service helpers when applicable.
- **Integration tests**: `pnpm --filter backend test:integration` to validate end-to-end flows (requires Postgres/Redis up).
- **Type checks & lint**: `pnpm lint` and `pnpm --filter backend check-types`.
- **Manual verification**:
  - Create/update a workflow via the web UI or Postman.
  - Trigger the new action/reaction (use internal helper scripts or sample curl requests recorded in `docs/`).
  - Watch logs in `/workflows/runs/:runId/logs` to confirm correct behaviour.
  - Confirm `/about.json` includes the new metadata and that the web client renders the configuration form correctly.
- **Postman/Insomnia**: Collections are optional but recommended; export them to `docs/postman/` when relevant.

## Contribution Workflow

1. **Branching**
   - Base branch: `main` (optionally `dev` if your team uses an integration branch).
   - Feature branches follow `type/short-description` or the issue tracker slug (`REA-123-add-discord-reaction`).
2. **Commits**
   - Use Conventional Commits: `feat(service): add weather reaction`, `fix(workflows): guard null payload`, etc.
   - Keep commits focused; squash merge keeps history clean.
3. **Pull Requests**
   - Fill in the PR template (what/why, testing evidence, screenshots when UI changes).
   - Request at least one reviewer; wait for ✅ CI (lint + tests) before merging.
   - We only allow **Squash & Merge** so the PR title becomes the merge commit.
4. **Definition of Done**
   - CI green, `/about.json` updated automatically, documentation refreshed if behaviour changes.
   - Add or update diagrams in `docs/` when architecture meaningfully evolves.

## Code Quality Checklist

- No lint/type errors, no `console.log` left in production code (use the logger abstraction).
- Sensitive configuration comes from environment variables; never hard-code secrets.
- Docs updated: `README.md` for user-facing changes, `docs/create-new-service.md` or service-specific notes for deep dives.
- If you add dependencies, prefer `pnpm add <pkg> --filter <workspace>` to keep manifests tidy.

Happy automating! 🚀
