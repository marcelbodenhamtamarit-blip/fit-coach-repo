-- Apartado de ahorro para la pareja ("avisar a papi"): una cuenta propia
-- (distinta de la del dueño de la app, ver NEXT_PUBLIC_PARTNER_EMAIL en
-- lib/use-auth.tsx) con un objetivo de ahorro fijo y un check-in manual por
-- periodo (semana o mes). Si no llega al objetivo, puede avisar ella misma
-- a papi con un botón (ver app/api/partner/report/route.ts) -- no hay nada
-- automático, el aviso solo sale si ella lo manda.
--
-- Mismo patrón de RLS que supabase-migrations/winter_arc.sql: una tabla de
-- ajustes de una fila por usuario, una tabla de registros con un índice
-- único por periodo, y una sola política "for all" por tabla.
--
-- Seguro de ejecutar varias veces (if not exists / drop policy if exists).

-- El objetivo: cantidad fija + cada cuánto se comprueba. Una fila por
-- usuario -- en la práctica solo la pareja la usa, pero no hace falta
-- restringirlo a mano: RLS ya aísla cada fila a quien la creó.
create table if not exists savings_goals (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  target_amount numeric not null check (target_amount > 0),
  frequency text not null default 'weekly' check (frequency in ('weekly', 'monthly')),
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un check-in por periodo: period_key es "yyyy-mm-dd" del lunes/domingo de
-- inicio de esa semana (según weekStartDay, igual que weekStartISO en
-- lib/week.ts) si frequency es "weekly", o "yyyy-mm" si es "monthly" -- el
-- índice único evita duplicar el check-in de un mismo periodo si se
-- reenvía el formulario.
create table if not exists savings_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_key text not null,
  saved_amount numeric not null check (saved_amount >= 0),
  met_goal boolean not null,
  -- true en cuanto se ha pulsado "avisar a papi" para este check-in -- así
  -- la pantalla puede dejar el botón ya usado en vez de permitir mandar el
  -- mismo aviso varias veces por accidente.
  reported boolean not null default false,
  reported_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists savings_checkins_user_period_unique on savings_checkins (user_id, period_key);

alter table savings_goals enable row level security;
alter table savings_checkins enable row level security;

drop policy if exists "own savings_goals" on savings_goals;
create policy "own savings_goals" on savings_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own savings_checkins" on savings_checkins;
create policy "own savings_checkins" on savings_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
