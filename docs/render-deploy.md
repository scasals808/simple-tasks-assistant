# Render deployment (Free plan, webhook-only)

This service is webhook-only (no polling, no workers). On Render Free, cold starts are expected after inactivity.

## 1) Create Render Postgres (Free)

1. In Render, create a new PostgreSQL instance (Free).
2. Copy its internal or external `DATABASE_URL` from Render dashboard.

## 2) Create Render Web Service

1. Connect this GitHub repository in Render.
2. Create a **Web Service** using:
   - Build command: `pnpm install --frozen-lockfile && pnpm prisma generate`
   - Start command: `pnpm start`
   - Health check path: `/health`
3. Confirm service listens on `PORT` (Render injects it automatically).

## 3) Set required environment variables

Set these env vars in Render service settings:

- `NODE_ENV=production`
- `TELEGRAM_BOT_TOKEN=<your bot token>`
- `TELEGRAM_WEBHOOK_SECRET_TOKEN=<random secret token>`
- `DATABASE_URL=<Render Postgres connection string>`

## 4) Deploy and get service URL

After deploy succeeds, copy service URL:

- `https://<your-service>.onrender.com`

Webhook URL must be:

- `https://<your-service>.onrender.com/telegram/webhook`

## 5) Set Telegram webhook to Render URL

Run locally:

```bash
export TELEGRAM_BOT_TOKEN="<your bot token>"
export TELEGRAM_WEBHOOK_SECRET_TOKEN="<same token as Render>"
export RENDER_WEBHOOK_URL="https://<your-service>.onrender.com/telegram/webhook"
pnpm tg:webhook:render:set
pnpm tg:webhook:render:info
```

Optional rollback:

```bash
pnpm tg:webhook:render:delete
```

## Pre-deploy sanity checklist

- App binds to `PORT` (default `3000` locally).
- `GET /health` returns HTTP `200`.
- `POST /telegram/webhook` returns `401` when header `X-Telegram-Bot-Api-Secret-Token` is missing/invalid.
- `pnpm prisma generate` succeeds without DB access.
- Run DB migrations during deploy/release manually with:
  - `pnpm prisma migrate deploy`

Production note:

- `start` runs `pnpm prisma migrate deploy` when `NODE_ENV=production`, then starts the app.
