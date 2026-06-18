/** Phase GS-1E — Unified Operator Inbox server service — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchHumanExecutionQueue } from "@/lib/growth/human-execution/human-execution-dashboard-repository"
import {
  recordGrowthInboxCompactOperatorInboxRequest,
  recordGrowthInboxFullOperatorInboxRequest,
} from "@/lib/growth/inbox/growth-inbox-query-metrics"
import { aggregateOperatorInboxQueue } from "@/lib/growth/operator-inbox/operator-inbox-aggregator"
import type {
  OperatorInboxActionRequest,
  OperatorInboxFilter,
  OperatorInboxQueueResponse,
} from "@/lib/growth/operator-inbox/operator-inbox-types"
import { listInboxThreads } from "@/lib/growth/inbox/thread-repository"
import { acknowledgeGrowthNotification, listGrowthAttentionFeed } from "@/lib/growth/notifications/notification-repository"
import { listReplyWorkflowActions } from "@/lib/growth/reply-intelligence/workflow-actions-repository"
import { applySignalFeedAction } from "@/lib/growth/signal-intelligence/signal-feed-repository"
import { loadGrowthSignalFeed } from "@/lib/growth/signal-intelligence/signal-feed-repository"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

export const OPERATOR_INBOX_QUEUE_MODES = ["compact", "full"] as const
export type OperatorInboxQueueMode = (typeof OPERATOR_INBOX_QUEUE_MODES)[number]

export async function fetchOperatorInboxQueue(
  admin: SupabaseClient,
  input?: {
    lead_id?: string | null
    filter?: OperatorInboxFilter
    limit?: number
    /** compact: Tier 1 inbox (no human execution dashboard). full: admin surfaces. */
    mode?: OperatorInboxQueueMode
  },
): Promise<OperatorInboxQueueResponse> {
  const mode = input?.mode ?? "full"

  if (mode === "compact") {
    recordGrowthInboxCompactOperatorInboxRequest()
  } else {
    recordGrowthInboxFullOperatorInboxRequest()
  }

  const signalLimit = mode === "compact" ? 15 : 50

  const [signals, replyWorkflowActions, attention, humanQueue, inboxThreads] = await Promise.all([
    isGrowthSignalFoundationSchemaReady(admin)
      ? loadGrowthSignalFeed(admin, { lead_id: input?.lead_id, limit: signalLimit })
      : Promise.resolve({ items: [] as Awaited<ReturnType<typeof loadGrowthSignalFeed>>["items"] }),
    listReplyWorkflowActions(admin, {
      leadId: input?.lead_id ?? undefined,
      status: "pending_review",
      limit: 30,
    }).catch(() => []),
    listGrowthAttentionFeed(admin, {
      status: "open",
      view: "needs_action",
      limit: 30,
    }).catch(() => ({ items: [] })),
    mode === "full"
      ? fetchHumanExecutionQueue(admin).catch(() => ({ items: [] }))
      : Promise.resolve({ items: [] as Awaited<ReturnType<typeof fetchHumanExecutionQueue>>["items"] }),
    listInboxThreads(admin, { limit: 30 })
      .then((threads) =>
        threads.filter(
          (thread) => thread.thread_status === "open" || thread.thread_status === "needs_review",
        ),
      )
      .catch(() => []),
  ])

  return aggregateOperatorInboxQueue({
    signals: signals.items,
    replyWorkflowActions,
    attentionItems: attention.items,
    humanApprovals: humanQueue.items ?? [],
    inboxThreads: input?.lead_id
      ? inboxThreads.filter((thread) => thread.lead_id === input.lead_id)
      : inboxThreads,
    filter: input?.filter,
    limit: input?.limit,
  })
}

export async function applyOperatorInboxAction(
  admin: SupabaseClient,
  request: OperatorInboxActionRequest,
): Promise<{ ok: boolean; error?: string }> {
  if (request.action === "dismiss" || request.action === "mark_viewed" || request.action === "mark_reviewed") {
    if (request.source === "signal") {
      const signalAction =
        request.action === "dismiss"
          ? "dismiss"
          : request.action === "mark_reviewed"
            ? "mark_acted_on"
            : "mark_viewed"
      const result = await applySignalFeedAction(admin, {
        action: signalAction,
        audit_event_id: request.source_ref,
      })
      return result.ok ? { ok: true } : { ok: false, error: result.error ?? "signal_action_failed" }
    }

    if (request.source === "attention" && request.action !== "dismiss") {
      await acknowledgeGrowthNotification(admin, request.source_ref)
      return { ok: true }
    }
  }

  if (request.action === "dismiss" && request.source === "attention") {
    await acknowledgeGrowthNotification(admin, request.source_ref)
    return { ok: true }
  }

  // Reply workflow, human approval, inbox thread, recommended_action — navigation only; no autonomous execution.
  return { ok: true, error: request.action === "dismiss" ? undefined : "status_only_no_persistence" }
}
