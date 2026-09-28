// Sistema de traducciones de la app: español e inglés, de momento. Cada
// texto visible para el usuario vive aquí como una clave con su versión en
// cada idioma — así, para añadir un idioma nuevo en el futuro, solo hay que
// añadir una columna más a este diccionario, sin tocar los componentes.
//
// Las claves usan {placeholder} para valores que se insertan en tiempo de
// ejecución (un número, una divisa...). translate() los sustituye.
export type Language = "es" | "en"

export const LANGUAGES: { code: Language; name: string }[] = [
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
]

type Entry = { es: string; en: string }

export const TRANSLATIONS = {
  // Común
  "common.loading": { es: "Cargando...", en: "Loading..." },
  "common.loadingData": { es: "Cargando datos...", en: "Loading data..." },
  "common.save": { es: "Guardar", en: "Save" },
  "common.saving": { es: "Guardando...", en: "Saving..." },
  "common.cancel": { es: "Cancelar", en: "Cancel" },
  "common.edit": { es: "Editar", en: "Edit" },
  "common.delete": { es: "Eliminar", en: "Delete" },
  "common.expense": { es: "Gasto (−)", en: "Expense (−)" },
  "common.income": { es: "Ganancia (+)", en: "Income (+)" },
  "common.daily": { es: "Diario", en: "Daily" },
  "common.weekly": { es: "Semanal", en: "Weekly" },
  "common.monthly": { es: "Mensual", en: "Monthly" },
  "common.currency": { es: "Divisa", en: "Currency" },
  "common.movement": { es: "movimiento", en: "transaction" },
  "common.movements": { es: "movimientos", en: "transactions" },

  // Categorías de transacciones. El valor guardado en la base de datos
  // sigue siendo siempre el español (para no romper datos ya existentes ni
  // el atajo de iOS, que compara categorías tal cual) — esto es solo la
  // etiqueta que se muestra en pantalla.
  "category.Alojamiento": { es: "Alojamiento", en: "Housing" },
  "category.Supermercado": { es: "Supermercado", en: "Groceries" },
  "category.Comida fuera": { es: "Comida fuera", en: "Eating out" },
  "category.Transporte": { es: "Transporte", en: "Transport" },
  "category.Salario": { es: "Salario", en: "Salary" },
  "category.Compras": { es: "Compras", en: "Shopping" },
  "category.Necesidades": { es: "Necesidades", en: "Essentials" },
  "category.Ocio": { es: "Ocio", en: "Leisure" },
  "category.Otros": { es: "Otros", en: "Other" },

  // Días de la semana (para el selector de día de pago semanal)
  "weekday.0": { es: "Domingo", en: "Sunday" },
  "weekday.1": { es: "Lunes", en: "Monday" },
  "weekday.2": { es: "Martes", en: "Tuesday" },
  "weekday.3": { es: "Miércoles", en: "Wednesday" },
  "weekday.4": { es: "Jueves", en: "Thursday" },
  "weekday.5": { es: "Viernes", en: "Friday" },
  "weekday.6": { es: "Sábado", en: "Saturday" },

  // Navegación / dashboard
  "nav.overview": { es: "Resumen", en: "Overview" },
  "nav.economy": { es: "Economía", en: "Finances" },
  "nav.settings": { es: "Ajustes", en: "Settings" },
  "app.tagline": { es: "Tu economía, a tu manera", en: "Your finances, your way" },
  "dashboard.greeting.morning": { es: "Buenos días", en: "Good morning" },
  "dashboard.greeting.afternoon": { es: "Buenas tardes", en: "Good afternoon" },
  "dashboard.greeting.evening": { es: "Buenas noches", en: "Good evening" },
  "dashboard.greetingName.fallback": { es: "de nuevo", en: "there" },
  "dashboard.subtitle": { es: "Sigamos con la racha.", en: "Let's keep the streak going." },
  "dashboard.reload": { es: "Recargar", en: "Reload" },
  "dashboard.signOut": { es: "Salir", en: "Sign out" },

  // Inicio de sesión
  "login.signIn": { es: "Iniciar sesión", en: "Sign in" },
  "login.signUp": { es: "Crear cuenta", en: "Sign up" },
  "login.emailPlaceholder": { es: "Email", en: "Email" },
  "login.passwordPlaceholder": { es: "Contraseña", en: "Password" },
  "login.invitePlaceholder": { es: "Código de invitación", en: "Invite code" },
  "login.wrongCredentials": { es: "Email o contraseña incorrectos", en: "Incorrect email or password" },
  "login.wrongInvite": { es: "Código de invitación incorrecto", en: "Incorrect invite code" },
  "login.passwordTooShort": {
    es: "La contraseña debe tener al menos 6 caracteres",
    en: "Password must be at least 6 characters",
  },
  "login.accountCreated": {
    es: "Cuenta creada. Revisa tu email para confirmar la cuenta antes de entrar.",
    en: "Account created. Check your email to confirm it before signing in.",
  },
  "login.wait": { es: "Un momento...", en: "One moment..." },
  "login.enter": { es: "Entrar", en: "Sign in" },
  "login.or": { es: "o", en: "or" },
  "login.google": { es: "Continuar con Google", en: "Continue with Google" },

  // Resumen (overview)
  "overview.spent": { es: "Gastado", en: "Spent" },
  "overview.income": { es: "Ingresado", en: "Received" },
  "overview.registered": { es: "Registrado", en: "Registered" },
  "overview.noIncome": { es: "Sin ingresos", en: "No income" },
  "overview.balance": { es: "Balance", en: "Balance" },
  "overview.today": { es: "Hoy", en: "Today" },
  "overview.thisWeek": { es: "Esta semana", en: "This week" },
  "overview.thisMonth": { es: "Este mes", en: "This month" },
  "overview.topCategory": { es: "Top categoría", en: "Top category" },
  "overview.noExpenses": { es: "Sin gastos", en: "No expenses" },
  "overview.monthBalanceLabel": { es: "Balance del mes", en: "This month's balance" },
  "overview.totalBalanceLabel": { es: "Ahorro total", en: "Total savings" },
  "overview.appSummary": {
    es: "ZentOS: controla lo que gastas e ingresas y ponte un objetivo de ahorro cada mes.",
    en: "ZentOS: track what you spend and earn, and set a savings goal each month.",
  },
  "overview.lastDayOfMonth": { es: "Último día del mes", en: "Last day of the month" },
  "overview.dayLeft": { es: "día para fin de mes", en: "day left this month" },
  "overview.daysLeft": { es: "días para fin de mes", en: "days left this month" },
  "overview.goalTitle": { es: "Objetivo de ahorro", en: "Savings goal" },
  "overview.goalSet": { es: "Poner objetivo", en: "Set goal" },
  "overview.goalEdit": { es: "Editar", en: "Edit" },
  "overview.goalHideForm": { es: "Ocultar", en: "Hide" },
  "overview.goalPeriodTotal": { es: "Total", en: "Total" },
  "overview.goalDeadlineLabel": { es: "Fecha límite (opcional)", en: "Deadline (optional)" },
  "overview.goalDeadlineUntil": { es: "Hasta el {date}", en: "Until {date}" },
  "overview.goalDeadlinePassed": { es: "Fecha límite pasada", en: "Deadline passed" },
  "overview.goalPlaceholder": { es: "¿Cuánto quieres ahorrar?", en: "How much do you want to save?" },
  "overview.goalReached": { es: "¡Objetivo conseguido!", en: "Goal reached!" },
  "overview.goalRemove": { es: "Quitar objetivo", en: "Remove goal" },

  // Economía
  "economy.noTransactions": { es: "Sin transacciones", en: "No transactions" },
  "economy.addFirstHint": {
    es: "Añade tu primer gasto o ingreso con el botón de abajo",
    en: "Add your first expense or income with the button below",
  },
  "economy.newTransaction": { es: "Nueva transacción", en: "New transaction" },
  "economy.type": { es: "Tipo", en: "Type" },
  "economy.description": { es: "Descripción", en: "Description" },
  "economy.descPlaceholder": { es: "Ej: Compra semanal", en: "E.g. Weekly shopping" },
  "economy.addDescription": { es: "+ Añadir descripción (opcional)", en: "+ Add description (optional)" },
  "economy.hideDescription": { es: "Ocultar descripción", en: "Hide description" },
  "economy.amount": { es: "Cantidad", en: "Amount" },
  "economy.amountPlaceholder": { es: "Ej: 45.50", en: "E.g. 45.50" },
  "economy.amountHint": {
    es: "Introduce solo el número positivo, el signo se aplica solo según el tipo elegido arriba.",
    en: "Enter just the positive number — the sign is applied automatically based on the type chosen above.",
  },
  "economy.convertNotice": {
    es: " Se convertirá a {currency} al guardar, con el tipo de cambio de hoy.",
    en: " It will be converted to {currency} when saved, using today's exchange rate.",
  },
  "economy.conversionError": {
    es: "No se pudo obtener el tipo de cambio. Inténtalo de nuevo en un momento.",
    en: "Couldn't get the exchange rate. Try again in a moment.",
  },
  "economy.category": { es: "Categoría", en: "Category" },
  "economy.date": { es: "Fecha", en: "Date" },
  "economy.addButton": { es: "Añadir gasto o ganancia", en: "Add expense or income" },

  // Importar extracto bancario en CSV o PDF (cualquier banco, ver
  // app/api/import-csv/route.ts): el archivo se manda a una IA que detecta
  // el formato y devuelve los movimientos ya normalizados.
  "economy.importCsv": { es: "Importar CSV o PDF", en: "Import CSV or PDF" },
  "economy.importingCsv": { es: "Leyendo el archivo con IA...", en: "Reading file with AI..." },
  "economy.importCsvDone": {
    es: "Importados {imported} · ya existían {skipped}",
    en: "Imported {imported} · already existed {skipped}",
  },
  "economy.importCsvEmpty": {
    es: "No se encontraron movimientos en ese archivo.",
    en: "No transactions were found in that file.",
  },
  "economy.importCsvError": {
    es: "No se pudo importar el archivo. Revísalo e inténtalo de nuevo.",
    en: "Couldn't import the file. Check it and try again.",
  },
  // Extractos multi-divisa (Revolut sobre todo): filas cuya divisa no se
  // pudo convertir a la divisa principal (sin tasa disponible ese día para
  // ese código) se dejan fuera de la importación en vez de guardarlas con
  // un importe potencialmente muy incorrecto — este aviso dice cuántas.
  "economy.importCsvCurrencyIssue": {
    es: "{count} sin convertir de divisa (revísalos a mano)",
    en: "{count} not currency-converted (check manually)",
  },
  "economy.monthBalance": { es: "Balance del mes", en: "This month's balance" },
  "economy.incomeMonth": { es: "Ingresado (mes)", en: "Income (month)" },
  "economy.spentMonth": { es: "Gastado (mes)", en: "Spent (month)" },
  "economy.weeklySavings": { es: "Ahorro semanal", en: "Weekly savings" },
  "economy.savingsLabel": { es: "Ahorro", en: "Savings" },
  "economy.week": { es: "Semana {n}", en: "Week {n}" },
  "economy.totalSaved": { es: "Total ahorrado", en: "Total saved" },
  "economy.best": { es: "Mejor", en: "Best" },
  "economy.worst": { es: "Peor", en: "Worst" },
  "economy.noTransactionsRegistered": { es: "Sin transacciones registradas", en: "No transactions recorded" },
  "economy.incomeTag": { es: "ingreso", en: "income" },
  "economy.googleSheetsError": {
    es: "No se pudo sincronizar con Google Sheets",
    en: "Couldn't sync with Google Sheets",
  },

  // Alta en lote: varias transacciones a la vez (una fila por movimiento),
  // pensado para cuando vuelves de un viaje o tienes varios gastos sueltos
  // pendientes de apuntar y no quieres abrir el formulario 25 veces.
  "batch.trigger": { es: "Añadir varias de golpe", en: "Add several at once" },
  "batch.dialogTitle": { es: "Alta en lote", en: "Batch add" },
  "batch.dialogDesc": {
    es: "Rellena varias filas y guárdalas todas de una vez — ideal después de un viaje o para ponerte al día con gastos sueltos.",
    en: "Fill in several rows and save them all at once — handy after a trip or to catch up on loose expenses.",
  },
  "batch.addRow": { es: "+ Añadir fila", en: "+ Add row" },
  "batch.removeRow": { es: "Eliminar fila", en: "Remove row" },
  "batch.saveAll": { es: "Guardar movimientos ({n})", en: "Save transactions ({n})" },

  // Recurrentes
  "recurring.title": { es: "Gastos recurrentes", en: "Recurring expenses" },
  "recurring.dialogTitle": { es: "Gastos e ingresos recurrentes", en: "Recurring expenses & income" },
  "recurring.dialogDesc": {
    es: "Elige mensual o semanal, y el día en que se paga. Se crean solas al empezar cada periodo (alquiler, suscripciones, nómina... o la compra semanal). Al abrir la app te avisamos con un popup para que los revises.",
    en: "Choose monthly or weekly, and the day it's paid. They're created automatically at the start of each period (rent, subscriptions, payroll... or the weekly grocery run). When you open the app, a popup lets you review them.",
  },
  "recurring.empty": { es: "Aún no tienes ninguno.", en: "You don't have any yet." },
  "recurring.frequency": { es: "Frecuencia", en: "Frequency" },
  "recurring.dayOfWeek": { es: "Día de la semana", en: "Day of week" },
  "recurring.dayOfMonth": { es: "Día del mes", en: "Day of month" },
  "recurring.day": { es: "Día {n}", en: "Day {n}" },
  "recurring.descPlaceholder": { es: "Ej: Alquiler", en: "E.g. Rent" },
  "recurring.active": { es: "Activo", en: "Active" },
  "recurring.paused": { es: "Pausado", en: "Paused" },
  "recurring.addNew": { es: "Añadir recurrente", en: "Add recurring" },

  // Popup de revisión de recurrentes
  "recurringReview.title": { es: "Gastos recurrentes de este mes", en: "This month's recurring items" },
  "recurringReview.desc": {
    es: "Se han añadido solos porque los marcaste como recurrentes. Revisa que estén bien, edita el importe si cambió, o bórralos si este mes no toca.",
    en: "These were added automatically because you marked them as recurring. Check they look right, edit the amount if it changed, or remove any that don't apply this month.",
  },
  "recurringReview.empty": { es: "Nada más que revisar.", en: "Nothing left to review." },
  "recurringReview.done": { es: "Listo", en: "Done" },

  // Ajustes
  "settings.account": { es: "Cuenta", en: "Account" },
  "settings.accountDesc": {
    es: "Sesión iniciada en este dispositivo.",
    en: "Signed in on this device.",
  },
  "settings.signOut": { es: "Cerrar sesión", en: "Sign out" },
  "settings.about": { es: "Sobre esta app", en: "About this app" },
  "settings.preferences": { es: "Preferencias", en: "Preferences" },
  "settings.preferencesDesc": {
    es: "Cómo se muestran tus datos en la app.",
    en: "How your data is shown in the app.",
  },
  "settings.homeCurrency": { es: "Divisa principal", en: "Main currency" },
  "settings.homeCurrencyDesc": {
    es: "Todos tus totales y resúmenes se muestran en esta divisa. Si registras un gasto en otra (por ejemplo, de viaje), se convierte automáticamente a esta usando el tipo de cambio del día.",
    en: "All your totals and summaries are shown in this currency. If you record an expense in another one (say, while traveling), it's converted automatically using today's exchange rate.",
  },
  "settings.saved": { es: "Guardado.", en: "Saved." },
  "settings.language": { es: "Idioma", en: "Language" },
  "settings.languageDesc": {
    es: "Elige en qué idioma quieres ver la app.",
    en: "Choose which language you want to see the app in.",
  },
  // Inicio de semana: cada persona elige qué día cuenta como el primero de
  // la semana (domingo por defecto, para no cambiar nada a quien no toque
  // esto). Afecta a "Semana N" en Economía y Resumen, al ahorro semanal, al
  // recordatorio de "ahorro semanal" y a qué día cae un recurrente semanal
  // — ver lib/week.ts.
  "settings.weekStartDay": { es: "Inicio de semana", en: "Week starts on" },
  "settings.weekStartDayDesc": {
    es: "Qué día cuenta como el primero de la semana en los resúmenes semanales de la app y en los recordatorios.",
    en: "Which day counts as the first day of the week in the app's weekly summaries and reminders.",
  },

  // Modo viaje
  "settings.travelMode": { es: "Modo viaje", en: "Travel mode" },
  "settings.travelModeDesc": {
    es: "Actívalo mientras estés fuera para que las nuevas transacciones usen esta divisa por defecto, sin tener que cambiarla cada vez. Recuerda desactivarlo al volver.",
    en: "Turn it on while you're away so new transactions default to this currency instead of switching it every time. Remember to turn it off when you're back.",
  },
  "settings.travelModeOn": { es: "Activado", en: "On" },
  "settings.travelModeOff": { es: "Desactivado", en: "Off" },
  "settings.travelCurrency": { es: "Divisa de viaje", en: "Travel currency" },
  "economy.travelModeHint": {
    es: "Modo viaje activo: esta transacción se registrará en {currency} por defecto.",
    en: "Travel mode is on: this transaction will default to {currency}.",
  },
  "settings.feedback": { es: "Enviar feedback", en: "Send feedback" },
  "settings.feedbackDesc": {
    es: "¿Algo que arreglar, una idea o un problema? Escríbelo aquí y me llega directo.",
    en: "Something to fix, an idea, or a problem? Write it here and it comes straight to me.",
  },
  "settings.feedbackPlaceholder": { es: "Escribe tu mensaje...", en: "Write your message..." },
  "settings.feedbackError": {
    es: "No se pudo enviar. Inténtalo de nuevo en un momento.",
    en: "Couldn't send it. Try again in a moment.",
  },
  "settings.feedbackSent": { es: "¡Enviado! Gracias por avisar.", en: "Sent! Thanks for letting me know." },
  "settings.send": { es: "Enviar", en: "Send" },
  "settings.sending": { es: "Enviando...", en: "Sending..." },
  "settings.shortcutTitle": { es: "Atajo rápido (iPhone / Apple Watch)", en: "Quick add shortcut (iPhone / Apple Watch)" },
  "settings.shortcutDesc": {
    es: "Un Shortcut de Apple que abre una pantalla propia de ZentOS para apuntar el gasto en un par de toques y lo guarda directo en tu cuenta. Instálalo con un toque — la primera vez te pedirá tu código personal (lo tienes debajo) y lo recordará para siempre en este dispositivo.",
    en: "An Apple Shortcut that opens a ZentOS confirmation screen to log the expense in a couple of taps and saves it straight to your account. Install it with one tap — the first time it'll ask for your personal code (you have it below) and remember it on this device from then on.",
  },
  "settings.preparing": { es: "Preparando tus datos...", en: "Preparing your data..." },
  "settings.installShortcut": { es: "Instalar atajo (un toque)", en: "Install shortcut (one tap)" },
  "settings.apiUrl": { es: "Enlace de confirmación", en: "Confirmation link" },
  "settings.copyUrl": { es: "Copiar URL", en: "Copy URL" },
  "settings.yourCode": { es: "Tu código personal", en: "Your personal code" },
  "settings.copyCode": { es: "Copiar código", en: "Copy code" },
  "settings.regenCode": { es: "Regenerar código", en: "Regenerate code" },
  "settings.regenHint": {
    es: "Al instalarlo te pedirá pegar el código de arriba, solo la primera vez. Si crees que alguien más tiene tu código, regenéralo aquí — tendrás que abrir el atajo en la app Atajos, borrar el código guardado dentro (o reinstalarlo) y pegar el nuevo para que vuelva a funcionar en tu dispositivo.",
    en: "When you install it, it'll ask you to paste the code above, just the first time. If you think someone else has your code, regenerate it here — you'll need to open the shortcut in the Shortcuts app, delete the code saved inside (or reinstall it) and paste the new one so it works again on your device.",
  },
  "settings.lastUsed": {
    es: "Último uso de tu código: {when}. Si te suena raro, regenéralo arriba.",
    en: "Your code was last used: {when}. If that looks off, regenerate it above.",
  },
  "settings.lastUsedNever": {
    es: "Tu código todavía no se ha usado nunca.",
    en: "Your code hasn't been used yet.",
  },
  "settings.showManual": {
    es: "¿Prefieres construirlo tú mismo (o el enlace no funciona)? Instrucciones manuales",
    en: "Prefer to build it yourself (or the link isn't working)? Manual instructions",
  },
  "settings.hideManual": { es: "Ocultar instrucciones manuales", en: "Hide manual instructions" },
  "settings.manualTitle": {
    es: "Cómo crearlo a mano en la app Atajos:",
    en: "How to build it by hand in the Shortcuts app:",
  },
  "settings.manualStep1": {
    es: 'Abre Atajos → toca + para crear uno nuevo. Ponle de nombre "ZentOS".',
    en: 'Open Shortcuts → tap + to create a new one. Name it "ZentOS".',
  },
  "settings.manualStep2": {
    es: 'Añade la acción Abrir URLs (busca "abrir url"). Pega esta dirección completa, sustituyendo TU_CODIGO por tu código personal de abajo: {url}?token=TU_CODIGO. Guarda el atajo — ya está, no hace falta nada más.',
    en: 'Add the Open URLs action (search "open url"). Paste this full address, replacing TU_CODIGO with your personal code below: {url}?token=TU_CODIGO. Save the shortcut — that\'s the whole thing, nothing else needed.',
  },
  "settings.watchTitle": { es: "Para usarlo en el Apple Watch:", en: "To use it on Apple Watch:" },
  "settings.watchDesc": {
    es: 'Ábrelo en Atajos en el iPhone → toca ⓘ → activa "Mostrar en Apple Watch". Debería aparecer en la app Atajos del reloj a los pocos segundos.',
    en: 'Open it in Shortcuts on the iPhone → tap ⓘ → turn on "Show on Apple Watch". It should appear in the Shortcuts app on the watch within a few seconds.',
  },
  "settings.showTapToPay": {
    es: "¿Lo quieres al usar la tarjeta (sin abrir nada)? Activar disparador automático",
    en: "Want it to run just by tapping your card (no app needed)? Set up the automatic trigger",
  },
  "settings.hideTapToPay": { es: "Ocultar disparador automático", en: "Hide automatic trigger" },
  "settings.tapToPayTitle": {
    es: "Que se abra solo al pagar con tarjeta",
    en: "Have it open automatically when you pay by card",
  },
  "settings.tapToPayNote": {
    es: "Esto se hace una sola vez, en unos 30 segundos — después no vuelves a tocar nada, se abre solo al pagar con la tarjeta. No viene incluido al instalar el atajo porque Apple no deja compartir este paso por enlace (es a propósito, por privacidad: solo tú puedes vincular tu propio Apple Pay). Necesitas tener ya una tarjeta añadida en Apple Pay/Wallet para que te salga la opción.",
    en: "This takes about 30 seconds, just once — after that you never touch anything again, it opens automatically when you pay by card. It doesn't come with the shortcut install because Apple doesn't allow sharing this step via link (on purpose, for privacy: only you can link your own Apple Pay). You need to already have a card added to Apple Pay/Wallet for the option to show up.",
  },
  "settings.tapToPayStep1Title": { es: "Abre Atajos", en: "Open Shortcuts" },
  "settings.tapToPayStep1": {
    es: 'Pestaña "Automatización" (abajo del todo).',
    en: 'The "Automation" tab (bottom of the screen).',
  },
  "settings.tapToPayStep2Title": { es: "Automatización nueva", en: "New automation" },
  "settings.tapToPayStep2": {
    es: 'Toca el + de arriba a la derecha → "Crear automatización personal".',
    en: 'Tap the + in the top right → "Create Personal Automation".',
  },
  "settings.tapToPayStep3Title": { es: "Elige Apple Pay", en: "Choose Apple Pay" },
  "settings.tapToPayStep3": {
    es: 'Baja hasta "Apple Pay" → "Tarjeta" → "Cualquier tarjeta" (o la que quieras) → Siguiente.',
    en: '"Apple Pay" → "Card" → "Any Card" (or a specific one) → Next.',
  },
  "settings.tapToPayStep4Title": { es: "Enlaza el atajo", en: "Link the shortcut" },
  "settings.tapToPayStep4": {
    es: '"Añadir acción" → busca "Ejecutar atajo" → elige el atajo ZentOS que ya instalaste arriba.',
    en: '"Add Action" → search "Run Shortcut" → pick the ZentOS shortcut you installed above.',
  },
  "settings.tapToPayStep5Title": { es: "Sin confirmaciones", en: "No confirmations" },
  "settings.tapToPayStep5": {
    es: 'Siguiente → desactiva "Preguntar antes de ejecutar" → Hecho. Ya está.',
    en: 'Next → turn off "Ask Before Running" → Done. That\'s it.',
  },

  // Mejora opcional sobre el Tap-to-Pay de arriba: en vez de abrir la
  // pantalla de /quick-confirm en blanco (a rellenar a mano), edita la
  // MISMA automatización para que la cantidad (y el comercio, si el banco
  // lo da) del propio pago con Apple Pay viajen ya escritos en el enlace —
  // así solo queda elegir categoría y tocar Guardar, en vez de escribir el
  // número. Solo funciona en la automatización personal de cada uno (no en
  // el atajo compartido de iCloud, que Apple no deja editar por enlace),
  // así que son pasos manuales de Atajos, no algo que cambie solo.
  "settings.showPrefill": {
    es: "¿Quieres que salga la cantidad ya rellenada? (opcional)",
    en: "Want the amount already filled in? (optional)",
  },
  "settings.hidePrefill": { es: "Ocultar formulario pre-rellenado", en: "Hide pre-filled form" },
  "settings.prefillTitle": {
    es: "Que la pantalla se abra con la cantidad ya puesta",
    en: "Open the screen with the amount already filled in",
  },
  "settings.prefillNote": {
    es: "Con los pasos de arriba, la pantalla de ZentOS se abre en blanco y hay que escribir la cantidad a mano. Apple Pay sí conoce el importe (y a veces el comercio) en el momento del pago — con estos pasos extra, ese dato viaja dentro del enlace y la pantalla ya sale con la cantidad puesta. Solo hace falta editar la automatización una vez.",
    en: "With the steps above, the ZentOS screen opens blank and you have to type the amount by hand. Apple Pay does know the amount (and sometimes the merchant) at the moment of payment — with these extra steps, that data travels inside the link and the screen already shows the amount. You only need to edit the automation once.",
  },
  "settings.prefillStep1Title": { es: "Abre tu automatización", en: "Open your automation" },
  "settings.prefillStep1": {
    es: 'Atajos → pestaña "Automatización" → toca la automatización de Apple Pay que ya creaste en los pasos de arriba.',
    en: 'Shortcuts → the "Automation" tab → tap the Apple Pay automation you already created above.',
  },
  "settings.prefillStep2Title": { es: "Quita \"Ejecutar atajo\"", en: 'Remove "Run Shortcut"' },
  "settings.prefillStep2": {
    es: "Desliza esa acción hacia la izquierda y elimínala — la sustituimos por dos acciones que sí pueden usar el importe del pago.",
    en: "Swipe that action to the left and delete it — we'll replace it with two actions that can actually use the payment amount.",
  },
  "settings.prefillStep3Title": { es: 'Añade "Texto"', en: 'Add "Text"' },
  "settings.prefillStep3": {
    es: "Busca la acción \"Texto\" y pega esto, sustituyendo TU_CODIGO por tu código de abajo. Los textos entre corchetes son variables mágicas: tócalos y elige el campo correspondiente (Importe/Comercio) que te ofrece Atajos — si tu banco no da el comercio, deja solo la parte de \"amount\".",
    en: "Find the \"Text\" action and paste this, replacing TU_CODIGO with your code below. The bracketed text is a magic variable: tap it and pick the matching field (Amount/Merchant) that Shortcuts offers — if your bank doesn't provide the merchant, just leave the \"amount\" part.",
  },
  "settings.prefillStep4Title": { es: "Codifica las variables", en: "Encode the variables" },
  "settings.prefillStep4": {
    es: 'Mantén pulsada cada variable que insertes (Importe, Comercio) y elige "Formato" → "Codificación de URL", para que las comas, espacios o el símbolo de tu divisa no rompan el enlace.',
    en: 'Press and hold each variable you insert (Amount, Merchant) and choose "Format" → "URL Encode", so commas, spaces or your currency symbol don\'t break the link.',
  },
  "settings.prefillStep5Title": { es: 'Añade "Abrir URLs"', en: 'Add "Open URLs"' },
  "settings.prefillStep5": {
    es: "Busca la acción \"Abrir URLs\" y elige como entrada el resultado del Texto de arriba (suele seleccionarse solo, por ser la acción justo anterior). Guarda y pruébalo pagando con la tarjeta.",
    en: 'Find the "Open URLs" action and pick the Text result from above as its input (it usually gets selected automatically, being the action right before it). Save and try it by paying with the card.',
  },

  // Un paso más allá del formulario pre-rellenado de arriba: en vez de abrir
  // cualquier pantalla, la automatización llama directo a la API (como ya
  // hace el camino de iOS 27 con las notificaciones del banco) y deja que
  // la IA (Gemini, la misma que ya clasifica al importar CSV/PDF) adivine
  // la categoría por el nombre del comercio — el aviso de "Guardado" llega
  // por notificación del sistema, no por pantalla. Para no perder el gasto
  // en silencio cuando Apple Pay no da el importe a tiempo (el fallo
  // ocasional ya conocido de este disparador), la automatización comprueba
  // primero si Importe tiene algún valor: si no lo tiene, cae a la pantalla
  // en blanco de siempre en vez de no hacer nada.
  "settings.showAutoAi": {
    es: "¿Quieres que se registre solo, sin tocar nada? (avanzado)",
    en: "Want it logged automatically, without tapping anything? (advanced)",
  },
  "settings.hideAutoAi": { es: "Ocultar registro automático", en: "Hide automatic logging" },
  "settings.autoAiTitle": {
    es: "Que se registre solo al pagar, con la categoría adivinada por IA",
    en: "Log it automatically when you pay, with the category guessed by AI",
  },
  "settings.autoAiNote": {
    es: "Un paso más sobre el formulario pre-rellenado de arriba: en vez de abrir cualquier pantalla, la automatización llama directamente a ZentOS y dejas que la IA adivine la categoría por el comercio — te enteras por una notificación, no por pantalla. Por si alguna vez el pago no trae el importe a tiempo (le pasa de vez en cuando a este disparador de Apple), se añade una comprobación que abre la pantalla de siempre como red de seguridad en vez de perder el gasto en silencio.",
    en: "One step further than the pre-filled form above: instead of opening any screen, the automation calls ZentOS directly and lets AI guess the category from the merchant — you find out via a notification, not a screen. In case the payment doesn't bring the amount in time (it happens occasionally with this Apple trigger), a check is added that opens the usual screen as a safety net instead of silently losing the expense.",
  },
  "settings.autoAiStep1Title": { es: "Abre la misma automatización", en: "Open the same automation" },
  "settings.autoAiStep1": {
    es: "Atajos → pestaña \"Automatización\" → la automatización de Apple Pay (con los pasos de arriba ya hechos).",
    en: "Shortcuts → the \"Automation\" tab → the Apple Pay automation (with the steps above already done).",
  },
  "settings.autoAiStep2Title": { es: "Quita el paso anterior", en: "Remove the previous step" },
  "settings.autoAiStep2": {
    es: "Elimina la acción \"Abrir URLs\" (o \"Ejecutar atajo\", si no has hecho la guía de arriba todavía) — la sustituimos por un \"Si\" que decide solo entre registrar el gasto al momento o abrir la pantalla de siempre.",
    en: "Delete the \"Open URLs\" action (or \"Run Shortcut\", if you haven't done the guide above yet) — we'll replace it with an \"If\" that decides on its own between logging the expense right away or opening the usual screen.",
  },
  "settings.autoAiStep3Title": { es: 'Añade "Si"', en: 'Add "If"' },
  "settings.autoAiStep3": {
    es: 'Busca la acción "Si" → como condición, elige la variable mágica Importe → "tiene algún valor".',
    en: 'Find the "If" action → as the condition, pick the Amount magic variable → "has any value".',
  },
  "settings.autoAiStep4Title": { es: "Dentro del Si: llama a ZentOS", en: "Inside the If: call ZentOS" },
  "settings.autoAiStep4": {
    es: "En esa rama, añade \"Obtener contenido de URL\" (método GET) con esta dirección, sustituyendo TU_CODIGO por tu código de abajo. Igual que antes, los corchetes son variables mágicas: tócalos para insertar Importe/Comercio y codifícalos en URL.",
    en: "In that branch, add \"Get Contents of URL\" (GET method) with this address, replacing TU_CODIGO with your code below. Same as before, the brackets are magic variables: tap them to insert Amount/Merchant and URL-encode them.",
  },
  "settings.autoAiStep5Title": { es: 'Rama "Si no": red de seguridad', en: '"Otherwise" branch: safety net' },
  "settings.autoAiStep5": {
    es: "En la rama \"Si no\" (justo debajo), añade \"Abrir URLs\" con esta otra dirección — la misma pantalla en blanco de siempre, por si el pago no trae el importe.",
    en: "In the \"Otherwise\" branch (right below), add \"Open URLs\" with this other address — the same blank screen as always, in case the payment doesn't bring the amount.",
  },
  "settings.autoAiStep6Title": { es: "Cierra el Si y guarda sin confirmaciones", en: "Close the If and save without confirmations" },
  "settings.autoAiStep6": {
    es: 'Añade "Fin si" si Atajos no lo ha puesto solo. Luego, Siguiente → desactiva "Preguntar antes de ejecutar" y "Notificar cuando se ejecute" → Hecho.',
    en: 'Add "End If" if Shortcuts hasn\'t added it on its own. Then, Next → turn off "Ask Before Running" and "Notify When Run" → Done.',
  },
  "settings.autoAiStep7Title": { es: "Cómo te enteras", en: "How you'll find out" },
  "settings.autoAiStep7": {
    es: "Sin pantalla de por medio, ZentOS clasifica el gasto con IA y te manda una notificación push confirmando cantidad, comercio y categoría — actívalas en Ajustes → Recordatorios si no lo has hecho. Si alguna vez acierta mal la categoría, se corrige a mano en Economía, sin tocar nada del atajo.",
    en: "With no screen involved, ZentOS classifies the expense with AI and sends a push notification confirming the amount, merchant and category — enable them in Settings → Reminders if you haven't already. If it ever gets the category wrong, just fix it by hand in Economía — no need to touch the shortcut.",
  },
  "settings.autoAiFlakyNote": {
    es: "Si la automatización a veces no salta en absoluto (ni pantalla ni notificación) con una tarjeta concreta, es un problema distinto de Atajos/Apple Pay — revisa que el disparador esté puesto en \"Cualquier tarjeta\" en vez de una sola.",
    en: "If the automation sometimes doesn't fire at all (no screen, no notification) with a specific card, that's a separate Shortcuts/Apple Pay issue — check that the trigger is set to \"Any Card\" rather than just one.",
  },

  // Detección automática al pagar leyendo la notificación (iOS 27+)
  "settings.showNotifAuto": {
    es: "¿Tienes iOS 27? Detección 100% automática (sin tocar nada)",
    en: "On iOS 27? Fully automatic detection (no tapping required)",
  },
  "settings.hideNotifAuto": { es: "Ocultar detección automática", en: "Hide automatic detection" },
  "settings.notifAutoTitle": {
    es: "Registrar el gasto solo, al recibir la notificación del banco",
    en: "Log the expense automatically when the bank notification arrives",
  },
  "settings.notifAutoNote": {
    es: "En iOS 27+, Atajos puede leer el texto de una notificación en cuanto llega. Con esto, en vez de abrir una pantalla de ZentOS para confirmar, el gasto se registra solo en segundo plano — y ZentOS te manda su propia notificación confirmando lo que detectó, para que lo puedas revisar.",
    en: "On iOS 27+, Shortcuts can read a notification's text the moment it arrives. With this, instead of opening a ZentOS screen to confirm, the expense is logged silently in the background — and ZentOS sends its own notification confirming what it detected, so you can review it.",
  },
  "settings.notifAutoStep1Title": { es: "Abre Atajos", en: "Open Shortcuts" },
  "settings.notifAutoStep1": {
    es: 'Pestaña "Automatización" (abajo del todo).',
    en: 'The "Automation" tab (bottom of the screen).',
  },
  "settings.notifAutoStep2Title": { es: "Automatización nueva", en: "New automation" },
  "settings.notifAutoStep2": {
    es: 'Toca el + de arriba a la derecha → "Crear automatización personal" → busca "Notificación" en la lista y elige la app de tu banco o Wallet.',
    en: 'Tap the + in the top right → "Create Personal Automation" → find "Notification" in the list and pick your bank or Wallet app.',
  },
  "settings.notifAutoStep3Title": { es: "Añade la acción", en: "Add the action" },
  "settings.notifAutoStep3": {
    es: 'Añade "Obtener contenido de URL" (método GET) apuntando a esta dirección, sustituyendo TU_CODIGO por tu código personal de abajo. Los textos entre corchetes son variables mágicas: tócalos y elige el campo correspondiente de la notificación (Título/Subtítulo/Cuerpo) que te ofrece Atajos.',
    en: 'Add "Get Contents of URL" (GET method) pointing to this address, replacing TU_CODIGO with your personal code below. The bracketed text is a magic variable: tap it and pick the matching notification field (Title/Subtitle/Body) that Shortcuts offers.',
  },
  "settings.notifAutoStep4Title": { es: "Sin confirmaciones", en: "No confirmations" },
  "settings.notifAutoStep4": {
    es: 'Siguiente → desactiva "Preguntar antes de ejecutar" y "Notificar cuando se ejecute" → Hecho. Así corre en segundo plano, sin abrir nada en pantalla.',
    en: 'Next → turn off "Ask Before Running" and "Notify When Run" → Done. It then runs in the background without opening anything on screen.',
  },
  "settings.notifAutoStep5Title": { es: "Confirmación por notificación", en: "Confirmation notification" },
  "settings.notifAutoStep5": {
    es: 'ZentOS detecta que el importe vino del texto de una notificación y te manda su propia notificación push confirmando el gasto (activa las notificaciones en la pestaña Automatizaciones si no lo has hecho).',
    en: "ZentOS detects that the amount came from reading a notification's text and sends its own push notification confirming the expense (enable notifications in the Automations tab if you haven't already).",
  },
  "settings.notifAutoOlderIos": {
    es: "Si usas ZentOS con alguien que todavía está en iOS 26 o anterior, Atajos no le ofrecerá el disparador \"Notificación\" — para esas cuentas, el atajo de \"al pagar con la tarjeta\" de arriba (Apple Pay) sigue siendo la mejor opción: pide un toque para confirmar, pero funciona en cualquier versión.",
    en: "If someone using ZentOS is still on iOS 26 or earlier, Shortcuts won't offer them the \"Notification\" trigger — for those accounts, the \"pay with card\" (Apple Pay) shortcut above is still the best option: it needs one tap to confirm, but works on any version.",
  },

  // Recordatorios (antes una pestaña de navegación propia "Automatizaciones";
  // ahora vive como un apartado desplegable más dentro de Ajustes).
  "settings.remindersTitle": { es: "Recordatorios", en: "Reminders" },

  // Recordatorios (antes "Automatizaciones" — mismo sistema por dentro,
  // solo cambia cómo se llama y dónde vive de cara al usuario)
  "automations.subtitle": {
    es: "Recordatorios y alertas propias, tipo Atajos: eliges cuándo (o bajo qué condición) y qué avisos recibir.",
    en: "Your own reminders and alerts, Shortcuts-style: choose when (or under what condition) and what to be notified about.",
  },
  "automations.pushCardTitle": { es: "Notificaciones del sistema", en: "System notifications" },
  "automations.pushCardDescOn": {
    es: "Activadas en este dispositivo. Los recordatorios con acción \"Notificación\" te avisarán aunque tengas la app cerrada.",
    en: "Enabled on this device. Reminders with the \"Notification\" action will reach you even with the app closed.",
  },
  "automations.pushCardDescOff": {
    es: "Actívalas para recibir avisos del sistema aunque no tengas la app abierta. En iPhone, instala primero la app en la pantalla de inicio (Compartir → Añadir a pantalla de inicio).",
    en: "Turn them on to get system-level alerts even when the app isn't open. On iPhone, first install the app to your home screen (Share → Add to Home Screen).",
  },
  "automations.pushEnable": { es: "Activar notificaciones", en: "Enable notifications" },
  "automations.pushDisable": { es: "Desactivar", en: "Disable" },
  "automations.pushTest": { es: "Enviar prueba", en: "Send test" },
  "automations.pushTestSent": { es: "Prueba enviada — revisa tu pantalla.", en: "Test sent — check your screen." },
  "automations.pushTestNoSub": {
    es: "No se ha guardado ninguna suscripción para esta cuenta — vuelve a pulsar \"Activar notificaciones\".",
    en: "No subscription is saved for this account — tap \"Enable notifications\" again.",
  },
  "automations.pushTestError": {
    es: "El envío falló: {error}",
    en: "Sending failed: {error}",
  },
  "automations.pushUnsupported": {
    es: "Este navegador no soporta notificaciones push. En iPhone, añade la app a la pantalla de inicio primero.",
    en: "This browser doesn't support push notifications. On iPhone, add the app to your home screen first.",
  },
  // Caso concreto de iPhone: la app SÍ está añadida a la pantalla de
  // inicio, pero se está abriendo desde Safari (una pestaña, un enlace
  // compartido por WhatsApp/Mensajes) en vez del icono guardado. Ahí pedir
  // permiso de notificaciones no hace nada — ni siquiera muestra el aviso
  // del sistema — así que hay que decirlo explícitamente en vez de dejar
  // que parezca que el botón "Activar" simplemente no funciona.
  "automations.pushNeedsInstall": {
    es: "Para activarlas, cierra esto y abre ZentOS desde el icono de tu pantalla de inicio (no desde Safari ni desde un enlace compartido).",
    en: "To enable them, close this and open ZentOS from the icon on your home screen (not from Safari or a shared link).",
  },
  "automations.pushDenied": {
    es: "Permiso de notificaciones denegado. Actívalo desde los ajustes del navegador/sistema.",
    en: "Notification permission denied. Enable it from your browser/system settings.",
  },
  "automations.empty": { es: "Aún no tienes ningún recordatorio.", en: "You don't have any reminders yet." },
  "automations.emptyHint": {
    es: "Crea el primero con el botón de abajo: un recordatorio programado o una alerta cuando algo pase en tu Economía.",
    en: "Create your first one below: a scheduled reminder, or an alert when something happens in your finances.",
  },
  "automations.addNew": { es: "Nuevo recordatorio", en: "New reminder" },
  "automations.dialogTitleNew": { es: "Nuevo recordatorio", en: "New reminder" },
  "automations.dialogTitleEdit": { es: "Editar recordatorio", en: "Edit reminder" },
  "automations.name": { es: "Nombre", en: "Name" },
  "automations.namePlaceholder": { es: "Ej: Revisar gastos del lunes", en: "E.g. Monday expense check-in" },
  "automations.triggerType": { es: "Disparador", en: "Trigger" },
  "automations.triggerSchedule": { es: "Recordatorio programado", en: "Scheduled reminder" },
  "automations.triggerScheduleDesc": { es: "A una hora fija, a diario o un día concreto.", en: "At a fixed time, daily or on a specific day." },
  "automations.triggerCondition": { es: "Alerta por condición", en: "Condition alert" },
  "automations.triggerConditionDesc": { es: "Cuando algo en tu Economía cruce un umbral.", en: "When something in your finances crosses a threshold." },
  "automations.frequency": { es: "Frecuencia", en: "Frequency" },
  "automations.time": { es: "Hora", en: "Time" },
  "automations.weekday": { es: "Día", en: "Day" },
  "automations.metric": { es: "Métrica", en: "Metric" },
  "automations.metric.weekly_savings": { es: "Ahorro semanal", en: "Weekly savings" },
  "automations.metric.monthly_expenses": { es: "Gasto total del mes", en: "Total monthly expenses" },
  "automations.metric.category_monthly_expenses": { es: "Gasto del mes en una categoría", en: "Monthly expenses in a category" },
  "automations.operator": { es: "Condición", en: "Condition" },
  "automations.operator.lt": { es: "es menor que", en: "is less than" },
  "automations.operator.lte": { es: "es menor o igual que", en: "is less than or equal to" },
  "automations.operator.gt": { es: "es mayor que", en: "is greater than" },
  "automations.operator.gte": { es: "es mayor o igual que", en: "is greater than or equal to" },
  "automations.value": { es: "Valor", en: "Value" },
  "automations.category": { es: "Categoría", en: "Category" },
  "automations.cooldown": { es: "No repetir antes de (horas)", en: "Don't repeat within (hours)" },
  "automations.cooldownHint": {
    es: "Mientras la condición se mantenga cierta, no se volverá a avisar hasta que pasen estas horas desde el último aviso.",
    en: "While the condition stays true, you won't be notified again until this many hours have passed since the last alert.",
  },
  "automations.actionType": { es: "Acción", en: "Action" },
  "automations.actionPush": { es: "Notificación", en: "Notification" },
  "automations.actionPopup": { es: "Pop-up en la app", en: "In-app pop-up" },
  "automations.actionBoth": { es: "Ambas", en: "Both" },
  "automations.messageTitle": { es: "Título del aviso", en: "Alert title" },
  "automations.messageTitlePlaceholder": { es: "Ej: Revisa tus gastos", en: "E.g. Check your expenses" },
  "automations.messageBody": { es: "Mensaje", en: "Message" },
  "automations.messageBodyPlaceholder": { es: "Ej: Han pasado 7 días, échale un ojo a la Economía.", en: "E.g. It's been a week — take a look at your finances." },
  "automations.save": { es: "Guardar recordatorio", en: "Save reminder" },
  "automations.testNow": { es: "Probar ahora", en: "Test now" },
  "automations.testSent": { es: "Enviada.", en: "Sent." },
  "automations.active": { es: "Activa", en: "Active" },
  "automations.paused": { es: "Pausada", en: "Paused" },
  "automations.lastTriggered": { es: "Último aviso: {date}", en: "Last fired: {date}" },
  "automations.neverTriggered": { es: "Todavía no se ha disparado", en: "Hasn't fired yet" },
  "automations.scheduleSummaryDaily": { es: "Cada día a las {time}", en: "Every day at {time}" },
  "automations.scheduleSummaryWeekly": { es: "Cada {weekday} a las {time}", en: "Every {weekday} at {time}" },
  "automations.conditionSummary": { es: "{metric} {operator} {value}", en: "{metric} {operator} {value}" },
  "automations.cronNote": {
    es: "Las alertas y recordatorios se revisan cada hora en el servidor. Si acabas de crear uno, puede tardar hasta esa hora en dispararse por primera vez — usa \"Probar ahora\" para verlo al momento.",
    en: "Alerts and reminders are checked hourly on the server. A newly created one may take up to an hour to fire for the first time — use \"Test now\" to see it right away.",
  },

  // Pantalla /quick-confirm: la que abre el atajo de Tap to Pay (y el atajo
  // manual) en Safari, sin sesión iniciada — por eso su idioma no sale de
  // Ajustes (data.language) como el resto de la app, sino del idioma del
  // propio teléfono (navigator.language), que es lo único disponible ahí.
  "quickConfirm.appName": { es: "ZentOS", en: "ZentOS" },
  "quickConfirm.title": { es: "Nuevo movimiento", en: "New transaction" },
  "quickConfirm.saved": { es: "Guardado", en: "Saved" },
  "quickConfirm.saveButton": { es: "Guardar", en: "Save" },
  "quickConfirm.invalidAmount": { es: "Escribe una cantidad válida", en: "Enter a valid amount" },
  "quickConfirm.missingToken": {
    es: "Falta el código en el enlace. Ábrelo desde el atajo o cópialo de nuevo desde Ajustes.",
    en: "The link is missing its code. Open it from the shortcut or copy it again from Settings.",
  },
  "quickConfirm.invalidToken": {
    es: "Ese código ya no es válido. Genera uno nuevo en Ajustes → Atajo rápido.",
    en: "That code is no longer valid. Generate a new one in Settings → Quick Shortcut.",
  },
  "quickConfirm.genericError": { es: "No se pudo guardar. Inténtalo otra vez.", en: "Couldn't save. Try again." },
  "quickConfirm.noConnection": { es: "Sin conexión. Inténtalo otra vez.", en: "No connection. Try again." },
  "quickConfirm.loading": { es: "Cargando...", en: "Loading..." },

  // Títulos de la notificación push de confirmación al guardar un
  // movimiento por /api/quick-transaction (atajo manual, Tap to Pay vía
  // /quick-confirm, o detección 100% silenciosa) — se elige el idioma
  // según la preferencia guardada del usuario (sí hay sesión resuelta ahí,
  // vía el token), a diferencia de /quick-confirm. "Detectado" se usa solo
  // cuando el importe salió de leer el texto de una notificación sola
  // (nadie tocó nada); "Guardado" para cuando sí hubo una acción explícita
  // (atajo manual o pantalla de Tap to Pay).
  "push.expenseDetected": { es: "Gasto detectado", en: "Expense detected" },
  "push.expenseSaved": { es: "Gasto guardado", en: "Expense saved" },

  // Notificación de prueba (botón "Enviar prueba" en Ajustes → Recordatorios,
  // ver app/api/push/test/route.ts). Antes iba con el texto en español fijo
  // en el propio código del servidor, así que a alguien con la app en inglés
  // le llegaba igualmente en español — ahora se traduce igual que el resto
  // de notificaciones push, según el idioma guardado en Ajustes.
  "push.testBody": {
    es: "Esto es una notificación de prueba. Si la ves, ¡ya funciona! 🎉",
    en: "This is a test notification. If you see it, it's working! 🎉",
  },
} as const satisfies Record<string, Entry>

export type TranslationKey = keyof typeof TRANSLATIONS

// Sustituye {placeholder} en la plantilla del idioma elegido por los
// valores de `params`. Si falta la clave, se devuelve la propia clave (más
// fácil de detectar en pantalla que un texto vacío o un crash).
export function translate(
  key: TranslationKey,
  lang: Language,
  params?: Record<string, string | number>,
): string {
  const entry = TRANSLATIONS[key]
  const template = entry ? entry[lang] : key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(params[name] ?? ""))
}

// Etiqueta traducida de una categoría de transacción. El valor almacenado
// (el que se compara al filtrar, agrupar o mandar por el atajo) sigue
// siendo siempre el español — esto solo cambia lo que se pinta en pantalla.
export function categoryLabel(category: string, lang: Language): string {
  const key = `category.${category}` as TranslationKey
  const entry = (TRANSLATIONS as Record<string, Entry | undefined>)[key]
  return entry ? entry[lang] : category
}

export function weekdayLabel(dayIndex: number, lang: Language): string {
  const key = `weekday.${dayIndex}` as TranslationKey
  const entry = (TRANSLATIONS as Record<string, Entry | undefined>)[key]
  return entry ? entry[lang] : String(dayIndex)
}
