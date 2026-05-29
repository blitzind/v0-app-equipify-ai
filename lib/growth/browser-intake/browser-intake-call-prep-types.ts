/** Browser extension call prep artifact — client-safe. */

export const GROWTH_BROWSER_INTAKE_CALL_PREP_QA_MARKER =
  "growth-browser-intake-call-prep-v1" as const

export type GrowthBrowserIntakeCallPrepArtifact = {
  lead_id: string
  company_name: string
  contact_name: string | null
  who_they_are: string
  company_overview: string
  suggested_opener: string
  discovery_questions: string[]
  likely_objections: string[]
  relevant_signals: string[]
  recommended_next_step: string
  generated_at: string
  sources_used: string[]
  data_completeness: "full" | "partial" | "minimal"
}
