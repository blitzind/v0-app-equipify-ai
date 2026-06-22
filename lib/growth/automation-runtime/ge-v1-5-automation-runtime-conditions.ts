/** GE-v1-5 — Deterministic condition evaluation (client-safe, no scripting). */

import type {
  GeV15AutomationRuntimeTrigger,
  GeV15ConditionSpec,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

export type GeV15ConditionContext = {
  leadScore?: number | null
  intentScore?: number | null
  eventCount?: number
  inactivityDays?: number | null
  audienceIds?: string[]
  companyAttributes?: Record<string, string | number | boolean | null>
  hasActiveRecommendation?: boolean
  trigger?: GeV15AutomationRuntimeTrigger
}

function compareNumber(
  actual: number,
  operator: GeV15ConditionSpec["operator"],
  expected: number,
): boolean {
  switch (operator) {
    case "gte":
      return actual >= expected
    case "lte":
      return actual <= expected
    case "gt":
      return actual > expected
    case "lt":
      return actual < expected
    case "eq":
      return actual === expected
    default:
      return false
  }
}

export function evaluateGeV15Condition(
  spec: GeV15ConditionSpec,
  ctx: GeV15ConditionContext,
): boolean {
  switch (spec.kind) {
    case "lead_score":
      return compareNumber(ctx.leadScore ?? 0, spec.operator, Number(spec.value))

    case "intent_score":
      return compareNumber(ctx.intentScore ?? 0, spec.operator, Number(spec.value))

    case "event_count":
      if (spec.trigger && ctx.trigger && spec.trigger !== ctx.trigger) return false
      return compareNumber(ctx.eventCount ?? 0, spec.operator, Number(spec.value))

    case "inactivity_duration": {
      const days = ctx.inactivityDays ?? 0
      return compareNumber(days, spec.operator, Number(spec.value))
    }

    case "audience_membership": {
      const audienceId = spec.audienceId ?? String(spec.value)
      return (ctx.audienceIds ?? []).includes(audienceId)
    }

    case "company_attribute": {
      const key = spec.attributeKey ?? String(spec.value)
      const attr = ctx.companyAttributes?.[key]
      if (typeof spec.value === "boolean") return attr === spec.value
      if (typeof spec.value === "number") return compareNumber(Number(attr ?? 0), spec.operator, spec.value)
      return String(attr ?? "") === String(spec.value)
    }

    case "recommendation_state":
      if (spec.value === true || spec.value === "active") return Boolean(ctx.hasActiveRecommendation)
      return !ctx.hasActiveRecommendation

    default:
      return false
  }
}

export function evaluateGeV15Conditions(
  specs: GeV15ConditionSpec[],
  ctx: GeV15ConditionContext,
): { passed: boolean; results: Array<{ kind: string; passed: boolean }> } {
  const results = specs.map((spec) => ({
    kind: spec.kind,
    passed: evaluateGeV15Condition(spec, ctx),
  }))
  return {
    passed: results.every((r) => r.passed),
    results,
  }
}
