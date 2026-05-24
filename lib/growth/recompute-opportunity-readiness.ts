import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { computeGrowthLeadOpportunityReadiness } from "@/lib/growth/opportunity-readiness-score"
import { computeOpportunityAgeBucket } from "@/lib/growth/opportunity-age-bucket"
import {
  CRITICAL_OPPORTUNITY_BLOCKER_KEYS,
  type GrowthOpportunityBlockerKey,
} from "@/lib/growth/opportunity-types"
import { computeOpportunityReadinessTrend } from "@/lib/growth/opportunity-trend"
import {
  diffOpportunityBlockerKeys,
  fetchGrowthLeadOpportunityReadinessInput,
} from "@/lib/growth/opportunity-signals"
import {
  emitGrowthOpportunityAtRiskNotification,
  emitGrowthStaleOpportunityNotification,
} from "@/lib/growth/notifications/notification-integrations"
import {
  emitGrowthLeadBecamePriorityOpportunityTimeline,
  emitGrowthLeadBecameSalesReadyTimeline,
  emitGrowthLeadOpportunityBlockerAddedTimeline,
  emitGrowthLeadOpportunityBlockerResolvedTimeline,
  emitGrowthLeadOpportunityReadinessChangedTimeline,
} from "@/lib/growth/timeline-emitter"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function recomputeGrowthLeadOpportunityReadiness(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const input = await fetchGrowthLeadOpportunityReadinessInput(admin, lead)
  const preliminary = computeGrowthLeadOpportunityReadiness(input)

  const prevBlockers = lead.opportunityBlockers ?? []
  const blockerDiff = diffOpportunityBlockerKeys(prevBlockers, preliminary.blockers)
  const newCriticalBlocker = blockerDiff.added.some((key) =>
    CRITICAL_OPPORTUNITY_BLOCKER_KEYS.has(key as GrowthOpportunityBlockerKey),
  )
  const resolvedCriticalBlocker = blockerDiff.resolved.some((key) =>
    CRITICAL_OPPORTUNITY_BLOCKER_KEYS.has(key as GrowthOpportunityBlockerKey),
  )

  const trend = computeOpportunityReadinessTrend({
    previousScore: lead.opportunityReadinessScore,
    currentScore: preliminary.score,
    previousTrend: lead.opportunityReadinessTrend,
    newCriticalBlocker,
    resolvedCriticalBlocker,
  })

  const ageBucket = computeOpportunityAgeBucket({
    createdAt: input.createdAt,
    tier: preliminary.tier,
    trend,
    engagementLastActivityAt: input.engagementLastActivityAt,
    relationshipLastMeaningfulTouchAt: input.relationshipLastMeaningfulTouchAt,
    now: input.now ?? new Date(),
  })

  const result = { ...preliminary, trend, ageBucket }
  const now = new Date().toISOString()

  const { error } = await growthLeadsTable(admin)
    .update({
      opportunity_readiness_score: result.score,
      opportunity_readiness_tier: result.tier,
      opportunity_readiness_summary: result.summary,
      opportunity_readiness_top_signals: result.topSignals,
      opportunity_blockers: result.blockers,
      opportunity_accelerators: result.accelerators,
      opportunity_readiness_trend: result.trend,
      opportunity_readiness_previous_score: lead.opportunityReadinessScore,
      opportunity_buying_signal_strength: result.buyingSignalStrength,
      opportunity_readiness_confidence: result.confidence,
      opportunity_age_bucket: result.ageBucket,
      opportunity_readiness_computed_at: now,
    })
    .eq("id", leadId)

  if (error) {
    logGrowthEngine("opportunity_readiness_recompute_failed", { leadId, message: error.message })
    throw new Error(error.message)
  }

  const prevScore = lead.opportunityReadinessScore
  const prevTier = lead.opportunityReadinessTier

  if (prevScore != null && Math.abs(prevScore - result.score) >= 5) {
    await emitGrowthLeadOpportunityReadinessChangedTimeline(admin, {
      leadId,
      from: prevScore,
      to: result.score,
      summary: result.summary,
    })
  }

  if (prevTier !== "sales_ready" && result.tier === "sales_ready") {
    await emitGrowthLeadBecameSalesReadyTimeline(admin, { leadId, score: result.score })
  }

  if (prevTier !== "priority_opportunity" && result.tier === "priority_opportunity") {
    await emitGrowthLeadBecamePriorityOpportunityTimeline(admin, { leadId, score: result.score })
  }

  for (const key of blockerDiff.added) {
    const blocker = result.blockers.find((entry) => entry.key === key)
    await emitGrowthLeadOpportunityBlockerAddedTimeline(admin, {
      leadId,
      key,
      label: blocker?.label ?? key,
    })
  }

  for (const key of blockerDiff.resolved) {
    const prevBlocker = prevBlockers.find((entry) => entry.key === key)
    await emitGrowthLeadOpportunityBlockerResolvedTimeline(admin, {
      leadId,
      key,
      label: prevBlocker?.label ?? key,
    })
  }

  const updatedLead = await fetchGrowthLeadById(admin, leadId)
  if (updatedLead) {
    if (
      result.trend === "declining" &&
      (result.tier === "sales_ready" || result.tier === "priority_opportunity")
    ) {
      await emitGrowthOpportunityAtRiskNotification(admin, {
        leadId,
        companyName: updatedLead.companyName,
        score: result.score,
        ownerUserId: updatedLead.assignedTo,
      })
    }
    if (result.ageBucket === "stalled") {
      await emitGrowthStaleOpportunityNotification(admin, {
        leadId,
        companyName: updatedLead.companyName,
        ownerUserId: updatedLead.assignedTo,
      })
    }
  }

  logGrowthEngine("opportunity_readiness_recomputed", {
    leadId,
    score: result.score,
    tier: result.tier,
    trend: result.trend,
    buyingSignalStrength: result.buyingSignalStrength,
    confidence: result.confidence,
    ageBucket: result.ageBucket,
    blockerCount: result.blockers.length,
  })

  return fetchGrowthLeadById(admin, leadId)
}
