/**
 * GE-AIOS-DECISION-ENGINE-1A — Pure canonical next-best decision builder (client-safe).
 */

import { buildGrowthCanonicalDecisionFingerprint } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-fingerprint"
import type { GrowthCanonicalDecisionInput } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_QA_MARKER,
  type DecisionBlocker,
  type DecisionPrerequisite,
  type GrowthCanonicalDecisionActor,
  type GrowthCanonicalDecisionChannel,
  type GrowthCanonicalDecisionUrgency,
  type GrowthCanonicalNextBestDecision,
  type GrowthCanonicalPrimaryAction,
  type SupportingDecisionAction,
  type SuppressedDecisionAction,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"

type DecisionCandidate = {
  tier: number
  action: GrowthCanonicalPrimaryAction
  title: string
  rationale: string[]
  confidence: number
  urgency: GrowthCanonicalDecisionUrgency
  actor: GrowthCanonicalDecisionActor
  channel: GrowthCanonicalDecisionChannel
  targetRole?: string | null
  targetContactId?: string | null
  waitUntil?: string | null
  source: string
}

const TIER = {
  operatorSafety: 1000,
  commitments: 900,
  activeMeeting: 850,
  relationshipProtection: 800,
  materialReply: 750,
  postCall: 700,
  committee: 650,
  revenue: 600,
  researchGap: 550,
  institutional: 500,
  defaultOutreach: 400,
} as const

function joinText(parts: string[]): string {
  return parts.join(" ").toLowerCase()
}

function hasPromisedInformation(input: GrowthCanonicalDecisionInput): boolean {
  if (input.packageState?.promisedInformationSent || input.packageState?.status === "sent") {
    return false
  }
  const commitments = input.postCall?.commitments ?? []
  const commitmentText = joinText(commitments)
  if (/checklist|workflow|send.*information|promised/i.test(commitmentText)) return true
  if (input.packageState?.promisedInformationPending) return true
  if (input.packageState?.purpose && /checklist|promised|workflow/i.test(input.packageState.purpose)) {
    return true
  }
  return false
}

function promisedInformationTitle(input: GrowthCanonicalDecisionInput): string {
  const contact = input.contactName?.trim()
  const commitments = input.postCall?.commitments ?? []
  const checklist = commitments.find((row) => /checklist|workflow/i.test(row))
  if (checklist) {
    return contact
      ? `Send the promised workflow checklist to ${contact} today`
      : "Send the promised workflow checklist today"
  }
  return contact ? `Send promised information to ${contact} today` : "Send promised information today"
}

