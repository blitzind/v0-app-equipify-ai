/** Phase 7.PS-HV — Generic contact containment types. Client-safe. */

export const GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER =
  "growth-generic-contact-containment-7-ps-hv-v1" as const

export type CompanyChannelRecord = {
  channel_type: "email" | "phone" | "linkedin"
  value: string
  classification: "company_channel" | "role_contact" | "generic_placeholder"
  identity_classification: string
  source_contact_id: string
  source_type: string | null
  source_evidence: Array<{ claim?: string; evidence?: string; source?: string; page_url?: string | null }>
  contained_at: string
  qa_marker: typeof GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER
}

export type GenericContactContainmentMetrics = {
  generic_shells_before: number
  generic_shells_after: number
  contacts_unlinked: number
  company_channels_preserved: number
  persons_contained: number
  named_person_density_before_pct: number
  named_person_density_after_pct: number
  persons_total_before: number
  persons_total_after: number
}

export type GenericContactContainmentResult = {
  qa_marker: typeof GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER
  ok: boolean
  metrics: GenericContactContainmentMetrics
  samples: Array<{
    company_contact_id: string
    company_id: string
    previous_person_id: string | null
    classification: string
    channels_preserved: string[]
  }>
  messages: string[]
}
