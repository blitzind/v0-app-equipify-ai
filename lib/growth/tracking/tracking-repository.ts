import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { inferDeviceType } from "@/lib/growth/tracking/tracking-token"
import {
  computeAttributionEngagementScore,
  tierFromAttributionScore,
} from "@/lib/growth/tracking/engagement-score"
import { recordAttributionTimelineEvents, recordEmailClickedTimelineEvent, recordEmailOpenedTimelineEvent } from "@/lib/growth/tracking/engagement-events"
import type {
  GrowthAttributionRates,
  GrowthEmailClickRecord,
  GrowthEmailOpenRecord,
  GrowthEngagementAttributionDashboard,
  GrowthEngagementScoreRecord,
  GrowthLeadTrackingDetail,
} from "@/lib/growth/tracking/tracking-types"
import { GROWTH_ENGAGEMENT_ATTRIBUTION_QA_MARKER } from "@/lib/growth/tracking/tracking-types"
import { buildTrackingHealthSnapshot } from "@/lib/growth/tracking/tracking-health"
import { getDeliveryAttempt } from "@/lib/growth/providers/transport/transport-repository"

type OpenRow = {
  id: string
  delivery_attempt_id: string
  lead_id: string | null
  sender_account_id: string
  provider_id: string
  opened_at: string
  user_agent: string | null
  ip_hash: string | null
  country: string | null
  city: string | null
  device_type: string | null
  created_at: string
}

type ClickRow = {
  id: string
  delivery_attempt_id: string
  lead_id: string | null
  sender_account_id: string
  provider_id: string
  destination_url: string
  tracking_token: string
  clicked_at: string
  user_agent: string | null
  ip_hash: string | null
  country: string | null
  device_type: string | null
  created_at: string
}

type ScoreRow = {
  id: string
  lead_id: string
  score: number
  tier: GrowthEngagementScoreRecord["tier"]
  opens: number
  clicks: number
  meetings: number
  replies: number
  last_activity_at: string | null
  updated_at: string
}

function hashTrackingTokenForStorage(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 40)
}

function opensTable(admin: SupabaseClient) {
  return admin.schema("growth").from("email_opens")
}

function clicksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("email_clicks")
}

function scoresTable(admin: SupabaseClient) {
  return admin.schema("growth").from("engagement_scores")
}

function mapOpen(row: OpenRow): GrowthEmailOpenRecord {
  return {
    id: row.id,
    deliveryAttemptId: row.delivery_attempt_id,
    leadId: row.lead_id,
    senderAccountId: row.sender_account_id,
    providerId: row.provider_id,
    openedAt: row.opened_at,
    userAgent: row.user_agent,
    deviceType: row.device_type,
    country: row.country,
    city: row.city,
  }
}

function mapClick(row: ClickRow): GrowthEmailClickRecord {
  return {
    id: row.id,
    deliveryAttemptId: row.delivery_attempt_id,
    leadId: row.lead_id,
    senderAccountId: row.sender_account_id,
    providerId: row.provider_id,
    destinationUrl: row.destination_url,
    clickedAt: row.clicked_at,
    userAgent: row.user_agent,
    deviceType: row.device_type,
    country: row.country,
  }
}

function mapScore(row: ScoreRow): GrowthEngagementScoreRecord {
  return {
    id: row.id,
    leadId: row.lead_id,
    score: row.score,
    tier: row.tier,
    opens: row.opens,
    clicks: row.clicks,
    meetings: row.meetings,
    replies: row.replies,
    lastActivityAt: row.last_activity_at,
    updatedAt: row.updated_at,
  }
}

