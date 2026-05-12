"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bell, Mail, Smartphone, Monitor, Loader2, Info } from "lucide-react"
import { AiOpsDigestSettingsCard } from "@/components/ai-ops/digest-settings-card"
import { InternalEscalationRulesPanel } from "@/components/settings/internal-escalation-rules-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import {
  WORKSPACE_ALERT_REGISTRY,
  WORKSPACE_ALERT_TYPES,
  isWorkspaceAlertType,
  type WorkspaceAlertType,
} from "@/lib/notifications/workspace-alert-registry"
import { DEFAULT_DIGEST_TIME_LOCAL, normalizeLocalHm } from "@/lib/notifications/notification-time-local"
import { cn } from "@/lib/utils"

const TIMES = [
  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00",
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00",
  "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00",
]

type ApiPreference = {
  alertType: WorkspaceAlertType
  inAppEnabled: boolean
  emailEnabled: boolean
  smsEnabled: boolean
}

type ApiDigest = {
  digestEnabled: boolean
  digestFrequency: "daily" | "weekly"
  digestTimeLocal: string
  quietHoursEnabled: boolean
  quietHoursStartLocal: string | null
  quietHoursEndLocal: string | null
}

type ApiBundle = {
  preferences: ApiPreference[]
  digest: ApiDigest
}

type ApiResponse = ApiBundle & {
  message?: string
  error?: string
  meta?: { persistenceReady?: boolean }
}

const LOCAL_HM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

function defaultDigest(): ApiDigest {
  return {
    digestEnabled: false,
    digestFrequency: "daily",
    digestTimeLocal: DEFAULT_DIGEST_TIME_LOCAL,
    quietHoursEnabled: false,
    quietHoursStartLocal: null,
    quietHoursEndLocal: null,
  }
}

/** Merge API rows with registry defaults so GET/PATCH hydration never fails on shape drift. */
function normalizeApiPreferences(raw: unknown): ApiPreference[] {
  const base: ApiPreference[] = WORKSPACE_ALERT_REGISTRY.map((r) => ({
    alertType: r.alertType,
    inAppEnabled: r.defaultInApp,
    emailEnabled: r.defaultEmail,
    smsEnabled: false,
  }))
  if (!Array.isArray(raw)) return base
  const by = new Map<WorkspaceAlertType, ApiPreference>()
  for (const p of base) by.set(p.alertType, { ...p })
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    if (typeof o.alertType !== "string" || !isWorkspaceAlertType(o.alertType)) continue
    by.set(o.alertType, {
      alertType: o.alertType,
      inAppEnabled: Boolean(o.inAppEnabled),
      emailEnabled: Boolean(o.emailEnabled),
      smsEnabled: false,
    })
  }
  return WORKSPACE_ALERT_TYPES.map((t) => by.get(t)!)
}

function normalizeApiDigest(raw: unknown): ApiDigest {
  const d = defaultDigest()
  if (!raw || typeof raw !== "object") return d
  const o = raw as Record<string, unknown>
  const freq = o.digestFrequency === "weekly" ? "weekly" : "daily"
  const digestEnabled = Boolean(o.digestEnabled)
  const digestTimeLocal = normalizeLocalHm(
    typeof o.digestTimeLocal === "string" ? o.digestTimeLocal : null,
    DEFAULT_DIGEST_TIME_LOCAL,
  )
  const quietHoursEnabled = Boolean(o.quietHoursEnabled)
  const qs =
    o.quietHoursStartLocal === null || o.quietHoursStartLocal === undefined
      ? null
      : typeof o.quietHoursStartLocal === "string"
        ? o.quietHoursStartLocal
        : null
  const qe =
    o.quietHoursEndLocal === null || o.quietHoursEndLocal === undefined
      ? null
      : typeof o.quietHoursEndLocal === "string"
        ? o.quietHoursEndLocal
        : null
  return {
    digestEnabled,
    digestFrequency: freq,
    digestTimeLocal: LOCAL_HM.test(digestTimeLocal) ? digestTimeLocal : DEFAULT_DIGEST_TIME_LOCAL,
    quietHoursEnabled,
    quietHoursStartLocal: quietHoursEnabled ? normalizeLocalHm(qs, "22:00") : null,
    quietHoursEndLocal: quietHoursEnabled ? normalizeLocalHm(qe, "07:00") : null,
  }
}

function friendLoadMessage(res: Response, json: { message?: string; error?: string } | null): string {
  if (res.status === 401) {
    return "You must be signed in to view these settings."
  }
  if (typeof json?.message === "string" && json.message.trim()) {
    return json.message.trim()
  }
  return "Could not load notification settings."
}

function friendMutateMessage(res: Response, json: { message?: string; error?: string } | null): string {
  if (json?.error === "not_configured") {
    return "Notification storage is not set up on this server yet. Ask an administrator to apply the latest update, then try again."
  }
  if (json?.error === "server_misconfigured") {
    return "The server could not save settings right now. Please try again later."
  }
  if (res.status === 401) {
    return "You must be signed in to change these settings."
  }
  if (res.status === 403) {
    return "You do not have permission to change these settings."
  }
  if (typeof json?.message === "string" && json.message.trim()) {
    return json.message.trim()
  }
  return "Could not save settings."
}

function Toggle({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  "aria-label"?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked)
      }}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent",
        "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm",
          "transform transition-transform duration-150",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  )
}

function preferencesPayload(prefs: ApiPreference[]): ApiPreference[] {
  const map = new Map(prefs.map((p) => [p.alertType, p]))
  return WORKSPACE_ALERT_TYPES.map((t) => {
    const p = map.get(t)
    return {
      alertType: t,
      inAppEnabled: p?.inAppEnabled ?? false,
      emailEnabled: p?.emailEnabled ?? false,
      smsEnabled: false,
    }
  })
}

