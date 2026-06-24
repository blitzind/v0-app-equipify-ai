import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { getWarmupProfile } from "@/lib/growth/warmup/warmup-repository"
import {
  evaluateWarmupThrottleClear,
  GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER,
} from "@/lib/growth/warmup/warmup-reputation-throttle-policy"
import { assessMailboxReputation } from "@/lib/growth/deliverability/mailbox-reputation-repository"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import {
  repairWarmupAlignedSenderHealthBatch,
  repairStaleWarmupThrottlesBatch,
  runWarmupProgressionForProfile,
} from "@/lib/growth/warmup/warmup-execution"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  const { id } = await context.params
  const before = await getWarmupProfile(access.admin, id)
  if (!before) {
    return NextResponse.json({ ok: false, error: "warmup_profile_not_found" }, { status: 404 })
  }

  if (before.status === "paused") {
    return NextResponse.json(
      {
        ok: false,
        error: "warmup_paused",
        message: "Use Resume Warmup for paused profiles.",
      },
      { status: 409 },
    )
  }

  try {
    const sender = await getSenderAccount(access.admin, before.sender_account_id)
    const reputation = await assessMailboxReputation(access.admin, before.sender_account_id).catch(() => null)
    const clearBefore = evaluateWarmupThrottleClear({
      profileWarmupHealth: before.warmup_health,
      profileStatus: before.status,
      senderStatus: sender?.status ?? null,
      senderHealthStatus: sender?.health_status ?? null,
      reputation,
    })

    const senderHealthRepair = await repairWarmupAlignedSenderHealthBatch(access.admin, {
      profileIds: [id],
    })
    const progression = await runWarmupProgressionForProfile(access.admin, id)
    const after = await getWarmupProfile(access.admin, id)

    const cleared = before.status === "throttled" && after?.status === "warming"
    const stillBlocked = before.status === "throttled" && after?.status === "throttled"

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER,
      sender_health_repair: senderHealthRepair,
      progression,
      profile: after,
      cleared_throttle: cleared,
      throttle_clear: {
        attempted: before.status === "throttled",
        cleared,
        still_blocked: stillBlocked,
        can_clear_before: clearBefore.canClear,
        reason_before: clearBefore.reason,
        reason_after: stillBlocked
          ? after?.throttle_reason ?? "Reputation protection still requires a full stop."
          : cleared
            ? clearBefore.reason
            : null,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "warmup_sync_progression_failed",
        message: error instanceof Error ? error.message : "Could not sync warmup progression.",
      },
      { status: 500 },
    )
  }
}
