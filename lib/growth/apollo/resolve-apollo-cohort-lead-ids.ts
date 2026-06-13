import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadApolloPilotCohort } from "@/lib/growth/apollo/apollo-pilot-route"
import { loadApolloSequenceExecutionQueue } from "@/lib/growth/apollo/apollo-sequence-execution-queue"

export type ApolloCohortLeadResolution = {
  cohort_id: string
  company_candidate_ids: string[]
  lead_ids: string[]
}

/** Resolve pilot cohort leads via execution queue (not company_candidate_id on leads). */
export async function resolveApolloCohortLeadIds(
  admin: SupabaseClient,
  cohortId: string,
): Promise<ApolloCohortLeadResolution | null> {
  const cohort = await loadApolloPilotCohort(admin, cohortId)
  if (!cohort) return null

  const companyIds = new Set(cohort.companies.map((company) => company.company_candidate_id))
  const queue = await loadApolloSequenceExecutionQueue(admin, { status: "all", limit: 500 })
  const leadIds = [
    ...new Set(
      queue.items
        .filter((item) => companyIds.has(item.company_candidate_id) && item.growth_lead_id)
        .map((item) => item.growth_lead_id as string),
    ),
  ]

  return {
    cohort_id: cohortId,
    company_candidate_ids: [...companyIds],
    lead_ids: leadIds,
  }
}
