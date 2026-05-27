import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeChannelAwareBuyingMomentum } from "@/lib/growth/revenue-intelligence/channel-aware-momentum-engine"
import { loadCallMeetingIntelligenceForLead } from "@/lib/growth/revenue-intelligence/call-meeting-intelligence-bridge"
import { upsertChannelEffectivenessSnapshots } from "@/lib/growth/revenue-intelligence/channel-effectiveness-analytics"
import { buildMultichannelRevenueCopilot } from "@/lib/growth/revenue-intelligence/multichannel-copilot-service"
import {
  fetchMultiChannelActivityTimeline,
  syncMultiChannelTimelineForLead,
} from "@/lib/growth/revenue-intelligence/multi-channel-activity-timeline"
import { GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"
import { GROWTH_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"
import { persistWebsiteIntentCorrelationSnapshot } from "@/lib/growth/revenue-intelligence/website-intent-correlation"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { BuyingMomentumInput } from "@/lib/growth/revenue-intelligence/buying-momentum-engine"

async function loadChannelTouchCounts(
  admin: SupabaseClient,
  leadId: string,
): Promise<Record<string, number>> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .schema("growth")
    .from("multi_channel_activity_timeline_events")
    .select("channel")
    .eq("lead_id", leadId)
    .gte("occurred_at", since)
    .then((r) => r)
    .catch(() => ({ data: [] as unknown[] }))

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const channel = String((row as { channel?: string }).channel ?? "other")
    counts[channel] = (counts[channel] ?? 0) + 1
  }
  return counts
}

async function loadEngagementGapDays(admin: SupabaseClient, leadId: string): Promise<number | null> {
  const { data } = await admin
    .schema("growth")
    .from("multi_channel_activity_timeline_events")
    .select("occurred_at")
    .eq("lead_id", leadId)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .then((r) => r)
    .catch(() => ({ data: null }))

  if (!data) return null
  const lastAt = new Date(String((data as { occurred_at: string }).occurred_at)).getTime()
  return Math.floor((Date.now() - lastAt) / (24 * 60 * 60 * 1000))
}

async function persistChannelAwareMomentum(
  admin: SupabaseClient,
  input: {
    leadId: string
    baseMomentumInput: BuyingMomentumInput
    stakeholderCount: number
  },
): Promise<ReturnType<typeof computeChannelAwareBuyingMomentum>> {
  const callMeeting = await loadCallMeetingIntelligenceForLead(admin, input.leadId)
  const channelTouchCounts = await loadChannelTouchCounts(admin, input.leadId)
  const engagementGapDays = await loadEngagementGapDays(admin, input.leadId)

  const smsTouchCount = (channelTouchCounts.sms ?? 0) + (channelTouchCounts.cadence ?? 0)
  const smsReplyCount = 0

  const momentum = computeChannelAwareBuyingMomentum({
    ...input.baseMomentumInput,
    connectedCallCount: callMeeting.connectedCallCount,
    totalCallDurationSeconds: callMeeting.totalCallDurationSeconds,
    meetingsBooked: callMeeting.meetingsBooked,
    meetingsAttended: callMeeting.meetingsAttended,
    meetingsNoShow: callMeeting.meetingsNoShow,
    smsTouchCount,
    smsReplyCount,
    channelTouchCounts,
    engagementGapDays,
  })

  const snapshotDate = new Date().toISOString().slice(0, 10)
  const row = {
    lead_id: input.leadId,
    snapshot_date: snapshotDate,
    momentum_score: momentum.compositeMomentumScore,
    momentum_trend: momentum.momentumTrend,
    reply_velocity_score: momentum.replyVelocityScore,
    engagement_depth_score: momentum.engagementDepthScore,
    stakeholder_count: input.stakeholderCount,
    objection_resolution_score: momentum.objectionResolutionScore,
    outbound_interaction_score: momentum.outboundInteractionScore,
    call_engagement_score: momentum.callEngagementScore,
    meeting_engagement_score: momentum.meetingEngagementScore,
    sms_responsiveness_score: momentum.smsResponsivenessScore,
    channel_diversity_score: momentum.channelDiversityScore,
    engagement_consistency_score: momentum.engagementConsistencyScore,
    channel_mix: momentum.channelMix,
    evidence: momentum.evidence,
    explainability: { lines: momentum.explainability },
    qa_marker: GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await admin
    .schema("growth")
    .from("buying_momentum_snapshots")
    .select("id")
    .eq("lead_id", input.leadId)
    .eq("snapshot_date", snapshotDate)
    .maybeSingle()

  if (existing) {
    await admin.schema("growth").from("buying_momentum_snapshots").update(row).eq("id", (existing as { id: string }).id)
  } else {
    await admin.schema("growth").from("buying_momentum_snapshots").insert(row)
  }

  return momentum
}

function suggestBestNextTouchpoint(channelMix: Record<string, number>): string {
  if ((channelMix.email ?? 0) === 0 && (channelMix.call ?? 0) === 0) return "Email or call — no recent outbound touch recorded."
  if ((channelMix.website ?? 0) > 0 && (channelMix.call ?? 0) === 0) {
    return "Website activity detected — operator call follow-up recommended (human executes)."
  }
  if ((channelMix.meeting ?? 0) === 0 && (channelMix.email ?? 0) > 0) {
    return "Consider human-reviewed call or meeting invite after email engagement."
  }
  return "Review channel mix and choose next touch manually — recommendations only."
}

function detectEngagementGaps(channelMix: Record<string, number>, engagementGapDays: number | null): string[] {
  const gaps: string[] = []
  if (Object.keys(channelMix).length === 0) gaps.push("No multi-channel activity recorded.")
  if (engagementGapDays != null && engagementGapDays >= 7) gaps.push(`No engagement in ${engagementGapDays} days.`)
  if ((channelMix.email ?? 0) >= 5 && (channelMix.call ?? 0) === 0) gaps.push("Email-heavy with no call follow-up recorded.")
  return gaps
}

export async function processMultichannelRevenueIntelligence(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyName?: string | null
    baseMomentumInput: BuyingMomentumInput
    stakeholderCount: number
    outboundReplyId?: string | null
  },
): Promise<{ timelineSynced: number; momentumScore: number; momentumTrend: string }> {
  const timelineSynced = await syncMultiChannelTimelineForLead(admin, input.leadId).catch(() => 0)

  const momentum = await persistChannelAwareMomentum(admin, {
    leadId: input.leadId,
    baseMomentumInput: input.baseMomentumInput,
    stakeholderCount: input.stakeholderCount,
  })

  const intentCorrelation = await persistWebsiteIntentCorrelationSnapshot(admin, input.leadId).catch(async () => {
    const { computeWebsiteIntentCorrelationForLead } = await import("@/lib/growth/revenue-intelligence/website-intent-correlation")
    return computeWebsiteIntentCorrelationForLead(admin, input.leadId)
  })

  await upsertChannelEffectivenessSnapshots(admin).catch(() => 0)

  const timeline = await fetchMultiChannelActivityTimeline(admin, {
    leadId: input.leadId,
    syncLive: false,
    limit: 30,
  })

  const callMeeting = await loadCallMeetingIntelligenceForLead(admin, input.leadId)
  const engagementGapDays = await loadEngagementGapDays(admin, input.leadId)
  const engagementGaps = detectEngagementGaps(momentum.channelMix, engagementGapDays)
  const bestNextTouchpoint = suggestBestNextTouchpoint(momentum.channelMix)

  const copilot = buildMultichannelRevenueCopilot({
    companyLabel: input.companyName ?? "Account",
    momentum,
    timelineEntries: timeline.entries,
    callMeeting,
    intentCorrelation,
    bestNextTouchpoint,
    engagementGaps,
  })

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "multichannel_copilot_assisted",
    title: "Multi-channel revenue copilot",
    summary: copilot.accountActivitySummary,
    outboundReplyId: input.outboundReplyId ?? undefined,
    payload: {
      assisted_label: copilot.assistedLabel,
      suggested_next: copilot.suggestedNextTouchpoint,
      qa_marker: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
    },
  }).catch(() => undefined)

  return {
    timelineSynced,
    momentumScore: momentum.compositeMomentumScore,
    momentumTrend: momentum.momentumTrend,
  }
}

