import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
  type GrowthWebsiteIntentCorrelation,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"

function deriveCorrelationStrength(input: {
  pageviewCount: number
  outboundActivityCount: number
  replyCount: number
  meetingCount: number
}): GrowthWebsiteIntentCorrelation["correlationStrength"] {
  const signals =
    (input.pageviewCount > 0 ? 1 : 0) +
    (input.outboundActivityCount > 0 ? 1 : 0) +
    (input.replyCount > 0 ? 1 : 0) +
    (input.meetingCount > 0 ? 1 : 0)
  if (signals >= 3 && input.pageviewCount >= 2) return "strong"
  if (signals >= 2) return "moderate"
  if (signals >= 1) return "weak"
  return "unknown"
}

export async function computeWebsiteIntentCorrelationForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthWebsiteIntentCorrelation> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const evidence: string[] = []

  const [sessionsRes, pageviewsRes, outboundRes, repliesRes, meetingsRes, momentumRes] = await Promise.all([
    admin
      .schema("growth")
      .from("intent_visitor_sessions")
      .select("id, pageview_count, identified_at, last_seen_at")
      .eq("lead_id", leadId)
      .gte("last_seen_at", since)
      .then((r) => r)
      .catch(() => ({ data: [] as unknown[] })),
    admin
      .schema("growth")
      .from("intent_pageview_events")
      .select("id, occurred_at")
      .eq("lead_id", leadId)
      .gte("occurred_at", since)
      .then((r) => r)
      .catch(() => ({ data: [] as unknown[] })),
    admin
      .schema("growth")
      .from("outbound_messages")
      .select("id")
      .eq("lead_id", leadId)
      .gte("created_at", since),
    admin
      .schema("growth")
      .from("outbound_replies")
      .select("id")
      .eq("lead_id", leadId)
      .gte("received_at", since),
    admin
      .schema("growth")
      .from("meetings")
      .select("id")
      .eq("lead_id", leadId)
      .gte("created_at", since)
      .then((r) => r)
      .catch(() => ({ data: [] as unknown[] })),
    admin
      .schema("growth")
      .from("buying_momentum_snapshots")
      .select("momentum_score")
      .eq("lead_id", leadId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const pageviewCount = (pageviewsRes.data ?? []).length
  const identifiedVisits = (sessionsRes.data ?? []).filter((row) => (row as { identified_at?: string }).identified_at).length
  const outboundActivityCount = (outboundRes.data ?? []).length
  const replyCount = (repliesRes.data ?? []).length
  const meetingCount = (meetingsRes.data ?? []).length
  const momentumScore = (momentumRes.data as { momentum_score?: number } | null)?.momentum_score ?? null

  if (pageviewCount > 0) evidence.push(`${pageviewCount} pageview event(s) from intent pixel telemetry.`)
  if (identifiedVisits > 0) evidence.push(`${identifiedVisits} identified visitor session(s).`)
  if (outboundActivityCount > 0) evidence.push(`${outboundActivityCount} outbound message(s) in correlation window.`)
  if (replyCount > 0) evidence.push(`${replyCount} reply(ies) correlated with website activity window.`)
  if (meetingCount > 0) evidence.push(`${meetingCount} meeting(s) in correlation window.`)

  const correlationStrength = deriveCorrelationStrength({
    pageviewCount,
    outboundActivityCount,
    replyCount,
    meetingCount,
  })

  return {
    pageviewCount,
    identifiedVisits,
    outboundActivityCount,
    replyCount,
    meetingCount,
    momentumScore,
    correlationStrength,
    evidence,
  }
}

export async function persistWebsiteIntentCorrelationSnapshot(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthWebsiteIntentCorrelation> {
  const correlation = await computeWebsiteIntentCorrelationForLead(admin, leadId)
  const snapshotDate = new Date().toISOString().slice(0, 10)

  const row = {
    lead_id: leadId,
    snapshot_date: snapshotDate,
    pageview_count: correlation.pageviewCount,
    identified_visits: correlation.identifiedVisits,
    outbound_activity_count: correlation.outboundActivityCount,
    reply_count: correlation.replyCount,
    meeting_count: correlation.meetingCount,
    momentum_score: correlation.momentumScore,
    correlation_strength: correlation.correlationStrength,
    evidence: correlation.evidence,
    qa_marker: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await admin
    .schema("growth")
    .from("website_intent_correlation_snapshots")
    .select("id")
    .eq("lead_id", leadId)
    .eq("snapshot_date", snapshotDate)
    .maybeSingle()
    .then((r) => r)
    .catch(() => ({ data: null }))

  if (existing) {
    await admin.schema("growth").from("website_intent_correlation_snapshots").update(row).eq("id", (existing as { id: string }).id)
  } else {
    await admin.schema("growth").from("website_intent_correlation_snapshots").insert(row)
  }

  await appendGrowthLeadTimelineEvent(admin, {
    leadId,
    eventType: "website_intent_correlated",
    title: "Website intent correlated",
    summary: `Correlation strength: ${correlation.correlationStrength} (${correlation.pageviewCount} pageviews).`,
    payload: { correlation_strength: correlation.correlationStrength, qa_marker: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER },
  }).catch(() => undefined)

  return correlation
}
