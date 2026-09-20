# v3-trading-journal-application-

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## What this is

A trading journal for forex/CFD traders: log trades with screenshots and
pre-trade conditions, track P/L and portfolio performance, get an AI psychology
coach that reasons over your real trade history, set server-side price alerts
that email you, sync trade history from MT4/MT5 broker accounts, and browse an
economic calendar.

Trades are stored offline-first in `localStorage` and synced to Supabase when you
are signed in, so the journal keeps working without a connection.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v3 ·
shadcn/ui · Supabase (auth + Postgres + RLS) · OpenAI · MetaApi · Twelve Data ·
Resend

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the keys you need
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Windows/PowerShell:** if `npm` fails with *"cannot be loaded because running
> scripts is disabled on this system"*, use `npm.cmd install` / `npm.cmd run dev`
> instead, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

### 1. Create the database

Run [`supabase/schema.sql`](./supabase/schema.sql) in your Supabase project
(Dashboard → SQL Editor → New query). It is idempotent, so it is safe to re-run.
It creates `trades`, `presets`, `coach_messages`, `broker_connections` and
`price_alerts`, all with row level security enabled and per-user policies.

Then add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase
→ Project Settings → API) to `.env.local`.

### 2. (Optional) Turn on the integrations you want

Every integration below is optional — the UI degrades to a clear message when a
key is missing rather than crashing.

| Feature | Key(s) | Notes |
| --- | --- | --- |
| AI coach + event analysis | `OPENAI_API_KEY` | Without it, built-in canned analysis is used instead. |
| Broker trade sync | `METAAPI_TOKEN` | [metaapi.cloud](https://metaapi.cloud). Connect an account from the Accounts page using your **investor (read-only) password** — it is forwarded to MetaApi and never stored by this app. |
| Price alerts | `TWELVE_DATA_API_KEY` | [twelvedata.com](https://twelvedata.com). Free tier: 8 req/min, 800/day. |
| Alert emails | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | [resend.com](https://resend.com/api-keys). Until you verify a sending domain, Resend only delivers from `onboarding@resend.dev` to the address you signed up with. |
| Scheduled alert checks | `CRON_SECRET` | See below. |

### 3. Schedule the price-alert checks

Price alerts only fire when something calls
`POST /api/cron/check-price-alerts` with the `CRON_SECRET`. Vercel's Hobby plan
caps cron jobs at once per day, so
[`.github/workflows/check-price-alerts.yml`](./.github/workflows/check-price-alerts.yml)
calls it every 15 minutes via GitHub Actions instead. Add both values under
**Settings → Secrets and variables → Actions**:

- `APP_URL` — your deployed URL, e.g. `https://your-app.vercel.app`
- `CRON_SECRET` — must match the `CRON_SECRET` env var you set in your host

> GitHub disables scheduled workflows after 60 days without a commit to the
> repository. If alerts quietly stop, re-enable the workflow from the Actions tab.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server. |
| `npm run build` | Production build (Turbopack). |
| `npm run build:local` | Same, but with webpack — use it to rule out a bundler issue. |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint (`eslint-config-next`, core-web-vitals). |
| `npm run typecheck` | `tsc --noEmit`. |

CI (`.github/workflows/ci.yml`) runs lint, typecheck and build on every push and
pull request. It needs no secrets — every integration degrades gracefully without
its key.

## Known limitations

These are deliberate, documented gaps rather than bugs — worth knowing before you
treat any of it as production-grade:

- **The economic calendar is sample data.** `components/forex-factory-events.tsx`
  ships a hardcoded event list and a "Refresh" button that reloads the same rows;
  no external calendar feed is connected. The page shows a notice saying so.
- **Only price alerts send email.** The Settings page stores an email address and
  preferences in `localStorage`, but nothing server-side delivers them — the real
  email path is the price-alert cron job (`lib/email.ts`).
- **Push notifications are not wired to a push service.** The service worker and
  VAPID key in `lib/notifications.ts` are a demo key and are not connected to a
  backend, so nothing can be delivered while the tab is closed.
- **Portfolio edits are best-effort in the cloud.** P/L edits and deletes are
  written locally and then pushed to Supabase; if a push fails it is logged, not
  retried. Local-first data wins only on the device it was made on.
- **A JSON import is uploaded on the next sync**, not immediately.
- **Partial broker closes are collapsed** into one journal entry per position —
  see the note in `lib/broker-sync.ts`.
- **No automated tests yet.** `lib/trading-psychology.ts`, `lib/broker-sync.ts`
  and `lib/trade-schema.ts` are pure functions and are the easiest place to start.

## Project layout

```
app/                    App Router pages + API routes
  api/broker-accounts/  connect / list / disconnect / sync MT4-5 accounts
  api/coach/chat/       AI psychology coach (authenticated, streams)
  api/cron/             scheduled price-alert sweep (CRON_SECRET)
  api/openai/           economic-event assistant + analysis
  api/price-alerts/     price alert CRUD
components/             feature components + shadcn/ui primitives
components/trade-journal/  the journal form, split into hooks + subcomponents
hooks/                  reusable React hooks
lib/                    Supabase clients, sync, broker/market/AI integrations
supabase/schema.sql     full database schema (run this first)
```

## Credits

Bootstrapped with [v0](https://v0.app) and linked to
[v0 project prj_iCwpSd2ShLKGxa7xJTnaYPyFyYXv](https://v0.app/chat/projects/prj_iCwpSd2ShLKGxa7xJTnaYPyFyYXv).

Useful docs: [Next.js](https://nextjs.org/docs) ·
[Supabase](https://supabase.com/docs) · [shadcn/ui](https://ui.shadcn.com/docs) ·
[MetaApi](https://metaapi.cloud/docs) · [Twelve Data](https://twelvedata.com/docs)
· [Resend](https://resend.com/docs)
