"use client"

/**
 * Workflow Automations Phase 2 — visual action stack.
 *
 * Renders the configured actions as draggable cards. Each card shows
 * the action's icon, label, "live / logged / coming soon" badge, and
 * a "Sends to customers" warning where applicable.
 *
 * Reorder uses native HTML5 drag-and-drop (keyboard-friendly fallback
 * via "move up/down" buttons). Configuration UI is intentionally
 * minimal in Phase 2 — the engine continues to read action `config`
 * from the JSON, so we expose the most-used fields as inline inputs
 * (subject/body/title/etc.) and keep advanced fields under the
 * "Advanced JSON" section in the parent dialog.
 */

import { useState } from "react"
import {
  Bell,
  Bot,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  ListChecks,
  Mail,
  MessageSquare,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ACTION_CATALOG } from "@/lib/workflows/action-catalog"
import { makeVisualAction, type VisualAction } from "@/lib/workflows/visual-model"
import type { WorkflowActionType } from "@/lib/workflows/types"
import { cn } from "@/lib/utils"

const ACTION_ICONS: Record<WorkflowActionType, LucideIcon> = {
  notify_internal_user: Bell,
  send_email: Mail,
  send_sms: MessageSquare,
  assign_technician: UserCheck,
  update_status: Wrench,
  create_followup_task: ListChecks,
  create_work_order: Wrench,
  create_ai_task: Bot,
}

type Props = {
  actions: VisualAction[]
  onChange: (next: VisualAction[]) => void
  onRequestPicker: () => void
  /** Disabled when underlying JSON couldn't be parsed cleanly. */
  disabled?: boolean
}