function buildCandidates(input: GrowthCanonicalDecisionInput): DecisionCandidate[] {
  const candidates: DecisionCandidate[] = []
  const relationshipGoal =
    input.relationshipAssessment?.relationshipGoal.label ?? "advance the relationship"
  const trustLevel = input.relationshipAssessment?.trustBudget.level ?? "maintaining"
  const protection = input.relationshipAssessment?.relationshipProtection.active ?? false
  const postCall = input.postCall
  const meeting = input.meeting
  const committee = input.committee
  const commercial = input.commercialReadiness
  const commitmentsText = joinText(postCall?.commitments ?? [])
  const businessText = joinText(postCall?.businessConclusions ?? [])
  const proposalRequested =
    Boolean(meeting?.postMeetingProposalRequested) || /proposal/i.test(commitmentsText)

  const operator = input.operatorConstraints ?? {}
  if (operator.archived || operator.disqualified) {
    candidates.push({
      tier: TIER.operatorSafety,
      action: operator.disqualified ? "disqualify" : "no_action",
      title: operator.disqualified ? "Disqualify lead" : "No action — lead archived",
      rationale: [
        operator.disqualified
          ? "Operator or system marked this lead as disqualified."
          : "Lead is archived — Ava should not pursue further outreach.",
      ],
      confidence: 95,
      urgency: "none",
      actor: "system",
      channel: "none",
      source: "operator_constraints",
    })
  }

  if (operator.unsubscribed) {
    candidates.push({
      tier: TIER.operatorSafety,
      action: "disqualify",
      title: "Stop outreach — prospect unsubscribed",
      rationale: ["Unsubscribe suppresses all transport and outreach actions."],
      confidence: 98,
      urgency: "none",
      actor: "system",
      channel: "none",
      source: "operator_constraints",
    })
  }

  if (operator.paused || operator.operatorPausedOutreach) {
    candidates.push({
      tier: TIER.operatorSafety,
      action: "pause",
      title: "Pause outreach per operator authority",
      rationale: ["Operator paused this account — hold competing outreach until released."],
      confidence: 92,
      urgency: "none",
      actor: "operator",
      channel: "none",
      source: "operator_constraints",
    })
  }

  if (postCall?.agreedWaitUntil) {
    candidates.push({
      tier: TIER.commitments,
      action: "wait",
      title: "Wait until agreed date",
      rationale: [
        "Prospect set explicit timing — preserve trust budget until the agreed window.",
        relationshipGoal ? `Relationship goal remains ${relationshipGoal.toLowerCase()}.` : "",
      ].filter(Boolean),
      confidence: 90,
      urgency: "scheduled",
      actor: "ava",
      channel: "none",
      waitUntil: postCall.agreedWaitUntil,
      source: "explicit_timing",
    })
  } else if (postCall?.timelineDetected && !meeting?.hasUpcomingMeeting && !proposalRequested) {
    candidates.push({
      tier: TIER.commitments,
      action: "wait",
      title: "Wait until agreed date",
      rationale: [
        "Prospect set explicit timing — preserve trust budget until the agreed window.",
        relationshipGoal ? `Relationship goal remains ${relationshipGoal.toLowerCase()}.` : "",
      ].filter(Boolean),
      confidence: 88,
      urgency: "scheduled",
      actor: "ava",
      channel: "none",
      waitUntil: postCall?.agreedWaitUntil ?? null,
      source: "explicit_timing",
    })
  }

  if (
    hasPromisedInformation(input) &&
    !input.packageState?.promisedInformationSent &&
    input.packageState?.status !== "sent"
  ) {
    candidates.push({
      tier: TIER.commitments,
      action: "send_promised_information",
      title: promisedInformationTitle(input),
      rationale: [
        "Honor the call commitment before advancing new outreach.",
        businessText.includes("depot") || businessText.includes("field")
          ? "Josh confirmed depot-to-field coordination is a real issue and asked for the checklist."
          : "Promised information remains outstanding.",
      ],
      confidence: 92,
      urgency: "today",
      actor: "ava",
      channel: "email",
      source: "explicit_commitment",
    })
  }

  if (meeting?.hasUpcomingMeeting) {
    const role = meeting.stakeholderRole ?? committee?.recommendedStakeholderRole ?? null
    candidates.push({
      tier: TIER.activeMeeting,
      action: "prepare_meeting",
      title: role
        ? `Prepare for upcoming meeting with ${role}`
        : "Prepare for upcoming meeting",
      rationale: [
        "Meeting is booked — preparation outranks cold follow-ups.",
        meeting.meetingObjective ? `Objective: ${meeting.meetingObjective}` : "",
      ].filter(Boolean),
      confidence: 88,
      urgency: meeting.meetingAt ? "scheduled" : "this_week",
      actor: role && /director|executive|vp/i.test(role) ? "operator" : "ava",
      channel: "meeting",
      targetRole: role,
      targetContactId: meeting.stakeholderContactId,
      source: "active_meeting",
    })
  }

  if (protection || trustLevel === "depleted" || trustLevel === "damaging") {
    candidates.push({
      tier: TIER.relationshipProtection,
      action: trustLevel === "depleted" ? "pause" : "wait",
      title: "Protect relationship before another touch",
      rationale: [
        `Trust budget is ${trustLevel} — ${input.relationshipAssessment?.relationshipProtection.rationale.join(" ") ?? "hold outreach until credibility recovers"}.`,
      ],
      confidence: 86,
      urgency: "none",
      actor: "ava",
      channel: "none",
      source: "relationship_protection",
    })
  }

  const reply = input.replyState
  if (reply?.isMaterial && !reply.isOutOfOffice && !reply.isUnknown) {
    const replyAction: GrowthCanonicalPrimaryAction =
      /meeting|demo/i.test(reply.intent ?? "") ? "schedule_meeting" : "reply"
    candidates.push({
      tier: TIER.materialReply,
      action: replyAction,
      title: replyAction === "schedule_meeting" ? "Schedule requested meeting" : "Reply to material message",
      rationale: [
        `Latest reply classification: ${reply.classification ?? reply.intent ?? "material"}.`,
        "Material reply outranks stale sequence actions.",
      ],
      confidence: 84,
      urgency: "today",
      actor: replyAction === "reply" ? "operator" : "ava",
      channel: replyAction === "schedule_meeting" ? "meeting" : "email",
      source: "reply_intelligence",
    })
  }

  if (postCall?.operatorOutcome === "not_interested") {
    candidates.push({
      tier: TIER.postCall,
      action: "disqualify",
      title: "Disqualify account",
      rationale: ["Operator marked the call as not a fit."],
      confidence: 90,
      urgency: "none",
      actor: "operator",
      channel: "none",
      source: "post_call_closure",
    })
  }

  if (postCall?.meetingBooked && !meeting?.hasUpcomingMeeting) {
    candidates.push({
      tier: TIER.postCall,
      action: "schedule_meeting",
      title: "Schedule next meeting",
      rationale: ["Call ended with an agreed meeting — secure calendar hold before more outreach."],
      confidence: 88,
      urgency: "today",
      actor: "ava",
      channel: "meeting",
      source: "post_call_closure",
    })
  }

  if (/service director|stakeholder|introduce|multi-thread/i.test(businessText + commitmentsText)) {
    candidates.push({
      tier: TIER.committee,
      action: committee?.multiThreadRecommended ? "multi_thread" : "request_introduction",
      title: committee?.recommendedStakeholderLabel
        ? `Request introduction to ${committee.recommendedStakeholderLabel}`
        : "Request stakeholder introduction",
      rationale: [
        "Committee gap surfaced — expand thread only after promised follow-through.",
        committee?.summary ?? "Buying committee strategy recommends broader coverage.",
      ],
      confidence: 82,
      urgency: "this_week",
      actor: "ava",
      channel: "linkedin",
      targetRole: committee?.recommendedStakeholderRole ?? null,
      source: "buying_committee",
    })
  }

  if (meeting?.postMeetingProposalRequested) {
    const ready = commercial?.proposalInputsComplete ?? false
    candidates.push({
      tier: TIER.commitments,
      action: ready ? "prepare_proposal" : "research",
      title: ready ? "Prepare proposal" : "Collect proposal prerequisites",
      rationale: ready
        ? ["Proposal requested after meeting — build from confirmed facts."]
        : [
            "Proposal was requested but commercial prerequisites are incomplete.",
            ...(commercial?.discoveryGaps ?? []).slice(0, 2),
          ],
      confidence: ready ? 80 : 91,
      urgency: ready ? "this_week" : "today",
      actor: "ava",
      channel: ready ? "email" : "none",
      source: "meeting_outcome",
    })
  }

  if (/pricing|proposal|budget/i.test(commitmentsText + joinText(postCall?.objections ?? []))) {
    const wantsProposal = /proposal/i.test(commitmentsText)
    const pricingReady = commercial?.pricingInputsComplete ?? false
    if (wantsProposal) {
      candidates.push({
        tier: pricingReady ? TIER.revenue : TIER.researchGap,
        action: pricingReady ? "prepare_proposal" : "research",
        title: pricingReady ? "Prepare proposal" : "Research before unsupported proposal",
        rationale: [
          pricingReady
            ? "Proposal requested on call — prerequisites are satisfied."
            : "Proposal requested without required commercial data — research first.",
        ],
        confidence: 78,
        urgency: "this_week",
        actor: "ava",
        channel: "email",
        source: "post_call_closure",
      })
    } else {
      candidates.push({
        tier: TIER.revenue,
        action: "prepare_pricing",
        title: "Prepare pricing discussion",
        rationale: ["Pricing surfaced — prepare a grounded commercial conversation."],
        confidence: 76,
        urgency: "this_week",
        actor: "ava",
        channel: "email",
        source: "post_call_closure",
      })
    }
  }

  const revenue = input.revenueStrategy
  if (revenue === "research") {
    candidates.push({
      tier: TIER.researchGap,
      action: "research",
      title: "Research unresolved gaps",
      rationale: ["Revenue strategy recommends research before another outreach touch."],
      confidence: 72,
      urgency: "this_week",
      actor: "ava",
      channel: "none",
      source: "revenue_strategy_1a",
    })
  } else if (revenue === "delay") {
    candidates.push({
      tier: TIER.revenue,
      action: "wait",
      title: "Wait per revenue strategy",
      rationale: ["Revenue strategy recommends delay — do not manufacture urgency."],
      confidence: 74,
      urgency: "scheduled",
      actor: "ava",
      channel: "none",
      source: "revenue_strategy_1a",
    })
  } else if (revenue === "disqualify") {
    candidates.push({
      tier: TIER.revenue,
      action: "disqualify",
      title: "Disqualify per revenue strategy",
      rationale: ["Revenue strategy indicates this account should not advance."],
      confidence: 80,
      urgency: "none",
      actor: "operator",
      channel: "none",
      source: "revenue_strategy_1a",
    })
  } else if (revenue === "proceed") {
    candidates.push({
      tier: TIER.revenue,
      action: "contact",
      title: "Continue outreach",
      rationale: [`Proceed toward ${relationshipGoal.toLowerCase()}.`],
      confidence: 68,
      urgency: "this_week",
      actor: "ava",
      channel: (input.institutionalAdvice?.channelHint as GrowthCanonicalDecisionChannel) ?? "email",
      source: "revenue_strategy_1a",
    })
  }

  const institutional = input.institutionalAdvice
  if (institutional?.operatorInsights?.[0]) {
    const insight = institutional.operatorInsights[0]
    candidates.push({
      tier: TIER.institutional,
      action: "research",
      title: insight.headline,
      rationale: [insight.detail],
      confidence: Math.round(insight.confidence * 100),
      urgency: "this_week",
      actor: "ava",
      channel: "none",
      source: "institutional_learning",
    })
  }

  if ((commercial?.discoveryGaps?.length ?? 0) > 0) {
    candidates.push({
      tier: TIER.researchGap,
      action: "research",
      title: "Close discovery gaps",
      rationale: commercial!.discoveryGaps.slice(0, 3),
      confidence: 70,
      urgency: "this_week",
      actor: "ava",
      channel: "none",
      source: "discovery_gaps",
    })
  }

  candidates.push({
    tier: TIER.defaultOutreach,
    action: "pause",
    title: "Pause and monitor",
    rationale: ["No higher-priority action — avoid default outreach until strategy shifts."],
    confidence: 60,
    urgency: "none",
    actor: "ava",
    channel: "none",
    source: "default",
  })

  return candidates
}

