/** GE-AI-2K — Communication Engine (client-safe, deterministic). */

import type {
  GrowthCommunicationActionType,
  GrowthCommunicationChannel,
  GrowthCommunicationEngineContext,
  GrowthCommunicationEngineReadModel,
  GrowthCommunicationGoal,
  GrowthCommunicationPlan,
  GrowthCommunicationPlanStep,
  GrowthCommunicationPlanSubject,
  GrowthCommunicationStrategy,
} from "@/lib/growth/aios/communication/growth-communication-engine-types"
import {
  GROWTH_COMMUNICATION_CHANNELS,
  GROWTH_COMMUNICATION_ENGINE_QA_MARKER,
  GROWTH_COMMUNICATION_ENGINE_RANKING_FORMULA,
  GROWTH_COMMUNICATION_ENGINE_RUNTIME_RULE,
} from "@/lib/growth/aios/communication/growth-communication-engine-types"

export type GrowthCommunicationEngineInput = {
  organizationId: string
  subject: GrowthCommunicationPlanSubject
  goal?: GrowthCommunicationGoal
  context?: GrowthCommunicationEngineContext
  generatedAt: string
}

const CHANNEL_ACTION_MAP: Record<GrowthCommunicationChannel, GrowthCommunicationActionType> = {
  email: "send_email",
  sms: "send_sms",
  call: "place_call",
  voice_drop: "launch_voice_drop",
  ai_voice: "start_ai_voice",
  video: "send_video",
  sendr: "send_sendr_page",
  linkedin_manual: "create_linkedin_task",
  website: "wait",
  chat: "wait",
}

const OUTBOUND_ELIGIBLE_CHANNELS = new Set<GrowthCommunicationChannel>([
  "email",
  "sms",
  "voice_drop",
  "ai_voice",
  "video",
  "sendr",
  "linkedin_manual",
])

function stablePlanId(parts: Array<string | number | null | undefined>): string {
  const fingerprint = parts.map((part) => String(part ?? "")).join("|")
  let hash = 0
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash << 5) - hash + fingerprint.charCodeAt(index)
    hash |= 0
  }
  return `comm-plan-${Math.abs(hash).toString(36)}`
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

type ChannelScoreRow = {
  channel: GrowthCommunicationChannel
  score: number
  blocked: boolean
  blockReason: string | null
}

function isChannelPolicyBlocked(
  channel: GrowthCommunicationChannel,
  context: GrowthCommunicationEngineContext,
): { blocked: boolean; reason: string | null } {
  if (context.suppressionBlocked || context.optOutBlocked) {
    return { blocked: true, reason: "Suppression or opt-out active." }
  }
  if (channel === "ai_voice" && !context.aiVoiceExplicitlyAllowed) {
    return { blocked: true, reason: "AI Voice requires explicit scope approval." }
  }
  if (channel === "voice_drop" && !context.voiceDropCertified) {
    return { blocked: true, reason: "Voice drop not certified for this organization." }
  }
  if (context.scopeAllowedChannels && context.scopeAllowedChannels.length > 0) {
    if (!context.scopeAllowedChannels.includes(channel)) {
      return { blocked: true, reason: "Channel not in approved autonomous outbound scope." }
    }
  }
  if (context.emergencyStopActive) {
    return { blocked: true, reason: "Emergency stop active." }
  }
  if (context.autonomyOutboundEnabled === false || context.autonomyEnabled === false) {
    if (OUTBOUND_ELIGIBLE_CHANNELS.has(channel)) {
      return { blocked: true, reason: "Growth Autonomy outbound disabled." }
    }
  }
  if (channel === "email" && context.emailReady === false) {
    return { blocked: true, reason: "Email sender not ready." }
  }
  if (channel === "sms" && context.smsReady === false) {
    return { blocked: true, reason: "SMS sender not ready." }
  }
  if ((channel === "email" || channel === "sms") && context.senderReady === false) {
    return { blocked: true, reason: "Sender readiness check failed." }
  }
  return { blocked: false, reason: null }
}

