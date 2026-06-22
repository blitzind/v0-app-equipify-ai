/** GS-AI-PLAYBOOK-5C — Unified activity feed merge, metrics, and rail queues (client-safe). */

import type {
  GrowthActivityEventView,
  GrowthActivityMetricsView,
  GrowthActivityRailCardView,
  GrowthActivityRailQueueId,
  GrowthActivitySourceAuditEntry,
} from "@/lib/growth/activity/growth-activity-workspace-types"

function isToday(iso: string): boolean {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function isWithinDays(iso: string, days: number): boolean {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  return date.getTime() >= Date.now() - days * 24 * 60 * 60 * 1000
}

export function mergeGrowthActivityEvents(
  ...groups: GrowthActivityEventView[][]
): GrowthActivityEventView[] {
  const byId = new Map<string, GrowthActivityEventView>()
  for (const group of groups) {
    for (const event of group) {
      if (!byId.has(event.id)) {
        byId.set(event.id, event)
      }
    }
  }
  return [...byId.values()].sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  )
}

export function computeGrowthActivityMetrics(events: GrowthActivityEventView[]): GrowthActivityMetricsView {
  return {
    today: events.filter((event) => isToday(event.occurredAt)).length,
    thisWeek: events.filter((event) => isWithinDays(event.occurredAt, 7)).length,
    needsAttention: events.filter(
      (event) => event.urgency === "high" || event.urgency === "critical" || event.metadata.isUnread,
    ).length,
    highIntent: events.filter((event) => (event.score ?? 0) >= 70).length,
    meetingsBooked: events.filter((event) => /meeting|booking/i.test(`${event.type} ${event.title}`)).length,
    personalizationsGenerated: events.filter((event) => event.category === "personalization").length,
    callsCompleted: events.filter((event) => /call_completed|live_call_completed|call_started/i.test(event.type)).length,
  }
}

function dedupeRailCards(cards: GrowthActivityRailCardView[]): GrowthActivityRailCardView[] {
  const byLead = new Map<string, GrowthActivityRailCardView>()
  for (const card of cards) {
    const existing = byLead.get(card.leadId)
    if (!existing || card.score > existing.score) {
      byLead.set(card.leadId, card)
    }
  }
  return [...byLead.values()].sort((left, right) => right.score - left.score)
}

export type GrowthActivityRailQueues = Record<GrowthActivityRailQueueId, GrowthActivityRailCardView[]>

export function buildGrowthActivityRailQueues(input: {
  sendrProspects: GrowthActivityRailCardView[]
  signalHot: GrowthActivityRailCardView[]
  events: GrowthActivityEventView[]
}): GrowthActivityRailQueues {
  const needsAttention = dedupeRailCards([
    ...input.sendrProspects
      .filter((card) => card.score >= 55 && card.score < 70)
      .map((card) => ({ ...card, queueId: "needs-attention" as const })),
    ...input.events
      .filter((event) => event.metadata.isUnread || event.urgency === "critical")
      .filter((event) => event.leadId)
      .map((event) => ({
        leadId: event.leadId!,
        name: event.leadName ?? event.companyName ?? "Unknown lead",
        company: event.companyName,
        score: event.score ?? 60,
        reason: event.title,
        queueId: "needs-attention" as const,
        lastActivityAt: event.occurredAt,
        actions: event.actions,
      })),
  ])

  const hotProspects = dedupeRailCards([
    ...input.sendrProspects.filter((card) => card.score >= 70),
    ...input.signalHot,
  ]).map((card) => ({ ...card, queueId: "hot-prospects" as const }))

  const meetingsReady = dedupeRailCards(
    input.events
      .filter((event) => /meeting|booking|positive|interest/i.test(`${event.type} ${event.title} ${event.description ?? ""}`))
      .filter((event) => event.leadId && (event.score ?? 0) >= 50)
      .map((event) => ({
        leadId: event.leadId!,
        name: event.leadName ?? event.companyName ?? "Unknown lead",
        company: event.companyName,
        score: event.score ?? 65,
        reason: event.title,
        queueId: "meetings-ready" as const,
        lastActivityAt: event.occurredAt,
        actions: event.actions,
      })),
  )

  const stalledOpportunities = dedupeRailCards(
    input.events
      .filter((event) => event.category === "sales")
      .filter((event) => /opportunity|stage|stalled|follow/i.test(`${event.type} ${event.title}`))
      .filter((event) => event.leadId)
      .map((event) => ({
        leadId: event.leadId!,
        name: event.leadName ?? event.companyName ?? "Unknown lead",
        company: event.companyName,
        score: event.score ?? 45,
        reason: event.description ?? event.title,
        queueId: "stalled-opportunities" as const,
        lastActivityAt: event.occurredAt,
        actions: event.actions,
      })),
  )

  return {
    "needs-attention": needsAttention.slice(0, 6),
    "hot-prospects": hotProspects.slice(0, 6),
    "meetings-ready": meetingsReady.slice(0, 6),
    "stalled-opportunities": stalledOpportunities.slice(0, 6),
  }
}

export function buildGrowthActivitySourceAudit(input: {
  sendr: number
  engagement: number
  signals: number
  timeline: number
  personalization: number
  sendrAvailable: boolean
  engagementAvailable: boolean
  signalsAvailable: boolean
  timelineAvailable: boolean
  personalizationAvailable: boolean
}): GrowthActivitySourceAuditEntry[] {
  return [
    { source: "personalized_video", eventCount: input.sendr, available: input.sendrAvailable },
    { source: "share_page", eventCount: input.engagement, available: input.engagementAvailable },
    { source: "signal_feed", eventCount: input.signals, available: input.signalsAvailable },
    { source: "lead_timeline", eventCount: input.timeline, available: input.timelineAvailable },
    { source: "personalization", eventCount: input.personalization, available: input.personalizationAvailable },
  ]
}
