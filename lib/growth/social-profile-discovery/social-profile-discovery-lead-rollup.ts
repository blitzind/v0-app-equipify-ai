import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveCanonicalCompanyIdForLead } from "@/lib/growth/canonical-persons/canonical-person-repository"
import { loadSocialProfileDiscoveryOperatorStatus } from "@/lib/growth/social-profile-discovery/social-profile-discovery-operator-status"
import type { GrowthSocialProfileDiscoveryLeadRollup } from "@/lib/growth/social-profile-discovery/social-profile-discovery-runtime-types"

export type { GrowthSocialProfileDiscoveryLeadRollup } from "@/lib/growth/social-profile-discovery/social-profile-discovery-runtime-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function loadSocialProfileDiscoveryLeadRollup(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthSocialProfileDiscoveryLeadRollup> {
  const lead_id = leadId.trim()
  const company_id = await resolveCanonicalCompanyIdForLead(admin, lead_id)

  const { data: dms } = await admin
    .schema("growth")
    .from("lead_decision_makers")
    .select("canonical_person_id")
    .eq("lead_id", lead_id)
    .neq("status", "rejected")

  const personIds = (dms ?? [])
    .map((row) => asString((row as { canonical_person_id?: string }).canonical_person_id))
    .filter(Boolean)

  if (!company_id || personIds.length === 0) {
    return {
      lead_id,
      company_id,
      canonical_pair_count: 0,
      has_verified_profile: false,
      missing_verified_profile: false,
      discovery_pending: false,
      discovery_failed: false,
    }
  }

  let has_verified_profile = false
  let missing_verified_profile = false
  let discovery_pending = false
  let discovery_failed = false
  let canonical_pair_count = 0

  for (const person_id of personIds.slice(0, 12)) {
    const status = await loadSocialProfileDiscoveryOperatorStatus(admin, {
      company_id,
      person_id,
      discovery_scope: "person",
    })
    if (!status) continue
    canonical_pair_count += 1
    if (status.has_verified_profile) has_verified_profile = true
    else missing_verified_profile = true
    if (status.discovery_status === "pending" || status.discovery_status === "running") {
      discovery_pending = true
    }
    if (status.discovery_status === "failed") {
      discovery_failed = true
    }
  }

  return {
    lead_id,
    company_id,
    canonical_pair_count,
    has_verified_profile,
    missing_verified_profile,
    discovery_pending,
    discovery_failed,
  }
}
