"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const STORAGE_KEY = "intervals_settings"

export function SettingsSection() {
  const [athleteId, setAthleteId] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<{
    status: "success" | "error" | null
    message: string
  }>({ status: null, message: "" })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const { athleteId: id, apiKey: key } = JSON.parse(raw)
        if (id) setAthleteId(id)
        if (key) setApiKey(key)
      }
    } catch {}
  }, [])

  const handleSave = () => {
    if (!athleteId.trim() || !apiKey.trim()) {
      setTestResult({
        status: "error",
        message: "Por favor, rellena los dos campos.",
      })
      return
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ athleteId: athleteId.trim(), apiKey: apiKey.trim() }),
    )

    setSaved(true)
    setTestResult({ status: null, message: "" })
    setTimeout(() => setSaved(false), 3000)
  }

  const handleTest = async () => {
    if (!athleteId.trim() || !apiKey.trim()) {
      setTestResult({
        status: "error",
        message: "Por favor, rellena los dos campos primero.",
      })
      return
    }

    setTesting(true)
    setTestResult({ status: null, message: "" })

    try {
      const res = await fetch("/api/intervals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: athleteId.trim(),
          apiKey: apiKey.trim(),
        }),
      })

      const json = await res.json()

      if (res.ok) {
        const count = json.activities?.length ?? 0
        setTestResult({
          status: "success",
          message: `Conexión correcta. Se han encontrado ${count} actividad${count !== 1 ? "es" : ""} de running.`,
        })
      } else {
        setTestResult({
          status: "error",
          message: json.error || "La conexión ha fallado.",
        })
      }
    } catch {
      setTestResult({
        status: "error",
        message: "No se pudo conectar. Comprueba tu conexión a internet.",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Conexión con Intervals.icu</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Conecta tu cuenta de Intervals.icu para ver tus actividades de running, métricas de fitness y bienestar diario.
        </p>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="athlete-id">ID de atleta</Label>
            <Input
              id="athlete-id"
              placeholder="Ej: 1617361"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Está en la URL de tu perfil: intervals.icu/athletes/<strong>1617361</strong>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">Clave API</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Tu clave API de Intervals.icu"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Intervals.icu → Ajustes → Acceso API → Generar clave API
            </p>
          </div>

          {saved && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">Ajustes guardados correctamente.</span>
            </div>
          )}

          {testResult.status && (
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                testResult.status === "success"
                  ? "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                  : "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {testResult.status === "success" ? (
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSave} className="flex-1">
              Guardar
            </Button>
            <Button
              onClick={handleTest}
              disabled={testing}
              variant="outline"
              className="flex-1"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Probando...
                </>
              ) : (
                "Probar conexión"
              )}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-3 text-sm font-semibold">Cómo obtener tus credenciales</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">ID de atleta:</span> Ve a intervals.icu e inicia sesión. Tu ID aparece en la URL del perfil.
          </li>
          <li>
            <span className="font-medium text-foreground">Clave API:</span> Ve a Ajustes → Acceso API → haz clic en "Generar clave API".
          </li>
          <li>
            Introduce los dos valores en el formulario y haz clic en <span className="font-medium text-foreground">Guardar</span>.
          </li>
          <li>
            Usa <span className="font-medium text-foreground">Probar conexión</span> para verificar que todo funciona correctamente.
          </li>
        </ol>
      </Card>
    </div>
  )
}
