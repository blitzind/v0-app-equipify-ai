"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, BellRing, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { INTERNAL_NOTIFICATION_EVENT_LABELS } from "@/lib/internal-notifications/labels"
import { INTERNAL_NOTIFICATION_EVENT_TYPES, type InternalNotificationEventType } from "@/lib/internal-notifications/types"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { cn } from "@/lib/utils"

type RuleRow = {
  id: string
  name: string
  event_type: InternalNotificationEventType
  enabled: boolean
  threshold_minutes: number | null
  warning_minutes: number | null
  target_roles: string[] | null
}

type CandidateRow = {
  dedupeKey: string
  eventType: InternalNotificationEventType
  title: string
  body: string
  severity: string
  href?: string | null
}

export function InternalEscalationRulesPanel({ organizationId }: { organizationId: string }) {
  const { toast } = useToast()
  const { permissions } = useOrgPermissions()
  const canManage = Boolean(permissions.canManageWorkspaceSettings)

  const [rules, setRules] = useState<RuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<CandidateRow[] | null>(null)
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [logLoading, setLogLoading] = useState(false)
  const [logItems, setLogItems] = useState<Array<CandidateRow & { lastSeenAt?: string }> | null>(null)

  const [draftName, setDraftName] = useState("")
  const [draftEvent, setDraftEvent] = useState<InternalNotificationEventType>("work_order_overdue")
  const [draftThreshold, setDraftThreshold] = useState("1440")
  const [draftWarning, setDraftWarning] = useState("240")
  const [draftRoles, setDraftRoles] = useState("")
  const [creating, setCreating] = useState(false)

  const loadRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/internal-notification-rules`, {
        method: "GET",
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; rules?: RuleRow[]; message?: string }
      if (!res.ok || !data.ok || !Array.isArray(data.rules)) {
        throw new Error(data.message ?? "Could not load rules.")
      }
      setRules(data.rules)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load rules."
      toast({ variant: "destructive", title: "Rules unavailable", description: msg })
      setRules([])
    } finally {
      setLoading(false)
    }
  }, [organizationId, toast])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const runPreview = useCallback(async () => {
    setCandidatesLoading(true)
    setCandidates(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/internal-notifications/candidates`,
        { method: "GET" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        candidates?: CandidateRow[]
        message?: string
      }
      if (!res.ok || !data.ok || !Array.isArray(data.candidates)) {
        throw new Error(data.message ?? "Could not evaluate.")
      }
      setCandidates(data.candidates)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not evaluate."
      toast({ variant: "destructive", title: "Preview failed", description: msg })
    } finally {
      setCandidatesLoading(false)
    }
  }, [organizationId, toast])

  const runLoadLog = useCallback(async () => {
    setLogLoading(true)
    setLogItems(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/internal-notifications/log?limit=60`,
        { method: "GET" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        items?: Array<CandidateRow & { lastSeenAt?: string }>
        message?: string
      }
      if (!res.ok || !data.ok || !Array.isArray(data.items)) {
        throw new Error(data.message ?? "Could not load log.")
      }
      setLogItems(data.items)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load log."
      toast({ variant: "destructive", title: "Log unavailable", description: msg })
    } finally {
      setLogLoading(false)
    }
  }, [organizationId, toast])

  const runSyncLog = useCallback(async () => {
    if (!canManage) return
    setCandidatesLoading(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/internal-notifications/candidates?syncLog=1`,
        { method: "GET" },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Sync failed.")
      }
      toast({ title: "Log updated", description: "Internal notification log refreshed (non-financial events)." })
      void runLoadLog()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed."
      toast({ variant: "destructive", title: "Sync failed", description: msg })
    } finally {
      setCandidatesLoading(false)
    }
  }, [canManage, organizationId, toast, runLoadLog])

  const toggleEnabled = async (rule: RuleRow) => {
    if (!canManage) return
    setBusyId(rule.id)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/internal-notification-rules/${encodeURIComponent(rule.id)}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !rule.enabled }) },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Update failed.")
      await loadRules()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not update rule",
        description: e instanceof Error ? e.message : "Update failed.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const deleteRule = async (ruleId: string) => {
    if (!canManage) return
    if (!window.confirm("Delete this internal notification rule?")) return
    setBusyId(ruleId)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/internal-notification-rules/${encodeURIComponent(ruleId)}`,
        { method: "DELETE" },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Delete failed.")
      await loadRules()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not delete",
        description: e instanceof Error ? e.message : "Delete failed.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const createRule = async () => {
    if (!canManage) return
    const name = draftName.trim()
    if (!name) {
      toast({ variant: "destructive", title: "Name required", description: "Enter a short rule name." })
      return
    }
    const threshold = draftThreshold.trim() ? Number.parseInt(draftThreshold, 10) : null
    const warning = draftWarning.trim() ? Number.parseInt(draftWarning, 10) : null
    const roles = draftRoles
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    setCreating(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/internal-notification-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          eventType: draftEvent,
          enabled: true,
          thresholdMinutes: Number.isFinite(threshold) ? threshold : null,
          warningMinutes: Number.isFinite(warning) ? warning : null,
          targetRoles: roles.length ? roles : null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Create failed.")
      setDraftName("")
      await loadRules()
      toast({ title: "Rule created", description: "Enable preview to see internal notification candidates." })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not create rule",
        description: e instanceof Error ? e.message : "Create failed.",
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border bg-muted/25 dark:bg-muted/10 px-5 py-4 space-y-1">
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold text-foreground">Internal escalation rules</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
          Configure which operational events raise <span className="font-medium text-foreground">in-app</span>{" "}
          notifications for your team. No customer-facing messages are sent from this phase. Invoice alerts require
          financial visibility and are never written to the shared log.
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {loading ?
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="size-4 animate-spin" />
            Loading rules…
          </div>
        : rules.length === 0 ?
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">No rules yet</p>
                <p className="mt-1 leading-relaxed">
                  Add a rule below to start generating internal notification candidates. Nothing fires until a rule exists
                  and is enabled.
                </p>
              </div>
            </div>
          </div>
        : <ul className="divide-y divide-border rounded-lg border border-border">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {INTERNAL_NOTIFICATION_EVENT_LABELS[r.event_type]}
                    {r.threshold_minutes != null ? ` · threshold ${r.threshold_minutes}m` : ""}
                    {r.warning_minutes != null ? ` · warn ${r.warning_minutes}m` : ""}
                  </p>
                </div>
                {canManage ?
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant={r.enabled ? "secondary" : "outline"}
                      className="h-8 text-xs"
                      disabled={busyId === r.id}
                      onClick={() => void toggleEnabled(r)}
                    >
                      {r.enabled ? "Enabled" : "Disabled"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-destructive"
                      disabled={busyId === r.id}
                      onClick={() => void deleteRule(r.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                : null}
              </li>
            ))}
          </ul>
        }

        {canManage ?
          <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add rule</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. SR SLA 24h" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Event</label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={draftEvent}
                  onChange={(e) => setDraftEvent(e.target.value as InternalNotificationEventType)}
                >
                  {INTERNAL_NOTIFICATION_EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {INTERNAL_NOTIFICATION_EVENT_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Threshold (minutes)</label>
                <Input
                  value={draftThreshold}
                  onChange={(e) => setDraftThreshold(e.target.value)}
                  placeholder="e.g. 1440 for 24h"
                />
                <p className="text-[10px] text-muted-foreground">Used for SLA, unassigned age, quote lookback, etc.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Warning (minutes, SLA at-risk)</label>
                <Input value={draftWarning} onChange={(e) => setDraftWarning(e.target.value)} placeholder="e.g. 240" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Target roles (optional)</label>
                <Input
                  value={draftRoles}
                  onChange={(e) => setDraftRoles(e.target.value)}
                  placeholder="owner, admin, manager (comma-separated)"
                />
              </div>
            </div>
            <Button type="button" size="sm" className="gap-1.5" disabled={creating} onClick={() => void createRule()}>
              {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Create rule
            </Button>
          </div>
        : <p className="text-xs text-muted-foreground">
            Only workspace managers can edit internal escalation rules. You can still preview candidates for your role
            and assignment scope.
          </p>
        }

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" className="gap-1.5" disabled={candidatesLoading} onClick={() => void runPreview()}>
            {candidatesLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Preview candidates
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={logLoading} onClick={() => void runLoadLog()}>
            {logLoading ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Load log
          </Button>
          {canManage ?
            <Button type="button" variant="outline" size="sm" disabled={candidatesLoading} onClick={() => void runSyncLog()}>
              Sync log (managers)
            </Button>
          : null}
        </div>

        {candidates && candidates.length === 0 ?
          <p className="text-xs text-muted-foreground py-2">No matching candidates for your visibility and scope.</p>
        : null}
        {candidates && candidates.length > 0 ?
          <div className="rounded-lg border border-border divide-y divide-border max-h-64 overflow-y-auto">
            {candidates.map((c) => (
              <div key={c.dedupeKey} className="px-3 py-2.5 text-xs space-y-0.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{c.title}</span>
                  <span
                    className={cn(
                      "text-[10px] uppercase font-semibold",
                      c.severity === "critical" ? "text-destructive"
                      : c.severity === "warning" ? "text-amber-700 dark:text-amber-300"
                      : "text-muted-foreground",
                    )}
                  >
                    {c.severity}
                  </span>
                </div>
                <p className="text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        : null}

        {logItems && logItems.length === 0 ?
          <p className="text-xs text-muted-foreground">Log is empty — run preview then sync as a manager.</p>
        : null}
        {logItems && logItems.length > 0 ?
          <div className="rounded-lg border border-border divide-y divide-border max-h-48 overflow-y-auto">
            {logItems.map((c) => (
              <div key={c.dedupeKey} className="px-3 py-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{c.title}</span>
                {c.lastSeenAt ? ` · ${new Date(c.lastSeenAt).toLocaleString()}` : ""}
              </div>
            ))}
          </div>
        : null}
      </div>
    </div>
  )
}
