"use client"

/**
 * AI Ops Phase 3 — digest settings card.
 *
 * Designed to live on `/settings/notifications` (anchor
 * `#ai-ops-digest`). Manages enable/disable, recipients, send
 * hour, priority threshold, categories, weekend skip, and exposes
 * "preview" + "send now" actions. Slack/Teams webhook fields are
 * gated behind an "Advanced delivery" disclosure so they don't add
 * visual noise in Phase 3.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Bot,
  Eye,
  History,
  Loader2,
  Mail,
  Send,
  Sparkles,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { cn } from "@/lib/utils"
import type { RecommendationCategory, RecommendationPriority } from "@/lib/ai-ops/types"

type DigestSettings = {
  enabled: boolean
  recipients: string[]
  sendHour: number
  timezone: string | null
  priorityThreshold: RecommendationPriority
  categories: RecommendationCategory[]
  /** Phase 4 — webhook URLs are masked once saved. */
  slackWebhookConfigured: boolean
  slackWebhookHint: string | null
  slackEnabled: boolean
  teamsWebhookConfigured: boolean
  teamsWebhookHint: string | null
  teamsEnabled: boolean
  skipWeekends: boolean
  lastSentAt: string | null
}

type SettingsResponse = {
  ok: boolean
  settings: DigestSettings
  categoryOptions?: RecommendationCategory[]
  priorityOptions?: RecommendationPriority[]
}

type DigestPatchPayload = {
  enabled?: boolean
  recipients?: string[]
  sendHour?: number
  priorityThreshold?: RecommendationPriority
  categories?: RecommendationCategory[]
  /** Phase 4 — write-only; the GET response only echoes the masked hint. */
  slackWebhookUrl?: string | null
  teamsWebhookUrl?: string | null
  slackEnabled?: boolean
  teamsEnabled?: boolean
  skipWeekends?: boolean
}

type RunRow = {
  id: string
  triggerKind: string
  status: string
  recipientCount: number
  itemsCount: number
  highCount: number
  summary: string | null
  errorMessage: string | null
  sentAt: string | null
  createdAt: string
  destinationsResult?: {
    email?: { status?: string }
    slack?: { status?: string }
    teams?: { status?: string }
  }
}

const PRIORITY_LABEL: Record<RecommendationPriority, string> = {
  high: "High only",
  medium: "Medium and above",
  low: "Everything (high · medium · low)",
}

const CATEGORY_LABEL: Record<RecommendationCategory, string> = {
  prospect: "Prospects",
  financial: "Financials",
  dispatch: "Dispatch",
  equipment: "Equipment",
  certificate: "Certificates",
  inventory: "Inventory",
  communications: "Communications",
  automation: "Automations",
  maintenance: "Maintenance",
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)

