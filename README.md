# Marcel OS - Fit Coach App

## What this app is

Personal performance and finance tracker for Marcel, living in Australia (Gold Coast). Built with Next.js, Tailwind, Supabase, deployed on Vercel.

All app data (transactions, pantry, meals, body metrics, profile goals) is stored in **Supabase** and persists across devices and reloads.

Live app: **fit-coach-repo.vercel.app** (this is the one and only active version — a separate old Vercel project, `marcel-fit-coach.vercel.app`, is a different/older codebase and is no longer used).

## Screens

- **Resumen (Dashboard)**: calories vs goal, protein vs goal, weekly savings AUD, supermarket spending this week, and a compact Forma física card (steps + resting HR). Last opened tab is remembered (localStorage) across reloads.
- **Comida**: log meals with ingredients in grams, manual macro/price entry.
- **Despensa**: pantry stock management (add/use ingredients), stored in Supabase (`pantry_items` table). Manual entry only — the previous Woolworths auto-fill search has been removed (the unofficial API session cookie expired and returned 403; rather than depend on a cookie that needs periodic manual renewal, the form now takes name/quantity/macros/price by hand).
- **Economía**: income/expense tracker in AUD, stored in Supabase (`transactions` table). Split into two separate views, **Gastos** and **Ganancias**, selectable with a toggle; each view groups its own transactions by Diario/Semanal/Mensual. The transaction form has a Gasto/Ingreso type selector — the sign (negative for gastos, positive for ganancias) is applied automatically, the user only types a positive number. All expense figures across the summary cards ("Gastos (mes)", historic totals, per-group totals) are displayed with a leading `-`, income figures with a leading `+`.
- **Forma física**: pulls wellness + running activity data from Intervals.icu (`/api/intervals`). Shows Pasos, FC en reposo, Sueño and HRV, plus a list of recent activities — all grouped inside a single collapsible "Forma física" panel. Each activity can be expanded individually for FC máx., desnivel, calorías, carga and ritmo. CTL/ATL/TSB training-load numbers have been intentionally removed from this screen (and from the Resumen card) to keep it simple — steps, heart rate and activities are the numbers that matter day to day.
- **Coach**: AI coaching section (see `components/sections/coach-section.tsx`).
- **Ajustes**: calorie goal, protein goal, weight goal — stored in Supabase (`profile` table). Also where Intervals.icu is connected.

## Supabase tables

- `transactions` — income/expense entries (date, description, category, amount, week_number)
- `profile` — single row (id=1) with name, calorie_goal, protein_goal, weight_goal
- `pantry_items` — pantry stock (name, quantity_grams, macros per 100g, price_per_kg, date_added)
- `meals` — logged meals (date, totals for calories/protein/carbs/fat/cost)
- `meal_ingredients` — ingredients belonging to a meal (foreign key to meals.id)
- `body_metrics` — daily weight/body fat/waist entries (one row per date, upserted)

All tables have row-level security enabled with an open policy (`using (true)`), since this is a single-user personal app. The Supabase URL and anon key are read from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (set in Vercel project settings).

## Fitness data sources (Intervals.icu + Garmin)

- **Intervals.icu** (`/api/intervals`, using `INTERVALS_ICU_API_KEY` / `INTERVALS_ICU_ATHLETE_ID`) is the **only** source currently wired into the UI (Resumen card + Forma física screen).
- There is also a **direct Garmin Connect sync backend** already built (`/api/garmin/sync`, `/api/garmin/cron-sync`, `lib/garmin-sync.ts`, using `GARMIN_EMAIL` / `GARMIN_PASSWORD` / `GARMIN_SYNC_SECRET`), with a daily Vercel cron job configured in `vercel.json`. It writes to a `garmin_activities` table in Supabase but **no screen reads from that table yet** — it's backend-only for now. Pick this up later if we want raw Garmin activities (beyond what Intervals.icu already surfaces) shown in the app.

## Bank expense import (planned, not started)

A `BANK_WEBHOOK_SECRET` environment variable already exists in Vercel, but no CommBank integration has been built. When we pick this up, the plan is a **safe** approach only — either a CommBank NetBank CSV/OFX import, or an Open Banking (CDR) aggregator like Basiq with OAuth — never storing or entering CommBank login credentials directly in this app.

## Historic transaction data (imported once from Google Sheets)

The 73 transactions covering weeks 15–27 (April–July 2026) were imported once from the "Gastos australia ben fet" Google Sheet directly into Supabase. That sheet is no longer the live source — Supabase is. For reference, the import handled:

- Amount format: comma as decimal separator in the sheet, e.g. `-71,89` → `-71.89`
- Categories: Alojamiento, Supermercado, Comida fuera, Transporte, Salario, Compras, Necesidades, Ocio, Otros
- Category mapping from Catalan/Spanish variants (TRANSPORTE/Transport/Uber → Transporte, COMIDA/Menjar/Super → Supermercado, etc.)
- Final totals: income ~$9,380.68 AUD, expenses ~$7,191.47 AUD, savings ~$2,189.21 AUD, 73 transactions

Note: every new transaction still also fires a best-effort POST to a Google Sheets webhook (`GOOGLE_SHEETS_WEBHOOK` in `economy-section.tsx`) for backup/legacy reasons; if it fails the app shows a small toast but nothing blocks — Supabase remains the source of truth.

## Weekly Supermarket Total

Every Saturday at 23:59, the app calculates the sum of all "Supermercado"-category transactions for the current week (client-side, from the in-memory transaction list) and tracks it in local component state. Every Sunday at 00:01 the weekly counter resets. Categories counted: Supermercado, Comida Supermercado, MENJAR SUPER, COMIDA SUPER, Menjar super, Menjar SUPER.

The weekly savings chart on the Economía screen groups transactions by their actual calendar week number (derived from the transaction date), so it correctly shows whichever weeks have data — it does not assume a fixed week 1–13 range.

## Design rules

- Dark theme, background `#0d0d0f`, purple accent `#7c6fff`
- Mobile first, all text in Spanish
- Amounts always show `$` symbol with 2 decimal places, `-` for gastos and `+` for ganancias
- Refresh button on every screen top right as circular arrow icon

## Recent updates (1 Jul 2026)

- Confirmed `fit-coach-repo` (this repo) is the single active codebase going forward; the older `marcel-fit-coach` Vercel project/repo is deprecated and no longer receives updates.
- Forma física screen: removed CTL/ATL/TSB cards; Pasos, FC en reposo, Sueño, HRV and Actividades recientes are now grouped inside one collapsible panel.
- Resumen screen: removed the leftover CTL/ATL/TSB text from the Forma física card, replaced with Pasos + FC en reposo.
- Economía screen: split into separate **Gastos** / **Ganancias** views; transaction form now has a Gasto/Ingreso toggle so the +/− sign is applied automatically instead of typed manually; all expense amounts across summary cards now display with a leading `-` and income with `+`.
- Cleaned up two stale/broken Git branches (`marcelbodenhamtamarit-blip-patch-1`, already merged; `marcelbodenhamtamarit-blip-patch-2`, had a build error and was superseded on `main`). `v0/marcelbodenhamtamarit-blip-33fdfc22` was left alone since it still has unmerged commits.
- Next planned feature: pulling bank purchase notifications from the phone directly into the app (see "Bank expense import" above for the safe approach under consideration).
