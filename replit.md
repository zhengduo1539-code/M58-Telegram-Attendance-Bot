# M58 Telegram Attendance Bot

A modular Telegram group bot for work, break, return-to-seat, and activity-time tracking with Chinese and English language switching.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Render env: `TELEGRAM_BOT_TOKEN` is required to enable Telegram polling. The bot time zone is fixed in code as `Asia/Rangoon`. `BOT_OWNER_ID` and comma-separated `ADMIN_IDS` authorize private-chat activity-limit commands. `BOT_DATA_PATH` defaults to `data/m58-bot-state.json`. `BOT_POLL_INTERVAL_MS` controls retry delay, and `BOT_REQUEST_TIMEOUT_MS` defaults to 40 seconds.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/bot/` — Telegram client, polling loop, command routing, attendance rules, locales, and file-backed store.
- `artifacts/api-server/src/routes/health.ts` — Render health check at `/api/healthz`.
- `data/m58-bot-state.json` — runtime state path; generated on first activity and ignored from source control.

## Architecture decisions

- The Telegram bot runs in polling mode so Render does not need a public Telegram webhook endpoint.
- Attendance state is behind a `BotStore` interface and uses atomic JSON writes for a dependency-light first deployment.
- The bot continues to serve health checks without a token; adding `TELEGRAM_BOT_TOKEN` and restarting enables polling.
- User language preference is stored per chat/user and defaults to Chinese to match the reference video.

## Product

- `/work`, `/back`, `/eat`, `/wc`, `/smoke`, `/wcd`, `/offwork`, and `/help` commands.
- Inline activity buttons for toilet, smoke, WCD, and return-to-seat.
- Activity duration, daily count, daily activity total, and daily all-activity total in each settlement response.
- `/lang zh` and `/lang en` language switching.
- Bot owner/admins can use `/limits` or `/limit wc 10` in the bot private chat. Defaults are eat 30 minutes, wc 10 minutes, smoke 10 minutes, and wcd 15 minutes; overrides are stored in the bot state file.

## User preferences

- Keep the code split into maintainable modules instead of one large file.
- Deploy through Render; secrets are configured in Render Environment Variables.

## Gotchas

- Do not commit `TELEGRAM_BOT_TOKEN` or runtime state.
- Render's local filesystem is ephemeral unless a persistent disk is configured; use an external database or persistent disk before treating history as durable production data.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
