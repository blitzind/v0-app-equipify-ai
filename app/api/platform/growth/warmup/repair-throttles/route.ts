import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import {
  repairStaleWarmupThrottlesBatch,
  repairWarmupAlignedSenderHealthBatch,
} from "@/lib/growth/warmup/warmup-execution"
import { GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER } from "@/lib/growth/warmup/warmup-reputation-throttle-policy"
import { GROWTH_WARMUP_HEALTH_FIX_1K_QA_MARKER } from "@/lib/growth/warmup/warmup-sender-health-gate"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  try {
    let profileIds: string[] | undefined
    try {
      const body = (await request.json()) as { profile_ids?: string[] }
      if (Array.isArray(body.profile_ids) && body.profile_ids.length > 0) {
        profileIds = body.profile_ids
      }
    } catch {
      profileIds = undefined
    }

    const senderHealthRepair = await repairWarmupAlignedSenderHealthBatch(access.admin, { profileIds })
    const throttleRepair = await repairStaleWarmupThrottlesBatch(access.admin, { profileIds })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER,
      sender_health_qa_marker: GROWTH_WARMUP_HEALTH_FIX_1K_QA_MARKER,
      sender_health_repair: senderHealthRepair,
      throttle_repair: throttleRepair,
      cleared_count: throttleRepair.cleared,
      still_blocked_count: throttleRepair.still_blocked,
      message:
        throttleRepair.cleared > 0
          ? `Cleared ${throttleRepair.cleared} stale warmup throttle(s). ${throttleRepair.still_blocked} still blocked.`
          : throttleRepair.still_blocked > 0
            ? `${throttleRepair.still_blocked} profile(s) remain throttled — see blocked_details for reasons.`
            : "No throttled profiles required repair.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "warmup_throttle_repair_failed",
        message: error instanceof Error ? error.message : "Could not repair warmup throttles.",
      },
      { status: 500 },
    )
  }
}
