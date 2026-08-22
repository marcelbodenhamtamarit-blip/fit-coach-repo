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
  "overview.goalPlaceholder": { es: "¿Cuánto quieres ahorrar?", en: "How much do you want to save?" },
  "overview.goalReached": { es: "¡Objetivo conseguido!", en: "Goal reached!" },

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
    es: "Un Shortcut de Apple que pide la cantidad, el tipo y la categoría a mano y los guarda directo en tu cuenta. Instálalo con un toque — la primera vez te pedirá tu código personal (lo tienes debajo) y lo recordará para siempre en este dispositivo.",
    en: "An Apple Shortcut that asks for the amount, type and category by hand and saves them straight to your account. Install it with one tap — the first time it'll ask for your personal code (you have it below) and remember it on this device from then on.",
  },
  "settings.preparing": { es: "Preparando tus datos...", en: "Preparing your data..." },
  "settings.installShortcut": { es: "Instalar atajo (un toque)", en: "Install shortcut (one tap)" },
  "settings.apiUrl": { es: "URL de la API", en: "API URL" },
  "settings.copyUrl": { es: "Copiar URL", en: "Copy URL" },
  "settings.yourCode": { es: "Tu código personal", en: "Your personal code" },
  "settings.copyCode": { es: "Copiar código", en: "Copy code" },
  "settings.regenCode": { es: "Regenerar código", en: "Regenerate code" },
  "settings.regenHint": {
    es: "Al instalarlo te pedirá pegar el código de arriba, solo la primera vez. Si crees que alguien más tiene tu código, regenéralo aquí — tendrás que abrir el atajo en la app Atajos, borrar el código guardado dentro (o reinstalarlo) y pegar el nuevo para que vuelva a funcionar en tu dispositivo.",
    en: "When you install it, it'll ask you to paste the code above, just the first time. If you think someone else has your code, regenerate it here — you'll need to open the shortcut in the Shortcuts app, delete the code saved inside (or reinstall it) and paste the new one so it works again on your device.",
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
    es: 'Añade la acción Preguntar (busca "preguntar" o "ask"): tipo Número, pregunta "¿Cuánto? (AUD)".',
    en: 'Add the Ask action (search "ask"): type Number, question "How much?".',
  },
  "settings.manualStep3": {
    es: 'Añade Elegir de un menú ("choose from menu"): pregunta "¿Gasto o ingreso?", con opciones Gasto e Ingreso. Dentro de cada opción añade la acción Texto con "gasto" o "ingreso" (en minúscula) respectivamente.',
    en: 'Add Choose from Menu: question "Expense or income?", with options Expense and Income. Inside each option add a Text action with "gasto" or "ingreso" (lowercase) respectively — the app matches these exact words.',
  },
  "settings.manualStep4": {
    es: 'Añade otro Elegir de un menú: pregunta "Categoría", con estas {count} opciones: {categories}. Dentro de cada opción, un Texto con ese mismo nombre.',
    en: 'Add another Choose from Menu: question "Category", with these {count} options: {categories}. Inside each option, add a Text action with that exact name (in Spanish — the app matches these exact words).',
  },
  "settings.manualStep5": {
    es: "Añade Obtener contenido de URL: método GET, URL = la de arriba (pégala). Toca Mostrar más → añade estos parámetros de consulta: token (pega tu código), amount (variable del paso 2), type (resultado del menú del paso 3) y category (resultado del menú del paso 4).",
    en: "Add Get Contents of URL: method GET, URL = the one above (paste it). Tap Show More → add these query parameters: token (paste your code), amount (variable from step 2), type (menu result from step 3) and category (menu result from step 4).",
  },
  "settings.manualStep6": {
    es: 'Añade Mostrar notificación: título "ZentOS", texto "Movimiento guardado". Guarda el atajo.',
    en: 'Add Show Notification: title "ZentOS", text "Transaction saved". Save the shortcut.',
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
