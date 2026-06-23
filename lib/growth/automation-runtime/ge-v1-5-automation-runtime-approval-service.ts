/** GE-v1-5 — Approval API service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"
import {
  approveGeV15PreparedAction,
  listGeV15OperatorReviewActions,
  rejectGeV15PreparedAction,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval"
import {
  editGeV15LeadPreparedAction,
  executeGeV15ApprovedPreparedAction,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-execute"
import {
  appendGeV15RuntimeLog,
  buildGeV15ApprovalLogMessage,
  parseGeV15RuntimeState,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-logging"
import {
  GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY,
  type GeV15PreparedAction,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

export async function listGeV15LeadPendingApprovals(
  admin: SupabaseClient,
  leadId: string,
): Promise<GeV15PreparedAction[]> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return []
  const state = parseGeV15RuntimeState(lead.metadata)
  return listGeV15OperatorReviewActions(state.preparedActions)
}

export async function approveGeV15LeadPreparedAction(
  admin: SupabaseClient,
  input: { leadId: string; actionId: string; approvedBy?: string | null },
): Promise<{ ok: boolean; action?: GeV15PreparedAction; error?: string }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return { ok: false, error: "lead_not_found" }

  let state = parseGeV15RuntimeState(lead.metadata)
  const existing = state.preparedActions.find((a) => a.id === input.actionId)
  if (!existing) return { ok: false, error: "action_not_found" }

  try {
    state = {
      ...state,
      preparedActions: approveGeV15PreparedAction(
        state.preparedActions,
        input.actionId,
        input.approvedBy,
      ),
    }
    state = appendGeV15RuntimeLog(state, {
      phase: "approval",
      message: buildGeV15ApprovalLogMessage(input.actionId, existing.status, "approved"),
      metadata: { approvedBy: input.approvedBy },
    })

    await updateGrowthLead(admin, input.leadId, {
      metadata: {
        ...(lead.metadata ?? {}),
        [GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY]: state,
      },
    })

    const action = state.preparedActions.find((a) => a.id === input.actionId)
    return { ok: true, action }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "approval_failed" }
  }
}

export async function rejectGeV15LeadPreparedAction(
  admin: SupabaseClient,
  input: { leadId: string; actionId: string; rejectedBy?: string | null; reason?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return { ok: false, error: "lead_not_found" }

  let state = parseGeV15RuntimeState(lead.metadata)
  const existing = state.preparedActions.find((a) => a.id === input.actionId)
  if (!existing) return { ok: false, error: "action_not_found" }

  state = {
    ...state,
    preparedActions: rejectGeV15PreparedAction(state.preparedActions, input.actionId, {
      rejectedBy: input.rejectedBy,
      reason: input.reason,
    }),
  }
  state = appendGeV15RuntimeLog(state, {
    phase: "approval",
    message: buildGeV15ApprovalLogMessage(input.actionId, existing.status, "rejected"),
    metadata: { rejectedBy: input.rejectedBy, reason: input.reason },
  })

  await updateGrowthLead(admin, input.leadId, {
    metadata: {
      ...(lead.metadata ?? {}),
      [GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY]: state,
    },
  })

  void (async () => {
    try {
      const organizationId = lead.promotedOrganizationId
      if (!organizationId) return
      const { dispatchGrowthObjectiveAutomationRuntimeEvent } = await import(
        "@/lib/growth/objectives/growth-objective-event-bridge"
      )
      await dispatchGrowthObjectiveAutomationRuntimeEvent(admin, {
        organizationId,
        leadId: input.leadId,
        signalType: "rejected_action",
        channel: existing.channel ?? null,
        resourceId: existing.sequenceId ?? null,
        confidence: existing.confidenceScore ?? null,
        sourceEventId: input.actionId,
        policyMetadata: { reason: input.reason ?? null },
      })
    } catch {
      // Best-effort objective fan-in.
    }
  })()

  return { ok: true }
}

export { editGeV15LeadPreparedAction, executeGeV15ApprovedPreparedAction }
