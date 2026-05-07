"use client"

/**
 * Workflow Automations Phase 1 — manager-friendly builder UI.
 *
 * The underlying engine, table, and JSON shapes are unchanged. This
 * component is purely presentational polish on top:
 *   - Triggers are pulled from `lib/workflows/trigger-catalog.ts` so the
 *     dropdown, descriptions, field-paths cheat sheet, and sample
 *     conditions stay in lockstep.
 *   - Actions are pulled from `lib/workflows/action-catalog.ts` and
 *     rendered as a click-to-insert helper alongside the JSON editor.
 *   - The list table now surfaces last-run timestamp + a "recent
 *     failures" badge from the new server-side stats.
 *
 * No new API contracts; no new tables. Everything saves through the
 * existing `/workflow-automations` routes.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { cn } from "@/lib/utils"
import type { WorkflowActionType, WorkflowTriggerType } from "@/lib/workflows/types"
import {
  TRIGGER_CATALOG,
  TRIGGER_CATALOG_ORDER,
  TRIGGER_GROUP_LABELS,
  triggerLabel,
} from "@/lib/workflows/trigger-catalog"
import {
  ACTION_CATALOG,
  ACTION_CATALOG_ORDER,
  actionFitsTrigger,
  actionLabel,
} from "@/lib/workflows/action-catalog"

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
    error_message?: string | null
  } | null
  recent_runs_count?: number
  recent_failure_count?: number
  recent_window_days?: number
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

/** Group the trigger catalog into sections for the optgroup dropdown. */
const TRIGGER_GROUPS = (() => {
  const map = new Map<string, WorkflowTriggerType[]>()
  for (const id of TRIGGER_CATALOG_ORDER) {
    const group = TRIGGER_CATALOG[id].group
    const arr = map.get(group) ?? []
    arr.push(id)
    map.set(group, arr)
  }
  return Array.from(map.entries())
})()

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
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>("prospect_status_changed")
  const [conditionJson, setConditionJson] = useState(DEFAULT_CONDITION)
  const [actionJson, setActionJson] = useState(DEFAULT_ACTIONS)

  const triggerEntry = TRIGGER_CATALOG[triggerType]

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
    setTriggerType("prospect_status_changed")
    setConditionJson(TRIGGER_CATALOG.prospect_status_changed.sampleCondition)
    setActionJson(DEFAULT_ACTIONS)
    setError(null)
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
    setError(null)
    setEditorOpen(true)
  }

  function handleTriggerChange(next: WorkflowTriggerType) {
    setTriggerType(next)
    // Only seed the sample condition when the user hasn't customized
    // beyond the default — saves them from losing pasted conditions while
    // still steering new rules toward a working starting point.
    const trimmed = conditionJson.trim()
    const isPristine =
      trimmed === DEFAULT_CONDITION.trim() ||
      Object.values(TRIGGER_CATALOG).some((t) => t.sampleCondition.trim() === trimmed)
    if (isPristine) {
      setConditionJson(TRIGGER_CATALOG[next].sampleCondition)
    }
  }

  function insertActionSnippet(actionId: WorkflowActionType) {
    const meta = ACTION_CATALOG[actionId]
    let parsed: { actions?: unknown }
    try {
      parsed = JSON.parse(actionJson) as { actions?: unknown }
    } catch {
      // If the JSON is broken we replace it cleanly with a fresh actions
      // array seeded with the new snippet.
      setActionJson(JSON.stringify({ actions: [JSON.parse(meta.sampleSnippet)] }, null, 2))
      return
    }
    const list = Array.isArray(parsed.actions) ? parsed.actions : []
    let snippet: unknown
    try {
      snippet = JSON.parse(meta.sampleSnippet)
    } catch {
      snippet = { type: actionId }
    }
    setActionJson(JSON.stringify({ ...parsed, actions: [...list, snippet] }, null, 2))
  }

  async function saveEditor() {
    if (!orgId || !name.trim()) return
    let condition_config: Record<string, unknown>
    let action_config: Record<string, unknown>
    try {
      condition_config = JSON.parse(conditionJson) as Record<string, unknown>
      action_config = JSON.parse(actionJson) as Record<string, unknown>
    } catch {
      setError("Conditions or actions JSON is invalid. Check the highlighted fields.")
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
    const res = await fetch(`/api/organizations/${orgId}/workflow-automations/${id}`, {
      method: "DELETE",
    })
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

  const failingRowCount = rows.reduce(
    (n, r) => n + ((r.recent_failure_count ?? 0) > 0 ? 1 : 0),
    0,
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Workflow rules</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            Event-driven automations: when something happens (a prospect moves to Quoted, an invoice
            goes overdue, a maintenance plan comes due), run a short list of actions
            (notify a teammate, queue an AI follow-up, create a task). Requires Growth or Scale (or
            trial).
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

      {failingRowCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {failingRowCount} automation{failingRowCount === 1 ? " has" : "s have"} failed at least once
          in the last 14 days. Open them to review the latest error.
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading automations…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-8 text-center">
          No workflow automations yet. Create one to react to prospect status changes, work orders,
          invoices, or maintenance events.
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
                <th className="px-3 py-2">Last 14 days</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const failures = r.recent_failure_count ?? 0
                const total = r.recent_runs_count ?? 0
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="truncate">{r.name}</span>
                        {r.description ? (
                          <span className="text-[11px] text-muted-foreground truncate">
                            {r.description}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border",
                          r.enabled
                            ? "border-[color:var(--status-success)] text-[color:var(--status-success)]"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {r.enabled ? "On" : "Off"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {triggerLabel(r.trigger_type)}
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
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium text-destructive"
                          title={r.last_run.error_message ?? undefined}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{r.last_run.status}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <span className="tabular-nums">{total} run{total === 1 ? "" : "s"}</span>
                        {failures > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-destructive/40 text-destructive"
                          >
                            {failures} failed
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeRow(r.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit automation" : "New automation"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Name</span>
              <input
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Notify when a quoted prospect is won"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Description</span>
              <textarea
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm min-h-[52px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this automation do, in your own words?"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Enabled
            </label>

            {/* Trigger picker + description */}
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground">Trigger</span>
                <select
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  value={triggerType}
                  onChange={(e) => handleTriggerChange(e.target.value as WorkflowTriggerType)}
                >
                  {TRIGGER_GROUPS.map(([group, ids]) => (
                    <optgroup
                      key={group}
                      label={TRIGGER_GROUP_LABELS[group as keyof typeof TRIGGER_GROUP_LABELS]}
                    >
                      {ids.map((id) => {
                        const meta = TRIGGER_CATALOG[id]
                        const suffix =
                          meta.availability === "new"
                            ? " · NEW"
                            : meta.availability === "experimental"
                              ? " · experimental"
                              : ""
                        return (
                          <option key={id} value={id}>
                            {meta.label}
                            {suffix}
                          </option>
                        )
                      })}
                    </optgroup>
                  ))}
                </select>
              </label>

              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="text-foreground">
                    <strong>{triggerEntry.label}.</strong>
                    {triggerEntry.availability === "new" ? (
                      <Badge
                        variant="outline"
                        className="ml-1.5 text-[10px] border-primary/40 text-primary"
                      >
                        New
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground mt-1">{triggerEntry.description}</p>
                </div>
              </div>
            </div>

            {/* Condition fields cheat sheet */}
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground">Conditions (JSON)</span>
                <textarea
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono min-h-[110px]"
                  value={conditionJson}
                  onChange={(e) => setConditionJson(e.target.value)}
                />
              </label>
              {triggerEntry.fieldRefs.length > 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Available fields
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                    {triggerEntry.fieldRefs.map((f) => (
                      <li key={f.path} className="leading-snug">
                        <code className="text-[11px] font-medium text-foreground">{f.path}</code>
                        <span className="text-muted-foreground"> · {f.description}</span>
                        {f.enumValues ? (
                          <span className="block text-[10px] text-muted-foreground/80">
                            Allowed: {f.enumValues.join(", ")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-muted-foreground/80 mt-2">
                    Operators: <code>eq</code>, <code>neq</code>, <code>in</code>, <code>gte</code>,{" "}
                    <code>lte</code>, <code>contains</code>. Combine with <code>operator: "and"</code>{" "}
                    or <code>"or"</code>.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Actions: click-to-insert helpers */}
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground">Actions (JSON)</span>
                <textarea
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono min-h-[140px]"
                  value={actionJson}
                  onChange={(e) => setActionJson(e.target.value)}
                />
              </label>
              <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Insert action
                </p>
                <ul className="flex flex-col gap-1.5">
                  {ACTION_CATALOG_ORDER.map((id) => {
                    const meta = ACTION_CATALOG[id]
                    const fits = actionFitsTrigger(id, triggerType)
                    const tone =
                      meta.availability === "live"
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                        : meta.availability === "logged"
                          ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                          : "border-border text-muted-foreground"
                    return (
                      <li key={id} className="flex items-start gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1 shrink-0"
                          onClick={() => insertActionSnippet(id)}
                          disabled={meta.availability === "coming_soon"}
                        >
                          <Plus className="w-3 h-3" /> {actionLabel(id)}
                        </Button>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {meta.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="outline" className={cn("text-[10px]", tone)}>
                              {meta.availability === "live"
                                ? "Live"
                                : meta.availability === "logged"
                                  ? "Logged only"
                                  : "Coming soon"}
                            </Badge>
                            {!meta.autoSafe ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300"
                              >
                                Sends to customers — review before enabling
                              </Badge>
                            ) : null}
                            {!fits ? (
                              <Badge variant="outline" className="text-[10px]">
                                Unusual fit for this trigger
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            {/* Growth roadmap teaser inside the editor */}
            <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
              <span>
                Coming soon under <strong>Growth</strong>: review &amp; referral asks, AI nurture
                sequences, and templated marketing campaigns built on top of these rules.
              </span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveEditor} disabled={saving || !name.trim()}>
              {saving ? (
                <>
                  <Clock className="w-3.5 h-3.5 mr-1 animate-pulse" /> Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
