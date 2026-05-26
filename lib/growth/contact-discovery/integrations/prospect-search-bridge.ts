import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  loadContactDiscoverySnapshot,
  runContactDiscoveryForCompany,
} from "@/lib/growth/contact-discovery/contact-repository"
import type { GrowthContactDiscoverySnapshot } from "@/lib/growth/contact-discovery/contact-discovery-types"
import type { GrowthProspectSearchPersonResult } from "@/lib/growth/prospect-search/prospect-search-types"

export function contactCandidatesToProspectSearchPeople(
  snapshot: GrowthContactDiscoverySnapshot,
  companyId: string,
  companyName: string,
): GrowthProspectSearchPersonResult[] {
  return snapshot.contacts.map((c) => ({
    id: c.id,
    source_type: "external_discovered",
    company_id: companyId,
    company_name: companyName,
    full_name: c.full_name,
    title: c.job_title,
    email: c.email,
    phone: c.phone,
    role: c.job_title,
    verification_status: c.verification_state,
    rank_score: c.confidence,
  }))
}

export async function fetchProspectSearchContactDiscovery(
  admin: SupabaseClient,
  companyCandidateId: string,
  options?: { run_discovery?: boolean; created_by?: string | null },
): Promise<GrowthContactDiscoverySnapshot> {
  if (options?.run_discovery) {
    return runContactDiscoveryForCompany(admin, {
      company_candidate_id: companyCandidateId,
      created_by: options.created_by,
    })
  }
  return loadContactDiscoverySnapshot(admin, companyCandidateId)
}
