import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { dispatchWorkflowTriggers } from "@/lib/workflows/dispatch"
import { formatProspectStatus } from "@/lib/prospects/format"
import type { ProspectStatus } from "@/lib/prospects/types"

/**
 * Leads + Follow-Up Phase 2 — prospect status-change side effects.
 *
 * Centralizes two things that all prospect mutations should do when the
 * pipeline status moves:
 *
 *   1. Persist a `communication_events` row of type
 *      `prospect_status_changed`. This shows up on the prospect timeline
 *      (drawer) and gives the future Communications module a single
 *      source of truth — no separate `prospect_status_history` table.
 *
 *   2. Fire `dispatchWorkflowTriggers("prospect_status_changed")` so any
 *      future workflow automation rule keyed to that trigger runs without
 *      additional plumbing. The trigger is additive — Phase 2 does not
 *      ship a UI for creating prospect-status rules, but the infrastructure
 *      is in place. This is best-effort: a workflow failure must never
 *      block the user-facing prospect mutation.
 *
 * Both effects are non-blocking with respect to the underlying mutation —
 * if the caller has already updated `prospects.status`, this helper only
 * adds audit + automation. Any error inside this helper is swallowed and
 * surfaced via the AI debug log (already used elsewhere). The mutation
 * itself owns user-facing error handling.
 */
export async function recordProspectStatusChange(args: {
  supabase: SupabaseClient
  organizationId: string
  prospectId: string
  companyName: string
  previousStatus: ProspectStatus | string
  nextStatus: ProspectStatus | string
  reason?: string | null
  actorUserId?: string | null
  /** Optional metadata folded into `communication_events.metadata`. */
  extraMetadata?: Record<string, unknown>
}): Promise<void> {
  const {
    supabase,
    organizationId,
    prospectId,
    companyName,
    previousStatus,
    nextStatus,
    reason,
    actorUserId,
    extraMetadata,
  } = args

  if (!previousStatus || !nextStatus || previousStatus === nextStatus) {
    return
  }

  const fromLabel = formatProspectStatus(previousStatus)
  const toLabel = formatProspectStatus(nextStatus)

  // 1. Audit log on the prospect timeline. Wrapped in try/catch because
  //    the only valid response is "best-effort" — the mutation has already
  //    succeeded and we never want a logging glitch to roll it back.
  try {
    await logCommunicationEvent(supabase, {
      organizationId,
      channel: "system",
      direction: "outbound",
      eventType: "prospect_status_changed",
      title: `Status: ${fromLabel} → ${toLabel}`,
      summary: `${companyName} moved from ${fromLabel} to ${toLabel}.`,
      audience: "organization",
      countsTowardUnread: false,
      deliveryStatus: "sent",
      recipientKind: "none",
      relatedEntityType: "prospect",
      relatedEntityId: prospectId,
      provider: "manual",
      metadata: {
        prospect_id: prospectId,
        previous_status: previousStatus,
        next_status: nextStatus,
        reason: reason ?? null,
        ...(extraMetadata ?? {}),
      },
      sentAt: new Date().toISOString(),
      createdBy: actorUserId ?? null,
    })
  } catch {
    // Swallow — see comment above.
  }

  // 2. Workflow dispatch foundation. Plan-gated by `dispatchWorkflowTriggers`
  //    itself; orgs without the `automation` feature flag are no-ops.
  try {
    await dispatchWorkflowTriggers({
      supabase,
      organizationId,
      triggerType: "prospect_status_changed",
      sourceType: "prospect",
      sourceId: prospectId,
      ctx: {
        organization_id: organizationId,
        trigger_type: "prospect_status_changed",
        prospect: {
          id: prospectId,
          company_name: companyName,
          previous_status: previousStatus,
          next_status: nextStatus,
          reason: reason ?? null,
        },
      },
    })
  } catch {
    // Swallow — automation must never block a user mutation.
  }
}
