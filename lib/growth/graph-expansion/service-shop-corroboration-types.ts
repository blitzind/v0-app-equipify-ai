/** Phase 7.PS-IH — Service-shop corroboration & channel completion types. Client-safe. */

export const GROWTH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_QA_MARKER =
  "growth-service-shop-corroboration-channel-completion-7-ps-ih-v1" as const

export const GROWTH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_CERTIFICATION_QA_MARKER =
  "growth-service-shop-corroboration-channel-completion-certification-7-ps-ih-v1" as const

export const SERVICE_SHOP_CORROBORATION_MIN_SCORE = 60 as const
export const SERVICE_SHOP_CORROBORATION_EXTENDED_TIMEOUT_MS = 240_000 as const
export const SERVICE_SHOP_CORROBORATION_DEFAULT_TIMEOUT_MS = 120_000 as const
export const SERVICE_SHOP_CORROBORATION_MAX_EXTENDED_TARGETS = 10 as const

export type ServiceShopCorroborationTargetRow = {
  person_id: string
  company_contact_id: string
  canonical_company_id: string
  company_candidate_id: string
  company_name: string
  full_name: string
  title: string | null
  service_shop_score: number
  score_tier: "high" | "medium" | "low"
  is_ps_he_anchor: boolean
  has_external_evidence: boolean
  has_corroboration_evidence: boolean
  extended_timeout: boolean
}

export type ServiceShopCorroborationRejectedRow = {
  full_name: string
  company_name: string
  canonical_company_id: string
  service_shop_score: number
  rejection_reason: string
}

export type ServiceShopCorroborationChannelCompletionResult = {
  qa_marker: typeof GROWTH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_QA_MARKER
  ok: boolean
  selected_targets: ServiceShopCorroborationTargetRow[]
  rejected_targets: ServiceShopCorroborationRejectedRow[]
  metrics: {
    named_persons_selected: number
    persons_rejected_fragments: number
    persons_rejected_other: number
    corroborated_persons: number
    verified_emails: number
    verified_phones: number
    verified_profiles: number
    outreach_ready_contacts: number
    outreach_ready_companies: number
    extended_timeout_targets: number
  }
  before: {
    outreach_ready_contacts: number
    outreach_ready_companies: number
    verified_emails: number
    verified_phones: number
  }
  after: {
    outreach_ready_contacts: number
    outreach_ready_companies: number
    verified_emails: number
    verified_phones: number
  }
  outreach_ready_delta: {
    contacts: number
    companies: number
  }
  person_results: Array<{
    full_name: string
    company_name: string
    corroborated: boolean
    gained_verified_channel: boolean
    verified_channels_after: number
    messages: string[]
  }>
  messages: string[]
}
