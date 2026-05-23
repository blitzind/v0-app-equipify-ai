import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadDecisionMakerById, listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import { computeGrowthLeadNextBestAction } from "@/lib/growth/next-best-action"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowIntelligence } from "@/lib/growth/recompute-workflow-intelligence"
import { fetchLatestUsableGrowthLeadResearchRun } from "@/lib/growth/research-repository"
import { emitGrowthLeadNextBestActionChangedTimeline } from "@/lib/growth/timeline-emitter"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function recomputeGrowthLeadNextBestAction(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const latestRun = lead.latestResearchRunId
    ? await fetchLatestUsableGrowthLeadResearchRun(admin, leadId)
    : null

  let primaryDecisionMakerPhone: string | null = null
  if (lead.primaryDecisionMakerId) {
    const primary = await fetchGrowthLeadDecisionMakerById(admin, leadId, lead.primaryDecisionMakerId)
    primaryDecisionMakerPhone = primary?.phone ?? null
  } else {
    const decisionMakers = await listGrowthLeadDecisionMakers(admin, leadId)
    primaryDecisionMakerPhone = decisionMakers.find((dm) => dm.isPrimary)?.phone ?? decisionMakers[0]?.phone ?? null
  }

  const emailSummary = await fetchGrowthLeadEmailEventSummary(admin, leadId, lead.contactEmail)

  const nba = computeGrowthLeadNextBestAction({
    status: lead.status,
    score: lead.score,
    website: lead.website,
    websiteFetchStatus: latestRun?.websiteFetchStatus ?? null,
    lastResearchedAt: lead.lastResearchedAt,
    latestResearchRunId: lead.latestResearchRunId,
    contactPhone: lead.contactPhone,
    callDisposition: lead.callDisposition,
    followUpAt: lead.followUpAt,
    recommendedNextAction: latestRun?.result?.recommendedNextAction ?? null,
    decisionMakerStatus: lead.decisionMakerStatus,
    primaryDecisionMakerPhone,
    emailSummary,
  })

  const now = new Date().toISOString()
  const { error } = await growthLeadsTable(admin)
    .update({
      next_best_action: nba.action,
      next_best_action_reason: nba.reason,
      next_best_action_computed_at: now,
    })
    .eq("id", leadId)

  if (error) {
    logGrowthEngine("next_best_action_recompute_failed", { leadId, message: error.message })
    throw new Error(error.message)
  }

  if (lead.nextBestAction !== nba.action) {
    await emitGrowthLeadNextBestActionChangedTimeline(admin, {
      leadId,
      from: lead.nextBestAction,
      to: nba.action,
      reason: nba.reason,
    })
  }

  logGrowthEngine("next_best_action_recomputed", {
    leadId,
    action: nba.action,
    confidence: nba.confidence,
  })

  return fetchGrowthLeadById(admin, leadId)
}

export async function recomputeGrowthLeadWorkflowSignals(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const { recomputeGrowthLeadDecisionMakerStatus } = await import("@/lib/growth/decision-maker-repository")
  const { recomputeGrowthLeadCallPriority } = await import("@/lib/growth/recompute-lead-call-priority")

  await recomputeGrowthLeadDecisionMakerStatus(admin, leadId)
  await recomputeGrowthLeadCallPriority(admin, leadId)
  await recomputeGrowthLeadNextBestAction(admin, leadId)
  return recomputeGrowthLeadWorkflowIntelligence(admin, leadId)
}
