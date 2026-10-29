-- Inversiones (Ajustes > Inversiones): PIAS, Revolut, criptomonedas...
--
-- Entrada 100% manual, a propósito: no hay conexión automática con ningún
-- bróker, banco ni exchange. Cada fila de `investments` guarda solo el
-- último valor conocido (current_value), que el usuario actualiza a mano
-- cuando quiere -- no es un precio en vivo. El historial de aportaciones y
-- retiradas vive en `investment_contributions`, con fecha y signo (positivo
-- = aportación, negativo = retirada): eso es lo que permite calcular
-- ganancia/pérdida real (valor actual - neto aportado) en vez de solo
-- mostrar "cuánto vale ahora" sin punto de comparación.
--
-- Todo vive detrás de RLS igual que el resto de tablas de la app
-- (transactions, automations...): cada usuario solo ve y modifica lo suyo.

create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('pias', 'revolut', 'crypto', 'other')),
  currency text not null default 'EUR',
  current_value numeric not null default 0,
  -- null mientras no se haya puesto nunca un valor actual (justo al
  -- crearla): el cliente usa esto para no mostrar una ganancia/pérdida
  -- falsa (currentValue - aportado) antes de que haya un valor real.
  current_value_updated_at timestamptz,
  -- Se queda en la lista pero fuera de los totales activos al cerrar/
  -- cancelar una inversión, sin perder su historial de aportaciones.
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table investments enable row level security;

drop policy if exists "select own investments" on investments;
create policy "select own investments" on investments
  for select using (auth.uid() = user_id);

drop policy if exists "insert own investments" on investments;
create policy "insert own investments" on investments
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own investments" on investments;
create policy "update own investments" on investments
  for update using (auth.uid() = user_id);

drop policy if exists "delete own investments" on investments;
create policy "delete own investments" on investments
  for delete using (auth.uid() = user_id);

create table if not exists investment_contributions (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references investments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount numeric not null, -- positivo = aportación, negativo = retirada
  date date not null,
  note text,
  created_at timestamptz not null default now()
);

alter table investment_contributions enable row level security;

drop policy if exists "select own investment contributions" on investment_contributions;
create policy "select own investment contributions" on investment_contributions
  for select using (auth.uid() = user_id);

drop policy if exists "insert own investment contributions" on investment_contributions;
create policy "insert own investment contributions" on investment_contributions
  for insert with check (auth.uid() = user_id);

drop policy if exists "delete own investment contributions" on investment_contributions;
create policy "delete own investment contributions" on investment_contributions
  for delete using (auth.uid() = user_id);

create index if not exists investment_contributions_investment_idx
  on investment_contributions (investment_id);