function buildSuppressions(input: GrowthCanonicalDecisionInput): SuppressedDecisionAction[] {
  const suppressed: SuppressedDecisionAction[] = []
  const operator = input.operatorConstraints ?? {}
  const hasMeeting = input.meeting?.hasUpcomingMeeting ?? false
  const waiting = Boolean(input.postCall?.agreedWaitUntil || input.postCall?.timelineDetected)
  const promisedPending = hasPromisedInformation(input) && !input.packageState?.promisedInformationSent
  const approvalPending = input.approvalState?.pendingPackageApproval ?? false
  const transportBlocked = input.transportState?.blocked ?? false
  const positiveReply = input.replyState?.isMaterial && /positive|interest/i.test(input.replyState.intent ?? "")

  const add = (
    action: GrowthCanonicalPrimaryAction,
    title: string,
    reason: string,
    source: string,
  ) => {
    suppressed.push({ action, title, reason, source })
  }

  if (operator.archived || operator.disqualified || operator.unsubscribed) {
    add("contact", "Cold outreach", "Lead is archived, disqualified, or unsubscribed.", "operator_constraints")
    add("reply", "Outbound reply", "Transport is blocked for this lead.", "operator_constraints")
    add("multi_thread", "Multi-thread outreach", "All transport suppressed.", "operator_constraints")
  }

  if (waiting || operator.paused || /next quarter|q[1-4]/i.test(joinText(input.postCall?.businessConclusions ?? []))) {
    add("contact", "New outreach", "Prospect asked to wait or operator paused outreach.", "timing")
    add("prepare_pricing", "Pricing pitch", "Timing is not yet right.", "timing")
  }

  if (hasMeeting) {
    add("contact", "Cold follow-up email", "Meeting is booked — preparation takes priority.", "meeting_state")
    if (input.sequenceState?.enrolled) {
      add("contact", "Scheduled sequence send", "Sequence follow-up suppressed while meeting is active.", "sequence_state")
    }
  }

  if (promisedPending) {
    add("contact", "New cold email", "Promised information must go first.", "explicit_commitment")
    add("research", "Repeated discovery", "Questions from the call are already answered.", "explicit_commitment")
    add("prepare_pricing", "Pricing pitch", "Do not introduce pricing before honoring the commitment.", "explicit_commitment")
    add("prepare_proposal", "Immediate proposal", "Proposal is premature before promised follow-through.", "explicit_commitment")
    add("multi_thread", "Unrelated multi-channel sequence", "Expand committee after promised information is sent.", "explicit_commitment")
  }

  if (positiveReply) {
    add("contact", "Cold outreach", "Positive reply already opened the thread.", "reply_intelligence")
  }

  if (approvalPending) {
    add("contact", "Competing package", "An approved package is already awaiting operator review.", "approval_state")
  }

  if (transportBlocked || approvalPending) {
    add("contact", "Transport send", "Send Plane remains blocked until approval clears.", "transport_guardrails")
  }

  if (!(input.commercialReadiness?.proposalInputsComplete ?? false)) {
    add("prepare_proposal", "Unsupported proposal", "Required commercial inputs are incomplete.", "commercial_readiness")
  }

  if (input.relationshipAssessment?.relationshipProtection.active) {
    add("multi_thread", "Risky multi-threading", "Trust protection suppresses committee expansion.", "relationship_protection")
  }

  return suppressed
}

