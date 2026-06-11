/** Opportunity Draft queue — server-only review actions, no CRM or opportunity creation. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  buildOpportunityDraftQueueSnapshot,
  evaluateOpportunityDraftApprovalGate,
  mapOpportunityDraftDbRow,
  mapOpportunityDraftRowToArtifacts,
  OPPORTUNITY_DRAFT_SAFETY_FLAGS,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-evidence"
import { generateAndPersistOpportunityDraft } from "@/lib/growth/meeting-intelligence/opportunity-draft-service"
import { confirmCreateOpportunityFromDraft } from "@/lib/growth/meeting-intelligence/opportunity-approval-service"
import type {
  OpportunityApprovalDraftEdits,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-engine-types"
import type {
  OpportunityDraftActionResult,
  OpportunityDraftQueueSnapshot,
  OpportunityDraftStatus,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import { OPPORTUNITY_DRAFT_ENGINE_QA_MARKER } from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"

export {
  OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
  type OpportunityDraftQueueSnapshot,
  type OpportunityDraftActionResult,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"

const TABLE = "opportunity_drafts"

function emptyResult(
  action: OpportunityDraftActionResult["action"],
  error: string,
): OpportunityDraftActionResult {
  return {
    ok: false,
    action,
    draft_id: null,
    status: null,
    artifacts: null,
    error,
    ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
  }
}

export async function loadOpportunityDraftQueue(
  admin: SupabaseClient,
  input?: {
    meeting_id?: string | null
    lead_id?: string | null
    status?: OpportunityDraftStatus | "all"
    limit?: number
  },
): Promise<OpportunityDraftQueueSnapshot> {
  let query = admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 100)

  if (input?.meeting_id?.trim()) {
    query = query.eq("meeting_id", input.meeting_id.trim())
  }
  if (input?.lead_id?.trim()) {
    query = query.eq("lead_id", input.lead_id.trim())
  }

  const status = input?.status ?? "draft"
  if (status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const items = ((data ?? []) as Record<string, unknown>[]).map(mapOpportunityDraftDbRow)
  return buildOpportunityDraftQueueSnapshot({ items })
}

export async function approveOpportunityDraft(
  admin: SupabaseClient,
  input: {
    draft_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<OpportunityDraftActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", input.draft_id)
    .maybeSingle()

  if (error) return emptyResult("approve_opportunity_draft", error.message)
  if (!data) return emptyResult("approve_opportunity_draft", "opportunity_draft_not_found")

  const draft = mapOpportunityDraftDbRow(data as Record<string, unknown>)
  const gate = evaluateOpportunityDraftApprovalGate({ draft })
  if (!gate.allowed) {
    return emptyResult("approve_opportunity_draft", gate.code ?? "approval_blocked")
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "approved",
      approved_at: now,
      approved_by: input.approver_user_id ?? null,
      approved_email: input.approver_email ?? null,
      opportunity_created: false,
      crm_written: false,
      deal_created: false,
      calendar_written: false,
      updated_at: now,
      metadata: {
        qa_marker: OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
        approval_note: input.note?.trim() || null,
      },
    })
    .eq("id", input.draft_id)

  if (updateError) return emptyResult("approve_opportunity_draft", updateError.message)

  await logGrowthEngine("opportunity_draft_approved", {
    draft_id: draft.draft_id,
    meeting_id: draft.meeting_id,
    ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
  })

  return {
    ok: true,
    action: "approve_opportunity_draft",
    draft_id: draft.draft_id,
    status: "approved",
    artifacts: mapOpportunityDraftRowToArtifacts(draft),
    ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
  }
}

export async function rejectOpportunityDraft(
  admin: SupabaseClient,
  input: {
    draft_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<OpportunityDraftActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("id, status")
    .eq("id", input.draft_id)
    .maybeSingle()

  if (error) return emptyResult("reject_opportunity_draft", error.message)
  if (!data) return emptyResult("reject_opportunity_draft", "opportunity_draft_not_found")
  if (data.status !== "draft") {
    return emptyResult("reject_opportunity_draft", "invalid_draft_status")
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "rejected",
      rejection_note: input.note?.trim() || null,
      approved_by: input.approver_user_id ?? null,
      approved_email: input.approver_email ?? null,
      opportunity_created: false,
      crm_written: false,
      deal_created: false,
      calendar_written: false,
      updated_at: now,
      metadata: { qa_marker: OPPORTUNITY_DRAFT_ENGINE_QA_MARKER },
    })
    .eq("id", input.draft_id)

  if (updateError) return emptyResult("reject_opportunity_draft", updateError.message)

  return {
    ok: true,
    action: "reject_opportunity_draft",
    draft_id: input.draft_id,
    status: "rejected",
    artifacts: null,
    ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
  }
}

export async function regenerateOpportunityDraft(
  admin: SupabaseClient,
  input: {
    draft_id: string
    actor_user_id?: string | null
    actor_email?: string | null
  },
): Promise<OpportunityDraftActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("id, meeting_id, status")
    .eq("id", input.draft_id)
    .maybeSingle()

  if (error) return emptyResult("regenerate_opportunity_draft", error.message)
  if (!data) return emptyResult("regenerate_opportunity_draft", "opportunity_draft_not_found")

  const meetingId = typeof data.meeting_id === "string" ? data.meeting_id : ""
  if (!meetingId) return emptyResult("regenerate_opportunity_draft", "meeting_id_missing")

  const generated = await generateAndPersistOpportunityDraft(admin, {
    meeting_id: meetingId,
    actor_user_id: input.actor_user_id,
    actor_email: input.actor_email,
    regenerate: true,
    trigger: "manual",
  })

  if (!generated.ok || !generated.draft) {
    return emptyResult("regenerate_opportunity_draft", generated.error ?? "regeneration_failed")
  }

  return {
    ok: true,
    action: "regenerate_opportunity_draft",
    draft_id: generated.draft.draft_id,
    status: generated.draft.status,
    artifacts: generated.artifacts,
    ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
  }
}

export async function createOpportunityFromApprovedDraft(
  admin: SupabaseClient,
  input: {
    draft_id: string
    operator_id?: string | null
    operator_email?: string | null
    edits?: OpportunityApprovalDraftEdits
  },
): Promise<OpportunityDraftActionResult> {
  const result = await confirmCreateOpportunityFromDraft(admin, {
    opportunity_draft_id: input.draft_id,
    operator_id: input.operator_id,
    operator_email: input.operator_email,
    edits: input.edits,
  })

  if (!result.ok) {
    return {
      ok: false,
      action: "create_opportunity",
      draft_id: input.draft_id,
      status: result.draft_status,
      artifacts: null,
      opportunity_id: null,
      attribution_chain: result.attribution_chain,
      error: result.error ?? "create_opportunity_failed",
      ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
    }
  }

  return {
    ok: true,
    action: "create_opportunity",
    draft_id: result.draft_id,
    status: result.draft_status,
    artifacts: null,
    opportunity_id: result.opportunity_id,
    attribution_chain: result.attribution_chain,
    ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
  }
}
