import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import {
  repairStaleWarmupThrottlesBatch,
  repairWarmupAlignedSenderHealthBatch,
} from "@/lib/growth/warmup/warmup-execution"
import { GROWTH_WARMUP_HEALTH_FIX_1K_QA_MARKER } from "@/lib/growth/warmup/warmup-sender-health-gate"
import { GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER } from "@/lib/growth/warmup/warmup-reputation-throttle-policy"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  try {
    const repair = await repairWarmupAlignedSenderHealthBatch(access.admin)
    const throttleRepair = await repairStaleWarmupThrottlesBatch(access.admin)
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_WARMUP_HEALTH_FIX_1K_QA_MARKER,
      reputation_throttle_qa_marker: GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER,
      repair,
      throttle_repair: throttleRepair,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "warmup_sender_health_repair_failed",
        message: error instanceof Error ? error.message : "Could not repair warmup sender health.",
      },
      { status: 500 },
    )
  }
}
