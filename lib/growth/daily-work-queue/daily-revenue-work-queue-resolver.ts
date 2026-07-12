/**
 * GE-AIOS-SDR-2A — Server resolver for daily revenue work queue.
 * Reuses native IRE bundle + lead engagement signals — no duplicate reasoning.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  buildLeadCommunicationStrategyTouchHistory,
  resolveLeadCommunicationStrategyBundle,
} from "@/lib/growth/contact-verification/lead-communication-strategy-resolver"
import { isDailyRevenueWorkQueueEnabled } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import { buildDailyRevenueWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-engine"
import type {
  DailyRevenueWorkQueue,
  DailyRevenueWorkQueueCapacityLimits,
  DailyRevenueWorkQueueCandidate,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import { adaptDailyRevenueWorkQueueToDisplaySummary } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-view"
import { resolveLeadDailyWorkQueueStatus } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-integration"
import { listGrowthLeads } from "@/lib/growth/lead-repository"
import {
  GROWTH_DAILY_WORK_QUEUE_LEAD_BATCH_LIMIT,
} from "@/lib/growth/relationship/relationship-scale-limits"
import type { GrowthLead } from "@/lib/growth/types"
import { shadowEvaluatePortfolioAllocation } from "@/lib/growth/portfolio-allocation/portfolio-allocation-facade"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { flattenActionableDailyRevenueWorkQueueItems } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-integration"

async function loadSuppressedLeadIds(admin: SupabaseClient): Promise<string[]> {
  try {
    const { data } = await admin
      .schema("growth")
      .from("suppression_entries")
      .select("lead_id")
      .not("lead_id", "is", null)
      .limit(500)
    return (data ?? [])
      .map((row) => (row as { lead_id?: string | null }).lead_id)
      .filter((id): id is string => Boolean(id))
  } catch {
    return []
  }
}

export async function resolveDailyRevenueWorkQueueForLeads(input: {
  admin: SupabaseClient
  leads: GrowthLead[]
  capacityLimits?: DailyRevenueWorkQueueCapacityLimits
  generatedAt?: string
}): Promise<DailyRevenueWorkQueue | null> {
  if (!isDailyRevenueWorkQueueEnabled()) return null

  const organizationId = getGrowthEngineAiOrgId()
  const candidates: DailyRevenueWorkQueueCandidate[] = []

  for (const lead of input.leads) {
    const bundle = await resolveLeadCommunicationStrategyBundle(lead, {
      organizationId,
      admin: input.admin,
    })
    if (!bundle.bundle?.stack || !bundle.bundle.communication_strategy) continue

    const { stack, communication_strategy, revenue_execution_plan } = bundle.bundle
    if (!revenue_execution_plan) continue

    candidates.push({
      leadId: lead.id,
      companyId: stack.qualification.companyId,
      qualification: stack.qualification,
      sequenceRecommendation: stack.sequence,
      nextBestAction: stack.nextBestAction,
      revenueExecutionPlan: revenue_execution_plan,
      communicationStrategy: communication_strategy,
      touchHistory: buildLeadCommunicationStrategyTouchHistory(lead),
      inboxState: {
        needsAction: (lead.metadata?.inboxNeedsAction as boolean | undefined) ?? false,
        unreadReplies: typeof lead.metadata?.unreadReplies === "number" ? lead.metadata.unreadReplies : 0,
      },
      replyIntelligence: {
        positiveReply: lead.contactTemperature === "hot",
        negativeReply: lead.callDisposition === "not_interested",
      },
      meetingState: {
        meetingToday: lead.metadata?.meetingToday === true,
        meetingScheduledAt:
          typeof lead.metadata?.meetingScheduledAt === "string" ? lead.metadata.meetingScheduledAt : null,
      },
      campaignState: {
        active: lead.workflowHealth === "active",
        enrollmentBlocked: lead.workflowHealth === "blocked",
      },
      assignedOwnerId: lead.assignedTo ?? null,
    })
  }

  if (candidates.length === 0) {
    return buildDailyRevenueWorkQueue({
      generatedAt: input.generatedAt,
      candidates: [],
      capacityLimits: input.capacityLimits,
    })
  }

  const suppressionList = await loadSuppressedLeadIds(input.admin)

  const queue = buildDailyRevenueWorkQueue({
    generatedAt: input.generatedAt,
    candidates,
    capacityLimits: input.capacityLimits,
    suppressionList,
  })

  // SV1-2 / ARCH-2A — Portfolio Allocation Facade shadow comparison vs Daily Revenue Work Queue.
  // Existing buildDailyRevenueWorkQueue remains the production selector.
  try {
    const actionable = flattenActionableDailyRevenueWorkQueueItems(queue)
    const slots =
      input.capacityLimits?.suggestedDailyItemCount ??
      queue.suggestedDailyCapacity ??
      35
    const existingSelected = actionable.slice(0, Math.min(slots, 10)).map((item) => item.leadId)
    const leadById = new Map(input.leads.map((lead) => [lead.id, lead]))

    await shadowEvaluatePortfolioAllocation(input.admin, {
      organizationId: organizationId || "unknown",
      capacityClass: "human_approval",
      capacitySlotsAvailable: Math.min(slots, 10),
      existingSelectedLeadIds: existingSelected,
      candidates: actionable.map((item) => {
        const lead = leadById.get(item.leadId)
        const resource = evaluateResourceAllocationFacade({
          organizationId: organizationId || "unknown",
          accountId: item.leadId,
          resourceClass: "other_scarce",
          signals: {
            admission: { state: "accepted" },
            budgetAvailable: true,
            evidenceConfidence: item.confidence,
            approvalRequired: item.requiresHumanApproval,
            approvalGranted: false,
          },
        })
        return {
          leadId: item.leadId,
          organizationId: organizationId || "unknown",
          companyName: lead?.companyName ?? null,
          investmentState: resource.investment_state,
          signals: {
            missionAligned: true,
            dailyQueueSortScore: item.sortScore,
            dailyQueuePriority: item.priority,
            urgencyScore: Math.round(item.confidence * 100),
            engagementScore: lead?.engagementScore ?? null,
          },
        }
      }),
    })
  } catch {
    // Shadow must never fail queue resolution.
  }

  return queue
}

export async function fetchDailyRevenueWorkQueueFromLeads(
  admin: SupabaseClient,
  leads: GrowthLead[],
  input?: { capacityLimits?: DailyRevenueWorkQueueCapacityLimits },
): Promise<{
  enabled: boolean
  queue: DailyRevenueWorkQueue | null
  display: ReturnType<typeof adaptDailyRevenueWorkQueueToDisplaySummary> | null
}> {
  if (!isDailyRevenueWorkQueueEnabled()) {
    return { enabled: false, queue: null, display: null }
  }

  const queue = await resolveDailyRevenueWorkQueueForLeads({
    admin,
    leads,
    capacityLimits: input?.capacityLimits,
  })
  const leadCompanyNames = Object.fromEntries(leads.map((lead) => [lead.id, lead.companyName]))

  return {
    enabled: true,
    queue,
    display: queue ? adaptDailyRevenueWorkQueueToDisplaySummary(queue, { leadCompanyNames }) : null,
  }
}

export async function fetchDailyRevenueWorkQueue(
  admin: SupabaseClient,
  input?: { limit?: number; capacityLimits?: DailyRevenueWorkQueueCapacityLimits },
): Promise<{
  enabled: boolean
  queue: DailyRevenueWorkQueue | null
  display: ReturnType<typeof adaptDailyRevenueWorkQueueToDisplaySummary> | null
}> {
  if (!isDailyRevenueWorkQueueEnabled()) {
    return { enabled: false, queue: null, display: null }
  }

  const leads = await listGrowthLeads(admin, { limit: input?.limit ?? GROWTH_DAILY_WORK_QUEUE_LEAD_BATCH_LIMIT })
  return fetchDailyRevenueWorkQueueFromLeads(admin, leads, {
    capacityLimits: input?.capacityLimits,
  })
}

export async function fetchDailyRevenueWorkQueueLeadStatus(
  admin: SupabaseClient,
  leadId: string,
): Promise<{
  enabled: boolean
  lead_status: ReturnType<typeof resolveLeadDailyWorkQueueStatus> | null
}> {
  const bundle = await fetchDailyRevenueWorkQueue(admin, { limit: GROWTH_DAILY_WORK_QUEUE_LEAD_BATCH_LIMIT })
  if (!bundle.enabled) return { enabled: false, lead_status: null }
  return {
    enabled: true,
    lead_status: resolveLeadDailyWorkQueueStatus(bundle.queue, leadId),
  }
}
