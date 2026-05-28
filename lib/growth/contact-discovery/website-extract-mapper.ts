/** Map website extraction results → contact discovery provider raw contacts. Client-safe. */

import type { GrowthContactDiscoveryProviderRawContact } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import type { ExtractedWebsiteContact } from "@/lib/growth/contact-discovery/extract/extract-shared"

export const GROWTH_WEBSITE_CONTACT_PROVIDER_QA_MARKER = "growth-website-contact-provider-v1" as const

function sourceLabel(sourceType: ExtractedWebsiteContact["source_type"]): string {
  switch (sourceType) {
    case "contact_page":
      return "Contact page"
    case "team_page":
      return "Team page"
    case "website":
      return "Website"
    default:
      return sourceType.replace(/_/g, " ")
  }
}

export function formatWebsiteExtractEvidenceLabel(
  contact: Pick<ExtractedWebsiteContact, "source_type" | "source_evidence">,
): string {
  const pageUrl = contact.source_evidence[0]?.page_url
  let pageLabel: string | null = null
  if (pageUrl) {
    try {
      pageLabel = new URL(pageUrl).pathname.replace(/^\//, "") || "homepage"
    } catch {
      pageLabel = pageUrl
    }
  }
  const base = `Found on website ${sourceLabel(contact.source_type).toLowerCase()}`
  if (pageLabel && pageLabel !== "homepage") return `${base} (${pageLabel})`
  if (pageUrl) return `${base} (${pageUrl})`
  return base
}

export function mapExtractedWebsiteContactToProviderRaw(
  extracted: ExtractedWebsiteContact,
): GrowthContactDiscoveryProviderRawContact | null {
  const full_name = extracted.full_name.trim()
  if (!full_name) return null

  const hasPii = Boolean(extracted.email?.trim() || extracted.phone?.trim() || extracted.linkedin_url?.trim())
  const evidenceLabel = formatWebsiteExtractEvidenceLabel(extracted)
  const pageUrl = extracted.source_evidence[0]?.page_url ?? null

  const evidence = extracted.source_evidence.map((item) => ({
    claim: item.claim,
    evidence: item.evidence,
    source: item.source,
  }))

  if (evidence.length === 0) {
    evidence.push({
      claim: "Public website extraction",
      evidence: evidenceLabel,
      source: "website_public_extract",
    })
  }

  const confidenceBase =
    (extracted.leadership_indicator ? 0.72 : 0.62) +
    (extracted.evidence_quality_score != null
      ? Math.min(0.12, extracted.evidence_quality_score / 1000)
      : 0)

  return {
    full_name,
    first_name: extracted.first_name,
    last_name: extracted.last_name,
    job_title: extracted.title,
    department: extracted.department,
    email: extracted.email,
    phone: extracted.phone,
    linkedin_url: extracted.linkedin_url,
    pii_observed: hasPii,
    confidence: Math.min(0.95, confidenceBase),
    evidence,
    source_attribution: [
      {
        source: "website_public_extract",
        provider_type: "website_public_extract",
        provider_name: "website_public_extract",
        signal: extracted.source_type,
        evidence: evidenceLabel,
        confidence: Math.min(0.95, confidenceBase),
      },
    ],
    metadata: {
      qa_marker: GROWTH_WEBSITE_CONTACT_PROVIDER_QA_MARKER,
      source_type: extracted.source_type,
      source_page_url: pageUrl,
      source_page_type: extracted.source_page_type,
      leadership_indicator: extracted.leadership_indicator,
      email_classification: extracted.email_classification,
      phone_classification: extracted.phone_classification,
      evidence_quality_score: extracted.evidence_quality_score,
      evidence_quality_label: extracted.evidence_quality_label,
      evidence_quality_reasons: extracted.evidence_quality_reasons,
      extraction_risks: extracted.extraction_risks,
      branch_name: extracted.branch_name,
      branch_city: extracted.branch_city,
      branch_state: extracted.branch_state,
      branch_phone: extracted.branch_phone,
      location_confidence: extracted.location_confidence,
      linkedin_company_url: extracted.linkedin_company_url,
      linkedin_reference_label: extracted.linkedin_reference_label,
    },
  }
}

export function mapExtractedWebsiteContactsToProviderRaw(
  extracted: ExtractedWebsiteContact[],
): GrowthContactDiscoveryProviderRawContact[] {
  const out: GrowthContactDiscoveryProviderRawContact[] = []
  for (const item of extracted) {
    const mapped = mapExtractedWebsiteContactToProviderRaw(item)
    if (mapped) out.push(mapped)
  }
  return out
}
