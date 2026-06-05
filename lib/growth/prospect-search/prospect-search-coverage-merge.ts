/** Prospect Search — merge coverage diagnostics into contact intelligence (7.PS-E). Client-safe. */

import { buildProspectSearchIntelligenceCoverage } from "@/lib/growth/prospect-search/prospect-search-coverage-metrics"
import type {
  ProspectSearchCompanyResolutionCoverage,
  ProspectSearchContactLinkageCoverage,
} from "@/lib/growth/prospect-search/prospect-search-coverage-types"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import type { ProspectSearchContactOverlay } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

export function applyPersonLinkageToContactOverlays(
  contacts: ProspectSearchContactOverlay[],
  linkageByContactId: Map<string, ProspectSearchContactLinkageCoverage>,
): ProspectSearchContactOverlay[] {
  return contacts.map((contact) => {
    const linkage = linkageByContactId.get(contact.id)
    if (!linkage?.canonical_person_id) return contact
    return {
      ...contact,
      canonical_person_id: linkage.canonical_person_id,
    }
  })
}

export function mergeProspectSearchCoverageIntoContactIntelligence(
  intelligence: GrowthProspectSearchContactIntelligence,
  input: {
    company: ProspectSearchCompanyResolutionCoverage
    contacts: ProspectSearchContactLinkageCoverage[]
  },
): GrowthProspectSearchContactIntelligence {
  const coverage = buildProspectSearchIntelligenceCoverage({
    company: input.company,
    contacts: input.contacts,
    contact_intelligence: intelligence,
  })

  const source_labels = [
    ...new Set([...(intelligence.source_labels ?? []), "growth.engine_coverage"]),
  ]

  return {
    ...intelligence,
    source_labels,
    engine_coverage: coverage,
  }
}
