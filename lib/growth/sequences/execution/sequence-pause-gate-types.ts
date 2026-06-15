/** SR-3 Phase 0 — sequence execution pause gate (client-safe). */

import type { GrowthSequenceEnrollmentStatus } from "@/lib/growth/sequence-enrollment-types"
import type {
  SequenceExecutionPauseGateCode,
  SequenceExecutionPauseGateResult,
} from "@/lib/growth/sequences/attribution/sequence-attribution-types"

function blocked(
  code: SequenceExecutionPauseGateCode,
  reason: string,
): SequenceExecutionPauseGateResult {
  return { allowed: false, blocked: true, code, reason }
}

/** Pure enrollment-status gate — unit-testable without DB. */
export function evaluateEnrollmentStatusForExecutionGate(
  status: GrowthSequenceEnrollmentStatus | string | null | undefined,
): SequenceExecutionPauseGateResult | null {
  if (status === "paused") {
    return blocked("enrollment_paused", "Sequence enrollment is paused — transport execution blocked.")
  }
  if (status === "completed") {
    return blocked("enrollment_completed", "Sequence enrollment is completed — transport execution blocked.")
  }
  if (status === "cancelled") {
    return blocked("enrollment_cancelled", "Sequence enrollment is cancelled — transport execution blocked.")
  }
  if (status !== "active") {
    return blocked(
      "enrollment_not_active",
      `Sequence enrollment status "${status ?? "unknown"}" is not active — transport execution blocked.`,
    )
  }
  return null
}
