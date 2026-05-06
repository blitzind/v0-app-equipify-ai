"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, AlertCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { cn } from "@/lib/utils"
import type { WorkflowTriggerType } from "@/lib/workflows/types"

const TRIGGER_LABELS: Record<WorkflowTriggerType, string> = {
  work_order_created: "Work order created",
  work_order_completed: "Work order completed",
  work_order_status_changed: "Work order status changed",
  maintenance_due: "Maintenance due (PM)",
  invoice_overdue: "Invoice overdue",
  quote_accepted: "Quote accepted",
  equipment_warranty_expiring: "Equipment warranty expiring",
  certificate_uploaded: "Certificate uploaded",
  ai_assistant_digest_ready: "AI operational assistant digest ready",
}

const TRIGGER_OPTIONS = Object.entries(TRIGGER_LABELS) as [WorkflowTriggerType, string][]

type AutomationRow = {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger_type: WorkflowTriggerType
  trigger_config: Record<string, unknown>
  condition_config: Record<string, unknown>
  action_config: Record<string, unknown>
  updated_at: string
  last_run?: {
    status: string
    started_at: string
    completed_at: string | null
  } | null
}

const DEFAULT_CONDITION = `{
  "operator": "and",
  "rules": []
}`

const DEFAULT_ACTIONS = `{
  "actions": [
    {
      "type": "notify_internal_user",
      "config": {
        "title": "Automation",
        "summary": "A workflow ran for your organization."
      }
    }
  ]
}`

export function WorkflowAutomationsSection() {
  const org = useActiveOrganization()
  const orgId = org.status === "ready" ? org.organizationId : null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AutomationRow[]>([])
  const [planOk, setPlanOk] = useState(true)

  const [editorOpen, setEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>("work_order_status_changed")
  const [conditionJson, setConditionJson] = useState(DEFAULT_CONDITION)
  const [actionJson, setActionJson] = useState(DEFAULT_ACTIONS)

  const load = useCallback(async () => {
    if (!orgId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${orgId}/workflow-automations`)
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as {
        automations: AutomationRow[]
        automationAllowed?: boolean
      }
      setRows(data.automations ?? [])
      setPlanOk(data.automationAllowed !== false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditingId(null)
    setName("")
    setDescription("")
    setEnabled(true)
    setTriggerType("work_order_status_changed")
    setConditionJson(DEFAULT_CONDITION)
    setActionJson(DEFAULT_ACTIONS)
    setEditorOpen(true)
  }

  function openEdit(row: AutomationRow) {
    setEditingId(row.id)
    setName(row.name)
    setDescription(row.description ?? "")
    setEnabled(row.enabled)
    setTriggerType(row.trigger_type)
    setConditionJson(JSON.stringify(row.condition_config ?? { operator: "and", rules: [] }, null, 2))
    setActionJson(JSON.stringify(row.action_config ?? { actions: [] }, null, 2))
    setEditorOpen(true)
  }

  async function saveEditor() {
    if (!orgId || !name.trim()) return
    let condition_config: Record<string, unknown>
    let action_config: Record<string, unknown>
    try {
      condition_config = JSON.parse(conditionJson) as Record<string, unknown>
      action_config = JSON.parse(actionJson) as Record<string, unknown>
    } catch {
      setError("Invalid JSON in conditions or actions.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const url = editingId
        ? `/api/organizations/${orgId}/workflow-automations/${editingId}`
        : `/api/organizations/${orgId}/workflow-automations`
      const method = editingId ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          enabled,
          trigger_type: triggerType,
          condition_config,
          action_config,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      setEditorOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function removeRow(id: string) {
    if (!orgId) return
    if (!confirm("Delete this automation?")) return
    const res = await fetch(`/api/organizations/${orgId}/workflow-automations/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      setError(j.error ?? "Delete failed")
      return
    }
    await load()
  }

  if (!orgId) {
    return (
      <p className="text-sm text-muted-foreground border border-border rounded-lg px-4 py-3">
        Select an organization to manage workflow automations.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Workflow rules</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            Event-driven automations: triggers, optional conditions, and actions (notify team, queue AI tasks, create
            follow-ups, and more). Requires Growth or Scale (or trial).
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreate} disabled={!planOk || loading}>
          <Plus className="w-3.5 h-3.5" /> New automation
        </Button>
      </div>

      {!planOk && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          Workflow automation is available on Growth and Scale plans. Upgrade to create rules.
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading automations…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-8 text-center">
          No workflow automations yet. Create one to react to work orders, invoices, or maintenance events.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">On</th>
                <th className="px-3 py-2">Trigger</th>
                <th className="px-3 py-2">Last run</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.name}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border",
                        r.enabled ? "border-[color:var(--status-success)] text-[color:var(--status-success)]" : "border-border text-muted-foreground",
                      )}
                    >
                      {r.enabled ? "On" : "Off"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {TRIGGER_LABELS[r.trigger_type] ?? r.trigger_type}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.last_run
                      ? new Date(r.last_run.started_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {!r.last_run ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : r.last_run.status === "completed" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--status-success)]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> OK
                      </span>
                    ) : r.last_run.status === "failed" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                        <XCircle className="w-3.5 h-3.5" /> Failed
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{r.last_run.status}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRow(r.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit automation" : "New automation"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Name</span>
              <input
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Notify when WO completes"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Description</span>
              <textarea
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm min-h-[52px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enabled
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Trigger</span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as WorkflowTriggerType)}
              >
                {TRIGGER_OPTIONS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Conditions (JSON)</span>
              <textarea
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono min-h-[100px]"
                value={conditionJson}
                onChange={(e) => setConditionJson(e.target.value)}
              />
              <span className="text-[10px] text-muted-foreground">
                Example rule field paths: <code className="text-[10px]">work_order.status</code>,{" "}
                <code className="text-[10px]">invoice.days_overdue</code>, <code className="text-[10px]">invoice.amount_cents</code>.
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Actions (JSON)</span>
              <textarea
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono min-h-[120px]"
                value={actionJson}
                onChange={(e) => setActionJson(e.target.value)}
              />
              <span className="text-[10px] text-muted-foreground">
                Types: notify_internal_user, send_email, assign_technician, update_status, create_followup_task, create_work_order,
                create_ai_task, send_sms (logged only).
              </span>
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveEditor} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
