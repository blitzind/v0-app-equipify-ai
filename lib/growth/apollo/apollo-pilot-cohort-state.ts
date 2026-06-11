/** Apollo pilot cohort status transitions — client-safe, no side effects. */

import {
  APOLLO_PILOT_COHORT_ACTIONS,
  APOLLO_PILOT_COHORT_SIZES,
  type ApolloPilotCohortAction,
  type ApolloPilotCohortSize,
  type ApolloPilotCohortStatus,
} from "@/lib/growth/apollo/apollo-pilot-types"

export function isApolloPilotCohortSize(value: number): value is ApolloPilotCohortSize {
  return (APOLLO_PILOT_COHORT_SIZES as readonly number[]).includes(value)
}

export function isApolloPilotCohortAction(value: string): value is ApolloPilotCohortAction {
  return (APOLLO_PILOT_COHORT_ACTIONS as readonly string[]).includes(value)
}

export function isApolloPilotCohortProcessingAllowed(status: ApolloPilotCohortStatus): boolean {
  return status === "active"
}

export function resolveApolloPilotCohortStatusAfterAction(
  current: ApolloPilotCohortStatus,
  action: ApolloPilotCohortAction,
): ApolloPilotCohortStatus | null {
  switch (action) {
    case "activate":
      if (current === "draft" || current === "paused") return "active"
      return null
    case "pause":
      if (current === "active") return "paused"
      return null
    case "resume":
      if (current === "paused") return "active"
      return null
    case "complete":
      if (current === "active" || current === "paused") return "completed"
      return null
    case "cancel":
      if (current === "draft" || current === "active" || current === "paused") return "cancelled"
      return null
    default:
      return null
  }
}

export function assertApolloPilotCohortCompanyUnique(
  existingCompanyIds: string[],
  newCompanyId: string,
): { ok: true } | { ok: false; reason: string } {
  const normalized = newCompanyId.trim()
  if (!normalized) return { ok: false, reason: "company_candidate_id is required." }
  if (existingCompanyIds.includes(normalized)) {
    return { ok: false, reason: "Company already exists in this cohort." }
  }
  return { ok: true }
}

export function buildApolloPilotCohortTimestamps(
  current: ApolloPilotCohortStatus,
  next: ApolloPilotCohortStatus,
  now: string,
): {
  started_at?: string | null
  paused_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
} {
  const patch: {
    started_at?: string | null
    paused_at?: string | null
    completed_at?: string | null
    cancelled_at?: string | null
  } = {}

  if (next === "active" && current !== "active") {
    if (!current || current === "draft" || current === "paused") {
      patch.started_at = now
    }
    if (current === "paused") patch.paused_at = null
  }
  if (next === "paused") patch.paused_at = now
  if (next === "completed") patch.completed_at = now
  if (next === "cancelled") patch.cancelled_at = now

  return patch
}
