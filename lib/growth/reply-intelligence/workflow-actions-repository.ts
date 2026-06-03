import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthReplyWorkflowActionType } from "@/lib/growth/reply-intelligence/reply-intent-types"
import {
  categorizeReplyWorkflowAction,
  GROWTH_REPLY_WORKFLOW_CENTER_QA_MARKER,
  type GrowthReplyWorkflowActionDashboard,
  type GrowthReplyWorkflowActionRecord,
} from "@/lib/growth/reply-intelligence/workflow-actions-types"
import { listSequenceExitCandidates } from "@/lib/growth/reply-intelligence/sequence-exit-candidates-repository"

type WorkflowRow = {
  id: string
  reply_id: string | null
  lead_id: string
  action_type: string
  action_status: string
  severity: string
  title: string
  summary: string
  created_at: string
}

type ReplyJoin = {
  intent: string | null
  next_action: string | null
  body_preview: string | null
  received_at: string | null
}

export const GROWTH_REPLY_OPPORTUNITY_ROUTE_ACTION_TYPES = [
  "route_demo_scheduling",
  "route_pricing_response",
] as const

export const GROWTH_REPLY_SEQUENCE_EXIT_ACTION_TYPES = ["stop_sequence"] as const

function workflowTable(admin: SupabaseClient) {
  return admin.schema("growth").from("reply_workflow_actions")
}

export async function completePendingReplyWorkflowActions(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId?: string | null
    actionTypes: string[]
    actorUserId?: string | null
    workflowActionId?: string | null
  },
): Promise<void> {
  if (input.workflowActionId) {
    await updateReplyWorkflowActionStatus(admin, input.workflowActionId, {
      actionStatus: "completed",
      actorUserId: input.actorUserId,
    })
    return
  }

  let query = workflowTable(admin)
    .select("id")
    .eq("lead_id", input.leadId)
    .eq("action_status", "pending_review")
    .in("action_type", input.actionTypes)
  if (input.replyId) query = query.eq("reply_id", input.replyId)

  const { data } = await query
  for (const row of data ?? []) {
    await updateReplyWorkflowActionStatus(admin, String((row as { id: string }).id), {
      actionStatus: "completed",
      actorUserId: input.actorUserId,
    })
  }
}

export async function listReplyWorkflowActions(
  admin: SupabaseClient,
  input?: {
    leadId?: string
    status?: string | string[]
    actionType?: string | string[]
    limit?: number
  },
): Promise<GrowthReplyWorkflowActionRecord[]> {
  let query = workflowTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 50)

  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  if (input?.status) {
    query = Array.isArray(input.status) ? query.in("action_status", input.status) : query.eq("action_status", input.status)
  }
  if (input?.actionType) {
    query = Array.isArray(input.actionType)
      ? query.in("action_type", input.actionType)
      : query.eq("action_type", input.actionType)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as WorkflowRow[]
  const leadIds = [...new Set(rows.map((row) => row.lead_id))]
  const replyIds = [...new Set(rows.map((row) => row.reply_id).filter(Boolean))] as string[]

  const [leadsRes, repliesRes] = await Promise.all([
    leadIds.length
      ? admin.schema("growth").from("leads").select("id, company_name").in("id", leadIds)
      : Promise.resolve({ data: [], error: null }),
    replyIds.length
      ? admin
          .schema("growth")
          .from("outbound_replies")
          .select("id, intent, next_action, body_preview, received_at")
          .in("id", replyIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (leadsRes.error) throw new Error(leadsRes.error.message)
  if (repliesRes.error) throw new Error(repliesRes.error.message)

  const companyByLead = new Map(
    (leadsRes.data ?? []).map((row) => [String((row as { id: string }).id), String((row as { company_name: string }).company_name)]),
  )
  const replyById = new Map(
    (repliesRes.data ?? []).map((row) => {
      const record = row as ReplyJoin & { id: string }
      return [record.id, record]
    }),
  )

  return rows.map((row) => {
    const reply = row.reply_id ? replyById.get(row.reply_id) : null
    const actionType = row.action_type as GrowthReplyWorkflowActionType
    return {
      id: row.id,
      replyId: row.reply_id,
      leadId: row.lead_id,
      actionType,
      actionStatus: row.action_status,
      severity: row.severity,
      title: row.title,
      summary: row.summary,
      createdAt: row.created_at,
      companyName: companyByLead.get(row.lead_id) ?? null,
      replyIntent: reply?.intent ?? null,
      replyNextAction: reply?.next_action ?? null,
      replyBodyPreview: reply?.body_preview ?? null,
      replyReceivedAt: reply?.received_at ?? null,
      category: categorizeReplyWorkflowAction(actionType),
    }
  })
}

export async function fetchReplyWorkflowActionDashboard(
  admin: SupabaseClient,
): Promise<GrowthReplyWorkflowActionDashboard> {
  const pending = await listReplyWorkflowActions(admin, {
    status: "pending_review",
    limit: 200,
  })

  const sequenceExitPending = await listSequenceExitCandidates(admin, { pendingOnly: true, limit: 200 })

  return {
    qaMarker: GROWTH_REPLY_WORKFLOW_CENTER_QA_MARKER,
    pendingReviewCount: pending.length,
    interestedCount: pending.filter((row) => row.category === "interested").length,
    callTaskCount: pending.filter((row) => row.category === "call_task").length,
    followUpCount: pending.filter((row) => row.category === "follow_up").length,
    opportunityCount: pending.filter((row) => row.category === "opportunity").length,
    sequenceExitCount: sequenceExitPending.length,
  }
}

export async function updateReplyWorkflowActionStatus(
  admin: SupabaseClient,
  actionId: string,
  input: { actionStatus: string; actorUserId?: string | null },
): Promise<void> {
  const { error } = await workflowTable(admin)
    .update({
      action_status: input.actionStatus,
      actor_user_id: input.actorUserId ?? null,
    })
    .eq("id", actionId)
  if (error) throw new Error(error.message)
}

export async function fetchGrowthOutboundReplyById(
  admin: SupabaseClient,
  replyId: string,
): Promise<{
  id: string
  leadId: string
  bodyPreview: string | null
  intent: string | null
  nextAction: string | null
  recommendedOperatorAction: string | null
  receivedAt: string
  ownerUserId: string | null
} | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select(
      "id, lead_id, body_preview, intent, next_action, recommended_operator_action, received_at, owner_user_id",
    )
    .eq("id", replyId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as Record<string, unknown>
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    bodyPreview: (row.body_preview as string | null) ?? null,
    intent: (row.intent as string | null) ?? null,
    nextAction: (row.next_action as string | null) ?? null,
    recommendedOperatorAction: (row.recommended_operator_action as string | null) ?? null,
    receivedAt: String(row.received_at),
    ownerUserId: (row.owner_user_id as string | null) ?? null,
  }
}
