# Marcel OS - Fit Coach App

## What this app is
Personal performance and finance tracker for Marcel, living in Australia (Gold Coast).
Built with Next.js, Tailwind, Supabase, deployed on Vercel.

## Screens
- **Resumen (Dashboard)**: calories vs goal, protein vs goal, weekly savings AUD, supermarket spending this week
- **Comida**: log meals with ingredients in grams, Woolworths Australia product search auto-fills macros and price
- **Despensa**: pantry stock management, two buttons "Añadir a despensa" and "Usar de despensa", syncs to Google Sheets "Despensa" tab
- **Economía**: income/expense tracker in AUD, syncs with Google Sheets, tabs for Diario/Semanal/Mensual
- **Ajustes**: calorie goal (2200), protein goal (180g)

## Google Sheets Integration
Webhook URL: https://script.google.com/macros/s/AKfycbyA7cBEfe1vrWkclk4fKInoSa0hhenbC5iaCAzwl-rqOMEcOp1GLchAeeCstE1foBsx/exec

Main sheet columns: A = week number, B = category, C = amount, D = date DD/MM/YYYY
Despensa sheet columns: date, action (compra/uso), product, quantity grams, price AUD

Week format in sheet: "WEEK X (DD Mon - DD Mon)" example "WEEK 12 (21 Jun - 27 Jun)"
Week starts Sunday, ends Saturday (CommBank Australia format)
Week numbering: Marcel's personal counter since arriving in Australia, does NOT follow calendar year

## Transaction Data
Amount format: comma as decimal separator in Google Sheets example -71,89 = -71.89
Negative = expense, Positive = income
Categories: Alojamiento, Supermercado, Comida fuera, Transporte, Salario, Compras, Necesidades, Ocio, Otros

## Category mapping from Catalan/Spanish variants
TRANSPORTE/Transport/Uber → Transporte
GADGETS/SHOPPING/Compres/Cargador MVL → Compras
COMIDA/Menjar/Super/SUPER/MENJAR SUPER/COMIDA SUPER/Menjar super → Supermercado
COMIDA FUERA/MENJAR FORA/Menjar fora/Menjar Fora → Comida fuera
NECESSITATS/necesidades/White card/Pantalones feina → Necesidades
Hostel/HOSTEL → Alojamiento
Nomina/Pagament mes → Salario
Entretenimiento → Ocio
Bali → Otros

## Marcel's personal week calendar (started in Australia)
Weeks start Sunday, end Saturday.
Week 1 = 05/04/2026 - 11/04/2026 (fallback date: 09/04/2026)
Week 2 = 12/04/2026 - 18/04/2026 (fallback date: 16/04/2026)
Week 3 = 19/04/2026 - 25/04/2026 (fallback date: 23/04/2026)
Week 4 = 26/04/2026 - 02/05/2026 (fallback date: 30/04/2026)
Week 5 = 03/05/2026 - 09/05/2026 (fallback date: 07/05/2026)
Week 6 = 10/05/2026 - 16/05/2026 (fallback date: 14/05/2026)
Week 7 = 17/05/2026 - 23/05/2026 (fallback date: 21/05/2026)
Week 8 = 24/05/2026 - 30/05/2026 (fallback date: 28/05/2026)
Week 9 = 31/05/2026 - 06/06/2026 (fallback date: 04/06/2026)
Week 10 = 07/06/2026 - 13/06/2026 (fallback date: 11/06/2026)
Week 11 = 14/06/2026 - 20/06/2026 (fallback date: 18/06/2026)
Week 12 = 21/06/2026 - 27/06/2026 (fallback date: 25/06/2026)
Week 13 = 28/06/2026 - 04/07/2026 (fallback date: 02/07/2026)

## Month grouping
April = Weeks 1, 2, 3 and partial week 4
May = Weeks 4 partial, 5, 6, 7, 8
June = Weeks 9, 10, 11, 12
July = Week 13

## Expected totals after full import
Total income: ~$9,380 AUD
Total expenses: ~$6,998 AUD
Total savings: ~$2,382 AUD
Total transactions: 57

## Design rules
- Dark theme, background #0d0d0f, purple accent #7c6fff
- Mobile first, all text in Spanish
- Amounts always show $ symbol with 2 decimal places
- Never use green buttons, always purple #7c6fff
- Refresh button on every screen top right as circular arrow icon
- Auto sync with Google Sheets every 2 hours silently

## Supabase tables
profiles, food_logs, weight_logs, transactions

## Important parsing rules
- Always replace comma with dot before parsing amounts: -71,89 → -71.89
- If column D date is empty use week fallback date from mapping above
- Bali row (no week number, amount -468) → assign week 10, date 10/06/2026, category Otros
- Skip rows where column B contains WEEK, TOTAL, SUMMARY or is empty
- Skip rows where column C is empty or not a number
