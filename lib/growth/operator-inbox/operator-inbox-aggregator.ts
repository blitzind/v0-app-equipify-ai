/** Phase GS-1E — Unified operator inbox aggregation (client-safe). */

import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import type { GrowthInboxOrchestratedRecommendation } from "@/lib/growth/inbox/inbox-recommendation-orchestrator"
import type { HumanExecutionQueueItem } from "@/lib/growth/human-execution/human-execution-types"
import type { GrowthNotification } from "@/lib/growth/notifications/notification-types"
import type { GrowthReplyWorkflowActionRecord } from "@/lib/growth/reply-intelligence/workflow-actions-types"
import type { GrowthSignalFeedItem } from "@/lib/growth/signal-intelligence/signal-feed-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import {
  growthOperatorInboxFallbackHref,
} from "@/lib/growth/navigation/growth-operator-inbox-fallback-links"
import {
  OPERATOR_INBOX_QA_MARKER,
  type OperatorInboxItem,
  type OperatorInboxItemSource,
  type OperatorInboxPriority,
  type OperatorInboxQueueResponse,
  type OperatorInboxSourceCounts,
} from "@/lib/growth/operator-inbox/operator-inbox-types"
import {
  filterOperatorInboxItems,
  rankOperatorInboxItems,
} from "@/lib/growth/operator-inbox/operator-inbox-priority"
import type { DailyRevenueWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import {
  isHumanApprovalInterruptSource,
  isReplyInterruptSource,
  rankItemsWithDailyWorkQueue,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-integration"

function mapPriority(value: string, confidence = 0): OperatorInboxPriority {
  if (value === "urgent" || value === "critical") return "urgent"
  if (value === "high") return "high"
  if (value === "medium" || value === "normal") return "medium"
  if (confidence >= 0.85) return "high"
  if (confidence >= 0.65) return "medium"
  return "low"
}

function mapSignalStatus(status: GrowthSignalFeedItem["status"]): OperatorInboxItem["status"] {
  if (status === "viewed") return "viewed"
  if (status === "acted_on") return "reviewed"
  if (status === "dismissed") return "dismissed"
  return "new"
}

function baseItem(
  source: OperatorInboxItemSource,
  sourceRef: string,
  input: Omit<OperatorInboxItem, "qa_marker" | "item_id" | "source" | "source_ref" | "requires_human_review" | "autonomous_execution_enabled">,
): OperatorInboxItem {
  return {
    qa_marker: OPERATOR_INBOX_QA_MARKER,
    item_id: `${source}:${sourceRef}`,
    source,
    source_ref: sourceRef,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    ...input,
  }
}

export function normalizeSignalFeedItem(item: GrowthSignalFeedItem): OperatorInboxItem {
  return baseItem("signal", item.audit_event_id, {
    title: item.signal_label,
    description: item.recommended_action,
    reasoning: [item.reasoning, item.expected_impact].filter(Boolean),
    priority: mapPriority(item.priority, item.confidence),
    confidence: Math.round(item.confidence * 100),
    lead_id: item.lead_id,
    company_name: item.company_name,
    occurred_at: item.occurred_at,
    cta_href:
      item.cta.view_lead ??
      item.cta.open_timeline ??
      growthOperatorInboxFallbackHref({ leadId: item.lead_id }),
    status: mapSignalStatus(item.status),
  })
}

export function normalizeReplyWorkflowAction(action: GrowthReplyWorkflowActionRecord): OperatorInboxItem {
  return baseItem("reply_workflow", action.id, {
    title: action.title,
    description: action.summary,
    reasoning: [
      action.replyIntent ? `Intent: ${action.replyIntent}` : "",
      action.replyNextAction ? `Suggested next: ${action.replyNextAction.replace(/_/g, " ")}` : "",
      "Human review required before any reply or outreach execution.",
    ].filter(Boolean),
    priority: mapPriority(action.severity),
    confidence: action.severity === "critical" ? 90 : action.severity === "high" ? 75 : 55,
    lead_id: action.leadId,
    company_name: action.companyName,
    occurred_at: action.createdAt,
    cta_href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow?leadId=${encodeURIComponent(action.leadId)}`,
    status: "new",
  })
}

export function normalizeAttentionNotification(notification: GrowthNotification): OperatorInboxItem {
  const callSessionId =
    typeof notification.metadata.sessionId === "string"
      ? notification.metadata.sessionId
      : typeof notification.metadata.callSessionId === "string"
        ? notification.metadata.callSessionId
        : null

  return baseItem("attention", notification.id, {
    title: notification.title,
    description: notification.body,
    reasoning: [
      `Source: ${notification.sourceSystem.replace(/_/g, " ")}`,
      "Attention item — acknowledge manually; no autonomous execution.",
    ],
    priority: mapPriority(notification.severity),
    confidence: Math.min(100, Math.round((notification.priorityScore ?? 50) * 1.2)),
    lead_id: notification.leadId,
    company_name: null,
    occurred_at: notification.createdAt,
    cta_href:
      notification.actionUrl ??
      growthOperatorInboxFallbackHref({
        notificationType: notification.notificationType,
        sourceSystem: notification.sourceSystem,
        leadId: notification.leadId,
        opportunityId: notification.opportunityId,
        callSessionId,
        channel: typeof notification.metadata.channel === "string" ? notification.metadata.channel : null,
      }),
    status: notification.acknowledgedAt ? "viewed" : "new",
  })
}

export function normalizeHumanApprovalItem(item: HumanExecutionQueueItem): OperatorInboxItem {
  return baseItem("human_approval", item.id, {
    title: item.title,
    description: item.why,
    reasoning: [
      `${item.channelLabel} · ${item.approvalStatus.replace(/_/g, " ")}`,
      item.callNowRecommended ? "Call-now recommendation — operator must approve." : "Approval required before execution.",
    ],
    priority: mapPriority(item.readinessBand === "critical" ? "urgent" : item.readinessBand),
    confidence: item.readinessScore,
    lead_id: item.leadId,
    company_name: item.companyName,
    occurred_at: new Date().toISOString(),
    cta_href: item.ctaHref,
    status: "new",
  })
}

export function normalizeInboxThread(thread: GrowthInboxThread): OperatorInboxItem {
  const preview =
    thread.messages?.[0]?.body_preview ??
    `Classification: ${thread.classification.replace(/_/g, " ")}`

  return baseItem("inbox_thread", thread.id, {
    title: thread.subject || "Inbox thread",
    description: preview,
    reasoning: [
      `Priority: ${thread.priority_tier}`,
      thread.requires_human_review ? "Thread flagged for human review." : "Open thread in unified inbox.",
    ],
    priority: mapPriority(thread.priority_tier === "critical" ? "urgent" : thread.priority_tier),
    confidence: thread.priority_score ?? 50,
    lead_id: thread.lead_id,
    company_name: thread.lead_label,
    occurred_at: thread.last_message_at ?? thread.updated_at,
    cta_href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox?threadId=${encodeURIComponent(thread.id)}`,
    status: "new",
  })
}

export function normalizeRecommendedAction(
  recommendation: GrowthInboxOrchestratedRecommendation,
  leadId: string | null,
): OperatorInboxItem {
  return baseItem("recommended_action", recommendation.sourceId ?? recommendation.title, {
    title: recommendation.title,
    description: recommendation.recommendation,
    reasoning: [recommendation.whyThisExists, recommendation.recommendedNextStep, ...recommendation.evidence.slice(0, 2)],
    priority: mapPriority(recommendation.confidence === "Verified" ? "high" : recommendation.confidence),
    confidence:
      recommendation.confidence === "Verified"
        ? 90
        : recommendation.confidence === "High"
          ? 75
          : recommendation.confidence === "Medium"
            ? 55
            : 40,
    lead_id: leadId,
    company_name: null,
    occurred_at: new Date().toISOString(),
    cta_href: growthOperatorInboxFallbackHref({ leadId }),
    status: "new",
  })
}

function countSources(items: OperatorInboxItem[]): OperatorInboxSourceCounts {
  const counts: OperatorInboxSourceCounts = {
    signal: 0,
    reply_workflow: 0,
    attention: 0,
    human_approval: 0,
    inbox_thread: 0,
    recommended_action: 0,
  }
  for (const item of items) counts[item.source] += 1
  return counts
}

export function aggregateOperatorInboxQueue(input: {
  signals?: GrowthSignalFeedItem[]
  replyWorkflowActions?: GrowthReplyWorkflowActionRecord[]
  attentionItems?: GrowthNotification[]
  humanApprovals?: HumanExecutionQueueItem[]
  inboxThreads?: GrowthInboxThread[]
  recommendedActions?: Array<{ recommendation: GrowthInboxOrchestratedRecommendation; leadId: string | null }>
  filter?: import("@/lib/growth/operator-inbox/operator-inbox-types").OperatorInboxFilter
  limit?: number
  dailyRevenueWorkQueue?: DailyRevenueWorkQueue | null
}): OperatorInboxQueueResponse {
  const merged: OperatorInboxItem[] = [
    ...(input.signals ?? []).map(normalizeSignalFeedItem),
    ...(input.replyWorkflowActions ?? []).map(normalizeReplyWorkflowAction),
    ...(input.attentionItems ?? []).map(normalizeAttentionNotification),
    ...(input.humanApprovals ?? []).map(normalizeHumanApprovalItem),
    ...(input.inboxThreads ?? []).map(normalizeInboxThread),
    ...(input.recommendedActions ?? []).map(({ recommendation, leadId }) =>
      normalizeRecommendedAction(recommendation, leadId),
    ),
  ]

  const filtered = filterOperatorInboxItems(merged, input.filter ?? "all")
  const ranked = input.dailyRevenueWorkQueue
    ? rankItemsWithDailyWorkQueue({
        items: filtered,
        queue: input.dailyRevenueWorkQueue,
        resolveLeadId: (item) => item.lead_id,
        resolveInterrupt: (item) =>
          isReplyInterruptSource(item.source) ||
          isHumanApprovalInterruptSource(item.source) ||
          item.priority === "urgent",
        fallbackCompare: (left, right) => rankOperatorInboxItems([left, right])[0] === left ? -1 : 1,
      })
    : rankOperatorInboxItems(filtered)
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100)
  const items = ranked.slice(0, limit)

  return {
    qa_marker: OPERATOR_INBOX_QA_MARKER,
    generated_at: new Date().toISOString(),
    total: items.length,
    urgent_count: items.filter((item) => item.priority === "urgent" || item.priority === "high").length,
    source_counts: countSources(items),
    items,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}
