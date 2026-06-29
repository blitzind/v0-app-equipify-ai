/**
 * GE-AIOS-SDR-1A — Unified Communication Strategy Engine.
 * Promotes GE-AI-2K Communication Engine to authoritative SDR strategy runtime.
 * Consumes IRE 7B–8B artifacts only — no duplicate qualification, scoring, or AI.
 * Read-only. Never executes.
 */

import {
  synthesizeGrowthCommunicationPlan,
  summarizeGrowthCommunicationPlan,
} from "@/lib/growth/aios/communication/growth-communication-engine-engine"
import type {
  GrowthCommunicationChannel,
  GrowthCommunicationEngineContext,
} from "@/lib/growth/aios/communication/growth-communication-engine-types"
import type { NextBestAction } from "@/lib/growth/contact-verification/next-best-action-types"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import type { RevenueExecutionPlan } from "@/lib/growth/contact-verification/revenue-execution-plan-types"
import type { SequenceRecommendation } from "@/lib/growth/contact-verification/sequence-recommendation-types"
import {
  COMMUNICATION_STRATEGY_ESCALATION_LADDER,
  GROWTH_COMMUNICATION_STRATEGY_QA_MARKER,
  type CommunicationStrategy,
  type CommunicationStrategyChannel,
  type CommunicationStrategyChannelCapabilities,
  type CommunicationStrategyEscalationStep,
  type CommunicationStrategyRecommendedAction,
  type CommunicationStrategyTouchHistory,
} from "@/lib/growth/contact-verification/communication-strategy-types"

export {
  COMMUNICATION_STRATEGY_ESCALATION_LADDER,
  GROWTH_COMMUNICATION_STRATEGY_QA_MARKER,
}

export type CommunicationStrategyEngineInput = {
  organizationId: string
  companyId: string
  generatedAt?: string
  qualification: ProspectQualification
  sequenceRecommendation: SequenceRecommendation
  nextBestAction: NextBestAction
  revenueExecutionPlan: RevenueExecutionPlan
  touchHistory?: CommunicationStrategyTouchHistory
  channelCapabilities?: CommunicationStrategyChannelCapabilities
  subjectId?: string
  subjectType?: "company" | "lead"
}

const CHANNEL_CAPABILITY_KEY: Record<
  Exclude<CommunicationStrategyChannel, "wait" | "stop" | "human">,
  keyof CommunicationStrategyChannelCapabilities
> = {
  email: "email",
  phone: "phone",
  sms: "sms",
  voice_drop: "voiceDrop",
  linkedin: "linkedin",
  video: "video",
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Math.max(0, Math.min(100, value)))
}

function mapEngineChannelToStrategy(channel: GrowthCommunicationChannel): CommunicationStrategyChannel {
  switch (channel) {
    case "email":
      return "email"
    case "call":
      return "phone"
    case "sms":
      return "sms"
    case "voice_drop":
      return "voice_drop"
    case "linkedin_manual":
      return "linkedin"
    case "video":
    case "sendr":
      return "video"
    case "website":
    case "chat":
    default:
      return "wait"
  }
}

function mapEngineActionToStrategy(
  channel: CommunicationStrategyChannel,
  action: string,
): CommunicationStrategyRecommendedAction {
  if (channel === "stop") return "stop"
  if (channel === "wait") return "wait"
  if (channel === "human") return "request_human_review"
  switch (action) {
    case "send_email":
      return "send_email"
    case "place_call":
      return "place_call"
    case "launch_voice_drop":
      return "launch_voice_drop"
    case "send_sms":
      return "send_sms"
    case "create_linkedin_task":
      return "create_linkedin_task"
    case "send_video":
      return "send_video"
    case "schedule_meeting":
      return "schedule_meeting"
    case "request_human_review":
      return "request_human_review"
    case "wait":
      return "wait"
    default:
      break
  }
  switch (channel) {
    case "email":
      return "send_email"
    case "phone":
      return "place_call"
    case "sms":
      return "send_sms"
    case "voice_drop":
      return "launch_voice_drop"
    case "linkedin":
      return "create_linkedin_task"
    case "video":
      return "send_video"
    default:
      return "wait"
  }
}

