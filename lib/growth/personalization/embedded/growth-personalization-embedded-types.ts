/** GS-AI-PLAYBOOK-5A — Embedded personalization types (client-safe). */

import type { GrowthPersonalizationGenerationStatus } from "@/lib/growth/personalization/personalization-types"

export const GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER =
  "growth-personalization-embedded-gs-ai-playbook-5a-v1" as const

export type GrowthPersonalizationEmbeddedSurface =
  | "lead"
  | "inbox"
  | "call"
  | "opportunity"
  | "meeting"
  | "conversation"
  | "sendr"
  | "share"

export type GrowthPersonalizationLeadSummary = {
  qaMarker: typeof GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER
  leadId: string
  generationId: string | null
  status: GrowthPersonalizationGenerationStatus | null
  subject: string | null
  bodyPreview: string | null
  personalizationScore: number | null
  qualityScore: number | null
  industryLabel: string | null
  buyingStageLabel: string | null
  recommendedCta: string | null
  nextNarrativeLabel: string | null
  recommendedProofLabel: string | null
  sequenceLabel: string | null
  reasoningObjective: string | null
  nextBestAction: string | null
  topInsight: string | null
  createdAt: string | null
  hasDraft: boolean
  hasStackBDiagnostics: boolean
  legacyFallback: boolean
}

export type GrowthPersonalizationGenerationResponse = {
  ok: boolean
  generation?: import("@/lib/growth/personalization/personalization-types").GrowthPersonalizationGenerationView
  message?: string
}
