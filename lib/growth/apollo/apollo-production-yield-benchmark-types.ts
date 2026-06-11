/** Apollo production yield benchmark — client-safe types and markers. */

export const APOLLO_PRODUCTION_YIELD_BENCHMARK_QA_MARKER =
  "apollo-production-yield-benchmark-greenfield-v1" as const

export const APOLLO_PRODUCTION_YIELD_BENCHMARK_ID =
  "apollo-production-yield-benchmark-greenfield-v1" as const

export const APOLLO_PRODUCTION_YIELD_BENCHMARK_DEFAULT_COMPANY_LIMIT = 50 as const
export const APOLLO_PRODUCTION_YIELD_BENCHMARK_MAX_COMPANY_LIMIT = 100 as const

export type ApolloProductionYieldFailureCategory =
  | "zero_raw"
  | "mapper_rejected"
  | "partial_identity_unresolved"
  | "no_verified_email"
  | "promotion_failed"
  | "contactability_failed"
  | "sequence_readiness_failed"

export type ApolloProductionYieldBenchmarkCompanyRow = {
  company_candidate_id: string
  company_name: string
  domain: string | null
  state: string | null
  industry: string | null
  domain_present: boolean
  domain_alias_used: boolean
  title_tier_winner: string | null
  raw_people_count: number
  mapped_contacts: number
  partial_identity_contacts: number
  verified_email_contacts: number
  promoted_contacts: number
  contactable_contacts: number
  sequence_ready_contacts: number
  historical_revalidated_contacts: number
  failure_category: ApolloProductionYieldFailureCategory | null
  blockers: string[]
}

export type ApolloProductionYieldBenchmarkAggregate = {
  companies_processed: number
  companies_with_raw_people: number
  companies_with_mapped_people: number
  raw_people_count: number
  mapped_contacts: number
  partial_identity_contacts: number
  verified_email_contacts: number
  promoted_contacts: number
  contactable_contacts: number
  sequence_ready_contacts: number
  contacts_per_company: number | null
  verified_emails_per_company: number | null
  sequence_ready_per_company: number | null
}

export type ApolloProductionYieldEconomics = {
  apollo_search_api_calls: number
  enrichment_api_calls: number
  estimated_credits_consumed: number
  sequence_ready_contacts_per_100_companies: number | null
  estimated_cost_per_sequence_ready_contact: number | null
  credits_per_company: number | null
}

export type ApolloProductionYieldSegmentBucket = {
  key: string
  companies: number
  sequence_ready_contacts: number
  verified_email_contacts: number
  mapped_contacts: number
  sequence_ready_per_company: number | null
}

export type ApolloProductionYieldFailureAnalysis = Record<
  ApolloProductionYieldFailureCategory,
  string[]
>

export type ApolloProductionYieldPlanRecommendation = {
  benchmark_passed_for_scale: boolean
  suggested_next_company_limit: number | null
  estimated_credits_per_100_sequence_ready_contacts: number | null
  monthly_credit_sizing_notes: string[]
  apollo_plan_notes: string[]
}

export type ApolloProductionYieldBenchmarkSafety = {
  auto_enrollment: false
  outreach_sent: false
  enrollment_confirmed: false
  execution_approved: false
  scheduler_ran: false
  draft_created: false
  sequence_scheduled: false
}

export type ApolloProductionYieldBenchmarkReport = {
  qa_marker: typeof APOLLO_PRODUCTION_YIELD_BENCHMARK_QA_MARKER
  benchmark_id: typeof APOLLO_PRODUCTION_YIELD_BENCHMARK_ID
  execution_id: string
  certified_at: string
  certification_mode: "greenfield"
  company_limit: number
  safety: ApolloProductionYieldBenchmarkSafety
  aggregate: ApolloProductionYieldBenchmarkAggregate
  economics: ApolloProductionYieldEconomics
  segments: {
    domain_present: ApolloProductionYieldSegmentBucket[]
    domain_alias_used: ApolloProductionYieldSegmentBucket[]
    title_tier_winner: ApolloProductionYieldSegmentBucket[]
    company_category: ApolloProductionYieldSegmentBucket[]
    state_location: ApolloProductionYieldSegmentBucket[]
  }
  failure_analysis: ApolloProductionYieldFailureAnalysis
  top_blockers: Array<{ category: ApolloProductionYieldFailureCategory; count: number; examples: string[] }>
  companies: ApolloProductionYieldBenchmarkCompanyRow[]
  recommendation: ApolloProductionYieldPlanRecommendation
  runtime: {
    duration_ms: number
    mock: boolean
    errors: string[]
  }
}
