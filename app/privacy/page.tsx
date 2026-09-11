import Link from "next/link"
import { ArrowLeft } from "lucide-react"

// Página estática de política de privacidad, enlazada desde el pie de
// Ajustes (ver components/sections/settings-section.tsx). No pasa por el
// sistema de traducción (lib/i18n.ts) porque es texto legal largo, no una
// etiqueta de interfaz — igual que el resto de la app, en español.
//
// Última actualización: cuando cambie algo de lo que se cuenta aquí (p.ej.
// una nueva integración que mande datos a un tercero), hay que actualizar
// tanto esta fecha como el contenido correspondiente más abajo.
const LAST_UPDATED = "11 de septiembre de 2026"

export const metadata = {
  title: "Política de privacidad · ZentOS",
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 text-foreground">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a ZentOS
      </Link>

      <h1 className="text-2xl font-bold">Política de privacidad</h1>
      <p className="mt-1 text-xs text-muted-foreground">Última actualización: {LAST_UPDATED}</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <p>
            ZentOS es una app personal de finanzas hecha para un grupo pequeño y cerrado de personas invitadas
            directamente — no es un producto comercial ni está abierta a registro público. Aun así, esta página
            explica con claridad qué datos guarda la app, dónde se guardan y quién más los ve, para que quien la
            use lo sepa sin tener que leer el código.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Qué datos guarda ZentOS</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><strong>Cuenta:</strong> tu email, usado solo para iniciar sesión (autenticación de Supabase).</li>
            <li><strong>Transacciones:</strong> fecha, descripción, categoría, importe y divisa de cada gasto o ingreso que registras, ya sea a mano, por lote, por el atajo de iPhone o importando un CSV.</li>
            <li><strong>Gastos e ingresos recurrentes:</strong> las plantillas que configures (alquiler, nómina, suscripciones...) y su frecuencia.</li>
            <li><strong>Preferencias:</strong> divisa principal, idioma, modo viaje, día de inicio de semana.</li>
            <li><strong>Recordatorios/automatizaciones:</strong> las reglas que crees y el historial de avisos que han disparado.</li>
            <li><strong>Notificaciones push:</strong> si las activas, se guarda la suscripción de tu navegador (un identificador técnico) necesaria para poder enviártelas.</li>
            <li><strong>Feedback:</strong> los mensajes que envíes desde Ajustes → Enviar feedback.</li>
            <li><strong>Token del atajo rápido:</strong> un código (guardado de forma cifrada, no en texto plano) que autentica el Atajo de iPhone contigo mismo.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">Dónde vive todo esto</h2>
          <p className="mt-2">
            Todos estos datos se guardan en Supabase (base de datos), con la aplicación desplegada en Vercel. El
            acceso a tus propios datos está restringido por usuario (Row Level Security de Supabase): nadie más que
            tú puede leer tus transacciones a través de la app.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Cuándo tus datos salen a un tercero</h2>
          <p className="mt-2">Fuera de Supabase/Vercel, hay tres sitios puntuales donde algo sale de la app:</p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Importar CSV (Economía):</strong> cuando subes un extracto bancario para importarlo, el
              contenido completo del archivo (fechas, importes y descripciones de tus movimientos) se envía a la
              API de Gemini (Google) para detectar el formato del banco y devolver los movimientos ya
              normalizados. Es el único punto de la app donde el contenido real de tus datos financieros se manda
              a una IA externa — se hace porque es la única forma práctica de soportar el extracto de cualquier
              banco sin programar un lector a mano para cada uno.
            </li>
            <li>
              <strong>Categorización automática de notificaciones:</strong> cuando el atajo de "detección
              automática" (iOS 27) no reconoce el comercio por palabras clave, el texto de esa notificación
              puntual se manda también a Gemini para sugerir la categoría — nunca tu historial completo, solo ese
              texto suelto.
            </li>
            <li>
              <strong>Respaldo en Google Sheets:</strong> cada transacción nueva se reenvía también, en segundo
              plano, a una hoja de Google Sheets de respaldo (heredada de cuando la app era de un solo usuario).
              Si falla, no bloquea nada — Supabase sigue siendo donde vive realmente tu información.
            </li>
          </ul>
          <p className="mt-2">
            Con esas tres excepciones, nadie construyendo o manteniendo la app —incluida cualquier IA usada para
            programar sus funciones— lee ni analiza el contenido real de tus transacciones o ingresos.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Datos de actividad física (opcional)</h2>
          <p className="mt-2">
            Si tienes conectada tu cuenta de Intervals.icu, la app también puede mostrar pasos, sueño y actividades
            recientes traídos de esa integración. Ese dato se lee para mostrártelo en la app; no se comparte con
            nadie más.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Qué no hace ZentOS</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>No vende ni comparte tus datos con terceros para publicidad.</li>
            <li>No pide ni guarda credenciales de tu banco — el import de CSV se hace subiendo un archivo, nunca conectando una cuenta bancaria.</li>
            <li>No usa tus datos para entrenar ningún modelo de IA.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">Borrar tus datos</h2>
          <p className="mt-2">
            Si en algún momento quieres que se borren tus datos de la app, pídeselo directamente a quien te dio de
            alta — al ser una app de uso personal/familiar sin panel de autoservicio, el borrado se hace a mano en
            Supabase.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Cambios en esta política</h2>
          <p className="mt-2">
            Si se añade una integración nueva que cambie qué datos salen de la app (como pasó al añadir el import
            de CSV con IA), esta página se actualiza para reflejarlo, junto con la fecha de arriba.
          </p>
        </section>
      </div>
    </main>
  )
}
