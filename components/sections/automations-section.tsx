"use client"

// Pantalla "Automatizaciones": reglas tipo Atajos de Apple (disparador +
// acción) que el usuario crea y gestiona él mismo. Dos piezas:
//   1. Tarjeta de notificaciones push (activar/desactivar/probar en este
//      dispositivo).
//   2. Lista de automatizaciones, con un diálogo para crear/editar.
//
// El envío real (push del sistema, o el marcado de "toca revisar" para el
// pop-up) lo hace el worker de servidor (app/api/automations/evaluate),
// llamado por un cron cada hora — ver vercel.json y el README.

import { useEffect, useState, type ReactNode } from "react"
import {
  Bell,
  BellRing,
  Clock,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useStore } from "@/lib/store"
import { useAutomations } from "@/lib/automations-store"
import { supabase } from "@/lib/supabase"
import {
  isPushSupported,
  getNotificationPermission,
  isCurrentlySubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push"
import {
  TRANSACTION_CATEGORIES,
  CONDITION_METRICS,
  CONDITION_OPERATORS,
  AUTOMATION_ACTION_TYPES,
  SCHEDULE_FREQUENCIES,
  type Automation,
  type AutomationActionType,
  type AutomationTriggerType,
  type ConditionMetric,
  type ConditionOperator,
  type ScheduleFrequency,
} from "@/lib/types"
import { categoryLabel, weekdayLabel, type Language, type TranslationKey } from "@/lib/i18n"

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export function AutomationsSection() {
  const { t } = useStore()
  const { automations, ready } = useAutomations()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">{t("automations.subtitle")}</p>
      </div>

      <PushCard />

      <Card className="p-6">
        <div className="mb-1 flex items-center gap-2">
          <Zap className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">{t("nav.automations")}</h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">{t("automations.cronNote")}</p>

        {!ready ? (
          <p className="text-xs text-muted-foreground">{t("common.loadingData")}</p>
        ) : automations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Sparkles className="mx-auto mb-2 size-5 text-muted-foreground" />
            <p className="text-sm font-medium">{t("automations.empty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("automations.emptyHint")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {automations.map((a) => (
              <AutomationRow key={a.id} automation={a} />
            ))}
          </div>
        )}

        <AutomationFormDialog
          triggerVariant="outline"
          triggerClassName="mt-4 w-full"
          triggerLabel={
            <>
              <Plus className="size-4" />
              {t("automations.addNew")}
            </>
          }
        />
      </Card>
    </div>
  )
}

// ---------- Notificaciones push ----------

