/**
 * GE-AIOS-DECISION-ENGINE-1A — Deterministic decision fingerprint (client-safe).
 */

import type { GrowthCanonicalDecisionInput } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"

function stablePart(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

export function buildGrowthCanonicalDecisionFingerprint(input: GrowthCanonicalDecisionInput): string {
  const versions = input.sourceVersions ?? {}
  const operator = input.operatorConstraints ?? {}
  const pkg = input.packageState
  const meeting = input.meeting
  const postCall = input.postCall
  const reply = input.replyState

  const parts = [
    "ge-aios-decision-engine-1a",
    stablePart(input.organizationId),
    stablePart(input.leadId),
    stablePart(versions.memoryVersion),
    stablePart(versions.relationshipVersion),
    stablePart(versions.revenueVersion),
    stablePart(versions.packageVersion),
    stablePart(versions.meetingVersion),
    stablePart(versions.approvalVersion),
    stablePart(versions.materialEventId),
    pkg?.status ?? "none",
    pkg?.packageId ?? "",
    pkg?.promisedInformationPending ? "promised_pending" : "",
    pkg?.promisedInformationSent ? "promised_sent" : "",
    meeting?.hasUpcomingMeeting ? "meeting_upcoming" : "",
    stablePart(meeting?.meetingAt),
    operator.archived ? "archived" : "",
    operator.paused ? "paused" : "",
    operator.disqualified ? "disqualified" : "",
    operator.unsubscribed ? "unsubscribed" : "",
    postCall?.agreedWaitUntil ?? "",
    reply?.isMaterial ? stablePart(reply.classification) : "",
    input.approvalState?.pendingPackageApproval ? "approval_pending" : "",
    input.transportState?.blocked ? "transport_blocked" : "",
  ]

  return parts.filter(Boolean).join(":")
}
