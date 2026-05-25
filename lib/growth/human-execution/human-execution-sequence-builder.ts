import type {
  HumanExecutionChannel,
  HumanExecutionReadinessResult,
  HumanExecutionSequencePlan,
  HumanExecutionSequenceRules,
  HumanExecutionSequenceStepDraft,
  HumanExecutionSequenceTemplate,
} from "@/lib/growth/human-execution/human-execution-types"
import {
  HUMAN_EXECUTION_SEQUENCE_TEMPLATE_LABELS,
} from "@/lib/growth/human-execution/human-execution-types"

export const DEFAULT_HUMAN_EXECUTION_SEQUENCE_RULES: HumanExecutionSequenceRules = {
  stopOnPositiveReply: true,
  pauseOnObjection: true,
  pauseOnMeetingBooked: true,
  fatigueProtection: true,
  minCooldownHours: 48,
  maxTouchesPerWeek: 3,
}

const STANDARD_SEQUENCE: HumanExecutionSequenceStepDraft[] = [
  { stepOrder: 0, dayOffset: 0, channel: "email", title: "Intro email", instructions: "Send personalized intro email.", cooldownHours: 48 },
  { stepOrder: 1, dayOffset: 3, channel: "manual_call", title: "Discovery call task", instructions: "Place a manual call and log outcome.", cooldownHours: 48 },
  { stepOrder: 2, dayOffset: 5, channel: "sms", title: "SMS follow-up", instructions: "Send approved SMS follow-up.", cooldownHours: 72 },
  { stepOrder: 3, dayOffset: 8, channel: "email", title: "Value follow-up email", instructions: "Send value-focused follow-up email.", cooldownHours: 48 },
  { stepOrder: 4, dayOffset: 14, channel: "manual_call", title: "Closing call task", instructions: "Attempt closing call with next-step ask.", cooldownHours: 72 },
]

const HIGH_TOUCH_SEQUENCE: HumanExecutionSequenceStepDraft[] = [
  { stepOrder: 0, dayOffset: 0, channel: "email", title: "Executive intro", instructions: "Send executive intro email.", cooldownHours: 24 },
  { stepOrder: 1, dayOffset: 1, channel: "manual_call", title: "Same-day call", instructions: "Call within 24 hours of intro.", cooldownHours: 24 },
  { stepOrder: 2, dayOffset: 3, channel: "linkedin_message", title: "LinkedIn touch", instructions: "Send approved LinkedIn message.", cooldownHours: 48 },
  { stepOrder: 3, dayOffset: 5, channel: "email", title: "Case study email", instructions: "Share relevant case study.", cooldownHours: 48 },
  { stepOrder: 4, dayOffset: 7, channel: "manual_call", title: "Follow-up call", instructions: "Confirm interest and next step.", cooldownHours: 48 },
]

const RE_ENGAGEMENT_SEQUENCE: HumanExecutionSequenceStepDraft[] = [
  { stepOrder: 0, dayOffset: 0, channel: "email", title: "Re-engagement email", instructions: "Re-open conversation with new angle.", cooldownHours: 72 },
  { stepOrder: 1, dayOffset: 4, channel: "manual_call", title: "Re-engagement call", instructions: "Attempt re-engagement call.", cooldownHours: 72 },
  { stepOrder: 2, dayOffset: 10, channel: "email", title: "Break-up email", instructions: "Send polite break-up email.", cooldownHours: 96 },
]

const MEETING_PUSH_SEQUENCE: HumanExecutionSequenceStepDraft[] = [
  { stepOrder: 0, dayOffset: 0, channel: "email", title: "Meeting invite email", instructions: "Propose meeting times.", cooldownHours: 24 },
  { stepOrder: 1, dayOffset: 1, channel: "manual_call", title: "Meeting confirmation call", instructions: "Confirm meeting interest by phone.", cooldownHours: 24 },
  { stepOrder: 2, dayOffset: 3, channel: "sms", title: "Meeting reminder SMS", instructions: "Send meeting scheduling reminder.", cooldownHours: 48 },
  { stepOrder: 3, dayOffset: 5, channel: "email", title: "Final meeting push", instructions: "Send final meeting scheduling email.", cooldownHours: 72 },
]

function sequenceForTemplate(template: HumanExecutionSequenceTemplate): HumanExecutionSequenceStepDraft[] {
  if (template === "high_touch") return HIGH_TOUCH_SEQUENCE
  if (template === "re_engagement") return RE_ENGAGEMENT_SEQUENCE
  if (template === "meeting_push") return MEETING_PUSH_SEQUENCE
  return STANDARD_SEQUENCE
}

export function resolveHumanExecutionSequenceTemplate(
  readiness: HumanExecutionReadinessResult,
  replyIntent?: string | null,
): HumanExecutionSequenceTemplate {
  if (replyIntent === "positive_interest" || replyIntent === "meeting_request") return "meeting_push"
  if (readiness.readinessBand === "critical" || readiness.readinessBand === "high") return "high_touch"
  if (readiness.signals.some((signal) => signal.key === "inactivity_risk")) return "re_engagement"
  return "standard_outreach"
}

export function buildHumanExecutionSequencePlan(
  templateKey: HumanExecutionSequenceTemplate,
  rules: HumanExecutionSequenceRules = DEFAULT_HUMAN_EXECUTION_SEQUENCE_RULES,
): HumanExecutionSequencePlan {
  return {
    templateKey,
    templateLabel: HUMAN_EXECUTION_SEQUENCE_TEMPLATE_LABELS[templateKey],
    rules,
    steps: sequenceForTemplate(templateKey),
  }
}

export function suggestNextSequenceChannel(
  steps: HumanExecutionSequenceStepDraft[],
  completedChannels: HumanExecutionChannel[],
): HumanExecutionChannel | null {
  const next = steps.find((step) => !completedChannels.includes(step.channel))
  return next?.channel ?? steps[0]?.channel ?? null
}

export function suggestNextSequenceTiming(
  steps: HumanExecutionSequenceStepDraft[],
  planStartAt: Date,
  completedStepOrders: number[],
): string | null {
  const next = steps.find((step) => !completedStepOrders.includes(step.stepOrder))
  if (!next) return null
  const due = new Date(planStartAt)
  due.setDate(due.getDate() + next.dayOffset)
  return due.toISOString()
}

export function shouldPauseSequenceForReply(
  replyIntent: string | null | undefined,
  rules: HumanExecutionSequenceRules,
): { pause: boolean; stop: boolean; reason: string | null } {
  if (!replyIntent) return { pause: false, stop: false, reason: null }
  if (rules.stopOnPositiveReply && (replyIntent === "positive_interest" || replyIntent === "meeting_request")) {
    return { pause: true, stop: true, reason: "Positive reply received — sequence stopped pending operator review." }
  }
  if (rules.pauseOnObjection && (replyIntent === "objection" || replyIntent === "not_interested")) {
    return { pause: true, stop: false, reason: "Objection detected — sequence paused for operator review." }
  }
  if (rules.pauseOnMeetingBooked && replyIntent === "meeting_request") {
    return { pause: true, stop: true, reason: "Meeting booked — sequence paused." }
  }
  return { pause: false, stop: false, reason: null }
}
