"use client"

/**
 * Workflow Automations Phase 2 — visual builder dialog.
 *
 * Three-step editor (Trigger → Conditions → Actions) with a single
 * "Advanced JSON" collapsible at the bottom. The visual surface stays
 * in sync with the underlying JSON: every change parses through
 * `lib/workflows/visual-model.ts`, and the JSON tab can override the
 * visual tree when an advanced user wants to author non-visual rules.
 *
 * Key invariants:
 *   - The persisted JSON shape never changes (engine is untouched).
 *   - If parsing fails, the visual builder is disabled but the user's
 *     JSON is preserved verbatim (and the "Visual" tab shows an
 *     explanatory notice instead of silently rewriting their data).
 *   - "Run test" simulates against the existing automation; new (yet
 *     to be saved) automations route the user through Save first.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FlaskConical,
  History,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  TRIGGER_CATALOG,
  TRIGGER_CATALOG_ORDER,
  TRIGGER_GROUP_LABELS,
} from "@/lib/workflows/trigger-catalog"
import {
  makeEmptyConditionTree,
  makeVisualAction,
  parseActionConfig,
  parseConditionConfig,
  serializeActions,
  serializeConditionTree,
  type VisualAction,
  type VisualConditionTree,
} from "@/lib/workflows/visual-model"
import { samplePayloadJson } from "@/lib/workflows/sample-payloads"
import { buildAutomationSummary } from "@/lib/workflows/human-summary"
import { ACTION_CATALOG } from "@/lib/workflows/action-catalog"
import type { WorkflowActionType, WorkflowTriggerType } from "@/lib/workflows/types"
import { cn } from "@/lib/utils"
import { ConditionBuilder } from "./condition-builder"
import { ActionStack } from "./action-stack"
import { ActionPickerDialog } from "./action-picker-dialog"
import type { AutomationRow } from "./types"

const TRIGGER_GROUPS = (() => {
  const m = new Map<string, WorkflowTriggerType[]>()
  for (const id of TRIGGER_CATALOG_ORDER) {
    const g = TRIGGER_CATALOG[id].group
    const arr = m.get(g) ?? []
    arr.push(id)
    m.set(g, arr)
  }
  return Array.from(m.entries())
})()

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string | null
  /** When set, dialog is in edit mode. */
  editing: AutomationRow | null
  onSaved: () => void
  onRequestRunTest?: (automationId: string) => Promise<void> | void
  onRequestRunHistory?: (automationId: string, name: string) => void
}

type Step = "trigger" | "conditions" | "actions"

