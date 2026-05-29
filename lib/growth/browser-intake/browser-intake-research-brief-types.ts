/** Browser extension research brief artifact — client-safe. */

export const GROWTH_BROWSER_INTAKE_RESEARCH_BRIEF_QA_MARKER =
  "growth-browser-intake-research-brief-v1" as const

export type GrowthBrowserIntakeResearchBriefArtifact = {
  lead_id: string
  company_name: string
  company_summary: string
  why_this_account: string
  fit_summary: string
  pain_points: string[]
  growth_signals: string[]
  buying_signals: string[]
  technology_summary: string
  risk_summary: string
  recommended_angle: string
  recommended_next_step: string
  research_confidence: number | null
  generated_at: string
  sources_used: string[]
}