function defaultChannelCapabilities(
  qualification: ProspectQualification,
  overrides?: CommunicationStrategyChannelCapabilities,
): CommunicationStrategyChannelCapabilities {
  const acquisition = qualification.acquisitionCandidate
  const primary = acquisition.primaryContact
  const primaryPhone = (primary as { phone?: string | null }).phone
  const backupPhone = acquisition.backupContacts.find((contact) => contact.phone?.trim())?.phone
  return {
    email: Boolean(primary.email ?? acquisition.verification.emailVerified),
    phone: Boolean(primaryPhone ?? backupPhone),
    sms: Boolean(primaryPhone ?? backupPhone),
    voiceDrop: Boolean(primaryPhone ?? backupPhone),
    linkedin: Boolean((primary as { linkedinUrl?: string | null }).linkedinUrl),
    video: true,
    emailReady: overrides?.emailReady ?? true,
    smsReady: overrides?.smsReady ?? Boolean(primaryPhone ?? backupPhone),
    voiceDropCertified: overrides?.voiceDropCertified ?? true,
    ...overrides,
  }
}

function isChannelAvailable(
  channel: CommunicationStrategyChannel,
  capabilities: CommunicationStrategyChannelCapabilities,
): boolean {
  if (channel === "wait" || channel === "stop" || channel === "human") return true
  const key = CHANNEL_CAPABILITY_KEY[channel]
  if (capabilities[key] === false) return false
  if (channel === "email" && capabilities.emailReady === false) return false
  if (channel === "sms" && capabilities.smsReady === false) return false
  if (channel === "voice_drop" && capabilities.voiceDropCertified === false) return false
  return capabilities[key] !== false
}

function buildCommunicationEngineContext(input: {
  qualification: ProspectQualification
  nextBestAction: NextBestAction
  touchHistory: CommunicationStrategyTouchHistory
  capabilities: CommunicationStrategyChannelCapabilities
}): GrowthCommunicationEngineContext {
  const { qualification, nextBestAction, touchHistory, capabilities } = input
  const allowed: GrowthCommunicationChannel[] = []
  if (isChannelAvailable("email", capabilities)) allowed.push("email")
  if (isChannelAvailable("phone", capabilities)) allowed.push("call")
  if (isChannelAvailable("sms", capabilities)) allowed.push("sms")
  if (isChannelAvailable("voice_drop", capabilities)) allowed.push("voice_drop")
  if (isChannelAvailable("linkedin", capabilities)) allowed.push("linkedin_manual")
  if (isChannelAvailable("video", capabilities)) allowed.push("video")

  return {
    humanApprovalPlanningMode: true,
    suppressionBlocked: touchHistory.suppressed,
    optOutBlocked: touchHistory.unsubscribed,
    replyReceived: (touchHistory.emailReplyCount ?? 0) > 0,
    positiveIntent: touchHistory.positiveReply,
    negativeIntent: touchHistory.negativeReply || touchHistory.notInterested,
    meetingBooked: touchHistory.meetingBooked,
    engagementScore: touchHistory.engagementScore ?? qualification.engagementScore,
    emailReady: capabilities.emailReady !== false,
    smsReady: capabilities.smsReady !== false,
    voiceDropCertified: capabilities.voiceDropCertified !== false,
    senderReady: capabilities.emailReady !== false,
    scopeAllowedChannels: allowed,
    metaRecommendationType: nextBestAction.recommendedChannel,
  }
}

function resolveStopConditions(touchHistory: CommunicationStrategyTouchHistory): string[] {
  const stops: string[] = []
  if (touchHistory.suppressed) stops.push("Contact suppressed")
  if (touchHistory.unsubscribed) stops.push("Contact unsubscribed")
  if (touchHistory.notInterested) stops.push("Not interested")
  return stops
}

function resolveWaitConditions(
  touchHistory: CommunicationStrategyTouchHistory,
  nextBestAction: NextBestAction,
): string[] {
  const waits: string[] = []
  if (nextBestAction.action === "monitor_buying_signals") {
    waits.push("Monitor buying signals before next outreach")
  }
  if (touchHistory.waitPeriodElapsed) {
    waits.push("Wait period elapsed — eligible for retry")
  }
  return waits
}

/**
 * Touch-aware escalation index (SDR-1A v1).
 * Walks the standard ladder based on prior touches — deterministic, no AI.
 */
