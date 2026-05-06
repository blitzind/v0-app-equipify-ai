import "server-only"

import type { ConditionConfig, ConditionRule, WorkflowEventContext } from "./types"

function getField(ctx: WorkflowEventContext, path: string): unknown {
  const parts = path.split(".").filter(Boolean)
  let cur: unknown = ctx as unknown as Record<string, unknown>
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined
    if (typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function ruleMatches(rule: ConditionRule, ctx: WorkflowEventContext): boolean {
  const left = getField(ctx, rule.field)
  const op = rule.op
  const v = rule.value

  switch (op) {
    case "eq":
      return left === v || String(left) === String(v)
    case "neq":
      return left !== v && String(left) !== String(v)
    case "in":
      return Array.isArray(v) ? v.map(String).includes(String(left ?? "")) : false
    case "gte":
      return typeof left === "number" && typeof v === "number"
        ? left >= v
        : Number(left ?? NaN) >= Number(v ?? NaN)
    case "lte":
      return typeof left === "number" && typeof v === "number"
        ? left <= v
        : Number(left ?? NaN) <= Number(v ?? NaN)
    case "contains":
      return String(left ?? "").toLowerCase().includes(String(v ?? "").toLowerCase())
    default:
      return false
  }
}

/** Empty or missing rules → match all (automation always eligible). */
export function evaluateConditions(raw: ConditionConfig | Record<string, unknown> | null | undefined, ctx: WorkflowEventContext): boolean {
  const cfg = (raw ?? {}) as ConditionConfig
  const rules = cfg.rules ?? []
  if (rules.length === 0) return true
  const op = cfg.operator ?? "and"
  if (op === "or") {
    return rules.some((r) => ruleMatches(r, ctx))
  }
  return rules.every((r) => ruleMatches(r, ctx))
}
