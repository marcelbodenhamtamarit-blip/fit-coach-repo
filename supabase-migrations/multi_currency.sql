-- Soporte multi-divisa: cada transacción se sigue sumando en `amount`
-- (siempre en la divisa principal del usuario, home_currency), y opcionalmente
-- guarda `currency` + `original_amount` cuando se registró en otra divisa
-- (por ejemplo de viaje). `user_preferences` guarda la divisa principal de
-- cada usuario, y `exchange_rates` cachea los tipos de cambio diarios para
-- no llamar a la API externa más de una vez al día por divisa base.

alter table transactions add column if not exists currency text;
alter table transactions add column if not exists original_amount numeric;

create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_currency text not null default 'AUD',
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;

drop policy if exists "select own preferences" on user_preferences;
create policy "select own preferences" on user_preferences
  for select using (auth.uid() = user_id);

drop policy if exists "insert own preferences" on user_preferences;
create policy "insert own preferences" on user_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own preferences" on user_preferences;
create policy "update own preferences" on user_preferences
  for update using (auth.uid() = user_id);

create table if not exists exchange_rates (
  base_currency text not null,
  rate_date date not null,
  rates jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (base_currency, rate_date)
);

alter table exchange_rates enable row level security;

-- Datos no sensibles y compartidos entre todos los usuarios: cualquiera
-- puede leer, y cualquier usuario autenticado puede refrescar la caché
-- (no está atado a auth.uid() porque no pertenece a un usuario concreto).
drop policy if exists "anyone can read exchange rates" on exchange_rates;
create policy "anyone can read exchange rates" on exchange_rates
  for select using (true);

drop policy if exists "authenticated can insert exchange rates" on exchange_rates;
create policy "authenticated can insert exchange rates" on exchange_rates
  for insert to authenticated with check (true);

drop policy if exists "authenticated can update exchange rates" on exchange_rates;
create policy "authenticated can update exchange rates" on exchange_rates
  for update to authenticated using (true);
