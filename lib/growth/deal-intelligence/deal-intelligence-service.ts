import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { gatherDealScoreContext } from "@/lib/growth/deal-intelligence/deal-score-inputs"
import { computeDealIntelligenceScore } from "@/lib/growth/deal-intelligence/deal-score-engine"
import type {
  DealIntelligenceDashboardSummary,
  DealIntelligenceScorePublicView,
} from "@/lib/growth/deal-intelligence/deal-intelligence-types"
import {
  emitDealIntelligenceNotifications,
  type DealIntelligenceNotificationContext,
} from "@/lib/growth/deal-intelligence/deal-intelligence-notification-integrations"
import {
  fetchActiveDealIntelligenceScore,
  fetchDealIntelligenceDashboardSummary,
  insertDealIntelligenceScore,
  logDealIntelligence,
} from "@/lib/growth/deal-intelligence/deal-intelligence-repository"
import { fetchGrowthOpportunityByLeadId } from "@/lib/growth/opportunity-pipeline/pipeline-repository"

export type RecomputeDealIntelligenceInput = {
  admin: SupabaseClient
  leadId: string
  opportunityId?: string | null
}

export type RecomputeDealIntelligenceResult =
  | { ok: true; score: DealIntelligenceScorePublicView; previousScore: DealIntelligenceScorePublicView | null }
  | { ok: false; code: string; message: string }

export async function recomputeDealIntelligenceScore(
  input: RecomputeDealIntelligenceInput,
): Promise<RecomputeDealIntelligenceResult> {
  try {
    let opportunityId = input.opportunityId ?? null
    if (!opportunityId) {
      const opportunity = await fetchGrowthOpportunityByLeadId(input.admin, input.leadId)
      opportunityId = opportunity?.id ?? null
    }

    const previousScore = await fetchActiveDealIntelligenceScore(input.admin, {
      opportunityId,
      leadId: opportunityId ? undefined : input.leadId,
    })

    const context = await gatherDealScoreContext({
      admin: input.admin,
      leadId: input.leadId,
      opportunityId,
    })

    const computed = computeDealIntelligenceScore({
      companyName: context.lead.companyName,
      scoreInputs: context.scoreInputs,
      expectedCloseDate: context.opportunity?.expectedCloseDate ?? null,
    })

    const score = await insertDealIntelligenceScore(input.admin, {
      leadId: input.leadId,
      opportunityId,
      ownerUserId: context.opportunity?.ownerUserId ?? context.lead.assignedTo ?? null,
      computed,
    })

    const notificationContext: DealIntelligenceNotificationContext = {
      leadId: input.leadId,
      opportunityId,
      companyName: context.lead.companyName,
      ownerUserId: score.ownerUserId,
      score,
      previousScore,
    }
    await emitDealIntelligenceNotifications(input.admin, notificationContext)

    logDealIntelligence("recomputed", {
      leadId: input.leadId,
      opportunityId,
      scoreId: score.id,
      closeProbability: score.closeProbability,
      riskLevel: score.riskLevel,
      recommendedOperatorAction: score.recommendedOperatorAction,
    })

    return { ok: true, score, previousScore }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logDealIntelligence("recompute_failed", { leadId: input.leadId, message })
    return { ok: false, code: "recompute_failed", message }
  }
}

export async function loadDealIntelligenceForOpportunity(
  admin: SupabaseClient,
  opportunityId: string,
): Promise<{ score: DealIntelligenceScorePublicView | null; leadId: string | null }> {
  const score = await fetchActiveDealIntelligenceScore(admin, { opportunityId })
  return { score, leadId: score?.leadId ?? null }
}

export async function loadDealIntelligenceForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<DealIntelligenceScorePublicView | null> {
  const opportunity = await fetchGrowthOpportunityByLeadId(admin, leadId)
  if (opportunity) {
    const score = await fetchActiveDealIntelligenceScore(admin, { opportunityId: opportunity.id })
    if (score) return score
  }
  return fetchActiveDealIntelligenceScore(admin, { leadId })
}

export async function fetchGrowthDealIntelligenceDashboard(
  admin: SupabaseClient,
): Promise<DealIntelligenceDashboardSummary> {
  return fetchDealIntelligenceDashboardSummary(admin)
}
