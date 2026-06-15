/** SR-3 Phase 3 — wait registry types (client-safe). */

import type { SequenceConditionEvent } from "@/lib/growth/sequences/conditions/sequence-condition-types"

export const GROWTH_SEQUENCE_WAIT_REGISTRY_QA_MARKER =
  "growth-sequence-wait-registry-sr3-phase3-v1" as const

export const SEQUENCE_WAIT_RESOLUTION_REASONS = [
  "matched",
  "timeout",
  "cancelled",
  "operator_override",
] as const

export type SequenceWaitResolutionReason = (typeof SEQUENCE_WAIT_RESOLUTION_REASONS)[number]

const INSTANT_CONDITION_PREFIXES = ["lead.", "engagement."] as const

export function isWaitUntilEventConditionEvent(event: SequenceConditionEvent): boolean {
  return !INSTANT_CONDITION_PREFIXES.some((prefix) => event.startsWith(prefix))
}

export function mapWaitResolutionToBranchDecision(
  reason: SequenceWaitResolutionReason,
): "true" | "false" | "timeout" | "skipped" {
  switch (reason) {
    case "matched":
      return "true"
    case "timeout":
      return "timeout"
    case "cancelled":
      return "skipped"
    case "operator_override":
      return "true"
    default:
      return "skipped"
  }
}
