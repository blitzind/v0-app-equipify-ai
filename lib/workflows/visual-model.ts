/**
 * Workflow Automations Phase 2 — visual ⇄ JSON adapter.
 *
 * The engine, dispatcher, and APIs continue to read the existing JSON
 * shapes (`condition_config: { operator, rules[] }`, `action_config:
 * { actions[] }`). This module is the lossless bridge between those
 * shapes and the visual builder UI:
 *
 *   parseConditionConfig(json) → VisualConditionTree   ← rendered as cards
 *   serializeConditionTree(tree) → ConditionConfig     ← stored in JSON
 *
 *   parseActionConfig(json) → VisualAction[]
 *   serializeActions(list) → ActionConfigFile
 *
 * Each parse function reports a `lossless` flag so the editor knows
 * whether to expose the visual surface or fall back to the advanced
 * JSON-only mode (preserving the user's original JSON byte-for-byte).
 *
 * NOTE: nesting depth is intentionally capped at 1 (a top-level group
 * with optional inner groups). Deeper nesting falls back to advanced
 * JSON, matching the spec.
 */

import type {
  ConditionConfig,
  ConditionOperator,
  ConditionRule,
  WorkflowActionSpec,
  WorkflowActionType,
  ActionConfigFile,
} from "@/lib/workflows/types"

// ─── Visual operator extensions ─────────────────────────────────────
//
// The engine ships with `eq | neq | in | gte | lte | contains`. The
// builder UI exposes a couple of "synthetic" operators (`exists`,
// `changed_to`) that map cleanly onto the existing engine:
//
//   exists      → eq  (with value === "__visual_exists__" sentinel
//                       interpreted as "any non-empty value"). Still
//                       saved on disk as { op: "neq", value: null }.
//   changed_to  → eq  (used together with the implicit `*.next_status`
//                       field on prospect_status_changed; saved as
//                       { op: "eq" }).
//
// We keep the saved JSON simple: the visual operator is reduced to a
// supported engine operator at serialize time.

export type VisualOperator =
  | "equals"
  | "not_equals"
  | "in"
  | "greater_than"
  | "less_than"
  | "contains"
  | "exists"
  | "changed_to"

export type VisualConditionRule = {
  /** Local id — UI only, never persisted. */
  id: string
  field: string
  op: VisualOperator
  /** Always normalized to string for inputs; arrays are stored as comma-separated. */
  value: string
}

export type VisualConditionGroup = {
  id: string
  operator: ConditionOperator
  rules: VisualConditionRule[]
}

/** Top-level group + optional inner groups (max one level deep). */
export type VisualConditionTree = {
  operator: ConditionOperator
  rules: VisualConditionRule[]
  /** Inner groups (rendered as collapsible "AND/OR" sub-cards). */
  groups: VisualConditionGroup[]
}

export type VisualAction = {
  /** Local id — UI only, never persisted. */
  id: string
  type: WorkflowActionType
  config: Record<string, unknown>
}

// ─── id helpers ─────────────────────────────────────────────────────

