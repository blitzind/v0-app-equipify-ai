import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"

export type ChannelEffectivenessMetric = {
  channel: string
  touchCount: number
  positiveOutcomes: number
  meetingsBooked: number
  meetingsAttended: number
  repliesReceived: number
  effectivenessScore: number
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scoreChannel(metric: Omit<ChannelEffectivenessMetric, "effectivenessScore">): number {
  if (metric.touchCount === 0) return 0
  const replyRate = metric.repliesReceived / metric.touchCount
  const meetingRate = metric.meetingsAttended / Math.max(1, metric.meetingsBooked)
  const positiveRate = metric.positiveOutcomes / metric.touchCount
  return clamp(Math.round(replyRate * 35 + meetingRate * 35 + positiveRate * 30))
}

export async function computeGlobalChannelEffectiveness(
  admin: SupabaseClient,
): Promise<ChannelEffectivenessMetric[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const metrics = new Map<string, Omit<ChannelEffectivenessMetric, "effectivenessScore">>()

  function bump(channel: string, patch: Partial<Omit<ChannelEffectivenessMetric, "channel" | "effectivenessScore">>) {
    const current = metrics.get(channel) ?? {
      channel,
      touchCount: 0,
      positiveOutcomes: 0,
      meetingsBooked: 0,
      meetingsAttended: 0,
      repliesReceived: 0,
    }
    metrics.set(channel, {
      ...current,
      touchCount: current.touchCount + (patch.touchCount ?? 0),
      positiveOutcomes: current.positiveOutcomes + (patch.positiveOutcomes ?? 0),
      meetingsBooked: current.meetingsBooked + (patch.meetingsBooked ?? 0),
      meetingsAttended: current.meetingsAttended + (patch.meetingsAttended ?? 0),
      repliesReceived: current.repliesReceived + (patch.repliesReceived ?? 0),
    })
  }

  const [messagesRes, repliesRes, callsRes, meetingsRes, timelineRes] = await Promise.all([
    admin.schema("growth").from("outbound_messages").select("id").gte("created_at", since),
    admin.schema("growth").from("outbound_replies").select("id, intent").gte("received_at", since),
    admin.schema("growth").from("lead_call_events").select("id, disposition").gte("created_at", since),
    admin
      .schema("growth")
      .from("meetings")
      .select("id, status")
      .gte("created_at", since)
      .then((r) => r)
      .catch(() => ({ data: [] as unknown[], error: null })),
    admin
      .schema("growth")
      .from("multi_channel_activity_timeline_events")
      .select("channel")
      .gte("occurred_at", since)
      .then((r) => r)
      .catch(() => ({ data: [] as unknown[], error: null })),
  ])

  bump("email", { touchCount: (messagesRes.data ?? []).length })
  for (const row of repliesRes.data ?? []) {
    bump("email", { repliesReceived: 1 })
    const intent = String((row as { intent?: string }).intent ?? "")
    if (["interested", "meeting_request", "pricing_question", "positive"].includes(intent)) {
      bump("email", { positiveOutcomes: 1 })
    }
  }

  for (const row of callsRes.data ?? []) {
    bump("call", { touchCount: 1 })
    const disposition = String((row as { disposition?: string }).disposition ?? "")
    if (["interested", "follow_up_later", "meeting_booked"].includes(disposition)) {
      bump("call", { positiveOutcomes: 1 })
    }
  }

  for (const row of meetingsRes.data ?? []) {
    const status = String((row as { status?: string }).status ?? "")
    bump("meeting", { touchCount: 1, meetingsBooked: 1 })
    if (status === "completed") bump("meeting", { meetingsAttended: 1, positiveOutcomes: 1 })
  }

  for (const row of timelineRes.data ?? []) {
    const channel = String((row as { channel?: string }).channel ?? "other")
    if (channel === "sms" || channel === "linkedin") bump(channel, { touchCount: 1 })
    if (channel === "website") bump("website", { touchCount: 1 })
  }

  return [...metrics.values()].map((metric) => ({
    ...metric,
    effectivenessScore: scoreChannel(metric),
  }))
}

export async function upsertChannelEffectivenessSnapshots(admin: SupabaseClient): Promise<number> {
  const metrics = await computeGlobalChannelEffectiveness(admin)
  const snapshotDate = new Date().toISOString().slice(0, 10)
  let upserted = 0

  for (const metric of metrics) {
    const row = {
      snapshot_date: snapshotDate,
      channel: metric.channel,
      scope_type: "global",
      scope_id: null,
      touch_count: metric.touchCount,
      positive_outcomes: metric.positiveOutcomes,
      meetings_booked: metric.meetingsBooked,
      meetings_attended: metric.meetingsAttended,
      replies_received: metric.repliesReceived,
      effectiveness_score: metric.effectivenessScore,
      attribution_weight: 1,
      metrics: metric,
      qa_marker: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
      updated_at: new Date().toISOString(),
    }

    const existingResult = await admin
      .schema("growth")
      .from("channel_effectiveness_snapshots")
      .select("id")
      .eq("snapshot_date", snapshotDate)
      .eq("channel", metric.channel)
      .eq("scope_type", "global")
      .maybeSingle()
      .then((r) => r)
      .catch(() => ({ data: null }))

    if (existingResult.data) {
      await admin
        .schema("growth")
        .from("channel_effectiveness_snapshots")
        .update(row)
        .eq("id", (existingResult.data as { id: string }).id)
    } else {
      await admin.schema("growth").from("channel_effectiveness_snapshots").insert(row)
    }
    upserted += 1
  }

  return upserted
}