export function resolveCommunicationStrategyEscalationIndex(
  touchHistory: CommunicationStrategyTouchHistory,
): number {
  const emailSent = (touchHistory.emailSentCount ?? 0) > 0
  const emailReplied = (touchHistory.emailReplyCount ?? 0) > 0
  const daysSinceEmail = touchHistory.daysSinceLastEmail ?? 0
  const emailIgnored =
    emailSent &&
    !emailReplied &&
    (touchHistory.lastEmailNoReply === true || daysSinceEmail >= 4)

  if (!emailSent) return 0

  if (!emailIgnored) {
    if (touchHistory.positiveReply || touchHistory.meetingBooked) return 0
    return 0
  }

  if (!touchHistory.callAttempted) return 1

  if (touchHistory.callAttempted && !touchHistory.callConnected && touchHistory.callNoAnswer !== false) {
    if (!touchHistory.voiceDropSent) return 2
  }

  if (touchHistory.voiceDropSent) {
    const hours = touchHistory.hoursSinceVoiceDrop ?? 48
    if (hours >= 48 && (touchHistory.smsSentCount ?? 0) === 0) return 3
  }

  if ((touchHistory.smsSentCount ?? 0) > 0 && (touchHistory.smsReplyCount ?? 0) === 0) {
    if (!touchHistory.linkedinTaskCreated) return 4
  }

  if (touchHistory.linkedinTaskCreated && !touchHistory.waitPeriodElapsed) return 5

  if (touchHistory.waitPeriodElapsed) return 6

  if (touchHistory.linkedinTaskCreated) return 5

  if ((touchHistory.smsSentCount ?? 0) > 0) return 4

  if (touchHistory.voiceDropSent) return 3

  if (touchHistory.callAttempted) return 2

  return 1
}

function filterLadderByCapabilities(
  ladder: readonly CommunicationStrategyEscalationStep[],
  capabilities: CommunicationStrategyChannelCapabilities,
): CommunicationStrategyEscalationStep[] {
  return ladder.filter((step) => isChannelAvailable(step.channel, capabilities))
}

function mergeEngineInsightsIntoEscalationPlan(input: {
  standard: CommunicationStrategyEscalationStep[]
  engineSteps: CommunicationStrategyEscalationStep[]
}): CommunicationStrategyEscalationStep[] {
  const merged = [...input.standard]
  const channels = new Set(merged.map((step) => step.channel))
  for (const step of input.engineSteps) {
    if (step.channel === "human" || step.channel === "wait") continue
    if (!channels.has(step.channel)) {
      merged.push({
        ...step,
        order: merged.length + 1,
      })
      channels.add(step.channel)
    }
  }
  return merged.sort((a, b) => a.order - b.order)
}

function resolvePrimaryEscalationStep(input: {
  ladder: CommunicationStrategyEscalationStep[]
  escalationIndex: number
  capabilities: CommunicationStrategyChannelCapabilities
}): { primary: CommunicationStrategyEscalationStep; index: number } {
  if (input.ladder.length === 0) {
    return {
      primary: {
        order: 1,
        channel: "human",
        action: "request_human_review",
        trigger: "No outreach channels available",
      },
      index: 0,
    }
  }

  let index = Math.max(0, Math.min(input.escalationIndex, input.ladder.length - 1))
  for (let offset = 0; offset < input.ladder.length; offset += 1) {
    const candidateIndex = Math.min(index + offset, input.ladder.length - 1)
    const candidate = input.ladder[candidateIndex]
    if (isChannelAvailable(candidate.channel, input.capabilities)) {
      return { primary: candidate, index: candidateIndex }
    }
  }

  return { primary: input.ladder[0], index: 0 }
}

