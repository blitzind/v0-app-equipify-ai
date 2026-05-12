"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bell, Mail, Smartphone, Monitor, Loader2, Info } from "lucide-react"
import { AiOpsDigestSettingsCard } from "@/components/ai-ops/digest-settings-card"
import { InternalEscalationRulesPanel } from "@/components/settings/internal-escalation-rules-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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
  quietHours?: {
    enabled?: unknown
    startLocal?: unknown
    endLocal?: unknown
  }
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
    const inAppEnabled = Boolean(o.inAppEnabled ?? o.inApp)
    const emailEnabled = Boolean(o.emailEnabled ?? o.email)
    by.set(o.alertType, {
      alertType: o.alertType,
      inAppEnabled,
      emailEnabled,
      smsEnabled: false,
    })
  }
  return WORKSPACE_ALERT_TYPES.map((t) => by.get(t)!)
}

function normalizeApiDigest(raw: unknown, root?: ApiResponse | null): ApiDigest {
  const d = defaultDigest()
  if (!raw || typeof raw !== "object") return d
  const o = raw as Record<string, unknown>
  const qh = root?.quietHours
  const qhObj = qh && typeof qh === "object" ? (qh as Record<string, unknown>) : null
  const freq = o.digestFrequency === "weekly" || o.frequency === "weekly" ? "weekly" : "daily"
  const digestEnabled = Boolean(o.digestEnabled ?? o.enabled)
  const digestTimeLocal = normalizeLocalHm(
    typeof (o.digestTimeLocal ?? o.timeLocal) === "string" ? String(o.digestTimeLocal ?? o.timeLocal) : null,
    DEFAULT_DIGEST_TIME_LOCAL,
  )
  const hasExplicitQuietTop = qhObj != null && "enabled" in qhObj
  const quietHoursEnabled = hasExplicitQuietTop ? Boolean(qhObj!.enabled) : Boolean(o.quietHoursEnabled)
  const qs =
    qhObj && typeof qhObj.startLocal === "string" ? qhObj.startLocal
    : o.quietHoursStartLocal === null || o.quietHoursStartLocal === undefined ? null
    : typeof o.quietHoursStartLocal === "string" ? o.quietHoursStartLocal
    : null
  const qe =
    qhObj && typeof qhObj.endLocal === "string" ? qhObj.endLocal
    : o.quietHoursEndLocal === null || o.quietHoursEndLocal === undefined ? null
    : typeof o.quietHoursEndLocal === "string" ? o.quietHoursEndLocal
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
    return "Database setup needed on the server (missing service configuration). Ask an administrator to verify environment variables, then try again."
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

function cloneBundle(b: ApiBundle): ApiBundle {
  return {
    preferences: b.preferences.map((p) => ({ ...p })),
    digest: { ...b.digest },
  }
}

function digestComparable(d: ApiDigest) {
  return {
    digestEnabled: d.digestEnabled,
    digestFrequency: d.digestFrequency,
    digestTimeLocal: d.digestTimeLocal,
    quietHoursEnabled: d.quietHoursEnabled,
    quietHoursStartLocal: d.quietHoursEnabled ? normalizeLocalHm(d.quietHoursStartLocal, "22:00") : null,
    quietHoursEndLocal: d.quietHoursEnabled ? normalizeLocalHm(d.quietHoursEndLocal, "07:00") : null,
  }
}

function bundlesEqual(a: ApiBundle, b: ApiBundle): boolean {
  if (JSON.stringify(preferencesPayload(a.preferences)) !== JSON.stringify(preferencesPayload(b.preferences))) {
    return false
  }
  return JSON.stringify(digestComparable(a.digest)) === JSON.stringify(digestComparable(b.digest))
}

/** Payload shape required by PATCH Zod schema (quiet-hour times null when disabled). */
function digestForPatch(d: ApiDigest): ApiDigest {
  if (!d.quietHoursEnabled) {
    return {
      ...d,
      quietHoursStartLocal: null,
      quietHoursEndLocal: null,
    }
  }
  return {
    ...d,
    quietHoursStartLocal: normalizeLocalHm(d.quietHoursStartLocal, "22:00"),
    quietHoursEndLocal: normalizeLocalHm(d.quietHoursEndLocal, "07:00"),
  }
}

export default function NotificationsPage() {
  const { toast } = useToast()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { status: permStatus, permissions } = useOrgPermissions()
  const canManageWorkspaceSettings =
    permStatus === "ready" && permissions.canManageWorkspaceSettings
  const [persistenceReady, setPersistenceReady] = useState(true)

  const mutateBlockReason = useMemo(() => {
    if (orgStatus !== "ready" || !organizationId) return "no_workspace" as const
    if (permStatus === "loading") return "permissions_loading" as const
    if (permStatus === "no_org") return "no_workspace" as const
    if (!persistenceReady) return "database_setup" as const
    if (!canManageWorkspaceSettings) return "view_only" as const
    return null
  }, [
    orgStatus,
    organizationId,
    permStatus,
    persistenceReady,
    canManageWorkspaceSettings,
  ])

  const canMutate = mutateBlockReason === null

  const [loadState, setLoadState] = useState<"idle" | "loading" | "error" | "ready">("idle")
  const [loadMessage, setLoadMessage] = useState<string | null>(null)
  const [serverBundle, setServerBundle] = useState<ApiBundle | null>(null)
  const [draftBundle, setDraftBundle] = useState<ApiBundle | null>(null)
  const [saving, setSaving] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const sawPermissionsLoadingRef = useRef(false)

  const showNotifPrefsDebug = process.env.NODE_ENV === "development"
  const [devTransport, setDevTransport] = useState({
    lastGetStatus: null as number | null,
    lastPatchStatus: null as number | null,
    lastPatchPayloadCounts: null as { preferenceRows: number; digestFields: number } | null,
    lastSaveResult: "idle" as "idle" | "success" | "error",
  })

  const isDirty = useMemo(() => {
    if (!serverBundle || !draftBundle) return false
    return !bundlesEqual(serverBundle, draftBundle)
  }, [serverBundle, draftBundle])

  const prefsByType = useMemo(() => {
    const m = new Map<WorkspaceAlertType, ApiPreference>()
    for (const p of draftBundle?.preferences ?? []) {
      m.set(p.alertType, p)
    }
    return m
  }, [draftBundle])

  const digest = draftBundle?.digest

  const applyServerPayload = useCallback((json: ApiResponse) => {
    const next: ApiBundle = {
      preferences: normalizeApiPreferences(json.preferences),
      digest: normalizeApiDigest(json.digest, json),
    }
    setServerBundle(cloneBundle(next))
    setDraftBundle(cloneBundle(next))
    setPersistenceReady(json.meta?.persistenceReady !== false)
  }, [])

  const load = useCallback(async () => {
    if (orgStatus !== "ready" || !organizationId) {
      setLoadState("idle")
      setServerBundle(null)
      setDraftBundle(null)
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
      if (showNotifPrefsDebug) {
        setDevTransport((d) => ({ ...d, lastGetStatus: res.status }))
      }
      const json = (await res.json().catch(() => null)) as ApiResponse | null
      if (!res.ok) {
        const msg = friendLoadMessage(res, json)
        throw new Error(msg)
      }
      if (!json) {
        throw new Error("Could not load notification settings.")
      }
      applyServerPayload(json)
      setLoadState("ready")
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return
      const msg = e instanceof Error ? e.message : "Could not load notification settings."
      setLoadMessage(msg)
      setLoadState("error")
      setServerBundle(null)
      setDraftBundle(null)
    }
  }, [applyServerPayload, organizationId, orgStatus, showNotifPrefsDebug])

  useEffect(() => {
    void load()
    return () => abortRef.current?.abort()
  }, [load])

  useEffect(() => {
    if (permStatus === "loading") sawPermissionsLoadingRef.current = true
    if (
      orgStatus !== "ready" ||
      !organizationId ||
      permStatus !== "ready" ||
      !sawPermissionsLoadingRef.current
    ) {
      return
    }
    sawPermissionsLoadingRef.current = false
    void load()
  }, [orgStatus, organizationId, permStatus, load])

  const handleDiscard = useCallback(() => {
    if (serverBundle) setDraftBundle(cloneBundle(serverBundle))
  }, [serverBundle])

  const handleSave = useCallback(async () => {
    if (!organizationId || !draftBundle || !isDirty) return
    if (!canMutate || !persistenceReady) return
    const body = {
      preferences: preferencesPayload(draftBundle.preferences),
      digest: digestForPatch(draftBundle.digest),
    }
    if (showNotifPrefsDebug) {
      setDevTransport((d) => ({
        ...d,
        lastPatchPayloadCounts: { preferenceRows: body.preferences.length, digestFields: 7 },
        lastSaveResult: "idle",
      }))
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/organizations/${organizationId}/notification-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      })
      const json = (await res.json().catch(() => null)) as ApiResponse | null
      if (showNotifPrefsDebug) {
        setDevTransport((d) => ({ ...d, lastPatchStatus: res.status }))
      }
      if (!res.ok) {
        const msg = friendMutateMessage(res, json)
        throw new Error(msg)
      }
      if (!json) {
        throw new Error("Could not save settings.")
      }
      applyServerPayload(json)
      toast({ title: "Your notification settings were saved." })
      if (showNotifPrefsDebug) {
        setDevTransport((d) => ({ ...d, lastSaveResult: "success" }))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save settings."
      toast({ variant: "destructive", title: "Save failed", description: msg })
      if (showNotifPrefsDebug) {
        setDevTransport((d) => ({ ...d, lastSaveResult: "error" }))
      }
    } finally {
      setSaving(false)
    }
  }, [
    organizationId,
    draftBundle,
    isDirty,
    canMutate,
    persistenceReady,
    applyServerPayload,
    toast,
    showNotifPrefsDebug,
  ])

  const controlsDisabled = saving || !canMutate || !persistenceReady

  const controlsDisableExplanation = useMemo(() => {
    if (orgStatus !== "ready" || !organizationId) {
      return "Workspace unavailable — select a workspace above to load preferences."
    }
    if (permStatus === "loading") {
      return "Checking permissions — controls stay read-only until membership finishes loading."
    }
    if (!persistenceReady) {
      return "Database setup needed — notification preference tables are not available on this server yet."
    }
    if (!canManageWorkspaceSettings) {
      return "View only — only members who can manage workspace settings may save changes."
    }
    if (saving) {
      return "Saving your notification settings…"
    }
    return null
  }, [
    orgStatus,
    organizationId,
    permStatus,
    persistenceReady,
    canManageWorkspaceSettings,
    saving,
  ])

  const setDraftPreference = useCallback((alertType: WorkspaceAlertType, channel: "inApp" | "email", value: boolean) => {
    setDraftBundle((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        preferences: prev.preferences.map((p) =>
          p.alertType === alertType ?
            {
              ...p,
              inAppEnabled: channel === "inApp" ? value : p.inAppEnabled,
              emailEnabled: channel === "email" ? value : p.emailEnabled,
              smsEnabled: false,
            }
          : p,
        ),
      }
    })
  }, [])

  const showMatrix = loadState === "ready" && draftBundle && serverBundle

  const saveDisabled =
    !isDirty || saving || !canMutate || !persistenceReady || !organizationId || !draftBundle

  return (
    <div className="flex max-w-full flex-col gap-6 overflow-x-hidden pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <Bell size={16} className="shrink-0 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Notification preferences</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Choose which workspace alerts your team receives and how they are delivered. Edit the matrix, digest, and
            quiet hours, then save. Escalation rules and the AI Ops digest below are configured separately.
          </p>
        </div>
        <div className="flex min-w-0 flex-col items-stretch gap-2 sm:max-w-md sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
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
            {isDirty ?
              <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-900 dark:text-amber-100">
                Unsaved changes
              </span>
            : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isDirty || saving}
              onClick={handleDiscard}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saveDisabled}
              onClick={() => void handleSave()}
            >
              Save notification settings
            </Button>
          </div>
        </div>
      </div>

      {loadState === "error" && loadMessage ?
        <Alert variant="destructive">
          <AlertTitle>Could not load settings</AlertTitle>
          <AlertDescription>{loadMessage}</AlertDescription>
        </Alert>
      : null}

      {loadState === "ready" && draftBundle && mutateBlockReason === "permissions_loading" ?
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Checking permissions…</AlertTitle>
          <AlertDescription>
            Your workspace membership is loading. Alert toggles stay read-only until that finishes (usually under a
            second).
          </AlertDescription>
        </Alert>
      : null}

      {loadState === "ready" && draftBundle && !persistenceReady ?
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Database setup needed</AlertTitle>
          <AlertDescription>
            Preferences cannot be saved on this server until the latest database migration is applied. You can still
            review the default options below. Ask your workspace administrator or hosting provider to run migrations.
          </AlertDescription>
        </Alert>
      : null}

      {mutateBlockReason === "view_only" && draftBundle && persistenceReady ?
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>View only</AlertTitle>
          <AlertDescription>
            You can see this workspace&apos;s notification settings. Only members who manage workspace settings can change
            them.
          </AlertDescription>
        </Alert>
      : null}

      {mutateBlockReason === "no_workspace" && loadState !== "loading" && loadState !== "error" ?
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Select a workspace</AlertTitle>
          <AlertDescription>Choose a workspace above to load and edit notification preferences.</AlertDescription>
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
            Turn channels on or off for each kind of alert. Use Save notification settings to write changes to this
            workspace.
          </p>
          {controlsDisableExplanation ?
            <p className="mt-2 text-xs text-muted-foreground">{controlsDisableExplanation}</p>
          : null}
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
                        <Switch
                          aria-label={`${row.label} in-app`}
                          checked={pref.inAppEnabled}
                          disabled={controlsDisabled}
                          onCheckedChange={(v) => setDraftPreference(row.alertType, "inApp", v)}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2 py-3">
                        <span className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Email
                        </span>
                        <Switch
                          aria-label={`${row.label} email`}
                          checked={pref.emailEnabled}
                          disabled={controlsDisabled}
                          onCheckedChange={(v) => setDraftPreference(row.alertType, "email", v)}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-2 py-3">
                        <span className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          SMS
                        </span>
                        <Switch
                          checked={false}
                          disabled
                          aria-label={`${row.label} SMS (inactive)`}
                        />
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
                      <Switch
                        aria-label={`${row.label} in-app`}
                        checked={pref.inAppEnabled}
                        disabled={controlsDisabled}
                        onCheckedChange={(v) => setDraftPreference(row.alertType, "inApp", v)}
                      />
                    </div>
                    <div className="flex w-14 justify-center">
                      <Switch
                        aria-label={`${row.label} email`}
                        checked={pref.emailEnabled}
                        disabled={controlsDisabled}
                        onCheckedChange={(v) => setDraftPreference(row.alertType, "email", v)}
                      />
                    </div>
                    <div className="flex w-12 justify-center">
                      <Switch checked={false} disabled aria-label={`${row.label} SMS (inactive)`} />
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
            <Switch
              aria-label="Email digest enabled"
              checked={digest.digestEnabled}
              disabled={controlsDisabled || !draftBundle}
              onCheckedChange={(v) => {
                setDraftBundle((prev) => {
                  if (!prev) return prev
                  return { ...prev, digest: { ...prev.digest, digestEnabled: v } }
                })
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
                    disabled={controlsDisabled || !draftBundle}
                    onClick={() => {
                      setDraftBundle((prev) => {
                        if (!prev) return prev
                        return { ...prev, digest: { ...prev.digest, digestFrequency: freq } }
                      })
                    }}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-all",
                      digest.digestFrequency === freq ?
                        "border-primary bg-primary/8 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary/60",
                      controlsDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
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
                disabled={controlsDisabled || !draftBundle}
                onChange={(e) => {
                  setDraftBundle((prev) => {
                    if (!prev) return prev
                    return { ...prev, digest: { ...prev.digest, digestTimeLocal: e.target.value } }
                  })
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
            <Switch
              aria-label="Quiet hours enabled"
              checked={digest.quietHoursEnabled}
              disabled={controlsDisabled || !draftBundle}
              onCheckedChange={(v) => {
                setDraftBundle((prev) => {
                  if (!prev) return prev
                  const d = prev.digest
                  return {
                    ...prev,
                    digest: {
                      ...d,
                      quietHoursEnabled: v,
                      quietHoursStartLocal: v ? (d.quietHoursStartLocal ?? "22:00") : null,
                      quietHoursEndLocal: v ? (d.quietHoursEndLocal ?? "07:00") : null,
                    },
                  }
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
              disabled={controlsDisabled || !draftBundle}
              onChange={(e) => {
                setDraftBundle((prev) => {
                  if (!prev) return prev
                  return { ...prev, digest: { ...prev.digest, quietHoursStartLocal: e.target.value } }
                })
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
              disabled={controlsDisabled || !draftBundle}
              onChange={(e) => {
                setDraftBundle((prev) => {
                  if (!prev) return prev
                  return { ...prev, digest: { ...prev.digest, quietHoursEndLocal: e.target.value } }
                })
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

      {showNotifPrefsDebug ?
        <Alert className="border-dashed">
          <AlertTitle className="text-xs font-mono">Notification prefs — development diagnostics</AlertTitle>
          <AlertDescription className="space-y-1 font-mono text-[11px] leading-relaxed">
            <div>organizationId present: {organizationId ? "yes" : "no"}</div>
            <div>persistenceReady: {String(persistenceReady)}</div>
            <div>permission status (permStatus): {permStatus}</div>
            <div>canManageWorkspaceSettings: {String(permissions.canManageWorkspaceSettings)}</div>
            <div>canMutate: {String(canMutate)}</div>
            <div>mutateBlockReason: {mutateBlockReason ?? "null (can save)"}</div>
            <div>last GET HTTP status: {devTransport.lastGetStatus ?? "—"}</div>
            <div>last PATCH HTTP status: {devTransport.lastPatchStatus ?? "—"}</div>
            <div>
              last PATCH payload preview:{" "}
              {devTransport.lastPatchPayloadCounts ?
                `preferences=${devTransport.lastPatchPayloadCounts.preferenceRows}, digestFieldCount=${devTransport.lastPatchPayloadCounts.digestFields}`
              : "—"}
            </div>
            <div>last save result: {devTransport.lastSaveResult}</div>
            <div>isDirty: {String(isDirty)}</div>
          </AlertDescription>
        </Alert>
      : null}

      {/* Temporary deploy/render proof — remove after confirming production shows this route */}
      <p
        className="mt-2 text-center text-[10px] text-muted-foreground"
        data-equipify-notifications-settings="v2"
      >
        Notifications settings v2
      </p>
    </div>
  )
}
