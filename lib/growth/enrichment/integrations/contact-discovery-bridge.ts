import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadVerificationEnrichmentSnapshot } from "@/lib/growth/enrichment/enrichment-repository"
import type { GrowthVerificationEnrichmentSnapshot } from "@/lib/growth/enrichment/enrichment-types"

export async function loadEnrichmentForContactDiscovery(
  admin: SupabaseClient,
  contactCandidateId: string,
  companyCandidateId?: string | null,
): Promise<GrowthVerificationEnrichmentSnapshot> {
  return loadVerificationEnrichmentSnapshot(admin, {
    contact_candidate_id: contactCandidateId,
    company_candidate_id: companyCandidateId ?? null,
  })
}
