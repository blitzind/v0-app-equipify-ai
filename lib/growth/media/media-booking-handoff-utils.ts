/** Growth Engine S2-J — client-safe booking handoff helpers (no calendar execution). */

import { validateConversationalQualificationGoal } from "@/lib/growth/media/media-conversational-qualification-types"
import { evaluateQualificationState } from "@/lib/growth/media/media-conversational-session-utils"
import type {
  GrowthMediaBookingHandoffPreview,
  GrowthMediaBookingHandoffRecommendationRule,
  GrowthMediaBookingHandoffSignal,
} from "@/lib/growth/media/media-booking-handoff-types"
import type {
  GrowthMediaMeetingReadinessInput,
  GrowthMediaMeetingReadinessSnapshot,
  GrowthMediaMeetingReadinessTier,
} from "@/lib/growth/media/media-meeting-readiness-types"
import { applySharePageTemplateMergeFields } from "@/lib/growth/share-pages/share-page-template-instantiation-compile"
import { buildSharePageTemplatePreviewMergeValues } from "@/lib/growth/share-pages/share-page-template-preview-context"

export const GROWTH_MEDIA_BOOKING_HANDOFF_RULES: GrowthMediaBookingHandoffRecommendationRule[] = [
  {
    ruleId: "handoff-meeting-readiness-discovery",
    qualificationGoal: "meeting_readiness",
    readinessTier: "meeting_ready",
    recommendedMeetingType: "Discovery Call",
    recommendedDurationMinutes: 30,
    recommendedAttendees: ["account_executive", "prospect"],
    recommendedOwner: "account_executive",
    agendaTemplate:
      "Intro for {{prospect.name}} at {{company.name}} · current process · fit confirmation · next steps",
    nextSteps: ["Confirm attendee availability", "Send agenda for human review", "Prepare discovery notes"],
  },
  {
    ruleId: "handoff-high-intent-demo",
    qualificationGoal: "booking_recommendation",
    readinessTier: "high_intent",
    recommendedMeetingType: "Demo",
    recommendedDurationMinutes: 45,
    recommendedAttendees: ["account_executive", "solutions_consultant"],
    recommendedOwner: "account_executive",
    agendaTemplate:
      "Demo for {{prospect.name}} at {{company.name}} · priority use cases · stakeholder alignment · booking decision",
    nextSteps: ["Review demo scope with solutions consultant", "Validate economic buyer access", "Confirm demo timing"],
  },
  {
    ruleId: "handoff-buying-committee-multi-stakeholder",
    qualificationGoal: "buying_committee_discovery",
    readinessTier: "qualified",
    recommendedMeetingType: "Multi-stakeholder Meeting",
    recommendedDurationMinutes: 45,
    recommendedAttendees: ["account_executive", "prospect", "economic_buyer"],
    recommendedOwner: "account_executive",
    agendaTemplate:
      "Stakeholder discovery for {{company.name}} · committee map · decision process · success criteria",
    nextSteps: ["Identify missing stakeholders", "Draft committee coverage summary", "Route to owner for review"],
  },
  {
    ruleId: "handoff-fit-qualification",
    qualificationGoal: "fit_qualification",
    readinessTier: "qualified",
    recommendedMeetingType: "Fit Review Call",
    recommendedDurationMinutes: 30,
    recommendedAttendees: ["account_executive", "prospect"],
    recommendedOwner: "account_executive",
    agendaTemplate: "Fit review for {{prospect.name}} at {{company.name}} · pain points · ICP alignment",
    nextSteps: ["Capture fit score rationale", "Confirm qualification gaps", "Decide if meeting_ready threshold met"],
  },
  {
    ruleId: "handoff-next-best-action",
    qualificationGoal: "next_best_action",
    readinessTier: "early_interest",
    recommendedMeetingType: "Follow-up Call",
    recommendedDurationMinutes: 20,
    recommendedAttendees: ["account_executive", "prospect"],
    recommendedOwner: "account_executive",
    agendaTemplate: "Follow-up for {{prospect.name}} · blockers · preferred next step",
    nextSteps: ["Owner follow-up task", "Share relevant resource", "Reassess readiness after response"],
  },
]

