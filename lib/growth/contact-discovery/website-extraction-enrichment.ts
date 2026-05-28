/** Post-extraction enrichment — classification, evidence quality, branch mapping. Client-safe. */

import type { ExtractedWebsiteContact } from "@/lib/growth/contact-discovery/extract/extract-shared"
import { classifyWebsiteEmail, classifyWebsitePhone } from "@/lib/growth/contact-discovery/website-channel-classification"
import { scoreWebsiteContactEvidenceQuality } from "@/lib/growth/contact-discovery/website-evidence-quality"
import type { WebsitePageType } from "@/lib/growth/contact-discovery/website-extraction-acquisition-types"
import { buildLinkedInReferenceLabel } from "@/lib/growth/contact-discovery/website-profile-references"
import { GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER } from "@/lib/growth/contact-discovery/website-extraction-acquisition-types"

function countRepeatedEvidence(contacts: ExtractedWebsiteContact[], contact: ExtractedWebsiteContact): number {
  const key = `${contact.full_name.toLowerCase()}|${(contact.email ?? "").toLowerCase()}`
  return contacts.filter(
    (row) => `${row.full_name.toLowerCase()}|${(row.email ?? "").toLowerCase()}` === key,
  ).length
}

export function enrichExtractedWebsiteContacts(input: {
  contacts: ExtractedWebsiteContact[]
  companyDomain?: string | null
  linkedinCompanyUrls?: string[]
}): ExtractedWebsiteContact[] {
  const companyLinkedIn = input.linkedinCompanyUrls?.[0] ?? null

  return input.contacts.map((contact) => {
    const pageType = (contact.source_page_type ?? "generic") as WebsitePageType
    const pageText = contact.source_evidence[0]?.evidence ?? ""

    const emailClass = classifyWebsiteEmail({
      email: contact.email,
      pageType,
      pageText,
      personName: contact.full_name !== "Company contact" ? contact.full_name : null,
      title: contact.title,
    })
    const phoneClass = classifyWebsitePhone({
      phone: contact.phone,
      pageType,
      pageText,
      branchName: contact.branch_name,
    })

    const quality = scoreWebsiteContactEvidenceQuality({
      contact,
      pageType,
      companyDomain: input.companyDomain,
      repeatedEvidenceCount: countRepeatedEvidence(input.contacts, contact),
    })

    const linkedin_reference_label = buildLinkedInReferenceLabel({
      profileUrl: contact.linkedin_url,
      companyUrl: contact.linkedin_company_url ?? companyLinkedIn,
    })

    return {
      ...contact,
      linkedin_company_url: contact.linkedin_company_url ?? companyLinkedIn,
      linkedin_reference_label,
      email_classification: emailClass.classification,
      phone_classification: phoneClass.classification,
      email_classification_confidence: emailClass.confidence,
      phone_classification_confidence: phoneClass.confidence,
      evidence_quality_score: quality.evidence_quality_score,
      evidence_quality_label: quality.evidence_quality_label,
      evidence_quality_reasons: [
        ...quality.evidence_quality_reasons,
        ...emailClass.evidence.slice(0, 1),
        ...phoneClass.evidence.slice(0, 1),
      ].slice(0, 8),
      extraction_risks: quality.extraction_risks,
      branch_phone:
        contact.branch_phone ?? (pageType === "branch" || pageType === "locations" ? contact.phone : null),
    }
  })
}

export function resolveWebsiteExtractionEmptyHint(
  diagnostics: import("@/lib/growth/contact-discovery/website-extraction-acquisition-types").WebsiteExtractionDiagnosticsSnapshot,
): string | null {
  if (diagnostics.summary) return diagnostics.summary
  if (diagnostics.unreachable) return "Website unreachable — could not crawl public pages"
  if (diagnostics.contacts_found === 0 && diagnostics.pages_crawled.length > 0) {
    return "Website crawl found no team/contact pages"
  }
  return null
}

export { GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER }
