/** GE-AIOS-21C — ICP lead admission gate types (client-safe). */

export const GROWTH_LEAD_ADMISSION_21C_QA_MARKER = "ge-aios-21c-lead-admission-gate-v1" as const

export const GROWTH_LEAD_ADMISSION_STATES = [
  "accepted",
  "review",
  "rejected",
  "invalid",
] as const

export type GrowthLeadAdmissionState = (typeof GROWTH_LEAD_ADMISSION_STATES)[number]

export type GrowthLeadAdmissionEvaluation = {
  qa_marker: typeof GROWTH_LEAD_ADMISSION_21C_QA_MARKER
  state: GrowthLeadAdmissionState
  reasons: string[]
  allowLeadCreation: boolean
  allowAutoResearch: boolean
  leadStatus: "new" | "disqualified"
  requiresHumanReview: boolean
  blockers: string[]
  sanitized: {
    companyName: string
    website: string | null
    domain: string | null
  }
}