export async function fetchMultichannelCopilotForLead(
  admin: SupabaseClient,
  input: { leadId: string; companyName?: string | null },
): Promise<ReturnType<typeof buildMultichannelRevenueCopilot>> {
  const { data: momentumRow } = await admin
    .schema("growth")
    .from("buying_momentum_snapshots")
    .select("*")
    .eq("lead_id", input.leadId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  const callMeeting = await loadCallMeetingIntelligenceForLead(admin, input.leadId)
  const intentCorrelation = await computeWebsiteIntentCorrelationForLeadImport(admin, input.leadId)
  const timeline = await fetchMultiChannelActivityTimeline(admin, { leadId: input.leadId, limit: 30 })
  const channelMix = (momentumRow as { channel_mix?: Record<string, number> } | null)?.channel_mix ?? {}
  const engagementGapDays = await loadEngagementGapDays(admin, input.leadId)
  const engagementGaps = detectEngagementGaps(channelMix, engagementGapDays)

  const momentum = computeChannelAwareBuyingMomentum({
    threadReplyCount: 0,
    responseLatencyMs: null,
    buyingSignalCount: 0,
    objectionCount: 0,
    resolvedObjectionCount: 0,
    outboundMessageCount: 0,
    stakeholderCount: Number((momentumRow as { stakeholder_count?: number } | null)?.stakeholder_count ?? 0),
    connectedCallCount: callMeeting.connectedCallCount,
    totalCallDurationSeconds: callMeeting.totalCallDurationSeconds,
    meetingsBooked: callMeeting.meetingsBooked,
    meetingsAttended: callMeeting.meetingsAttended,
    meetingsNoShow: callMeeting.meetingsNoShow,
    smsTouchCount: 0,
    smsReplyCount: 0,
    channelTouchCounts: channelMix,
    engagementGapDays,
    priorMomentumScore: Number((momentumRow as { momentum_score?: number } | null)?.momentum_score ?? null),
  })

  return buildMultichannelRevenueCopilot({
    companyLabel: input.companyName ?? "Account",
    momentum,
    timelineEntries: timeline.entries,
    callMeeting,
    intentCorrelation,
    bestNextTouchpoint: suggestBestNextTouchpoint(channelMix),
    engagementGaps,
  })
}

async function computeWebsiteIntentCorrelationForLeadImport(
  admin: SupabaseClient,
  leadId: string,
): Promise<Awaited<ReturnType<typeof persistWebsiteIntentCorrelationSnapshot>>> {
  const { computeWebsiteIntentCorrelationForLead } = await import("@/lib/growth/revenue-intelligence/website-intent-correlation")
  return computeWebsiteIntentCorrelationForLead(admin, leadId)
}