function channelEngagementWeight(
  channel: GrowthCommunicationChannel,
  context: GrowthCommunicationEngineContext,
): number {
  const engagement = context.engagementScore ?? 50
  if (channel === "sms") {
    return engagement >= 65 ? 85 : engagement >= 40 ? 65 : 45
  }
  if (channel === "email") {
    return engagement >= 55 ? 80 : engagement >= 35 ? 60 : 50
  }
  if (channel === "video" || channel === "sendr") {
    return engagement >= 70 ? 75 : 40
  }
  if (channel === "call" || channel === "voice_drop") {
    return engagement >= 80 ? 70 : 35
  }
  if (channel === "linkedin_manual") {
    return 55
  }
  return 40
}

function channelReadinessWeight(
  channel: GrowthCommunicationChannel,
  context: GrowthCommunicationEngineContext,
): number {
  if (channel === "email") return context.emailReady === false ? 0 : 90
  if (channel === "sms") return context.smsReady === false ? 0 : 90
  if (channel === "voice_drop") return context.voiceDropCertified ? 80 : 0
  if (channel === "ai_voice") return context.aiVoiceExplicitlyAllowed ? 70 : 0
  if (channel === "sendr" || channel === "video") return 65
  if (channel === "linkedin_manual") return 60
  return 50
}

function channelSignalWeight(
  channel: GrowthCommunicationChannel,
  context: GrowthCommunicationEngineContext,
): number {
  if (context.replyReceived) {
    if (context.positiveIntent) {
      if (channel === "email" || channel === "call") return 90
      if (channel === "sms") return 75
      return 30
    }
    if (context.negativeIntent) return 10
    if (channel === "email") return 70
    return 50
  }
  if (context.meetingBooked) {
    if (channel === "email" || channel === "sms") return 85
    return 20
  }
  if (context.bounceDetected && channel === "email") return 5
  if (context.metaRecommendationType === "sms") return channel === "sms" ? 90 : 40
  if (context.metaRecommendationType === "email") return channel === "email" ? 90 : 40
  if (context.metaRecommendationType === "call") return channel === "call" ? 90 : 40
  if (context.metaRecommendationType === "video") {
    return channel === "video" || channel === "sendr" ? 85 : 40
  }
  return 50
}

export function scoreCommunicationChannel(
  channel: GrowthCommunicationChannel,
  context: GrowthCommunicationEngineContext,
): ChannelScoreRow {
  const policy = isChannelPolicyBlocked(channel, context)
  if (policy.blocked) {
    return { channel, score: -1, blocked: true, blockReason: policy.reason }
  }

  const engagementWeight = channelEngagementWeight(channel, context)
  const readinessWeight = channelReadinessWeight(channel, context)
  const policyWeight = 85
  const signalWeight = channelSignalWeight(channel, context)
  const weights = context.rankingWeights ?? {
    engagement: 0.3,
    readiness: 0.25,
    policy: 0.25,
    signal: 0.2,
  }

  const score = clampConfidence(
    engagementWeight * weights.engagement +
      readinessWeight * weights.readiness +
      policyWeight * (weights.policy / 0.25) * 0.25 +
      signalWeight * weights.signal,
  )

  return { channel, score, blocked: false, blockReason: null }
}

export function rankCommunicationChannels(
  context: GrowthCommunicationEngineContext,
): ChannelScoreRow[] {
  return GROWTH_COMMUNICATION_CHANNELS.map((channel) => scoreCommunicationChannel(channel, context))
    .filter((row) => !row.blocked)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return left.channel.localeCompare(right.channel)
    })
}

