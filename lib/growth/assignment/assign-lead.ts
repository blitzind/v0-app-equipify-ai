import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthAssignmentSettings } from "@/lib/growth/assignment/assignment-settings-repository"
import { isManualAssignmentProtected } from "@/lib/growth/assignment/assignment-engine"
import type { GrowthLeadAssignmentSource } from "@/lib/growth/assignment/assignment-types"
import { fetchGrowthRepByUserId, touchGrowthRepLastAssigned } from "@/lib/growth/assignment/rep-roster-repository"
import { fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import {
  emitGrowthLeadAssignedTimeline,
  emitGrowthLeadReassignedTimeline,
  emitGrowthLeadUnassignedTimeline,
} from "@/lib/growth/timeline-emitter"
import { emitGrowthLeadAssignedNotification, emitGrowthLeadReassignedNotification } from "@/lib/growth/notifications/notification-integrations"
import { syncGrowthOpportunityOwnerFromLead } from "@/lib/growth/opportunity-pipeline/mutate-opportunity"
import type { GrowthLead } from "@/lib/growth/types"

function leadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export type AssignGrowthLeadResult =
  | { ok: true; lead: GrowthLead; event: "assigned" | "reassigned" | "unchanged" | "unassigned" }
  | { ok: false; code: string; message: string }

async function persistAssignment(
  admin: SupabaseClient,
  input: {
    leadId: string
    assignedTo: string | null
    assignedBy: string
    assignmentSource: GrowthLeadAssignmentSource | null
  },
): Promise<GrowthLead | null> {
  const patch: Record<string, unknown> = {
    assigned_to: input.assignedTo,
    assigned_by: input.assignedBy,
    assignment_source: input.assignmentSource,
    assigned_at: input.assignedTo ? new Date().toISOString() : null,
  }

  const { data, error } = await leadsTable(admin).update(patch).eq("id", input.leadId).select("*").maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  return lead
}

export async function assignGrowthLead(
  admin: SupabaseClient,
  input: {
    leadId: string
    assignedToUserId: string
    source: GrowthLeadAssignmentSource
    actingUserId: string
    actingUserEmail: string
    allowManualOverwrite?: boolean
    repLabel?: string | null
  },
): Promise<AssignGrowthLeadResult> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return { ok: false, code: "not_found", message: "Lead not found." }

  if (
    lead.assignedTo &&
    lead.assignedTo !== input.assignedToUserId &&
    isManualAssignmentProtected(lead.assignmentSource) &&
    input.source !== "manager_override" &&
    !input.allowManualOverwrite
  ) {
    return {
      ok: false,
      code: "manual_owner_protected",
      message: "Lead has a protected manual owner. Use manager override to reassign.",
    }
  }

  const rep = await fetchGrowthRepByUserId(admin, input.assignedToUserId)
  if (!rep || rep.status === "inactive") {
    return { ok: false, code: "rep_ineligible", message: "Selected rep is not eligible for assignment." }
  }
  if (rep.status === "paused") {
    return { ok: false, code: "rep_paused", message: "Selected rep is paused and cannot receive assignments." }
  }
  if (rep.isOverCapacity) {
    return { ok: false, code: "rep_over_capacity", message: "Selected rep is at active lead capacity." }
  }
  if (rep.dailyAssignmentCount >= rep.maxDailyNewAssignments) {
    return { ok: false, code: "rep_daily_limit", message: "Selected rep reached daily assignment limit." }
  }

  if (lead.assignedTo === input.assignedToUserId) {
    return { ok: true, lead, event: "unchanged" }
  }

  const previousOwnerId = lead.assignedTo
  const updated = await persistAssignment(admin, {
    leadId: input.leadId,
    assignedTo: input.assignedToUserId,
    assignedBy: input.actingUserId,
    assignmentSource: input.source,
  })
  if (!updated) return { ok: false, code: "update_failed", message: "Could not update lead assignment." }

  const label = input.repLabel ?? rep.displayName ?? rep.email

  if (!previousOwnerId) {
    await emitGrowthLeadAssignedTimeline(admin, {
      leadId: input.leadId,
      assignedToUserId: input.assignedToUserId,
      assignedToLabel: label,
      source: input.source,
      actor: { userId: input.actingUserId, email: input.actingUserEmail },
    })
  } else {
    await emitGrowthLeadReassignedTimeline(admin, {
      leadId: input.leadId,
      fromUserId: previousOwnerId,
      toUserId: input.assignedToUserId,
      toLabel: label,
      source: input.source,
      actor: { userId: input.actingUserId, email: input.actingUserEmail },
    })
  }

  await touchGrowthRepLastAssigned(admin, input.assignedToUserId)

  const enriched = (await recomputeGrowthLeadWorkflowSignals(admin, input.leadId)) ?? updated

  if (!previousOwnerId) {
    await emitGrowthLeadAssignedNotification(admin, {
      leadId: input.leadId,
      ownerUserId: input.assignedToUserId,
      companyName: enriched.companyName,
      sourceId: input.source,
    })
  } else {
    await emitGrowthLeadReassignedNotification(admin, {
      leadId: input.leadId,
      ownerUserId: input.assignedToUserId,
      companyName: enriched.companyName,
      sourceId: input.source,
    })
  }

  await syncGrowthOpportunityOwnerFromLead(admin, input.leadId)

  logGrowthEngine("lead_assigned", {
    leadId: input.leadId,
    assignedTo: input.assignedToUserId,
    source: input.source,
    previousOwnerId,
  })

  return {
    ok: true,
    lead: enriched,
    event: previousOwnerId ? "reassigned" : "assigned",
  }
}

export async function unassignGrowthLead(
  admin: SupabaseClient,
  input: {
    leadId: string
    actingUserId: string
    actingUserEmail: string
    reason?: string | null
  },
): Promise<AssignGrowthLeadResult> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return { ok: false, code: "not_found", message: "Lead not found." }
  if (!lead.assignedTo) return { ok: true, lead, event: "unchanged" }

  const previousOwnerId = lead.assignedTo
  const updated = await persistAssignment(admin, {
    leadId: input.leadId,
    assignedTo: null,
    assignedBy: input.actingUserId,
    assignmentSource: null,
  })
  if (!updated) return { ok: false, code: "update_failed", message: "Could not unassign lead." }

  await emitGrowthLeadUnassignedTimeline(admin, {
    leadId: input.leadId,
    previousOwnerId,
    reason: input.reason ?? null,
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  })

  const enriched = (await recomputeGrowthLeadWorkflowSignals(admin, input.leadId)) ?? updated

  logGrowthEngine("lead_unassigned", { leadId: input.leadId, previousOwnerId })

  return { ok: true, lead: enriched, event: "unassigned" }
}

export async function setGrowthLeadAssignmentOnImport(
  admin: SupabaseClient,
  input: {
    leadId: string
    assignedToUserId: string | null
    actingUserId: string
  },
): Promise<void> {
  if (!input.assignedToUserId) return
  await updateGrowthLead(admin, input.leadId, { assignedTo: input.assignedToUserId })
  await leadsTable(admin)
    .update({
      assigned_at: new Date().toISOString(),
      assigned_by: input.actingUserId,
      assignment_source: "import",
    })
    .eq("id", input.leadId)
}
