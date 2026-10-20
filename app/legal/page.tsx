"use client"

// Términos y Condiciones + Política de Privacidad de ZentOS.
//
// No es una página con sesión iniciada (se enlaza desde login-screen.tsx
// antes incluso de crear la cuenta), así que no puede leer el idioma
// guardado en Ajustes — igual que app/quick-confirm/page.tsx, adivina con
// navigator.language y deja un botón para cambiarlo a mano.
//
// Importante: esto es un documento sencillo y honesto sobre qué hace la
// app con tus datos, escrito por el propio desarrollador de un proyecto
// personal, NO un documento redactado o revisado por un abogado. Si en
// algún momento ZentOS se convierte en algo más que un proyecto personal
// (más usuarios, posible monetización, etc.), esto debería revisarlo
// alguien con formación legal.

import { useEffect, useState } from "react"

type Lang = "es" | "en"

function detectLang(): Lang {
  if (typeof navigator === "undefined") return "es"
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "es"
}

export default function LegalPage() {
  const [lang, setLang] = useState<Lang>("es")
  useEffect(() => setLang(detectLang()), [])

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-5 py-10 text-sm leading-relaxed text-foreground">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="ZentOS" className="size-8 rounded-lg" />
          <span className="text-base font-semibold">ZentOS</span>
        </div>
        <div className="flex gap-1 rounded-full border border-border bg-muted/40 p-0.5 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setLang("es")}
            className={`rounded-full px-2 py-0.5 ${lang === "es" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            ES
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`rounded-full px-2 py-0.5 ${lang === "en" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            EN
          </button>
        </div>
      </div>

      {lang === "es" ? <Spanish /> : <English />}
    </div>
  )
}

function Spanish() {
  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Términos de uso y Política de privacidad</h1>
        <p className="mt-1 text-xs text-muted-foreground">Última actualización: octubre de 2026</p>
      </header>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">Qué es ZentOS</h2>
        <p>
          ZentOS es un proyecto personal, construido y mantenido por una sola persona, no una empresa. Te ayuda a
          llevar el control de tus ingresos y gastos: puedes añadir movimientos a mano, importar extractos bancarios
          en CSV/PDF, o conectar un atajo de iOS que detecta pagos automáticamente desde las notificaciones de tu
          banco.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">Qué datos se guardan</h2>
        <p>Al crear una cuenta y usar la app, se guardan en una base de datos (Supabase, alojada en Australia):</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tu email y tu contraseña (la contraseña nunca se guarda en texto plano, la gestiona Supabase Auth).</li>
          <li>Los movimientos económicos que añadas o importes: fecha, importe, descripción, categoría y divisa.</li>
          <li>Tus preferencias (idioma, divisa, modo viaje) y, si los activas, los recordatorios/automatizaciones que configures.</li>
          <li>Si activas las notificaciones push, el identificador técnico de tu dispositivo para poder enviártelas.</li>
        </ul>
        <p>
          Si usas la detección automática por notificación bancaria, el texto de esa notificación (importe,
          comercio) se procesa para extraer el movimiento y, si la categorización automática por palabras clave no
          encuentra nada, se envía a la API de Gemini (Google) solo para sugerir una categoría — nunca se usa para
          entrenar modelos ni se comparte con nadie más.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">Quién puede ver tus datos</h2>
        <p>
          Solo tú. Cada cuenta está aislada mediante reglas de seguridad a nivel de base de datos (Row Level
          Security): ningún otro usuario de la app puede leer, editar ni borrar tus movimientos, aunque use la misma
          aplicación. Yo, como responsable del proyecto, tengo acceso técnico a la base de datos para mantenimiento,
          soporte o depuración de errores, pero no reviso ni uso tus datos para nada que no sea eso.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">Lo que esto NO es</h2>
        <p>
          ZentOS no es un banco, ni una entidad financiera, ni un servicio profesional de asesoría. No mueve dinero
          real ni se conecta directamente a tu banco: tú decides qué datos importar (CSV, PDF o notificaciones) y
          cuándo. Es un proyecto personal sin garantías de disponibilidad, exactitud o continuidad — puede tener
          errores, interrupciones, o dejar de existir en el futuro. No lo uses como única copia de tus registros
          financieros importantes.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">Tus derechos</h2>
        <p>
          Puedes pedir en cualquier momento que se borren tu cuenta y todos tus datos, o pedir una copia de lo que
          tenemos guardado, escribiendo a {" "}
          <a className="underline" href="mailto:marcelbodenhamtamarit@gmail.com">marcelbodenhamtamarit@gmail.com</a>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">Cambios</h2>
        <p>
          Estos términos pueden actualizarse si la app cambia. Los cambios importantes se avisarán dentro de la
          propia app cuando sea razonable hacerlo.
        </p>
      </section>
    </article>
  )
}

function English() {
  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Terms of use and Privacy Policy</h1>
        <p className="mt-1 text-xs text-muted-foreground">Last updated: October 2026</p>
      </header>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">What ZentOS is</h2>
        <p>
          ZentOS is a personal project, built and maintained by a single person, not a company. It helps you track
          your income and expenses: you can add transactions by hand, import bank statements as CSV/PDF, or connect
          an iOS Shortcut that detects payments automatically from your bank&apos;s notifications.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">What data is stored</h2>
        <p>When you create an account and use the app, the following is stored in a database (Supabase, hosted in Australia):</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your email and password (the password is never stored in plain text, it&apos;s handled by Supabase Auth).</li>
          <li>The transactions you add or import: date, amount, description, category and currency.</li>
          <li>Your preferences (language, currency, travel mode) and, if you set them up, any reminders/automations.</li>
          <li>If you enable push notifications, your device&apos;s technical identifier so they can be sent to you.</li>
        </ul>
        <p>
          If you use automatic detection from a bank notification, the text of that notification (amount, merchant)
          is processed to extract the transaction, and if keyword-based categorization finds nothing, it is sent to
          Google&apos;s Gemini API only to suggest a category — it is never used to train models or shared with
          anyone else.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">Who can see your data</h2>
        <p>
          Only you. Each account is isolated through database-level security rules (Row Level Security): no other
          user of the app can read, edit or delete your transactions, even on the same app. As the person running
          this project I have technical access to the database for maintenance, support or debugging, but I don&apos;t
          review or use your data for anything beyond that.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">What this is NOT</h2>
        <p>
          ZentOS is not a bank, a financial institution, or a professional advisory service. It doesn&apos;t move
          real money or connect directly to your bank: you choose what data to import (CSV, PDF or notifications)
          and when. It&apos;s a personal project with no guarantee of availability, accuracy or continuity — it may
          have bugs, downtime, or stop existing in the future. Don&apos;t rely on it as your only copy of important
          financial records.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">Your rights</h2>
        <p>
          You can ask at any time for your account and all your data to be deleted, or request a copy of what is
          stored, by writing to {" "}
          <a className="underline" href="mailto:marcelbodenhamtamarit@gmail.com">marcelbodenhamtamarit@gmail.com</a>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">Changes</h2>
        <p>
          These terms may be updated as the app changes. Significant changes will be announced inside the app when
          reasonably possible.
        </p>
      </section>
    </article>
  )
}
