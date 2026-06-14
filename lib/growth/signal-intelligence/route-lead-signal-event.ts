/** Lead signal event router — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateGrowthAttentionSignals } from "@/lib/growth/notifications/evaluate-growth-attention-signals"
import {
  recomputeGrowthLeadNextBestAction,
  recomputeGrowthLeadWorkflowSignals,
} from "@/lib/growth/recompute-lead-next-best-action"
import { recomputeGrowthLeadEngagementIntelligence } from "@/lib/growth/recompute-engagement-intelligence"
import {
  assertLeadSignalEventShape,
  LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
  type LeadSignalEvent,
  type RouteLeadSignalEventResult,
} from "@/lib/growth/signal-intelligence/lead-signal-event-types"
import {
  emitLeadSignalTimelineEvent,
  persistDuplicateLeadSignalAudit,
  persistRoutedLeadSignalAudit,
  recordLeadSignalAttributionTouch,
} from "@/lib/growth/signal-intelligence/signal-event-audit"
import {
  buildLeadSignalDedupeHash,
  isDuplicateLeadSignalEvent,
} from "@/lib/growth/signal-intelligence/signal-event-dedupe"
import { applyLeadSignalScoringDefaults } from "@/lib/growth/signal-intelligence/signal-event-scoring"
import { resolveSignalQueueHint } from "@/lib/growth/signal-intelligence/signal-queue-hints"

async function runLeadSignalRecompute(
  admin: SupabaseClient,
  event: LeadSignalEvent,
): Promise<boolean> {
  if (event.metadata?.__gs1b_force_recompute_fail === true) {
    return false
  }

  try {
    switch (event.recomputeScope) {
      case "engagement_only":
        await recomputeGrowthLeadEngagementIntelligence(admin, event.leadId)
        return true
      case "nba_only":
        await recomputeGrowthLeadNextBestAction(admin, event.leadId)
        return true
      case "full":
      default:
        await recomputeGrowthLeadWorkflowSignals(admin, event.leadId)
        return true
    }
  } catch {
    return false
  }
}

export async function routeLeadSignalEvent(
  admin: SupabaseClient,
  event: LeadSignalEvent,
): Promise<RouteLeadSignalEventResult> {
  assertLeadSignalEventShape(event)
  const scoredEvent = applyLeadSignalScoringDefaults(event)
  const dedupeHash = buildLeadSignalDedupeHash(scoredEvent)

  if (await isDuplicateLeadSignalEvent(admin, dedupeHash)) {
    const auditEventId = await persistDuplicateLeadSignalAudit(admin, scoredEvent, dedupeHash)
    return {
      qa_marker: LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
      ok: true,
      duplicate: true,
      audit_event_id: auditEventId,
      timeline_emitted: false,
      attribution_touch_recorded: false,
      recompute_succeeded: false,
      attention_evaluated: false,
      queue_hint: null,
      dedupe_hash: dedupeHash,
    }
  }

  const auditEventId = await persistRoutedLeadSignalAudit(admin, scoredEvent, dedupeHash)

  const timeline_emitted = await emitLeadSignalTimelineEvent(admin, scoredEvent)
  const attribution_touch_recorded = await recordLeadSignalAttributionTouch(admin, scoredEvent)
  const recompute_succeeded = await runLeadSignalRecompute(admin, scoredEvent)
  const queue_hint = resolveSignalQueueHint(scoredEvent)

  let attention_evaluated = false
  if (scoredEvent.routeActions.includes("attention")) {
    await evaluateGrowthAttentionSignals(admin, {
      external_signal: {
        lead_id: scoredEvent.leadId,
        signal_type: scoredEvent.signalType,
        urgency: scoredEvent.urgency,
      },
    }).catch(() => undefined)
    attention_evaluated = true
  }

  return {
    qa_marker: LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
    ok: true,
    duplicate: false,
    audit_event_id: auditEventId,
    timeline_emitted,
    attribution_touch_recorded,
    recompute_succeeded,
    attention_evaluated,
    queue_hint,
    dedupe_hash: dedupeHash,
  }
}

export async function routeLeadSignalEvents(
  admin: SupabaseClient,
  events: LeadSignalEvent[],
): Promise<RouteLeadSignalEventResult[]> {
  const results: RouteLeadSignalEventResult[] = []
  for (const event of events) {
    results.push(await routeLeadSignalEvent(admin, event))
  }
  return results
}
