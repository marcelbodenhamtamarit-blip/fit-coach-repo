-- Automatizaciones estilo "Atajos de Apple": cada usuario define reglas
-- (disparador + acción) que se evalúan en el servidor y pueden avisar por
-- notificación push del sistema y/o un pop-up dentro de la app.
--
-- Dos tipos de disparador:
--   'schedule'  -> recordatorio a una hora fija, a diario o en un día de la
--                  semana concreto (p.ej. "cada lunes a las 9:00").
--   'condition' -> alerta cuando una métrica de Economía cruza un umbral
--                  (p.ej. "ahorro semanal por debajo de $50"), con un
--                  cooldown para no repetir el aviso sin parar mientras la
--                  condición se mantenga cierta.
--
-- Todo vive detrás de RLS igual que el resto de tablas de la app
-- (transactions, recurring_transactions...): cada usuario solo ve y
-- modifica lo suyo. El worker de evaluación (app/api/automations/evaluate)
-- corre con la service_role key y por tanto salta RLS a propósito, igual
-- que /api/quick-transaction.

-- ---------- Suscripciones push (Web Push API) ----------
-- Una fila por dispositivo/navegador donde el usuario activó las
-- notificaciones. endpoint/p256dh/auth son los tres campos que devuelve
-- PushManager.subscribe() en el navegador.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "select own push subscriptions" on push_subscriptions;
create policy "select own push subscriptions" on push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "insert own push subscriptions" on push_subscriptions;
create policy "insert own push subscriptions" on push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "delete own push subscriptions" on push_subscriptions;
create policy "delete own push subscriptions" on push_subscriptions
  for delete using (auth.uid() = user_id);

-- ---------- Reglas de automatización ----------
create table if not exists automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  trigger_type text not null check (trigger_type in ('schedule', 'condition')),

  -- trigger_type = 'schedule'
  schedule_frequency text check (schedule_frequency in ('daily', 'weekly')),
  schedule_time text, -- 'HH:MM', hora local (Australia/Brisbane, igual que el resto de la app)
  schedule_weekday int check (schedule_weekday between 0 and 6), -- 0=domingo..6=sábado, solo si weekly

  -- trigger_type = 'condition'
  condition_metric text check (condition_metric in ('weekly_savings', 'monthly_expenses', 'category_monthly_expenses')),
  condition_operator text check (condition_operator in ('lt', 'lte', 'gt', 'gte')),
  condition_value numeric,
  condition_category text,
  condition_cooldown_hours int not null default 24,

  action_type text not null check (action_type in ('push', 'popup', 'both')),
  message_title text not null,
  message_body text not null,

  last_triggered_at timestamptz,
  last_triggered_period text, -- 'YYYY-MM-DD' o 'YYYY-Www': evita repetir un recordatorio en el mismo día/semana
  last_evaluated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table automations enable row level security;

drop policy if exists "select own automations" on automations;
create policy "select own automations" on automations
  for select using (auth.uid() = user_id);

drop policy if exists "insert own automations" on automations;
create policy "insert own automations" on automations
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own automations" on automations;
create policy "update own automations" on automations
  for update using (auth.uid() = user_id);

drop policy if exists "delete own automations" on automations;
create policy "delete own automations" on automations
  for delete using (auth.uid() = user_id);

-- ---------- Historial de disparos (para el pop-up y para depurar) ----------
create table if not exists automation_events (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade,
  user_id uuid not null,
  title text not null,
  body text not null,
  action_type text not null,
  push_sent boolean not null default false,
  popup_seen boolean not null default false,
  created_at timestamptz not null default now()
);

alter table automation_events enable row level security;

-- Solo lectura/actualización (marcar visto) desde el cliente; el insert lo
-- hace únicamente el worker con service_role.
drop policy if exists "select own automation events" on automation_events;
create policy "select own automation events" on automation_events
  for select using (auth.uid() = user_id);

drop policy if exists "update own automation events" on automation_events;
create policy "update own automation events" on automation_events
  for update using (auth.uid() = user_id);

create index if not exists automation_events_user_unseen_idx
  on automation_events (user_id, popup_seen)
  where popup_seen = false;
