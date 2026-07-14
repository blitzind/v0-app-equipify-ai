/** GE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2B — Computed post-call closure (client-safe). */

import { detectAdaptiveStrategyChanges } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a"
import type { CanonicalHumanMemoryBundle } from "@/lib/growth/lead-memory/canonical-human-memory-types"
import {
  buildCallWorkspaceClosureFingerprint,
} from "@/lib/growth/operator-assist/call-workspace-post-call-closure-idempotency"
import {
  GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER,
  type CallWorkspacePostCallClosureInput,
  type GrowthCallWorkspacePostCallClosure,
} from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"
import {
  resolveCallWorkspacePostCallNextAction,
  resolvePostCallFollowUpChannel,
} from "@/lib/growth/operator-assist/call-workspace-post-call-nba"
import { buildGrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a"
import { buildCanonicalDecisionInputFromPostCall } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-adapters"
import { extractCallWorkspacePostCallOutcomes } from "@/lib/growth/operator-assist/call-workspace-post-call-outcome-extraction"
import type { GrowthRealtimeLiveSnapshot } from "@/lib/growth/realtime/realtime-call-types"

export function computeCallWorkspacePostCallClosure(input: {
  closureInput: CallWorkspacePostCallClosureInput
  liveSnapshot: GrowthRealtimeLiveSnapshot | null
  memoryBundle: CanonicalHumanMemoryBundle | null
  strategyChange: ReturnType<typeof detectAdaptiveStrategyChanges> | null
  followUpPackageId: string | null
  followUpPackageStatus: GrowthCallWorkspacePostCallClosure["followUpPackageStatus"]
  meetingIntelligenceUpdated: boolean
}): GrowthCallWorkspacePostCallClosure {
  const fingerprint = buildCallWorkspaceClosureFingerprint({
    organizationId: input.closureInput.organizationId,
    leadId: input.closureInput.leadId,
    sessionId: input.closureInput.sessionId,
    completionVersion: input.closureInput.completionVersion,
  })

  const relationshipAssessment = input.closureInput.liveReasoning?.relationshipAssessment ?? null

  const preliminaryNba = resolveCallWorkspacePostCallNextAction({
    organizationId: input.closureInput.organizationId,
    leadId: input.closureInput.leadId,
    generatedAt: input.closureInput.generatedAt,
    companyName: input.closureInput.companyName,
    extracted: {
      commitments: [],
      objections: [],
      buyingSignals: [],
      businessConclusions: [],
    },
    liveReasoning: input.closureInput.liveReasoning,
    relationshipAssessment,
    scorecard: input.closureInput.scorecard,
    operatorWrapup: input.closureInput.operatorWrapup,
  })

  const extracted = extractCallWorkspacePostCallOutcomes({
    generatedAt: input.closureInput.generatedAt,
    companyName: input.closureInput.companyName,
    liveReasoning: input.closureInput.liveReasoning,
    liveSnapshot: input.liveSnapshot,
    scorecard: input.closureInput.scorecard,
    operatorWrapup: input.closureInput.operatorWrapup,
    operatorDisposition: input.closureInput.operatorDisposition,
    operatorNotes: input.closureInput.operatorNotes,
    nextActionLabel: preliminaryNba.label,
  })

  const packageState =
    input.followUpPackageStatus === "pending_approval"
      ? {
          packageId: input.followUpPackageId,
          status: "pending_approval" as const,
          purpose: "promised follow-up",
          promisedInformationPending: true,
        }
      : input.followUpPackageStatus === "not_required"
        ? null
        : {
            packageId: input.followUpPackageId,
            status: "draft" as const,
            purpose: null,
          }

  const recommendedNextAction = resolveCallWorkspacePostCallNextAction({
    organizationId: input.closureInput.organizationId,
    leadId: input.closureInput.leadId,
    generatedAt: input.closureInput.generatedAt,
    companyName: input.closureInput.companyName,
    extracted,
    liveReasoning: input.closureInput.liveReasoning,
    relationshipAssessment,
    scorecard: input.closureInput.scorecard,
    operatorWrapup: input.closureInput.operatorWrapup,
    packageState,
    meeting: input.closureInput.operatorWrapup?.meetingBooked
      ? {
          hasUpcomingMeeting: true,
          meetingAt: null,
          meetingObjective: input.closureInput.liveReasoning?.recommendedNextObjective ?? null,
          stakeholderRole: extracted.committeeSignals.find((row) => /service director/i.test(row))
            ? "Service Director"
            : null,
          stakeholderContactId: null,
        }
      : null,
    approvalState:
      input.followUpPackageStatus === "pending_approval"
        ? { pendingOperatorReview: true, pendingPackageApproval: true, label: "Package awaiting review" }
        : null,
  })

  const canonicalDecision = buildGrowthCanonicalNextBestDecision(
    buildCanonicalDecisionInputFromPostCall({
      organizationId: input.closureInput.organizationId,
      leadId: input.closureInput.leadId,
      generatedAt: input.closureInput.generatedAt,
      companyName: input.closureInput.companyName,
      extracted,
      liveReasoning: input.closureInput.liveReasoning,
      relationshipAssessment,
      scorecard: input.closureInput.scorecard,
      operatorWrapup: input.closureInput.operatorWrapup,
      packageState,
      meeting: input.closureInput.operatorWrapup?.meetingBooked
        ? {
            hasUpcomingMeeting: true,
            meetingAt: null,
            meetingObjective: input.closureInput.liveReasoning?.recommendedNextObjective ?? null,
            stakeholderRole: extracted.committeeSignals.find((row) => /service director/i.test(row))
              ? "Service Director"
              : null,
            stakeholderContactId: null,
          }
        : null,
      approvalState:
        input.followUpPackageStatus === "pending_approval"
          ? { pendingOperatorReview: true, pendingPackageApproval: true, label: "Package awaiting review" }
          : null,
      sourceVersions: { materialEventId: fingerprint },
    }),
  )

  const followUp = resolvePostCallFollowUpChannel(recommendedNextAction)

  return {
    qaMarker: GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER,
    callOutcome: extracted.callOutcome,
    meetingSummary: extracted.meetingSummary,
    businessConclusions: extracted.businessConclusions,
    personalConclusions: extracted.personalConclusions,
    objections: extracted.objections,
    commitments: extracted.commitments,
    buyingSignals: extracted.buyingSignals,
    committeeSignals: extracted.committeeSignals,
    relationshipChange: extracted.adaptiveEvents,
    recommendedNextAction,
    followUpRequired: followUp.followUpRequired,
    followUpChannel: followUp.followUpChannel,
    followUpReason: followUp.followUpReason,
    operatorReviewRequired:
      extracted.memoryReviewItems.length > 0 ||
      extracted.committeeSuggestions.some((row) => row.reviewRequired),
    strategyChange: input.strategyChange,
    committeeSuggestions: extracted.committeeSuggestions,
    memoryReviewItems: extracted.memoryReviewItems,
    followUpPackageId: input.followUpPackageId,
    followUpPackageStatus: input.followUpPackageStatus,
    meetingIntelligenceUpdated: input.meetingIntelligenceUpdated,
    closureFingerprint: fingerprint,
    canonicalDecision,
  }
}