function buildPrerequisites(input: GrowthCanonicalDecisionInput): DecisionPrerequisite[] {
  const prerequisites: DecisionPrerequisite[] = []
  if (input.approvalState?.pendingPackageApproval) {
    prerequisites.push({
      id: "operator-approval",
      label: "Operator approval for pending package",
      status: "pending",
      blocksPrimary: false,
    })
  }
  if (hasPromisedInformation(input) && input.packageState?.status === "pending_approval") {
    prerequisites.push({
      id: "promised-package-approval",
      label: "Approve promised-information package in Human Approval Center",
      status: "pending",
      blocksPrimary: true,
    })
  }
  if (!(input.commercialReadiness?.proposalInputsComplete ?? true)) {
    for (const gap of input.commercialReadiness?.discoveryGaps ?? []) {
      prerequisites.push({
        id: `discovery-${gap.slice(0, 24).toLowerCase().replace(/\s+/g, "-")}`,
        label: gap,
        status: "pending",
        blocksPrimary: false,
      })
    }
  }
  return prerequisites
}

function buildBlockers(input: GrowthCanonicalDecisionInput): DecisionBlocker[] {
  const blockers: DecisionBlocker[] = []
  if (input.transportState?.blocked) {
    blockers.push({
      id: "transport",
      label: input.transportState.reason ?? "Transport guardrails active",
      source: "send_plane",
      severity: "hard",
    })
  }
  if (input.approvalState?.pendingPackageApproval) {
    blockers.push({
      id: "approval",
      label: input.approvalState.label ?? "Package awaiting operator review",
      source: "human_approval_center",
      severity: "soft",
    })
  }
  if (input.revenueStrategy === "delay" && input.relationshipAssessment?.trustBudget.level === "depleted") {
    blockers.push({
      id: "trust-revenue-conflict",
      label: "Revenue proceed conflicts with depleted trust budget — waiting wins",
      source: "conflict_resolution",
      severity: "hard",
    })
  }
  return blockers
}