function resolveStrategyFromRanking(
  ranked: ChannelScoreRow[],
  context: GrowthCommunicationEngineContext,
): GrowthCommunicationStrategy {
  if (context.suppressionBlocked || context.optOutBlocked) return "do_not_contact"
  if (context.emergencyStopActive) return "human_review"
  if (context.negativeIntent) return "human_review"
  if (context.positiveIntent || context.meetingBooked) return "wait"
  if (ranked.length === 0) return "human_review"

  const top = ranked[0]
  const second = ranked[1]
  if (top && second && Math.abs(top.score - second.score) <= 5) {
    const pair = new Set([top.channel, second.channel])
    if (pair.has("email") && pair.has("sms")) return "multi_touch"
  }

  switch (top.channel) {
    case "sms":
      return "sms_first"
    case "email":
      return "email_first"
    case "call":
    case "voice_drop":
    case "ai_voice":
      return "call_first"
    case "video":
    case "sendr":
      return "video_first"
    case "linkedin_manual":
      return "multi_touch"
    default:
      return "multi_touch"
  }
}

function resolveGoal(
  input: GrowthCommunicationEngineInput,
  context: GrowthCommunicationEngineContext,
): GrowthCommunicationGoal {
  if (input.goal) return input.goal
  if (context.meetingBooked) return "confirm_meeting"
  if (context.positiveIntent) return "book_meeting"
  if (context.replyReceived) return "follow_up"
  if (context.negativeIntent) return "nurture"
  return "qualify"
}

function buildPlanSteps(input: {
  strategy: GrowthCommunicationStrategy
  ranked: ChannelScoreRow[]
  context: GrowthCommunicationEngineContext
}): GrowthCommunicationPlanStep[] {
  const { strategy, ranked, context } = input
  if (strategy === "do_not_contact" || strategy === "wait" || strategy === "human_review") {
    return [
      {
        stepNumber: 1,
        channel: "website",
        actionType: strategy === "human_review" ? "request_human_review" : "wait",
        timing: {
          mode: context.quietHoursActive ? "delay" : "immediate",
          delayHours: context.quietHoursActive ? 8 : undefined,
        },
        contentIntent:
          strategy === "do_not_contact"
            ? "Contact blocked by suppression or opt-out."
            : strategy === "human_review"
              ? "Operator review required before any outbound."
              : "Pause outbound — positive signal or meeting already booked.",
        requiresHumanApproval: true,
        requiredChecks: ["suppression", "opt_out", "growth_autonomy"],
      },
    ]
  }

  const primary = ranked[0]?.channel ?? "email"
  const secondary =
    ranked.find((row) => row.channel !== primary && row.channel !== "linkedin_manual")?.channel ??
    (primary === "email" ? "sms" : "email")
  const tertiary = ranked.find(
    (row) => row.channel !== primary && row.channel !== secondary && row.channel !== "linkedin_manual",
  )?.channel

  const primaryTiming = context.quietHoursActive
    ? { mode: "delay" as const, delayHours: 8 }
    : { mode: "immediate" as const }

  const steps: GrowthCommunicationPlanStep[] = [
    {
      stepNumber: 1,
      channel: primary,
      actionType: CHANNEL_ACTION_MAP[primary],
      timing: primaryTiming,
      contentIntent: `Primary ${primary} touch for ${strategy.replace(/_/g, " ")} strategy.`,
      requiresHumanApproval: OUTBOUND_ELIGIBLE_CHANNELS.has(primary),
      requiredChecks: ["suppression", "opt_out", "sender_readiness", "growth_autonomy"],
      fallbackIfBlocked: 2,
    },
  ]

  if (strategy === "multi_touch" || ranked.length > 1) {
    steps.push({
      stepNumber: 2,
      channel: secondary,
      actionType: CHANNEL_ACTION_MAP[secondary],
      timing: { mode: "after_event", afterEvent: "no_reply", delayHours: 48 },
      contentIntent: `Secondary ${secondary} follow-up after no reply.`,
      requiresHumanApproval: OUTBOUND_ELIGIBLE_CHANNELS.has(secondary),
      requiredChecks: ["suppression", "opt_out", "sender_readiness", "growth_autonomy"],
      fallbackIfBlocked: 3,
    })
  }

  if (tertiary && (strategy === "multi_touch" || ranked.length > 2)) {
    steps.push({
      stepNumber: 3,
      channel: tertiary,
      actionType:
        tertiary === "linkedin_manual" ? "create_linkedin_task" : CHANNEL_ACTION_MAP[tertiary],
      timing: { mode: "after_event", afterEvent: "no_reply", delayHours: 72 },
      contentIntent:
        tertiary === "linkedin_manual"
          ? "Manual LinkedIn task — operator execution only."
          : `Tertiary ${tertiary} escalation.`,
      requiresHumanApproval: true,
      requiredChecks: ["suppression", "growth_autonomy"],
      fallbackIfBlocked: steps.length + 1,
    })
  }

  const linkedInStepNumber = steps.length + 1
  if (
    !steps.some((step) => step.channel === "linkedin_manual") &&
    ranked.some((row) => row.channel === "linkedin_manual")
  ) {
    steps.push({
      stepNumber: linkedInStepNumber,
      channel: "linkedin_manual",
      actionType: "create_linkedin_task",
      timing: { mode: "after_event", afterEvent: "no_reply", delayHours: 96 },
      contentIntent: "Manual LinkedIn outreach task for operator queue.",
      requiresHumanApproval: true,
      requiredChecks: ["manual_execution_only"],
    })
  }

  const reviewStepNumber = steps.length + 1
  steps.push({
    stepNumber: reviewStepNumber,
    channel: "website",
    actionType: "request_human_review",
    timing: { mode: "after_event", afterEvent: "no_reply", delayHours: 120 },
    contentIntent: "Escalate to human review when automated touches underperform.",
    requiresHumanApproval: true,
    requiredChecks: ["human_approval_center"],
  })

  return steps
}

