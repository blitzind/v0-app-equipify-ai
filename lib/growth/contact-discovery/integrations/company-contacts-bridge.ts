/** Bridge growth.company_contacts → prospect search contact intelligence. Client-safe. */

import type { GrowthCompanyContact } from "@/lib/growth/contact-discovery/company-contact-types"
import type { ProspectSearchContactIntelligenceInputContact } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence"

export function companyContactToContactInput(
  contact: GrowthCompanyContact,
): ProspectSearchContactIntelligenceInputContact | null {
  if (!contact.full_name.trim()) return null
  if (contact.contact_status === "suppressed" || contact.contact_status === "archived") return null

  return {
    id: contact.id,
    full_name: contact.full_name,
    title: contact.title,
    email: contact.email,
    phone: contact.phone,
    linkedin_url: contact.linkedin_url,
    confidence: Math.min(0.99, Math.max(0.1, contact.confidence_score / 100)),
    role_type: contact.title,
    is_primary: contact.decision_maker_score >= 75,
    source_evidence: contact.source_evidence.map((item) => ({
      claim: item.claim,
      evidence: item.evidence,
      source: item.source,
    })),
  }
}
