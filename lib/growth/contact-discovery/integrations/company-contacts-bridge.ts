/** Bridge growth.company_contacts → prospect search contact intelligence. Client-safe. */

import type { GrowthCompanyContact } from "@/lib/growth/contact-discovery/company-contact-types"
import type { ProspectSearchContactIntelligenceInputContact } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence"
import { formatWebsiteExtractEvidenceLabel } from "@/lib/growth/contact-discovery/website-extract-mapper"
import { parseWebsiteContactAcquisitionFromMetadata } from "@/lib/growth/contact-discovery/website-acquisition-metadata-bridge"

function resolveCompanyContactVerificationStatus(
  contact: GrowthCompanyContact,
): string {
  if (contact.contact_status === "suppressed") return "suppressed"
  if (contact.email_status === "verified" && contact.phone_status !== "invalid") return "verified_channels"
  if (contact.email_status === "verified") return "email_verified"
  if (contact.phone_status === "business" || contact.phone_status === "mobile") return "phone_verified"
  if (contact.email?.trim()) return "email_discovered"
  if (contact.phone?.trim()) return "phone_discovered"
  return "pending_verification"
}

export function companyContactToContactInput(
  contact: GrowthCompanyContact,
): ProspectSearchContactIntelligenceInputContact | null {
  if (!contact.full_name.trim()) return null
  if (contact.contact_status === "suppressed" || contact.contact_status === "archived") return null

  const sourceLabel = formatWebsiteExtractEvidenceLabel({
    source_type: contact.source_type,
    source_evidence: contact.source_evidence,
  })
  const acquisition = parseWebsiteContactAcquisitionFromMetadata(contact.metadata, contact.linkedin_url)

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
      page_url: item.page_url ?? null,
    })),
    source_page_url:
      acquisition.source_page_url ??
      contact.source_evidence[0]?.page_url ??
      null,
    last_checked_at:
      contact.last_verified_at ??
      (typeof contact.metadata.last_checked_at === "string" ? contact.metadata.last_checked_at : null) ??
      contact.updated_at,
    verification_status: resolveCompanyContactVerificationStatus(contact),
    discovered_at: contact.created_at,
    last_verified_at: contact.last_verified_at,
    email_status: contact.email_status,
    phone_status: contact.phone_status,
    source_page_type: acquisition.source_page_type ?? null,
    email_classification: acquisition.email_classification ?? null,
    phone_classification: acquisition.phone_classification ?? null,
    evidence_quality_score: acquisition.evidence_quality_score ?? null,
    evidence_quality_label: acquisition.evidence_quality_label ?? null,
    evidence_quality_reasons: acquisition.evidence_quality_reasons ?? [],
    extraction_risks: acquisition.extraction_risks ?? [],
    branch_name: acquisition.branch_name ?? null,
    branch_city: acquisition.branch_city ?? null,
    branch_state: acquisition.branch_state ?? null,
    branch_phone: acquisition.branch_phone ?? null,
    location_confidence: acquisition.location_confidence ?? null,
    linkedin_company_url: acquisition.linkedin_company_url ?? null,
    linkedin_reference_label: acquisition.linkedin_reference_label ?? null,
    discovery_sources: [
      "website_public_extract",
      contact.source_type,
      sourceLabel,
    ],
  }
}
