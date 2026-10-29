-- Precio en vivo para inversiones de tipo "stocks" (acciones/ETFs) y
-- "gold" (oro): en vez de que el usuario actualice el valor a mano, guarda
-- cuánto tiene (symbol + quantity) y la app calcula el valor actual
-- multiplicando por el precio de mercado de hoy (API Ninjas — ver
-- app/api/market-price/route.ts).
--
-- market_prices es un caché compartido (una fila por símbolo y día), mismo
-- patrón que exchange_rates: lectura abierta a cualquiera, escritura para
-- cualquier usuario autenticado — es solo un caché de datos públicos de
-- mercado, no hay nada privado en guardar "AAPL valía 230 el 2026-10-29".
-- Guardar el histórico diario (no solo "el precio de hoy") es también lo
-- que permite calcular si ha subido o bajado respecto al día anterior sin
-- depender de que la API externa lo indique.
create table if not exists public.market_prices (
  symbol text not null,
  price_date date not null,
  price numeric not null,
  fetched_at timestamptz not null default now(),
  primary key (symbol, price_date)
);

alter table public.market_prices enable row level security;

drop policy if exists "anyone can read market prices" on public.market_prices;
create policy "anyone can read market prices" on public.market_prices
  for select using (true);

drop policy if exists "authenticated can insert market prices" on public.market_prices;
create policy "authenticated can insert market prices" on public.market_prices
  for insert with check (true);

drop policy if exists "authenticated can update market prices" on public.market_prices;
create policy "authenticated can update market prices" on public.market_prices
  for update using (true);

-- symbol: ticker de bolsa (p.ej. "AAPL") o "XAU" para oro.
-- quantity: cuántas unidades tiene (acciones, o gramos/onzas de oro).
-- price_unit: unidad de `quantity` — 'share' (acciones) | 'gram' | 'oz'
--   (null = inversión manual de siempre, sin precio en vivo).
alter table public.investments
  add column if not exists symbol text,
  add column if not exists quantity numeric,
  add column if not exists price_unit text;