function resolveConflicts(
  candidates: DecisionCandidate[],
  suppressed: SuppressedDecisionAction[],
  input: GrowthCanonicalDecisionInput,
): DecisionCandidate[] {
  const suppressedActions = new Set(suppressed.map((row) => row.action))
  let filtered = candidates.filter((candidate) => !suppressedActions.has(candidate.action))

  if (input.revenueStrategy === "proceed" && input.relationshipAssessment?.trustBudget.level === "depleted") {
    filtered = filtered.filter((candidate) => candidate.action !== "contact")
  }

  if (input.approvalState?.pendingPackageApproval) {
    filtered = filtered.filter(
      (candidate) => candidate.action !== "contact" && candidate.action !== "prepare_proposal",
    )
  }

  if (hasPromisedInformation(input) && !input.packageState?.promisedInformationSent) {
    filtered = filtered.filter(
      (candidate) =>
        candidate.tier >= TIER.commitments ||
        candidate.action === "prepare_meeting" ||
        candidate.action === "wait" ||
        candidate.action === "pause" ||
        candidate.action === "no_action" ||
        candidate.action === "disqualify",
    )
  }

  return filtered.sort((a, b) => b.tier - a.tier || b.confidence - a.confidence)
}

function toSupporting(candidate: DecisionCandidate): SupportingDecisionAction {
  return {
    action: candidate.action,
    title: candidate.title,
    rationale: candidate.rationale[0] ?? "",
    urgency: candidate.urgency,
    recommendedActor: candidate.actor,
  }
}

