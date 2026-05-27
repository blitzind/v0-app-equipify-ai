import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { registerUnsubscribe } from "@/lib/growth/compliance/suppression-engine"
import { upsertGrowthSuppressionEntry } from "@/lib/growth/outbound/suppression-repository"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import type { ReplyIntentClassificationV2Result } from "@/lib/growth/reply-intelligence/reply-intent-classifier-v2"
import {
  insertConversationTimelineEvent,
  insertReplyWorkflowAction,
} from "@/lib/growth/reply-intelligence/reply-ingestion-repository"
import type {
  GrowthReplyIntent,
  GrowthReplyNextAction,
  GrowthReplyWorkflowActionType,
} from "@/lib/growth/reply-intelligence/reply-intent-types"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"

type WorkflowRoute = {
  actionType: GrowthReplyWorkflowActionType
  severity: "info" | "low" | "medium" | "high" | "critical"
  title: string
  summary: string
  actionStatus: "recorded" | "pending_review"
}

const STOP_INTENTS = new Set<GrowthReplyIntent>(["unsubscribe", "not_interested", "wrong_contact", "angry_complaint"])
const POSITIVE_INTENTS = new Set<GrowthReplyIntent>(["positive_interest", "meeting_request", "demo_request", "pricing_question"])

function resolveWorkflowRoutes(input: {
  intent: GrowthReplyIntent
  nextAction: GrowthReplyNextAction
  classification: ReplyIntentClassificationV2Result
}): WorkflowRoute[] {
  const routes: WorkflowRoute[] = []

  if (STOP_INTENTS.has(input.intent)) {
    routes.push({
      actionType: "suppress_outreach",
      severity: input.intent === "angry_complaint" ? "critical" : "high",
      title: "Suppress future outreach",
      summary: input.classification.recommendedOperatorAction,
      actionStatus: input.intent === "unsubscribe" ? "recorded" : "pending_review",
    })
    routes.push({
      actionType: "stop_sequence",
      severity: "high",
      title: "Stop sequence",
      summary: "Automated sequence should pause pending operator review.",
      actionStatus: "pending_review",
    })
  }

  if (input.intent === "angry_complaint") {
    routes.push({
      actionType: "route_complaint_review",
      severity: "critical",
      title: "Urgent complaint review",
      summary: "Angry or complaint reply requires immediate human review.",
      actionStatus: "pending_review",
    })
  }

  if (POSITIVE_INTENTS.has(input.intent)) {
    routes.push({
      actionType: "mark_interested",
      severity: "medium",
      title: "Mark interested",
      summary: "Positive buying signal — operator confirms opportunity stage.",
      actionStatus: "pending_review",
    })
  }

  if (input.intent === "demo_request" || input.intent === "meeting_request") {
    routes.push({
      actionType: "route_demo_scheduling",
      severity: "high",
      title: "Route demo scheduling",
      summary: "Demo/meeting intent detected — human schedules, no auto-booking.",
      actionStatus: "pending_review",
    })
  }

  if (input.intent === "pricing_question") {
    routes.push({
      actionType: "route_pricing_response",
      severity: "high",
      title: "Route pricing response",
      summary: "Pricing question — draft response for human approval.",
      actionStatus: "pending_review",
    })
  }

  if (input.intent === "wrong_contact" || input.intent === "referral") {
    routes.push({
      actionType: "route_wrong_person",
      severity: "medium",
      title: "Wrong person / referral workflow",
      summary: input.intent === "referral" ? "Referral flagged — do not auto-enroll." : "Wrong contact — verify before continuing outreach.",
      actionStatus: "pending_review",
    })
  }

  if (input.nextAction === "call_prospect") {
    routes.push({
      actionType: "create_call_task",
      severity: "high",
      title: "Create call task",
      summary: "Operator should place a call — task recorded, not auto-completed.",
      actionStatus: "pending_review",
    })
  } else if (["reply_email", "follow_up_later", "schedule_meeting", "update_opportunity", "verify_contact"].includes(input.nextAction)) {
    routes.push({
      actionType: "create_follow_up_task",
      severity: "medium",
      title: "Create follow-up task",
      summary: `Suggested next action: ${input.nextAction.replace(/_/g, " ")}.`,
      actionStatus: "pending_review",
    })
  }

  if (input.classification.uncertaintyState === "ambiguous" || input.classification.confidenceTier === "uncertain") {
    routes.push({
      actionType: "flag_manual_review",
      severity: "medium",
      title: "Low confidence classification",
      summary: "Classification uncertainty — operator should review before acting.",
      actionStatus: "pending_review",
    })
  }

  if (routes.length === 0) {
    routes.push({
      actionType: "flag_manual_review",
      severity: "low",
      title: "Manual review",
      summary: "No high-confidence automated route — operator decides next step.",
      actionStatus: "pending_review",
    })
  }

  return routes
}

async function applyComplianceSuppression(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    intent: GrowthReplyIntent
    senderEmail?: string | null
    contactId?: string | null
    sequenceEnrollmentId?: string | null
  },
): Promise<boolean> {
  if (input.intent !== "unsubscribe") return false

  if (input.senderEmail) {
    await registerUnsubscribe(admin, {
      email: input.senderEmail,
      source: "reply_intent",
      leadId: input.leadId,
      reason: "unsubscribe_reply",
    }).catch(() => undefined)

    await upsertGrowthSuppressionEntry(admin, {
      email: input.senderEmail,
      reason: "unsubscribe",
      source: "manual",
      leadId: input.leadId,
      contactId: input.contactId ?? null,
    }).catch(() => undefined)
  }

  await recordInternalOutboundAuditEvent(admin, {
    eventType: "pre_send_blocked",
    severity: "critical",
    title: "Reply unsubscribe suppression",
    summary: "High-confidence unsubscribe intent suppressed future outreach.",
    metadata: {
      lead_id: input.leadId,
      reply_id: input.replyId,
      sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
    },
  }).catch(() => undefined)

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "reply_suppression_applied",
    title: "Reply suppression applied",
    summary: "Unsubscribe intent triggered compliance suppression.",
    outboundReplyId: input.replyId,
    payload: { intent: input.intent },
  }).catch(() => undefined)

  return true
}

export async function routeReplyWorkflows(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    ingestionEventId?: string | null
    nextAction: GrowthReplyNextAction
    classification: ReplyIntentClassificationV2Result
    senderEmail?: string | null
    contactId?: string | null
    sequenceEnrollmentId?: string | null
    actorUserId?: string | null
  },
): Promise<{ actions: string[]; suppressed: boolean }> {
  const routes = resolveWorkflowRoutes({
    intent: input.classification.intent,
    nextAction: input.nextAction,
    classification: input.classification,
  })

  const actionIds: string[] = []
  for (const route of routes) {
    const created = await insertReplyWorkflowAction(admin, {
      replyId: input.replyId,
      ingestionEventId: input.ingestionEventId,
      leadId: input.leadId,
      actionType: route.actionType,
      actionStatus: route.actionStatus,
      severity: route.severity,
      title: route.title,
      summary: route.summary,
      evidence: {
        intent: input.classification.intent,
        confidence_tier: input.classification.confidenceTier,
        matched_phrases: input.classification.matchedPhrases,
      },
      actorUserId: input.actorUserId ?? null,
    })
    actionIds.push(created.id)

    await insertConversationTimelineEvent(admin, {
      leadId: input.leadId,
      eventKind: "workflow_routed",
      eventSource: "reply_routing",
      title: route.title,
      summary: route.summary,
      evidenceExcerpt: input.classification.matchedPhrases[0]?.excerpt ?? null,
      occurredAt: new Date().toISOString(),
      outboundReplyId: input.replyId,
      ingestionEventId: input.ingestionEventId ?? null,
      payload: { action_type: route.actionType, action_status: route.actionStatus },
    }).catch(() => undefined)
  }

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "reply_workflow_routed",
    title: "Reply workflow routed",
    summary: `${routes.length} operator workflow action(s) recorded — human review required.`,
    outboundReplyId: input.replyId,
    payload: { action_count: routes.length, intent: input.classification.intent },
  }).catch(() => undefined)

  const suppressed = await applyComplianceSuppression(admin, {
    leadId: input.leadId,
    replyId: input.replyId,
    intent: input.classification.intent,
    senderEmail: input.senderEmail,
    contactId: input.contactId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
  })

  return { actions: actionIds, suppressed }
}
