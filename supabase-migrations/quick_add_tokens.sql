-- Tabla de tokens personales para el Shortcut de anadir gasto rapido.
-- Cada usuario tiene un token opaco propio, incrustado en su archivo
-- .shortcut al descargarlo desde Ajustes. Se resuelve en el servidor con
-- la service_role key (por eso RLS no necesita permitir lecturas externas).
create table if not exists quick_add_tokens (
    user_id uuid primary key references auth.users(id) on delete cascade,
    token text not null unique default encode(gen_random_bytes(24), 'hex'),
    created_at timestamptz not null default now()
  );

alter table quick_add_tokens enable row level security;

create policy "select own quick add token" on quick_add_tokens
  for select using (auth.uid() = user_id);

create policy "insert own quick add token" on quick_add_tokens
  for insert with check (auth.uid() = user_id);

create policy "update own quick add token" on quick_add_tokens
  for update using (auth.uid() = user_id);