export default function NotificationsPage() {
  const { toast } = useToast()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { status: permStatus, has } = useOrgPermissions()
  const canEdit = permStatus === "ready" && has("canManageWorkspaceSettings")
  const [persistenceReady, setPersistenceReady] = useState(true)

  const canMutate = useMemo(() => canEdit && persistenceReady, [canEdit, persistenceReady])

  const [loadState, setLoadState] = useState<"idle" | "loading" | "error" | "ready">("idle")
  const [loadMessage, setLoadMessage] = useState<string | null>(null)
  const [bundle, setBundle] = useState<ApiBundle | null>(null)
  const [saving, setSaving] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const saveLockRef = useRef(false)

  const prefsByType = useMemo(() => {
    const m = new Map<WorkspaceAlertType, ApiPreference>()
    for (const p of bundle?.preferences ?? []) {
      m.set(p.alertType, p)
    }
    return m
  }, [bundle])

  const digest = bundle?.digest

  const applyApiNotificationResponse = useCallback((json: ApiResponse) => {
    setBundle({
      preferences: normalizeApiPreferences(json.preferences),
      digest: normalizeApiDigest(json.digest),
    })
    setPersistenceReady(json.meta?.persistenceReady !== false)
  }, [])

  const load = useCallback(async () => {
    if (orgStatus !== "ready" || !organizationId) {
      setLoadState("idle")
      setBundle(null)
      setPersistenceReady(true)
      return
    }
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoadState("loading")
    setLoadMessage(null)
    try {
      const res = await fetch(`/api/organizations/${organizationId}/notification-preferences`, {
        signal: ac.signal,
        cache: "no-store",
      })
      const json = (await res.json().catch(() => null)) as ApiResponse | null
      if (!res.ok) {
        const msg = friendLoadMessage(res, json)
        throw new Error(msg)
      }
      if (!json) {
        throw new Error("Could not load notification settings.")
      }
      applyApiNotificationResponse(json)
      setLoadState("ready")
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return
      const msg = e instanceof Error ? e.message : "Could not load notification settings."
      setLoadMessage(msg)
      setLoadState("error")
      setBundle(null)
    }
  }, [applyApiNotificationResponse, organizationId, orgStatus])

  useEffect(() => {
    void load()
    return () => abortRef.current?.abort()
  }, [load])

  const patch = useCallback(
    async (body: { preferences?: ApiPreference[]; digest?: ApiDigest }, rollback: ApiBundle | null) => {
      if (!organizationId || !rollback) return
      if (saveLockRef.current) return
      saveLockRef.current = true
      setSaving(true)
      try {
        const res = await fetch(`/api/organizations/${organizationId}/notification-preferences`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        })
        const json = (await res.json().catch(() => null)) as ApiResponse | null
        if (!res.ok) {
          const msg = friendMutateMessage(res, json)
          throw new Error(msg)
        }
        if (!json) {
          throw new Error("Could not save settings.")
        }
        applyApiNotificationResponse(json)
        toast({ title: "Saved", description: "Your notification settings were saved." })
      } catch (e) {
        setBundle(rollback)
        const msg = e instanceof Error ? e.message : "Could not save settings."
        toast({ variant: "destructive", title: "Save failed", description: msg })
      } finally {
        saveLockRef.current = false
        setSaving(false)
      }
    },
    [applyApiNotificationResponse, organizationId, toast],
  )

  const updatePreferenceChannel = useCallback(
    async (alertType: WorkspaceAlertType, channel: "inApp" | "email", value: boolean) => {
      if (!bundle || !canMutate || saving || saveLockRef.current) return
      const rollback = bundle
      const nextPrefs = bundle.preferences.map((p) =>
        p.alertType === alertType ?
          {
            ...p,
            inAppEnabled: channel === "inApp" ? value : p.inAppEnabled,
            emailEnabled: channel === "email" ? value : p.emailEnabled,
            smsEnabled: false,
          }
        : p,
      )
      setBundle({ ...bundle, preferences: nextPrefs })
      await patch({ preferences: preferencesPayload(nextPrefs), digest: bundle.digest }, rollback)
    },
    [bundle, canMutate, patch, saving],
  )

  const updateDigest = useCallback(
    async (nextDigest: ApiDigest) => {
      if (!bundle || !canMutate || saving || saveLockRef.current) return
      const rollback = bundle
      setBundle({ ...bundle, digest: nextDigest })
      await patch({ preferences: preferencesPayload(bundle.preferences), digest: nextDigest }, rollback)
    },
    [bundle, canMutate, patch, saving],
  )

  const showMatrix = loadState === "ready" && bundle

  return (
    <div className="flex max-w-full flex-col gap-6 overflow-x-hidden pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <Bell size={16} className="shrink-0 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Notification preferences</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Choose which workspace alerts your team receives and how they are delivered. Escalation rules and the AI Ops
            digest below are configured separately.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
          {loadState === "loading" ?
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </span>
          : null}
          {saving ?
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          : null}
        </div>
      </div>

      {loadState === "error" && loadMessage ?
        <Alert variant="destructive">
          <AlertTitle>Could not load settings</AlertTitle>
          <AlertDescription>{loadMessage}</AlertDescription>
        </Alert>
      : null}

      {loadState === "ready" && bundle && !persistenceReady ?
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Database setup needed</AlertTitle>
          <AlertDescription>
            Preferences cannot be saved on this server until the latest database migration is applied. You can still review
            the default options below. Ask your workspace administrator or hosting provider to run migrations.
          </AlertDescription>
        </Alert>
      : null}

      {permStatus === "ready" && !canEdit && bundle && persistenceReady ?
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>View only</AlertTitle>
          <AlertDescription>
            You can see this workspace&apos;s notification settings. Only members who manage workspace settings can change
            them.
          </AlertDescription>
        </Alert>
      : null}

      <Alert>
        <Smartphone className="h-4 w-4" />
        <AlertTitle>SMS alerts are not active yet.</AlertTitle>
        <AlertDescription>
          In-app and email choices are saved for your workspace. SMS stays off until SMS delivery is enabled for these
          alerts.
        </AlertDescription>
      </Alert>

      {/* Alert matrix */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h3 className="text-sm font-semibold text-foreground">Alert preferences</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Turn channels on or off for each kind of alert. Changes apply to this workspace.
          </p>
        </div>

        {!showMatrix ?
          <div className="flex items-center justify-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground">
            {orgStatus === "loading" ?
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                Loading workspace…
              </>
            : orgStatus !== "ready" || !organizationId ?
              "Select a workspace to manage notifications."
            : loadState === "loading" ?
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                Loading preferences…
              </>
            : loadState === "error" ?
              "Could not load preferences. Refresh the page to try again."
            : null}
          </div>
        : (
          <>
            {/* Desktop header */}
            <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-4 border-b border-border bg-secondary/40 px-6 py-3 md:grid">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alert type</span>
              <div className="flex w-16 justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Monitor size={12} className="shrink-0" />
                In-app
              </div>
              <div className="flex w-14 justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Mail size={12} className="shrink-0" />
                Email
              </div>
              <div className="flex w-12 justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Smartphone size={12} className="shrink-0" />
                SMS
              </div>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-border md:hidden">
              {WORKSPACE_ALERT_REGISTRY.map((row) => {
                const pref = prefsByType.get(row.alertType)
                if (!pref) return null
                const Icon = row.icon
                const busy = saving || !canMutate
                return (
                  <div key={row.alertType} className="space-y-3 px-4 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
                        <Icon size={14} className={row.iconColorClass} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{row.label}</p>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{row.description}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2 py-3">
                        <span className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          In-app
                        </span>
                        <Toggle
                          aria-label={`${row.label} in-app`}
                          checked={pref.inAppEnabled}
                          disabled={busy}
                          onChange={(v) => void updatePreferenceChannel(row.alertType, "inApp", v)}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2 py-3">
                        <span className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Email
                        </span>
                        <Toggle
                          aria-label={`${row.label} email`}
                          checked={pref.emailEnabled}
                          disabled={busy}
                          onChange={(v) => void updatePreferenceChannel(row.alertType, "email", v)}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-2 py-3">
                        <span className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          SMS
                        </span>
                        <Toggle checked={false} disabled onChange={() => {}} aria-label={`${row.label} SMS (inactive)`} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop rows */}
            <div className="hidden divide-y divide-border md:block">
              {WORKSPACE_ALERT_REGISTRY.map((row) => {
                const pref = prefsByType.get(row.alertType)
                if (!pref) return null
                const Icon = row.icon
                const busy = saving || !canMutate
                return (
                  <div
                    key={row.alertType}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-secondary/20"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
                        <Icon size={14} className={row.iconColorClass} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{row.label}</p>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{row.description}</p>
                      </div>
                    </div>
                    <div className="flex w-16 justify-center">
                      <Toggle
                        aria-label={`${row.label} in-app`}
                        checked={pref.inAppEnabled}
                        disabled={busy}
                        onChange={(v) => void updatePreferenceChannel(row.alertType, "inApp", v)}
                      />
                    </div>
                    <div className="flex w-14 justify-center">
                      <Toggle
                        aria-label={`${row.label} email`}
                        checked={pref.emailEnabled}
                        disabled={busy}
                        onChange={(v) => void updatePreferenceChannel(row.alertType, "email", v)}
                      />
                    </div>
                    <div className="flex w-12 justify-center">
                      <Toggle checked={false} disabled onChange={() => {}} aria-label={`${row.label} SMS (inactive)`} />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Email digest + quiet hours */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Email digest</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Receive a summary of activity instead of individual emails for each event. Times use each viewer&apos;s
              local timezone when shown in the app; stored as HH:MM for the workspace default.
            </p>
          </div>
          {digest ?
            <Toggle
              aria-label="Email digest enabled"
              checked={digest.digestEnabled}
              disabled={saving || !canMutate || !bundle}
              onChange={(v) => {
                if (!bundle) return
                void updateDigest({ ...bundle.digest, digestEnabled: v })
              }}
            />
          : null}
        </div>
        {digest && digest.digestEnabled ?
          <div className="space-y-4 px-4 py-4 sm:px-6">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Digest frequency</p>
              <div className="flex flex-wrap gap-2">
                {(["daily", "weekly"] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    disabled={saving || !canMutate || !bundle}
                    onClick={() => {
                      if (!bundle) return
                      void updateDigest({ ...bundle.digest, digestFrequency: freq })
                    }}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-all",
                      digest.digestFrequency === freq ?
                        "border-primary bg-primary/8 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary/60",
                      saving || !canMutate ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                    )}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Digest send time</p>
              <select
                className="h-9 max-w-full rounded-md border border-border bg-background px-2 text-sm"
                value={digest.digestTimeLocal}
                disabled={saving || !canMutate || !bundle}
                onChange={(e) => {
                  if (!bundle) return
                  void updateDigest({ ...bundle.digest, digestTimeLocal: e.target.value })
                }}
              >
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        : digest ?
          <p className="px-4 py-3 text-xs text-muted-foreground sm:px-6">Turn on the digest to pick frequency and send time.</p>
        : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Quiet hours</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              When enabled, suppress email (and future SMS) during this window. In-app alerts are still recorded.
            </p>
          </div>
          {digest ?
            <Toggle
              aria-label="Quiet hours enabled"
              checked={digest.quietHoursEnabled}
              disabled={saving || !canMutate || !bundle}
              onChange={(v) => {
                if (!bundle) return
                const d = bundle.digest
                void updateDigest({
                  ...d,
                  quietHoursEnabled: v,
                  quietHoursStartLocal: v ? (d.quietHoursStartLocal ?? "22:00") : d.quietHoursStartLocal,
                  quietHoursEndLocal: v ? (d.quietHoursEndLocal ?? "07:00") : d.quietHoursEndLocal,
                })
              }}
            />
          : null}
        </div>
        {digest && digest.quietHoursEnabled ?
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-6">
            <span className="text-sm text-muted-foreground">From</span>
            <select
              className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-2 text-sm sm:w-auto"
              value={digest.quietHoursStartLocal ?? "22:00"}
              disabled={saving || !canMutate || !bundle}
              onChange={(e) => {
                if (!bundle) return
                void updateDigest({ ...bundle.digest, quietHoursStartLocal: e.target.value })
              }}
            >
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground">to</span>
            <select
              className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-2 text-sm sm:w-auto"
              value={digest.quietHoursEndLocal ?? "07:00"}
              disabled={saving || !canMutate || !bundle}
              onChange={(e) => {
                if (!bundle) return
                void updateDigest({ ...bundle.digest, quietHoursEndLocal: e.target.value })
              }}
            >
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">(local time)</span>
          </div>
        : digest ?
          <p className="px-4 py-3 text-xs text-muted-foreground sm:px-6">Enable quiet hours to set a start and end time.</p>
        : null}
      </div>

      {orgStatus === "ready" && organizationId ?
        <InternalEscalationRulesPanel organizationId={organizationId} />
      : null}

      <AiOpsDigestSettingsCard />

      <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-4 sm:px-5">
        <p className="text-sm font-medium text-foreground">Looking for email automation cadences?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Configure appointment confirmations, maintenance reminders, quote follow-ups, and invoice follow-up sequences in{" "}
          <a href="/settings/automations" className="font-medium text-primary hover:underline">
            Automations
          </a>
          .
        </p>
      </div>
    </div>
  )
}
