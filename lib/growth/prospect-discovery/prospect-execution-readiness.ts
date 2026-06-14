/** Prospect execution readiness evaluation (client-safe). */

import type { ProspectDiscoveryProvider, ProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import type {
  ProspectExecutionReadiness,
  ProspectExecutionReadinessReason,
  ProspectExecutionReadinessStatus,
  ProspectProviderEnvSnapshot,
} from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import { PROSPECT_EXECUTION_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import {
  classifyProspectBudgetGuardrail,
  estimateProspectExecutionCost,
  estimateProspectExecutionVolume,
} from "@/lib/growth/prospect-discovery/prospect-cost-estimator"
import { deriveSearchPlanId } from "@/lib/growth/prospect-discovery/prospect-execution-plan-ids"
import { selectProspectExecutionProviders } from "@/lib/growth/prospect-discovery/prospect-provider-selection"

function providerEnvStatus(
  provider: ProspectDiscoveryProvider,
  env: ProspectProviderEnvSnapshot,
): { configured: boolean; enabled: boolean; blocker: string | null } {
  switch (provider) {
    case "real_world_google_places":
      return {
        configured: true,
        enabled: env.google_places_enabled,
        blocker: env.google_places_enabled ? null : "GROWTH_DISCOVERY_DISABLE_GOOGLE_PLACES",
      }
    case "real_world_serp":
      return {
        configured: true,
        enabled: env.serp_enabled,
        blocker: env.serp_enabled ? null : "GROWTH_DISCOVERY_DISABLE_SERP",
      }
    case "apollo_company_search":
    case "apollo_people_search":
      return {
        configured: env.apollo_configured,
        enabled: env.apollo_enabled && !env.apollo_disabled,
        blocker: env.apollo_disabled
          ? "GROWTH_DISCOVERY_DISABLE_APOLLO"
          : !env.apollo_enabled
            ? "GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED_not_true"
            : !env.apollo_configured
              ? "APOLLO_API_KEY_missing"
              : null,
      }
    case "pdl_search":
      return {
        configured: env.pdl_configured,
        enabled: !env.pdl_disabled && env.pdl_configured,
        blocker: env.pdl_disabled
          ? "GROWTH_DISCOVERY_DISABLE_PDL"
          : !env.pdl_configured
            ? "PDL_API_KEY_missing"
            : null,
      }
    default:
      return { configured: true, enabled: true, blocker: null }
  }
}

function evaluateReadinessStatus(reasons: ProspectExecutionReadinessReason[]): ProspectExecutionReadinessStatus {
  if (reasons.some((r) => r.severity === "blocker")) return "blocked"
  if (reasons.some((r) => r.severity === "warning")) return "partially_ready"
  return "ready"
}

/**
 * Evaluate whether an approved search plan is ready for human-gated execution planning.
 */
export function buildProspectExecutionReadiness(input: {
  search_plan: ProspectSearchPlan
  search_plan_id?: string | null
  env: ProspectProviderEnvSnapshot
}): ProspectExecutionReadiness {
  const search_plan_id = input.search_plan_id ?? deriveSearchPlanId(input.search_plan)
  const intent = input.search_plan.normalized_intent
  const providers = selectProspectExecutionProviders(input.search_plan)
  const reasons: ProspectExecutionReadinessReason[] = []

  const provider_status = providers.map((provider) => ({
    provider,
    ...providerEnvStatus(provider, input.env),
  }))

  for (const status of provider_status) {
    if (!status.enabled && status.blocker) {
      reasons.push({
        code: "provider_disabled",
        severity: "warning",
        message: `${status.provider} unavailable: ${status.blocker}`,
        provider: status.provider,
      })
    }
  }

  if (intent.locations.length === 0) {
    reasons.push({
      code: "insufficient_filters",
      severity: "warning",
      message: "No geography specified — company discovery precision will be limited.",
    })
  }

  if (intent.industries.length === 0 && intent.technologies.length === 0) {
    reasons.push({
      code: "broad_query",
      severity: "warning",
      message: "Broad query — add industry or technology filters before execution.",
    })
  }

  if (intent.locations.length >= 10) {
    reasons.push({
      code: "broad_query",
      severity: "warning",
      message: "Multi-region or nationwide scope increases credit and runtime risk.",
    })
  }

  const volume = estimateProspectExecutionVolume({
    intent,
    providers,
    result_quality: input.search_plan.estimated_result_quality,
  })
  const cost = estimateProspectExecutionCost({
    intent,
    providers,
    estimated_companies: volume.companies,
    estimated_contacts: volume.contacts,
  })
  const budget = classifyProspectBudgetGuardrail({
    intent,
    cost,
    estimated_companies: volume.companies,
  })

  if (budget === "expensive") {
    reasons.push({
      code: "credit_risk",
      severity: "warning",
      message: "Estimated provider usage is expensive — operator credit review recommended.",
    })
  }

  const companyStageReady = provider_status.some(
    (s) =>
      (s.provider === "real_world_google_places" || s.provider === "real_world_serp") && s.enabled,
  )
  if (
    !companyStageReady &&
    providers.some((p) => p.startsWith("real_world_")) &&
    reasons.filter((r) => r.code === "provider_disabled").length >= 2
  ) {
    reasons.push({
      code: "provider_disabled",
      severity: "blocker",
      message: "All real-world company discovery providers are disabled.",
    })
  }

  return {
    qa_marker: PROSPECT_EXECUTION_QA_MARKER,
    search_plan_id,
    status: evaluateReadinessStatus(reasons),
    reasons,
    provider_status,
    requires_human_approval: true,
    execution_enabled: false,
  }
}

export function resolveProspectProviderEnvSnapshot(
  env: Record<string, string | undefined>,
): ProspectProviderEnvSnapshot {
  const apolloKey = env.APOLLO_API_KEY?.trim() || env.GROWTH_APOLLO_API_KEY?.trim() || ""
  const apolloEnabledRaw = env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED?.trim().toLowerCase() ?? ""
  const pdlKey = env.PEOPLE_DATA_LABS_API_KEY?.trim() || env.PDL_API_KEY?.trim() || ""

  return {
    apollo_configured: Boolean(apolloKey) || env.GROWTH_APOLLO_USE_MOCK === "1",
    apollo_enabled: apolloEnabledRaw === "1" || apolloEnabledRaw === "true" || apolloEnabledRaw === "yes",
    apollo_disabled: env.GROWTH_DISCOVERY_DISABLE_APOLLO === "1",
    pdl_configured: Boolean(pdlKey),
    pdl_disabled: env.GROWTH_DISCOVERY_DISABLE_PDL === "1",
    google_places_enabled: env.GROWTH_DISCOVERY_DISABLE_GOOGLE_PLACES !== "1",
    serp_enabled: env.GROWTH_DISCOVERY_DISABLE_SERP !== "1",
  }
}
