import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

const POSITIVE_THREAD_CLASSIFICATIONS = new Set([
  "positive_interest",
  "meeting_intent",
  "referral",
  "budget",
  "timeline",
])

export type GrowthMailboxEngagementRates = {
  reply_rate: number
  positive_reply_rate: number
  unsubscribe_rate: number
  open_rate: number
}

function ratePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Number(((numerator / denominator) * 100).toFixed(2))
}

async function countOpens(
  admin: SupabaseClient,
  senderAccountId: string,
  sinceIso: string,
): Promise<number> {
  const { count } = await admin
    .schema("growth")
    .from("email_opens")
    .select("id", { count: "exact", head: true })
    .eq("sender_account_id", senderAccountId)
    .gte("opened_at", sinceIso)
  return count ?? 0
}

async function loadThreadIdsForSender(
  admin: SupabaseClient,
  input: { senderAccountId: string; mailboxConnectionId: string | null; sinceIso: string },
): Promise<string[]> {
  if (input.mailboxConnectionId) {
    const { data } = await admin
      .schema("growth")
      .from("inbox_threads")
      .select("id")
      .eq("mailbox_connection_id", input.mailboxConnectionId)
    return (data ?? []).map((row) => String((row as Record<string, unknown>).id))
  }

  const { data: attempts } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("lead_id")
    .eq("sender_account_id", input.senderAccountId)
    .eq("status", "sent")
    .gte("created_at", input.sinceIso)
    .not("lead_id", "is", null)
    .limit(500)

  const leadIds = [
    ...new Set(
      (attempts ?? [])
        .map((row) => (row as Record<string, unknown>).lead_id)
        .filter((value): value is string => typeof value === "string"),
    ),
  ]
  if (leadIds.length === 0) return []

  const { data: threads } = await admin
    .schema("growth")
    .from("inbox_threads")
    .select("id")
    .in("lead_id", leadIds.slice(0, 200))

  return (threads ?? []).map((row) => String((row as Record<string, unknown>).id))
}

async function countInboundReplies(
  admin: SupabaseClient,
  threadIds: string[],
  sinceIso: string,
): Promise<number> {
  if (threadIds.length === 0) return 0
  const { count } = await admin
    .schema("growth")
    .from("inbox_messages")
    .select("id", { count: "exact", head: true })
    .eq("direction", "inbound")
    .gte("message_timestamp", sinceIso)
    .in("thread_id", threadIds.slice(0, 200))
  return count ?? 0
}

async function countPositiveReplies(
  admin: SupabaseClient,
  input: {
    threadIds: string[]
    mailboxConnectionId: string | null
    sinceIso: string
  },
): Promise<number> {
  let positive = 0

  if (input.mailboxConnectionId) {
    const { count: threadCount } = await admin
      .schema("growth")
      .from("inbox_threads")
      .select("id", { count: "exact", head: true })
      .eq("mailbox_connection_id", input.mailboxConnectionId)
      .in("classification", [...POSITIVE_THREAD_CLASSIFICATIONS])
      .gte("last_message_at", input.sinceIso)
    positive += threadCount ?? 0
  } else if (input.threadIds.length > 0) {
    const { count: threadCount } = await admin
      .schema("growth")
      .from("inbox_threads")
      .select("id", { count: "exact", head: true })
      .in("id", input.threadIds.slice(0, 200))
      .in("classification", [...POSITIVE_THREAD_CLASSIFICATIONS])
      .gte("last_message_at", input.sinceIso)
    positive += threadCount ?? 0
  }

  if (input.threadIds.length > 0) {
    const { count: signalCount } = await admin
      .schema("growth")
      .from("inbox_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .eq("contains_positive_signal", true)
      .gte("message_timestamp", input.sinceIso)
      .in("thread_id", input.threadIds.slice(0, 200))
    positive = Math.max(positive, signalCount ?? 0)
  }

  return positive
}

async function countUnsubscribes(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    mailboxConnectionId: string | null
    sinceIso: string
  },
): Promise<number> {
  const [timelineCount, threadCount] = await Promise.all([
    admin
      .schema("growth")
      .from("delivery_event_timeline")
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", input.senderAccountId)
      .eq("normalized_type", "unsubscribed")
      .gte("occurred_at", input.sinceIso)
      .then((res) => res.count ?? 0),
    input.mailboxConnectionId
      ? admin
          .schema("growth")
          .from("inbox_threads")
          .select("id", { count: "exact", head: true })
          .eq("mailbox_connection_id", input.mailboxConnectionId)
          .eq("classification", "unsubscribe")
          .gte("updated_at", input.sinceIso)
          .then((res) => res.count ?? 0)
      : Promise.resolve(0),
  ])

  return timelineCount + threadCount
}

/** Deterministic 7d engagement rates from outbound events — no estimation. */
export async function aggregateMailboxEngagementMetrics(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    mailboxConnectionId: string | null
    since7d: string
    sent7d: number
  },
): Promise<GrowthMailboxEngagementRates> {
  const denominator = Math.max(input.sent7d, 1)
  const threadIds = await loadThreadIdsForSender(admin, {
    senderAccountId: input.senderAccountId,
    mailboxConnectionId: input.mailboxConnectionId,
    sinceIso: input.since7d,
  })

  const [opens, replies, positiveReplies, unsubscribes] = await Promise.all([
    countOpens(admin, input.senderAccountId, input.since7d),
    countInboundReplies(admin, threadIds, input.since7d),
    countPositiveReplies(admin, {
      threadIds,
      mailboxConnectionId: input.mailboxConnectionId,
      sinceIso: input.since7d,
    }),
    countUnsubscribes(admin, {
      senderAccountId: input.senderAccountId,
      mailboxConnectionId: input.mailboxConnectionId,
      sinceIso: input.since7d,
    }),
  ])

  return {
    open_rate: ratePercent(opens, denominator),
    reply_rate: ratePercent(replies, denominator),
    positive_reply_rate: ratePercent(positiveReplies, denominator),
    unsubscribe_rate: ratePercent(unsubscribes, denominator),
  }
}
