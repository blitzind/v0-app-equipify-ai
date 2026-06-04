/** Read-only bridge from Lead Engine outreach personalization guidance to outreach generation. */

import type { GrowthLeadEnginePipelineRun } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import type { GrowthLeadEngineOutreachEvidenceBackedItem } from "@/lib/growth/lead-engine/outreach-personalization-types"
import type { GrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-types"
import { GROWTH_LEAD_ENGINE_RUN_METADATA_KEY } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { extractLeadEngineOutputsFromRun } from "@/lib/growth/lead-operator-workspace/lead-engine-run-extract"
import type { OutreachLeadEngineGuidance } from "@/lib/growth/outreach/personalization/personalization-types"

const MIN_EVIDENCE_CONFIDENCE = 0.45
const MAX_CLAIM_LENGTH = 120

function truncate(value: string, max = MAX_CLAIM_LENGTH): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function extractEvidenceClaims(items: GrowthLeadEngineOutreachEvidenceBackedItem[] | undefined): string[] {
  if (!items?.length) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const claim = item.claim?.trim() ?? ""
    if (!claim || item.confidence < MIN_EVIDENCE_CONFIDENCE) continue
    const key = claim.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(truncate(claim))
  }
  return result
}

export function isLeadEnginePipelineRun(value: unknown): value is GrowthLeadEnginePipelineRun {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return Array.isArray(row.stage_results) && typeof row.run_id === "string"
}

export function parseLeadEngineRunFromLeadMetadata(
  metadata: Record<string, unknown> | undefined,
): GrowthLeadEnginePipelineRun | null {
  const raw = metadata?.[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  return isLeadEnginePipelineRun(raw) ? raw : null
}

export function bridgeLeadEngineOutreachGuidance(
  output: GrowthLeadEngineOutreachPersonalizationOutput | undefined | null,
): OutreachLeadEngineGuidance | null {
  if (!output?.personalization_summary?.trim()) return null

  const prioritizedPainPoints = extractEvidenceClaims(output.recommended_problem_alignment)
  const talkingPoints = extractEvidenceClaims(output.recommended_talking_points)
  const prioritizedOutreachAngles = [...new Set([...talkingPoints, ...prioritizedPainPoints])]
  const buyingSignalGuidance = [
    ...extractEvidenceClaims(output.urgency_signals),
    ...extractEvidenceClaims(output.timing_signals),
  ]

  const communicationGuidance = talkingPoints.filter(
    (entry) => !prioritizedPainPoints.some((pain) => pain.toLowerCase() === entry.toLowerCase()),
  )

  return {
    personalizationSummary: truncate(output.personalization_summary, 200),
    companyContext: output.company_context?.trim() ? truncate(output.company_context, 160) : null,
    contactContext: output.contact_context?.trim() ? truncate(output.contact_context, 160) : null,
    prioritizedPainPoints,
    prioritizedOutreachAngles,
    communicationGuidance,
    buyingSignalGuidance,
    recommendedCtaStrategy: output.recommended_cta_strategy?.trim() || null,
    recommendedChannelPriority: (output.recommended_channel_priority ?? []).map(String),
    recommendedSequencePriority: output.recommended_sequence_priority ?? null,
    confidence: output.personalization_confidence ?? null,
    completeness: output.personalization_completeness ?? null,
  }
}

export function resolveLeadEngineGuidanceFromLeadMetadata(
  metadata: Record<string, unknown> | undefined,
): OutreachLeadEngineGuidance | null {
  const run = parseLeadEngineRunFromLeadMetadata(metadata)
  if (!run) return null
  const outputs = extractLeadEngineOutputsFromRun(run)
  return bridgeLeadEngineOutreachGuidance(outputs.outreachPersonalization)
}
