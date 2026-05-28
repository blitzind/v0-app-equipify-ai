/** Parse website acquisition metadata from company_contacts.metadata — client-safe. */

import type {
  WebsiteContactAcquisitionSnapshot,
  WebsiteEmailClassification,
  WebsiteEvidenceQualityLabel,
  WebsiteExtractionDiagnosticsSnapshot,
  WebsitePageType,
  WebsitePhoneClassification,
} from "@/lib/growth/contact-discovery/website-extraction-acquisition-types"
import {
  GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER,
  GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER,
  GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER,
  WEBSITE_EMAIL_CLASSIFICATIONS,
  WEBSITE_EVIDENCE_QUALITY_LABELS,
  WEBSITE_PHONE_CLASSIFICATIONS,
} from "@/lib/growth/contact-discovery/website-extraction-acquisition-types"

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function asEmailClassification(value: unknown): WebsiteEmailClassification | null {
  return typeof value === "string" &&
    (WEBSITE_EMAIL_CLASSIFICATIONS as readonly string[]).includes(value)
    ? (value as WebsiteEmailClassification)
    : null
}

function asPhoneClassification(value: unknown): WebsitePhoneClassification | null {
  return typeof value === "string" &&
    (WEBSITE_PHONE_CLASSIFICATIONS as readonly string[]).includes(value)
    ? (value as WebsitePhoneClassification)
    : null
}

function asEvidenceLabel(value: unknown): WebsiteEvidenceQualityLabel | null {
  return typeof value === "string" &&
    (WEBSITE_EVIDENCE_QUALITY_LABELS as readonly string[]).includes(value)
    ? (value as WebsiteEvidenceQualityLabel)
    : null
}

function asPageType(value: unknown): WebsitePageType | null {
  const pageType = asString(value)
  if (!pageType) return null
  return pageType as WebsitePageType
}

export function parseWebsiteExtractionDiagnosticsFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): WebsiteExtractionDiagnosticsSnapshot | null {
  const raw = metadata?.website_extraction_diagnostics
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  return {
    qa_marker: GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER,
    pages_crawled: asStringArray(record.pages_crawled),
    pages_skipped: asStringArray(record.pages_skipped),
    pages_failed: asStringArray(record.pages_failed),
    contacts_found: typeof record.contacts_found === "number" ? record.contacts_found : 0,
    emails_found: typeof record.emails_found === "number" ? record.emails_found : 0,
    phones_found: typeof record.phones_found === "number" ? record.phones_found : 0,
    linkedin_references_found:
      typeof record.linkedin_references_found === "number" ? record.linkedin_references_found : 0,
    extraction_warnings: asStringArray(record.extraction_warnings),
    failure_reason: asString(record.failure_reason),
    robots_or_blocked: record.robots_or_blocked === true,
    unreachable: record.unreachable === true,
    last_crawl_at: asString(record.last_crawl_at) ?? new Date(0).toISOString(),
    summary: asString(record.summary),
  }
}

export function parseWebsiteContactAcquisitionFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  linkedinUrl?: string | null,
): Partial<WebsiteContactAcquisitionSnapshot> {
  if (!metadata) return {}

  const linkedin_profile_url = linkedinUrl ?? asString(metadata.linkedin_profile_url)
  const linkedin_company_url = asString(metadata.linkedin_company_url)
  const linkedin_reference_label = asString(metadata.linkedin_reference_label)

  return {
    qa_marker: GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER,
    source_page_type: asPageType(metadata.source_page_type),
    source_page_url: asString(metadata.source_page_url),
    email_classification: asEmailClassification(metadata.email_classification),
    phone_classification: asPhoneClassification(metadata.phone_classification),
    email_classification_confidence: asNumber(metadata.email_classification_confidence),
    phone_classification_confidence: asNumber(metadata.phone_classification_confidence),
    evidence_quality_score: asNumber(metadata.evidence_quality_score) ?? 0,
    evidence_quality_label:
      asEvidenceLabel(metadata.evidence_quality_label) ?? "needs_review",
    evidence_quality_reasons: asStringArray(metadata.evidence_quality_reasons),
    extraction_risks: asStringArray(metadata.extraction_risks),
    branch_name: asString(metadata.branch_name),
    branch_city: asString(metadata.branch_city),
    branch_state: asString(metadata.branch_state),
    branch_phone: asString(metadata.branch_phone),
    location_confidence: asNumber(metadata.location_confidence),
    linkedin_profile_url,
    linkedin_company_url,
    linkedin_reference_label,
    profile_reference_verification:
      linkedin_profile_url || linkedin_company_url ? "website_linked" : "unverified",
  }
}

export function formatWebsitePageTypeLabel(pageType: string | null | undefined): string {
  if (!pageType) return "Unknown page"
  return pageType.replace(/_/g, " ")
}

export function formatWebsiteEvidenceQualityLabel(label: string | null | undefined): string {
  if (!label) return "Needs review"
  return label.replace(/_/g, " ")
}

export {
  GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER,
  GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER,
  GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER,
}