function buildMergeValues(input: GrowthMediaMeetingReadinessInput): Record<string, string> {
  return buildSharePageTemplatePreviewMergeValues({
    prospectName: input.prospectName ?? "Prospect",
    companyName: input.companyName ?? "Company",
    senderName: "Sender",
    senderCompany: "Equipify",
    bookingLinkOverride: "",
    customMergeValues: {},
    analyticsPreviewMode: true,
    aiVideoPreviewMode: true,
    voiceClonePreviewMode: true,
    conversationalAgentPreviewMode: true,
    aiQaPreviewMode: true,
    bookingHandoffPreviewMode: true,
  })
}

function tierFromScores(input: {
  readinessScore: number
  qualificationGoal?: string | null
}): GrowthMediaMeetingReadinessTier {
  if (input.qualificationGoal === "booking_recommendation" && input.readinessScore >= 78) return "high_intent"
  if (input.readinessScore >= 75) return "meeting_ready"
  if (input.readinessScore >= 62) return "qualified"
  if (input.readinessScore >= 45) return "early_interest"
  return "not_ready"
}

export function evaluateMeetingReadiness(
  input: GrowthMediaMeetingReadinessInput,
): GrowthMediaMeetingReadinessSnapshot {
  const goal = input.qualificationGoal ?? null
  const qualification = evaluateQualificationState({
    qualificationGoal: goal,
    conversationContext: {
      prospectName: input.prospectName,
      companyName: input.companyName,
    },
  })

  const fitScore = qualification.qualificationState.fitScorePreview
  const meetingReadinessPreview = qualification.qualificationState.meetingReadinessPreview
  const buyingCommitteeCoverage =
    qualification.qualificationState.buyingCommitteeSignalPreview === "strong"
      ? 82
      : qualification.qualificationState.buyingCommitteeSignalPreview === "partial"
        ? 58
        : 24

  const qaConfidence = input.aiQaEnabled ? 68 : 35
  const conversationConfidence = input.conversationEnabled ? 72 : 40
  const engagementSignals = [
    input.conversationEnabled ? "conversational_agent_enabled" : null,
    input.aiQaEnabled ? "ai_qa_enabled" : null,
    input.bookingHandoffEnabled ? "booking_handoff_enabled" : null,
    qualification.qualificationState.nextBestActionPreview,
  ].filter((signal): signal is string => Boolean(signal))

  const readinessScore = Math.min(
    100,
    Math.round(
      fitScore * 0.3 +
        meetingReadinessPreview * 0.25 +
        buyingCommitteeCoverage * 0.15 +
        qaConfidence * 0.15 +
        conversationConfidence * 0.15,
    ),
  )

  const readinessTier = tierFromScores({ readinessScore, qualificationGoal: goal })

  return {
    fitScore,
    buyingCommitteeCoverage,
    decisionMakerIdentified:
      goal === "buying_committee_discovery" || goal === "booking_recommendation" || goal === "meeting_readiness",
    timelineKnown: goal === "meeting_readiness" || goal === "booking_recommendation",
    budgetKnown: false,
    meetingIntent:
      goal === "booking_recommendation"
        ? "decision"
        : goal === "meeting_readiness"
          ? "evaluation"
          : goal === "fit_qualification"
            ? "exploratory"
            : "unknown",
    engagementSignals,
    qaConfidence,
    conversationConfidence,
    readinessTier,
    readinessScore,
  }
}

export function resolveBookingHandoffRule(input: {
  qualificationGoal?: string | null
  readinessTier: GrowthMediaMeetingReadinessTier
}): GrowthMediaBookingHandoffRecommendationRule {
  const goal = input.qualificationGoal ?? "meeting_readiness"
  const exact =
    GROWTH_MEDIA_BOOKING_HANDOFF_RULES.find(
      (rule) => rule.qualificationGoal === goal && rule.readinessTier === input.readinessTier,
    ) ??
    GROWTH_MEDIA_BOOKING_HANDOFF_RULES.find((rule) => rule.qualificationGoal === goal) ??
    GROWTH_MEDIA_BOOKING_HANDOFF_RULES[0]
  return exact
}

export function buildRecommendedAttendees(input: {
  qualificationGoal?: string | null
  readiness: GrowthMediaMeetingReadinessSnapshot
}): string[] {
  return resolveBookingHandoffRule({
    qualificationGoal: input.qualificationGoal,
    readinessTier: input.readiness.readinessTier,
  }).recommendedAttendees
}

