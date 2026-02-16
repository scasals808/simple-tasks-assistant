# Telegram Task Bot

## Overview

This project is a stateless Telegram Task Bot built with Node.js, TypeScript, Telegraf (webhook-only), Prisma, and PostgreSQL. It is designed for Render Free constraints: no polling workers, no Telegraf sessions/scenes, and no in-memory state as source of truth.

Implemented scope:
- Create tasks from group replies and complete creation in DM through a wizard.
- Enforce idempotency for draft/task finalization and duplicate webhook/callback delivery.
- Workspace/member/invite flows with admin-gated operations in DM.

## Architecture

- `src/bot` - Telegram handlers and callback routing (UI layer only).
- `src/domain` - business logic and use-cases.
- `src/infra` - Prisma and repository implementations.
- `src/config` - environment parsing and config helpers.
- `src/main.ts` - Fastify HTTP server + webhook endpoint.

Layering rules in code:
- `bot` calls `domain`.
- `domain` does not import Telegram.
- `infra` contains persistence/integration details.

## Features

### 1) Task creation from group reply

- In group:
  - user replies to a message,
  - sends `/task`,
  - bot sends `Create task?` with inline button `➕ Create task`.
- On button click:
  - bot answers callback query with deep link URL to DM (`/start <token>`),
  - deletes the group prompt message in best-effort mode,
  - redirect continues in DM.
- In DM:
  - wizard steps: assignee -> priority -> deadline -> confirm,
  - finalization creates task or returns existing task if duplicate.

### 2) Idempotency

- `TaskDraft` token is unique.
- `Task.sourceDraftId` is unique.
- `(sourceChatId, sourceMessageId)` is unique.
- Create-from-draft handles unique conflicts by returning existing task.

### 3) Workspace system

- Workspace is tied to a `chatId`.
- Workspace members are role-based (`ASSIGNER`, `EXECUTOR`).
- Admin operations are gated by env allowlist (`ADMIN_USER_IDS`).

### 4) Invite system

- Workspace invites are token-based.
- `/start join_<token>` in DM routes to invite acceptance.
- Membership upsert is idempotent.

### 5) Admin UI (DM only)

- `Admin` button is rendered only for allowlisted admins.
- Admin actions include:
  - create team via `/admin_create_team <chatId> [title...]`,
  - set assigner via `/admin_set_assigner <workspaceId> <userId>`,
  - optional explicit overwrite via `/admin_replace_assigner <workspaceId> <userId>`,
  - generate invite link from admin menu button,
  - safe reset via `/admin_reset CONFIRM_DELETE_ALL_TEST_DATA` only when `ALLOW_ADMIN_RESET=true`.

### 6) Safety behavior

- Admin handlers are still validated server-side even if UI button is hidden.
- Message deletions are best-effort and never block business flow.
- No timers/workers are used as business-state source.

## Control Flow

### Task Creation (group -> DM)

1. Group message reply + `/task` command  
2. `TaskDraft` is created (`PENDING`)  
3. Bot sends `Create task?` + inline callback button  
4. Callback handler sends deep link to DM and best-effort deletes prompt  
5. DM `/start <task_token>` starts wizard:
   - assignee -> priority -> deadline -> confirm  
6. Finalize draft:
   - `CREATED` -> reply with created task id
   - `ALREADY_EXISTS` -> reply with existing task id

### Invite Join (`/start join_<token>`)

1. User opens DM deep link with `join_<token>`  
2. Start router dispatches to join handler  
3. Domain validates invite token and expiry  
4. Workspace membership is upserted (idempotent)  
5. Bot replies `Joined team: <title or id>`

### Admin Create Team

1. Admin opens DM and uses `Create team` button or command directly  
2. Button replies with usage: `/admin_create_team <chatId> [title...]`  
3. Command parses explicit `chatId` and optional `title`  
4. Domain ensures workspace by `chatId` (idempotent)  
5. Bot replies `Team created/exists: <workspaceId> | chatId=<chatId> | title=<title>`

## Data Model

- `Task`
  - unique by `sourceDraftId`
  - unique by `(sourceChatId, sourceMessageId)`
  - stores final task fields used in bot workflow
- `TaskDraft`
  - unique `token`
  - status and wizard step fields
  - mutable wizard data (`assigneeId`, `priority`, `deadlineAt`)
- `Workspace`
  - unique `chatId`
  - optional `title`
  - optional `assignerUserId`
- `WorkspaceMember`
  - unique by `(workspaceId, userId)`
  - role (`ASSIGNER` or `EXECUTOR`)
- `WorkspaceInvite`
  - unique `token`
  - `workspaceId`
  - optional `expiresAt`

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_WEBHOOK_SECRET_TOKEN` - webhook secret header value
- `BOT_USERNAME` - bot username used for deep links

Admin/security:
- `ADMIN_USER_IDS` - comma-separated Telegram user IDs allowlist (trimmed, string-matched)
- `ALLOW_ADMIN_RESET` - must be exactly `true` to enable `/admin_reset`

Runtime:
- `PORT` - HTTP port (`3000` default locally)
- `NODE_ENV` - `production` enables migration step in start script

## Local Development

1. Install dependencies:
   - `pnpm install`
2. Prepare env (`.env`) with required vars.
3. Generate Prisma client:
   - `pnpm prisma:generate`
4. Run app:
   - `pnpm dev`
5. Optional local webhook via ngrok:
   - `ngrok http 3000`
   - set webhook using:
     - `pnpm tg:webhook:set`
     - `pnpm tg:webhook:info`

Useful quality commands:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:coverage`

## Deployment (Render Free)

- Deploy as Web Service, webhook-only mode.
- `pnpm start` runs:
  1) `prisma migrate deploy` when `NODE_ENV=production`  
  2) starts server (`tsx src/main.ts`)
- If migration fails, process exits non-zero (fail-fast).
- Keep webhook URL set to:
  - `https://<service>.onrender.com/telegram/webhook`

## Security

- Admin access is allowlisted by `ADMIN_USER_IDS`.
- Admin UI visibility is filtered by allowlist, but server-side admin gate remains enforced.
- Reset command is protected by:
  - admin gate,
  - DM-only gate,
  - env flag gate (`ALLOW_ADMIN_RESET=true`),
  - fixed confirmation phrase.
- Idempotent DB constraints protect against duplicate task creation races.

## Limitations

- Stateless by design: no sessions/scenes and no in-memory conversation state.
- Webhook-only operation; no polling worker behavior.
- Best-effort deletion means Telegram deletion errors are logged but not retried as stateful jobs.
- Render Free cold starts are expected.
