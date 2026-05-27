/** Prospect Search qualification overlays — Lead Engine score + buying stage (Sprint 3). */

import type { GrowthLeadEnginePipelineRun } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import type { GrowthLeadEngineLeadScoreOutput } from "@/lib/growth/lead-engine/lead-score-types"
import { extractLeadEngineOutputsFromRun } from "@/lib/growth/lead-operator-workspace/lead-engine-run-extract"
import { GROWTH_LEAD_ENGINE_RUN_METADATA_KEY } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"

export const GROWTH_PROSPECT_SEARCH_QUALIFICATION_QA_MARKER =
  "growth-prospect-search-qualification-v1" as const

export type ProspectSearchBuyingStageOverlay = {
  buying_stage: string | null
  buying_stage_confidence: number | null
  buying_stage_reason: string | null
  buying_stage_last_assessed_at: string | null
}

export type ProspectSearchLeadEngineScoreOverlay = {
  lead_engine_score: number | null
  lead_engine_score_label: string | null
  lead_engine_score_explanation: string | null
  lead_engine_last_run_at: string | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function isPipelineRun(value: unknown): value is GrowthLeadEnginePipelineRun {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return Array.isArray(row.stage_results) && typeof row.run_id === "string"
}

function leadScoreLabel(score: GrowthLeadEngineLeadScoreOutput): string | null {
  if (score.lead_grade) return `Grade ${score.lead_grade}`
  if (score.priority_level) return score.priority_level.replace(/_/g, " ")
  return null
}

export function extractLeadEngineScoreOverlay(
  metadata: Record<string, unknown>,
): ProspectSearchLeadEngineScoreOverlay | null {
  const runRaw = metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  if (!isPipelineRun(runRaw)) return null

  const leadScore = extractLeadEngineOutputsFromRun(runRaw).leadScore
  if (!leadScore || typeof leadScore.lead_score !== "number") return null

  const completedStage = runRaw.stage_results.find((stage) => stage.stage_id === "lead_score")
  const lastRunAt =
    asString((metadata.lead_engine_completed_at as string | undefined) ?? "") ||
    (completedStage?.duration_ms != null ? runRaw.run_id : null)

  return {
    lead_engine_score: leadScore.lead_score,
    lead_engine_score_label: leadScoreLabel(leadScore) || null,
    lead_engine_score_explanation: asString(leadScore.score_explanation) || null,
    lead_engine_last_run_at: typeof lastRunAt === "string" && lastRunAt.includes("-") ? lastRunAt : null,
  }
}

export function extractBuyingStageFromMetadata(
  metadata: Record<string, unknown>,
): ProspectSearchBuyingStageOverlay | null {
  const summary = metaRecord(metadata.buying_stage_summary)
  const detected_stage = asString(summary.detected_stage)
  if (!detected_stage) return null

  const reasoning = Array.isArray(summary.stage_reasoning)
    ? summary.stage_reasoning.filter((item): item is string => typeof item === "string")
    : []

  return {
    buying_stage: detected_stage,
    buying_stage_confidence:
      typeof summary.stage_confidence === "number" ? summary.stage_confidence : null,
    buying_stage_reason: reasoning[0] ?? (asString(summary.evidence) || null),
    buying_stage_last_assessed_at: asString(summary.assessed_at) || null,
  }
}

export function mergeBuyingStageOverlay(
  fromTable: ProspectSearchBuyingStageOverlay | null,
  fromMetadata: ProspectSearchBuyingStageOverlay | null,
): ProspectSearchBuyingStageOverlay | null {
  if (!fromTable && !fromMetadata) return null
  if (!fromTable) return fromMetadata
  if (!fromMetadata) return fromTable

  const tableConfidence = fromTable.buying_stage_confidence ?? 0
  const metaConfidence = fromMetadata.buying_stage_confidence ?? 0
  return tableConfidence >= metaConfidence ? fromTable : fromMetadata
}

export function buyingStageOverlayFromAssessmentRow(
  row: Record<string, unknown>,
): ProspectSearchBuyingStageOverlay {
  const reasoning = Array.isArray(row.stage_reasoning)
    ? row.stage_reasoning.filter((item): item is string => typeof item === "string")
    : []

  return {
    buying_stage: asString(row.detected_stage) || null,
    buying_stage_confidence:
      typeof row.stage_confidence === "number" ? row.stage_confidence : null,
    buying_stage_reason: reasoning[0] ?? (asString(row.evidence) || null),
    buying_stage_last_assessed_at: asString(row.updated_at) || asString(row.created_at) || null,
  }
}

export function resolveProspectSearchQualificationFields(
  row: {
    lead_score: number | null
    buying_stage: string | null
  },
  context: {
    metadata?: Record<string, unknown>
    buyingOverlay?: ProspectSearchBuyingStageOverlay | null
  },
): {
  lead_score: number | null
  lead_engine_score: number | null
  lead_engine_score_label: string | null
  lead_engine_score_explanation: string | null
  lead_engine_last_run_at: string | null
  buying_stage: string | null
  buying_stage_confidence: number | null
  buying_stage_reason: string | null
  buying_stage_last_assessed_at: string | null
} {
  const metadata = context.metadata ?? {}
  const leadEngine = extractLeadEngineScoreOverlay(metadata)
  const buyingStage = mergeBuyingStageOverlay(
    context.buyingOverlay ?? null,
    extractBuyingStageFromMetadata(metadata),
  )

  const lead_engine_score = leadEngine?.lead_engine_score ?? null

  return {
    lead_score: lead_engine_score ?? row.lead_score,
    lead_engine_score,
    lead_engine_score_label: leadEngine?.lead_engine_score_label ?? null,
    lead_engine_score_explanation: leadEngine?.lead_engine_score_explanation ?? null,
    lead_engine_last_run_at: leadEngine?.lead_engine_last_run_at ?? null,
    buying_stage: buyingStage?.buying_stage ?? row.buying_stage,
    buying_stage_confidence: buyingStage?.buying_stage_confidence ?? null,
    buying_stage_reason: buyingStage?.buying_stage_reason ?? null,
    buying_stage_last_assessed_at: buyingStage?.buying_stage_last_assessed_at ?? null,
  }
}

export function applyProspectSearchQualificationToIndexRow<
  T extends {
    lead_score: number | null
    buying_stage: string | null
  },
>(
  row: T,
  context: {
    metadata?: Record<string, unknown>
    buyingOverlay?: ProspectSearchBuyingStageOverlay | null
  },
): T & ReturnType<typeof resolveProspectSearchQualificationFields> {
  return {
    ...row,
    ...resolveProspectSearchQualificationFields(row, context),
  }
}
