import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveCanonicalCompanyIdForLead } from "@/lib/growth/canonical-persons/canonical-person-repository"
import { loadBuyingCommitteeIntelligenceOperatorStatus } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-operator-status"
import type { GrowthBuyingCommitteeIntelligenceLeadRollup } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-runtime-types"

export type { GrowthBuyingCommitteeIntelligenceLeadRollup } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-runtime-types"

export async function loadBuyingCommitteeIntelligenceLeadRollup(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthBuyingCommitteeIntelligenceLeadRollup> {
  const lead_id = leadId.trim()
  const company_id = await resolveCanonicalCompanyIdForLead(admin, lead_id)

  if (!company_id) {
    return {
      lead_id,
      company_id: null,
      has_canonical_company: false,
      has_verified_committee: false,
      missing_verified_committee: false,
      discovery_pending: false,
      discovery_failed: false,
    }
  }

  const status = await loadBuyingCommitteeIntelligenceOperatorStatus(admin, { company_id })
  if (!status) {
    return {
      lead_id,
      company_id,
      has_canonical_company: true,
      has_verified_committee: false,
      missing_verified_committee: true,
      discovery_pending: false,
      discovery_failed: false,
    }
  }

  const discovery_pending =
    status.discovery_status === "pending" || status.discovery_status === "running"

  return {
    lead_id,
    company_id,
    has_canonical_company: true,
    has_verified_committee: status.has_verified_committee,
    missing_verified_committee: !status.has_verified_committee,
    discovery_pending,
    discovery_failed: status.discovery_status === "failed",
  }
}
