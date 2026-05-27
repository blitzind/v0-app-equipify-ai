/** Warmup ramp guidance — operational only, no fake placement claims. Client-safe. */

import type { GrowthWarmupRampGuidance } from "@/lib/growth/deliverability/reputation-protection-types"

export function buildWarmupRampGuidance(input: {
  sender_email: string
  warmup_enabled?: boolean
  warmup_status?: string | null
  warmup_progress?: number | null
  target_daily_volume?: number | null
  current_daily_volume?: number | null
  daily_increment?: number | null
  warmup_days?: number | null
  domain_age_note?: string | null
  daily_send_used?: number
  bounce_rate?: number
}): GrowthWarmupRampGuidance {
  const status = input.warmup_enabled
    ? (input.warmup_status ?? "warming")
    : input.warmup_status ?? "not_started"

  const target = input.target_daily_volume ?? 50
  const current = input.current_daily_volume ?? Math.min(target, 10)
  const increment = input.daily_increment ?? 5
  const totalDays = input.warmup_days ?? 21
  const progress = input.warmup_progress ?? null

  const rampDay =
    progress != null && totalDays > 0 ? Math.max(1, Math.round((progress / 100) * totalDays)) : null

  const recommended = input.warmup_enabled
    ? Math.min(target, current + (rampDay != null ? rampDay * increment : increment))
    : Math.min(target, 25)

  const guidance: string[] = []
  if (!input.warmup_enabled) {
    guidance.push("Warmup not active — keep daily volume conservative until ramp is configured.")
  } else {
    guidance.push(`Recommended max ${recommended} sends/day during warmup.`)
    guidance.push(`Ramp increment ${increment}/day over ~${totalDays} days.`)
  }

  if (input.domain_age_note) guidance.push(`Domain note: ${input.domain_age_note}`)
  if ((input.bounce_rate ?? 0) >= 4) guidance.push("Unsafe to scale — bounce rate elevated during warmup.")

  const unsafe =
    (input.bounce_rate ?? 0) >= 5 ||
    ((input.daily_send_used ?? 0) > recommended && input.warmup_enabled === true)

  if (unsafe) guidance.push("Unsafe to scale — operator review required before increasing volume.")

  return {
    warmup_status: status,
    recommended_max_daily_volume: recommended,
    current_ramp_day: rampDay,
    ramp_schedule_label: rampDay ? `Day ${rampDay} of ${totalDays}` : `Target ${totalDays}-day ramp`,
    unsafe_to_scale: unsafe,
    progress_pct: progress,
    guidance,
  }
}
