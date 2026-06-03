import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"
import { fetchGrowthLeadDecisionMakerById } from "@/lib/growth/decision-maker-repository"
import { insertGrowthCadenceTaskRow } from "@/lib/growth/cadence/cadence-task-repository"
import { createGrowthOpportunity } from "@/lib/growth/opportunity-pipeline/mutate-opportunity"
import { fetchGrowthOpportunityByLeadId } from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { leadHasCallablePhone } from "@/lib/growth/reply-intelligence/process-reply-intelligence"
import {
  completePendingReplyWorkflowActions,
  fetchGrowthOutboundReplyById,
  GROWTH_REPLY_OPPORTUNITY_ROUTE_ACTION_TYPES,
  updateReplyWorkflowActionStatus,
} from "@/lib/growth/reply-intelligence/workflow-actions-repository"
import type { GrowthReplyOpportunityDraft } from "@/lib/growth/reply-intelligence/workflow-actions-types"
import type { GrowthOpportunityStageKey, GrowthOpportunityForecastCategory, GrowthOpportunityPriority } from "@/lib/growth/opportunity-pipeline/pipeline-types"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import { emitGrowthLeadStatusChangedTimeline } from "@/lib/growth/timeline-emitter"
import type { GrowthLead, GrowthLeadStatus } from "@/lib/growth/types"

type Actor = { userId?: string | null; email?: string | null }

const MARK_INTERESTED_STATUS_RANK: Partial<Record<GrowthLeadStatus, number>> = {
  new: 0,
  researching: 1,
  enriched: 2,
  qualified: 3,
  in_outreach: 4,
  replied: 5,
  call_ready: 6,
  converted: 7,
}

async function resolveDmPhone(admin: SupabaseClient, leadId: string, dmId: string | null): Promise<string | null> {
  if (!dmId) return null
  const dm = await fetchGrowthLeadDecisionMakerById(admin, leadId, dmId)
  return dm?.phone ?? null
}

function resolveMarkInterestedStatus(lead: GrowthLead, dmPhone: string | null): GrowthLeadStatus {
  const targetStatus: GrowthLeadStatus = leadHasCallablePhone(lead, dmPhone) ? "call_ready" : "replied"
  const currentRank = MARK_INTERESTED_STATUS_RANK[lead.status]
  const targetRank = MARK_INTERESTED_STATUS_RANK[targetStatus]
  if (currentRank !== undefined && targetRank !== undefined && currentRank >= targetRank) {
    return lead.status
  }
  return targetStatus
}

export async function markLeadInterestedFromReply(
  admin: SupabaseClient,
  input: { leadId: string; replyId?: string | null; workflowActionId?: string | null; actor?: Actor },
): Promise<{ leadId: string; status: GrowthLeadStatus }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("lead_not_found")

  const dmPhone = await resolveDmPhone(admin, lead.id, lead.primaryDecisionMakerId)
  const nextStatus = resolveMarkInterestedStatus(lead, dmPhone)

  if (nextStatus !== lead.status) {
    await updateGrowthLead(admin, input.leadId, { status: nextStatus })
    await emitGrowthLeadStatusChangedTimeline(admin, {
      leadId: input.leadId,
      from: lead.status,
      to: nextStatus,
    })
  }

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "lead_marked_interested",
    title: "Lead marked interested",
    summary: "Operator confirmed buying interest from inbound reply.",
    outboundReplyId: input.replyId ?? undefined,
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
    payload: { source: "reply_workflow", reply_id: input.replyId ?? null },
  })

  await completePendingReplyWorkflowActions(admin, {
    leadId: input.leadId,
    replyId: input.replyId,
    actionTypes: ["mark_interested"],
    actorUserId: input.actor?.userId,
    workflowActionId: input.workflowActionId,
  })

  await recomputeGrowthLeadWorkflowSignals(admin, input.leadId)
  return { leadId: input.leadId, status: nextStatus }
}

export async function createCallTaskFromReply(
  admin: SupabaseClient,
  input: { leadId: string; replyId?: string | null; workflowActionId?: string | null; actor?: Actor },
): Promise<{ taskId: string }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("lead_not_found")

  const reply = input.replyId ? await fetchGrowthOutboundReplyById(admin, input.replyId) : null
  const ownerUserId = lead.assignedTo ?? reply?.ownerUserId ?? input.actor?.userId ?? null
  const dueAt = new Date()
  dueAt.setHours(dueAt.getHours() + 4)

  const task = await insertGrowthCadenceTaskRow(admin, {
    owner_user_id: ownerUserId,
    lead_id: input.leadId,
    channel: "call",
    title: `Call ${lead.companyName}`,
    instructions: reply?.recommendedOperatorAction
      ? `Reply intelligence: ${reply.recommendedOperatorAction}`
      : reply?.bodyPreview
        ? `Follow up on inbound reply: ${reply.bodyPreview.slice(0, 280)}`
        : "Place follow-up call after inbound reply.",
    due_at: dueAt.toISOString(),
    status: "open",
    priority: "high",
  })

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "call_task_created",
    title: "Call task created",
    summary: `Operator created call task for ${lead.companyName}.`,
    outboundReplyId: input.replyId ?? undefined,
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
    payload: { cadence_task_id: task.id, source: "reply_workflow" },
  })

  await completePendingReplyWorkflowActions(admin, {
    leadId: input.leadId,
    replyId: input.replyId,
    actionTypes: ["create_call_task"],
    actorUserId: input.actor?.userId,
    workflowActionId: input.workflowActionId,
  })

  await recomputeGrowthLeadWorkflowSignals(admin, input.leadId)
  return { taskId: task.id }
}

