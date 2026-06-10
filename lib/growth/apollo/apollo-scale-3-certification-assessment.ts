/** Apollo Scale-3 certification assessment — client-safe current-run PASS gate. */

import type { ApolloScale2CertResult } from "@/lib/growth/apollo/apollo-scale-2-live-acquisition-certification"
import type { ApolloScale3MappedCompanyEvidenceRow } from "@/lib/growth/apollo/apollo-scale-3-company-promotion-evidence"

export function assessApolloScale3SearchStrategyResult(input: {
  companies: ApolloScale3MappedCompanyEvidenceRow[]
  mock: boolean
}): ApolloScale2CertResult {
  if (input.mock) return "FAIL"

  const apolloReady = input.companies.filter(
    (row) =>
      row.mapped_contacts > 0 &&
      row.promotion_evidence.current_run_apollo_verified_email_contacts > 0 &&
      row.promotion_evidence.current_run_apollo_promoted_contacts > 0 &&
      row.promotion_evidence.current_run_apollo_contactable_contacts > 0 &&
      row.promotion_evidence.current_run_apollo_sequence_ready_contacts > 0,
  )

  if (apolloReady.length >= 1) return "PASS"
  return "FAIL"
}
