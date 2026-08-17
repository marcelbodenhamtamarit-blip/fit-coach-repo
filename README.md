# ZentOS

## What this app is

ZentOS ("Tu economía, a tu manera") is a multi-tenant personal finance tracker. Each user has their own account (Supabase Auth) and only ever sees their own data, isolated by row-level security. Built with Next.js, Tailwind, Supabase, deployed on Vercel.

Live app: **zentos-cel.vercel.app** (also reachable at the underlying Vercel project domain `fit-coach-repo.vercel.app`).

It's installable as a PWA on both Android and iPhone — see "Mobile app / installing on your phone" below.

## Auth & multi-tenancy

- `lib/use-auth.tsx` — `AuthProvider`/`useAuth()` wraps the whole app (`app/layout.tsx`). Three states: `loading` (checking for a saved session), `out` (show login/signup), `in` (session active, render the app).
- `components/login-screen.tsx` — the logged-out screen: email/password login and signup (with an optional invite-code gate via `NEXT_PUBLIC_INVITE_CODE`, meant for an initial "friends & family" phase — delete that env var in Vercel to open signups to anyone), plus "Continuar con Google" OAuth. Shows the ZentOS logo (`/icon.svg`) at the top.
- `components/login-form.tsx` — inline/alternate login form component used elsewhere.
- Every Supabase table is scoped to `auth.uid()` via RLS policies, so one user's transactions, recurring templates, etc. are never visible to another user.

## Screens (nav: Resumen / Diario / Economía / Ajustes)

