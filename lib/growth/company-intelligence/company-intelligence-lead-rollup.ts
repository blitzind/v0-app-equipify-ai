import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveCanonicalCompanyIdForLead } from "@/lib/growth/canonical-persons/canonical-person-repository"
import { loadCompanyIntelligenceOperatorStatus } from "@/lib/growth/company-intelligence/company-intelligence-operator-status"
import type { GrowthCompanyIntelligenceLeadRollup } from "@/lib/growth/company-intelligence/company-intelligence-runtime-types"

export type { GrowthCompanyIntelligenceLeadRollup } from "@/lib/growth/company-intelligence/company-intelligence-runtime-types"

export async function loadCompanyIntelligenceLeadRollup(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthCompanyIntelligenceLeadRollup> {
  const lead_id = leadId.trim()
  const company_id = await resolveCanonicalCompanyIdForLead(admin, lead_id)

  if (!company_id) {
    return {
      lead_id,
      company_id: null,
      has_canonical_company: false,
      has_verified_intelligence: false,
      missing_verified_intelligence: false,
      discovery_pending: false,
      discovery_failed: false,
    }
  }

  const status = await loadCompanyIntelligenceOperatorStatus(admin, { company_id })
  if (!status) {
    return {
      lead_id,
      company_id,
      has_canonical_company: true,
      has_verified_intelligence: false,
      missing_verified_intelligence: true,
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
    has_verified_intelligence: status.has_verified_intelligence,
    missing_verified_intelligence: !status.has_verified_intelligence,
    discovery_pending,
    discovery_failed: status.discovery_status === "failed",
  }
}