export function synthesizeGrowthCommunicationPlan(
  input: GrowthCommunicationEngineInput,
): GrowthCommunicationPlan {
  const context: GrowthCommunicationEngineContext = input.context ?? {}
  const goal = resolveGoal(input, context)
  const allScores = GROWTH_COMMUNICATION_CHANNELS.map((channel) =>
    scoreCommunicationChannel(channel, context),
  )
  const ranked = allScores
    .filter((row) => !row.blocked)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.channel.localeCompare(b.channel)
    })
  const blockedChannels = allScores
    .filter((row) => row.blocked)
    .map((row) => ({ channel: row.channel, reason: row.blockReason ?? "blocked" }))

  const recommendedStrategy = resolveStrategyFromRanking(ranked, context)
  const steps = buildPlanSteps({ strategy: recommendedStrategy, ranked, context })

  const fallbackStrategy = steps
    .filter((step) => step.fallbackIfBlocked !== undefined)
    .map((step) => ({
      fromStep: step.stepNumber,
      reason: "blocked" as const,
      toStep: step.fallbackIfBlocked!,
    }))

  if (recommendedStrategy !== "do_not_contact") {
    fallbackStrategy.push({
      fromStep: 1,
      reason: "no_reply",
      toStep: steps.length > 1 ? 2 : steps.length,
    })
    fallbackStrategy.push({
      fromStep: 2,
      reason: "low_engagement",
      toStep: steps.length,
    })
  }

  const allowedChannels = ranked.map((row) => row.channel)
  const averageScore =
    ranked.length > 0 ? ranked.reduce((sum, row) => sum + row.score, 0) / ranked.length : 0

  const evidence = [
    {
      source: "communication_engine",
      label: "Ranking formula",
      value: GROWTH_COMMUNICATION_ENGINE_RANKING_FORMULA,
    },
    {
      source: "engagement",
      label: "Engagement score",
      value: context.engagementScore ?? 50,
      confidence: clampConfidence(context.engagementScore ?? 50),
    },
    {
      source: "reply_intelligence",
      label: "Reply received",
      value: Boolean(context.replyReceived),
    },
    {
      source: "reply_intelligence",
      label: "Positive intent",
      value: Boolean(context.positiveIntent),
    },
    {
      source: "quiet_hours",
      label: "Quiet hours active",
      value: Boolean(context.quietHoursActive),
    },
    {
      source: "growth_autonomy",
      label: "Autonomy outbound enabled",
      value: context.autonomyOutboundEnabled !== false,
    },
    ...blockedChannels.map((row) => ({
      source: "channel_policy",
      label: `Blocked: ${row.channel}`,
      value: row.reason,
    })),
    ...ranked.slice(0, 3).map((row) => ({
      source: "channel_ranking",
      label: row.channel,
      value: row.score,
      confidence: row.score,
    })),
  ]

  const routeHints = [
    { label: "Human Approval Center", href: "/growth/os/approvals" },
    { label: "Growth Autonomy", href: "/growth/os/autonomy" },
  ]
  if (input.subject.type === "lead") {
    routeHints.push({
      label: "Lead workspace",
      href: `/growth/leads/${input.subject.id}`,
    })
  }

  return {
    id: stablePlanId([
      input.organizationId,
      input.subject.type,
      input.subject.id,
      input.generatedAt,
      recommendedStrategy,
      ranked.map((r) => r.channel).join(","),
    ]),
    organizationId: input.organizationId,
    subject: input.subject,
    goal,
    recommendedStrategy,
    steps,
    fallbackStrategy,
    stopConditions: {
      onReply: true,
      onPositiveIntent: true,
      onNegativeIntent: true,
      onOptOut: true,
      onMeetingBooked: true,
      onBounce: true,
      onManualPause: true,
    },
    policy: {
      requiresHumanApproval: true,
      autonomyCapability: "outreach_preparation",
      allowedChannels,
      blockedChannels,
    },
    evidence,
    confidence: clampConfidence(averageScore),
    routeHints,
    createdAt: input.generatedAt,
  }
}

