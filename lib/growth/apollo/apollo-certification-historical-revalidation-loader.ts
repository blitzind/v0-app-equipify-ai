/** Load Apollo historical revalidation candidates — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { readApolloPersonIdFromCandidate } from "@/lib/growth/apollo/apollo-email-channel-evidence"
import {
  isApolloHistoricalRevalidationCandidate,
  type ApolloHistoricalRevalidationCandidate,
} from "@/lib/growth/apollo/apollo-certification-historical-revalidation-evidence"
import { listContactCandidatesForCompany } from "@/lib/growth/acquisition/sync-contact-candidates-to-company-contacts"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function loadApolloHistoricalRevalidationCandidates(
  admin: SupabaseClient,
  company_candidate_id: string,
): Promise<ApolloHistoricalRevalidationCandidate[]> {
  const candidates = await listContactCandidatesForCompany(admin, company_candidate_id, 200)
  return candidates
    .filter(isApolloHistoricalRevalidationCandidate)
    .map((candidate) => ({
      contact_candidate_id: asString(candidate.id),
      full_name: candidate.full_name,
      apollo_person_id: readApolloPersonIdFromCandidate(candidate)!,
      email: asString(candidate.email),
      attribution_source: "historical_revalidated_apollo_candidate" as const,
    }))
}
