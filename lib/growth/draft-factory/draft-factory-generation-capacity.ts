/**
 * GE-AIOS-AUTONOMY-1F — Generation capacity candidate collection (client-safe).
 *
 * Intentional separation (preserved):
 *   due advances  → non-generative stages only (allowGeneration: false)
 *   capacity wake → scarce llm_drafting / Growth 5F package generation
 *
 * waiting_for_generation must enter the capacity candidate pool even when it is
 * not portfolio_deferred — otherwise capacity_selected stays 0 forever.
 */

import type { AiOsDraftFactoryDurableLeadState } from "@/lib/growth/draft-factory/draft-factory-durable-types"

export const GROWTH_AIOS_AUTONOMY_1F_QA_MARKER =
  "ge-aios-autonomy-1f-draft-generation-capacity-path-v1" as const

export type GenerationCapacityCandidateSource = "portfolio_deferred" | "waiting_for_generation"

export type GenerationCapacityCandidate = {
  leadId: string
  state: string
  updatedAt: string
  source: GenerationCapacityCandidateSource
}

/**
 * Union portfolio-deferred rows with due waiting_for_generation leads.
 * Deterministic: deferred first (updated_at ASC), then generation-ready (updated_at ASC).
 * Dedupes by leadId (generation-ready wins when both present).
 */
export function collectGenerationCapacityCandidates(input: {
  deferredStates: Array<{
    leadId: string
    state: string
    updatedAt: string
  }>
  dueStates: Array<{
    leadId: string
    state: string
    updatedAt: string
  }>
  limit: number
}): {
  qa_marker: typeof GROWTH_AIOS_AUTONOMY_1F_QA_MARKER
  candidates: GenerationCapacityCandidate[]
  deferredCount: number
  waitingForGenerationCount: number
} {
  const limit = Math.max(0, Math.floor(input.limit))
  const deferredSorted = [...input.deferredStates].sort((a, b) => {
    const byUpdated = a.updatedAt.localeCompare(b.updatedAt)
    if (byUpdated !== 0) return byUpdated
    return a.leadId.localeCompare(b.leadId)
  })
  const generationReady = input.dueStates
    .filter((row) => row.state === "waiting_for_generation")
    .sort((a, b) => {
      const byUpdated = a.updatedAt.localeCompare(b.updatedAt)
      if (byUpdated !== 0) return byUpdated
      return a.leadId.localeCompare(b.leadId)
    })

  const byLead = new Map<string, GenerationCapacityCandidate>()
  for (const row of deferredSorted) {
    byLead.set(row.leadId, {
      leadId: row.leadId,
      state: row.state,
      updatedAt: row.updatedAt,
      source: "portfolio_deferred",
    })
  }
  for (const row of generationReady) {
    byLead.set(row.leadId, {
      leadId: row.leadId,
      state: row.state,
      updatedAt: row.updatedAt,
      source: "waiting_for_generation",
    })
  }

  const candidates = [...byLead.values()]
    .sort((a, b) => {
      const bySource =
        (a.source === "waiting_for_generation" ? 0 : 1) - (b.source === "waiting_for_generation" ? 0 : 1)
      if (bySource !== 0) return bySource
      const byUpdated = a.updatedAt.localeCompare(b.updatedAt)
      if (byUpdated !== 0) return byUpdated
      return a.leadId.localeCompare(b.leadId)
    })
    .slice(0, limit)

  return {
    qa_marker: GROWTH_AIOS_AUTONOMY_1F_QA_MARKER,
    candidates,
    deferredCount: deferredSorted.length,
    waitingForGenerationCount: generationReady.length,
  }
}

export function isWaitingForGenerationDurableState(
  state: AiOsDraftFactoryDurableLeadState | string | null | undefined,
): boolean {
  return state === "waiting_for_generation"
}
