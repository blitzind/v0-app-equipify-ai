import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthInfrastructureFitAssessment } from "@/lib/growth/outbound/lifecycle-ops-types"
import { runCampaignLaunchPreflight } from "@/lib/growth/outbound/campaign-launch-preflight"
import { computeThroughputUtilization } from "@/lib/growth/outbound/throughput-allocator"
import { listInboxLifecycleRows } from "@/lib/growth/outbound/inbox-lifecycle-engine"

export async function assessInfrastructureFit(
  admin: SupabaseClient,
  input: {
    senderPoolId: string
    campaignSize?: number
    campaignId?: string | null
    sequenceEnrollmentId?: string | null
  },
): Promise<GrowthInfrastructureFitAssessment> {
  const preflight = await runCampaignLaunchPreflight(admin, {
    senderPoolId: input.senderPoolId,
    campaignId: input.campaignId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
  })

  const throughput = await computeThroughputUtilization(admin)
  const lifecycleRows = await listInboxLifecycleRows(admin)
  const activeSenders = lifecycleRows.filter((r) => r.lifecycleStage === "active")
  const avgTrust =
    activeSenders.length > 0
      ? Math.round(activeSenders.reduce((sum, r) => sum + r.trustScore, 0) / activeSenders.length)
      : 0

  const poolThroughput = throughput.filter((t) => t.entityType === "pool")
  const poolHeadroom = poolThroughput.reduce((sum, p) => sum + Math.max(0, p.dailyLimit - p.dailyUsed), 0)

  let infrastructureFitScore = preflight.readinessStatus === "ready" ? 85 : preflight.readinessStatus === "degraded" ? 55 : 25
  infrastructureFitScore = Math.min(100, infrastructureFitScore + Math.round(avgTrust * 0.1))
  if (poolHeadroom < (input.campaignSize ?? 50)) infrastructureFitScore = Math.max(0, infrastructureFitScore - 20)

  let launchReadinessScore = infrastructureFitScore
  if (preflight.blockers.length > 0) launchReadinessScore = Math.min(launchReadinessScore, 40)

  const recommendations: string[] = []
  if (poolHeadroom < (input.campaignSize ?? 50)) {
    recommendations.push("Recommend safer launch pacing — pool headroom below campaign size.")
  }
  if (avgTrust < 60) recommendations.push("Recommend sender redistribution — average trust score low.")
  if (activeSenders.length < 2) recommendations.push("Recommend adding active senders before large campaign launch.")
  recommendations.push(...preflight.checklist.filter((c) => !c.passed).map((c) => c.label))

  await admin.schema("growth").from("infrastructure_fit_assessments").insert({
    campaign_id: input.campaignId ?? null,
    sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
    sender_pool_id: input.senderPoolId,
    infrastructure_fit_score: infrastructureFitScore,
    launch_readiness_score: launchReadinessScore,
    recommendations,
    blockers: preflight.blockers,
    metadata: { campaign_size: input.campaignSize ?? null, avg_trust: avgTrust, pool_headroom: poolHeadroom },
  })

  return {
    infrastructureFitScore,
    launchReadinessScore,
    recommendations,
    blockers: preflight.blockers,
    advisoryOnly: true,
  }
}
