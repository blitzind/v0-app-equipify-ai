import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import type { GrowthSenderPoolMemberStatus } from "@/lib/growth/sender-pools/sender-pool-types"
import type { SenderFatigueDetection } from "@/lib/growth/sender-pools/sender-fatigue"

export const GROWTH_SENDER_OPERATIONAL_PAUSE_REASONS = [
  "bounce_spike",
  "complaint_spike",
  "oauth_failure",
  "send_failure_threshold",
  "dns_failure",
  "provider_rejection",
  "high_volume_fatigue",
  "warmup_mismatch",
  "provider_degradation",
] as const

export type GrowthSenderOperationalPauseReason = (typeof GROWTH_SENDER_OPERATIONAL_PAUSE_REASONS)[number]

function membersTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sender_pool_members")
}

export async function updateSenderPoolMemberOperationalStatus(
  admin: SupabaseClient,
  input: {
    memberId: string
    memberStatus: GrowthSenderPoolMemberStatus
    operationalPauseReason?: string | null
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<void> {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    member_status: input.memberStatus,
    updated_at: now,
  }

  if (input.memberStatus === "paused" || input.memberStatus === "blocked") {
    patch.operational_pause_reason = input.operationalPauseReason ?? "operational_pause"
    patch.operational_paused_at = now
  } else if (input.memberStatus === "eligible") {
    patch.operational_pause_reason = null
    patch.operational_paused_at = null
  }

  const { data, error } = await membersTable(admin).update(patch).eq("id", input.memberId).select("sender_account_id, sender_pool_id").single()
  if (error) throw new Error(error.message)

  if (input.memberStatus === "paused" || input.memberStatus === "blocked") {
    await recordInternalOutboundAuditEvent(admin, {
      eventType: "sender_operational_pause",
      severity: "high",
      title: "Sender operationally paused",
      summary: input.operationalPauseReason ?? "Automatic operational pause applied.",
      senderAccountId: (data as { sender_account_id?: string }).sender_account_id ?? null,
      senderPoolId: (data as { sender_pool_id?: string }).sender_pool_id ?? null,
      actorUserId: input.actorUserId ?? "system",
      actorEmail: input.actorEmail ?? "growth.internal@equipify.internal",
      metadata: { member_status: input.memberStatus },
    })
  }
}

export function mapFatigueToOperationalPauseReason(signal: SenderFatigueDetection): GrowthSenderOperationalPauseReason {
  switch (signal.fatigueType) {
    case "bounce_spike":
      return "bounce_spike"
    case "complaint_spike":
      return "complaint_spike"
    case "provider_degradation":
      return "provider_degradation"
    case "warmup_mismatch":
      return "warmup_mismatch"
    case "high_recent_volume":
      return "high_volume_fatigue"
    default:
      return "provider_degradation"
  }
}

/** Auto-pause on critical fatigue — NO automatic re-enable. */
export async function applyOperationalPauseForFatigue(
  admin: SupabaseClient,
  input: {
    memberId: string
    senderAccountId: string
    senderPoolId: string
    signal: SenderFatigueDetection
    actorEmail?: string
  },
): Promise<boolean> {
  if (signal.severity !== "critical") return false

  const reason = mapFatigueToOperationalPauseReason(input.signal)
  await updateSenderPoolMemberOperationalStatus(admin, {
    memberId: input.memberId,
    memberStatus: "paused",
    operationalPauseReason: reason,
    actorUserId: "system",
    actorEmail: input.actorEmail ?? "growth.internal@equipify.internal",
  })
  return true
}

export function computeSenderHealthScore(input: {
  healthScore: number
  bounceRisk: number
  complaintRisk: number
  memberStatus: string
  dailyCapRemaining: number
}): number {
  let score = input.healthScore
  score -= Math.min(40, input.bounceRisk * 0.4)
  score -= Math.min(30, input.complaintRisk * 0.5)
  if (input.memberStatus === "paused" || input.memberStatus === "blocked") score = Math.min(score, 20)
  if (input.memberStatus === "cooldown") score = Math.min(score, 45)
  if (input.dailyCapRemaining <= 0) score = Math.min(score, 35)
  return Math.max(0, Math.round(score))
}

export function computeSenderFatigueScore(input: {
  recentVolume: number
  bounceRisk: number
  complaintRisk: number
  warmupProgress: number
  warmupEnabled: boolean
}): number {
  let fatigue = 0
  fatigue += Math.min(35, input.recentVolume / 20)
  fatigue += Math.min(35, input.bounceRisk * 0.5)
  fatigue += Math.min(25, input.complaintRisk * 0.8)
  if (input.warmupEnabled && input.warmupProgress < 30) fatigue += 15
  return Math.min(100, Math.round(fatigue))
}
