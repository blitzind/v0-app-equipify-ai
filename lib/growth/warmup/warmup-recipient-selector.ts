import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthWarmupRecipient } from "@/lib/growth/warmup/warmup-executor-types"
import {
  buildWarmupRecipientSelectionMetadata,
  filterActiveApprovedRecipients,
  resolveWarmupRecipientSelectionFailure,
  type WarmupRecipientSelectionDiagnostics,
  type WarmupRecipientSelectionFailureCode,
} from "@/lib/growth/warmup/warmup-recipient-pool-health"
import {
  countRecipientSendsSince,
  listWarmupRecipientEmailsForProfileSince,
} from "@/lib/growth/warmup/warmup-recipient-repository"

function utcDayStart(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString()
}

function utcWeekStart(date = new Date()): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  d.setUTCDate(d.getUTCDate() - diff)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export type WarmupRecipientSelectionResult =
  | {
      ok: true
      recipient: GrowthWarmupRecipient
      diagnostics: WarmupRecipientSelectionDiagnostics
      metadata: Record<string, unknown>
    }
  | {
      ok: false
      code: WarmupRecipientSelectionFailureCode
      message: string
      diagnostics: WarmupRecipientSelectionDiagnostics
      metadata: Record<string, unknown>
    }

export async function analyzeWarmupRecipientSelection(
  admin: SupabaseClient,
  input: {
    recipients: GrowthWarmupRecipient[]
    profileId?: string
    excludeEmails?: string[]
    now?: Date
  },
): Promise<WarmupRecipientSelectionDiagnostics> {
  const exclude = new Set(
    (input.excludeEmails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean),
  )
  const eligible = filterActiveApprovedRecipients(input.recipients).filter(
    (recipient) => !exclude.has(recipient.email.toLowerCase()),
  )

  const dayStart = utcDayStart(input.now)
  const weekStart = utcWeekStart(input.now)
  const profileUsedToday =
    input.profileId != null
      ? new Set(
          (await listWarmupRecipientEmailsForProfileSince(admin, input.profileId, dayStart)).map((email) =>
            email.toLowerCase(),
          ),
        )
      : new Set<string>()

  let recipientsWithRemainingCapacity = 0
  let excludedBySenderDedup = 0
  let excludedByDailyCap = 0
  let excludedByWeeklyCap = 0
  let availableForSender = 0

  for (const recipient of eligible) {
    const dailyCount = await countRecipientSendsSince(admin, recipient.id, dayStart)
    const weeklyCount = await countRecipientSendsSince(admin, recipient.id, weekStart)
    const atDailyCap = dailyCount >= recipient.max_emails_per_day
    const atWeeklyCap = weeklyCount >= recipient.max_emails_per_week
    const usedBySenderToday = profileUsedToday.has(recipient.email.toLowerCase())

    if (!atDailyCap && !atWeeklyCap) {
      recipientsWithRemainingCapacity += 1
    }
    if (usedBySenderToday) {
      excludedBySenderDedup += 1
    }
    if (atDailyCap) {
      excludedByDailyCap += 1
    }
    if (atWeeklyCap) {
      excludedByWeeklyCap += 1
    }
    if (!usedBySenderToday && !atDailyCap && !atWeeklyCap) {
      availableForSender += 1
    }
  }

  return {
    totalApprovedRecipients: eligible.length,
    recipientsWithRemainingCapacity,
    excludedBySenderDedup,
    excludedByDailyCap,
    excludedByWeeklyCap,
    availableForSender,
  }
}

export async function selectWarmupRecipientForSend(
  admin: SupabaseClient,
  input: {
    recipients: GrowthWarmupRecipient[]
    senderAccountId: string
    profileId?: string
    excludeEmails?: string[]
    now?: Date
    recipientDedupPolicy?: string
  },
): Promise<WarmupRecipientSelectionResult> {
  const recipientDedupPolicy = input.recipientDedupPolicy ?? "per_sender_daily"
  const exclude = new Set(
    (input.excludeEmails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean),
  )
  const eligible = filterActiveApprovedRecipients(input.recipients).filter(
    (recipient) => !exclude.has(recipient.email.toLowerCase()),
  )

  const diagnostics = await analyzeWarmupRecipientSelection(admin, {
    recipients: input.recipients,
    profileId: input.profileId,
    excludeEmails: input.excludeEmails,
    now: input.now,
  })

  if (eligible.length === 0) {
    const failure = resolveWarmupRecipientSelectionFailure({ diagnostics })
    return {
      ok: false,
      code: failure.code,
      message: failure.message,
      diagnostics,
      metadata: buildWarmupRecipientSelectionMetadata({
        diagnostics,
        selectionCode: failure.code,
        recipientDedupPolicy,
      }),
    }
  }

  const dayStart = utcDayStart(input.now)
  const weekStart = utcWeekStart(input.now)
  const profileUsedToday =
    input.profileId != null
      ? new Set(
          (await listWarmupRecipientEmailsForProfileSince(admin, input.profileId, dayStart)).map((email) =>
            email.toLowerCase(),
          ),
        )
      : new Set<string>()

  const sorted = [...eligible].sort((a, b) => {
    const aUsedByProfile = profileUsedToday.has(a.email.toLowerCase()) ? 1 : 0
    const bUsedByProfile = profileUsedToday.has(b.email.toLowerCase()) ? 1 : 0
    if (aUsedByProfile !== bUsedByProfile) return aUsedByProfile - bUsedByProfile

    const aTs = a.last_sent_at ? Date.parse(a.last_sent_at) : 0
    const bTs = b.last_sent_at ? Date.parse(b.last_sent_at) : 0
    return aTs - bTs
  })

  for (const recipient of sorted) {
    if (profileUsedToday.has(recipient.email.toLowerCase())) continue

    const dailyCount = await countRecipientSendsSince(admin, recipient.id, dayStart)
    if (dailyCount >= recipient.max_emails_per_day) continue

    const weeklyCount = await countRecipientSendsSince(admin, recipient.id, weekStart)
    if (weeklyCount >= recipient.max_emails_per_week) continue

    return {
      ok: true,
      recipient,
      diagnostics,
      metadata: buildWarmupRecipientSelectionMetadata({
        diagnostics,
        selectionCode: "selected",
        recipientDedupPolicy,
      }),
    }
  }

  const failure = resolveWarmupRecipientSelectionFailure({ diagnostics })
  return {
    ok: false,
    code: failure.code,
    message: failure.message,
    diagnostics,
    metadata: buildWarmupRecipientSelectionMetadata({
      diagnostics,
      selectionCode: failure.code,
      recipientDedupPolicy,
    }),
  }
}

/** Count recipients that can accept a send right now (under daily/weekly caps). */
export async function countAvailableWarmupRecipients(
  admin: SupabaseClient,
  recipients: GrowthWarmupRecipient[],
): Promise<number> {
  const diagnostics = await analyzeWarmupRecipientSelection(admin, { recipients })
  return diagnostics.recipientsWithRemainingCapacity
}

/** Count recipients available for a specific sender profile today. */
export async function countAvailableWarmupRecipientsForSender(
  admin: SupabaseClient,
  input: { recipients: GrowthWarmupRecipient[]; profileId: string },
): Promise<number> {
  const diagnostics = await analyzeWarmupRecipientSelection(admin, {
    recipients: input.recipients,
    profileId: input.profileId,
  })
  return diagnostics.availableForSender
}
