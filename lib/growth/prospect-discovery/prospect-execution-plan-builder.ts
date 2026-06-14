/** Build human-gated Prospect Execution Plan from approved search plan (client-safe). */

import type { ProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import {
  PROSPECT_EXECUTION_QA_MARKER,
  type ProspectExecutionPlan,
  type ProspectExecutionPlanInput,
} from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import {
  buildProspectExecutionCostWarnings,
  buildProspectExecutionRisks,
  classifyProspectBudgetGuardrail,
  estimateProspectExecutionCost,
  estimateProspectExecutionRuntimeSeconds,
  estimateProspectExecutionVolume,
} from "@/lib/growth/prospect-discovery/prospect-cost-estimator"
import { deriveSearchPlanId, deriveExecutionPlanId } from "@/lib/growth/prospect-discovery/prospect-execution-plan-ids"
import {
  buildProspectExecutionStages,
  deriveProviderOrderFromStages,
  orderProspectExecutionProviders,
  selectProspectExecutionProviders,
} from "@/lib/growth/prospect-discovery/prospect-provider-selection"

export { deriveExecutionPlanId }

/**
 * Convert an approved Prospect Search Plan into an executable provider strategy.
 * Planning only — execution_enabled remains false until a future human-gated phase.
 */
export function buildProspectExecutionPlan(input: ProspectExecutionPlanInput): ProspectExecutionPlan {
  const search_plan_id = input.search_plan_id ?? deriveSearchPlanId(input.search_plan)
  const providers = orderProspectExecutionProviders(selectProspectExecutionProviders(input.search_plan))
  const execution_stages = buildProspectExecutionStages(providers)
  const provider_order = deriveProviderOrderFromStages(execution_stages)

  const volume = estimateProspectExecutionVolume({
    intent: input.search_plan.normalized_intent,
    providers,
    result_quality: input.search_plan.estimated_result_quality,
  })
  const cost_breakdown = estimateProspectExecutionCost({
    intent: input.search_plan.normalized_intent,
    providers,
    estimated_companies: volume.companies,
    estimated_contacts: volume.contacts,
  })
  const budget_guardrail = classifyProspectBudgetGuardrail({
    intent: input.search_plan.normalized_intent,
    cost: cost_breakdown,
    estimated_companies: volume.companies,
  })

  const warnings = [
    ...input.search_plan.warnings.filter((w) => !w.includes("GS-2A")),
    ...buildProspectExecutionCostWarnings({
      intent: input.search_plan.normalized_intent,
      budget_guardrail,
      cost: cost_breakdown,
      estimated_companies: volume.companies,
    }),
    "GS-2B execution plan — human approval required before any provider run in GS-2C.",
  ]

  const risks = buildProspectExecutionRisks({
    intent: input.search_plan.normalized_intent,
    budget_guardrail,
  })

  return {
    qa_marker: PROSPECT_EXECUTION_QA_MARKER,
    search_plan_id,
    providers,
    provider_order,
    execution_stages,
    estimated_companies: volume.companies,
    estimated_contacts: volume.contacts,
    estimated_credits: cost_breakdown.apollo_credits,
    estimated_runtime_seconds: estimateProspectExecutionRuntimeSeconds({
      providers,
      estimated_companies: volume.companies,
      stages: execution_stages.length,
    }),
    estimated_result_quality: input.search_plan.estimated_result_quality,
    cost_breakdown,
    budget_guardrail,
    warnings: [...new Set(warnings)],
    risks,
    requires_human_approval: true,
    execution_enabled: false,
  }
}

export type { ProspectSearchPlan }
