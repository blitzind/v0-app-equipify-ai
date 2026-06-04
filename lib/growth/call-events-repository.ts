import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { GrowthLeadCallDisposition, GrowthLeadCallEvent } from "@/lib/growth/call-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { recordGrowthLeadHumanTouch } from "@/lib/growth/first-human-touch"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { recomputeGrowthLeadCallCounts } from "@/lib/growth/communication/recompute-lead-call-counts"
import {
  emitGrowthLeadCallDispositionTimeline,
  emitGrowthLeadFollowUpCompletedTimeline,
  emitGrowthLeadStatusChangedTimeline,
} from "@/lib/growth/timeline-emitter"
import type { GrowthLeadStatus } from "@/lib/growth/types"

type CallEventDbRow = {
  id: string
  lead_id: string
  disposition: string
  note: string | null
  follow_up_at: string | null
  call_priority_score: number | null
  created_by: string | null
  created_at: string
}

function callEventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_call_events")
}

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function mapCallEventRow(row: CallEventDbRow): GrowthLeadCallEvent {
  return {
    id: row.id,
    leadId: row.lead_id,
    disposition: row.disposition as GrowthLeadCallDisposition,
    note: row.note,
    followUpAt: row.follow_up_at,
    callPriorityScore: row.call_priority_score,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

function dispositionStatusPatch(disposition: GrowthLeadCallDisposition): Partial<{ status: GrowthLeadStatus; follow_up_at: string | null }> {
  switch (disposition) {
    case "interested":
      return { status: "qualified" }
    case "not_a_fit":
      return { status: "disqualified", follow_up_at: null }
    case "follow_up_later":
      return {}
    default:
      return { follow_up_at: null }
  }
}

export async function recordGrowthLeadCallEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    disposition: GrowthLeadCallDisposition
    note?: string | null
    followUpAt?: string | null
    createdBy: string | null
  },
): Promise<{ event: GrowthLeadCallEvent; lead: NonNullable<Awaited<ReturnType<typeof fetchGrowthLeadById>>> }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    throw new Error("not_found")
  }

  if (input.disposition === "follow_up_later" && !input.followUpAt) {
    throw new Error("follow_up_at_required")
  }

  const now = new Date().toISOString()
  const statusPatch = dispositionStatusPatch(input.disposition)

  const { data: eventRow, error: eventError } = await callEventsTable(admin)
    .insert({
      lead_id: input.leadId,
      disposition: input.disposition,
      note: input.note?.trim() ? input.note.trim() : null,
      follow_up_at: input.disposition === "follow_up_later" ? input.followUpAt : null,
      call_priority_score: lead.callPriorityScore,
      created_by: input.createdBy,
    })
    .select("id, lead_id, disposition, note, follow_up_at, call_priority_score, created_by, created_at")
    .single()

  if (eventError) {
    logGrowthEngine("call_event_insert_failed", {
      leadId: input.leadId,
      disposition: input.disposition,
      message: eventError.message,
    })
    throw new Error(eventError.message)
  }

  const leadPatch: Record<string, unknown> = {
    call_disposition: input.disposition,
    call_disposition_at: now,
    last_call_at: now,
    ...statusPatch,
  }

  if (input.disposition === "follow_up_later") {
    leadPatch.follow_up_at = input.followUpAt
  } else if (statusPatch.follow_up_at === null) {
    leadPatch.follow_up_at = null
  }

  const { error: leadError } = await growthLeadsTable(admin).update(leadPatch).eq("id", input.leadId)
  if (leadError) {
    throw new Error(leadError.message)
  }

  await recordGrowthLeadHumanTouch(admin, input.leadId, now)

  if (
    lead.callDisposition === "follow_up_later" &&
    lead.followUpAt &&
    input.disposition !== "follow_up_later"
  ) {
    await emitGrowthLeadFollowUpCompletedTimeline(admin, {
      leadId: input.leadId,
      followUpAt: lead.followUpAt,
    })
  }

  if (statusPatch.status && statusPatch.status !== lead.status) {
    await emitGrowthLeadStatusChangedTimeline(admin, {
      leadId: input.leadId,
      from: lead.status,
      to: statusPatch.status,
    })
  }

  await emitGrowthLeadCallDispositionTimeline(admin, {
    leadId: input.leadId,
    disposition: input.disposition,
    callEventId: eventRow.id,
    followUpAt: input.disposition === "follow_up_later" ? input.followUpAt : null,
  })

  await recomputeGrowthLeadCallCounts(admin, input.leadId)

  const updatedLead = await recomputeGrowthLeadWorkflowSignals(admin, input.leadId)
  if (!updatedLead) {
    throw new Error("lead_update_failed")
  }

  const { recordAttributionTouch } = await import("@/lib/growth/revenue-attribution/record-attribution-touch")
  await recordAttributionTouch(admin, {
    touchType: "call",
    leadId: input.leadId,
    repUserId: input.createdBy ?? lead.assignedTo ?? null,
    attributionSource: "call_disposition",
    attributionConfidence: 0.85,
    metadata: { disposition: input.disposition, call_event_id: eventRow.id },
  }).catch(() => undefined)

  logGrowthEngine("call_event_recorded", {
    leadId: input.leadId,
    disposition: input.disposition,
    eventId: eventRow.id,
  })

  return {
    event: mapCallEventRow(eventRow as CallEventDbRow),
    lead: updatedLead,
  }
}
