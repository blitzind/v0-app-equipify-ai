/** Apollo search API budget evidence — client-safe readiness/execute payload. */

import { resolveApolloScale2CompanyLimit } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"
import { APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN } from "@/lib/growth/apollo/apollo-single-company-search-diagnostic-gates"
import { resolveApolloCreditLimits } from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_SEARCH_API_BUDGET_EVIDENCE_QA_MARKER =
  "apollo-search-api-budget-evidence-v1" as const

export type ApolloSearchApiBudgetEvidence = {
  qa_marker: typeof APOLLO_SEARCH_API_BUDGET_EVIDENCE_QA_MARKER
  current_max_api_calls_per_run: number
  minimum_for_full_cohort_tiers: number
  recommended_for_cert: number
  sufficient_for_full_cohort: boolean
  recommended_env: string
  search_api_calls_consumed: number | null
  total_api_calls_consumed: number | null
  companies_acquired: number | null
  enrichment_batches_consumed: number | null
}

export function buildApolloSearchApiBudgetEvidence(input?: {
  env?: NodeJS.ProcessEnv
  guardrails?: {
    search_api_calls?: number
    api_calls?: number
    companies_acquired?: number
    bulk_match_batches?: number
  } | null
  company_limit?: number
}): ApolloSearchApiBudgetEvidence {
  const env = input?.env ?? process.env
  const limits = resolveApolloCreditLimits(env)
  const company_limit = input?.company_limit ?? resolveApolloScale2CompanyLimit()
  const minimum_for_full_cohort_tiers = company_limit * 5

  return {
    qa_marker: APOLLO_SEARCH_API_BUDGET_EVIDENCE_QA_MARKER,
    current_max_api_calls_per_run: limits.max_api_calls_per_run,
    minimum_for_full_cohort_tiers,
    recommended_for_cert: APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN,
    sufficient_for_full_cohort: limits.max_api_calls_per_run >= minimum_for_full_cohort_tiers,
    recommended_env: `GROWTH_APOLLO_MAX_API_CALLS_PER_RUN=${APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN}`,
    search_api_calls_consumed: input?.guardrails?.search_api_calls ?? null,
    total_api_calls_consumed: input?.guardrails?.api_calls ?? null,
    companies_acquired: input?.guardrails?.companies_acquired ?? null,
    enrichment_batches_consumed: input?.guardrails?.bulk_match_batches ?? null,
  }
}
