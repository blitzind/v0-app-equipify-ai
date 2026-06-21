/** GS-AI-PLAYBOOK-4C — Sequence fatigue detection (client-safe). */

import type {
  GrowthSequenceFatigueAssessment,
  GrowthSequenceFatigueLevel,
  GrowthSequenceSignalInput,
} from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"
import { buildGrowthSequenceNarrativeProgression } from "@/lib/growth/sequence-intelligence/growth-narrative-progression"
import { buildSequenceHistoryHaystack } from "@/lib/growth/sequence-intelligence/growth-sequence-history-builder"

export function buildGrowthSequenceFatigue(input: GrowthSequenceSignalInput): GrowthSequenceFatigueAssessment {
  const reasons: string[] = []
  const recommendations: string[] = []
  const touchCount = input.priorTouchCount ?? 0
  const replies = input.priorReplySummaries?.length ?? 0
  const daysSinceLastTouch = input.daysSinceLastTouch
  const haystack = buildSequenceHistoryHaystack(input)
  const narrative = buildGrowthSequenceNarrativeProgression(input)

  if (touchCount >= 5 && replies === 0) {
    reasons.push("Too many touches without reply")
    recommendations.push("Shift to re-engagement angle or pause sequence")
  }
  if (touchCount >= 4) {
    reasons.push("Late in sequence")
    recommendations.push("Use lighter ask and fresh proof")
  }
  if (daysSinceLastTouch != null && daysSinceLastTouch > 30) {
    reasons.push("Long inactivity since last touch")
    recommendations.push("Acknowledge time gap and restate value briefly")
  }
  if (/\bdemo\b|\bbook a call\b|\bschedule\b/i.test(haystack) && touchCount >= 2) {
    reasons.push("Too many meeting asks")
    recommendations.push("Avoid another demo/meeting CTA")
  }
  if (/\bpricing\b|\bcost\b|\bquote\b/i.test(haystack)) {
    reasons.push("Pricing discussion already surfaced")
    recommendations.push("Avoid pricing ask")
  }
  if (narrative.overusedThemes.length > 0) {
    reasons.push(`Theme repetition: ${narrative.overusedThemes.join(", ").replace(/_/g, " ")}`)
    recommendations.push("Rotate narrative theme")
  }
  if ((input.memoryAvoidRepeating?.length ?? 0) > 0) {
    reasons.push("Operator/memory flagged topics to avoid repeating")
    recommendations.push("Respect avoid-repeating memory topics")
  }
  if (/\bpm\b|\bpreventive maintenance\b|\bworkflow\b/i.test(haystack) && narrative.overusedThemes.includes("workflow_pain")) {
    reasons.push("Repeat PM/workflow pain")
    recommendations.push("Avoid repeating PM pain framing")
  }

  let fatigueLevel: GrowthSequenceFatigueLevel = "none"
  if (reasons.length >= 4) fatigueLevel = "high"
  else if (reasons.length >= 2) fatigueLevel = "medium"
  else if (reasons.length >= 1) fatigueLevel = "low"

  if (recommendations.length === 0 && touchCount >= 2) {
    recommendations.push("Keep messaging concise and vary proof angle")
  }

  return { fatigueLevel, reasons, recommendations }
}

export function fatigueLevelLabel(level: GrowthSequenceFatigueLevel): string {
  if (level === "none") return "None"
  return level.charAt(0).toUpperCase() + level.slice(1)
}