export async function createFollowUpTaskFromReply(
  admin: SupabaseClient,
  input: { leadId: string; replyId?: string | null; workflowActionId?: string | null; actor?: Actor },
): Promise<{ taskId: string }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("lead_not_found")

  const reply = input.replyId ? await fetchGrowthOutboundReplyById(admin, input.replyId) : null
  const ownerUserId = lead.assignedTo ?? reply?.ownerUserId ?? input.actor?.userId ?? null
  const dueAt = new Date()
  dueAt.setHours(dueAt.getHours() + 24)

  const task = await insertGrowthCadenceTaskRow(admin, {
    owner_user_id: ownerUserId,
    lead_id: input.leadId,
    channel: "manual_follow_up",
    title: `Follow up with ${lead.companyName}`,
    instructions: reply?.recommendedOperatorAction
      ? `Reply intelligence: ${reply.recommendedOperatorAction}`
      : reply?.bodyPreview
        ? `Follow up on inbound reply: ${reply.bodyPreview.slice(0, 280)}`
        : "Complete follow-up after inbound reply.",
    due_at: dueAt.toISOString(),
    status: "open",
    priority: "medium",
  })

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "follow_up_created",
    title: "Follow-up task created",
    summary: `Operator created follow-up task for ${lead.companyName}.`,
    outboundReplyId: input.replyId ?? undefined,
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
    payload: { cadence_task_id: task.id, source: "reply_workflow" },
  })

  await completePendingReplyWorkflowActions(admin, {
    leadId: input.leadId,
    replyId: input.replyId,
    actionTypes: ["create_follow_up_task"],
    actorUserId: input.actor?.userId,
    workflowActionId: input.workflowActionId,
  })

  await recomputeGrowthLeadWorkflowSignals(admin, input.leadId)
  return { taskId: task.id }
}

export async function buildOpportunityDraftFromReply(
  admin: SupabaseClient,
  input: { leadId: string; replyId?: string | null },
): Promise<GrowthReplyOpportunityDraft> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("lead_not_found")

  const reply = input.replyId ? await fetchGrowthOutboundReplyById(admin, input.replyId) : null
  const existing = await fetchGrowthOpportunityByLeadId(admin, input.leadId)

  const interestedIntents = new Set(["positive_interest", "meeting_request", "demo_request", "pricing_question"])
  const stageKey: GrowthOpportunityStageKey =
    reply?.intent && interestedIntents.has(reply.intent) ? "qualified" : "new_opportunity"
  const priority =
    reply?.intent === "demo_request" || reply?.intent === "meeting_request"
      ? "high"
      : reply?.intent === "positive_interest"
        ? "medium"
        : "medium"

  return {
    leadId: input.leadId,
    replyId: input.replyId ?? null,
    companyName: lead.companyName,
    title: `${lead.companyName} — inbound interest`,
    stageKey,
    amount: 0,
    forecastCategory: "pipeline",
    priority,
    source: "reply_intelligence",
    summary: reply?.bodyPreview?.slice(0, 500) ?? "Opportunity from inbound reply intelligence.",
    recommendedOperatorAction: reply?.recommendedOperatorAction ?? null,
    intent: reply?.intent ?? null,
    ...(existing ? { existingOpportunityId: existing.id } : {}),
  }
}

export async function confirmCreateOpportunityFromReply(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId?: string | null
    workflowActionId?: string | null
    title: string
    amount?: number
    stageKey?: string
    forecastCategory?: string
    priority?: string
    expectedCloseDate?: string | null
    actor?: Actor
  },
): Promise<{ opportunityId: string }> {
  const existing = await fetchGrowthOpportunityByLeadId(admin, input.leadId)
  if (existing) throw new Error("opportunity_already_exists")

  const result = await createGrowthOpportunity(admin, {
    leadId: input.leadId,
    title: input.title,
    amount: input.amount ?? 0,
    stageKey: (input.stageKey as GrowthOpportunityStageKey | undefined) ?? "new_opportunity",
    forecastCategory: (input.forecastCategory as GrowthOpportunityForecastCategory | undefined) ?? "pipeline",
    priority: (input.priority as GrowthOpportunityPriority | undefined) ?? "medium",
    expectedCloseDate: input.expectedCloseDate ?? null,
    source: "reply_intelligence",
    actor: input.actor,
  })

  if (!result.ok) throw new Error(result.code)

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "opportunity_created_from_reply",
    title: "Opportunity created from reply",
    summary: `Operator confirmed opportunity: ${input.title}.`,
    outboundReplyId: input.replyId ?? undefined,
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
    payload: { opportunity_id: result.opportunity.id, source: "reply_workflow" },
  })

  await completePendingReplyWorkflowActions(admin, {
    leadId: input.leadId,
    replyId: input.replyId,
    actionTypes: [...GROWTH_REPLY_OPPORTUNITY_ROUTE_ACTION_TYPES],
    actorUserId: input.actor?.userId,
    workflowActionId: input.workflowActionId,
  })

  await recomputeGrowthLeadWorkflowSignals(admin, input.leadId)
  return { opportunityId: result.opportunity.id }
}

export async function dismissReplyWorkflowAction(
  admin: SupabaseClient,
  input: { workflowActionId: string; actor?: Actor },
): Promise<void> {
  await updateReplyWorkflowActionStatus(admin, input.workflowActionId, {
    actionStatus: "rejected",
    actorUserId: input.actor?.userId,
  })
}
