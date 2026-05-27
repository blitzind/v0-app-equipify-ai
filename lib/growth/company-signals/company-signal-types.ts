/** Growth Engine — Company Signal Intelligence (Prompt 30). Client-safe. */

import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

export const GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER =
  "growth-company-signal-intelligence-v1" as const

export const GROWTH_COMPANY_SIGNAL_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
] as const

export type GrowthCompanySignalRunStatus = (typeof GROWTH_COMPANY_SIGNAL_RUN_STATUSES)[number]

export const GROWTH_COMPANY_SIGNAL_CATEGORIES = [
  "technology",
  "operations",
  "growth",
  "service_model",
  "finance",
  "staffing",
  "digital_presence",
  "field_service",
] as const

export type GrowthCompanySignalCategory = (typeof GROWTH_COMPANY_SIGNAL_CATEGORIES)[number]

export const GROWTH_COMPANY_SIGNAL_EVIDENCE_TIERS = ["observed", "inferred"] as const

export type GrowthCompanySignalEvidenceTier = (typeof GROWTH_COMPANY_SIGNAL_EVIDENCE_TIERS)[number]

export type GrowthCompanySignalAttribution = {
  source: string
  detector: string
  tier: GrowthCompanySignalEvidenceTier
  signal: string
  evidence: string
  confidence: number
}

export type GrowthCompanySignalEvidence = {
  claim: string
  evidence: string
  source: string
  tier: GrowthCompanySignalEvidenceTier
}

/** Operator-visible signal row — no server-only payloads. */
export type GrowthCompanySignal = {
  id: string
  created_at: string
  updated_at: string
  company_candidate_id: string
  run_id: string
  signal_category: GrowthCompanySignalCategory
  signal_type: string
  signal_value: string
  confidence: number
  evidence: GrowthCompanySignalEvidence[]
  source_attribution: GrowthCompanySignalAttribution[]
  observed_at: string
  metadata: Record<string, unknown>
}

export type GrowthCompanySignalRun = {
  id: string
  created_at: string
  updated_at: string
  company_candidate_id: string
  status: GrowthCompanySignalRunStatus
  signal_count: number
  error_message: string | null
  metadata: Record<string, unknown>
}

export type GrowthCompanySignalUiSummary = {
  technology_signals: string[]
  growth_indicators: string[]
  operational_maturity: string
  digital_maturity: string
  field_service_maturity: string
  fit_indicators: string[]
}

import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

export type GrowthCompanySignalSnapshot = {
  qa_marker: typeof GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER
  schema_ready: boolean
  schema_health?: GrowthSchemaHealthSummary | null
  company_candidate_id: string
  run: GrowthCompanySignalRun | null
  signals: GrowthCompanySignal[]
  ui_summary: GrowthCompanySignalUiSummary
  privacy_note: string
}

export const GROWTH_COMPANY_SIGNAL_PRIVACY_NOTE =
  "Company signals are evidence-backed only — derived from observed company discovery and enrichment fields. No scraping, no fabricated technology claims, and no autonomous outreach."
