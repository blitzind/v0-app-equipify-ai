import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthWarmupRecipient } from "@/lib/growth/warmup/warmup-executor-types"
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
  | { ok: true; recipient: GrowthWarmupRecipient }
  | { ok: false; code: "recipient_daily_cap" | "recipient_weekly_cap" | "no_recipients"; message: string }

export async function selectWarmupRecipientForSend(
  admin: SupabaseClient,
  input: {
    recipients: GrowthWarmupRecipient[]
    senderAccountId: string
    profileId?: string
    excludeEmails?: string[]
  },
): Promise<WarmupRecipientSelectionResult> {
  const exclude = new Set(
    (input.excludeEmails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean),
  )
  const eligible = input.recipients.filter(
    (r) => r.active && r.approved && !exclude.has(r.email.toLowerCase()),
  )
  if (eligible.length === 0) {
    return { ok: false, code: "no_recipients", message: "No active approved warmup recipients available." }
  }

  const dayStart = utcDayStart()
  const weekStart = utcWeekStart()
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
    const dailyCount = await countRecipientSendsSince(admin, recipient.id, dayStart)
    if (dailyCount >= recipient.max_emails_per_day) continue

    const weeklyCount = await countRecipientSendsSince(admin, recipient.id, weekStart)
    if (weeklyCount >= recipient.max_emails_per_week) continue

    return { ok: true, recipient }
  }

  return {
    ok: false,
    code: "recipient_daily_cap",
    message: "All approved recipients reached daily or weekly caps.",
  }
}