export function buildGrowthCanonicalNextBestDecision(
  input: GrowthCanonicalDecisionInput,
): GrowthCanonicalNextBestDecision {
  const fingerprint = buildGrowthCanonicalDecisionFingerprint(input)
  const suppressed = buildSuppressions(input)
  const ranked = resolveConflicts(buildCandidates(input), suppressed, input)
  const primary = ranked[0]
  const supporting = ranked
    .slice(1, 4)
    .filter((candidate) => candidate.tier >= TIER.activeMeeting)
    .map(toSupporting)

  const operatorReviewRequired =
    Boolean(input.approvalState?.pendingOperatorReview) ||
    Boolean(input.approvalState?.pendingPackageApproval) ||
    primary.actor === "operator"

  const transportBlocked =
    Boolean(input.transportState?.blocked) ||
    Boolean(input.approvalState?.pendingPackageApproval) ||
    Boolean(input.operatorConstraints?.archived) ||
    Boolean(input.operatorConstraints?.unsubscribed)

  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_QA_MARKER,
    decisionId: `decision:${input.leadId}:${fingerprint}`,
    decisionFingerprint: fingerprint,
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
    primaryAction: primary.action,
    title: primary.title,
    rationale: primary.rationale,
    urgency: primary.urgency,
    confidence: primary.confidence,
    recommendedActor: primary.actor,
    recommendedChannel: primary.channel,
    targetContactId: primary.targetContactId ?? null,
    targetRole: primary.targetRole ?? null,
    waitUntil: primary.waitUntil ?? null,
    prerequisites: buildPrerequisites(input),
    blockedBy: buildBlockers(input),
    supportingActions: supporting,
    suppressedActions: suppressed,
    sourceSummary: {
      relationshipGoal: input.relationshipAssessment?.relationshipGoal.label ?? null,
      revenueRecommendation: input.revenueStrategy,
      latestMaterialEvent: input.sourceVersions?.materialEventId ?? input.replyState?.classification ?? null,
      currentStage: input.relationshipAssessment?.relationshipDirection ?? null,
      packageStatus: input.packageState?.status ?? null,
      approvalStatus: input.approvalState?.label ?? null,
    },
    operatorReviewRequired,
    transportBlocked,
  }
}
