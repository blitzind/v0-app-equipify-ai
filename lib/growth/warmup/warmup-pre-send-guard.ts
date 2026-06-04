import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import type { GrowthWarmupPreSendResult } from "@/lib/growth/warmup/warmup-execution-types"
import { getWarmupProfileForSender, resolveWarmupDailyCapacity } from "@/lib/growth/warmup/warmup-execution"

function utcDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export async function evaluateWarmupPreSendAllowed(
  admin: SupabaseClient,
  input: { senderAccountId: string },
): Promise<GrowthWarmupPreSendResult> {
  const profile = await getWarmupProfileForSender(admin, input.senderAccountId)
  if (!profile) {
    return {
      allowed: true,
      reason: null,
      blockCode: null,
      daily_cap: null,
      sends_today: null,
      current_warmup_day: null,
      profile_status: null,
    }
  }

  const today = utcDateString()
  const sendsToday = profile.sends_today_date === today ? profile.sends_today : 0
  const dailyCap = resolveWarmupDailyCapacity(profile)

  const base = {
    daily_cap: dailyCap,
    sends_today: sendsToday,
    current_warmup_day: profile.current_warmup_day,
    profile_status: profile.status,
  }

  if (profile.status === "disabled") {
    return {
      allowed: false,
      reason: "Mailbox warmup is disabled.",
      blockCode: "warmup_disabled",
      ...base,
    }
  }

  if (profile.status === "paused") {
    return {
      allowed: false,
      reason: "Mailbox warmup is paused by operator.",
      blockCode: "warmup_paused",
      ...base,
    }
  }

  if (profile.status === "new") {
    return {
      allowed: false,
      reason: "Warmup schedule not started — generate schedule before sending.",
      blockCode: "warmup_not_started",
      ...base,
    }
  }

  if (profile.status === "active") {
    return {
      allowed: true,
      reason: null,
      blockCode: null,
      ...base,
    }
  }

  if (profile.status === "throttled") {
    const reason = profile.throttle_reason ?? "Warmup throttled — reputation protection active."
    await recordInternalOutboundAuditEvent(admin, {
      eventType: "pre_send_blocked",
      severity: "high",
      title: "Send blocked — warmup throttled",
      summary: reason,
      senderAccountId: input.senderAccountId,
      metadata: { block_code: "warmup_throttled", warmup_profile_id: profile.id },
    }).catch(() => undefined)

    return {
      allowed: false,
      reason,
      blockCode: "warmup_throttled",
      ...base,
    }
  }

  if (profile.status === "warming" && sendsToday >= dailyCap) {
    const reason = `Warmup daily cap reached (${sendsToday}/${dailyCap}).`
    await recordInternalOutboundAuditEvent(admin, {
      eventType: "pre_send_blocked",
      severity: "medium",
      title: "Send blocked — warmup daily cap",
      summary: reason,
      senderAccountId: input.senderAccountId,
      metadata: { block_code: "warmup_cap_exhausted", warmup_profile_id: profile.id },
    }).catch(() => undefined)

    return {
      allowed: false,
      reason,
      blockCode: "warmup_cap_exhausted",
      ...base,
    }
  }

  return {
    allowed: true,
    reason: null,
    blockCode: null,
    ...base,
  }
}
