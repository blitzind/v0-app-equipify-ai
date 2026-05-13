import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

/** Deterministic, explainable insight card (no LLM). */
export type DeterministicIndustryInsight = {
  id: string
  title: string
  detail: string
  severity: "low" | "medium" | "high"
  /** Human-readable evidence lines (counts / methodology only). */
  evidence: string[]
}

/** Industry-tailored summaries + cards returned alongside AIden operational recommendations. */
export type IndustryOperationalBrief = {
  industryKey: WorkspaceIndustryKey
  profileId: string
  dashboardSummaryLines: string[]
  maintenanceSummaryLines: string[]
  deterministicInsights: DeterministicIndustryInsight[]
  /** Prompt-only priors — not displayed as standalone facts. */
  recommendationPriors: string[]
  maintenancePriors: string[]
}
