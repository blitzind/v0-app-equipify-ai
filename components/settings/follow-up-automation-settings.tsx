"use client"

import { useCallback, useEffect, useState } from "react"
import { ClipboardList, Loader2, Play, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import type { FollowUpAutomationConfig } from "@/lib/follow-up-automation/types"
import { cn } from "@/lib/utils"

function NumInput({
  value,
  onChange,
  min,
  max,
  id,
  disabled,
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  id: string
  disabled?: boolean
}) {
  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
    />
  )
}

export function FollowUpAutomationSettingsSection() {
  const { toast } = useToast()
  const { organizationId, status } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const canConfigure = Boolean(permissions.canManageWorkspaceSettings)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [evalRunning, setEvalRunning] = useState(false)
  const [cfg, setCfg] = useState<FollowUpAutomationConfig | null>(null)
  const [assignees, setAssignees] = useState<{ id: string; label: string }[]>([])

  const load = useCallback(async () => {
    if (!organizationId || status !== "ready" || !canConfigure) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/follow-up-automation/settings`, {
        cache: "no-store",
      })
      const body = (await res.json()) as { config?: FollowUpAutomationConfig; error?: string }
      if (!res.ok) throw new Error(body.error ?? "Could not load settings.")
      if (body.config) setCfg(body.config)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not load reminder automation settings",
        description: e instanceof Error ? e.message : "Unexpected error.",
      })
    } finally {
      setLoading(false)
    }
  }, [organizationId, status, canConfigure, toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!organizationId || status !== "ready" || !canConfigure) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/prospect-assignees`,
          { cache: "no-store" },
        )
        const j = (await res.json().catch(() => ({}))) as { assignees?: { id: string; label: string }[] }
        if (!cancelled && res.ok && Array.isArray(j.assignees)) setAssignees(j.assignees)
      } catch {
        if (!cancelled) setAssignees([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, status, canConfigure])

  async function save() {
    if (!organizationId || !cfg) return
    setSaving(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/follow-up-automation/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? "Save failed.")
      toast({ title: "Automation settings saved" })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  async function runEvaluate() {
    if (!organizationId) return
    setEvalRunning(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/follow-up-tasks/evaluate`, {
        method: "POST",
      })
      const body = (await res.json()) as { inserted?: number; skippedDuplicates?: number; error?: string }
      if (!res.ok) throw new Error(body.error ?? "Evaluation failed.")
      toast({
        title: "Evaluation complete",
        description: `Queued ${body.inserted ?? 0} new tasks (${body.skippedDuplicates ?? 0} duplicates skipped).`,
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Evaluation failed",
        description: e instanceof Error ? e.message : "Unexpected error.",
      })
    } finally {
      setEvalRunning(false)
    }
  }

  if (!canConfigure) return null

  if (loading || !cfg) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading reminder automation settings…
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Follow-up & reminder automation</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Suggested reminders stay in a review queue until your team approves and hands off to Communications.
              No autonomous outbound sending.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={evalRunning} onClick={() => void runEvaluate()}>
            {evalRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run evaluation now
          </Button>
          <Button type="button" size="sm" className="gap-1.5" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>

      <div className="px-5 py-5 flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["prospects", "Prospects & pipeline", cfg.categories.prospects],
              ["work_orders", "Work orders", cfg.categories.work_orders],
              ["invoices", "Invoices", cfg.categories.invoices],
              ["customers", "Customers", cfg.categories.customers],
              ["equipment", "Equipment", cfg.categories.equipment],
            ] as const
          ).map(([key, label, cat]) => (
            <div key={key} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <Switch
                  checked={cat.enabled}
                  onCheckedChange={(v) =>
                    setCfg({
                      ...cfg,
                      categories: { ...cfg.categories, [key]: { ...cat, enabled: v } },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">AI drafts</Label>
                <Switch
                  checked={cat.aiDraftsEnabled}
                  disabled={!cat.enabled}
                  onCheckedChange={(v) =>
                    setCfg({
                      ...cfg,
                      categories: { ...cfg.categories, [key]: { ...cat, aiDraftsEnabled: v } },
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Maintenance reminders</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Plans, service intervals, calibration, and warranty windows — tasks appear in the follow-up queue for approval.
                Nothing sends automatically.
              </p>
            </div>
            <Switch
              checked={cfg.maintenanceReminders.enabled}
              onCheckedChange={(v) =>
                setCfg({ ...cfg, maintenanceReminders: { ...cfg.maintenanceReminders, enabled: v } })
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 opacity-100">
            <Label className="text-xs text-muted-foreground">AI drafts for maintenance messages</Label>
            <Switch
              checked={cfg.maintenanceReminders.aiDraftsEnabled}
              disabled={!cfg.maintenanceReminders.enabled}
              onCheckedChange={(v) =>
                setCfg({
                  ...cfg,
                  maintenanceReminders: { ...cfg.maintenanceReminders, aiDraftsEnabled: v },
                })
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs text-muted-foreground">Due soon window (days)</Label>
              <NumInput
                id="mr1"
                min={1}
                max={365}
                value={cfg.maintenanceReminders.dueSoonDays}
                disabled={!cfg.maintenanceReminders.enabled}
                onChange={(n) =>
                  setCfg({
                    ...cfg,
                    maintenanceReminders: { ...cfg.maintenanceReminders, dueSoonDays: n },
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Overdue threshold (days past due)</Label>
              <NumInput
                id="mr2"
                min={0}
                max={365}
                value={cfg.maintenanceReminders.overdueThresholdDays}
                disabled={!cfg.maintenanceReminders.enabled}
                onChange={(n) =>
                  setCfg({
                    ...cfg,
                    maintenanceReminders: { ...cfg.maintenanceReminders, overdueThresholdDays: n },
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Calibration due soon (days)</Label>
              <NumInput
                id="mr3"
                min={1}
                max={365}
                value={cfg.maintenanceReminders.calibrationDueSoonDays}
                disabled={!cfg.maintenanceReminders.enabled}
                onChange={(n) =>
                  setCfg({
                    ...cfg,
                    maintenanceReminders: { ...cfg.maintenanceReminders, calibrationDueSoonDays: n },
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Warranty expiring soon (days)</Label>
              <NumInput
                id="mr4"
                min={1}
                max={365}
                value={cfg.maintenanceReminders.warrantyDueSoonDays}
                disabled={!cfg.maintenanceReminders.enabled}
                onChange={(n) =>
                  setCfg({
                    ...cfg,
                    maintenanceReminders: { ...cfg.maintenanceReminders, warrantyDueSoonDays: n },
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reminder cadence (days, reserved)</Label>
              <NumInput
                id="mr5"
                min={0}
                max={90}
                value={cfg.maintenanceReminders.reminderCadenceDays}
                disabled={!cfg.maintenanceReminders.enabled}
                onChange={(n) =>
                  setCfg({
                    ...cfg,
                    maintenanceReminders: { ...cfg.maintenanceReminders, reminderCadenceDays: n },
                  })
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Draft channels</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Email</span>
                <Switch
                  checked={cfg.maintenanceReminders.draftChannels.includes("email")}
                  disabled={!cfg.maintenanceReminders.enabled}
                  onCheckedChange={(on) => {
                    const next = new Set(cfg.maintenanceReminders.draftChannels)
                    if (on) next.add("email")
                    else next.delete("email")
                    let channels = Array.from(next) as ("email" | "sms")[]
                    if (channels.length === 0) channels = ["email"]
                    setCfg({
                      ...cfg,
                      maintenanceReminders: { ...cfg.maintenanceReminders, draftChannels: channels },
                    })
                  }}
                />
                <span className="text-xs text-muted-foreground">SMS</span>
                <Switch
                  checked={cfg.maintenanceReminders.draftChannels.includes("sms")}
                  disabled={!cfg.maintenanceReminders.enabled}
                  onCheckedChange={(on) => {
                    const next = new Set(cfg.maintenanceReminders.draftChannels)
                    if (on) next.add("sms")
                    else next.delete("sms")
                    let channels = Array.from(next) as ("email" | "sms")[]
                    if (channels.length === 0) channels = ["email"]
                    setCfg({
                      ...cfg,
                      maintenanceReminders: { ...cfg.maintenanceReminders, draftChannels: channels },
                    })
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5 max-w-md">
            <Label className="text-xs text-muted-foreground">Default assignee (optional)</Label>
            <Select
              disabled={!cfg.maintenanceReminders.enabled}
              value={cfg.maintenanceReminders.defaultAssigneeUserId ?? "_none"}
              onValueChange={(v) =>
                setCfg({
                  ...cfg,
                  maintenanceReminders: {
                    ...cfg.maintenanceReminders,
                    defaultAssigneeUserId: v === "_none" ? null : v,
                  },
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-3">Thresholds</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs text-muted-foreground">Proposal no response (days)</Label>
              <NumInput
                id="t1"
                min={1}
                max={120}
                value={cfg.thresholds.prospectProposalNoResponseDays}
                onChange={(n) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, prospectProposalNoResponseDays: n } })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nurture inactive (days)</Label>
              <NumInput
                id="t2"
                min={1}
                max={365}
                value={cfg.thresholds.prospectNurtureInactiveDays}
                onChange={(n) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, prospectNurtureInactiveDays: n } })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">WO signature pending (hours)</Label>
              <NumInput
                id="t3"
                min={1}
                max={720}
                value={cfg.thresholds.woSignaturePendingHours}
                onChange={(n) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, woSignaturePendingHours: n } })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">WO completed follow-up (days)</Label>
              <NumInput
                id="t4"
                min={1}
                max={365}
                value={cfg.thresholds.woCompletedFollowupDays}
                onChange={(n) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, woCompletedFollowupDays: n } })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Invoice due soon window (days)</Label>
              <NumInput
                id="t5"
                min={1}
                max={90}
                value={cfg.thresholds.invoiceDueSoonDays}
                onChange={(n) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, invoiceDueSoonDays: n } })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Customer stale — no completed WO (months)</Label>
              <NumInput
                id="t6"
                min={1}
                max={60}
                value={cfg.thresholds.customerStaleWoMonths}
                onChange={(n) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, customerStaleWoMonths: n } })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Equipment service due soon (days)</Label>
              <NumInput
                id="t7"
                min={1}
                max={365}
                value={cfg.thresholds.equipmentServiceDueSoonDays}
                onChange={(n) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, equipmentServiceDueSoonDays: n } })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Warranty expiring soon (days)</Label>
              <NumInput
                id="t8"
                min={1}
                max={365}
                value={cfg.thresholds.equipmentWarrantyExpiringDays}
                onChange={(n) =>
                  setCfg({ ...cfg, thresholds: { ...cfg.thresholds, equipmentWarrantyExpiringDays: n } })
                }
              />
            </div>
          </div>
        </div>

        <p className={cn("text-xs text-muted-foreground")}>
          Review suggested items under{" "}
          <a href="/communications/follow-ups" className="text-primary font-medium hover:underline">
            Communications → Follow-up queue
          </a>
          .
        </p>
      </div>
    </div>
  )
}
