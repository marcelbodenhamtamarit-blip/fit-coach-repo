-- Turnos de trabajo: registra los días trabajados, las horas y el tipo de
-- turno (normal/sábado/domingo), para ver cuánto se espera ganar antes de
-- que llegue el pago y, al marcarlo como cobrado, generar sola la
-- transacción de ingreso correspondiente en Economía (categoría "Salario").
-- Mismo patrón de RLS que el resto de tablas (transactions, automations...):
-- cada usuario solo ve y modifica lo suyo.
--
-- shift_type se sugiere solo a partir del día de la semana de `date`
-- (domingo/sábado usan la tarifa con recargo x2/x1.5, el resto la normal —
-- ver SHIFT_RATE_MULTIPLIER en lib/types.ts) pero queda guardado aparte y
-- es editable, por si algún día festivo con tarifa especial cae entre
-- semana.
--
-- transaction_id enlaza con la fila de `transactions` creada al marcar el
-- turno como cobrado, para poder borrarla si se desmarca o se elimina el
-- turno, y no dejar ingresos huérfanos sueltos en Economía. Solo se admite
-- un turno por día (shifts_user_date_unique) — pensado para un único
-- trabajo; un turno partido el mismo día se registra como un solo turno con
-- las horas totales.
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  start_time text, -- 'HH:MM', opcional (solo para mostrar el horario)
  end_time text,   -- 'HH:MM', opcional
  hours numeric not null check (hours > 0),
  shift_type text not null check (shift_type in ('normal', 'sabado', 'domingo')),
  status text not null default 'planificado' check (status in ('planificado', 'cobrado')),
  notes text,
  transaction_id uuid references transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table shifts enable row level security;

drop policy if exists "select own shifts" on shifts;
create policy "select own shifts" on shifts
  for select using (auth.uid() = user_id);

drop policy if exists "insert own shifts" on shifts;
create policy "insert own shifts" on shifts
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own shifts" on shifts;
create policy "update own shifts" on shifts
  for update using (auth.uid() = user_id);

drop policy if exists "delete own shifts" on shifts;
create policy "delete own shifts" on shifts
  for delete using (auth.uid() = user_id);

create unique index if not exists shifts_user_date_unique on shifts (user_id, date);

-- Tarifa por hora (turno normal) y % de impuestos a estimar al calcular el
-- neto de cada turno al marcarlo como cobrado (ver Ajustes > Turnos). La
-- tarifa de sábado/domingo no se guarda aparte: se calcula multiplicando
-- esta misma tarifa por 1.5/2 (ver SHIFT_RATE_MULTIPLIER en lib/types.ts),
-- así que solo hay un número que mantener al día si cambia el sueldo.
-- shift_tax_pct no tiene un valor "correcto" universal (depende de si
-- trabajas con visa Work and Holiday o Student, y de tu residencia fiscal
-- real — ver el aviso en Ajustes): 15% es una referencia razonable para
-- Work and Holiday, pero queda como un número editable, nunca calculado en
-- automático por tipo de visa.
alter table user_preferences add column if not exists shift_hourly_rate numeric not null default 34.6;
alter table user_preferences add column if not exists shift_tax_pct numeric not null default 15;
