import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeDomainReadiness } from "@/lib/growth/infrastructure/domain-readiness"
import { isDomainSegmentCompatible } from "@/lib/growth/outbound/domain-segmentation"
import type { GrowthDomainSegment } from "@/lib/growth/outbound/reputation-safe-scaling-types"
import { listSenderDomains } from "@/lib/growth/sender/sender-repository"
import { getSenderPool, listSenderPoolMembers } from "@/lib/growth/sender-pools/sender-pool-repository"
import { buildSenderPoolMemberContext } from "@/lib/growth/sender-pools/sender-pool-rotation-service"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import { googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"

export type CampaignLaunchChecklistItem = {
  id: string
  label: string
  passed: boolean
  blocking: boolean
  detail?: string
}

export type CampaignLaunchPreflightResult = {
  readinessStatus: "ready" | "degraded" | "blocked"
  checklist: CampaignLaunchChecklistItem[]
  blockers: string[]
  canLaunch: boolean
  operatorOverrideAllowed: boolean
}

export async function runCampaignLaunchPreflight(
  admin: SupabaseClient,
  input: {
    senderPoolId: string
    domainSegment?: GrowthDomainSegment | null
    campaignId?: string | null
    sequenceEnrollmentId?: string | null
    actorUserId?: string
    operatorOverride?: boolean
    operatorOverrideReason?: string | null
  },
): Promise<CampaignLaunchPreflightResult> {
  const checklist: CampaignLaunchChecklistItem[] = []
  const blockers: string[] = []

  const pool = await getSenderPool(admin, input.senderPoolId)
  checklist.push({
    id: "pool_active",
    label: "Sender pool active",
    passed: Boolean(pool && pool.status === "active"),
    blocking: true,
    detail: pool ? `Pool status: ${pool.status}` : "Pool not found",
  })
  if (!pool || pool.status !== "active") blockers.push("Sender pool not active.")

  const oauthOk = googleProviderOAuthConfigured()
  checklist.push({
    id: "google_oauth",
    label: "Google OAuth configured (live path)",
    passed: oauthOk,
    blocking: false,
    detail: oauthOk ? "Live Google path available." : "Stub/preview — live sends may be blocked.",
  })

  const members = pool ? await listSenderPoolMembers(admin, pool.id) : []
  const routes = await listDeliveryRoutes(admin)
  const contexts = (await Promise.all(members.map((m) => buildSenderPoolMemberContext(admin, m, routes)))).filter(Boolean)
  const eligible = contexts.filter((c) => c!.memberStatus === "eligible" && c!.dailyCapRemaining > 0)
  checklist.push({
    id: "eligible_senders",
    label: "Eligible senders with capacity",
    passed: eligible.length > 0,
    blocking: true,
    detail: `${eligible.length} eligible of ${members.length} members`,
  })
  if (eligible.length === 0) blockers.push("No eligible senders with remaining daily capacity.")

  const domains = await listSenderDomains(admin)
  const domainSegments = new Set(domains.map((d) => d.domain_segment))
  const segmentOk = [...domainSegments].some((seg) =>
    isDomainSegmentCompatible(input.domainSegment ?? "primary", seg as GrowthDomainSegment),
  )
  checklist.push({
    id: "domain_segment",
    label: "Domain segment compatible with campaign",
    passed: segmentOk,
    blocking: true,
    detail: `Campaign segment: ${input.domainSegment ?? "primary"}`,
  })
  if (!segmentOk) blockers.push("No compatible domain segment for campaign assignment.")

  const unhealthyDomains = domains.filter((d) => {
    const readiness = computeDomainReadiness(d)
    return readiness.readinessStatus === "error" || d.operational_status === "paused"
  })
  checklist.push({
    id: "domain_health",
    label: "No critical/paused domains in registry",
    passed: unhealthyDomains.length === 0,
    blocking: true,
    detail: unhealthyDomains.length ? `${unhealthyDomains.length} domain(s) blocked` : "All domains pass preflight",
  })
  if (unhealthyDomains.length > 0) blockers.push("One or more domains are critical or paused.")

  const readinessStatus: CampaignLaunchPreflightResult["readinessStatus"] =
    blockers.length > 0 ? (input.operatorOverride ? "degraded" : "blocked") : "ready"

  const result: CampaignLaunchPreflightResult = {
    readinessStatus,
    checklist,
    blockers,
    canLaunch: blockers.length === 0 || Boolean(input.operatorOverride),
    operatorOverrideAllowed: true,
  }

  await admin.schema("growth").from("campaign_launch_checks").insert({
    campaign_id: input.campaignId ?? null,
    sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
    sender_pool_id: input.senderPoolId,
    domain_segment: input.domainSegment ?? null,
    readiness_status: result.readinessStatus,
    checklist: result.checklist,
    blockers: result.blockers,
    operator_override: Boolean(input.operatorOverride),
    operator_override_reason: input.operatorOverrideReason ?? null,
    actor_user_id: input.actorUserId ?? null,
  })

  return result
}