export async function recordEmailOpen(
  admin: SupabaseClient,
  input: {
    deliveryAttemptId: string
    userAgent?: string | null
    ipHash?: string | null
    country?: string | null
    city?: string | null
    openedAt?: string
  },
): Promise<{ recorded: boolean; open: GrowthEmailOpenRecord | null }> {
  const attempt = await getDeliveryAttempt(admin, input.deliveryAttemptId)
  if (!attempt || attempt.status !== "sent") {
    return { recorded: false, open: null }
  }

  const openedAt = input.openedAt ?? new Date().toISOString()
  const deviceType = inferDeviceType(input.userAgent)

  const { data, error } = await opensTable(admin)
    .insert({
      delivery_attempt_id: attempt.id,
      lead_id: attempt.lead_id,
      sender_account_id: attempt.sender_account_id,
      provider_id: attempt.provider_id,
      opened_at: openedAt,
      user_agent: input.userAgent ?? null,
      ip_hash: input.ipHash ?? null,
      country: input.country ?? null,
      city: input.city ?? null,
      device_type: deviceType,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  if (attempt.lead_id) {
    await recordEmailOpenedTimelineEvent(admin, {
      leadId: attempt.lead_id,
      deliveryAttemptId: attempt.id,
      deviceType,
      occurredAt: openedAt,
    })
    await refreshLeadEngagementScore(admin, attempt.lead_id, { incrementOpens: 1, activityAt: openedAt })
  }

  return { recorded: true, open: mapOpen(data as OpenRow) }
}

export async function recordEmailClick(
  admin: SupabaseClient,
  input: {
    deliveryAttemptId: string
    destinationUrl: string
    trackingToken: string
    userAgent?: string | null
    ipHash?: string | null
    country?: string | null
    clickedAt?: string
  },
): Promise<{ recorded: boolean; click: GrowthEmailClickRecord | null; redirectUrl: string | null }> {
  const attempt = await getDeliveryAttempt(admin, input.deliveryAttemptId)
  if (!attempt || attempt.status !== "sent") {
    return { recorded: false, click: null, redirectUrl: null }
  }

  const storageToken = hashTrackingTokenForStorage(input.trackingToken)

  const { data: existing } = await clicksTable(admin)
    .select("id")
    .eq("tracking_token", storageToken)
    .maybeSingle()
  if (existing) {
    return { recorded: false, click: null, redirectUrl: input.destinationUrl }
  }

  const clickedAt = input.clickedAt ?? new Date().toISOString()
  const deviceType = inferDeviceType(input.userAgent)

  const { data, error } = await clicksTable(admin)
    .insert({
      delivery_attempt_id: attempt.id,
      lead_id: attempt.lead_id,
      sender_account_id: attempt.sender_account_id,
      provider_id: attempt.provider_id,
      destination_url: input.destinationUrl,
      tracking_token: storageToken,
      clicked_at: clickedAt,
      user_agent: input.userAgent ?? null,
      ip_hash: input.ipHash ?? null,
      country: input.country ?? null,
      device_type: deviceType,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  if (attempt.lead_id) {
    let destinationHost = input.destinationUrl
    try {
      destinationHost = new URL(input.destinationUrl).host
    } catch {
      // keep raw url host fallback
    }
    await recordEmailClickedTimelineEvent(admin, {
      leadId: attempt.lead_id,
      deliveryAttemptId: attempt.id,
      destinationHost,
      deviceType,
      occurredAt: clickedAt,
    })
    await refreshLeadEngagementScore(admin, attempt.lead_id, { incrementClicks: 1, activityAt: clickedAt })
  }

  return { recorded: true, click: mapClick(data as ClickRow), redirectUrl: input.destinationUrl }
}

async function refreshLeadEngagementScore(
  admin: SupabaseClient,
  leadId: string,
  input: {
    incrementOpens?: number
    incrementClicks?: number
    incrementReplies?: number
    incrementMeetings?: number
    activityAt?: string
  },
): Promise<GrowthEngagementScoreRecord> {
  const { data: existingRow } = await scoresTable(admin).select("*").eq("lead_id", leadId).maybeSingle()
  const existing = existingRow as ScoreRow | null

  const opens = (existing?.opens ?? 0) + (input.incrementOpens ?? 0)
  const clicks = (existing?.clicks ?? 0) + (input.incrementClicks ?? 0)
  const replies = (existing?.replies ?? 0) + (input.incrementReplies ?? 0)
  const meetings = (existing?.meetings ?? 0) + (input.incrementMeetings ?? 0)
  const lastActivityAt = input.activityAt ?? existing?.last_activity_at ?? null

  const computed = computeAttributionEngagementScore({
    opens,
    clicks,
    replies,
    meetings,
    lastActivityAt,
  })

  const previousScore = existing?.score ?? 0
  const previousTier = existing?.tier ?? tierFromAttributionScore(previousScore)

  const payload = {
    lead_id: leadId,
    score: computed.score,
    tier: computed.tier,
    opens,
    clicks,
    meetings,
    replies,
    last_activity_at: lastActivityAt,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = existing
    ? await scoresTable(admin).update(payload).eq("lead_id", leadId).select("*").single()
    : await scoresTable(admin).insert(payload).select("*").single()

  if (error) throw new Error(error.message)

  await recordAttributionTimelineEvents(admin, {
    leadId,
    previousScore,
    nextScore: computed.score,
    previousTier,
    nextTier: computed.tier,
    occurredAt: lastActivityAt ?? undefined,
  })

  return mapScore(data as ScoreRow)
}

export async function fetchAttributionRates(admin: SupabaseClient): Promise<GrowthAttributionRates> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [sentRes, opensRes, clicksRes, repliesRes, meetingsRes] = await Promise.all([
    admin
      .schema("growth")
      .from("delivery_attempts")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", since30d),
    opensTable(admin).select("id", { count: "exact", head: true }).gte("opened_at", since30d),
    clicksTable(admin).select("id", { count: "exact", head: true }).gte("clicked_at", since30d),
    admin
      .schema("growth")
      .from("engagement_scores")
      .select("replies", { count: "exact", head: false })
      .gt("replies", 0),
    admin
      .schema("growth")
      .from("engagement_scores")
      .select("meetings", { count: "exact", head: false })
      .gt("meetings", 0),
  ])

  const sentCount = sentRes.count ?? 0
  const openCount = opensRes.count ?? 0
  const clickCount = clicksRes.count ?? 0
  const replyCount = (repliesRes.data ?? []).reduce((sum, row) => sum + ((row as { replies: number }).replies ?? 0), 0)
  const meetingCount = (meetingsRes.data ?? []).reduce((sum, row) => sum + ((row as { meetings: number }).meetings ?? 0), 0)

  const rate = (numerator: number, denominator: number) =>
    denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0

  return {
    sentCount,
    openCount,
    clickCount,
    replyCount,
    meetingCount,
    openRate: rate(openCount, sentCount),
    clickRate: rate(clickCount, sentCount),
    replyRate: rate(replyCount, sentCount),
    meetingRate: rate(meetingCount, sentCount),
  }
}

export async function fetchEngagementAttributionDashboard(
  admin: SupabaseClient,
): Promise<GrowthEngagementAttributionDashboard> {
  const [rates, trackingHealth] = await Promise.all([
    fetchAttributionRates(admin),
    buildTrackingHealthSnapshot(admin),
  ])

  const { data: scoreRows, error } = await scoresTable(admin)
    .select("lead_id, score, tier, opens, clicks, last_activity_at")
    .order("score", { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)

  const leadIds = (scoreRows ?? []).map((row) => (row as { lead_id: string }).lead_id)
  const { data: leads } =
    leadIds.length > 0
      ? await admin
          .schema("growth")
          .from("leads")
          .select("id, company_name, contact_name")
          .in("id", leadIds)
      : { data: [] }

  const leadMap = new Map(
    (leads ?? []).map((row) => [
      row.id as string,
      { companyName: row.company_name as string, contactName: (row.contact_name as string | null) ?? null },
    ]),
  )

  const topEngaged = (scoreRows ?? []).map((row) => {
    const typed = row as {
      lead_id: string
      score: number
      tier: GrowthEngagementScoreRecord["tier"]
      opens: number
      clicks: number
      last_activity_at: string | null
    }
    const lead = leadMap.get(typed.lead_id)
    return {
      leadId: typed.lead_id,
      companyName: lead?.companyName ?? "Unknown lead",
      contactName: lead?.contactName ?? null,
      score: typed.score,
      tier: typed.tier,
      opens: typed.opens,
      clicks: typed.clicks,
      lastActivityAt: typed.last_activity_at,
    }
  })

  return {
    qa_marker: GROWTH_ENGAGEMENT_ATTRIBUTION_QA_MARKER,
    rates,
    topEngaged,
    trackingHealth,
  }
}

export async function fetchLeadTrackingDetail(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLeadTrackingDetail> {
  const [scoreRes, opensRes, clicksRes, timelineRes] = await Promise.all([
    scoresTable(admin).select("*").eq("lead_id", leadId).maybeSingle(),
    opensTable(admin).select("*").eq("lead_id", leadId).order("opened_at", { ascending: false }).limit(50),
    clicksTable(admin).select("*").eq("lead_id", leadId).order("clicked_at", { ascending: false }).limit(50),
    admin
      .schema("growth")
      .from("lead_timeline_events")
      .select("id, event_type, title, summary, occurred_at")
      .eq("lead_id", leadId)
      .in("event_type", ["email_opened", "email_clicked", "engagement_increased", "high_engagement_detected"])
      .order("occurred_at", { ascending: false })
      .limit(30),
  ])

  if (scoreRes.error) throw new Error(scoreRes.error.message)
  if (opensRes.error) throw new Error(opensRes.error.message)
  if (clicksRes.error) throw new Error(clicksRes.error.message)
  if (timelineRes.error) throw new Error(timelineRes.error.message)

  return {
    score: scoreRes.data ? mapScore(scoreRes.data as ScoreRow) : null,
    opens: (opensRes.data ?? []).map((row) => mapOpen(row as OpenRow)),
    clicks: (clicksRes.data ?? []).map((row) => mapClick(row as ClickRow)),
    timeline: (timelineRes.data ?? []).map((row) => ({
      id: row.id as string,
      kind: row.event_type as string,
      title: row.title as string,
      summary: (row.summary as string | null) ?? null,
      occurredAt: row.occurred_at as string,
    })),
  }
}
