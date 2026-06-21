/** GS-AI-PLAYBOOK-5A — Shared embedded personalization client runtime (client-safe). */

import type {
  GrowthPersonalizationGenerationResponse,
  GrowthPersonalizationLeadSummary,
} from "@/lib/growth/personalization/embedded/growth-personalization-embedded-types"
import type { GrowthPersonalizationRegenerationFeedbackCategory } from "@/lib/growth/personalization/personalization-types"
import { GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE } from "@/lib/growth/personalization/personalization-types"

export async function fetchPersonalizationSummary(leadId: string): Promise<GrowthPersonalizationLeadSummary> {
  const response = await fetch(
    `/api/platform/growth/personalization/summary?leadId=${encodeURIComponent(leadId)}`,
    { cache: "no-store" },
  )
  const payload = (await response.json()) as {
    ok?: boolean
    summary?: GrowthPersonalizationLeadSummary
    message?: string
  }
  if (!response.ok || !payload.ok || !payload.summary) {
    throw new Error(payload.message ?? "Could not load personalization summary.")
  }
  return payload.summary
}

export async function fetchLatestLeadPersonalization(leadId: string) {
  const listResponse = await fetch(
    `/api/platform/growth/personalization/generations?leadId=${encodeURIComponent(leadId)}&limit=1`,
    { cache: "no-store" },
  )
  const listPayload = (await listResponse.json()) as {
    ok?: boolean
    generations?: Array<{ id: string }>
    message?: string
  }
  if (!listResponse.ok || !listPayload.ok) {
    throw new Error(listPayload.message ?? "Could not list personalization generations.")
  }
  const generationId = listPayload.generations?.[0]?.id
  if (!generationId) return null

  const detailResponse = await fetch(`/api/platform/growth/personalization/generations/${generationId}`, {
    cache: "no-store",
  })
  const detailPayload = (await detailResponse.json()) as GrowthPersonalizationGenerationResponse & {
    privacy_note?: string
  }
  if (!detailResponse.ok || !detailPayload.ok || !detailPayload.generation) {
    throw new Error(detailPayload.message ?? "Could not load personalization generation.")
  }
  return detailPayload.generation
}

export async function generatePersonalizationForLead(input: {
  leadId: string
  priorGenerationId?: string | null
  regenerationFeedback?: {
    category: GrowthPersonalizationRegenerationFeedbackCategory
    customNotes?: string | null
  } | null
}): Promise<GrowthPersonalizationGenerationResponse["generation"]> {
  const response = await fetch("/api/platform/growth/personalization/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: input.leadId,
      priorGenerationId: input.priorGenerationId ?? null,
      regenerationFeedback: input.regenerationFeedback ?? null,
    }),
  })
  const payload = (await response.json()) as GrowthPersonalizationGenerationResponse & {
    privacy_note?: string
  }
  if (!response.ok || !payload.ok || !payload.generation) {
    throw new Error(payload.message ?? "Personalization generation failed.")
  }
  return payload.generation
}

export async function regeneratePersonalizationForGeneration(input: {
  leadId: string
  generationId: string
  regenerationFeedback?: {
    category: GrowthPersonalizationRegenerationFeedbackCategory
    customNotes?: string | null
  } | null
}) {
  return generatePersonalizationForLead({
    leadId: input.leadId,
    priorGenerationId: input.generationId,
    regenerationFeedback: input.regenerationFeedback ?? null,
  })
}

export async function approvePersonalizationGeneration(generationId: string) {
  const response = await fetch(`/api/platform/growth/personalization/generations/${generationId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ humanApprovalConfirmed: true }),
  })
  const payload = (await response.json()) as GrowthPersonalizationGenerationResponse
  if (!response.ok || !payload.ok || !payload.generation) {
    throw new Error(payload.message ?? "Approval failed.")
  }
  return payload.generation
}

export { GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE }
