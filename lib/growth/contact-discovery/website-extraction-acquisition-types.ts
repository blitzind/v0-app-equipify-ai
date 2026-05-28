/** Deep contact acquisition types — client-safe. */

export const GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER = "growth-deep-contact-acquisition-v1" as const
export const GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER = "growth-website-extraction-quality-v1" as const
export const GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER = "growth-public-profile-reference-v1" as const

export const WEBSITE_EMAIL_CLASSIFICATIONS = [
  "personal_email",
  "role_email",
  "department_email",
  "support_email",
  "sales_email",
  "dispatch_email",
  "billing_email",
  "generic_info_email",
  "owner_leadership_email",
  "invalid_disposable",
  "unknown",
] as const

export type WebsiteEmailClassification = (typeof WEBSITE_EMAIL_CLASSIFICATIONS)[number]

export const WEBSITE_PHONE_CLASSIFICATIONS = [
  "main_office",
  "dispatch",
  "service",
  "sales",
  "support",
  "toll_free",
  "branch_office",
  "mobile_possible",
  "unknown",
] as const

export type WebsitePhoneClassification = (typeof WEBSITE_PHONE_CLASSIFICATIONS)[number]

export const WEBSITE_EVIDENCE_QUALITY_LABELS = [
  "strong_public_evidence",
  "moderate_public_evidence",
  "weak_public_evidence",
  "needs_review",
  "invalid",
] as const

export type WebsiteEvidenceQualityLabel = (typeof WEBSITE_EVIDENCE_QUALITY_LABELS)[number]

export type WebsitePageType =
  | "homepage"
  | "contact"
  | "about"
  | "team"
  | "leadership"
  | "staff"
  | "services"
  | "locations"
  | "branch"
  | "careers"
  | "privacy"
  | "terms"
  | "blog_author"
  | "schema_org"
  | "footer"
  | "generic"

export type WebsiteContactAcquisitionSnapshot = {
  qa_marker: typeof GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER
  source_page_type: WebsitePageType | null
  source_page_url: string | null
  email_classification: WebsiteEmailClassification | null
  phone_classification: WebsitePhoneClassification | null
  email_classification_confidence: number | null
  phone_classification_confidence: number | null
  evidence_quality_score: number
  evidence_quality_label: WebsiteEvidenceQualityLabel
  evidence_quality_reasons: string[]
  extraction_risks: string[]
  branch_name: string | null
  branch_city: string | null
  branch_state: string | null
  branch_phone: string | null
  location_confidence: number | null
  linkedin_profile_url: string | null
  linkedin_company_url: string | null
  linkedin_reference_label: string | null
  profile_reference_verification: "unverified" | "website_linked"
}

export type WebsiteExtractionDiagnosticsSnapshot = {
  qa_marker: typeof GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER
  pages_crawled: string[]
  pages_skipped: string[]
  pages_failed: string[]
  contacts_found: number
  emails_found: number
  phones_found: number
  linkedin_references_found: number
  extraction_warnings: string[]
  failure_reason: string | null
  robots_or_blocked: boolean
  unreachable: boolean
  last_crawl_at: string
  summary: string | null
}
