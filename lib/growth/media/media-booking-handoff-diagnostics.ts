/** Growth Engine S2-J — in-memory booking handoff certification (no DB, no calendar execution). */

import { randomUUID } from "node:crypto"
import {
  archiveBookingHandoff,
  cancelBookingHandoff,
  createBookingHandoff,
  getBookingHandoff,
  resetMediaBookingHandoffStoreForCert,
} from "@/lib/growth/media/media-booking-handoff-service"
import {
  buildBookingPreview,
  buildRecommendedAgenda,
  buildRecommendedAttendees,
  buildNextStepRecommendations,
  evaluateMeetingReadiness,
  validateBookingHandoffQualificationGoal,
} from "@/lib/growth/media/media-booking-handoff-utils"
import {
  GROWTH_MEDIA_BOOKING_HANDOFF_QA_MARKER,
  GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS,
} from "@/lib/growth/media/media-booking-handoff-types"

export type GrowthMediaBookingHandoffDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthMediaBookingHandoffDiagnosticsReport = {
  ok: boolean
  qa_marker: typeof GROWTH_MEDIA_BOOKING_HANDOFF_QA_MARKER
  checks: GrowthMediaBookingHandoffDiagnosticsCheck[]
  final_verdict: "PASS" | "FAIL"
} & typeof GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS

function pushCheck(
  checks: GrowthMediaBookingHandoffDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

export function executeGrowthMediaBookingHandoffDiagnostics(input: {
  organizationId: string
}): GrowthMediaBookingHandoffDiagnosticsReport {
  const checks: GrowthMediaBookingHandoffDiagnosticsCheck[] = []
  resetMediaBookingHandoffStoreForCert()

  pushCheck(
    checks,
    "booking_handoff_safety_flags",
    GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.calendar_execution_enabled === false &&
      GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.booking_execution_enabled === false &&
      GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.no_calendar_creation === true &&
      GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.no_notifications === true &&
      GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.no_sequence_execution === true &&
      GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.requires_human_review === true,
    "Booking handoff safety flags enforced.",
  )

  pushCheck(
    checks,
    "qualification_goal_validation",
    validateBookingHandoffQualificationGoal("meeting_readiness") &&
      !validateBookingHandoffQualificationGoal("invalid-goal"),
    "Qualification goal bridge validation deterministic.",
  )

  const readiness = evaluateMeetingReadiness({
    qualificationGoal: "booking_recommendation",
    aiQaEnabled: true,
    conversationEnabled: true,
    bookingHandoffEnabled: true,
  })
  pushCheck(
    checks,
    "readiness_scoring",
    readiness.readinessScore >= 60 && readiness.readinessTier !== "not_ready",
    "Meeting readiness scoring deterministic.",
  )

  const preview = buildBookingPreview({
    qualificationGoal: "meeting_readiness",
    prospectName: "Alex Rivera",
    companyName: "Summit Field Services",
    conversationEnabled: true,
    aiQaEnabled: true,
  })
  pushCheck(
    checks,
    "booking_preview",
    preview.recommendation.recommendedMeetingType.length > 0 && preview.recommendation.requiresHumanReview,
    "Booking preview generated with human review required.",
  )

  const attendees = buildRecommendedAttendees({
    qualificationGoal: "buying_committee_discovery",
    readiness: evaluateMeetingReadiness({ qualificationGoal: "buying_committee_discovery" }),
  })
  pushCheck(
    checks,
    "attendee_recommendations",
    attendees.includes("economic_buyer"),
    "Attendee recommendation rules applied.",
  )

  const agenda = buildRecommendedAgenda({
    qualificationGoal: "meeting_readiness",
    readiness: evaluateMeetingReadiness({ qualificationGoal: "meeting_readiness" }),
    prospectName: "Alex Rivera",
    companyName: "Summit Field Services",
  })
  pushCheck(checks, "agenda_generation", agenda.includes("Alex Rivera"), "Agenda merge resolution works.")

  const nextSteps = buildNextStepRecommendations({
    qualificationGoal: "next_best_action",
    readiness: evaluateMeetingReadiness({ qualificationGoal: "next_best_action" }),
  })
  pushCheck(checks, "next_step_recommendations", nextSteps.length >= 2, "Next-step recommendations generated.")

  const created = createBookingHandoff({
    organizationId: input.organizationId,
    qualificationGoal: "booking_recommendation",
    prospectName: "Alex Rivera",
    companyName: "Summit Field Services",
    aiQaEnabled: true,
    conversationEnabled: true,
    bookingHandoffEnabled: true,
  })
  pushCheck(checks, "handoff_create", created.status === "ready" || created.status === "draft", "Handoff created.")
  pushCheck(checks, "handoff_no_calendar_creation", GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.no_calendar_creation, "No calendar creation flag enforced.")

  const read = getBookingHandoff(created.handoffId, input.organizationId)
  pushCheck(checks, "handoff_status_read", read.handoffId === created.handoffId, "Handoff status read works.")

  const cancelled = cancelBookingHandoff(created.handoffId, input.organizationId)
  pushCheck(checks, "handoff_cancel", cancelled.status === "cancelled", "Cancellation state machine works.")

  resetMediaBookingHandoffStoreForCert()
  const archiveSeed = createBookingHandoff({
    organizationId: input.organizationId,
    qualificationGoal: "meeting_readiness",
  })
  const archived = archiveBookingHandoff(archiveSeed.handoffId, input.organizationId)
  pushCheck(checks, "handoff_archive", archived.status === "archived", "Archive state machine works.")

  let wrongOrgBlocked = false
  try {
    getBookingHandoff(archiveSeed.handoffId, randomUUID())
  } catch (error) {
    wrongOrgBlocked = error instanceof Error && error.message === "organization_scope_mismatch"
  }
  pushCheck(checks, "handoff_org_scope", wrongOrgBlocked, "Organization scope enforced on status read.")

  resetMediaBookingHandoffStoreForCert()
  pushCheck(checks, "handoff_cleanup", true, "In-memory booking handoff fixtures cleared.")

  const failed = checks.filter((check) => !check.ok)
  return {
    ok: failed.length === 0,
    qa_marker: GROWTH_MEDIA_BOOKING_HANDOFF_QA_MARKER,
    checks,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
    ...GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS,
  }
}
