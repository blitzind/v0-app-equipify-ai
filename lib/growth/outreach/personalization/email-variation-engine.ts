/** Email variation engine — opening/CTA/subject style selection and duplicate measurement (Phase 11A). */

import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { detectOutreachIndustry } from "@/lib/growth/outreach/personalization/industry-detection"
import { pickVariantIndex } from "@/lib/growth/outreach/personalization/message-variability"
import type {
  OutreachContextPacket,
  PersonalizationSignalKey,
} from "@/lib/growth/outreach/personalization/personalization-types"

export const EMAIL_VARIATION_ENGINE_QA_MARKER = "email-variation-engine-v11a" as const

/** Opening style ids — must exist in OUTREACH_MESSAGE_BLOCK_LIBRARY.opening */
export const EMAIL_OPENING_STYLE_IDS = [
  "opening_direct",
  "opening_context",
  "opening_follow_up",
  "opening_pain_first",
  "opening_benchmark",
  "opening_operational_issue",
  "opening_staffing",
  "opening_compliance",
  "opening_workflow",
  "opening_peer_comparison",
  "opening_observation",
  "opening_trigger_event",
  "opening_industry_specific",
] as const

export type EmailOpeningStyleId = (typeof EMAIL_OPENING_STYLE_IDS)[number]

/** CTA style ids for action-oriented closes */
export const EMAIL_CTA_STYLE_IDS = [
  "cta_workflow_review",
  "cta_benchmark_review",
  "cta_ops_audit",
  "cta_ops_assessment",
  "cta_quick_call",
  "cta_process_review",
  "cta_operational_gap_review",
  "cta_service_review",
  "cta_diagnostic_offer",
  "cta_peer_comparison_review",
  "cta_workflow_diagnostic",
  "operations_review",
  "fifteen_minute",
] as const

export function normalizeContentFingerprint(text: string, maxWords = 8): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, maxWords)
    .join(" ")
}

export function measureDuplicateRate(fingerprints: string[]): {
  total: number
  unique: number
  duplicate_count: number
  duplicate_pct: number
} {
  const counts = new Map<string, number>()
  for (const fp of fingerprints) {
    const key = fp.trim()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = fingerprints.filter((f) => f.trim()).length
  const duplicate_count = [...counts.values()].reduce((sum, c) => sum + (c > 1 ? c - 1 : 0), 0)
  const unique = counts.size
  const duplicate_pct = total > 0 ? Math.round((duplicate_count / total) * 100) : 0
  return { total, unique, duplicate_count, duplicate_pct }
}

export function selectEmailOpeningStyleId(input: {
  variationSeed: string
  packet: OutreachContextPacket
  signals: PersonalizationSignalKey[]
  generationType: GrowthAiCopilotGenerationType
  fallbackOpeningId: string
}): EmailOpeningStyleId {
  const industry = detectOutreachIndustry(input.packet)
  const candidates: EmailOpeningStyleId[] = []

  if (
    input.generationType === "follow_up_email" ||
    input.generationType === "reengagement_email" ||
    input.generationType === "next_message"
  ) {
    candidates.push("opening_follow_up", "opening_observation", "opening_trigger_event")
  } else if (input.packet.researchPainPoints.length > 0) {
    candidates.push("opening_pain_first", "opening_workflow", "opening_operational_issue")
  }

  if (input.signals.includes("capacity_growth_signal")) {
    candidates.push("opening_benchmark", "opening_peer_comparison", "opening_staffing")
  }
  if (input.signals.includes("dispatch_appears_manual")) {
    candidates.push("opening_operational_issue", "opening_workflow", "opening_pain_first")
  }
  if (industry === "medical_equipment") {
    candidates.push("opening_compliance", "opening_industry_specific", "opening_operational_issue")
  }
  if (input.packet.hiringSignals.length > 0) {
    candidates.push("opening_staffing", "opening_benchmark")
  }
  if (input.packet.priorTouchCount > 0) {
    candidates.push("opening_observation", "opening_trigger_event")
  }

  candidates.push(
    "opening_context",
    "opening_direct",
    "opening_peer_comparison",
    "opening_observation",
    "opening_workflow",
    "opening_benchmark",
    "opening_trigger_event",
    "opening_pain_first",
  )

  const uniqueCandidates = [...new Set(candidates)]
  const fallback = EMAIL_OPENING_STYLE_IDS.includes(input.fallbackOpeningId as EmailOpeningStyleId)
    ? (input.fallbackOpeningId as EmailOpeningStyleId)
    : "opening_context"

  if (!uniqueCandidates.includes(fallback)) uniqueCandidates.push(fallback)

  const index = pickVariantIndex(`${input.variationSeed}:opening-style`, uniqueCandidates.length)
  return uniqueCandidates[index] ?? fallback
}

export function selectResearchAwareCtaStyleId(input: {
  variationSeed: string
  packet: OutreachContextPacket
  signals: PersonalizationSignalKey[]
  meetingReady: boolean
}): string {
  const pool: string[] = []

  if (input.meetingReady) {
    pool.push("fifteen_minute", "cta_quick_call", "operations_review", "cta_workflow_review")
  } else if (input.packet.researchPainPoints.length > 0 || input.packet.hasWebsiteResearch) {
    pool.push(
      "cta_workflow_review",
      "cta_process_review",
      "cta_diagnostic_offer",
      "cta_ops_assessment",
      "cta_operational_gap_review",
      "cta_service_review",
      "cta_benchmark_review",
      "cta_peer_comparison_review",
      "cta_workflow_diagnostic",
      "cta_ops_audit",
    )
  } else {
    pool.push("cta_workflow_review", "cta_process_review", "cta_diagnostic_offer", "question_workflow")
  }

  if (input.signals.includes("dispatch_appears_manual")) {
    pool.unshift("cta_operational_gap_review", "cta_process_review")
  }

  const unique = [...new Set(pool)]
  const index = pickVariantIndex(`${input.variationSeed}:cta-style`, unique.length)
  return unique[index] ?? "cta_workflow_review"
}
