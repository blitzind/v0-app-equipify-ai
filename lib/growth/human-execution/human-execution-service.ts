import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchHumanExecutionDashboard,
  fetchHumanExecutionLeadView,
  fetchHumanExecutionQueue,
} from "@/lib/growth/human-execution/human-execution-dashboard-repository"
import {
  createHumanExecutionApprovalDraft,
  ensureHumanExecutionPlanForLead,
  fetchHumanExecutionApproval,
  listHumanExecutionApprovals,
  transitionHumanExecutionApproval,
} from "@/lib/growth/human-execution/human-execution-repository"
import type {
  GrowthHumanExecutionDashboard,
  GrowthHumanExecutionQueue,
  HumanExecutionApprovalStatus,
  HumanExecutionChannel,
  HumanExecutionLeadView,
} from "@/lib/growth/human-execution/human-execution-types"
import { resolveHumanExecutionSequenceTemplate } from "@/lib/growth/human-execution/human-execution-sequence-builder"
import { computeHumanExecutionReadiness } from "@/lib/growth/human-execution/human-execution-readiness-score"

export async function fetchGrowthHumanExecutionDashboardView(
  admin: SupabaseClient,
): Promise<GrowthHumanExecutionDashboard> {
  return fetchHumanExecutionDashboard(admin)
}

export async function fetchGrowthHumanExecutionQueueView(
  admin: SupabaseClient,
): Promise<GrowthHumanExecutionQueue> {
  return fetchHumanExecutionQueue(admin)
}

export async function fetchGrowthHumanExecutionLeadView(
  admin: SupabaseClient,
  leadId: string,
): Promise<HumanExecutionLeadView | null> {
  return fetchHumanExecutionLeadView(admin, leadId)
}

export async function fetchGrowthHumanExecutionApprovalsView(
  admin: SupabaseClient,
  input?: { leadId?: string; status?: HumanExecutionApprovalStatus | HumanExecutionApprovalStatus[] },
) {
  return listHumanExecutionApprovals(admin, input)
}

export async function createGrowthHumanExecutionApprovalDraft(
  admin: SupabaseClient,
  input: {
    leadId: string
    channel: HumanExecutionChannel
    title: string
    why: string
    ownerUserId?: string | null
    createdByUserId?: string | null
  },
) {
  const leadView = await fetchHumanExecutionLeadView(admin, input.leadId)
  const readiness =
    leadView?.readiness ??
    computeHumanExecutionReadiness({
      engagementScore: 40,
      daysSinceLastTouch: 7,
    })

  const templateKey = resolveHumanExecutionSequenceTemplate(readiness)
  await ensureHumanExecutionPlanForLead(admin, {
    leadId: input.leadId,
    templateKey,
    readinessScore: readiness.readinessScore,
    readinessBand: readiness.readinessBand,
    createdByUserId: input.createdByUserId,
  })

  return createHumanExecutionApprovalDraft(admin, {
    ...input,
    readinessScore: readiness.readinessScore,
    readinessBand: readiness.readinessBand,
    suggestedChannel: input.channel,
  })
}

export async function transitionGrowthHumanExecutionApproval(
  admin: SupabaseClient,
  input: { approvalId: string; toStatus: HumanExecutionApprovalStatus; actorUserId: string },
) {
  return transitionHumanExecutionApproval(admin, input)
}

export async function getGrowthHumanExecutionApproval(
  admin: SupabaseClient,
  approvalId: string,
) {
  return fetchHumanExecutionApproval(admin, approvalId)
}
