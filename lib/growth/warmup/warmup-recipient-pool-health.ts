/** GS-WARMUP-FIX-1A — recipient pool health + selection diagnostics (client-safe). */

import type { GrowthWarmupRecipient } from "@/lib/growth/warmup/warmup-executor-types"

export const GROWTH_WARMUP_RECIPIENT_POOL_FIX_1A_QA_MARKER = "growth-warmup-recipient-pool-fix-1a-v1" as const

export const WARMUP_RECIPIENT_POOL_HEALTH_TIERS = ["healthy", "warning", "critical"] as const

export type WarmupRecipientPoolHealthTier = (typeof WARMUP_RECIPIENT_POOL_HEALTH_TIERS)[number]

export type WarmupRecipientSelectionDiagnostics = {
  totalApprovedRecipients: number
  recipientsWithRemainingCapacity: number
  excludedBySenderDedup: number
  excludedByDailyCap: number
  excludedByWeeklyCap: number
  availableForSender: number
}

export type WarmupRecipientPoolHealth = {
  tier: WarmupRecipientPoolHealthTier
  approvedRecipients: number
  availableGlobally: number
  availableForSender: number | null
  warmingSenderCount: number
  availableRecipientsPerSender: number | null
  message: string
  recommendations: string[]
}

export type WarmupRecipientSelectionFailureCode =
  | "no_recipients"
  | "recipient_daily_cap"
  | "recipient_weekly_cap"
  | "per_sender_dedup_exhausted"
  | "recipient_pool_exhausted_for_sender"

export function computeWarmupRecipientPoolHealth(input: {
  approvedRecipients: number
  availableGlobally: number
  availableForSender?: number | null
  warmingSenderCount: number
}): WarmupRecipientPoolHealth {
  const recommendations: string[] = []
  const availableRecipientsPerSender =
    input.warmingSenderCount > 0
      ? Math.floor(input.availableGlobally / input.warmingSenderCount)
      : input.availableGlobally

  let tier: WarmupRecipientPoolHealthTier = "healthy"
  let message = "Recipient pool has sufficient approved contacts for warmup pacing."

  if (input.approvedRecipients === 0) {
    tier = "critical"
    message = "No approved warmup recipients configured."
    recommendations.push("Add and approve at least one warmup recipient.")
  } else if (input.availableGlobally === 0) {
    tier = "critical"
    message = "All approved recipients reached daily or weekly caps."
    recommendations.push("Add more approved recipients.")
    recommendations.push("Increase recipient daily or weekly caps if appropriate.")
  } else if (input.availableForSender === 0 && input.warmingSenderCount > 0) {
    tier = "critical"
    message = "This sender has already used every available approved recipient today."
    recommendations.push("Add more approved recipients to increase sender diversity.")
    recommendations.push("Per-sender daily dedup is working — expand the recipient network.")
  } else if (
    input.warmingSenderCount > 0 &&
    input.approvedRecipients < input.warmingSenderCount
  ) {
    tier = "critical"
    message = `Only ${input.approvedRecipients} approved recipient(s) for ${input.warmingSenderCount} warming sender(s) — per-sender dedup will exhaust quickly.`
    recommendations.push("Add more approved recipients than warming senders.")
    recommendations.push("Increase recipient diversity so each sender can rotate contacts.")
  } else if (availableRecipientsPerSender != null && availableRecipientsPerSender <= 5) {
    tier = "warning"
    message = `Low recipient diversity (~${availableRecipientsPerSender} globally available recipient(s) per warming sender).`
    recommendations.push("Add more approved recipients before per-sender dedup exhausts.")
  } else if (availableRecipientsPerSender != null && availableRecipientsPerSender <= 10) {
    tier = "warning"
    message = `Recipient pool is thin (~${availableRecipientsPerSender} globally available recipient(s) per warming sender).`
    recommendations.push("Plan additional approved recipients to avoid hourly dedup skips.")
  }

  if (tier !== "critical" && input.approvedRecipients > 0 && input.approvedRecipients < 10) {
    recommendations.push("Target more than 10 approved recipients for healthy per-sender rotation.")
  }

  return {
    tier,
    approvedRecipients: input.approvedRecipients,
    availableGlobally: input.availableGlobally,
    availableForSender: input.availableForSender ?? null,
    warmingSenderCount: input.warmingSenderCount,
    availableRecipientsPerSender,
    message,
    recommendations: [...new Set(recommendations)],
  }
}

export function resolveWarmupRecipientSelectionFailure(input: {
  diagnostics: WarmupRecipientSelectionDiagnostics
}): { code: WarmupRecipientSelectionFailureCode; message: string } {
  const { diagnostics } = input
  const eligibleCount = diagnostics.totalApprovedRecipients

  if (eligibleCount === 0) {
    return {
      code: "no_recipients",
      message: "No active approved warmup recipients available.",
    }
  }

  if (diagnostics.availableForSender > 0) {
    return {
      code: "recipient_pool_exhausted_for_sender",
      message: "No warmup recipient could be selected for this sender.",
    }
  }

  if (
    diagnostics.excludedBySenderDedup === eligibleCount ||
    (diagnostics.excludedBySenderDedup > 0 &&
      diagnostics.recipientsWithRemainingCapacity > 0 &&
      diagnostics.excludedByDailyCap === 0 &&
      diagnostics.excludedByWeeklyCap === 0)
  ) {
    return {
      code: "per_sender_dedup_exhausted",
      message:
        "This sender has already used every available approved recipient today (per-sender daily dedup).",
    }
  }

  if (diagnostics.excludedByDailyCap === eligibleCount) {
    return {
      code: "recipient_daily_cap",
      message: "All approved recipients reached their daily caps.",
    }
  }

  if (diagnostics.excludedByWeeklyCap === eligibleCount) {
    return {
      code: "recipient_weekly_cap",
      message: "All approved recipients reached their weekly caps.",
    }
  }

  if (diagnostics.excludedBySenderDedup > 0 && diagnostics.recipientsWithRemainingCapacity > 0) {
    return {
      code: "per_sender_dedup_exhausted",
      message:
        "This sender has already used every available approved recipient today (per-sender daily dedup).",
    }
  }

  return {
    code: "recipient_pool_exhausted_for_sender",
    message: "No unique approved recipients remain for this sender today.",
  }
}

export function buildWarmupRecipientSelectionMetadata(input: {
  diagnostics: WarmupRecipientSelectionDiagnostics
  selectionCode: WarmupRecipientSelectionFailureCode | "selected"
  recipientDedupPolicy: string
}): Record<string, unknown> {
  return {
    selection_code: input.selectionCode,
    recipient_dedup_policy: input.recipientDedupPolicy,
    total_approved_recipients: input.diagnostics.totalApprovedRecipients,
    recipients_with_remaining_capacity: input.diagnostics.recipientsWithRemainingCapacity,
    recipients_excluded_by_sender_dedup: input.diagnostics.excludedBySenderDedup,
    recipients_excluded_by_daily_cap: input.diagnostics.excludedByDailyCap,
    recipients_excluded_by_weekly_cap: input.diagnostics.excludedByWeeklyCap,
    recipients_available_for_sender: input.diagnostics.availableForSender,
    qa_marker: GROWTH_WARMUP_RECIPIENT_POOL_FIX_1A_QA_MARKER,
  }
}

export function filterActiveApprovedRecipients(recipients: GrowthWarmupRecipient[]): GrowthWarmupRecipient[] {
  return recipients.filter((recipient) => recipient.active && recipient.approved)
}