function PushCard() {
  const { t } = useStore()
  const [supported, setSupported] = useState(true)
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [testSent, setTestSent] = useState(false)

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  const refresh = async () => {
    setSupported(isPushSupported())
    setPermission(getNotificationPermission())
    setSubscribed(await isCurrentlySubscribed())
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleEnable() {
    if (!vapidKey) {
      setError("Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY (ver README).")
      return
    }
    setBusy(true)
    setError("")
    const result = await subscribeToPush(vapidKey)
    setBusy(false)
    if (!result.ok) {
      setError(result.reason === "denied" ? t("automations.pushDenied") : t("automations.pushUnsupported"))
    }
    await refresh()
  }

  async function handleDisable() {
    setBusy(true)
    await unsubscribeFromPush()
    setBusy(false)
    await refresh()
  }

  async function handleTest() {
    setBusy(true)
    setTestSent(false)
    const token = await getAccessToken()
    if (token) {
      await fetch("/api/push/test", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      setTestSent(true)
      setTimeout(() => setTestSent(false), 3000)
    }
    setBusy(false)
  }

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        {subscribed ? <BellRing className="size-4 text-primary" /> : <Bell className="size-4 text-primary" />}
        <h3 className="text-sm font-semibold">{t("automations.pushCardTitle")}</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {subscribed ? t("automations.pushCardDescOn") : t("automations.pushCardDescOff")}
      </p>

      {!supported ? (
        <p className="text-xs text-amber-500">{t("automations.pushUnsupported")}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {subscribed ? (
            <Button variant="outline" size="sm" onClick={handleDisable} disabled={busy}>
              {t("automations.pushDisable")}
            </Button>
          ) : (
            <Button size="sm" onClick={handleEnable} disabled={busy}>
              {t("automations.pushEnable")}
            </Button>
          )}
          {subscribed && (
            <Button variant="outline" size="sm" onClick={handleTest} disabled={busy}>
              {t("automations.pushTest")}
            </Button>
          )}
          {testSent && <span className="text-xs text-emerald-500">{t("automations.pushTestSent")}</span>}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      {permission === "denied" && <p className="mt-2 text-xs text-red-500">{t("automations.pushDenied")}</p>}
    </Card>
  )
}

// ---------- Fila de una automatización ----------

function AutomationRow({ automation }: { automation: Automation }) {
  const { data, t } = useStore()
  const { toggleAutomation, deleteAutomation } = useAutomations()
  const lang = (data.language as Language) ?? "es"
  const [testing, setTesting] = useState(false)
  const [tested, setTested] = useState(false)

  async function handleTestNow() {
    setTesting(true)
    setTested(false)
    const token = await getAccessToken()
    if (token) {
      await fetch(`/api/automations/evaluate?automationId=${automation.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      setTested(true)
      setTimeout(() => setTested(false), 3000)
    }
    setTesting(false)
  }

  const summary =
    automation.triggerType === "schedule"
      ? automation.scheduleFrequency === "weekly"
        ? t("automations.scheduleSummaryWeekly", {
            weekday: weekdayLabel(automation.scheduleWeekday ?? 0, lang),
            time: automation.scheduleTime ?? "",
          })
        : t("automations.scheduleSummaryDaily", { time: automation.scheduleTime ?? "" })
      : t("automations.conditionSummary", {
          metric: automation.conditionMetric
            ? t(`automations.metric.${automation.conditionMetric}` as TranslationKey)
            : "",
          operator: automation.conditionOperator
            ? t(`automations.operator.${automation.conditionOperator}` as TranslationKey)
            : "",
          value: automation.conditionValue ?? "",
        })

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        {automation.triggerType === "schedule" ? <Clock className="size-4" /> : <Zap className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{automation.name}</p>
          <button
            type="button"
            role="switch"
            aria-checked={automation.active}
            onClick={() => toggleAutomation(automation.id, !automation.active)}
            className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
              automation.active ? "justify-end bg-primary" : "justify-start bg-muted"
            }`}
          >
            <span className="size-4 rounded-full bg-white shadow" />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {automation.lastTriggeredAt
            ? t("automations.lastTriggered", { date: new Date(automation.lastTriggeredAt).toLocaleString(lang) })
            : t("automations.neverTriggered")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AutomationFormDialog
            automation={automation}
            triggerVariant="outline"
            triggerSize="xs"
            triggerLabel={t("common.edit")}
          />
          <Button variant="outline" size="xs" onClick={handleTestNow} disabled={testing}>
            {t("automations.testNow")}
          </Button>
          {tested && <span className="text-[11px] text-emerald-500">{t("automations.testSent")}</span>}
          <Button
            variant="ghost"
            size="icon-xs"
            className="ml-auto text-muted-foreground"
            onClick={() => deleteAutomation(automation.id)}
            aria-label={t("common.delete")}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------- Diálogo de creación/edición ----------

function AutomationFormDialog({
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
  triggerClassName,
  automation,
}: {
  triggerLabel: ReactNode
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  triggerSize?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"
  triggerClassName?: string
  automation?: Automation
}) {
  const { data, t } = useStore()
  const { addAutomation, updateAutomation } = useAutomations()
  const lang = (data.language as Language) ?? "es"
  const isEdit = !!automation

  const [open, setOpen] = useState(false)
  const [name, setName] = useState(automation?.name ?? "")
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(automation?.triggerType ?? "schedule")
  const [scheduleFrequency, setScheduleFrequency] = useState<ScheduleFrequency>(automation?.scheduleFrequency ?? "daily")
  const [scheduleTime, setScheduleTime] = useState(automation?.scheduleTime ?? "09:00")
  const [scheduleWeekday, setScheduleWeekday] = useState(automation?.scheduleWeekday ?? 1)
  const [conditionMetric, setConditionMetric] = useState<ConditionMetric>(automation?.conditionMetric ?? "weekly_savings")
  const [conditionOperator, setConditionOperator] = useState<ConditionOperator>(automation?.conditionOperator ?? "lt")
  const [conditionValue, setConditionValue] = useState(String(automation?.conditionValue ?? ""))
  const [conditionCategory, setConditionCategory] = useState<string>(automation?.conditionCategory ?? TRANSACTION_CATEGORIES[0])
  const [cooldownHours, setCooldownHours] = useState(String(automation?.conditionCooldownHours ?? 24))
  const [actionType, setActionType] = useState<AutomationActionType>(automation?.actionType ?? "both")
  const [messageTitle, setMessageTitle] = useState(automation?.messageTitle ?? "")
  const [messageBody, setMessageBody] = useState(automation?.messageBody ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim() || !messageTitle.trim() || !messageBody.trim()) return
    setSaving(true)

    const payload = {
      name: name.trim(),
      active: automation?.active ?? true,
      triggerType,
      scheduleFrequency: triggerType === "schedule" ? scheduleFrequency : null,
      scheduleTime: triggerType === "schedule" ? scheduleTime : null,
      scheduleWeekday: triggerType === "schedule" && scheduleFrequency === "weekly" ? scheduleWeekday : null,
      conditionMetric: triggerType === "condition" ? conditionMetric : null,
      conditionOperator: triggerType === "condition" ? conditionOperator : null,
      conditionValue: triggerType === "condition" ? parseFloat(conditionValue) || 0 : null,
      conditionCategory: triggerType === "condition" && conditionMetric === "category_monthly_expenses" ? (conditionCategory as Automation["conditionCategory"]) : null,
      conditionCooldownHours: triggerType === "condition" ? parseInt(cooldownHours, 10) || 24 : 24,
      actionType,
      messageTitle: messageTitle.trim(),
      messageBody: messageBody.trim(),
    }

    if (isEdit && automation) {
      await updateAutomation(automation.id, payload)
    } else {
      await addAutomation(payload)
    }

    setSaving(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} className={triggerClassName} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("automations.dialogTitleEdit") : t("automations.dialogTitleNew")}</DialogTitle>
          <DialogDescription>{t("automations.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.name")}</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("automations.namePlaceholder")} />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.triggerType")}</p>
            <div className="grid grid-cols-2 gap-2">
              <TriggerTypeOption
                active={triggerType === "schedule"}
                title={t("automations.triggerSchedule")}
                desc={t("automations.triggerScheduleDesc")}
                icon={Clock}
                onClick={() => setTriggerType("schedule")}
              />
              <TriggerTypeOption
                active={triggerType === "condition"}
                title={t("automations.triggerCondition")}
                desc={t("automations.triggerConditionDesc")}
                icon={Zap}
                onClick={() => setTriggerType("condition")}
              />
            </div>
          </div>

          {triggerType === "schedule" ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.frequency")}</p>
                  <select
                    value={scheduleFrequency}
                    onChange={(e) => setScheduleFrequency(e.target.value as ScheduleFrequency)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none"
                  >
                    {SCHEDULE_FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {f === "daily" ? t("common.daily") : t("common.weekly")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.time")}</p>
                  <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </div>
              </div>
              {scheduleFrequency === "weekly" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.weekday")}</p>
                  <select
                    value={scheduleWeekday}
                    onChange={(e) => setScheduleWeekday(Number(e.target.value))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                      <option key={d} value={d}>
                        {weekdayLabel(d, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.metric")}</p>
                <select
                  value={conditionMetric}
                  onChange={(e) => setConditionMetric(e.target.value as ConditionMetric)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none"
                >
                  {CONDITION_METRICS.map((m) => (
                    <option key={m} value={m}>
                      {t(`automations.metric.${m}` as TranslationKey)}
                    </option>
                  ))}
                </select>
              </div>

              {conditionMetric === "category_monthly_expenses" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.category")}</p>
                  <select
                    value={conditionCategory}
                    onChange={(e) => setConditionCategory(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none"
                  >
                    {TRANSACTION_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel(c, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.operator")}</p>
                  <select
                    value={conditionOperator}
                    onChange={(e) => setConditionOperator(e.target.value as ConditionOperator)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none"
                  >
                    {CONDITION_OPERATORS.map((op) => (
                      <option key={op} value={op}>
                        {t(`automations.operator.${op}` as TranslationKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.value")}</p>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.cooldown")}</p>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={cooldownHours}
                  onChange={(e) => setCooldownHours(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">{t("automations.cooldownHint")}</p>
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.actionType")}</p>
            <div className="grid grid-cols-3 gap-2">
              {AUTOMATION_ACTION_TYPES.map((act) => (
                <button
                  key={act}
                  type="button"
                  onClick={() => setActionType(act)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    actionType === act ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {act === "push" ? t("automations.actionPush") : act === "popup" ? t("automations.actionPopup") : t("automations.actionBoth")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.messageTitle")}</p>
            <Input value={messageTitle} onChange={(e) => setMessageTitle(e.target.value)} placeholder={t("automations.messageTitlePlaceholder")} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("automations.messageBody")}</p>
            <Textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder={t("automations.messageBodyPlaceholder")}
              rows={3}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !messageTitle.trim() || !messageBody.trim()}
            className="w-full"
          >
            {t("automations.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TriggerTypeOption({
  active,
  title,
  desc,
  icon: Icon,
  onClick,
}: {
  active: boolean
  title: string
  desc: string
  icon: typeof Clock
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition-colors ${
        active ? "border-primary bg-primary/10" : "border-border"
      }`}
    >
      <Icon className={`mb-1 size-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <p className="text-xs font-semibold">{title}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
    </button>
  )
}