export function ActionStack({ actions, onChange, onRequestPicker, disabled = false }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(actions[0]?.id ?? null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function move(idx: number, dir: -1 | 1) {
    const next = idx + dir
    if (next < 0 || next >= actions.length) return
    const arr = actions.slice()
    const [removed] = arr.splice(idx, 1)
    if (!removed) return
    arr.splice(next, 0, removed)
    onChange(arr)
  }
  function update(idx: number, partial: Partial<VisualAction>) {
    const arr = actions.slice()
    const cur = arr[idx]
    if (!cur) return
    arr[idx] = { ...cur, ...partial }
    onChange(arr)
  }
  function updateConfig(idx: number, partial: Record<string, unknown>) {
    const cur = actions[idx]
    if (!cur) return
    const cleaned = { ...cur.config, ...partial }
    Object.keys(cleaned).forEach((k) => {
      const v = cleaned[k]
      if (v === undefined || v === "") delete cleaned[k]
    })
    update(idx, { config: cleaned })
  }
  function remove(idx: number) {
    onChange(actions.filter((_, i) => i !== idx))
  }
  function duplicate(idx: number) {
    const cur = actions[idx]
    if (!cur) return
    const cloned = makeVisualAction(cur.type, JSON.parse(JSON.stringify(cur.config)) as Record<string, unknown>)
    const arr = actions.slice()
    arr.splice(idx + 1, 0, cloned)
    onChange(arr)
    setExpandedId(cloned.id)
  }
  function onDragOver(e: React.DragEvent<HTMLLIElement>, idx: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === idx) return
    const arr = actions.slice()
    const [removed] = arr.splice(dragIndex, 1)
    if (!removed) return
    arr.splice(idx, 0, removed)
    setDragIndex(idx)
    onChange(arr)
  }

  return (
    <div className={cn("flex flex-col gap-3", disabled && "opacity-60 pointer-events-none")}>
      {actions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-foreground">No actions yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
            Pick an action to react when this trigger fires. Internal notifications and tasks are
            safe; customer-facing actions are flagged before they enable.
          </p>
          <Button type="button" size="sm" variant="default" className="mt-3 gap-1.5" onClick={onRequestPicker}>
            <Plus className="w-3.5 h-3.5" /> Add action
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {actions.map((action, idx) => {
            const meta = ACTION_CATALOG[action.type]
            const Icon = ACTION_ICONS[action.type] ?? Sparkles
            const isExpanded = expandedId === action.id
            const availabilityTone =
              meta.availability === "live"
                ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                : meta.availability === "logged"
                  ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                  : "border-border text-muted-foreground"
            return (
              <li
                key={action.id}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => onDragOver(e, idx)}
                className={cn(
                  "rounded-xl border border-border bg-card overflow-hidden",
                  dragIndex === idx && "opacity-60 ring-2 ring-primary/30",
                )}
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="text-muted-foreground/60 cursor-grab active:cursor-grabbing" aria-hidden>
                    <GripVertical className="w-4 h-4" />
                  </span>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground truncate">{meta.label}</span>
                      <Badge variant="outline" className={cn("text-[10px]", availabilityTone)}>
                        {meta.availability === "live"
                          ? "Live"
                          : meta.availability === "logged"
                            ? "Logged only"
                            : "Not enabled"}
                      </Badge>
                      {!meta.autoSafe ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300 gap-1"
                        >
                          <ShieldAlert className="w-3 h-3" /> Sends to customers
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug truncate">{meta.description}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Move action up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => move(idx, 1)}
                      disabled={idx === actions.length - 1}
                      aria-label="Move action down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => duplicate(idx)}
                      aria-label="Duplicate action"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(idx)}
                      aria-label="Remove action"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-muted-foreground"
                      onClick={() => setExpandedId(isExpanded ? null : action.id)}
                    >
                      {isExpanded ? "Hide" : "Configure"}
                    </Button>
                  </div>
                </div>
                {isExpanded ? (
                  <div className="border-t border-border bg-muted/20 px-3 py-3 flex flex-col gap-2.5">
                    <ActionConfigFields action={action} onChange={(partial) => updateConfig(idx, partial)} />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {actions.length > 0 ? (
        <Button type="button" variant="outline" size="sm" onClick={onRequestPicker} className="self-start gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add another action
        </Button>
      ) : null}
    </div>
  )
}

function ActionConfigFields({
  action,
  onChange,
}: {
  action: VisualAction
  onChange: (partial: Record<string, unknown>) => void
}) {
  const cfg = action.config
  const text = (k: string) => (typeof cfg[k] === "string" ? (cfg[k] as string) : "")
  const num = (k: string) => (typeof cfg[k] === "number" ? String(cfg[k]) : "")

  switch (action.type) {
    case "notify_internal_user":
      return (
        <>
          <Label className="text-[11px]">Title</Label>
          <Input
            value={text("title")}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Follow-up needed"
            className="h-8 text-xs"
          />
          <Label className="text-[11px]">Summary</Label>
          <Textarea
            value={text("summary")}
            onChange={(e) => onChange({ summary: e.target.value })}
            placeholder="A prospect just moved to Quoted — review and reach out today."
            className="text-xs min-h-[60px]"
          />
        </>
      )
    case "send_email":
      return (
        <>
          <Label className="text-[11px]">To</Label>
          <Input
            value={text("to")}
            onChange={(e) => onChange({ to: e.target.value })}
            placeholder="{{customer_email}}"
            className="h-8 text-xs"
          />
          <Label className="text-[11px]">Subject</Label>
          <Input
            value={text("subject")}
            onChange={(e) => onChange({ subject: e.target.value })}
            placeholder="Quick follow-up from your service team"
            className="h-8 text-xs"
          />
          <Label className="text-[11px]">Body</Label>
          <Textarea
            value={text("body")}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder="Hi there — checking in on your latest service. Reply to this email if anything looks off."
            className="text-xs min-h-[80px]"
          />
        </>
      )
    case "send_sms":
      return (
        <>
          <Label className="text-[11px]">To</Label>
          <Input
            value={text("to")}
            onChange={(e) => onChange({ to: e.target.value })}
            placeholder="{{customer_phone}}"
            className="h-8 text-xs"
          />
          <Label className="text-[11px]">Body</Label>
          <Textarea
            value={text("body")}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder="Quick reminder: your service is scheduled for tomorrow."
            className="text-xs min-h-[60px]"
          />
        </>
      )
    case "create_followup_task":
      return (
        <>
          <Label className="text-[11px]">Title</Label>
          <Input
            value={text("title")}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Follow up on quoted prospect"
            className="h-8 text-xs"
          />
          <Label className="text-[11px]">Description</Label>
          <Textarea
            value={text("description")}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Quoted prospect has been waiting — check in by phone."
            className="text-xs min-h-[60px]"
          />
          <Label className="text-[11px]">Due in (days)</Label>
          <Input
            type="number"
            value={num("due_in_days")}
            onChange={(e) => {
              const v = e.target.value
              onChange({ due_in_days: v === "" ? undefined : Number(v) })
            }}
            placeholder="2"
            className="h-8 text-xs"
            min={0}
          />
        </>
      )
    case "update_status":
      return (
        <>
          <Label className="text-[11px]">Status</Label>
          <Input
            value={text("status")}
            onChange={(e) => onChange({ status: e.target.value })}
            placeholder="in_progress"
            className="h-8 text-xs"
          />
        </>
      )
    case "assign_technician":
      return (
        <>
          <p className="text-[11px] text-muted-foreground">
            Set <code className="px-1">user_id</code> in the advanced JSON tab. The engine will assign that user to
            the work order from the trigger payload.
          </p>
        </>
      )
    case "create_ai_task":
      return (
        <>
          <Label className="text-[11px]">AI task</Label>
          <Input
            value={text("task")}
            onChange={(e) => onChange({ task: e.target.value })}
            placeholder="customer_email"
            className="h-8 text-xs"
          />
        </>
      )
    case "create_work_order":
      return (
        <>
          <Label className="text-[11px]">Title</Label>
          <Input
            value={text("title")}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Scheduled PM"
            className="h-8 text-xs"
          />
          <Label className="text-[11px]">Priority</Label>
          <Input
            value={text("priority")}
            onChange={(e) => onChange({ priority: e.target.value })}
            placeholder="medium"
            className="h-8 text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Customer / equipment / actor IDs come from the trigger payload. Plan limits apply at
            execution time.
          </p>
        </>
      )
    default:
      return null
  }
}