function resolveIreTerminalStrategy(input: {
  qualification: ProspectQualification
  nextBestAction: NextBestAction
  revenueExecutionPlan: RevenueExecutionPlan
  touchHistory: CommunicationStrategyTouchHistory
  generatedAt: string
  companyId: string
}): CommunicationStrategy | null {
  const { qualification, nextBestAction, revenueExecutionPlan, touchHistory, generatedAt, companyId } =
    input

  if (
    qualification.qualification === "disqualified" ||
    nextBestAction.action === "disqualify" ||
    touchHistory.notInterested
  ) {
    return {
      version: 1,
      qa_marker: GROWTH_COMMUNICATION_STRATEGY_QA_MARKER,
      companyId,
      generatedAt,
      primaryChannel: "stop",
      fallbackChannels: [],
      recommendedAction: "stop",
      reasoning: ["Account disqualified — stop outreach"],
      escalationPlan: [],
      stopConditions: ["Disqualified account", ...resolveStopConditions(touchHistory)],
      waitConditions: [],
      confidence: nextBestAction.confidence,
      requiresHumanApproval: false,
      communicationPlanId: null,
      source: "communication_strategy_engine",
    }
  }

  if (touchHistory.negativeReply || touchHistory.notInterested) {
    return {
      version: 1,
      qa_marker: GROWTH_COMMUNICATION_STRATEGY_QA_MARKER,
      companyId,
      generatedAt,
      primaryChannel: "stop",
      fallbackChannels: [],
      recommendedAction: "stop",
      reasoning: ["Negative reply — stop automated outreach"],
      escalationPlan: [],
      stopConditions: ["Negative reply", ...resolveStopConditions(touchHistory)],
      waitConditions: [],
      confidence: nextBestAction.confidence,
      requiresHumanApproval: true,
      communicationPlanId: null,
      source: "communication_strategy_engine",
    }
  }

  if (touchHistory.positiveReply || touchHistory.meetingBooked) {
    return {
      version: 1,
      qa_marker: GROWTH_COMMUNICATION_STRATEGY_QA_MARKER,
      companyId,
      generatedAt,
      primaryChannel: "human",
      fallbackChannels: ["email"],
      recommendedAction: "schedule_meeting",
      reasoning: ["Positive engagement — prioritize meeting scheduling"],
      escalationPlan: [
        {
          order: 1,
          channel: "human",
          action: "schedule_meeting",
          trigger: "Positive reply or meeting intent detected",
        },
      ],
      stopConditions: resolveStopConditions(touchHistory),
      waitConditions: [],
      confidence: clampConfidence(nextBestAction.confidence + 10),
      requiresHumanApproval: true,
      communicationPlanId: null,
      source: "communication_strategy_engine",
    }
  }

  if (
    nextBestAction.action === "manual_review" ||
    nextBestAction.action === "verify_contact" ||
    revenueExecutionPlan.executionMode === "human_review"
  ) {
    return {
      version: 1,
      qa_marker: GROWTH_COMMUNICATION_STRATEGY_QA_MARKER,
      companyId,
      generatedAt,
      primaryChannel: "human",
      fallbackChannels: [],
      recommendedAction: "request_human_review",
      reasoning: [
        `IRE next action: ${nextBestAction.action.replace(/_/g, " ")}`,
        ...nextBestAction.reasons.slice(0, 2),
      ],
      escalationPlan: [
        {
          order: 1,
          channel: "human",
          action: "request_human_review",
          trigger: "Operator review required before outreach",
        },
      ],
      stopConditions: resolveStopConditions(touchHistory),
      waitConditions: resolveWaitConditions(touchHistory, nextBestAction),
      confidence: nextBestAction.confidence,
      requiresHumanApproval: true,
      communicationPlanId: null,
      source: "communication_strategy_engine",
    }
  }

  if (
    nextBestAction.action === "research_company" ||
    nextBestAction.action === "identify_decision_maker" ||
    nextBestAction.action === "monitor_buying_signals"
  ) {
    return {
      version: 1,
      qa_marker: GROWTH_COMMUNICATION_STRATEGY_QA_MARKER,
      companyId,
      generatedAt,
      primaryChannel: "wait",
      fallbackChannels: [],
      recommendedAction: "wait",
      reasoning: [
        `IRE next action: ${nextBestAction.action.replace(/_/g, " ")}`,
        ...nextBestAction.reasons.slice(0, 2),
      ],
      escalationPlan: [
        {
          order: 1,
          channel: "wait",
          action: "wait",
          trigger: "Complete research or monitoring before outreach",
          delayHours: nextBestAction.recommendedDelayHours ?? 72,
        },
      ],
      stopConditions: resolveStopConditions(touchHistory),
      waitConditions: resolveWaitConditions(touchHistory, nextBestAction),
      confidence: nextBestAction.confidence,
      requiresHumanApproval: false,
      communicationPlanId: null,
      source: "communication_strategy_engine",
    }
  }

  if (touchHistory.suppressed || touchHistory.unsubscribed) {
    return {
      version: 1,
      qa_marker: GROWTH_COMMUNICATION_STRATEGY_QA_MARKER,
      companyId,
      generatedAt,
      primaryChannel: "stop",
      fallbackChannels: [],
      recommendedAction: "stop",
      reasoning: ["Suppression or opt-out active"],
      escalationPlan: [],
      stopConditions: resolveStopConditions(touchHistory),
      waitConditions: [],
      confidence: 0,
      requiresHumanApproval: false,
      communicationPlanId: null,
      source: "communication_strategy_engine",
    }
  }

  return null
}

function mapPlanStepsToEscalation(
  steps: Array<{
    stepNumber: number
    channel: GrowthCommunicationChannel
    actionType: string
    timing: { delayHours?: number; afterEvent?: string }
    contentIntent?: string
  }>,
): CommunicationStrategyEscalationStep[] {
  return steps
    .filter((step) => step.actionType !== "request_human_review" || step.channel !== "website")
    .map((step) => {
      const channel = mapEngineChannelToStrategy(step.channel)
      return {
        order: step.stepNumber,
        channel,
        action: mapEngineActionToStrategy(channel, step.actionType),
        trigger: step.contentIntent ?? `${channel} touch`,
        delayHours: step.timing.delayHours,
        afterEvent: step.timing.afterEvent,
      }
    })
}