export function AutomationBuilderDialog({
  open,
  onOpenChange,
  organizationId,
  editing,
  onSaved,
  onRequestRunTest,
  onRequestRunHistory,
}: Props) {
  const [step, setStep] = useState<Step>("trigger")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>("prospect_status_changed")

  const [tree, setTree] = useState<VisualConditionTree>(() => makeEmptyConditionTree())
  const [conditionParseError, setConditionParseError] = useState<string | null>(null)

  const [actions, setActions] = useState<VisualAction[]>([])
  const [actionParseError, setActionParseError] = useState<string | null>(null)

  // Raw JSON the user can edit directly; mirrors the visual state.
  const [conditionJson, setConditionJson] = useState("")
  const [actionJson, setActionJson] = useState("")
  // When the JSON is being edited directly, suppress automatic
  // round-tripping so we don't fight the user's keystrokes.
  const editingJsonRef = useRef<"none" | "conditions" | "actions">("none")

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showPayload, setShowPayload] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conditionsValid, setConditionsValid] = useState<null | { ok: boolean; message: string }>(null)
  const [testing, setTesting] = useState(false)

  // Hydrate state when the dialog opens (or the editing target changes).
  useEffect(() => {
    if (!open) return
    setStep("trigger")
    setError(null)
    setConditionsValid(null)
    setShowAdvanced(false)
    setShowPayload(false)

    if (editing) {
      setName(editing.name)
      setDescription(editing.description ?? "")
      setEnabled(editing.enabled)
      setTriggerType(editing.trigger_type)
      setConditionJson(JSON.stringify(editing.condition_config ?? { operator: "and", rules: [] }, null, 2))
      setActionJson(JSON.stringify(editing.action_config ?? { actions: [] }, null, 2))
      const c = parseConditionConfig(editing.condition_config)
      if (c.lossless) {
        setTree(c.tree)
        setConditionParseError(null)
      } else {
        setTree(makeEmptyConditionTree())
        setConditionParseError(c.reason)
      }
      const a = parseActionConfig(editing.action_config)
      if (a.lossless) {
        setActions(a.actions)
        setActionParseError(null)
      } else {
        setActions([])
        setActionParseError(a.reason)
      }
    } else {
      setName("")
      setDescription("")
      setEnabled(true)
      setTriggerType("prospect_status_changed")
      setTree(makeEmptyConditionTree())
      setActions([])
      setConditionJson(JSON.stringify({ operator: "and", rules: [] }, null, 2))
      setActionJson(JSON.stringify({ actions: [] }, null, 2))
      setConditionParseError(null)
      setActionParseError(null)
    }
  }, [open, editing])

  // Visual → JSON
  useEffect(() => {
    if (editingJsonRef.current === "conditions") return
    setConditionJson(JSON.stringify(serializeConditionTree(tree), null, 2))
  }, [tree])
  useEffect(() => {
    if (editingJsonRef.current === "actions") return
    setActionJson(JSON.stringify(serializeActions(actions), null, 2))
  }, [actions])

  const triggerEntry = TRIGGER_CATALOG[triggerType]

  const summary = useMemo(
    () =>
      buildAutomationSummary({
        trigger_type: triggerType,
        condition_config: serializeConditionTree(tree),
        action_config: serializeActions(actions),
      }),
    [triggerType, tree, actions],
  )

  function handleConditionJsonChange(next: string) {
    editingJsonRef.current = "conditions"
    setConditionJson(next)
    try {
      const parsed = JSON.parse(next) as Record<string, unknown>
      const visual = parseConditionConfig(parsed)
      if (visual.lossless) {
        setTree(visual.tree)
        setConditionParseError(null)
      } else {
        setConditionParseError(visual.reason)
      }
    } catch {
      setConditionParseError("Invalid JSON in conditions.")
    }
  }
  function handleActionJsonChange(next: string) {
    editingJsonRef.current = "actions"
    setActionJson(next)
    try {
      const parsed = JSON.parse(next) as Record<string, unknown>
      const visual = parseActionConfig(parsed)
      if (visual.lossless) {
        setActions(visual.actions)
        setActionParseError(null)
      } else {
        setActionParseError(visual.reason)
      }
    } catch {
      setActionParseError("Invalid JSON in actions.")
    }
  }

  function pickAction(type: WorkflowActionType) {
    setActions((prev) => [...prev, makeVisualAction(type, defaultConfigFor(type))])
    setPickerOpen(false)
    setStep("actions")
    editingJsonRef.current = "none"
  }

  function validateConditionsAgainstSample() {
    setConditionsValid(null)
    try {
      const parsed = JSON.parse(conditionJson) as Record<string, unknown>
      const rulesRaw = (parsed as { rules?: unknown }).rules
      const rules = Array.isArray(rulesRaw) ? rulesRaw : []
      if (rules.length === 0) {
        setConditionsValid({ ok: true, message: "No conditions — actions will run on every event." })
        return
      }
      // Dispatcher uses lib/workflows/conditions.ts (server-only). For
      // an in-builder dry run we lightweight-evaluate using the
      // sample payload so managers see "would match / would skip"
      // without firing the full simulator API. We don't import the
      // server module — just reproduce the supported ops here.
      const ctx = JSON.parse(samplePayloadJson(triggerType)) as Record<string, unknown>
      const operator = (parsed as { operator?: string }).operator === "or" ? "or" : "and"
      const fn = (rule: { field?: string; op?: string; value?: unknown }): boolean => {
        if (typeof rule.field !== "string" || typeof rule.op !== "string") return false
        const left = rule.field.split(".").reduce<unknown>((acc, k) => {
          if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k]
          return undefined
        }, ctx)
        const v = rule.value
        switch (rule.op) {
          case "eq":
            return left === v || String(left) === String(v)
          case "neq":
            return left !== v && String(left) !== String(v)
          case "in":
            return Array.isArray(v) ? v.map(String).includes(String(left ?? "")) : false
          case "gte":
            return Number(left) >= Number(v)
          case "lte":
            return Number(left) <= Number(v)
          case "contains":
            return String(left ?? "").toLowerCase().includes(String(v ?? "").toLowerCase())
          default:
            return false
        }
      }
      const ok = operator === "or" ? rules.some(fn) : rules.every(fn)
      setConditionsValid({
        ok,
        message: ok
          ? "Conditions match the sample payload — actions would run."
          : "Conditions did NOT match the sample payload — actions would not run.",
      })
    } catch {
      setConditionsValid({ ok: false, message: "Couldn't validate — fix the JSON first." })
    }
  }

  async function save() {
    if (!organizationId || !name.trim()) return
    setError(null)
    setSaving(true)
    try {
      let condition_config: Record<string, unknown>
      let action_config: Record<string, unknown>
      try {
        condition_config = JSON.parse(conditionJson) as Record<string, unknown>
        action_config = JSON.parse(actionJson) as Record<string, unknown>
      } catch {
        setError("Couldn't parse JSON. Fix the highlighted fields and try again.")
        return
      }
      const url = editing
        ? `/api/organizations/${organizationId}/workflow-automations/${editing.id}`
        : `/api/organizations/${organizationId}/workflow-automations`
      const method = editing ? "PATCH" : "POST"
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
      onOpenChange(false)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function runTest() {
    if (!editing) return
    setTesting(true)
    try {
      await onRequestRunTest?.(editing.id)
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" />
              {editing ? "Edit automation" : "New automation"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2 min-w-0">
            {/* Top: name + summary */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
              <div className="flex flex-col gap-3">
                <Label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground">Name</span>
                  <Input
                    className="h-9 text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Notify when a quoted prospect is won"
                  />
                </Label>
                <Label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground">Description</span>
                  <Textarea
                    className="text-sm min-h-[52px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this automation do, in your own words?"
                  />
                </Label>
              </div>
              <label className="flex items-center gap-2 text-xs sm:mt-1.5 sm:self-start">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                Enabled
              </label>
            </div>

            <div className="rounded-lg border border-border bg-primary/[0.04] px-3 py-2 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground leading-relaxed">{summary}</p>
            </div>

            {/* Step tabs */}
            <Tabs value={step} onValueChange={(v) => setStep(v as Step)} className="mt-1">
              <TabsList className="grid grid-cols-3 w-full max-w-md">
                <TabsTrigger value="trigger" className="text-xs">
                  1 · Trigger
                </TabsTrigger>
                <TabsTrigger value="conditions" className="text-xs">
                  2 · Conditions
                </TabsTrigger>
                <TabsTrigger value="actions" className="text-xs">
                  3 · Actions{actions.length > 0 ? ` (${actions.length})` : ""}
                </TabsTrigger>
              </TabsList>

              {/* Step 1 — Trigger */}
              <TabsContent value="trigger" className="mt-3 flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  {TRIGGER_GROUPS.map(([group, ids]) => (
                    <div key={group} className="flex flex-col gap-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {TRIGGER_GROUP_LABELS[group as keyof typeof TRIGGER_GROUP_LABELS]}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ids.map((id) => {
                          const meta = TRIGGER_CATALOG[id]
                          const selected = id === triggerType
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setTriggerType(id)}
                              className={cn(
                                "text-left rounded-xl border p-3 transition-colors flex flex-col gap-1.5",
                                selected
                                  ? "border-primary/50 bg-primary/[0.04] ring-2 ring-primary/15"
                                  : "border-border bg-card hover:border-primary/30 hover:bg-primary/[0.02]",
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground truncate">{meta.label}</span>
                                {meta.availability === "new" ? (
                                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                                    New
                                  </Badge>
                                ) : null}
                                {meta.availability === "experimental" ? (
                                  <Badge variant="outline" className="text-[10px]">
                                    Experimental
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-3">
                                {meta.description}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Available fields
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] gap-1 text-muted-foreground"
                      onClick={() => setShowPayload((v) => !v)}
                    >
                      <Eye className="w-3 h-3" /> {showPayload ? "Hide payload" : "Preview payload"}
                    </Button>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                    {triggerEntry.fieldRefs.map((f) => (
                      <li key={f.path} className="leading-snug">
                        <code className="text-[11px] font-medium text-foreground">{f.path}</code>
                        <span className="text-muted-foreground"> · {f.description}</span>
                      </li>
                    ))}
                  </ul>
                  {showPayload ? (
                    <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-card border border-border px-2.5 py-2 text-[11px] font-mono text-foreground/90">
                      {samplePayloadJson(triggerType)}
                    </pre>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <Button type="button" size="sm" onClick={() => setStep("conditions")}>
                    Continue → Conditions
                  </Button>
                </div>
              </TabsContent>

              {/* Step 2 — Conditions */}
              <TabsContent value="conditions" className="mt-3 flex flex-col gap-3">
                {conditionParseError ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Visual editor disabled — {conditionParseError} Use the Advanced JSON tab to edit
                      conditions directly. Your JSON is preserved.
                    </span>
                  </div>
                ) : null}
                <ConditionBuilder
                  triggerType={triggerType}
                  tree={tree}
                  onChange={(t) => {
                    editingJsonRef.current = "none"
                    setTree(t)
                    setConditionsValid(null)
                  }}
                  disabled={Boolean(conditionParseError)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={validateConditionsAgainstSample}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Validate against sample payload
                  </Button>
                  {conditionsValid ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px]",
                        conditionsValid.ok
                          ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                          : "border-amber-500/40 text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {conditionsValid.message}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex justify-between">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setStep("trigger")}>
                    ← Back
                  </Button>
                  <Button type="button" size="sm" onClick={() => setStep("actions")}>
                    Continue → Actions
                  </Button>
                </div>
              </TabsContent>

              {/* Step 3 — Actions */}
              <TabsContent value="actions" className="mt-3 flex flex-col gap-3">
                {actionParseError ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Visual editor disabled — {actionParseError} Use the Advanced JSON tab to edit
                      actions directly. Your JSON is preserved.
                    </span>
                  </div>
                ) : null}
                <ActionStack
                  actions={actions}
                  onChange={(next) => {
                    editingJsonRef.current = "none"
                    setActions(next)
                  }}
                  onRequestPicker={() => setPickerOpen(true)}
                  disabled={Boolean(actionParseError)}
                />
                <div className="flex justify-between">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setStep("conditions")}>
                    ← Back
                  </Button>
                  {editing ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={runTest}
                      disabled={testing}
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      {testing ? "Running…" : "Run test"}
                    </Button>
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>

            {/* Advanced JSON */}
            <div className="rounded-lg border border-border bg-card mt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  Advanced JSON
                  <span className="text-[10px] font-normal text-muted-foreground">
                    raw conditions + actions
                  </span>
                </span>
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showAdvanced ? (
                <div className="border-t border-border p-3 flex flex-col gap-3">
                  <Label className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground">Conditions JSON</span>
                    <Textarea
                      value={conditionJson}
                      onChange={(e) => handleConditionJsonChange(e.target.value)}
                      onBlur={() => (editingJsonRef.current = "none")}
                      className="text-[11px] font-mono min-h-[100px]"
                    />
                  </Label>
                  <Label className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground">Actions JSON</span>
                    <Textarea
                      value={actionJson}
                      onChange={(e) => handleActionJsonChange(e.target.value)}
                      onBlur={() => (editingJsonRef.current = "none")}
                      className="text-[11px] font-mono min-h-[120px]"
                    />
                  </Label>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 flex-wrap">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 mr-auto"
                onClick={() => onRequestRunHistory?.(editing.id, editing.name)}
              >
                <History className="w-3.5 h-3.5" /> Run history
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1"
              onClick={save}
              disabled={saving || !name.trim()}
            >
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : editing ? "Save changes" : "Create automation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ActionPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        triggerType={triggerType}
        onPick={pickAction}
      />
    </>
  )
}

function defaultConfigFor(type: WorkflowActionType): Record<string, unknown> {
  switch (type) {
    case "notify_internal_user":
      return { title: ACTION_CATALOG[type].label, summary: "" }
    case "send_email":
      return { to: "{{customer_email}}", subject: "", body: "" }
    case "send_sms":
      return { to: "{{customer_phone}}", body: "" }
    case "create_followup_task":
      return { title: "", description: "", due_in_days: 2 }
    case "update_status":
      return { status: "" }
    case "assign_technician":
      return {}
    case "create_ai_task":
      return { task: "customer_email" }
    case "create_work_order":
      return { title: "", priority: "medium" }
    default:
      return {}
  }
}
