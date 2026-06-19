"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle, Loader } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SettingsSection() {
  const [athleteId, setAthleteId] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    status: "success" | "error" | null
    message: string
  }>({ status: null, message: "" })
  const [saved, setSaved] = useState(false)

  // Load saved credentials from localStorage
  useState(() => {
    const saved = localStorage.getItem("intervals_settings")
    if (saved) {
      try {
        const { athleteId: id, apiKey: key } = JSON.parse(saved)
        setAthleteId(id)
        setApiKey(key)
      } catch {}
    }
  })

  const handleSave = () => {
    if (!athleteId || !apiKey) {
      setTestResult({
        status: "error",
        message: "Please fill in both fields",
      })
      return
    }

    localStorage.setItem(
      "intervals_settings",
      JSON.stringify({ athleteId, apiKey })
    )

    // Also set as environment variables via a hidden input trick
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleTestConnection = async () => {
    if (!athleteId || !apiKey) {
      setTestResult({
        status: "error",
        message: "Please fill in both fields first",
      })
      return
    }

    setTesting(true)
    setTestResult({ status: null, message: "" })

    try {
      const response = await fetch("/api/intervals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, apiKey }),
      })

      if (response.ok) {
        const data = await response.json()
        setTestResult({
          status: "success",
          message: `Connected successfully! Found ${data.workouts?.length || 0} activities.`,
        })
      } else {
        const error = await response.json()
        setTestResult({
          status: "error",
          message: error.error || "Connection failed",
        })
      }
    } catch (err) {
      setTestResult({
        status: "error",
        message: "Failed to connect. Check your credentials.",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="border border-border p-6">
        <h2 className="mb-1 text-lg font-semibold">Intervals.icu Connection</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Connect your Intervals.icu account to see your fitness data, activities, and metrics.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="athlete-id">Athlete ID</Label>
            <Input
              id="athlete-id"
              placeholder="Find this in your intervals.icu URL (example: 45554305)"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Go to intervals.icu → Your profile URL shows the ID (example: intervals.icu/athletes/45554305)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Get this from Settings → API Access in intervals.icu"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Go to intervals.icu → Settings → API Access → Generate API key
            </p>
          </div>

          {saved && (
            <Card className="border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2 text-green-900">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Settings saved successfully!</span>
              </div>
            </Card>
          )}

          {testResult.status && (
            <Card
              className={
                testResult.status === "success"
                  ? "border-green-200 bg-green-50 p-3"
                  : "border-red-200 bg-red-50 p-3"
              }
            >
              <div className={`flex items-start gap-2 ${testResult.status === "success" ? "text-green-900" : "text-red-900"}`}>
                {testResult.status === "success" ? (
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <span className="text-sm">{testResult.message}</span>
              </div>
            </Card>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSave} className="flex-1">
              Save Settings
            </Button>
            <Button
              onClick={handleTestConnection}
              disabled={testing}
              variant="outline"
              className="flex-1"
            >
              {testing ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border border-border p-6">
        <h3 className="mb-2 text-sm font-semibold">How to get your credentials</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>
            <strong>Athlete ID:</strong> Visit intervals.icu, check your profile URL. The number is your ID.
          </li>
          <li>
            <strong>API Key:</strong> Go to Settings → API Access → Generate a new API key.
          </li>
          <li>
            <strong>Save the credentials</strong> using the form above, then test the connection.
          </li>
          <li>
            Your data will appear automatically in the Fitness section after connecting.
          </li>
        </ol>
      </Card>
    </div>
  )
}
