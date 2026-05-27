/** Deterministic sequence enrollment state machine. Client-safe. */

import type { GrowthSequenceEnrollmentStatus } from "@/lib/growth/sequences/sequence-types"

const ALLOWED_TRANSITIONS: Record<GrowthSequenceEnrollmentStatus, GrowthSequenceEnrollmentStatus[]> = {
  draft: ["active", "cancelled"],
  active: ["paused", "completed", "failed", "cancelled"],
  paused: ["active", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
}

export function canTransitionSequenceEnrollment(
  from: GrowthSequenceEnrollmentStatus,
  to: GrowthSequenceEnrollmentStatus,
): boolean {
  if (from === to) return true
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertSequenceEnrollmentTransition(
  from: GrowthSequenceEnrollmentStatus,
  to: GrowthSequenceEnrollmentStatus,
): void {
  if (!canTransitionSequenceEnrollment(from, to)) {
    throw new Error("invalid_sequence_enrollment_transition")
  }
}

export function isTerminalSequenceEnrollmentStatus(status: GrowthSequenceEnrollmentStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled"
}

export function sequenceEnrollmentStatusLabel(status: GrowthSequenceEnrollmentStatus): string {
  switch (status) {
    case "draft":
      return "Draft"
    case "active":
      return "Active"
    case "paused":
      return "Paused"
    case "completed":
      return "Completed"
    case "failed":
      return "Failed"
    case "cancelled":
      return "Cancelled"
  }
}
