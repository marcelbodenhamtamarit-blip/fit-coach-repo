# Marcel OS - Fit Coach App

## What this app is

Personal performance and finance tracker for Marcel, living in Australia (Gold Coast). Built with Next.js, Tailwind, Supabase, deployed on Vercel.

All app data (transactions, body metrics, profile) is stored in **Supabase** and persists across devices and reloads.

Live app: **fit-coach-repo.vercel.app** (this is the one and only active version — a separate old Vercel project, `marcel-fit-coach.vercel.app`, is a different/older codebase and is no longer used).

## Screens (current nav: Resumen / Diario / Economía / Ajustes)

- **Resumen**: 4 mini stat cards — Ahorro semanal (tap → opens Economía), Pasos, Sueño, Km corridos/caminados (tap → opens Diario). Below that: a weekly savings trend chart (last ~13 weeks), a "Resumen de la semana" card consolidating Ahorro/Gastos/Ingresos/Pasos/Sueño/Km. No activity list here anymore — that lives in Diario. Last opened tab is remembered (localStorage) across reloads.
- **Diario**: fitness data from Intervals.icu (`/api/intervals`). Top: Pasos, Sueño total (7d), Km corridos, Km caminados. Then two Card sections with a **table + chart** each: horas dormidas por día (bar chart) and pasos por día (line chart), both for the last 7 days. Below that, the full list of recent running/walking activities, each expandable for FC máx., desnivel, calorías, carga (TSS) and ritmo.
- **Economía**: income/expense tracker in AUD, stored in Supabase (`transactions` table). Split into two separate views, **Gastos** and **Ganancias**, selectable with a toggle; each view groups its own transactions by Diario/Semanal/Mensual. The transaction form has a Gasto/Ingreso type selector — the sign is applied automatically, the user only types a positive number. Every transaction can be **edited** (description, amount, type, category, date — saved to Supabase via `updateTransaction`) or deleted, via buttons inside the expanded row. All expense figures are displayed with a leading `-`, income with `+`.
**Comida**, **Despensa**, standalone **Forma física** and **Coach** were removed from the nav (per Marcel's request to simplify). Their component files, plus the now-unused `/api/coach` route and `lib/coach-context.ts`, were deleted from the repo on 15 Jul 2026 since nothing imports them anymore.

  ## Supabase tables
- `transactions` — income/expense entries (date, description, category, amount, week_number). Supports insert/update/delete from the Economía screen.
- `profile` — single row (id=1), still exists but its calorie/protein/weight fields are no longer edited anywhere in the UI.
- `pantry_items`, `meals`, `meal_ingredients`, `body_metrics` — still in the schema from the old Comida/Despensa screens, no longer written to by the current UI.

All tables have row-level security enabled with an open policy (`using (true)`), since this is a single-user personal app. The Supabase URL and anon key are read from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (set in Vercel project settings).

## Fitness data source: Intervals.icu (Garmin direct sync is dead)

- **Intervals.icu** (`/api/intervals`, using `INTERVALS_ICU_API_KEY` / `INTERVALS_ICU_ATHLETE_ID`) is the **only** fitness data source. It now returns, in one call:
  - `wellness` — today's steps, sleep, restingHR, HRV, CTL/ATL/TSB (not shown in UI)
  - `dailySleep` / `dailySteps` — per-day arrays for the last 7 days (date, dayLabel, hoursDisplay/stepsDisplay), used for the tables + charts in Diario
  - `activities` — recent running/walking activities with full detail fields
  - `kmRun` / `kmWalked` — totals split by activity type, used in the Resumen "Km corridos/caminados" card
- The **direct Garmin Connect sync backend** (`/api/garmin/sync`, `/api/garmin/cron-sync`, `lib/garmin-sync.ts`, `GARMIN_EMAIL`/`GARMIN_PASSWORD`/`GARMIN_SYNC_SECRET`, daily cron in `vercel.json`) **no longer works — Garmin closed off this kind of unofficial access**, similar to what happened with the old Woolworths integration. The `garmin_activities` Supabase table it wrote to stayed empty. The `GET /api/garmin/activities` read endpoint still exists but nothing in the UI calls it anymore (Diario was switched to Intervals.icu instead). This backend can be deleted whenever convenient; it's inert.

## Bank expense import — two working pieces
1. **Manual quick-add from iPhone (working now)**: `POST /api/quick-transaction` — used by an iOS Shortcut triggered from the "when I use this card" Wallet automation. Auth via `?secret=...` query param (or a `secret` field in the JSON body, or an `Authorization: Bearer` header) checked against the `QUICK_ADD_SECRET` env var. All body keys are matched case-insensitively and trimmed, since iOS Shortcuts sometimes auto-capitalizes or adds trailing spaces to field names — this caused several rounds of debugging. Body fields: `amount` (required, positive number), `description`, `category`, `type` ("gasto"/"ingreso", defaults to gasto), `date`. Right now the Shortcut asks Marcel to type the amount manually (a couple of seconds after the Wallet notification) since iOS 26.5.2 can't read notification text.
2. **iOS 27 automatic path (built, not active yet)**: the same endpoint also accepts raw `title`/`subtitle`/`body` text straight from iOS 27's new Notification automation trigger (or the dedicated Wallet "Transaction" trigger), and extracts the amount from that text with a regex — no typing needed. Marcel is still on iOS 26.5.2, so this path is unused for now; flip it on by rebuilding the Shortcut with the Notification trigger once he updates.
3. **CommBank direct integration**: still not built. If picked up later, keep it to a safe approach — CommBank NetBank CSV/OFX import, or an Open Banking (CDR) aggregator like Basiq with OAuth — never storing or entering CommBank login credentials in this app.

## Historic transaction data (imported once from Google Sheets)

The original 73 transactions covering weeks 15–27 (April–July 2026) were imported once from the "Gastos australia ben fet" Google Sheet directly into Supabase. That sheet is no longer the live source — Supabase is. Every new transaction still also fires a best-effort POST to a Google Sheets webhook (`GOOGLE_SHEETS_WEBHOOK` in `economy-section.tsx`) for backup/legacy reasons; if it fails the app shows a small toast but nothing blocks — Supabase remains the source of truth.

**Privacy note**: Claude does not read or analyze the actual contents of Marcel's transactions/income data — only builds and maintains the features that store and display it.

## Weekly Supermarket Total

Every Saturday at 23:59, the app calculates the sum of all "Supermercado"-category transactions for the current week and tracks it in local component state (Economía screen). Every Sunday at 00:01 the weekly counter resets.

The weekly savings chart (in both Economía and Resumen) groups transactions by their actual calendar week number (derived from the transaction date), so it correctly shows whichever weeks have data.

## Design rules

- Dark theme, background `#0d0d0f`, purple accent `#7c6fff`
- Mobile first, all text in Spanish
- Amounts always show `$` symbol with 2 decimal places, `-` for gastos and `+` for ganancias
- Refresh button on every screen top right as circular arrow icon
- Recharts for all charts (Area for savings trend, Bar for sleep, Line for steps)

## Changelog

### 18 Jul 2026
- **Gastos programables por semana (opcional)**: `/api/quick-transaction` acepta dos campos nuevos, ambos opcionales y combinables. Sin ellos el comportamiento es idéntico al de antes.
  - `weekOffset: N` — mueve el gasto entero N semanas hacia adelante. Caso de uso: pagas un viaje hoy pero el gasto pertenece a la semana en que realmente viajas.
  - `weeks: N` — divide el importe a partes iguales entre N semanas consecutivas, marcando cada parte en la descripción (`(1/2)`, `(2/2)`). Caso de uso: pagar 2 semanas de hostel por adelantado.
  - Combinados (`weeks: 2, weekOffset: 3`) dividen en 2 partes empezando 3 semanas después.
  - La división mantiene los céntimos exactos: el resto del redondeo va en la primera fila, así las partes siempre suman el total original.
  - `weekOffset` cuenta días desde hoy (N × 7), no semanas de calendario, así que el resultado depende del día en que se ejecute el Shortcut. Como Economía agrupa por semana (domingo–sábado), en la práctica cae en la semana correcta.
- **Shortcut actualizado**: tras el menú de categoría hay un segundo menú (Normal / Otra semana / Dividir). "Normal" no manda nada extra. Las otras dos preguntan el número de semanas y lo mandan como `weekOffset` / `weeks`.
- **Categoría del menú arreglada en el Shortcut**: cada rama del menú de categorías define ahora explícitamente su propio texto (mediante una acción `Texto` / `Definir variable`), en vez de depender de la variable mágica de Atajos, que no contenía el nombre de la opción elegida y hacía que todo cayera en "Otros".
- **`hostel`** añadido a las palabras clave de Alojamiento.

### 15 Jul 2026
- **Quick-add category fix**: `/api/quick-transaction` normaliza acentos/mayúsculas antes de comparar la categoría que envía el Shortcut, e infiere la categoría por palabras clave del comercio (Woolworths→Supermercado, Uber→Transporte, Netflix→Ocio, etc.) cuando el Shortcut no manda `category`. Antes caía siempre directo a "Otros".
- **Km caminados incluye estimación por pasos**: `/api/intervals` devuelve `wellness.kmWalkedToday`, un `kmWalked` estimado por día en `dailySteps`, y un total semanal `kmWalkedFromSteps` (~0,76 m/paso), sumados a los `kmWalked` con GPS que ya existían. La tarjeta "Km caminados" de Diario muestra el total combinado.
- **Código muerto eliminado**: los 8 componentes de secciones sin usar (coach, fitness, workouts, sleep, metrics, nutrition, pantry, daily-metrics), `/api/coach`, `lib/coach-context.ts`, `lib/woolworths-products.ts`, todo el backend de sync directo con Garmin, `/api/sheets`, `/api/woolworths` y `vercel.json` — todos confirmados sin uso y borrados del repo.

### 1 Jul 2026
- Confirmed `fit-coach-repo` (this repo) is the single active codebase going forward; the older `marcel-fit-coach` Vercel project/repo is deprecated and no longer receives updates.
- Cleaned up two stale/broken Git branches (`marcelbodenhamtamarit-blip-patch-1`, already merged; `marcelbodenhamtamarit-blip-patch-2`, had a build error and was superseded on `main`).
- Economía: split into separate Gastos/Ganancias views; automatic +/− sign based on a Gasto/Ingreso toggle instead of typed manually.
- Forma física (now folded into Diario/Resumen): removed CTL/ATL/TSB numbers everywhere, kept the things that matter day to day — steps, heart rate, sleep, activities.