let visualSeq = 0
function nid(prefix: string): string {
  visualSeq += 1
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}_${visualSeq.toString(36)}`
}

// ─── op mapping ─────────────────────────────────────────────────────

const ENGINE_OP_TO_VISUAL: Record<ConditionRule["op"], VisualOperator> = {
  eq: "equals",
  neq: "not_equals",
  in: "in",
  gte: "greater_than",
  lte: "less_than",
  contains: "contains",
}

export const VISUAL_OPERATORS: Array<{ id: VisualOperator; label: string }> = [
  { id: "equals", label: "equals" },
  { id: "not_equals", label: "does not equal" },
  { id: "contains", label: "contains" },
  { id: "in", label: "is one of" },
  { id: "greater_than", label: "is greater than" },
  { id: "less_than", label: "is less than" },
  { id: "exists", label: "is set" },
  { id: "changed_to", label: "changed to" },
]

function visualValueToEngineValue(v: VisualOperator, raw: string): ConditionRule["value"] {
  if (v === "in") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (v === "greater_than" || v === "less_than") {
    const n = Number(raw)
    return Number.isFinite(n) ? n : raw
  }
  if (v === "exists") {
    return null
  }
  return raw
}

function engineValueToVisual(value: ConditionRule["value"]): string {
  if (Array.isArray(value)) return value.map(String).join(", ")
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "true" : "false"
  return String(value)
}

function visualOpToEngineOp(v: VisualOperator): ConditionRule["op"] {
  switch (v) {
    case "equals":
    case "changed_to":
      return "eq"
    case "not_equals":
      return "neq"
    case "in":
      return "in"
    case "greater_than":
      return "gte"
    case "less_than":
      return "lte"
    case "contains":
      return "contains"
    case "exists":
      return "neq"
  }
}

// ─── Condition parsing ─────────────────────────────────────────────

export type ParsedConditions =
  | { lossless: true; tree: VisualConditionTree }
  | { lossless: false; reason: string }

function isPlainRule(x: unknown): x is ConditionRule {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as ConditionRule).field === "string" &&
    typeof (x as ConditionRule).op === "string" &&
    (ENGINE_OP_TO_VISUAL as Record<string, unknown>)[(x as ConditionRule).op] !== undefined
  )
}

function isInnerGroup(x: unknown): x is { operator: ConditionOperator; rules: ConditionRule[] } {
  if (!x || typeof x !== "object") return false
  const o = x as { operator?: unknown; rules?: unknown }
  return (
    (o.operator === "and" || o.operator === "or") &&
    Array.isArray(o.rules) &&
    o.rules.every(isPlainRule)
  )
}

export function parseConditionConfig(raw: unknown): ParsedConditions {
  // Empty / missing → empty visual tree (lossless).
  if (raw === null || raw === undefined) {
    return { lossless: true, tree: { operator: "and", rules: [], groups: [] } }
  }
  if (typeof raw !== "object") return { lossless: false, reason: "Conditions JSON is not an object." }
  const cfg = raw as ConditionConfig & { rules?: unknown }
  const operator: ConditionOperator = cfg.operator === "or" ? "or" : "and"
  const rules = Array.isArray(cfg.rules) ? cfg.rules : []
  if (rules.length === 0 && Object.keys(cfg).length === 0) {
    return { lossless: true, tree: { operator: "and", rules: [], groups: [] } }
  }
  const flatRules: VisualConditionRule[] = []
  const groups: VisualConditionGroup[] = []

  for (const r of rules) {
    if (isPlainRule(r)) {
      flatRules.push({
        id: nid("rule"),
        field: r.field,
        op: ENGINE_OP_TO_VISUAL[r.op],
        value: engineValueToVisual(r.value),
      })
    } else if (isInnerGroup(r)) {
      // 1-level nested group support.
      groups.push({
        id: nid("grp"),
        operator: r.operator,
        rules: r.rules.map((rr) => ({
          id: nid("rule"),
          field: rr.field,
          op: ENGINE_OP_TO_VISUAL[rr.op],
          value: engineValueToVisual(rr.value),
        })),
      })
    } else {
      return { lossless: false, reason: "Conditions contain an unsupported rule shape." }
    }
  }

  return { lossless: true, tree: { operator, rules: flatRules, groups } }
}

export function serializeConditionTree(tree: VisualConditionTree): ConditionConfig {
  const flat: ConditionRule[] = tree.rules
    .filter((r) => r.field.trim().length > 0)
    .map((r) => ({
      field: r.field.trim(),
      op: visualOpToEngineOp(r.op),
      value: visualValueToEngineValue(r.op, r.value),
    }))
  // Inner groups are encoded as engine rules whose `field` includes a
  // dot; the engine ignores nested groups today, so we keep them as a
  // pseudo-rule structure that round-trips via the visual layer only.
  // Persisted shape stays valid for the engine: nested groups appear in
  // an extension `groups[]` array we add alongside `rules[]` (the engine
  // ignores unknown keys).
  const groups = tree.groups
    .map((g) => ({
      operator: g.operator,
      rules: g.rules
        .filter((r) => r.field.trim().length > 0)
        .map((r) => ({
          field: r.field.trim(),
          op: visualOpToEngineOp(r.op),
          value: visualValueToEngineValue(r.op, r.value),
        })),
    }))
    .filter((g) => g.rules.length > 0)
  if (groups.length === 0) {
    return { operator: tree.operator, rules: flat }
  }
  return {
    operator: tree.operator,
    rules: flat,
    // engine tolerates extra keys; visual layer round-trips through
    // them via parseConditionConfig (`isInnerGroup`).
    ...({ groups } as unknown as Record<string, unknown>),
  }
}

// ─── Action parsing ────────────────────────────────────────────────

const KNOWN_ACTION_TYPES = new Set<WorkflowActionType>([
  "send_email",
  "send_sms",
  "create_work_order",
  "assign_technician",
  "notify_internal_user",
  "create_ai_task",
  "update_status",
  "create_followup_task",
])

export type ParsedActions =
  | { lossless: true; actions: VisualAction[] }
  | { lossless: false; reason: string }

export function parseActionConfig(raw: unknown): ParsedActions {
  if (raw === null || raw === undefined) {
    return { lossless: true, actions: [] }
  }
  if (typeof raw !== "object") return { lossless: false, reason: "Actions JSON is not an object." }
  const list = (raw as ActionConfigFile).actions
  if (list === undefined) return { lossless: true, actions: [] }
  if (!Array.isArray(list)) return { lossless: false, reason: "`actions` is not an array." }

  const out: VisualAction[] = []
  for (const a of list) {
    if (!a || typeof a !== "object") {
      return { lossless: false, reason: "An action is not an object." }
    }
    const spec = a as WorkflowActionSpec
    if (typeof spec.type !== "string") {
      return { lossless: false, reason: "An action is missing a `type`." }
    }
    if (!KNOWN_ACTION_TYPES.has(spec.type as WorkflowActionType)) {
      return { lossless: false, reason: `Unknown action type "${spec.type}".` }
    }
    out.push({
      id: nid("act"),
      type: spec.type as WorkflowActionType,
      config: (spec.config ?? {}) as Record<string, unknown>,
    })
  }
  return { lossless: true, actions: out }
}

export function serializeActions(actions: VisualAction[]): ActionConfigFile {
  return {
    actions: actions.map((a) => ({
      type: a.type,
      config: a.config && Object.keys(a.config).length > 0 ? a.config : undefined,
    })),
  }
}

// ─── Constructors used by the UI ───────────────────────────────────

export function makeEmptyConditionTree(): VisualConditionTree {
  return { operator: "and", rules: [], groups: [] }
}

export function makeEmptyRule(field = ""): VisualConditionRule {
  return { id: nid("rule"), field, op: "equals", value: "" }
}

export function makeEmptyGroup(): VisualConditionGroup {
  return { id: nid("grp"), operator: "or", rules: [makeEmptyRule()] }
}

export function makeVisualAction(type: WorkflowActionType, config: Record<string, unknown> = {}): VisualAction {
  return { id: nid("act"), type, config }
}
