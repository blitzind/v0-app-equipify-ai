/** Browser extension buying committee capture — client-safe. */

export const GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_QA_MARKER =
  "growth-browser-intake-buying-committee-v1" as const

export const GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_TARGET_ROLES = [
  "CEO",
  "President",
  "Owner",
  "Director",
  "VP Operations",
  "Service Manager",
  "Purchasing",
  "Operations Manager",
] as const

export type GrowthBrowserIntakeBuyingCommitteeTargetRole =
  (typeof GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_TARGET_ROLES)[number]

export type GrowthBrowserIntakeBuyingCommitteeCandidateInput = {
  candidate_id: string
  full_name: string
  job_title?: string | null
  target_role?: string | null
  linkedin_url?: string | null
  email?: string | null
  phone?: string | null
  source: string
  confidence: number
  evidence?: string | null
}

export type GrowthBrowserIntakeBuyingCommitteeCandidate =
  GrowthBrowserIntakeBuyingCommitteeCandidateInput & {
    already_imported: boolean
    matched_target_role: GrowthBrowserIntakeBuyingCommitteeTargetRole | null
  }

export type GrowthBrowserIntakeBuyingCommitteeDiscoveryResult = {
  company_name: string
  lead_id: string | null
  linkedin_page_kind: "company" | "profile" | "other" | null
  candidates: GrowthBrowserIntakeBuyingCommitteeCandidate[]
  target_roles: GrowthBrowserIntakeBuyingCommitteeTargetRole[]
}

export type GrowthBrowserIntakeBuyingCommitteeImportSelection = {
  candidate_id: string
  full_name: string
  job_title?: string | null
  linkedin_url?: string | null
  email?: string | null
  phone?: string | null
  source?: string | null
}

export type GrowthBrowserIntakeBuyingCommitteeImportResult = {
  candidate_id: string
  ok: boolean
  lead_id: string | null
  decision_maker_id: string | null
  message: string
}
