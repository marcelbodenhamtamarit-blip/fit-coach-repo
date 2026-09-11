import Link from "next/link"
import { ArrowLeft } from "lucide-react"

// Página estática de términos de uso, enlazada desde el pie de Ajustes (ver
// components/sections/settings-section.tsx). No pasa por el sistema de
// traducción (lib/i18n.ts) porque es texto legal largo, no una etiqueta de
// interfaz — igual que el resto de la app, en español.
const LAST_UPDATED = "11 de septiembre de 2026"

export const metadata = {
  title: "Términos de uso · ZentOS",
}

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 text-foreground">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a ZentOS
      </Link>

      <h1 className="text-2xl font-bold">Términos de uso</h1>
      <p className="mt-1 text-xs text-muted-foreground">Última actualización: {LAST_UPDATED}</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <p>
            ZentOS es una app personal hecha para un grupo pequeño y cerrado de personas invitadas directamente por
            quien la mantiene — no es un producto comercial, no tiene registro abierto al público y no se ofrece con
            ninguna garantía. Estos términos son deliberadamente breves porque reflejan ese uso real: entre conocidos,
            sin contrato de por medio.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Qué es esto</h2>
          <p className="mt-2">
            ZentOS ayuda a llevar el control de gastos e ingresos personales (y, opcionalmente, mostrar datos de
            actividad física si conectas Intervals.icu). El acceso se concede de forma manual, invitación por
            invitación — no hay forma de darse de alta uno mismo.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Uso aceptable</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>La cuenta es personal e intransferible: no compartas tu acceso con quien no haya sido invitado.</li>
            <li>No introduzcas datos de terceros sin su consentimiento (por ejemplo, movimientos bancarios de otra persona).</li>
            <li>No intentes acceder a datos de otro usuario ni forzar los límites técnicos de la app (Row Level Security, autenticación, límites de las funciones serverless).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">Sin garantías</h2>
          <p className="mt-2">
            ZentOS se ofrece "tal cual", mantenida en tiempo libre. No se garantiza disponibilidad continua, ausencia
            de errores, ni que los cálculos (balances, categorías, importación de CSV) sean siempre exactos —
            especialmente en la función de importar CSV con IA, que puede clasificar mal una transacción o no
            reconocer un formato de extracto. Revisa siempre lo importado antes de darlo por bueno para decisiones
            importantes. No se recomienda usar ZentOS como única fuente de verdad para trámites fiscales, legales o
            contables.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Datos y privacidad</h2>
          <p className="mt-2">
            Qué datos se guardan y cuándo salen a un tercero (incluida la importación de CSV vía Gemini) está descrito
            en la{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              política de privacidad
            </Link>
            . Al usar la app aceptas ese tratamiento de datos.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Cambios y baja</h2>
          <p className="mt-2">
            La app puede cambiar, añadir o quitar funciones en cualquier momento sin aviso previo, incluida esta
            página. El acceso puede revocarse en cualquier momento por quien administra la app. Si quieres dejar de
            usarla y que se borren tus datos, pídeselo directamente a quien te dio de alta.
          </p>
        </section>
      </div>
    </main>
  )
}
