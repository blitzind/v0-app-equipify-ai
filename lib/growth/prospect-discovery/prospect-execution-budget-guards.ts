/** Budget guards for GS-2C prospect discovery execution (client-safe). */

import type { ProspectExecutionPlan } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import type { ProspectBudgetGuardAction } from "@/lib/growth/prospect-discovery/prospect-execution-run-types"

export type ProspectExecutionBudgetContext = {
  max_companies: number
  max_contacts: number
  max_apollo_credits: number
  max_pdl_lookups: number
  max_runtime_seconds: number
  started_at_ms: number
  companies_discovered: number
  contacts_discovered: number
  apollo_credits_consumed: number
  pdl_lookups_consumed: number
}

export function createProspectExecutionBudgetContext(
  execution_plan: ProspectExecutionPlan,
  options?: { certification_mode?: boolean },
): ProspectExecutionBudgetContext {
  const certScale = options?.certification_mode ? 0.15 : 1
  return {
    max_companies: Math.max(3, Math.round(execution_plan.estimated_companies * certScale)),
    max_contacts: Math.max(5, Math.round(execution_plan.estimated_contacts * certScale)),
    max_apollo_credits: Math.max(5, Math.round(execution_plan.estimated_credits * certScale)),
    max_pdl_lookups: Math.max(3, Math.round(execution_plan.cost_breakdown.pdl_lookup_units * certScale)),
    max_runtime_seconds: Math.max(60, Math.round(execution_plan.estimated_runtime_seconds * certScale)),
    started_at_ms: Date.now(),
    companies_discovered: 0,
    contacts_discovered: 0,
    apollo_credits_consumed: 0,
    pdl_lookups_consumed: 0,
  }
}

export function evaluateProspectExecutionBudgetGuard(
  ctx: ProspectExecutionBudgetContext,
): { action: ProspectBudgetGuardAction; reason: string | null } {
  const elapsedSeconds = Math.round((Date.now() - ctx.started_at_ms) / 1000)

  if (ctx.companies_discovered >= ctx.max_companies) {
    return { action: "pause", reason: "Company result cap reached for this execution run." }
  }
  if (ctx.contacts_discovered >= ctx.max_contacts) {
    return { action: "pause", reason: "Contact result cap reached for this execution run." }
  }
  if (ctx.apollo_credits_consumed >= ctx.max_apollo_credits) {
    return { action: "abort", reason: "Apollo credit cap exceeded for this execution run." }
  }
  if (ctx.pdl_lookups_consumed >= ctx.max_pdl_lookups) {
    return { action: "pause", reason: "PDL lookup cap reached for this execution run." }
  }
  if (elapsedSeconds >= ctx.max_runtime_seconds) {
    return { action: "abort", reason: "Runtime cap exceeded for this execution run." }
  }

  return { action: "continue", reason: null }
}