export type GrowthCommunicationPlanSummary = {
  planId: string
  recommendedStrategy: GrowthCommunicationStrategy
  primaryChannel: GrowthCommunicationChannel | null
  fallbackChannel: GrowthCommunicationChannel | null
  blockedChannels: Array<{ channel: string; reason: string }>
  confidence: number
  requiresHumanApproval: boolean
  approvalRequiredSteps: number[]
  stopConditions: GrowthCommunicationPlan["stopConditions"]
}

export function summarizeGrowthCommunicationPlan(
  plan: GrowthCommunicationPlan,
): GrowthCommunicationPlanSummary {
  const primaryChannel = plan.steps[0]?.channel ?? null
  const fallbackChannel = plan.steps[1]?.channel ?? null
  return {
    planId: plan.id,
    recommendedStrategy: plan.recommendedStrategy,
    primaryChannel,
    fallbackChannel,
    blockedChannels: plan.policy.blockedChannels,
    confidence: plan.confidence,
    requiresHumanApproval: plan.policy.requiresHumanApproval,
    approvalRequiredSteps: plan.steps
      .filter((step) => step.requiresHumanApproval)
      .map((step) => step.stepNumber),
    stopConditions: plan.stopConditions,
  }
}

/** Maps plan primary channel to bounded outbound action when gates allow; otherwise fallback step. */
export function resolveBoundedOutboundActionFromPlan(input: {
  plan: GrowthCommunicationPlan
  scopeAllowedChannels: string[]
  gateBlockedChannels: string[]
}): {
  preferredChannel: GrowthCommunicationChannel | null
  preferredAction: GrowthCommunicationActionType | null
  usedFallback: boolean
  fallbackStep: number | null
} {
  for (const step of input.plan.steps) {
    if (step.actionType === "wait" || step.actionType === "request_human_review") continue
    const channelBlocked =
      input.gateBlockedChannels.includes(step.channel) ||
      (input.scopeAllowedChannels.length > 0 && !input.scopeAllowedChannels.includes(step.channel))
    if (!channelBlocked) {
      return {
        preferredChannel: step.channel,
        preferredAction: step.actionType,
        usedFallback: false,
        fallbackStep: null,
      }
    }
    if (step.fallbackIfBlocked) {
      const fallback = input.plan.steps.find((s) => s.stepNumber === step.fallbackIfBlocked)
      if (fallback && fallback.actionType !== "wait" && fallback.actionType !== "request_human_review") {
        const fallbackBlocked =
          input.gateBlockedChannels.includes(fallback.channel) ||
          (input.scopeAllowedChannels.length > 0 &&
            !input.scopeAllowedChannels.includes(fallback.channel))
        if (!fallbackBlocked) {
          return {
            preferredChannel: fallback.channel,
            preferredAction: fallback.actionType,
            usedFallback: true,
            fallbackStep: fallback.stepNumber,
          }
        }
      }
    }
  }
  return {
    preferredChannel: null,
    preferredAction: null,
    usedFallback: false,
    fallbackStep: null,
  }
}

