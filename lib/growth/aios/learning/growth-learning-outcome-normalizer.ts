/** GE-AI-3D — Normalize canonical Event Bus events into learning outcomes (client-safe). */

import type { AiOsEvent } from "@/lib/growth/aios/ai-event-types"
import { GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES } from "@/lib/growth/aios/communication/growth-communication-engine-types"
import { GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import { GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import { GROWTH_DAILY_WORK_QUEUE_LEARNING_EVENT } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import {
  mapRevenueOutcomeToLearning,
  resolveRevenueOutcomeLearningChannel,
} from "@/lib/growth/revenue-outcomes/revenue-outcome-learning-map"
import {
  GROWTH_REVENUE_OUTCOME_EVENT,
  type RevenueOutcomeChannel,
  type RevenueOutcomeResult,
} from "@/lib/growth/revenue-outcomes/revenue-outcome-types"
import { GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES } from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-types"
import type {
  GrowthLearningChannel,
  GrowthLearningOutcome,
  GrowthLearningOutcomeSource,
  GrowthLearningOutcomeType,
  GrowthLearningSubjectType,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"

export function buildLearningOutcomeId(organizationId: string, eventId: string): string {
  return `learning-outcome:${organizationId}:${eventId}`
}

function subjectFromEvent(event: AiOsEvent): { type: GrowthLearningSubjectType; id: string } {
  const entityType = String(event.entityType ?? "lead")
  const entityId = String(event.entityId ?? event.correlationId ?? event.organizationId)
  const allowed: GrowthLearningSubjectType[] = [
    "lead",
    "person",
    "company",
    "customer",
    "objective",
    "mission",
    "campaign",
    "sequence",
    "scope",
    "workflow_request",
  ]
  const type = allowed.includes(entityType as GrowthLearningSubjectType)
    ? (entityType as GrowthLearningSubjectType)
    : "lead"
  return { type, id: entityId }
}

function channelFromPayload(payload: Record<string, unknown>): GrowthLearningChannel | undefined {
  const raw = String(payload.channel ?? payload.action_channel ?? payload.touch_channel ?? "")
  const allowed: GrowthLearningChannel[] = [
    "email",
    "sms",
    "call",
    "voice_drop",
    "ai_voice",
    "video",
    "sendr",
    "linkedin_manual",
    "website",
    "chat",
  ]
  return allowed.includes(raw as GrowthLearningChannel) ? (raw as GrowthLearningChannel) : undefined
}

function baseOutcome(
  event: AiOsEvent,
  input: {
    source: GrowthLearningOutcomeSource
    outcomeType: GrowthLearningOutcomeType
    signalStrength: number
    confidence: number
    related?: GrowthLearningOutcome["related"]
    dimensions?: GrowthLearningOutcome["dimensions"]
    evidence?: GrowthLearningOutcome["evidence"]
  },
): GrowthLearningOutcome {
  const occurredAt = event.occurredAt ?? event.createdAt ?? new Date().toISOString()
  return {
    id: buildLearningOutcomeId(event.organizationId, event.id),
    organizationId: event.organizationId,
    source: input.source,
    outcomeType: input.outcomeType,
    subject: subjectFromEvent(event),
    related: input.related ?? {},
    signalStrength: input.signalStrength,
    confidence: input.confidence,
    dimensions: input.dimensions ?? {},
    evidence: input.evidence ?? [
      { source: "event_bus", label: "eventType", value: event.eventType, confidence: 0.9 },
    ],
    occurredAt,
    createdAt: new Date().toISOString(),
  }
}

export function normalizeLearningOutcomeFromEvent(event: AiOsEvent): GrowthLearningOutcome | null {
  const payload = event.payload ?? {}

  if (event.eventType === GROWTH_REVENUE_OUTCOME_EVENT) {
    const channel = String(payload.channel ?? "email") as RevenueOutcomeChannel
    const outcome = String(payload.outcome ?? "completed") as RevenueOutcomeResult
    const mapped = mapRevenueOutcomeToLearning({ channel, outcome })
    const learningChannel = resolveRevenueOutcomeLearningChannel(channel)
    return baseOutcome(event, {
      source: mapped.source,
      outcomeType: mapped.outcomeType,
      signalStrength: mapped.signalStrength,
      confidence:
        typeof payload.confidence === "number"
          ? payload.confidence > 1
            ? payload.confidence / 100
            : payload.confidence
          : 0.82,
      related: {
        campaignId: typeof payload.campaign_id === "string" ? payload.campaign_id : undefined,
        sequenceId: typeof payload.sequence_id === "string" ? payload.sequence_id : undefined,
        taskKey: typeof payload.execution_id === "string" ? payload.execution_id : undefined,
      },
      dimensions: learningChannel ? { channel: learningChannel } : {},
      evidence: [
        { source: "revenue_outcome", label: "runtime", value: String(payload.runtime ?? "") },
        { source: "revenue_outcome", label: "action", value: String(payload.action ?? "") },
        { source: "revenue_outcome", label: "outcome", value: outcome },
      ],
    })
  }

  if (event.eventType === GROWTH_DAILY_WORK_QUEUE_LEARNING_EVENT) {
    const channel = channelFromPayload(payload)
    const outcomeTypeRaw = String(payload.outcome_type ?? "")
    const outcomeRaw = String(payload.outcome ?? "completed")
    const outcomeType: GrowthLearningOutcomeType =
      outcomeTypeRaw === "meeting_booked"
        ? "meeting_booked"
        : outcomeTypeRaw === "disqualified"
          ? "rejected"
          : outcomeRaw === "failed"
            ? "failed"
            : outcomeRaw === "skipped"
              ? "cancelled"
              : "completed"
    const sourceMap: Record<string, GrowthLearningOutcomeSource> = {
      email: "email",
      call: "call",
      sms: "sms",
      voice_drop: "voice_drop",
      video: "video",
      linkedin_manual: "email",
    }
    const source = channel ? (sourceMap[channel] ?? "workflow_agent") : "workflow_agent"
    return baseOutcome(event, {
      source,
      outcomeType,
      signalStrength: outcomeType === "meeting_booked" ? 0.9 : 0.78,
      confidence: typeof payload.confidence === "number" ? payload.confidence / 100 : 0.82,
      related: {
        taskKey: typeof payload.task_key === "string" ? payload.task_key : undefined,
      },
      dimensions: channel ? { channel } : {},
      evidence: [
        { source: "daily_work_queue", label: "action", value: String(payload.action ?? "") },
        { source: "daily_work_queue", label: "priority", value: String(payload.priority ?? "") },
      ],
    })
  }

  if (event.eventType === GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES.completed) {
    return baseOutcome(event, {
      source: "revenue_director",
      outcomeType: "completed",
      signalStrength: 0.85,
      confidence: 0.9,
      related: {
        workflowRequestId:
          typeof payload.workflowRequestId === "string" ? payload.workflowRequestId : undefined,
      },
      evidence: [
        { source: "revenue_director", label: "correlation", value: "completed" },
        ...(Array.isArray(payload.evidence) ? (payload.evidence as GrowthLearningOutcome["evidence"]) : []),
      ],
    })
  }

  if (event.eventType === GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES.failed) {
    return baseOutcome(event, {
      source: "revenue_director",
      outcomeType: "failed",
      signalStrength: 0.8,
      confidence: 0.88,
      related: {
        workflowRequestId:
          typeof payload.workflowRequestId === "string" ? payload.workflowRequestId : undefined,
      },
    })
  }

  if (event.eventType === GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT) {
    const workflowStatus = String(payload.workflow_status ?? "")
    if (!workflowStatus) return null
    const failed = workflowStatus === "blocked" || workflowStatus === "failed"
    return baseOutcome(event, {
      source: "workflow_agent",
      outcomeType: failed ? "failed" : "completed",
      signalStrength: failed ? 0.7 : 0.75,
      confidence: 0.82,
      evidence: [{ source: "research_agent", label: "workflow_status", value: workflowStatus }],
    })
  }

  if (event.eventType === GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT) {
    const qualificationStatus = String(payload.qualification_status ?? "")
    const failed = qualificationStatus === "failed" || qualificationStatus === "blocked"
    return baseOutcome(event, {
      source: "workflow_agent",
      outcomeType: failed ? "failed" : "completed",
      signalStrength: 0.78,
      confidence: 0.84,
      evidence: [{ source: "qualification_agent", label: "qualification_status", value: qualificationStatus }],
    })
  }

  if (event.eventType === GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT) {
    const observationThemeKey =
      typeof payload.observation_theme_key === "string" ? payload.observation_theme_key : undefined
    const businessPressureKey =
      typeof payload.business_pressure_key === "string" ? payload.business_pressure_key : undefined
    const discoveryQuestionTheme =
      typeof payload.discovery_question_theme === "string"
        ? payload.discovery_question_theme
        : undefined
    const revenueStrategyRecommendation =
      typeof payload.revenue_strategy_recommendation === "string"
        ? payload.revenue_strategy_recommendation
        : undefined
    const entryPointRole =
      typeof payload.entry_point_role === "string" ? payload.entry_point_role : undefined
    const channelStrategy =
      typeof payload.channel_strategy === "string" ? payload.channel_strategy : undefined
    const committeeStrategy =
      typeof payload.committee_strategy === "string" ? payload.committee_strategy : undefined
    const dimensions: GrowthLearningOutcome["dimensions"] = {}
    if (observationThemeKey) dimensions.messageTheme = observationThemeKey
    if (businessPressureKey) dimensions.businessPressureKey = businessPressureKey
    if (discoveryQuestionTheme) dimensions.discoveryQuestionTheme = discoveryQuestionTheme
    if (revenueStrategyRecommendation) {
      dimensions.revenueStrategyRecommendation = revenueStrategyRecommendation
    }
    if (entryPointRole) dimensions.entryPointRole = entryPointRole
    if (channelStrategy) dimensions.channelStrategy = channelStrategy
    if (committeeStrategy) dimensions.committeeStrategy = committeeStrategy
    return baseOutcome(event, {
      source: "workflow_agent",
      outcomeType: "completed",
      signalStrength: 0.72,
      confidence: 0.8,
      dimensions,
      evidence: [
        ...(observationThemeKey
          ? [
              {
                source: "outreach_preparation",
                label: "observation_theme_key",
                value: observationThemeKey,
                confidence: 0.85,
              },
            ]
          : []),
        ...(businessPressureKey
          ? [
              {
                source: "outreach_preparation",
                label: "business_pressure_key",
                value: businessPressureKey,
                confidence: 0.82,
              },
            ]
          : []),
        ...(discoveryQuestionTheme
          ? [
              {
                source: "outreach_preparation",
                label: "discovery_question_theme",
                value: discoveryQuestionTheme,
                confidence: 0.8,
              },
            ]
          : []),
        ...(revenueStrategyRecommendation
          ? [
              {
                source: "outreach_preparation",
                label: "revenue_strategy_recommendation",
                value: revenueStrategyRecommendation,
                confidence: 0.84,
              },
            ]
          : []),
        ...(entryPointRole
          ? [
              {
                source: "outreach_preparation",
                label: "entry_point_role",
                value: entryPointRole,
                confidence: 0.82,
              },
            ]
          : []),
      ],
    })
  }

  if (event.eventType === GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES.planGenerated) {
    return baseOutcome(event, {
      source: "workflow_agent",
      outcomeType: "completed",
      signalStrength: 0.65,
      confidence: 0.78,
      related: {
        communicationPlanId: typeof payload.planId === "string" ? payload.planId : undefined,
      },
    })
  }

  if (event.eventType === GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.actionCompleted) {
    const channel = channelFromPayload(payload)
    return baseOutcome(event, {
      source: "autonomous_outbound",
      outcomeType: "completed",
      signalStrength: 0.8,
      confidence: 0.86,
      related: {
        autonomousScopeId: typeof payload.scopeId === "string" ? payload.scopeId : undefined,
        actionId: typeof payload.actionId === "string" ? payload.actionId : undefined,
      },
      dimensions: channel ? { channel } : {},
    })
  }

  if (event.eventType === GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.actionFailed) {
    const channel = channelFromPayload(payload)
    return baseOutcome(event, {
      source: "autonomous_outbound",
      outcomeType: "failed",
      signalStrength: 0.75,
      confidence: 0.84,
      related: {
        autonomousScopeId: typeof payload.scopeId === "string" ? payload.scopeId : undefined,
        actionId: typeof payload.actionId === "string" ? payload.actionId : undefined,
      },
      dimensions: channel ? { channel } : {},
    })
  }

  if (event.eventType === GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.stopConditionTriggered) {
    const condition = String(payload.stopCondition ?? payload.condition ?? "")
    const channel = channelFromPayload(payload)
    const stopMap: Record<string, { source: GrowthLearningOutcomeSource; outcomeType: GrowthLearningOutcomeType }> = {
      on_reply: { source: channel === "sms" ? "sms" : "email", outcomeType: "reply" },
      on_bounce: { source: "email", outcomeType: "bounce" },
      on_unsubscribe: { source: "email", outcomeType: "unsubscribe" },
      on_opt_out: { source: "sms", outcomeType: "opt_out" },
      on_meeting_booked: { source: "meeting", outcomeType: "meeting_booked" },
      on_positive_intent: { source: channel === "sms" ? "sms" : "email", outcomeType: "positive_intent" },
      on_negative_intent: { source: channel === "sms" ? "sms" : "email", outcomeType: "negative_intent" },
    }
    const mapped = stopMap[condition]
    if (!mapped) return null
    return baseOutcome(event, {
      source: mapped.source,
      outcomeType: mapped.outcomeType,
      signalStrength: 0.88,
      confidence: 0.9,
      related: {
        autonomousScopeId: typeof payload.scopeId === "string" ? payload.scopeId : undefined,
      },
      dimensions: channel ? { channel } : {},
      evidence: [{ source: "autonomous_outbound", label: "stopCondition", value: condition }],
    })
  }

  if (event.eventType === GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT) {
    const reviewStatus = String(payload.review_status ?? payload.status ?? "")
    if (!reviewStatus) return null
    const approved = reviewStatus === "approved_for_future_execution"
    const rejected = reviewStatus === "needs_changes" || reviewStatus === "blocked"
    if (!approved && !rejected) return null
    return baseOutcome(event, {
      source: "human_approval",
      outcomeType: approved ? "approved" : "rejected",
      signalStrength: 0.9,
      confidence: 0.92,
      evidence: [{ source: "human_approval", label: "review_status", value: reviewStatus }],
    })
  }

  if (event.eventType === "decision.recorded") {
    const decisionOutcome = String(payload.outcome ?? payload.decision ?? "")
    if (decisionOutcome === "approved") {
      return baseOutcome(event, {
        source: "human_approval",
        outcomeType: "approved",
        signalStrength: 0.85,
        confidence: 0.88,
        related: {
          decisionId: typeof payload.decisionId === "string" ? payload.decisionId : undefined,
        },
      })
    }
    if (decisionOutcome === "rejected" || decisionOutcome === "cancelled") {
      return baseOutcome(event, {
        source: "human_approval",
        outcomeType: decisionOutcome === "cancelled" ? "cancelled" : "rejected",
        signalStrength: 0.85,
        confidence: 0.88,
      })
    }
    return null
  }

  if (event.eventType === "agent.failed") {
    return baseOutcome(event, {
      source: "workflow_agent",
      outcomeType: "failed",
      signalStrength: 0.7,
      confidence: 0.8,
      evidence: [
        {
          source: "agent_runtime",
          label: "reason",
          value: typeof payload.reason === "string" ? payload.reason : "unknown",
        },
      ],
    })
  }

  if (event.eventType === "mission.signal.ingested") {
    const signalType = String(payload.signalType ?? payload.signal_type ?? "")
    if (signalType === "meeting_booked") {
      return baseOutcome(event, {
        source: "meeting",
        outcomeType: "meeting_booked",
        signalStrength: 0.92,
        confidence: 0.9,
      })
    }
    if (signalType === "reply" || signalType === "reply_received") {
      const channel = channelFromPayload(payload) ?? "email"
      return baseOutcome(event, {
        source: channel === "sms" ? "sms" : "email",
        outcomeType: "reply",
        signalStrength: 0.86,
        confidence: 0.87,
        dimensions: { channel },
      })
    }
    return null
  }

  return null
}

export const GROWTH_LEARNING_RELEVANT_EVENT_TYPES = [
  GROWTH_REVENUE_OUTCOME_EVENT,
  GROWTH_DAILY_WORK_QUEUE_LEARNING_EVENT,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES.completed,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES.failed,
  GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
  GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT,
  GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES.planGenerated,
  GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.actionCompleted,
  GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.actionFailed,
  GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.stopConditionTriggered,
  GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT,
  "decision.recorded",
  "agent.failed",
  "mission.signal.ingested",
] as const

export function isLearningRelevantEventType(eventType: string): boolean {
  return (GROWTH_LEARNING_RELEVANT_EVENT_TYPES as readonly string[]).includes(eventType)
}
