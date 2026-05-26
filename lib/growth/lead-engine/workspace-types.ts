/** Lead Engine workspace — sandbox types (UI shell). Client-safe. */

export const GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER = "lead-engine-workspace-v1" as const

export const GROWTH_LEAD_ENGINE_PIPELINE_STAGE_IDS = [
  "icp_targeting",
  "company_discovery",
  "decision_maker_hypothesis",
  "contact_research",
  "verification_triage",
  "account_brief",
  "outreach_personalization",
  "lead_score",
  "human_approval",
  "revenue_execution",
] as const

export type GrowthLeadEnginePipelineStageId =
  (typeof GROWTH_LEAD_ENGINE_PIPELINE_STAGE_IDS)[number]

export type GrowthLeadEngineSandboxInput = {
  companyName: string
  domain: string
  industry: string
  location: string
  notes: string
}

export type GrowthLeadEnginePipelineStageStatus = "pending" | "ok" | "error"

export type GrowthLeadEnginePipelineStageResult = {
  stageId: GrowthLeadEnginePipelineStageId
  label: string
  qaMarker: string
  status: GrowthLeadEnginePipelineStageStatus
  rawJson: string
  parsed: unknown | null
  parseOk: boolean
  parseMessage: string | null
  confidence: number | null
  evidenceSummary: string | null
  humanReviewRequired: boolean | null
}

export type GrowthLeadEngineSandboxPipelineResult = {
  qaMarker: typeof GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER
  mode: "fixture_dry_run"
  input: GrowthLeadEngineSandboxInput
  stages: GrowthLeadEnginePipelineStageResult[]
  completedCount: number
  errorCount: number
}
