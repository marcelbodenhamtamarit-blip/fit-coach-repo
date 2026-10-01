-- Coach IA del Winter Arc: memoria que la IA va actualizando sobre ti y el
-- historial de mensajes (consejo diario + chat). Privado como el resto:
-- RLS por usuario. La ruta /api/coach escribe con la service role key
-- después de comprobar tu sesión y que eres el dueño de la app.
--
-- Seguro de ejecutar varias veces.

create table if not exists winter_arc_coach_memory (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists winter_arc_coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'coach')),
  -- 'daily' = consejo del día (uno por día), 'chat' = conversación.
  kind text not null default 'chat' check (kind in ('daily', 'chat')),
  day date not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists winter_arc_coach_messages_user_created on winter_arc_coach_messages (user_id, created_at desc);
create unique index if not exists winter_arc_coach_daily_unique
  on winter_arc_coach_messages (user_id, day) where kind = 'daily';

alter table winter_arc_coach_memory enable row level security;
alter table winter_arc_coach_messages enable row level security;

drop policy if exists "own winter_arc_coach_memory" on winter_arc_coach_memory;
create policy "own winter_arc_coach_memory" on winter_arc_coach_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own winter_arc_coach_messages" on winter_arc_coach_messages;
create policy "own winter_arc_coach_messages" on winter_arc_coach_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