- **Resumen**: mini stat cards (Ahorro semanal, Pasos, Sueño, Km corridos/caminados), a weekly savings trend chart (last ~13 weeks), and a "Resumen de la semana" card consolidating Ahorro/Gastos/Ingresos/Pasos/Sueño/Km. Last opened tab is remembered (localStorage) across reloads.
- **Diario**: fitness data from Intervals.icu (`/api/intervals`) — steps, sleep, km run/walked, plus per-day tables/charts (last 7 days) and a list of recent running/walking activities.
- **Economía**: income/expense tracker in AUD, stored in Supabase (`transactions` table), split into **Gastos**/**Ganancias** views grouped by Diario/Semanal/Mensual. Transactions can be added, edited, or deleted. This screen also hosts the **recurring transactions manager** (see below).
- **Ajustes**: app info plus a feedback box (see "Feedback" below).

## Recurring transactions (gastos e ingresos recurrentes)

`components/recurring-manager-dialog.tsx` manages templates for things that repeat — rent, subscriptions, salary (monthly) or the weekly grocery run, kids' allowance, etc. (weekly). Each template has:

- **Frequency**: `monthly` or `weekly`, toggled with a pill on each row.
- **Pay day** (`payDay`, editable per template): for monthly templates it's the day of the month (1–31, clamped to the real last day of shorter months); for weekly templates it's the day of the week (Domingo–Sábado). Editable inline via a dropdown on each recurring row, and set up front when creating a new one.
- **Active/paused** toggle, category, description and amount (income or expense).

At the start of each period (month or week, depending on the template), active templates automatically generate a real transaction on their configured pay day. `lib/store.tsx`'s `runRecurringGeneration` handles this and tracks `lastCreatedPeriod` per template to avoid duplicates; `components/recurring-review-dialog.tsx` shows a popup when the app is opened so the user can review what got created.

## Supabase tables

- `transactions` — income/expense entries (date, description, category, amount, week_number). Insert/update/delete from the Economía screen.
- `recurring_transactions` — recurring templates (description, category, amount, active, frequency, `pay_day`, `last_created_month`). RLS-scoped per user.
- `feedback` — free-text messages from the Ajustes screen (`message`, timestamp). Write-only from the app's point of view; read by Marcel directly in Supabase.
- `profile`, `pantry_items`, `meals`, `meal_ingredients`, `body_metrics` — leftover from an earlier fitness/nutrition-tracking version of the app, no longer written to or read by the current UI. Safe to ignore or drop later.

The Supabase URL and anon key are read from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (set in Vercel project settings).

## Feedback

Ajustes → "Enviar feedback" writes straight to the `feedback` table (no auth requirement beyond being logged in). It's a lightweight, no-frills channel for bug reports/ideas — there's no in-app reply mechanism, so responses happen out of band.

## Mobile app / installing on your phone

ZentOS is a fully installable **Progressive Web App (PWA)** — this already gives you a real app icon on your home screen, full-screen (no browser bar), and works today at zero extra cost:

- **Android (Chrome)**: open the site, tap the "Install app" banner or Menu → "Add to Home screen".
- **iPhone (Safari)**: open the site, tap Share → "Add to Home Screen".

This is powered by `app/manifest.ts` (name, colors, icon set at all required sizes including a maskable variant for Android's adaptive icons) and the `/icon.svg` + PNG icon set in `public/` — all ZentOS-branded (dark background, green "Z" mark matching the app's accent color).

### Going further: actual App Store / Play Store listing

Publishing to Apple's App Store or Google Play is a separate, bigger step from PWA installability, since neither store accepts a plain website — the PWA would need to be wrapped as a native app shell (e.g. with [Capacitor](https://capacitorjs.com/) or [PWABuilder](https://www.pwabuilder.com/)), which is very doable given the app is already installable, but involves real cost and ongoing overhead:

- **Apple Developer Program**: ~US$99/year, required to submit to the App Store, plus Apple's app review each time a new version ships.
- **Google Play Developer account**: a one-time ~US$25 fee, plus Google's (generally faster/lighter) review process.
- Both stores have content/metadata requirements (screenshots, privacy policy, support URL, etc.) and occasional review rejections to work through.

Worth doing if the goal is discoverability in the stores or features only native wrapping unlocks (push notifications, deeper OS integration). Not worth it if the home-screen PWA install already covers the need — that option is live right now for free.

## Fitness data source: Intervals.icu (Garmin direct sync is dead)

- **Intervals.icu** (`/api/intervals`, using `INTERVALS_ICU_API_KEY` / `INTERVALS_ICU_ATHLETE_ID`) is the **only** fitness data source. It returns, in one call:
  - `wellness` — today's steps, sleep, restingHR, HRV, CTL/ATL/TSB (not shown in UI)
  - `dailySleep` / `dailySteps` — per-day arrays for the last 7 days, used for the tables + charts in Diario
  - `activities` — recent running/walking activities with full detail fields
  - `kmRun` / `kmWalked` — totals split by activity type, used in the Resumen "Km corridos/caminados" card
- The **direct Garmin Connect sync backend** (`/api/garmin/sync`, `/api/garmin/cron-sync`, `lib/garmin-sync.ts`) **no longer works — Garmin closed off this kind of unofficial access.** It's inert and can be deleted whenever convenient.

## Bank expense import

1. **Manual quick-add from iPhone (working now)**: `POST /api/quick-transaction`, used by an iOS Shortcut triggered from the "when I use this card" Wallet automation. Auth via `?secret=...` (or `secret` in the body, or an `Authorization: Bearer` header) checked against `QUICK_ADD_SECRET`. Body: `amount` (required), `description`, `category`, `type` ("gasto"/"ingreso"), `date`, plus optional `weekOffset`/`weeks` for scheduling a charge into a future week or splitting it across several.
2. **iOS 27 automatic path (built, not active yet)**: same endpoint also accepts raw `title`/`subtitle`/`body` text from iOS 27's Notification automation trigger and extracts the amount via regex — no manual typing needed once the phone is updated past 26.5.2.
3. **CommBank direct integration**: not built. If picked up later, keep it to a safe approach — CommBank NetBank CSV/OFX import, or an Open Banking (CDR) aggregator like Basiq with OAuth — never storing or entering CommBank login credentials in this app.

## Historic transaction data (imported once from Google Sheets)

The original 73 transactions covering weeks 15–27 (April–July 2026) were imported once from the "Gastos australia ben fet" Google Sheet directly into Supabase, back when the app was single-user. That sheet is no longer the live source — Supabase is. Every new transaction still also fires a best-effort POST to a Google Sheets webhook (`GOOGLE_SHEETS_WEBHOOK` in `economy-section.tsx`) for backup/legacy reasons; if it fails the app shows a small toast but nothing blocks — Supabase remains the source of truth.

**Privacy note**: Claude does not read or analyze the actual contents of users' transactions/income data — only builds and maintains the features that store and display it.

## Weekly Supermarket Total

Every Saturday at 23:59, the app calculates the sum of all "Supermercado"-category transactions for the current week and tracks it in local component state (Economía screen). Every Sunday at 00:01 the weekly counter resets.

The weekly savings chart (in both Economía and Resumen) groups transactions by their actual calendar week number (derived from the transaction date), so it correctly shows whichever weeks have data.

## Design rules

- Dark theme, background `#0d0d0f`, green accent (`--primary: oklch(0.85 0.19 135)`, ≈ `#95e85f`)
- Mobile first, all text in Spanish
- Amounts always show `$` with 2 decimals, `-` for gastos and `+` for ganancias
- Recharts for all charts (Area for savings trend, Bar for sleep, Line for steps)

## Changelog

### 17 Aug 2026
- **App rebranded ZentOS**, multi-tenant with Supabase Auth (email/password + Google OAuth) — every user's data is now isolated by row-level security instead of the old single-user setup.
- **PWA installability**: proper ZentOS-branded icon set (192/512/512-maskable/apple-touch-icon/favicons) and manifest, so the app installs cleanly as a home-screen app on Android and iPhone.
- **Recurring transactions**: added an editable pay day (`payDay`) per template — day of month for monthly, day of week for weekly — plus an aesthetic redesign of the recurring manager dialog (card-style rows, pill controls).
- **Login screen** now shows the ZentOS logo.
- README rewritten to match the current app (previous version was stale — still described a single-user "Marcel OS - Fit Coach" app).

### 18 Jul 2026
- **Gastos programables por semana (opcional)**: `/api/quick-transaction` acepta `weekOffset`/`weeks`, combinables, para mover un gasto a otra semana o dividirlo en varias.
- Shortcut de iOS actualizado con un menú Normal/Otra semana/Dividir, y arreglada la categoría del menú.
- `hostel` añadido a las palabras clave de Alojamiento.

### 15 Jul 2026
- **Quick-add category fix**: normaliza acentos/mayúsculas e infiere categoría por palabras clave del comercio cuando el Shortcut no manda `category`.
- **Km caminados** incluye estimación por pasos, sumada a los km con GPS.
- **Código muerto eliminado**: componentes de secciones sin usar (coach, fitness, workouts, sleep, metrics, nutrition, pantry, daily-metrics), `/api/coach`, `lib/coach-context.ts`, `lib/woolworths-products.ts`, backend de sync directo con Garmin, `/api/sheets`, `/api/woolworths` y `vercel.json`.

### 1 Jul 2026
- Confirmed `fit-coach-repo` as the single active codebase; the older `marcel-fit-coach` project is deprecated.
- Economía: split into separate Gastos/Ganancias views with automatic +/− sign.
- Forma física folded into Diario/Resumen, keeping steps, heart rate, sleep, activities.
