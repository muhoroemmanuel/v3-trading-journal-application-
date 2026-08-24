-- Trading Journal — Supabase schema
--
-- Run this in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE).
--
-- This defines the three tables the app talks to:
--   trades          — existing feature, referenced by lib/sync.ts
--   presets         — existing feature, referenced by useTradePresets.ts
--   coach_messages  — NEW: AI trading-coach conversation history, synced
--                     across devices instead of living only in localStorage

-- ─────────────────────────────────────────────────────────────────────────
-- trades
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.trades (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  currency_pair     text not null,
  action            text not null check (action in ('buy', 'sell')),
  entry_price       numeric not null,
  stop_loss_price   numeric,
  take_profit_price numeric,
  exit_price        numeric,
  position_size     numeric not null,
  status            text not null default 'open' check (status in ('open', 'closed')),
  profit_loss       numeric,
  notes             text,
  conditions        jsonb not null default '[]'::jsonb,
  images            jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists trades_user_id_created_at_idx
  on public.trades (user_id, created_at desc);

alter table public.trades enable row level security;

drop policy if exists "trades_select_own" on public.trades;
create policy "trades_select_own" on public.trades
  for select using (auth.uid() = user_id);

drop policy if exists "trades_insert_own" on public.trades;
create policy "trades_insert_own" on public.trades
  for insert with check (auth.uid() = user_id);

drop policy if exists "trades_update_own" on public.trades;
create policy "trades_update_own" on public.trades
  for update using (auth.uid() = user_id);

drop policy if exists "trades_delete_own" on public.trades;
create policy "trades_delete_own" on public.trades
  for delete using (auth.uid() = user_id);

-- Keep updated_at current on every UPDATE
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trades_set_updated_at on public.trades;
create trigger trades_set_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- presets
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.presets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  conditions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists presets_user_id_idx on public.presets (user_id);

alter table public.presets enable row level security;

drop policy if exists "presets_select_own" on public.presets;
create policy "presets_select_own" on public.presets
  for select using (auth.uid() = user_id);

drop policy if exists "presets_insert_own" on public.presets;
create policy "presets_insert_own" on public.presets
  for insert with check (auth.uid() = user_id);

drop policy if exists "presets_update_own" on public.presets;
create policy "presets_update_own" on public.presets
  for update using (auth.uid() = user_id);

drop policy if exists "presets_delete_own" on public.presets;
create policy "presets_delete_own" on public.presets
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- coach_messages (NEW)
-- AI trading-coach conversation history. Storing this server-side (instead
-- of only in localStorage) is what makes the coach's conversation follow
-- the user across devices, same as their trades already do.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.coach_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_user_id_created_at_idx
  on public.coach_messages (user_id, created_at);

alter table public.coach_messages enable row level security;

drop policy if exists "coach_messages_select_own" on public.coach_messages;
create policy "coach_messages_select_own" on public.coach_messages
  for select using (auth.uid() = user_id);

drop policy if exists "coach_messages_insert_own" on public.coach_messages;
create policy "coach_messages_insert_own" on public.coach_messages
  for insert with check (auth.uid() = user_id);

drop policy if exists "coach_messages_delete_own" on public.coach_messages;
create policy "coach_messages_delete_own" on public.coach_messages
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- broker_connections (NEW)
-- One row per MetaApi-provisioned MT4/MT5 account a user has connected.
-- We never store the investor password here — MetaApi holds and manages
-- the actual terminal connection; we only keep the reference id it gives us.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.broker_connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  platform          text not null check (platform in ('mt4', 'mt5')),
  server            text not null,
  account_login     text not null,
  metaapi_account_id text not null,
  status            text not null default 'connecting'
                       check (status in ('connecting', 'connected', 'error', 'disconnected')),
  error_message     text,
  last_synced_at    timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists broker_connections_user_id_idx on public.broker_connections (user_id);

alter table public.broker_connections enable row level security;

drop policy if exists "broker_connections_select_own" on public.broker_connections;
create policy "broker_connections_select_own" on public.broker_connections
  for select using (auth.uid() = user_id);

drop policy if exists "broker_connections_insert_own" on public.broker_connections;
create policy "broker_connections_insert_own" on public.broker_connections
  for insert with check (auth.uid() = user_id);

drop policy if exists "broker_connections_update_own" on public.broker_connections;
create policy "broker_connections_update_own" on public.broker_connections
  for update using (auth.uid() = user_id);

drop policy if exists "broker_connections_delete_own" on public.broker_connections;
create policy "broker_connections_delete_own" on public.broker_connections
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- trades: broker sync support
-- Lets synced trades be matched back to their MetaTrader position so
-- re-syncing updates the existing row instead of creating a duplicate.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.trades add column if not exists broker_connection_id uuid references public.broker_connections(id) on delete set null;
alter table public.trades add column if not exists broker_position_id text;

create unique index if not exists trades_user_broker_position_unique
  on public.trades (user_id, broker_position_id)
  where broker_position_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- price_alerts (NEW)
-- Real threshold-based alerts ("notify me when EUR/USD crosses 1.1000").
-- Lives server-side (not localStorage) because a background job — not the
-- user's browser — is what checks current prices against these on a
-- schedule; see app/api/cron/check-price-alerts.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.price_alerts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  currency_pair   text not null,
  direction       text not null check (direction in ('above', 'below')),
  target_price    numeric not null,
  status          text not null default 'active' check (status in ('active', 'triggered', 'cancelled')),
  triggered_at    timestamptz,
  triggered_price numeric,
  created_at      timestamptz not null default now()
);

create index if not exists price_alerts_status_idx on public.price_alerts (status);
create index if not exists price_alerts_user_id_idx on public.price_alerts (user_id);

alter table public.price_alerts enable row level security;

drop policy if exists "price_alerts_select_own" on public.price_alerts;
create policy "price_alerts_select_own" on public.price_alerts
  for select using (auth.uid() = user_id);

drop policy if exists "price_alerts_insert_own" on public.price_alerts;
create policy "price_alerts_insert_own" on public.price_alerts
  for insert with check (auth.uid() = user_id);

drop policy if exists "price_alerts_update_own" on public.price_alerts;
create policy "price_alerts_update_own" on public.price_alerts
  for update using (auth.uid() = user_id);

drop policy if exists "price_alerts_delete_own" on public.price_alerts;
create policy "price_alerts_delete_own" on public.price_alerts
  for delete using (auth.uid() = user_id);
