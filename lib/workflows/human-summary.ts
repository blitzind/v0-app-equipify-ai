/**
 * Workflow Automations Phase 2 — pure summary engine.
 *
 * Renders an automation's stored JSON (`trigger_type` +
 * `condition_config` + `action_config`) as a single human-friendly
 * sentence for list rows, drawer headers, and previews.
 *
 * No I/O, no AI, no React. Safe to import anywhere (server, client,
 * tests). When inputs are malformed we degrade gracefully — never
 * throw — so the list view never blanks out a row because of bad JSON
 * the user is mid-editing.
 */

import { TRIGGER_CATALOG } from "@/lib/workflows/trigger-catalog"
import { ACTION_CATALOG } from "@/lib/workflows/action-catalog"
import type {
  ConditionConfig,
  ConditionRule,
  WorkflowActionSpec,
  WorkflowActionType,
  WorkflowTriggerType,
} from "@/lib/workflows/types"

const OP_PHRASES: Record<ConditionRule["op"], string> = {
  eq: "is",
  neq: "is not",
  in: "is one of",
  gte: "is at least",
  lte: "is at most",
  contains: "contains",
}

function shortField(path: string): string {
  // "prospect.next_status" → "next status"; "invoice.days_overdue" → "days overdue"
  const tail = path.split(".").slice(-1)[0] ?? path
  return tail.replace(/_/g, " ")
}

function valueLabel(rule: ConditionRule): string {
  const v = rule.value
  if (Array.isArray(v)) return v.length === 0 ? "(empty list)" : v.map(String).join(" / ")
  if (v === null || v === undefined) return "(none)"
  if (typeof v === "boolean") return v ? "yes" : "no"
  return String(v)
}

function summarizeConditions(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null
  const cfg = raw as ConditionConfig
  const rules = Array.isArray(cfg.rules) ? cfg.rules : []
  if (rules.length === 0) return null
  const op = cfg.operator === "or" ? " or " : " and "
  const parts = rules
    .filter((r): r is ConditionRule => Boolean(r) && typeof (r as ConditionRule).field === "string")
    .map((r) => `${shortField(r.field)} ${OP_PHRASES[r.op] ?? r.op} ${valueLabel(r)}`)
  if (parts.length === 0) return null
  return parts.join(op)
}

function actionPhrase(spec: WorkflowActionSpec): string {
  const meta = ACTION_CATALOG[spec.type as WorkflowActionType]
  const cfg = (spec.config ?? {}) as Record<string, unknown>
  switch (spec.type) {
    case "notify_internal_user": {
      const title = typeof cfg.title === "string" && cfg.title ? `"${cfg.title}"` : "the team"
      return `notify ${title}`
    }
    case "send_email": {
      const to = typeof cfg.to === "string" && cfg.to ? cfg.to : "the recipient"
      return `send an email to ${to}`
    }
    case "send_sms": {
      return `log an SMS (delivery pending)`
    }
    case "assign_technician":
      return "assign a technician"
    case "update_status": {
      const status = typeof cfg.status === "string" && cfg.status ? `"${cfg.status}"` : "a new status"
      return `update status to ${status}`
    }
    case "create_followup_task": {
      const due = typeof cfg.due_in_days === "number" ? ` due in ${cfg.due_in_days} day${cfg.due_in_days === 1 ? "" : "s"}` : ""
      return `create a follow-up task${due}`
    }
    case "create_work_order":
      return "create a work order"
    case "create_ai_task": {
      const task = typeof cfg.task === "string" && cfg.task ? cfg.task.replace(/_/g, " ") : "an AI task"
      return `queue ${task}`
    }
    default:
      return meta?.label?.toLowerCase() ?? "perform an action"
  }
}

function joinList(parts: string[]): string {
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]!
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")}, and ${parts.slice(-1)[0]}`
}

export type AutomationSummaryInput = {
  trigger_type: WorkflowTriggerType | string
  condition_config?: unknown
  action_config?: unknown
}

/**
 * Builds a single sentence describing the automation. Defensive: tolerates
 * partially built / malformed JSON while the user edits, returning a
 * coherent fallback ("trigger label" or "this automation").
 */
export function buildAutomationSummary(input: AutomationSummaryInput): string {
  const triggerMeta = (TRIGGER_CATALOG as Record<string, { label: string }>)[input.trigger_type]
  const triggerLabel = triggerMeta?.label?.toLowerCase() ?? String(input.trigger_type).replace(/_/g, " ")

  const conditionPhrase = summarizeConditions(input.condition_config)
  const whenClause = conditionPhrase
    ? `When ${triggerLabel} and ${conditionPhrase}`
    : `When ${triggerLabel}`

  const actionsRaw = (input.action_config as { actions?: WorkflowActionSpec[] } | undefined)?.actions
  const actions = Array.isArray(actionsRaw) ? actionsRaw : []
  const phrases = actions
    .filter((a): a is WorkflowActionSpec => Boolean(a) && typeof (a as WorkflowActionSpec).type === "string")
    .map(actionPhrase)

  if (phrases.length === 0) {
    return `${whenClause}, no actions are configured yet.`
  }
  return `${whenClause}, ${joinList(phrases)}.`
}

/**
 * Compact "trigger only" line — useful for places where actions are
 * already rendered separately (e.g. the action stack in the editor).
 */
export function buildTriggerSummary(triggerType: WorkflowTriggerType | string): string {
  const meta = (TRIGGER_CATALOG as Record<string, { description: string; label: string }>)[triggerType]
  return meta?.description ?? `Fires when ${String(triggerType).replace(/_/g, " ")}.`
}
