/** Prospect Search — Growth Engine intelligence UX (Phase 7.PS-B). Client-safe. */

import type { GrowthCompanyIntelligenceCategory } from "@/lib/growth/company-intelligence/company-intelligence-types"
import { GROWTH_COMPANY_INTELLIGENCE_CATEGORIES } from "@/lib/growth/company-intelligence/company-intelligence-types"
import type { GrowthBuyingCommitteeIntelligenceRole } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import { GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"

export const GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER =
  "growth-prospect-search-intelligence-ux-7-ps-b-v1" as const

export const PROSPECT_SEARCH_ENGINE_INTELLIGENCE_FILTER_NOTE =
  "Verified channel and committee filters use Growth Engine 7.2–7.7 intelligence already linked to a canonical company. They apply after search loads — results may be fewer than the index estimate." as const

export const PROSPECT_SEARCH_LEGACY_COMPANY_SIGNALS_TITLE =
  "Previous company signals" as const

export const PROSPECT_SEARCH_LEGACY_CONTACT_DISCOVERY_COMMITTEE_TITLE =
  "Contact discovery hints" as const

export const PROSPECT_SEARCH_LEGACY_BUYING_COMMITTEE_PANEL_TITLE =
  "Buying committee discovery" as const

export const PROSPECT_SEARCH_LEGACY_PANEL_HELPER =
  "Shown when verified Growth Engine intelligence is not linked yet, or for side-by-side comparison. Prefer the verified intelligence panel above for company, committee, and channel data." as const

export const PROSPECT_SEARCH_ENGINE_INTELLIGENCE_PANEL_TITLE =
  "Verified intelligence" as const

export const PROSPECT_SEARCH_ENGINE_FILTER_SECTION_LABEL = "Verified intelligence" as const

export const PROSPECT_SEARCH_ENGINE_FILTER_SECTION_HELPER =
  "Filter on verified emails, phones, profiles, buying committee roles, and company intelligence categories from canonical Growth Engine tables — read-only, no new discovery runs from search." as const

export const PROSPECT_SEARCH_COMPANY_INTELLIGENCE_CATEGORY_LABELS: Record<
  GrowthCompanyIntelligenceCategory,
  string
> = {
  description: "Description",
  industry: "Industry",
  sub_industry: "Sub-industry",
  website_signal: "Website signals",
  technology: "Technology",
  social_presence: "Social presence",
  company_size: "Company size",
  location: "Location",
  hiring: "Hiring",
  contactability: "Contactability",
}

export const PROSPECT_SEARCH_BUYING_COMMITTEE_ROLE_LABELS: Record<
  GrowthBuyingCommitteeIntelligenceRole,
  string
> = {
  economic_buyer: "Economic buyer",
  technical_buyer: "Technical buyer",
  champion: "Champion",
  influencer: "Influencer",
  end_user: "End user",
  executive_sponsor: "Executive sponsor",
  procurement: "Procurement",
  blocker_risk_stakeholder: "Blocker / risk",
}

export function formatProspectSearchEngineDiscoveryStatus(status: string | null | undefined): string {
  const raw = (status ?? "").trim().toLowerCase()
  if (!raw || raw === "none") return "Not discovered"
  if (raw === "pending") return "Queued"
  if (raw === "running") return "Running"
  if (raw === "completed") return "Verified snapshots"
  if (raw === "failed") return "Last run failed"
  return raw.replace(/_/g, " ")
}

export function prospectSearchEngineDiscoveryBadgeVariant(
  status: string | null | undefined,
): "default" | "secondary" | "outline" | "destructive" {
  const raw = (status ?? "").trim().toLowerCase()
  if (raw === "completed") return "default"
  if (raw === "running" || raw === "pending") return "secondary"
  if (raw === "failed") return "destructive"
  return "outline"
}

export function shouldGateLegacyProspectSearchCompanySignals(
  engine: GrowthProspectSearchEngineIntelligence | null | undefined,
): boolean {
  return Boolean(engine?.has_canonical_company && engine.company_intelligence?.has_verified_intelligence)
}

export function shouldGateLegacyProspectSearchBuyingCommitteePanel(
  engine: GrowthProspectSearchEngineIntelligence | null | undefined,
): boolean {
  return Boolean(
    engine?.has_canonical_company &&
      (engine.buying_committee?.verified_member_count ?? 0) > 0,
  )
}

export function shouldRenameLegacyContactDiscoveryCommittee(
  engine: GrowthProspectSearchEngineIntelligence | null | undefined,
): boolean {
  return Boolean(
    engine?.has_canonical_company &&
      (engine.buying_committee?.verified_member_count ?? 0) > 0,
  )
}

export const PROSPECT_SEARCH_ENGINE_INTELLIGENCE_FILTER_CATEGORIES = [
  ...GROWTH_COMPANY_INTELLIGENCE_CATEGORIES,
] as const

export const PROSPECT_SEARCH_ENGINE_INTELLIGENCE_FILTER_ROLES = [
  ...GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES,
] as const
