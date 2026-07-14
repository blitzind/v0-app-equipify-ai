/** GE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2B — Post-call next-best action via canonical Decision Engine 1A. */

import type { CallIntelligenceScorecardPublicView } from "@/lib/growth/call-intelligence/call-intelligence-types"
import type { GrowthOutreachRelationshipAssessment } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"
import type { CallWorkspaceAiosLiveReasoningSnapshot } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"
import type { NativeCallWrapupInput } from "@/lib/growth/native-dialer/native-dialer-wrapup-engine"
import type {
  NextBestAction,
} from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"
import type { ExtractedCallOutcomes } from "@/lib/growth/operator-assist/call-workspace-post-call-outcome-extraction"
import {
  buildCanonicalDecisionInputFromPostCall,
  mapCanonicalDecisionToPostCallNba,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-adapters"
import { buildGrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a"

export function resolveCallWorkspacePostCallNextAction(input: {
  organizationId?: string
  leadId?: string
  generatedAt?: string
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
  packageState?: import("@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-input").GrowthCanonicalDecisionPackageState
  meeting?: import("@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-input").GrowthCanonicalDecisionMeetingState
  approvalState?: import("@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-input").GrowthCanonicalDecisionApprovalState
}): NextBestAction {
  const relationshipGoal =
    input.relationshipAssessment?.relationshipGoal.label ??
    input.liveReasoning?.recommendedNextObjective ??
    "advance the relationship"

  const decisionInput = buildCanonicalDecisionInputFromPostCall({
    organizationId: input.organizationId ?? "org-unknown",
    leadId: input.leadId ?? "lead-unknown",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    companyName: input.companyName,
    contactName: input.contactName,
    extracted: input.extracted,
    liveReasoning: input.liveReasoning,
    relationshipAssessment: input.relationshipAssessment,
    scorecard: input.scorecard,
    operatorWrapup: input.operatorWrapup,
    packageState: input.packageState,
    meeting: input.meeting,
    approvalState: input.approvalState,
  })

  const decision = buildGrowthCanonicalNextBestDecision(decisionInput)
  return mapCanonicalDecisionToPostCallNba(decision, relationshipGoal)
}

export function resolvePostCallFollowUpChannel(nextAction: NextBestAction): {
  followUpRequired: boolean
  followUpChannel: import("@/lib/growth/operator-assist/call-workspace-post-call-closure-types").GrowthOutreachChannel | null
  followUpReason: string | null
} {
  switch (nextAction.kind) {
    case "send_promised_information":
    case "send_recap":
      return {
        followUpRequired: true,
        followUpChannel: "email",
        followUpReason: nextAction.label,
      }
    case "schedule_next_meeting":
      return {
        followUpRequired: true,
        followUpChannel: "meeting_request",
        followUpReason: nextAction.label,
      }
    case "prepare_demo":
    case "prepare_workflow_review":
    case "prepare_proposal":
    case "prepare_pricing_discussion":
      return {
        followUpRequired: true,
        followUpChannel: "email",
        followUpReason: `Package prep: ${nextAction.label}`,
      }
    case "request_stakeholder_introduction":
      return {
        followUpRequired: true,
        followUpChannel: "linkedin",
        followUpReason: nextAction.label,
      }
    case "wait_until_agreed_date":
    case "pause":
    case "no_action":
    case "disqualify":
      return { followUpRequired: false, followUpChannel: null, followUpReason: null }
    default:
      return {
        followUpRequired: true,
        followUpChannel: "follow_up",
        followUpReason: nextAction.label,
      }
  }
}
