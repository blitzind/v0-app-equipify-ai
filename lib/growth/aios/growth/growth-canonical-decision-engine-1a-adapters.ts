/**
 * GE-AIOS-DECISION-ENGINE-1A — Post-call and reply adapters (client-safe).
 */

import type { CallIntelligenceScorecardPublicView } from "@/lib/growth/call-intelligence/call-intelligence-types"
import type { GrowthOutreachRelationshipAssessment } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"
import type { CallWorkspaceAiosLiveReasoningSnapshot } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"
import type { NativeCallWrapupInput } from "@/lib/growth/native-dialer/native-dialer-wrapup-engine"
import type {
  NextBestAction,
  CallWorkspacePostCallNextActionKind,
} from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"
import type { ExtractedCallOutcomes } from "@/lib/growth/operator-assist/call-workspace-post-call-outcome-extraction"
import { buildGrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a"
import type { GrowthCanonicalDecisionInput } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import type {
  GrowthCanonicalNextBestDecision,
  GrowthCanonicalPrimaryAction,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"

export function buildCanonicalDecisionInputFromPostCall(input: {
  organizationId: string
  leadId: string
  generatedAt: string
  companyName?: string | null
  contactName?: string | null
  extracted: Pick<
    ExtractedCallOutcomes,
    "commitments" | "objections" | "buyingSignals" | "businessConclusions"
  >
  liveReasoning: CallWorkspaceAiosLiveReasoningSnapshot | null
  relationshipAssessment: GrowthOutreachRelationshipAssessment | null
  scorecard: CallIntelligenceScorecardPublicView | null
  operatorWrapup?: NativeCallWrapupInput | null
  packageState?: GrowthCanonicalDecisionInput["packageState"]
  meeting?: GrowthCanonicalDecisionInput["meeting"]
  committee?: GrowthCanonicalDecisionInput["committee"]
  sequenceState?: GrowthCanonicalDecisionInput["sequenceState"]
  approvalState?: GrowthCanonicalDecisionInput["approvalState"]
  transportState?: GrowthCanonicalDecisionInput["transportState"]
  operatorConstraints?: GrowthCanonicalDecisionInput["operatorConstraints"]
  commercialReadiness?: GrowthCanonicalDecisionInput["commercialReadiness"]
  sourceVersions?: GrowthCanonicalDecisionInput["sourceVersions"]
}): GrowthCanonicalDecisionInput {
  const businessText = input.extracted.businessConclusions.join(" ").toLowerCase()
  const stakeholderRole = /service director/i.test(businessText) ? "Service Director" : null

  return {
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
    companyName: input.companyName ?? null,
    contactName: input.contactName ?? null,
    memoryBundle: null,
    relationshipAssessment: input.relationshipAssessment,
    revenueStrategy: null,
    adaptiveEvolution: null,
    institutionalAdvice: null,
    committee:
      input.committee ??
      (stakeholderRole
        ? {
            championIdentified: false,
            recommendedStakeholderRole: stakeholderRole,
            recommendedStakeholderLabel: stakeholderRole,
            multiThreadRecommended: false,
            summary: "Service Director surfaced on the call.",
          }
        : null),
    replyState: null,
    postCall: {
      commitments: input.extracted.commitments,
      objections: input.extracted.objections,
      buyingSignals: input.extracted.buyingSignals,
      businessConclusions: input.extracted.businessConclusions,
      operatorOutcome: input.operatorWrapup?.outcome ?? null,
      meetingBooked: input.operatorWrapup?.meetingBooked ?? false,
      timelineDetected: input.operatorWrapup?.timelineDetected ?? /next quarter|q[1-4]/i.test(businessText),
      agreedWaitUntil: input.operatorWrapup?.timelineDetected ? "next_quarter" : null,
    },
    meeting:
      input.meeting ??
      (input.operatorWrapup?.meetingBooked || stakeholderRole
        ? {
            hasUpcomingMeeting: Boolean(input.operatorWrapup?.meetingBooked),
            meetingAt: null,
            meetingObjective: input.liveReasoning?.recommendedNextObjective ?? null,
            stakeholderRole,
            stakeholderContactId: null,
          }
        : null),
    packageState: input.packageState ?? null,
    draftFactoryStatus: null,
    approvalState: input.approvalState ?? null,
    sequenceState: input.sequenceState ?? null,
    transportState: input.transportState ?? { blocked: true, reason: "Send Plane blocked until approval" },
    operatorConstraints: input.operatorConstraints ?? null,
    commercialReadiness: input.commercialReadiness ?? {
      pricingInputsComplete: false,
      proposalInputsComplete: false,
      discoveryGaps: [],
    },
    sourceVersions: input.sourceVersions,
  }
}

const POST_CALL_KIND_MAP: Partial<Record<GrowthCanonicalPrimaryAction, CallWorkspacePostCallNextActionKind>> = {
  send_promised_information: "send_promised_information",
  schedule_meeting: "schedule_next_meeting",
  prepare_meeting: "prepare_workflow_review",
  request_introduction: "request_stakeholder_introduction",
  multi_thread: "multi_thread",
  prepare_pricing: "prepare_pricing_discussion",
  prepare_proposal: "prepare_proposal",
  wait: "wait_until_agreed_date",
  pause: "pause",
  disqualify: "disqualify",
  no_action: "no_action",
  research: "research_unresolved_question",
  reply: "send_recap",
  contact: "send_recap",
}

export function mapCanonicalDecisionToPostCallNba(
  decision: GrowthCanonicalNextBestDecision,
  relationshipGoal: string,
): NextBestAction {
  const kind =
    POST_CALL_KIND_MAP[decision.primaryAction] ??
    (decision.primaryAction === "prepare_meeting" ? "prepare_workflow_review" : "pause")

  const advancesRelationshipGoal =
    decision.primaryAction !== "no_action" &&
    decision.primaryAction !== "disqualify" &&
    decision.primaryAction !== "pause"

  return {
    kind,
    label: decision.title,
    rationale:
      decision.rationale[0] ??
      `Canonical decision aligned to ${relationshipGoal.toLowerCase()}.`,
    confidence: decision.confidence,
    advancesRelationshipGoal,
  }
}

export function buildCanonicalDecisionFromReplyState(input: {
  organizationId: string
  leadId: string
  generatedAt: string
  relationshipAssessment: GrowthOutreachRelationshipAssessment | null
  replyState: NonNullable<GrowthCanonicalDecisionInput["replyState"]>
  packageState?: GrowthCanonicalDecisionInput["packageState"]
  meeting?: GrowthCanonicalDecisionInput["meeting"]
  sequenceState?: GrowthCanonicalDecisionInput["sequenceState"]
}): GrowthCanonicalNextBestDecision | null {
  if (!input.replyState.isMaterial || input.replyState.isOutOfOffice || input.replyState.isUnknown) {
    return null
  }

  return buildGrowthCanonicalNextBestDecision({
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
    memoryBundle: null,
    relationshipAssessment: input.relationshipAssessment,
    revenueStrategy: null,
    adaptiveEvolution: null,
    institutionalAdvice: null,
    committee: null,
    replyState: input.replyState,
    postCall: null,
    meeting: input.meeting ?? null,
    packageState: input.packageState ?? null,
    draftFactoryStatus: null,
    approvalState: null,
    sequenceState: input.sequenceState ?? null,
    transportState: { blocked: false, reason: null },
    operatorConstraints: null,
    commercialReadiness: null,
    sourceVersions: { materialEventId: input.replyState.receivedAt },
  })
}
