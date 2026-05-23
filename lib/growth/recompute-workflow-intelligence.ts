import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadDecisionMakerById, listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { computeGrowthContactTemperature } from "@/lib/growth/outbound/contact-temperature"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import { computeGrowthLeadAging } from "@/lib/growth/lead-aging"
import { computeGrowthLeadMomentum } from "@/lib/growth/lead-momentum"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  countGrowthLeadTimelineEventsByType,
  hasGrowthLeadTimelineEventTypeSince,
} from "@/lib/growth/timeline-repository"
import { computeGrowthLeadWorkflowHealth } from "@/lib/growth/workflow-health"
import {
  fetchLatestUsableGrowthLeadResearchRun,
  listGrowthLeadResearchRuns,
} from "@/lib/growth/research-repository"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function recomputeGrowthLeadWorkflowIntelligence(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const now = new Date()
  const aging = computeGrowthLeadAging(lead.createdAt, now)

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

  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since45d = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString()
  const since14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [voicemailCount30d, voicemailCount45d, callAttemptCount14d, priorWebsiteFetchFailed] = await Promise.all([
    countGrowthLeadTimelineEventsByType(admin, leadId, "voicemail_left", since30d),
    countGrowthLeadTimelineEventsByType(admin, leadId, "voicemail_left", since45d),
    countGrowthLeadTimelineEventsByType(admin, leadId, "call_attempted", since14d),
    hasGrowthLeadTimelineEventTypeSince(admin, leadId, "website_fetch_failed"),
  ])

  const runs = await listGrowthLeadResearchRuns(admin, leadId, 2)
  const priorFitScore = runs.length > 1 ? runs[1].equipifyFitScore : null

  const emailSummary = await fetchGrowthLeadEmailEventSummary(admin, leadId, lead.contactEmail)

  const momentum = computeGrowthLeadMomentum({
    status: lead.status,
    score: lead.score,
    lastResearchedAt: lead.lastResearchedAt,
    latestResearchRunId: lead.latestResearchRunId,
    lastHumanTouchAt: lead.lastHumanTouchAt,
    firstHumanTouchAt: lead.firstHumanTouchAt,
    decisionMakerStatus: lead.decisionMakerStatus,
    callDisposition: lead.callDisposition,
    followUpAt: lead.followUpAt,
    websiteFetchStatus: latestRun?.websiteFetchStatus ?? null,
    priorWebsiteFetchFailed,
    priorFitScore,
    voicemailCount30d,
    callAttemptCount14d,
    emailSummary,
    now,
  })

  const health = computeGrowthLeadWorkflowHealth({
    status: lead.status,
    score: lead.score,
    contactPhone: lead.contactPhone,
    primaryDecisionMakerPhone,
    decisionMakerStatus: lead.decisionMakerStatus,
    lastResearchedAt: lead.lastResearchedAt,
    latestResearchRunId: lead.latestResearchRunId,
    lastHumanTouchAt: lead.lastHumanTouchAt,
    followUpAt: lead.followUpAt,
    websiteFetchStatus: latestRun?.websiteFetchStatus ?? null,
    website: lead.website,
    nextBestAction: lead.nextBestAction,
    agingBucket: aging.agingBucket,
    voicemailCount45d,
    emailSummary,
    now,
  })

  const contactTemperature = computeGrowthContactTemperature({ status: lead.status, emailSummary })

  const computedAt = now.toISOString()
  const { error } = await growthLeadsTable(admin)
    .update({
      aging_days: aging.agingDays,
      aging_bucket: aging.agingBucket,
      momentum_score: momentum.score,
      momentum_tier: momentum.tier,
      momentum_why_summary: momentum.whySummary,
      momentum_computed_at: computedAt,
      workflow_health: health.status,
      workflow_health_reason: health.reason,
      workflow_health_computed_at: computedAt,
      contact_temperature: contactTemperature,
    })
    .eq("id", leadId)

  if (error) {
    logGrowthEngine("workflow_intelligence_recompute_failed", { leadId, message: error.message })
    throw new Error(error.message)
  }

  logGrowthEngine("workflow_intelligence_recomputed", {
    leadId,
    agingBucket: aging.agingBucket,
    momentumScore: momentum.score,
    workflowHealth: health.status,
  })

  return fetchGrowthLeadById(admin, leadId)
}
