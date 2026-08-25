# ZentOS

## What this app is

ZentOS ("Tu economía, a tu manera") is a multi-tenant personal finance tracker. Each user has their own account (Supabase Auth) and only ever sees their own data, isolated by row-level security. Built with Next.js, Tailwind, Supabase, deployed on Vercel.

Live app: **zentos-cel.vercel.app** (also reachable at the underlying Vercel project domain `fit-coach-repo.vercel.app`).

It's installable as a PWA on both Android and iPhone — see "Mobile app / installing on your phone" below.

## Auth & multi-tenancy

- `lib/use-auth.tsx` — `AuthProvider`/`useAuth()` wraps the whole app (`app/layout.tsx`). Three states: `loading` (checking for a saved session), `out` (show login/signup), `in` (session active, render the app).
- `components/login-screen.tsx` — the logged-out screen: email/password login and signup (with an optional invite-code gate via `NEXT_PUBLIC_INVITE_CODE`, meant for an initial "friends & family" phase — delete that env var in Vercel to open signups to anyone), plus "Continuar con Google" OAuth. Shows the ZentOS logo (`/icon.svg`) at the top.
- Every Supabase table is scoped to `auth.uid()` via RLS policies, so one user's transactions, recurring templates, etc. are never visible to another user.

## Screens (nav: Resumen / Diario / Economía / Ajustes)

