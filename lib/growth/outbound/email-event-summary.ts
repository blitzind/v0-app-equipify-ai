import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeEmail } from "@/lib/growth/import/normalize"
import type { GrowthLeadEmailEventSummary, GrowthOutboundReplyClassification } from "@/lib/growth/outbound/types"

export async function fetchGrowthLeadEmailEventSummary(
  admin: SupabaseClient,
  leadId: string,
  outreachEmail?: string | null,
): Promise<GrowthLeadEmailEventSummary> {
  const now = new Date()
  const since14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: events, error } = await admin
    .schema("growth")
    .from("message_events")
    .select("event_type, occurred_at")
    .eq("lead_id", leadId)
    .gte("occurred_at", since30d)
    .order("occurred_at", { ascending: false })

  if (error) throw new Error(error.message)

  const rows = events ?? []
  const countSince = (type: string, since: string) =>
    rows.filter((row) => row.event_type === type && row.occurred_at >= since).length

  const lastSentAt = rows.find((row) => row.event_type === "sent")?.occurred_at ?? null
  const lastReplyAt = rows.find((row) => row.event_type === "replied")?.occurred_at ?? null

  const { data: latestReply } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("classification, received_at")
    .eq("lead_id", leadId)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let isSuppressed = false
  const normalizedEmail = normalizeEmail(outreachEmail ?? undefined)
  if (normalizedEmail) {
    const { data: suppression } = await admin
      .schema("growth")
      .from("suppression_entries")
      .select("id")
      .eq("email", normalizedEmail)
      .limit(1)
      .maybeSingle()
    isSuppressed = Boolean(suppression)
  } else {
    const { data: suppressionByLead } = await admin
      .schema("growth")
      .from("suppression_entries")
      .select("id")
      .eq("lead_id", leadId)
      .limit(1)
      .maybeSingle()
    isSuppressed = Boolean(suppressionByLead)
  }

  const latestClassification = (latestReply?.classification ?? null) as GrowthOutboundReplyClassification | null
  const interestedReply7d =
    latestClassification === "interested" &&
    Boolean(latestReply?.received_at && latestReply.received_at >= since7d)

  return {
    sentCount14d: countSince("sent", since14d),
    openCount14d: countSince("opened", since14d),
    clickCount14d: countSince("clicked", since14d),
    replyCount14d: countSince("replied", since14d),
    sentCount30d: countSince("sent", since30d),
    openCount30d: countSince("opened", since30d),
    interestedReply7d,
    latestReplyClassification: latestClassification,
    isSuppressed,
    lastSentAt,
    lastReplyAt,
  }
}