export type GrowthCommunicationEngineBatchInput = {
  organizationId: string
  generatedAt: string
  subjects: Array<{
    subject: GrowthCommunicationPlanSubject
    goal?: GrowthCommunicationGoal
    context?: GrowthCommunicationEngineContext
  }>
}

export function synthesizeGrowthCommunicationEngineReadModel(
  input: GrowthCommunicationEngineBatchInput,
): GrowthCommunicationEngineReadModel {
  const plans = input.subjects.map((row) =>
    synthesizeGrowthCommunicationPlan({
      organizationId: input.organizationId,
      subject: row.subject,
      goal: row.goal,
      context: row.context,
      generatedAt: input.generatedAt,
    }),
  )

  const primaryStrategy = plans[0]?.recommendedStrategy ?? null
  const blockedChannelCount = plans.reduce(
    (sum, plan) => sum + plan.policy.blockedChannels.length,
    0,
  )
  const averageConfidence =
    plans.length > 0
      ? Math.round(plans.reduce((sum, plan) => sum + plan.confidence, 0) / plans.length)
      : 0
  const topChannel = plans[0]?.steps[0]?.channel ?? null

  return {
    readOnly: true,
    qaMarker: GROWTH_COMMUNICATION_ENGINE_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_COMMUNICATION_ENGINE_RUNTIME_RULE,
    rankingFormula: GROWTH_COMMUNICATION_ENGINE_RANKING_FORMULA,
    summary: {
      plansGenerated: plans.length,
      primaryStrategy,
      blockedChannelCount,
      averageConfidence,
      topChannel,
    },
    plans,
  }
}

export function buildCommunicationContextFromOutboundScope(input: {
  scopeAllowedChannels: string[]
  voiceDropCertified?: boolean
  aiVoiceExplicitlyAllowed?: boolean
  quietHoursActive?: boolean
  autonomyEnabled?: boolean
  autonomyOutboundEnabled?: boolean
  emergencyStopActive?: boolean
  engagementScore?: number
}): GrowthCommunicationEngineContext {
  return {
    scopeAllowedChannels: input.scopeAllowedChannels,
    voiceDropCertified: input.voiceDropCertified ?? false,
    aiVoiceExplicitlyAllowed: input.aiVoiceExplicitlyAllowed ?? false,
    quietHoursActive: input.quietHoursActive ?? false,
    autonomyEnabled: input.autonomyEnabled,
    autonomyOutboundEnabled: input.autonomyOutboundEnabled,
    emergencyStopActive: input.emergencyStopActive,
    engagementScore: input.engagementScore ?? 50,
    emailReady: input.scopeAllowedChannels.includes("email"),
    smsReady: input.scopeAllowedChannels.includes("sms"),
    senderReady: true,
  }
}