export function buildRecommendedAgenda(input: {
  qualificationGoal?: string | null
  readiness: GrowthMediaMeetingReadinessSnapshot
  prospectName?: string | null
  companyName?: string | null
  agendaTemplate?: string | null
}): string {
  const rule = resolveBookingHandoffRule({
    qualificationGoal: input.qualificationGoal,
    readinessTier: input.readiness.readinessTier,
  })
  const template = input.agendaTemplate?.trim() || rule.agendaTemplate
  return applySharePageTemplateMergeFields(template, buildMergeValues(input)).trim() || template
}

export function buildNextStepRecommendations(input: {
  qualificationGoal?: string | null
  readiness: GrowthMediaMeetingReadinessSnapshot
}): string[] {
  return resolveBookingHandoffRule({
    qualificationGoal: input.qualificationGoal,
    readinessTier: input.readiness.readinessTier,
  }).nextSteps
}

export function buildBookingRecommendation(input: {
  qualificationGoal?: string | null
  readiness: GrowthMediaMeetingReadinessSnapshot
}): {
  recommendedMeetingType: string
  recommendedDurationMinutes: number
  recommendedOwner: string
  bookingRecommendation: string
  rationale: string
  signals: GrowthMediaBookingHandoffSignal[]
  requiresHumanReview: boolean
} {
  const rule = resolveBookingHandoffRule({
    qualificationGoal: input.qualificationGoal,
    readinessTier: input.readiness.readinessTier,
  })
  const qualification = evaluateQualificationState({ qualificationGoal: input.qualificationGoal })
  const recommendBooking = qualification.meetingRecommendation.recommendBooking

  const signals: GrowthMediaBookingHandoffSignal[] = [
    { key: "fit_score", label: `Fit score ${input.readiness.fitScore}`, strength: input.readiness.fitScore >= 70 ? "high" : "medium" },
    {
      key: "readiness_score",
      label: `Readiness score ${input.readiness.readinessScore}`,
      strength: input.readiness.readinessScore >= 75 ? "high" : "medium",
    },
    {
      key: "committee_coverage",
      label: `Buying committee coverage ${input.readiness.buyingCommitteeCoverage}`,
      strength: input.readiness.buyingCommitteeCoverage >= 60 ? "medium" : "low",
    },
  ]

  const rationale = recommendBooking
    ? `${rule.recommendedMeetingType} recommended for ${input.readiness.readinessTier} readiness (foundation preview only; human review required).`
    : `Continue qualification before scheduling. Current tier: ${input.readiness.readinessTier}.`

  return {
    recommendedMeetingType: rule.recommendedMeetingType,
    recommendedDurationMinutes: rule.recommendedDurationMinutes,
    recommendedOwner: rule.recommendedOwner,
    bookingRecommendation: recommendBooking
      ? `Recommend ${rule.recommendedMeetingType} (${rule.recommendedDurationMinutes} min) with ${rule.recommendedAttendees.join(", ")}.`
      : "Do not schedule yet — gather additional qualification signals.",
    rationale,
    signals,
    requiresHumanReview: true,
  }
}

export function buildBookingPreview(input: GrowthMediaMeetingReadinessInput & {
  agendaTemplate?: string | null
}): GrowthMediaBookingHandoffPreview {
  const readiness = evaluateMeetingReadiness(input)
  const recommendation = buildBookingRecommendation({
    qualificationGoal: input.qualificationGoal,
    readiness,
  })

  return {
    readiness,
    recommendation: {
      recommendedMeetingType: recommendation.recommendedMeetingType,
      recommendedDurationMinutes: recommendation.recommendedDurationMinutes,
      recommendedAttendees: buildRecommendedAttendees({
        qualificationGoal: input.qualificationGoal,
        readiness,
      }),
      recommendedOwner: recommendation.recommendedOwner,
      recommendedAgenda: buildRecommendedAgenda({
        qualificationGoal: input.qualificationGoal,
        readiness,
        prospectName: input.prospectName,
        companyName: input.companyName,
        agendaTemplate: input.agendaTemplate,
      }),
      recommendedNextSteps: buildNextStepRecommendations({
        qualificationGoal: input.qualificationGoal,
        readiness,
      }),
      bookingRecommendation: recommendation.bookingRecommendation,
      signals: recommendation.signals,
      rationale: recommendation.rationale,
      requiresHumanReview: recommendation.requiresHumanReview,
    },
  }
}

export function validateBookingHandoffQualificationGoal(goal: string | null | undefined): boolean {
  if (!goal?.trim()) return true
  return validateConversationalQualificationGoal(goal)
}