/**
 * Primary export — builds one authoritative communication strategy from canonical IRE artifacts.
 */
export function buildCommunicationStrategy(
  input: CommunicationStrategyEngineInput,
): CommunicationStrategy {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const touchHistory: CommunicationStrategyTouchHistory = input.touchHistory ?? {}
  const capabilities = defaultChannelCapabilities(input.qualification, input.channelCapabilities)

  const terminal = resolveIreTerminalStrategy({
    qualification: input.qualification,
    nextBestAction: input.nextBestAction,
    revenueExecutionPlan: input.revenueExecutionPlan,
    touchHistory,
    generatedAt,
    companyId: input.companyId,
  })
  if (terminal) return terminal

  const engineContext = buildCommunicationEngineContext({
    qualification: input.qualification,
    nextBestAction: input.nextBestAction,
    touchHistory,
    capabilities,
  })

  const communicationPlan = synthesizeGrowthCommunicationPlan({
    organizationId: input.organizationId,
    subject: {
      type: input.subjectType ?? "company",
      id: input.subjectId ?? input.companyId,
    },
    goal: input.nextBestAction.action === "enroll_sequence" ? "qualify" : "follow_up",
    context: engineContext,
    generatedAt,
  })

  const planSummary = summarizeGrowthCommunicationPlan(communicationPlan)
  const engineEscalation = mapPlanStepsToEscalation(communicationPlan.steps)
  const availableLadder = filterLadderByCapabilities(
    COMMUNICATION_STRATEGY_ESCALATION_LADDER,
    capabilities,
  )
  const escalationPlan = mergeEngineInsightsIntoEscalationPlan({
    standard: availableLadder,
    engineSteps: engineEscalation,
  })

  const escalationIndex = resolveCommunicationStrategyEscalationIndex(touchHistory)
  const { primary, index } = resolvePrimaryEscalationStep({
    ladder: availableLadder.length > 0 ? availableLadder : escalationPlan,
    escalationIndex,
    capabilities,
  })

  const fallbackChannels = availableLadder
    .slice(index + 1)
    .map((step) => step.channel)
    .filter((channel, idx, arr) => arr.indexOf(channel) === idx)

  const reasoning = [
    `IRE qualification: ${input.qualification.qualification}`,
    `Sequence: ${input.sequenceRecommendation.recommendedSequence.name}`,
    `Next best action: ${input.nextBestAction.action.replace(/_/g, " ")}`,
    `Escalation step ${index + 1}/${escalationPlan.length}: ${primary.trigger}`,
    `Communication Engine strategy: ${communicationPlan.recommendedStrategy.replace(/_/g, " ")}`,
  ]

  if ((touchHistory.emailSentCount ?? 0) > 0 && (touchHistory.emailReplyCount ?? 0) === 0) {
    reasoning.push("Prior email without reply — escalating channel")
  }

  const confidence = clampConfidence(
    input.nextBestAction.confidence * 0.35 +
      input.sequenceRecommendation.confidence * 0.25 +
      input.qualification.confidence * 0.2 +
      planSummary.confidence * 0.2,
  )

  return {
    version: 1,
    qa_marker: GROWTH_COMMUNICATION_STRATEGY_QA_MARKER,
    companyId: input.companyId,
    generatedAt,
    primaryChannel: primary.channel,
    fallbackChannels,
    recommendedAction: primary.action,
    reasoning,
    escalationPlan,
    stopConditions: [
      ...resolveStopConditions(touchHistory),
      ...communicationPlan.stopConditions.onOptOut ? ["Opt-out"] : [],
      ...communicationPlan.stopConditions.onNegativeIntent ? ["Negative intent"] : [],
    ],
    waitConditions: resolveWaitConditions(touchHistory, input.nextBestAction),
    confidence,
    requiresHumanApproval: primary.action !== "wait" && primary.action !== "stop",
    communicationPlanId: communicationPlan.id,
    source: "communication_strategy_engine",
  }
}

export function buildCommunicationStrategyFromNativeStack(input: {
  organizationId: string
  companyId: string
  generatedAt?: string
  qualification: ProspectQualification
  sequenceRecommendation: SequenceRecommendation
  nextBestAction: NextBestAction
  revenueExecutionPlan: RevenueExecutionPlan
  touchHistory?: CommunicationStrategyTouchHistory
  channelCapabilities?: CommunicationStrategyChannelCapabilities
  subjectId?: string
  subjectType?: "company" | "lead"
}): CommunicationStrategy {
  return buildCommunicationStrategy(input)
}
