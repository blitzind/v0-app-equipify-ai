export const GROWTH_SIGNAL_FOUNDATION_QA_MARKER = "growth-signal-foundation-v1" as const

export const GROWTH_SIGNAL_TYPES = [
  "website_visitor",
  "job_change",
  "promotion",
  "hire",
  "job_posting",
  "news_event",
  "tech_install",
  "funding_event",
  "search_intent",
  "manual_signal",
] as const

export type GrowthSignalType = (typeof GROWTH_SIGNAL_TYPES)[number]

export const GROWTH_SIGNAL_WORKFLOW_STATES = [
  "new",
  "reviewed",
  "routed",
  "suppressed",
  "expired",
] as const

export type GrowthSignalWorkflowState = (typeof GROWTH_SIGNAL_WORKFLOW_STATES)[number]

export const GROWTH_SIGNAL_SUPPRESSION_STATES = ["active", "suppressed", "dismissed"] as const

export type GrowthSignalSuppressionState = (typeof GROWTH_SIGNAL_SUPPRESSION_STATES)[number]

export const GROWTH_SIGNAL_URGENCY_LEVELS = ["low", "normal", "high", "urgent"] as const

export type GrowthSignalUrgency = (typeof GROWTH_SIGNAL_URGENCY_LEVELS)[number]

export const GROWTH_SIGNAL_SOURCE_TYPES = [
  "website",
  "team_page",
  "contact_page",
  "about_page",
  "careers_page",
  "google_business",
  "linkedin_company",
  "press_news",
  "review_site",
  "job_posting",
  "tech_stack",
  "public_record",
  "manual",
  "intent_pixel",
  "search_intent",
  "other",
] as const

export type GrowthSignalSourceType = (typeof GROWTH_SIGNAL_SOURCE_TYPES)[number]

export const GROWTH_SIGNAL_TARGET_KINDS = [
  "company",
  "contact",
  "domain",
  "territory",
  "lead",
  "other",
] as const

export type GrowthSignalTargetKind = (typeof GROWTH_SIGNAL_TARGET_KINDS)[number]

export const GROWTH_SIGNAL_EVENT_TYPES = [
  "ingested",
  "scored",
  "routed",
  "suppressed",
  "rejected_no_evidence",
  "rejected_duplicate",
  "expired",
  "error",
] as const

export type GrowthSignalEventType = (typeof GROWTH_SIGNAL_EVENT_TYPES)[number]

export type GrowthSignalEvidenceDraft = {
  source_type: GrowthSignalSourceType
  source_label?: string
  source_url?: string | null
  publisher?: string | null
  excerpt: string
  observed_at?: string
  confidence_score?: number
  dedupe_hash?: string
  metadata?: Record<string, unknown>
}

export type GrowthSignalTargetDraft = {
  target_kind: GrowthSignalTargetKind
  target_ref: string
  target_label?: string
  metadata?: Record<string, unknown>
}

export type GrowthSignalAttributionDraft = {
  provider_key: string
  provider_event_id?: string | null
  ingested_at?: string
  metadata?: Record<string, unknown>
}

export type GrowthNormalizedSignalDraft = {
  organization_id?: string | null
  signal_type: GrowthSignalType
  provider_key: string
  provider_event_id?: string | null
  occurred_at: string
  detected_at?: string
  expires_at?: string | null
  company_id?: string | null
  company_name?: string
  domain?: string | null
  contact_id?: string | null
  contact_display_label?: string | null
  title?: string | null
  previous_title?: string | null
  seniority?: string | null
  geography?: string | null
  industry?: string | null
  category?: string | null
  evidence: GrowthSignalEvidenceDraft[]
  targets?: GrowthSignalTargetDraft[]
  attribution?: GrowthSignalAttributionDraft
  metadata?: Record<string, unknown>
  raw_payload?: unknown
}

export type GrowthSignalSourceRow = {
  id: string
  source_type: GrowthSignalSourceType
  source_label: string
  source_url: string | null
  publisher: string | null
  excerpt: string
  observed_at: string
  confidence_score: number
}

export type GrowthSignalTargetRow = {
  id: string
  target_kind: GrowthSignalTargetKind
  target_ref: string
  target_label: string
}

export type GrowthSignalEventRow = {
  id: string
  event_type: GrowthSignalEventType
  occurred_at: string
}

export type GrowthSignalRow = {
  id: string
  organization_id: string | null
  signal_type: GrowthSignalType
  provider_key: string
  provider_event_id: string | null
  dedupe_hash: string
  confidence: number
  signal_score: number
  urgency: GrowthSignalUrgency
  routing_priority: number
  occurred_at: string
  detected_at: string
  expires_at: string | null
  company_id: string | null
  company_name: string
  domain: string | null
  contact_id: string | null
  contact_display_label: string | null
  title: string | null
  previous_title: string | null
  seniority: string | null
  geography: string | null
  industry: string | null
  category: string | null
  evidence_summary: string
  workflow_state: GrowthSignalWorkflowState
  suppression_state: GrowthSignalSuppressionState
  processed_to_lead_inbox: boolean
  lead_inbox_id: string | null
  created_at: string
  updated_at: string
  metadata: Record<string, unknown>
}

export type GrowthSignalDetailRow = GrowthSignalRow & {
  sources: GrowthSignalSourceRow[]
  targets: GrowthSignalTargetRow[]
  events: GrowthSignalEventRow[]
}

export type GrowthSignalListFilters = {
  signal_type?: GrowthSignalType
  workflow_state?: GrowthSignalWorkflowState
  urgency?: GrowthSignalUrgency
  company?: string
  domain?: string
  category?: string
  publisher?: string
  occurred_from?: string
  occurred_to?: string
  organization_id?: string | null
  limit?: number
  offset?: number
}

export type GrowthSignalListResult = {
  qa_marker: typeof GROWTH_SIGNAL_FOUNDATION_QA_MARKER
  items: GrowthSignalRow[]
  total: number
}

export type GrowthSignalScoringResult = {
  signal_score: number
  confidence: number
  urgency: GrowthSignalUrgency
  routing_priority: number
  scoring_metadata: Record<string, unknown>
}

export const GROWTH_SIGNAL_INTERNAL_FIELD_NAMES = [
  "raw_payload_ref",
  "raw_payload_id",
  "raw_payload",
  "scoring_metadata",
  "enrichment_metadata",
  "internal_debug",
] as const
