/** Client-safe Growth Engine research types (no server-only imports). */

export const GROWTH_LEAD_RESEARCH_RUN_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "partial",
] as const

export type GrowthLeadResearchRunStatus = (typeof GROWTH_LEAD_RESEARCH_RUN_STATUSES)[number]

export type GrowthLeadResearchResult = {
  companySummary: string
  websiteSummary: string | null
  likelyServiceCategory: string | null
  serviceAreaClues: string[]
  companySizeEstimate: string | null
  equipmentServiceIndicators: string[]
  equipifyPainPoints: string[]
  equipifyFitScore: number
  outreachAngles: string[]
  recommendedNextAction: string
  researchConfidence: number
  sourceUrls: string[]
  caveats: string[]
  fitModelVersion: string
}

export type GrowthLeadResearchRun = {
  id: string
  leadId: string
  status: GrowthLeadResearchRunStatus
  triggerKind: "manual" | "regenerate"
  websiteFetchStatus: string
  sourceUrls: string[]
  result: GrowthLeadResearchResult | null
  researchConfidence: number | null
  equipifyFitScore: number | null
  modelTask: string | null
  modelProvider: string | null
  modelName: string | null
  errorCode: string | null
  errorMessage: string | null
  durationMs: number | null
  inputHash: string | null
  createdBy: string | null
  createdAt: string
  finishedAt: string | null
}

export type GrowthLeadResearchNotes = {
  body: string
  updatedBy: string | null
  updatedAt: string
}

export type GrowthLeadResearchBundle = {
  leadId: string
  latestRun: GrowthLeadResearchRun | null
  runs: GrowthLeadResearchRun[]
  manualNotes: GrowthLeadResearchNotes | null
}
