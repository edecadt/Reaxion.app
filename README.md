# ACTION-REACTION

> Automation platform in the spirit of IFTTT/Zapier. Connect third-party services, detect events (Actions), and react automatically (REActions) across web, mobile, and API clients.

## 📚 Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Installation & Setup](#installation--setup)
- [Running Locally](#running-locally)
- [API Documentation](#api-documentation)
- [Services Catalogue](#services-catalogue)
- [Environment Variables](#environment-variables)
- [Additional Resources](#additional-resources)

## Project Overview

Action-Reaction lets users compose **AREA** automations by pairing an event _Action_ from one integration with a follow-up _REAction_ from another. Automations can be created from the web dashboard, the Android app, or via REST APIs.

Core capabilities:

- Secure authentication (email/password + OAuth2 providers).
- Service directory with OAuth/API-key/on-prem integrations.
- Workflow engine with polling, webhooks, manual triggers, and execution logs.
- Clients: REST API (NestJS), web frontend (Next.js), Android app (React Native/Expo).

## Architecture

Monorepo managed with pnpm and Turborepo. Each integration is a lightweight package in the `services/` directory and is discovered dynamically by the backend.

```
┌────────────────┐      ┌────────────────┐      ┌────────────────┐
│  Mobile App    │      │   Web Client   │      │   REST API     │
│ (React Native) │◄─────┤   (Next.js)    │◄─────┤   (NestJS)     │
└────────────────┘      └────────────────┘      └────────┬───────┘
                                                          │
                                                ┌─────────▼─────────┐
                                                │ PostgreSQL + Redis │
                                                └─────────┬─────────┘
                                                          │
                                                ┌─────────▼──────────┐
                                                │     Services/      │
                                                │  (Integrations)    │
                                                └────────────────────┘
```

- **apps/backend** – NestJS API, service registry, workflow engine.
- **apps/web** – Next.js dashboard for creating and monitoring automations.
- **apps/mobile** – Expo application that consumes the same APIs.
- **services/** – Integration manifests + optional handlers (loaded dynamically).
- **packages/** – Shared TypeScript types, SDK helpers, lint & TS configs.

## Tech Stack

**Backend** – NestJS 11, TypeScript, Prisma (PostgreSQL), Redis, Passport, Swagger.
**Web** – Next.js/React, TypeScript, Tailwind CSS, React Query/Context.
**Mobile** – React Native (Expo), TypeScript, secure storage for tokens.
**DevOps** – Docker Compose, pnpm workspace, Turborepo, Jest, ESLint/Prettier.

## Installation & Setup

### Prerequisites

- Node.js 18+ and `pnpm` (preferred). Yarn/npm work but are not tested.
- Docker & Docker Compose (for infrastructure and one-command start).
- Git.

### Clone & install

```bash
git clone https://github.com/<your-org>/action-reaction.git
cd action-reaction
pnpm install
```

### Configure environment

1. Copy the default environment: `cp apps/backend/.env.example .env` (or use the sample in `docs/env.example` when available).
2. Set database credentials, JWT secret, OAuth client IDs/secrets, and third-party keys.
3. Optional: configure mail provider credentials for password reset emails.

### Start everything with Docker

```bash
docker-compose up --build
```

Services boot with hot reload disabled (production-like). Containers expose:

- API → http://localhost:8080
- Web → http://localhost:8081
- PostgreSQL → localhost:5432
- Redis → localhost:6379
- Shared APK → `./apps/web/public/client.apk`

Stop containers with `docker-compose down`.

## Running Locally

Use this approach for iterative development.

1. Start infrastructure (database, cache, background workers):
   ```bash
   docker-compose up postgres redis
   ```
2. Start the backend (NestJS):
   ```bash
   pnpm --filter backend start:dev
   ```
3. Start the Next.js web client:
   ```bash
   pnpm --filter web dev
   ```
4. Start the mobile app (Expo):
   ```bash
   pnpm --filter mobile start
   # or build an Android APK
   pnpm --filter mobile build:android
   ```

### Access points

- REST API documentation (Swagger): http://localhost:8080/api/docs
- API health: `GET http://localhost:8080/`
- About manifest: `GET http://localhost:8080/about.json`
- Web dashboard: http://localhost:8081
- Android APK (served by web): http://localhost:8081/client.apk

## API Documentation

All routes live under `http://localhost:8080`. JWT bearer tokens protect authenticated endpoints. Swagger UI is available at `/api/docs` once the backend runs.

### Authentication & Users

| Method | Path                    | Description                                 | Auth   |
| ------ | ----------------------- | ------------------------------------------- | ------ |
| POST   | `/auth/register`        | Create a new user account.                  | Public |
| POST   | `/auth/login`           | Authenticate via email/password.            | Public |
| POST   | `/auth/forgot-password` | Send reset instructions.                    | Public |
| POST   | `/auth/reset-password`  | Reset password with token.                  | Public |
| GET    | `/auth/google`          | Start Google OAuth flow.                    | Public |
| GET    | `/auth/google/callback` | Google OAuth callback (redirects with JWT). | Public |
| GET    | `/auth/github`          | Start GitHub OAuth flow.                    | Public |
| GET    | `/auth/github/callback` | GitHub OAuth callback (redirects with JWT). | Public |

Example – register a user:

```bash
curl -X POST http://localhost:8080/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "alice@example.com",
    "password": "superSecret123",
    "name": "Alice"
  }'
```

Successful response:

```json
{
  "user": { "id": 1, "email": "alice@example.com", "name": "Alice" },
  "token": "<JWT access token>"
}
```

### Service connections (`/api/service-auth`)

| Method | Path                                       | Description                                              |
| ------ | ------------------------------------------ | -------------------------------------------------------- |
| GET    | `/api/service-auth/connections`            | List integrations linked to the current user.            |
| GET    | `/api/service-auth/connections/:serviceId` | Retrieve connection details for one service.             |
| GET    | `/api/service-auth/connect/:serviceId`     | Begin OAuth2 sign-in for a service (redirect or JSON).   |
| POST   | `/api/service-auth/connect/api-key`        | Attach an API-key based service.                         |
| DELETE | `/api/service-auth/connections/:serviceId` | Remove a linked service (disconnect).                    |
| GET    | `/api/service-auth/callback/:serviceId`    | OAuth2 callback handler (redirects back to the web app). |

All routes above require a bearer token except the OAuth callback. Example (request OAuth redirect URL as JSON):

```bash
curl -H "Authorization: Bearer <JWT>" \
  -H "Accept: application/json" \
  http://localhost:8080/api/service-auth/connect/github
```

### Workflows (`/workflows`)

| Method | Path                          | Description                                 |
| ------ | ----------------------------- | ------------------------------------------- |
| POST   | `/workflows`                  | Create a workflow definition (AREA).        |
| GET    | `/workflows`                  | List workflows (optional `?active=true`).   |
| GET    | `/workflows/:id`              | Fetch a workflow definition.                |
| PATCH  | `/workflows/:id`              | Update workflow metadata, nodes, or status. |
| DELETE | `/workflows/:id`              | Remove a workflow.                          |
| POST   | `/workflows/:id/activate`     | Mark workflow active.                       |
| POST   | `/workflows/:id/deactivate`   | Mark workflow inactive.                     |
| POST   | `/workflows/:id/execute`      | Run the workflow manually (returns run ID). |
| GET    | `/workflows/:id/runs`         | List historical runs for a workflow.        |
| GET    | `/workflows/runs/:runId`      | Inspect run status.                         |
| GET    | `/workflows/runs/:runId/logs` | Retrieve execution logs for a run.          |

### Webhooks (`/webhooks`)

| Method | Path                               | Description                                      |
| ------ | ---------------------------------- | ------------------------------------------------ |
| ALL    | `/webhooks/:service/:event`        | Receive incoming webhook payloads.               |
| ALL    | `/webhooks/:service/:event/:token` | Same as above, with workflow token verification. |

### About manifest

`GET /about.json` → returns the public manifest consumed by clients.

Example request:

```bash
curl http://localhost:8080/about.json
```

Example response:

```json
{
  "client": { "host": "127.0.0.1" },
  "server": {
    "current_time": 1730135370,
    "services": [
      {
        "id": "github",
        "name": "github",
        "auth": { "type": "oauth2" },
        "actions": [
          {
            "id": "issue-created",
            "name": "Issue Created",
            "description": "Triggers when a new issue is opened."
          },
          {
            "id": "pull-request-opened",
            "name": "Pull Request Opened",
            "description": "Triggers when a PR is opened."
          }
        ],
        "reactions": []
      }
    ]
  }
}
```

The backend populates the `services` array dynamically from the contents of the `services/` directory at runtime.

## Services Catalogue

Below is the catalog currently bundled with the project. Each service is discoverable via `/about.json`.

| Service ID     | Auth                                   | Key Actions                                                                                                                            | Key Reactions                   |
| -------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `github`       | OAuth2 (repo, user)                    | `issue-created`, `issue-closed`, `issue-comment-created`, `pull-request-opened`, `pull-request-merged`, `pull-request-comment-created` | —                               |
| `discord`      | None (bot token supplied per workflow) | `message-received`                                                                                                                     | `send-webhook-message`          |
| `google`       | OAuth2 (Gmail + Calendar scopes)       | `gmail-email-received`, `calendar-event-created`                                                                                       | —                               |
| `openai`       | API key                                | —                                                                                                                                      | `generate-completion`           |
| `telegram`     | None (bot token supplied per workflow) | —                                                                                                                                      | `send-channel-message`          |
| `timer`        | None                                   | `Cron`                                                                                                                                 | `wait`, `log`                   |
| `weather`      | None                                   | —                                                                                                                                      | `current` (get current weather) |
| `javascript`   | None                                   | —                                                                                                                                      | `run` (execute sandboxed JS)    |
| `test-webhook` | None                                   | `on-test-webhook`                                                                                                                      | —                               |

Machine-readable example consumed by the web/mobile clients:

```json
{
  "service": "github",
  "actions": ["issue-created", "pull-request-opened"],
  "reactions": ["send-webhook-message"]
}
```

Replace the values above with the actual actions/reactions of interest when building workflow templates.

## Environment Variables

Backend `.env` keys you will usually set:

- `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`
- `REDIS_URL`, `REDIS_PORT`, `REDIS_PASSWORD`
- `PORT` or `BACKEND_PORT` (defaults to 8080)
- `JWT_SECRET`
- `RESEND_API_KEY` (optional, transactional emails)
- OAuth credentials:
  - `GOOGLE_CLIENT_ID_ACTION_REACTION`, `GOOGLE_CLIENT_SECRET_ACTION_REACTION`
  - `GITHUB_CLIENT_ID_ACTION`, `GITHUB_CLIENT_SECRET_ACTION`
- Third-party API keys per service (e.g. `OPENAI_API_KEY`)
- Frontend URLs used during redirects: `FRONTEND_URL`, `MOBILE_REDIRECT_URL`

The web and mobile apps read their own `.env.local` files (see `apps/web/.env.example` and `apps/mobile/.env.example`).

## Additional Resources

- Developer onboarding & contribution workflow: [HOWTOCONTRIBUTE.md](./HOWTOCONTRIBUTE.md)
- Service SDK guide: [docs/create-new-service.md](./docs/create-new-service.md)
- Sample manifest payload for demos: [docs/about.sample.json](./docs/about.sample.json)
- Optional diagrams (architecture, workflows, data model) can be stored under `docs/`
- Planning & milestone decks should include benchmark, schedules, and the `/about.json` payload for each presentation.

## License

Educational project developed at EPITECH (no commercial license provided).
