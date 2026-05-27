import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchOpportunityWorkspaceDashboard } from "@/lib/growth/revenue-intelligence/opportunity-workspace-dashboard"
import { computeGlobalChannelEffectiveness } from "@/lib/growth/revenue-intelligence/channel-effectiveness-analytics"
import {
  GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
  type GrowthChannelEngagementMix,
  type GrowthOperatorExecutionAccountItem,
  type GrowthOperatorExecutionWorkspaceV2,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"

function suggestBestNextTouchpoint(channelMix: GrowthChannelEngagementMix[]): string {
  const channels = new Set(channelMix.map((c) => c.channel))
  if (!channels.has("email") && !channels.has("call")) return "Email or call — no recent outbound touch recorded."
  if (!channels.has("meeting") && channels.has("email")) return "Consider human-reviewed call or meeting invite after email engagement."
  if (channels.has("website") && !channels.has("call")) return "Website activity detected — operator call follow-up recommended (human executes)."
  if (channels.has("call") && !channels.has("email")) return "Call logged — follow with evidence-backed email summary (human approval required)."
  return "Review channel mix and choose next touch manually — recommendations only."
}

function detectEngagementGap(channelMix: GrowthChannelEngagementMix[]): string | null {
  if (channelMix.length === 0) return "No multi-channel activity recorded."
  const latest = channelMix
    .filter((c) => c.lastOccurredAt)
    .sort((a, b) => new Date(String(b.lastOccurredAt)).getTime() - new Date(String(a.lastOccurredAt)).getTime())[0]
  if (!latest?.lastOccurredAt) return "Missing last-touch timestamps."
  const gapDays = Math.floor((Date.now() - new Date(latest.lastOccurredAt).getTime()) / (24 * 60 * 60 * 1000))
  if (gapDays >= 7) return `No engagement in ${gapDays} days across recorded channels.`
  return null
}

export async function fetchOperatorExecutionWorkspaceV2(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<GrowthOperatorExecutionWorkspaceV2> {
  const limit = input?.limit ?? 50
  const workspace = await fetchOpportunityWorkspaceDashboard(admin, { limit: 100 })
  const leadIds = workspace.items.map((i) => i.leadId)
  const timelineByLead = new Map<string, Array<{ channel: string; occurredAt: string }>>()
  if (leadIds.length > 0) {
    const { data: timelineRows } = await admin
      .schema("growth")
      .from("multi_channel_activity_timeline_events")
      .select("lead_id, channel, occurred_at")
      .in("lead_id", leadIds.slice(0, 100))
      .order("occurred_at", { ascending: false })
      .limit(500)
      .then((r) => r)
      .catch(() => ({ data: [] as unknown[] }))

    for (const row of timelineRows ?? []) {
      const record = row as { lead_id: string; channel: string; occurred_at: string }
      const list = timelineByLead.get(record.lead_id) ?? []
      list.push({ channel: record.channel, occurredAt: record.occurred_at })
      timelineByLead.set(record.lead_id, list)
    }
  }

  const channelMixGlobal = new Map<string, GrowthChannelEngagementMix>()
  for (const [, entries] of timelineByLead) {
    for (const entry of entries) {
      const current = channelMixGlobal.get(entry.channel) ?? {
        channel: entry.channel,
        touchCount: 0,
        lastOccurredAt: null,
      }
      current.touchCount += 1
      if (!current.lastOccurredAt || new Date(entry.occurredAt) > new Date(current.lastOccurredAt)) {
        current.lastOccurredAt = entry.occurredAt
      }
      channelMixGlobal.set(entry.channel, current)
    }
  }

  const channelEngagementMix = [...channelMixGlobal.values()].sort((a, b) => b.touchCount - a.touchCount)
  const bestNextTouchpoint = suggestBestNextTouchpoint(channelEngagementMix)

  const engagementGaps: string[] = []
  const channelFatigueWarnings: string[] = []
  let followUpRiskCount = 0
  let noResponsePatternCount = 0

  for (const mix of channelEngagementMix) {
    if (mix.touchCount >= 8 && mix.channel === "email") {
      channelFatigueWarnings.push(`High email touch frequency (${mix.touchCount}) — review cadence before additional sends.`)
    }
  }

  const items: GrowthOperatorExecutionAccountItem[] = workspace.items.slice(0, limit).map((item) => {
    const leadEntries = timelineByLead.get(item.leadId) ?? []
    const leadMixMap = new Map<string, GrowthChannelEngagementMix>()
    for (const entry of leadEntries) {
      const current = leadMixMap.get(entry.channel) ?? { channel: entry.channel, touchCount: 0, lastOccurredAt: null }
      current.touchCount += 1
      if (!current.lastOccurredAt || new Date(entry.occurredAt) > new Date(current.lastOccurredAt)) {
        current.lastOccurredAt = entry.occurredAt
      }
      leadMixMap.set(entry.channel, current)
    }

    const channelMix = [...leadMixMap.values()]
    const engagementGap = detectEngagementGap(channelMix)
    if (engagementGap) engagementGaps.push(`${item.companyLabel}: ${engagementGap}`)
    const followUpRisk = item.momentumTrend === "stalled" || item.momentumTrend === "cooling"
    if (followUpRisk) followUpRiskCount += 1
    if (item.signalCount === 0 && item.momentumScore < 35) noResponsePatternCount += 1

    return {
      leadId: item.leadId,
      companyLabel: item.companyLabel,
      momentumScore: item.momentumScore,
      momentumTrend: item.momentumTrend,
      channelMix,
      bestNextTouchpoint: suggestBestNextTouchpoint(channelMix),
      engagementGap,
      followUpRisk,
      stalled: item.momentumTrend === "stalled",
    }
  })

  const stalledOpportunityCount = items.filter((i) => i.stalled).length

  return {
    qaMarker: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
    channelEngagementMix,
    bestNextTouchpoint,
    engagementGaps: [...new Set(engagementGaps)].slice(0, 12),
    stalledOpportunityCount,
    followUpRiskCount,
    noResponsePatternCount,
    channelFatigueWarnings,
    items,
  }
}
