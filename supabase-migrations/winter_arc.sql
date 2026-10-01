-- Winter Arc: seguimiento personal del plan de fin de año (hábitos diarios,
-- entrenos, revisión semanal). Privado: cada tabla está protegida por RLS
-- igual que el resto de la app, así que cada fila solo la ve y la toca el
-- usuario que la creó (auth.uid() = user_id). Además la app entera ya está
-- cerrada a tu cuenta con NEXT_PUBLIC_OWNER_EMAIL (ver lib/use-auth.tsx).
--
-- Seguro de ejecutar varias veces (if not exists / drop policy if exists).

-- Ajustes del arco: fechas de inicio/fin (el día 1 depende de cuándo
-- llegues a España, así que se puede cambiar desde la propia sección) y el
-- libro que estás leyendo. Una fila por usuario.
create table if not exists winter_arc_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  start_date date not null default '2026-10-26',
  end_date date not null default '2026-12-31',
  current_book text,
  updated_at timestamptz not null default now()
);

-- Un registro por día: qué reglas se cumplieron (checks = ids de
-- WINTER_ARC_RULES en lib/winter-arc.ts), si fue "día mínimo", la sesión de
-- entreno hecha (A/rodaje/B/C/larga/opcional/descanso), minutos o pesos, y
-- páginas leídas.
create table if not exists winter_arc_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  checks text[] not null default '{}',
  minimum_day boolean not null default false,
  session text check (session in ('fuerza_a', 'rodaje', 'fuerza_b', 'fuerza_c', 'larga', 'opcional', 'descanso')),
  session_minutes integer check (session_minutes is null or session_minutes between 0 and 600),
  session_notes text,
  pages integer check (pages is null or pages between 0 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists winter_arc_days_user_date_unique on winter_arc_days (user_id, date);

-- Revisión del domingo: peso, cintura, minutos de la tirada larga y qué
-- ajustar la semana siguiente. Una fila por semana (week_start = lunes).
create table if not exists winter_arc_weekly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  weight numeric check (weight is null or weight between 20 and 300),
  waist numeric check (waist is null or waist between 30 and 250),
  long_run_minutes integer check (long_run_minutes is null or long_run_minutes between 0 and 600),
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists winter_arc_weekly_user_week_unique on winter_arc_weekly (user_id, week_start);

alter table winter_arc_settings enable row level security;
alter table winter_arc_days enable row level security;
alter table winter_arc_weekly enable row level security;

-- Mismas cuatro políticas en las tres tablas: solo lo tuyo.
drop policy if exists "own winter_arc_settings" on winter_arc_settings;
create policy "own winter_arc_settings" on winter_arc_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own winter_arc_days" on winter_arc_days;
create policy "own winter_arc_days" on winter_arc_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own winter_arc_weekly" on winter_arc_weekly;
create policy "own winter_arc_weekly" on winter_arc_weekly
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
