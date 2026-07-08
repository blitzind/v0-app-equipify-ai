/**
 * GE-LEADS-CANONICAL-4D — Revenue Queue actions on growth.leads (canonical-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_LEAD_ENGINE_RUN_METADATA_KEY,
  type RevenueQueueAction,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  archiveGrowthLeads,
  fetchGrowthLeadById,
  updateGrowthLead,
} from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { loadRevenueQueueOperatorWorkspace } from "@/lib/growth/revenue-queue/revenue-queue-detail-bridge"
import type { GrowthLead, GrowthLeadStatus } from "@/lib/growth/types"

export const GROWTH_REVENUE_QUEUE_ACTION_BRIDGE_QA_MARKER =
  "growth-revenue-queue-action-bridge-v1" as const

export type RevenueQueueActionTarget = {
  source: "canonical_lead"
  growth_lead_id: string
  inbox_id: null
}

export type RevenueQueueActionResult =
  | {
      ok: true
      target: RevenueQueueActionTarget
      workspace: Awaited<ReturnType<typeof loadRevenueQueueOperatorWorkspace>> extends infer T
        ? T extends { workspace: infer W }
          ? W
          : never
        : never
    }
  | { ok: false; code: string; message: string; status: number }

function appendRevenueQueueActionMetadata(
  lead: GrowthLead,
  action: RevenueQueueAction,
  actorUserId: string | null,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const prior = Array.isArray(lead.metadata.revenue_queue_action_history)
    ? (lead.metadata.revenue_queue_action_history as unknown[])
    : []
  const entry = {
    action,
    at: new Date().toISOString(),
    actor_user_id: actorUserId,
    ...extra,
  }
  return {
    ...lead.metadata,
    revenue_queue_source: "canonical",
    revenue_queue_last_action: action,
    revenue_queue_last_action_at: entry.at,
    revenue_queue_action_history: [entry, ...prior].slice(0, 50),
  }
}

function nextStatusAfterApprove(status: GrowthLeadStatus): GrowthLeadStatus {
  if (status === "enriched" || status === "replied") return "call_ready"
  if (status === "new" || status === "researching") return "qualified"
  if (status === "qualified" || status === "in_outreach" || status === "call_ready") return status
  return "qualified"
}

function nextStatusAfterClaim(status: GrowthLeadStatus): GrowthLeadStatus {
  if (status === "new") return "researching"
  return status
}

export async function resolveRevenueQueueActionTarget(
  admin: SupabaseClient,
  leadId: string,
): Promise<RevenueQueueActionTarget | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null
  return { source: "canonical_lead", growth_lead_id: lead.id, inbox_id: null }
}

async function applyCanonicalLeadAction(
  admin: SupabaseClient,
  leadId: string,
  action: RevenueQueueAction,
  input: { ownerId: string | null; actorUserId: string | null; reason?: string },
): Promise<GrowthLead | null> {
  const existing = await fetchGrowthLeadById(admin, leadId)
  if (!existing) return null

  if (action === "claim") {
    if (!input.ownerId) return null
    return updateGrowthLead(admin, leadId, {
      assignedTo: input.ownerId,
      status: nextStatusAfterClaim(existing.status),
      metadata: appendRevenueQueueActionMetadata(existing, action, input.actorUserId, {
        owner_id: input.ownerId,
      }),
    })
  }

  if (action === "assign_owner") {
    if (!input.ownerId) return null
    return updateGrowthLead(admin, leadId, {
      assignedTo: input.ownerId,
      metadata: appendRevenueQueueActionMetadata(existing, action, input.actorUserId, {
        owner_id: input.ownerId,
      }),
    })
  }

  if (action === "approve") {
    return updateGrowthLead(admin, leadId, {
      status: nextStatusAfterApprove(existing.status),
      metadata: appendRevenueQueueActionMetadata(existing, action, input.actorUserId, {
        approved_at: new Date().toISOString(),
      }),
    })
  }

  if (action === "archive") {
    const archived = await archiveGrowthLeads(admin, {
      leadIds: [leadId],
      archivedBy: input.actorUserId,
      reason: input.reason ?? "Archived from Revenue Queue.",
    })
    return archived[0] ?? null
  }

  if (action === "mark_duplicate") {
    return updateGrowthLead(admin, leadId, {
      status: "disqualified",
      metadata: appendRevenueQueueActionMetadata(existing, action, input.actorUserId, {
        duplicate_reason: input.reason ?? "",
      }),
    })
  }

  if (action === "run_lead_engine") {
    const researching =
      existing.status === "new"
        ? await updateGrowthLead(admin, leadId, {
            status: "researching",
            metadata: appendRevenueQueueActionMetadata(existing, action, input.actorUserId, {
              intelligence_refresh_started_at: new Date().toISOString(),
            }),
          })
        : existing

    await recomputeGrowthLeadWorkflowSignals(admin, leadId)

    const refreshed = await fetchGrowthLeadById(admin, leadId)
    if (!refreshed) return researching

    return updateGrowthLead(admin, leadId, {
      metadata: appendRevenueQueueActionMetadata(refreshed, action, input.actorUserId, {
        intelligence_refresh_completed_at: new Date().toISOString(),
        intelligence_refresh_note:
          "Canonical workflow intelligence recompute — no legacy inbox fixture pipeline.",
        [GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]: refreshed.metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY],
      }),
    })
  }

  return null
}

export async function executeRevenueQueueAction(
  admin: SupabaseClient,
  input: {
    leadId: string
    action: RevenueQueueAction
    ownerId: string | null
    actorUserId: string | null
    reason?: string
  },
): Promise<RevenueQueueActionResult> {
  const target = await resolveRevenueQueueActionTarget(admin, input.leadId)
  if (!target) {
    return { ok: false, code: "not_found", message: "Lead not found.", status: 404 }
  }

  const updated = await applyCanonicalLeadAction(admin, target.growth_lead_id, input.action, {
    ownerId: input.ownerId,
    actorUserId: input.actorUserId,
    reason: input.reason,
  })
  if (!updated) {
    return {
      ok: false,
      code: input.action === "assign_owner" || input.action === "claim" ? "validation_error" : "action_failed",
      message:
        input.action === "assign_owner" || input.action === "claim"
          ? "ownerId is required."
          : `Could not apply ${input.action}.`,
      status: input.action === "assign_owner" || input.action === "claim" ? 400 : 409,
    }
  }

  const detail = await loadRevenueQueueOperatorWorkspace(admin, input.leadId)
  if (!detail) {
    return { ok: false, code: "not_found", message: "Lead workspace not found after action.", status: 404 }
  }

  return { ok: true, target, workspace: detail.workspace }
}
