import "server-only"

import { commandLeadFocusHref } from "@/lib/growth/command/command-action-catalog"
import type {
  HumanExecutionApprovalItem,
  HumanExecutionApprovalStatus,
  HumanExecutionChannel,
  HumanExecutionPlanStatus,
  HumanExecutionReadinessBand,
} from "@/lib/growth/human-execution/human-execution-types"
import {
  HUMAN_EXECUTION_APPROVAL_STATUS_LABELS,
  HUMAN_EXECUTION_CHANNEL_LABELS,
  HUMAN_EXECUTION_REPLY_ROUTE_LABELS,
} from "@/lib/growth/human-execution/human-execution-types"
import { humanExecutionReplyRouteFromString } from "@/lib/growth/human-execution/human-execution-reply-router"

type ApprovalRow = {
  id: string
  lead_id: string
  plan_id: string | null
  plan_step_id: string | null
  channel: string
  approval_status: string
  readiness_score: number
  readiness_band: string
  title: string
  why: string
  suggested_channel: string | null
  suggested_timing: string | null
  owner_user_id: string | null
  reply_routing: string | null
  created_at: string
  updated_at: string
  leads?: { company_name?: string | null } | Array<{ company_name?: string | null }> | null
}

export function mapHumanExecutionApprovalRow(row: ApprovalRow): HumanExecutionApprovalItem {
  const leadJoin = Array.isArray(row.leads) ? row.leads[0] : row.leads
  const channel = row.channel as HumanExecutionChannel
  const replyRoute = humanExecutionReplyRouteFromString(row.reply_routing)

  return {
    id: row.id,
    leadId: row.lead_id,
    companyName: leadJoin?.company_name ?? "Lead",
    planId: row.plan_id,
    planStepId: row.plan_step_id,
    channel,
    channelLabel: HUMAN_EXECUTION_CHANNEL_LABELS[channel] ?? channel,
    approvalStatus: row.approval_status as HumanExecutionApprovalStatus,
    readinessScore: row.readiness_score,
    readinessBand: row.readiness_band as HumanExecutionReadinessBand,
    title: row.title,
    why: row.why,
    suggestedChannel: (row.suggested_channel as HumanExecutionChannel | null) ?? null,
    suggestedTiming: row.suggested_timing,
    ownerUserId: row.owner_user_id,
    replyRouting: replyRoute,
    replyRoutingLabel: replyRoute ? HUMAN_EXECUTION_REPLY_ROUTE_LABELS[replyRoute] : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ctaHref: `/admin/growth/execution?approvalId=${row.id}`,
  }
}

export function humanExecutionLeadDrawerHref(leadId: string): string {
  return commandLeadFocusHref(leadId, "execution")
}

export function humanExecutionApprovalStatusLabel(status: HumanExecutionApprovalStatus): string {
  return HUMAN_EXECUTION_APPROVAL_STATUS_LABELS[status]
}

export function humanExecutionPlanStatusLabel(status: HumanExecutionPlanStatus): string {
  if (status === "active") return "Active"
  if (status === "paused") return "Paused"
  if (status === "completed") return "Complete"
  if (status === "cancelled") return "Cancelled"
  return "Draft"
}
