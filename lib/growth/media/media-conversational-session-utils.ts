/** Growth Engine S2-H — client-safe conversational session helpers (no provider execution). */

import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import {
  getConversationalAgentById,
  validateConversationalAgentId,
} from "@/lib/growth/media/media-conversational-agent-types"
import type {
  GrowthMediaConversationalContext,
  GrowthMediaConversationalMeetingRecommendation,
  GrowthMediaConversationalPromptPreview,
  GrowthMediaConversationalQualificationPreview,
  GrowthMediaConversationalQualificationState,
} from "@/lib/growth/media/media-conversational-session-types"
import {
  getConversationalQualificationByGoal,
  validateConversationalQualificationGoal,
  type GrowthMediaConversationalQualificationDefinition,
} from "@/lib/growth/media/media-conversational-qualification-types"
import { applySharePageTemplateMergeFields } from "@/lib/growth/share-pages/share-page-template-instantiation-compile"
import { buildSharePageTemplatePreviewMergeValues } from "@/lib/growth/share-pages/share-page-template-preview-context"

function buildMergeValues(context: GrowthMediaConversationalContext): Record<string, string> {
  return buildSharePageTemplatePreviewMergeValues({
    prospectName: context.prospectName ?? "Prospect",
    companyName: context.companyName ?? "Company",
    senderName: context.senderName ?? "Sender",
    senderCompany: context.senderCompany ?? "Equipify",
    bookingLinkOverride: "",
    customMergeValues: context.customMergeValues ?? {},
    analyticsPreviewMode: true,
    aiVideoPreviewMode: true,
    voiceClonePreviewMode: true,
    conversationalAgentPreviewMode: true,
    aiQaPreviewMode: true,
    bookingHandoffPreviewMode: true,
  })
}

function resolvePromptTemplate(input: {
  systemPromptTemplate?: string | null
  agentId?: string | null
  conversationContext?: GrowthMediaConversationalContext
}): string {
  const trimmedTemplate = input.systemPromptTemplate?.trim()
  if (trimmedTemplate) return trimmedTemplate
  const agent = getConversationalAgentById(input.agentId)
  return agent?.systemPrompt ?? "You are a helpful conversational agent for {{prospect.name}} at {{company.name}}."
}

export function buildConversationPreview(input: {
  agentId?: string | null
  systemPromptTemplate?: string | null
  conversationContext?: GrowthMediaConversationalContext
  fallbackText?: string
}): GrowthMediaConversationalPromptPreview {
  const template = resolvePromptTemplate(input)
  const mergeFieldsUsed = extractContentMergeFields(template)
  const mergeValues = buildMergeValues(input.conversationContext ?? {})
  const resolved = applySharePageTemplateMergeFields(template, mergeValues).trim()
  const hasUnresolvedTokens = /\{\{/.test(resolved)
  const fallback = input.fallbackText?.trim() || "Conversational agent prompt preview"
  return {
    systemPromptTemplate: template,
    resolvedPrompt: hasUnresolvedTokens ? fallback : resolved || fallback,
    mergeFieldsUsed,
    usedFallback: hasUnresolvedTokens || !resolved,
  }
}

export function buildQualificationPreview(input: {
  qualificationGoal?: string | null
}): GrowthMediaConversationalQualificationPreview {
  const qualification = getConversationalQualificationByGoal(input.qualificationGoal)
  if (!qualification) {
    return {
      qualificationId: null,
      goal: input.qualificationGoal ?? null,
      questions: [],
      requiredAnswers: [],
      disqualifiers: [],
      bookingCriteria: null,
      steps: [],
    }
  }

  return {
    qualificationId: qualification.qualificationId,
    goal: qualification.goal,
    questions: qualification.questions,
    requiredAnswers: qualification.requiredAnswers,
    disqualifiers: qualification.disqualifiers,
    bookingCriteria: qualification.bookingCriteria,
    steps: qualification.questions.map((question, index) => ({
      id: `${qualification.qualificationId}-step-${index + 1}`,
      label: question,
      status: "preview" as const,
    })),
  }
}

export function evaluateQualificationState(input: {
  qualificationGoal?: string | null
  conversationContext?: GrowthMediaConversationalContext
}): {
  qualificationState: GrowthMediaConversationalQualificationState
  meetingRecommendation: GrowthMediaConversationalMeetingRecommendation
} {
  const qualification = getConversationalQualificationByGoal(input.qualificationGoal)
  const goal = input.qualificationGoal ?? qualification?.goal ?? null
  const fitScorePreview =
    goal === "fit_qualification"
      ? 72
      : goal === "meeting_readiness"
        ? 68
        : goal === "booking_recommendation"
          ? 70
          : 58
  const meetingReadinessPreview =
    goal === "booking_recommendation" ? 78 : goal === "meeting_readiness" ? 74 : 52
  const buyingCommitteeSignalPreview: GrowthMediaConversationalQualificationState["buyingCommitteeSignalPreview"] =
    goal === "buying_committee_discovery" ? "partial" : goal === "booking_recommendation" ? "strong" : "none"

  const qualificationState: GrowthMediaConversationalQualificationState = {
    qualificationId: qualification?.qualificationId ?? null,
    goal,
    answeredQuestions: [],
    missingRequiredAnswers: qualification?.requiredAnswers ?? [],
    disqualifiersTriggered: [],
    fitScorePreview,
    meetingReadinessPreview,
    buyingCommitteeSignalPreview,
    nextBestActionPreview:
      goal === "next_best_action"
        ? "owner_follow_up"
        : goal === "booking_recommendation"
          ? "schedule_demo"
          : "continue_qualification",
  }

  const criteria = qualification?.bookingCriteria
  const recommendBooking =
    criteria != null &&
    fitScorePreview >= criteria.minimumFitScore &&
    meetingReadinessPreview >= criteria.minimumMeetingReadinessScore &&
    criteria.recommendBookingWhenMet

  const meetingRecommendation: GrowthMediaConversationalMeetingRecommendation = {
    recommendBooking,
    rationale: recommendBooking
      ? "Preview thresholds met for booking recommendation (deterministic foundation preview only)."
      : "Continue qualification — booking criteria not met in preview mode.",
    suggestedAttendees: recommendBooking ? ["prospect", "operations_lead"] : [],
    readinessTier: recommendBooking
      ? "ready"
      : meetingReadinessPreview >= 60
        ? "warming"
        : "not_ready",
  }

  return { qualificationState, meetingRecommendation }
}

export function validateConversationalSessionAgentAndGoal(input: {
  agentId?: string | null
  qualificationGoal?: string | null
}): boolean {
  if (input.agentId && !validateConversationalAgentId(input.agentId)) return false
  if (input.qualificationGoal && !validateConversationalQualificationGoal(input.qualificationGoal)) return false
  return true
}

export function getDefaultQualificationDefinition(
  goal: string | null | undefined,
): GrowthMediaConversationalQualificationDefinition | null {
  return getConversationalQualificationByGoal(goal)
}

/** S2-J bridge — conversational qualification → booking handoff preview (no calendar execution). */
export { buildBookingPreview as buildConversationalBookingHandoffPreview } from "@/lib/growth/media/media-booking-handoff-utils"