- **Resumen**: mini stat cards (Ahorro semanal, Pasos, Sueño, Km corridos/caminados), a weekly savings trend chart (last ~13 weeks), and a "Resumen de la semana" card consolidating Ahorro/Gastos/Ingresos/Pasos/Sueño/Km. Last opened tab is remembered (localStorage) across reloads.
- **Diario**: fitness data from Intervals.icu (`/api/intervals`) — steps, sleep, km run/walked, plus per-day tables/charts (last 7 days) and a list of recent running/walking activities.
- **Economía**: income/expense tracker in AUD, stored in Supabase (`transactions` table), split into **Gastos**/**Ganancias** views grouped by Diario/Semanal/Mensual. Transactions can be added, edited, or deleted. This screen also hosts the **recurring transactions manager** (see below).
- **Ajustes**: a stack of collapsible sections (Preferencias, Modo viaje, Recordatorios when beta-enabled, Atajo rápido, Feedback) — each is a titled row you tap to expand/collapse, so the screen stays scannable instead of showing every setting at once. Only the account card at the top (email + sign out) stays always visible. See "Automatizaciones" below for the Recordatorios section specifically.

## Recurring transactions (gastos e ingresos recurrentes)

`components/recurring-manager-dialog.tsx` manages templates for things that repeat — rent, subscriptions, salary (monthly) or the weekly grocery run, kids' allowance, etc. (weekly). Each template has:

- **Frequency**: `monthly` or `weekly`, toggled with a pill on each row.
- **Pay day** (`payDay`, editable per template): for monthly templates it's the day of the month (1–31, clamped to the real last day of shorter months); for weekly templates it's the day of the week (Domingo–Sábado). Editable inline via a dropdown on each recurring row, and set up front when creating a new one.
- **Active/paused** toggle, category, description and amount (income or expense).

At the start of each period (month or week, depending on the template), active templates automatically generate a real transaction on their configured pay day. `lib/store.tsx`'s `runRecurringGeneration` handles this and tracks `lastCreatedPeriod` per template to avoid duplicates; `components/recurring-review-dialog.tsx` shows a popup when the app is opened so the user can review what got created.

## Automatizaciones / Recordatorios (recordatorios y alertas, tipo Atajos de Apple)

**Currently in beta, gated by `lib/beta.ts`** — see "Rolling this out to everyone" below before assuming every user sees this.

User-facing name is **Recordatorios**, and it lives as a collapsible "Recordatorios" section inside Ajustes (`components/sections/settings-section.tsx`, content in `components/sections/automations-section.tsx`'s `RemindersCard`) rather than its own nav tab — folding it into Ajustes let the rest of Ajustes become collapsible sections too instead of one long scroll (see "Screens" above). Internally it's still the same "automations" system end to end (same DB tables, store, worker, file names) — only the label and where it lives in the UI changed, to avoid rewriting something that already worked. Each rule is a trigger plus an action, à la Shortcuts automations:

- **Trigger**: either a **schedule** (daily, or a specific weekday, at a fixed time) or a **condition** on their own finance data (`weekly_savings`, `monthly_expenses`, or `category_monthly_expenses`, compared with `<`/`≤`/`>`/`≥` against a value the user sets — e.g. "weekly savings below $50"). Condition alerts have a configurable cooldown (hours) so they don't re-fire nonstop while the condition stays true.
- **Action**: a real **push notification** (Web Push API — reaches the device even with the app closed), an **in-app pop-up** (shown next time the app is opened, same pattern as the recurring-transactions review dialog), or both.

Pieces involved:

- `supabase-migrations/automations.sql` — `automations`, `automation_events` (fired history / pending pop-ups), `push_subscriptions` (one row per browser/device that enabled notifications). All RLS-scoped per user like the rest of the app.
- `lib/automations-store.tsx` — a second provider (`AutomationsProvider`/`useAutomations()`), mounted next to `StoreProvider` in `app/page.tsx`, so Economía's code stays untouched.
- `lib/push.ts` — client-side subscribe/unsubscribe to Web Push, backed by `public/sw.js` (a minimal service worker: only handles `push`/`notificationclick`, no offline caching).
- `app/api/automations/evaluate` — the worker. Two ways to call it: (1) `?secret=CRON_SECRET` (or the `Authorization: Bearer <CRON_SECRET>` header Vercel Cron sends automatically) evaluates **every** active automation for **every** user — this is what the hourly cron in `vercel.json` hits; (2) a logged-in user's session token + `?automationId=...` force-fires one specific automation for themselves only, for the "Probar ahora" button, without touching its real schedule state.
- `app/api/push/test` — session-authenticated "send me a test notification" endpoint.
- `lib/send-push.server.ts` — shared server-only helper (uses the `web-push` npm package + the VAPID private key; self-prunes subscriptions the browser reports as gone).
- `lib/beta.ts` — the beta gate (see below).

**Testing with a small group before rolling out to everyone**: `lib/beta.ts` exports `AUTOMATIONS_BETA_EMAILS`, an array of emails (starts with just Marcel's). While it's an array, only those accounts see the **Recordatorios** collapsible section in Ajustes (`components/sections/settings-section.tsx`), the "¿Tienes iOS 27?" auto-detect guide in the Atajo rápido section, and even fire the Supabase queries behind them (`lib/automations-store.tsx` skips fetching entirely for anyone not on the list) — everyone else's Ajustes behaves exactly as before this feature existed. To add testers, add their account emails to that array and deploy. **To open it to everyone**, change `AUTOMATIONS_BETA_EMAILS` to the literal string `"*"` instead of an array — `isBetaUser()` then returns true for anyone — and deploy; no other file needs to change. This gate gets safe to delete once the feature has been out for a while and nobody needs the array anymore.

**Environment variables to add** (Vercel project settings): generate a VAPID key pair once with `npx web-push generate-vapid-keys`, then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and pick your own `VAPID_SUBJECT` (a `mailto:` address) and `CRON_SECRET` (any random string).

**Run the migration**: paste `supabase-migrations/automations.sql` into the Supabase SQL editor once, same as the other files in that folder.

**iPhone**: Web Push needs iOS 16.4+ *and* the app installed to the home screen (Safari → Share → Add to Home Screen) — opened inside plain Safari, iOS doesn't expose the permission at all.

**Vercel Cron on the free (Hobby) plan**: historically limited to once-a-day execution — check your plan's current limits in the Vercel dashboard. If hourly isn't available, either upgrade to Pro, or point a free external pinger (cron-job.org, EasyCron...) at `/api/automations/evaluate?secret=...` on whatever schedule you want; the endpoint doesn't care who calls it, only the secret.

## Supabase tables

- `transactions` — income/expense entries (date, description, category, amount, week_number). Insert/update/delete from the Economía screen.
- `recurring_transactions` — recurring templates (description, category, amount, active, frequency, `pay_day`, `last_created_month`). RLS-scoped per user.
- `automations` / `automation_events` / `push_subscriptions` — see "Automatizaciones" above.
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

1. **Manual quick-add from iPhone (working now)**: `POST`/`GET /api/quick-transaction`, used either by the shared iCloud Shortcut (`/quick-confirm?token=...`, per-user token, one small confirmation screen) or an iOS Shortcut triggered from the "when I use this card" Wallet automation (see the "Tap to Pay" guide in Ajustes). Auth via a per-user token (`quick_add_tokens`) or the legacy `?secret=...` checked against `QUICK_ADD_SECRET`. Body/query: `amount` (required), `description`, `category`, `type` ("gasto"/"ingreso"), `date`, plus optional `weekOffset`/`weeks`. **Hardened against a leaked token** (see Changelog): capped `amount`/`weeks`/`weekOffset`/free-text length, a per-user rate limit (max 40 inserts/10 min), and token auth now checks a SHA-256 hash (`quick_add_tokens.token_hash`, kept in sync by a trigger) instead of the plaintext column — logic lives in `lib/quick-add-token.server.ts`, shared by this endpoint and the two `/api/quick-transaction/shortcut*` routes. Needs `supabase-migrations/quick_add_tokens_hardening.sql` run once (safe to re-run). Ajustes also shows each user their token's "last used" time (`quick_add_tokens.last_used_at`) so they can notice unexpected use themselves.
2. **iOS 27 automatic path (active)**: same endpoint also accepts raw `title`/`subtitle`/`body` query params from iOS 27's Notification automation trigger and extracts the amount via regex — no manual typing, no confirmation screen, runs fully in the background from a "when I get a notification from [bank app]" Personal Automation. When the amount is detected this way, the endpoint also sends the user a **push confirmation notification** (via `lib/send-push.server.ts`, same mechanism as Automatizaciones) summarizing what it logged, since there's no ZentOS screen open to show a "Guardado" state. Step-by-step setup guide lives in Ajustes → Atajo rápido → "¿Tienes iOS 27? Detección 100% automática". Users still on iOS 26 or earlier don't get the Notification trigger from Shortcuts yet — for them, the Tap-to-Pay (Apple Pay) guide above stays the best option, and still works.
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

### 25 Aug 2026
- **Recordatorios movidos a Ajustes + Ajustes rediseñado como acordeón**: the beta feature originally shipped today as a separate **Automatizaciones** nav tab was renamed **Recordatorios** and folded into Ajustes as one more collapsible section, instead of living on its own tab — see the dedicated section above. That prompted restyling the rest of Ajustes to match: every section (Preferencias, Modo viaje, Recordatorios, Atajo rápido, Feedback) is now a titled row you tap to expand, so the screen shows a scannable list of titles instead of everything open at once; only the account card stays always visible. New shared `CollapsibleCard` component in `components/sections/settings-section.tsx`. No database or API changes — same tables, worker, and cron as below, only the UI moved. User-defined reminders/alerts stay Shortcuts-style (trigger + action). New tables (`automations`, `automation_events`, `push_subscriptions`), a new hourly worker (`app/api/automations/evaluate`, wired via `vercel.json`), real Web Push notifications (`lib/push.ts`, `public/sw.js`), and an in-app pop-up for events marked "popup". Needs a one-time Supabase migration and four new env vars (VAPID keys + `CRON_SECRET`) — see above.
- **Detección automática al pagar (iOS 27+)**: the previously inactive "read the bank notification and extract the amount" path in `/api/quick-transaction` is now wired to also send a push confirmation (reusing the same push infrastructure as Automatizaciones) whenever it logs a transaction this way — closing the loop so a fully silent, no-tap entry still gets a visible confirmation. Added a step-by-step setup guide in Ajustes for the iOS 27 "Notification" Shortcuts trigger, clearly marked as separate from (and complementary to) the existing Tap-to-Pay guide for accounts still on iOS 26 or earlier.
- **Beta gate for both of the above** (`lib/beta.ts`): only accounts listed in `AUTOMATIONS_BETA_EMAILS` see the Automatizaciones tab or the iOS 27 auto-detect guide, so this can be tried with a small group first — flip it to `"*"` when ready to open it to every ZentOS user.
- **Quick-add security hardening**: `/api/quick-transaction` (and the two `/api/quick-transaction/shortcut*` routes that serve the personal `.shortcut` file) now cap `amount` (max 1,000,000), `weeks` (max 52), `weekOffset` (max 208) and every free-text field (300 chars, 50 for category), and rate-limit each user to 40 inserted rows per 10-minute window — closes a real bug where an uncapped `weeks=` on a single request could insert tens of thousands of rows at once. Token auth for all three routes moved from comparing the plaintext `token` column to comparing a SHA-256 `token_hash` (new column, kept in sync by a DB trigger — see `supabase-migrations/quick_add_tokens_hardening.sql`, run once in the Supabase SQL editor). The plaintext `token` column stays for now (Ajustes still needs to show/copy it and build the `.shortcut` download link) — fully removing it would force everyone to grab a new code, so that's a deliberate separate decision, not done here. Ajustes now also shows "último uso" per token (`last_used_at`, reset on regenerate) so each person can self-monitor for odd activity. Shared auth/hash logic lives in `lib/quick-add-token.server.ts`.
- **Full-repo health pass**: `npx tsc --noEmit` now passes with zero errors (previously 4 pre-existing ones). Fixed a missing `overview.goalRemove` i18n key (the "Quitar objetivo" button in Resumen was calling a translation key that didn't exist), and the Recharts `Tooltip formatter` type mismatch in both `diario-section.tsx` and `economy-section.tsx` (the callback's parameter type didn't match Recharts' `ValueType | undefined`, now widened and coerced with `Number(value) || 0`). Removed 3 confirmed-orphaned files not imported anywhere in the app: `components/sync-button.tsx` (called a `importFromIntervals` store method that no longer exists — Diario already fetches straight from `/api/intervals`, this button wasn't wired into any screen), `components/login-form.tsx` (superseded by `login-screen.tsx`, never imported), and an empty leftover `lib/design-preview.ts`.

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
