/** Operator review actions for contact identity resolution. Client-safe. */

import { appendProspectSearchContactIdentityTimelineEvent } from "@/lib/growth/prospect-search/prospect-search-contact-identity-timeline"
import type {
  ProspectSearchContactIdentityOperatorAction,
  ProspectSearchContactIdentityOperatorReview,
  ProspectSearchContactIdentityResolution,
  ProspectSearchContactConflictStatus,
} from "@/lib/growth/prospect-search/prospect-search-contact-identity-types"

function actionConfidenceAdjustment(action: ProspectSearchContactIdentityOperatorAction): number {
  switch (action) {
    case "mark_contact_confirmed":
    case "confirm_same_person":
      return 0.15
    case "mark_channel_role_shared":
      return -0.05
    case "mark_title_outdated":
      return -0.03
    case "mark_contact_invalid":
      return -0.35
    case "keep_separate":
      return -0.1
    default:
      return 0
  }
}

function actionConflictStatus(
  action: ProspectSearchContactIdentityOperatorAction,
  current: ProspectSearchContactConflictStatus,
): ProspectSearchContactConflictStatus {
  switch (action) {
    case "confirm_same_person":
    case "mark_contact_confirmed":
      return "likely_same_person"
    case "keep_separate":
      return "likely_different_people"
    case "mark_channel_role_shared":
      return "needs_review"
    case "mark_contact_invalid":
      return "needs_review"
    default:
      return current
  }
}

export function applyProspectSearchContactIdentityOperatorReview(input: {
  resolution: ProspectSearchContactIdentityResolution
  action: ProspectSearchContactIdentityOperatorAction
  note?: string | null
  reviewed_by?: string | null
  reviewed_at?: string
}): ProspectSearchContactIdentityResolution {
  const reviewed_at = input.reviewed_at ?? new Date().toISOString()
  const adjustment = actionConfidenceAdjustment(input.action)
  const operator_review: ProspectSearchContactIdentityOperatorReview = {
    action: input.action,
    note: input.note?.trim() || null,
    reviewed_at,
    reviewed_by: input.reviewed_by ?? null,
    confidence_adjustment: adjustment,
  }

  const operator_confirmed =
    input.action === "confirm_same_person" || input.action === "mark_contact_confirmed"

  const identity_confidence = Number(
    Math.min(
      0.99,
      Math.max(0.05, input.resolution.identity_confidence + adjustment),
    ).toFixed(3),
  )

  const timeline = appendProspectSearchContactIdentityTimelineEvent(input.resolution.timeline, {
    id: `operator-${input.action}-${reviewed_at}`,
    kind: operator_confirmed ? "operator_confirmed" : "operator_review",
    label: operator_confirmed ? "Operator confirmed identity" : "Operator review recorded",
    detail: input.note?.trim() || input.action.replace(/_/g, " "),
    occurred_at: reviewed_at,
    source: "operator_review",
  })

  return {
    ...input.resolution,
    operator_confirmed,
    operator_review,
    identity_confidence,
    conflict_status: actionConflictStatus(input.action, input.resolution.conflict_status),
    timeline,
  }
}

export function formatProspectSearchContactConflictLabel(
  status: ProspectSearchContactConflictStatus | null | undefined,
): string {
  if (!status || status === "no_conflict") return "No conflict"
  return status.replace(/_/g, " ")
}