export function AiOpsDigestSettingsCard() {
  const { organizationId, status } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<DigestSettings | null>(null)
  const [categoryOptions, setCategoryOptions] = useState<RecommendationCategory[]>([])
  const [recipientDraft, setRecipientDraft] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [showAdvancedDelivery, setShowAdvancedDelivery] = useState(false)
  const [preview, setPreview] = useState<{
    subject: string
    html: string
    itemsCount: number
    highCount: number
  } | null>(null)
  const [runs, setRuns] = useState<RunRow[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const recipientInputRef = useRef<HTMLInputElement>(null)

  const canManage = Boolean(permissions.canManageWorkspaceSettings)

  const fetchSettings = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/digest/settings`,
        { cache: "no-store" },
      )
      const body = (await res.json()) as SettingsResponse & { error?: string; message?: string }
      if (!res.ok) throw new Error(body.message ?? body.error ?? "Failed to load settings.")
      setSettings(body.settings)
      setCategoryOptions(body.categoryOptions ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings.")
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  const fetchRuns = useCallback(async () => {
    if (!organizationId) return
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/digest/runs?limit=10`,
        { cache: "no-store" },
      )
      const body = (await res.json()) as { ok?: boolean; runs?: RunRow[] }
      if (body.ok && Array.isArray(body.runs)) setRuns(body.runs)
    } catch {
      /* ignore — history is best-effort */
    }
  }, [organizationId])

  useEffect(() => {
    if (status !== "ready" || !organizationId) return
    void fetchSettings()
    void fetchRuns()
  }, [status, organizationId, fetchSettings, fetchRuns])

  const patch = useCallback(
    async (next: DigestPatchPayload) => {
      if (!organizationId || !canManage) return
      setSaving(true)
      try {
        const body: Record<string, unknown> = {}
        if (next.enabled !== undefined) body.enabled = next.enabled
        if (next.recipients !== undefined) body.recipients = next.recipients
        if (next.sendHour !== undefined) body.sendHour = next.sendHour
        if (next.priorityThreshold !== undefined) body.priorityThreshold = next.priorityThreshold
        if (next.categories !== undefined) body.categories = next.categories
        if (next.slackWebhookUrl !== undefined) body.slackWebhookUrl = next.slackWebhookUrl
        if (next.teamsWebhookUrl !== undefined) body.teamsWebhookUrl = next.teamsWebhookUrl
        if (next.slackEnabled !== undefined) body.slackEnabled = next.slackEnabled
        if (next.teamsEnabled !== undefined) body.teamsEnabled = next.teamsEnabled
        if (next.skipWeekends !== undefined) body.skipWeekends = next.skipWeekends
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/digest/settings`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        )
        const j = (await res.json()) as SettingsResponse & { error?: string; message?: string }
        if (!res.ok) throw new Error(j.message ?? j.error ?? "Failed to save.")
        setSettings(j.settings)
      } catch (e) {
        toast({
          title: "Could not save digest settings",
          description: e instanceof Error ? e.message : undefined,
          variant: "destructive",
        })
      } finally {
        setSaving(false)
      }
    },
    [organizationId, canManage, toast],
  )

  function addRecipient() {
    if (!settings) return
    const value = recipientDraft.trim().toLowerCase()
    if (!value) return
    if (settings.recipients.includes(value)) {
      setRecipientDraft("")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast({ title: "That doesn't look like a valid email address.", variant: "destructive" })
      return
    }
    if (settings.recipients.length >= 20) {
      toast({ title: "Up to 20 recipients per digest.", variant: "destructive" })
      return
    }
    const recipients = [...settings.recipients, value]
    void patch({ recipients })
    setRecipientDraft("")
    recipientInputRef.current?.focus()
  }

  function removeRecipient(value: string) {
    if (!settings) return
    void patch({ recipients: settings.recipients.filter((r) => r !== value) })
  }

  function toggleCategory(cat: RecommendationCategory) {
    if (!settings) return
    const current = new Set(settings.categories)
    if (current.has(cat)) current.delete(cat)
    else current.add(cat)
    void patch({ categories: Array.from(current) })
  }

  async function loadPreview() {
    if (!organizationId) return
    setPreviewing(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/digest/preview`,
        { cache: "no-store" },
      )
      const body = (await res.json()) as {
        ok?: boolean
        preview?: {
          subject: string
          html: string
          itemsCount: number
          highCount: number
        } | null
        message?: string
      }
      if (!res.ok || !body.preview) {
        toast({ title: body.message ?? "Could not generate preview." })
        return
      }
      setPreview(body.preview)
    } finally {
      setPreviewing(false)
    }
  }

  async function sendNow() {
    if (!organizationId || !canManage) return
    setSending(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/digest/send`,
        { method: "POST" },
      )
      const body = (await res.json()) as {
        ok?: boolean
        status?: string
        message?: string
        error?: string
      }
      if (!res.ok) throw new Error(body.message ?? body.error ?? "Send failed.")
      toast({
        title:
          body.status === "sent"
            ? "Digest sent."
            : body.status === "no_recipients"
              ? "Add staff recipients first."
              : body.status === "no_items"
                ? "Nothing urgent to send."
                : "Digest queued.",
        description: body.message ?? undefined,
      })
      void fetchRuns()
      void fetchSettings()
    } catch (e) {
      toast({
        title: "Could not send digest",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const sendHourLabel = useMemo(() => {
    if (!settings) return ""
    return `${String(settings.sendHour).padStart(2, "0")}:00`
  }, [settings])

  if (!permissions.canViewInsights) {
    return null
  }

  return (
    <section
      id="ai-ops-digest"
      className="bg-card border border-border rounded-lg overflow-hidden"
    >
      <header className="px-6 py-4 border-b border-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-7 w-7 rounded-lg border border-violet-500/30 bg-violet-500/[0.10] flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
            </span>
            <h3 className="text-sm font-semibold text-foreground">AI Operations daily digest</h3>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide gap-1">
              <Bot className="h-3 w-3" aria-hidden /> Internal only
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-snug max-w-2xl">
            A morning email summary of the highest-priority recommendations from AI Operations.
            Internal-only — never sent to customers.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
          <button
            type="button"
            role="switch"
            aria-checked={settings?.enabled ?? false}
            onClick={() => settings && void patch({ enabled: !settings.enabled })}
            disabled={!canManage || loading || !settings}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50",
              settings?.enabled ? "bg-primary" : "bg-border",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform",
                settings?.enabled ? "translate-x-4" : "translate-x-0",
              )}
            />
          </button>
        </div>
      </header>

      <div className="px-6 py-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : settings ? (
          <>
            {!canManage ? (
              <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border bg-muted/30 px-3 py-2">
                Read-only — only owners, admins, and managers can edit digest settings.
              </p>
            ) : null}

            {/* Recipients */}
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Internal recipients</Label>
              <p className="text-[11px] text-muted-foreground mb-2 leading-snug">
                Staff emails only. Add the people who should triage AI Ops every morning.
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {settings.recipients.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">
                    No recipients configured.
                  </span>
                ) : (
                  settings.recipients.map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-2 pr-1 py-0.5 text-[11px]"
                    >
                      <Mail className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
                      {r}
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => removeRecipient(r)}
                          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                          aria-label={`Remove ${r}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      ) : null}
                    </span>
                  ))
                )}
              </div>
              {canManage ? (
                <div className="flex items-center gap-2">
                  <Input
                    ref={recipientInputRef}
                    type="email"
                    placeholder="ops@yourcompany.com"
                    value={recipientDraft}
                    onChange={(e) => setRecipientDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addRecipient()
                      }
                    }}
                    className="h-8 text-xs max-w-[24rem]"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addRecipient} className="h-8">
                    Add
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Schedule + threshold */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">Send at (workspace local time)</Label>
                <Select
                  value={String(settings.sendHour)}
                  onValueChange={(v) => void patch({ sendHour: Number(v) })}
                  disabled={!canManage}
                >
                  <SelectTrigger className="h-8 text-xs max-w-[12rem]">
                    <SelectValue placeholder={sendHourLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)} className="text-xs">
                        {String(h).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Workspace timezone: <code>{settings.timezone ?? "UTC"}</code>
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1.5 block">Priority threshold</Label>
                <Select
                  value={settings.priorityThreshold}
                  onValueChange={(v) =>
                    void patch({ priorityThreshold: v as RecommendationPriority })
                  }
                  disabled={!canManage}
                >
                  <SelectTrigger className="h-8 text-xs max-w-[16rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["high", "medium", "low"] as RecommendationPriority[]).map((p) => (
                      <SelectItem key={p} value={p} className="text-xs">
                        {PRIORITY_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Skip weekends */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={settings.skipWeekends}
                onClick={() => void patch({ skipWeekends: !settings.skipWeekends })}
                disabled={!canManage}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors mt-0.5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50",
                  settings.skipWeekends ? "bg-primary" : "bg-border",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform",
                    settings.skipWeekends ? "translate-x-4" : "translate-x-0",
                  )}
                />
              </button>
              <div>
                <p className="text-xs font-semibold">Skip weekends</p>
                <p className="text-[11px] text-muted-foreground">
                  Don't send on Saturday and Sunday. Useful when ops staff don't work weekends.
                </p>
              </div>
            </div>

            {/* Categories */}
            <div>
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {advancedOpen ? "Hide categories" : "Restrict to specific categories"}
                {settings.categories.length > 0 ? (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {settings.categories.length} selected
                  </Badge>
                ) : null}
              </button>
              {advancedOpen ? (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(categoryOptions.length ? categoryOptions : (Object.keys(CATEGORY_LABEL) as RecommendationCategory[])).map((c) => {
                    const checked = settings.categories.includes(c)
                    return (
                      <label
                        key={c}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer text-xs",
                          checked
                            ? "border-primary/40 bg-primary/5 text-foreground"
                            : "border-border text-muted-foreground hover:border-border",
                          !canManage && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => canManage && toggleCategory(c)}
                          className="h-3 w-3"
                          disabled={!canManage}
                        />
                        {CATEGORY_LABEL[c]}
                      </label>
                    )
                  })}
                </div>
              ) : null}
              <p className="text-[11px] text-muted-foreground mt-2">
                Empty = include all categories you have permission to see.
              </p>
            </div>

            {/* Advanced delivery (Phase 4 — Slack + Teams) */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvancedDelivery((v) => !v)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {showAdvancedDelivery ? "Hide" : "Show"} Slack &amp; Teams delivery
                {(settings.slackEnabled || settings.teamsEnabled) ? (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {[settings.slackEnabled && "Slack", settings.teamsEnabled && "Teams"]
                      .filter(Boolean)
                      .join(" · ")}
                  </Badge>
                ) : null}
              </button>
              {showAdvancedDelivery ? (
                <div className="mt-3 space-y-4 rounded-md border border-dashed border-border bg-muted/30 px-3 py-3">
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Internal channels only. AI Ops will never post customer-facing messages
                    to Slack or Teams. Webhook URLs are stored encrypted on the server and
                    masked in the UI after save.
                  </p>

                  <DestinationRow
                    name="slack"
                    label="Slack"
                    placeholder="https://hooks.slack.com/services/T.../B.../..."
                    enabled={settings.slackEnabled}
                    configured={settings.slackWebhookConfigured}
                    hint={settings.slackWebhookHint}
                    canManage={canManage}
                    organizationId={organizationId ?? ""}
                    onUrlSubmit={(url) => void patch({ slackWebhookUrl: url, slackEnabled: url ? true : false })}
                    onClear={() => void patch({ slackWebhookUrl: null, slackEnabled: false })}
                    onToggle={(v) => void patch({ slackEnabled: v })}
                  />

                  <DestinationRow
                    name="teams"
                    label="Microsoft Teams"
                    placeholder="https://outlook.office.com/webhook/..."
                    enabled={settings.teamsEnabled}
                    configured={settings.teamsWebhookConfigured}
                    hint={settings.teamsWebhookHint}
                    canManage={canManage}
                    organizationId={organizationId ?? ""}
                    onUrlSubmit={(url) => void patch({ teamsWebhookUrl: url, teamsEnabled: url ? true : false })}
                    onClear={() => void patch({ teamsWebhookUrl: null, teamsEnabled: false })}
                    onToggle={(v) => void patch({ teamsEnabled: v })}
                  />
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void loadPreview()}
                disabled={previewing || loading}
                className="h-8 gap-1.5"
              >
                {previewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" aria-hidden />}
                Preview
              </Button>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void sendNow()}
                  disabled={sending || loading}
                  className="h-8 gap-1.5"
                >
                  {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" aria-hidden />}
                  Send digest now
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setHistoryOpen((v) => !v)}
                className="h-8 gap-1.5 text-muted-foreground"
              >
                <History className="h-3 w-3" aria-hidden />
                {historyOpen ? "Hide history" : `Recent (${runs.length})`}
              </Button>
              {settings.lastSentAt ? (
                <span className="text-[11px] text-muted-foreground ml-auto">
                  Last sent {new Date(settings.lastSentAt).toLocaleString()}
                </span>
              ) : null}
            </div>

            {historyOpen ? (
              <div className="mt-3 space-y-1.5">
                {runs.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">No digest history yet.</p>
                ) : (
                  runs.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-[11px]"
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[10px]",
                          run.status === "sent" && "border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
                          run.status === "partial" && "border-amber-500/30 text-amber-700 dark:text-amber-300",
                          run.status === "failed" && "border-red-500/30 text-red-700 dark:text-red-300",
                          run.status === "no_items" && "border-amber-500/30 text-amber-700 dark:text-amber-300",
                          run.status === "no_recipients" && "border-amber-500/30 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {run.status}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {run.summary ?? "Digest run"}{" "}
                          <span className="text-muted-foreground font-normal">
                            · {run.recipientCount} recipient{run.recipientCount === 1 ? "" : "s"} · {run.itemsCount} item{run.itemsCount === 1 ? "" : "s"}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          {run.triggerKind} · {new Date(run.createdAt).toLocaleString()}
                          {run.errorMessage && canManage ? (
                            <span className="text-red-600 dark:text-red-400 ml-1">
                              · {run.errorMessage}
                            </span>
                          ) : run.errorMessage ? (
                            <span className="text-red-600 dark:text-red-400 ml-1">
                              · Delivery failed
                            </span>
                          ) : null}
                        </p>
                        {run.destinationsResult ? (
                          <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                            {(["email", "slack", "teams"] as const).map((d) => {
                              const status = run.destinationsResult?.[d]?.status
                              if (!status || status === "not_configured") return null
                              return (
                                <span
                                  key={d}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5",
                                    status === "sent" &&
                                      "border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
                                    status === "failed" &&
                                      "border-red-500/30 text-red-700 dark:text-red-300",
                                    status === "disabled" &&
                                      "border-border text-muted-foreground",
                                    status === "skipped" &&
                                      "border-border text-muted-foreground",
                                  )}
                                >
                                  {d}: {status}
                                </span>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {preview ? (
              <div className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/[0.04] overflow-hidden">
                <div className="px-3 py-2 border-b border-violet-500/20 flex items-center justify-between gap-2 bg-violet-500/[0.04]">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Preview</p>
                    <p className="text-xs font-semibold truncate">{preview.subject}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreview(null)}
                    className="h-7 w-7 p-0"
                    aria-label="Close preview"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <iframe
                  title="AI Ops digest preview"
                  srcDoc={preview.html}
                  className="w-full h-[500px] bg-white"
                  sandbox=""
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}

export function AiOpsDigestSettingsCardLazyHint() {
  return (
    <p className="text-[11px] text-muted-foreground leading-snug rounded-md border border-dashed border-border bg-muted/30 px-3 py-2">
      <AlertCircle className="h-3 w-3 inline mr-1 -mt-0.5" />
      Recipients only see the digest if your workspace has Resend configured. Ask an admin if
      delivery isn't working.
    </p>
  )
}

function DestinationRow({
  name,
  label,
  placeholder,
  enabled,
  configured,
  hint,
  canManage,
  organizationId,
  onUrlSubmit,
  onClear,
  onToggle,
}: {
  name: "slack" | "teams"
  label: string
  placeholder: string
  enabled: boolean
  configured: boolean
  hint: string | null
  canManage: boolean
  organizationId: string
  onUrlSubmit: (url: string) => void
  onClear: () => void
  onToggle: (v: boolean) => void
}) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [testing, setTesting] = useState(false)

  async function runTest() {
    if (!organizationId) return
    setTesting(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/digest/test-destination`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destination: name,
            ...(draft.trim() ? { overrideWebhookUrl: draft.trim() } : {}),
          }),
        },
      )
      const body = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok) throw new Error(body.message ?? body.error ?? "Test failed.")
      toast({ title: `${label} test sent`, description: body.message })
    } catch (e) {
      toast({
        title: `${label} test failed`,
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setTesting(false)
    }
  }

  function submitUrl() {
    const value = draft.trim()
    if (!value) {
      toast({
        title: "Enter a webhook URL first",
        description: `Paste your ${label} incoming webhook URL.`,
      })
      return
    }
    onUrlSubmit(value)
    setEditing(false)
    setDraft("")
  }

  return (
    <div className="rounded-md border border-border bg-card px-3 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold">{label}</p>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {configured ? (
              <>
                Configured · <code className="text-[10px]">{hint ?? "saved"}</code>
              </>
            ) : (
              <>Not configured</>
            )}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => canManage && configured && onToggle(!enabled)}
          disabled={!canManage || !configured}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50",
            enabled ? "bg-primary" : "bg-border",
          )}
          aria-label={`Toggle ${label} delivery`}
          title={configured ? undefined : "Save a webhook URL first."}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform",
              enabled ? "translate-x-4" : "translate-x-0",
            )}
          />
        </button>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Input
            type="url"
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 text-xs"
            disabled={!canManage}
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              onClick={submitUrl}
              disabled={!canManage}
              className="h-7 text-xs"
            >
              Save webhook
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setDraft("")
              }}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void runTest()}
              disabled={!canManage || testing || !draft.trim()}
              className="h-7 text-xs gap-1"
            >
              {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Send test
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {canManage ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(true)
                setDraft("")
              }}
              className="h-7 text-xs"
            >
              {configured ? "Replace webhook" : "Add webhook"}
            </Button>
          ) : null}
          {configured ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void runTest()}
              disabled={testing || !configured}
              className="h-7 text-xs gap-1"
              title="Sends a one-line test message to confirm the destination is wired correctly."
            >
              {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Send test
            </Button>
          ) : null}
          {configured && canManage ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onClear}
              className="h-7 text-xs text-red-600 hover:text-red-700"
            >
              Remove
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
