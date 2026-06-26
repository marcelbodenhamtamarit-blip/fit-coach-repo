# Marcel OS - Fit Coach App

## What this app is

Personal performance and finance tracker for Marcel, living in Australia (Gold Coast). Built with Next.js, Tailwind, Supabase, deployed on Vercel.

All app data (transactions, pantry, meals, body metrics, profile goals) is stored in **Supabase** and persists across devices and reloads.

## Screens

- **Resumen (Dashboard)**: calories vs goal, protein vs goal, weekly savings AUD, supermarket spending this week. Last opened tab is remembered (localStorage) across reloads.
- **Comida**: log meals with ingredients in grams, manual macro/price entry.
- **Despensa**: pantry stock management (add/use ingredients), stored in Supabase (`pantry_items` table). Manual entry only — the previous Woolworths auto-fill search has been removed (the unofficial API session cookie expired and returned 403; rather than depend on a cookie that needs periodic manual renewal, the form now takes name/quantity/macros/price by hand).
- **Economía**: income/expense tracker in AUD, stored in Supabase (`transactions` table), tabs for Diario/Semanal/Mensual. The historic Google Sheets import button has been removed; this is now the source of truth.
- **Ajustes**: calorie goal, protein goal, weight goal — stored in Supabase (`profile` table).

## Supabase tables

- `transactions` — income/expense entries (date, description, category, amount, week_number)
- `profile` — single row (id=1) with name, calorie_goal, protein_goal, weight_goal
- `pantry_items` — pantry stock (name, quantity_grams, macros per 100g, price_per_kg, date_added)
- `meals` — logged meals (date, totals for calories/protein/carbs/fat/cost)
- `meal_ingredients` — ingredients belonging to a meal (foreign key to meals.id)
- `body_metrics` — daily weight/body fat/waist entries (one row per date, upserted)

All tables have row-level security enabled with an open policy (`using (true)`), since this is a single-user personal app. The Supabase URL and anon key are read from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (set in Vercel project settings).

## Historic transaction data (imported once from Google Sheets)

The 73 transactions covering weeks 15–27 (April–July 2026) were imported once from the "Gastos australia ben fet" Google Sheet directly into Supabase. That sheet is no longer the live source — Supabase is. For reference, the import handled:

- Amount format: comma as decimal separator in the sheet, e.g. `-71,89` → `-71.89`
- Categories: Alojamiento, Supermercado, Comida fuera, Transporte, Salario, Compras, Necesidades, Ocio, Otros
- Category mapping from Catalan/Spanish variants (TRANSPORTE/Transport/Uber → Transporte, COMIDA/Menjar/Super → Supermercado, etc.)
- Final totals: income ~$9,380.68 AUD, expenses ~$7,191.47 AUD, savings ~$2,189.21 AUD, 73 transactions

## Weekly Supermarket Total

Every Saturday at 23:59, the app calculates the sum of all "Supermercado"-category transactions for the current week (client-side, from the in-memory transaction list) and tracks it in local component state. Every Sunday at 00:01 the weekly counter resets. Categories counted: Supermercado, Comida Supermercado, MENJAR SUPER, COMIDA SUPER, Menjar super, Menjar SUPER.

The weekly savings chart on the Economía screen groups transactions by their actual calendar week number (derived from the transaction date), so it correctly shows whichever weeks have data — it does not assume a fixed week 1–13 range.

## Design rules

- Dark theme, background `#0d0d0f`, purple accent `#7c6fff`
- Mobile first, all text in Spanish
- Amounts always show `$` symbol with 2 decimal places
- Refresh button on every screen top right as circular arrow icon
