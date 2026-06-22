/** GS-AI-PLAYBOOK-5C — Deterministic activity source adapters (client-safe). */

import {
  GROWTH_ACTIVITY_COMMUNICATION_TIMELINE_TYPES,
  GROWTH_ACTIVITY_INTELLIGENCE_TIMELINE_TYPES,
  GROWTH_ACTIVITY_PERSONALIZATION_TIMELINE_TYPES,
  GROWTH_ACTIVITY_SALES_TIMELINE_TYPES,
} from "@/lib/growth/activity/growth-activity-event-types"
import {
  buildGrowthActivityEventQuickActions,
} from "@/lib/growth/activity/growth-activity-workspace-deep-links"
import type {
  GrowthActivityCategory,
  GrowthActivityEventMetadata,
  GrowthActivityEventView,
  GrowthActivityRailCardView,
  GrowthActivityRailQueueId,
  GrowthActivityUrgency,
} from "@/lib/growth/activity/growth-activity-workspace-types"
import type { GrowthEngagementTimelineEvent } from "@/lib/growth/engagement/growth-engagement-timeline-types"
import type { GrowthPersonalizationGeneration } from "@/lib/growth/personalization/personalization-types"
import type { GrowthSignalFeedItem } from "@/lib/growth/signal-intelligence/signal-feed-types"
import type {
  GrowthSendrActivityFeedRow,
  GrowthSendrActivityHotProspect,
} from "@/lib/growth/sendr/growth-sendr-types"

export type GrowthActivityLeadTimelineRow = {
  id: string
  leadId: string
  leadName: string | null
  companyName: string | null
  eventType: string
  title: string
  summary: string | null
  occurredAt: string
  payload: Record<string, unknown>
}

function resolveUrgencyFromScore(score: number | null | undefined): GrowthActivityUrgency {
  if (score == null) return "low"
  if (score >= 85) return "critical"
  if (score >= 70) return "high"
  if (score >= 45) return "medium"
  return "low"
}

function resolveCategoryFromTimelineEventType(eventType: string): GrowthActivityCategory {
  if ((GROWTH_ACTIVITY_COMMUNICATION_TIMELINE_TYPES as readonly string[]).includes(eventType)) {
    return "communication"
  }
  if ((GROWTH_ACTIVITY_PERSONALIZATION_TIMELINE_TYPES as readonly string[]).includes(eventType)) {
    return "personalization"
  }
  if ((GROWTH_ACTIVITY_SALES_TIMELINE_TYPES as readonly string[]).includes(eventType)) {
    return "sales"
  }
  if ((GROWTH_ACTIVITY_INTELLIGENCE_TIMELINE_TYPES as readonly string[]).includes(eventType)) {
    return "intelligence"
  }
  return "communication"
}

function resolveCategoryFromSignalType(signalType: string): GrowthActivityCategory {
  const normalized = signalType.toLowerCase()
  if (/reply|email|sms|inbox|communication/.test(normalized)) return "communication"
  if (/personalization|generation|draft/.test(normalized)) return "personalization"
  if (/meeting|call|opportunity|follow|revenue|stage/.test(normalized)) return "sales"
  if (/engagement|intent|relationship|score|hot|buyer/.test(normalized)) return "intelligence"
  return "intelligence"
}

function resolveCategoryFromEngagementEvent(eventType: string): GrowthActivityCategory {
  if (eventType === "high_intent_detected") return "intelligence"
  return "content"
}

function buildEventView(input: {
  id: string
  type: string
  category: GrowthActivityCategory
  title: string
  description: string | null
  leadId: string | null
  leadName: string | null
  companyName: string | null
  occurredAt: string
  urgency: GrowthActivityUrgency
  score: number | null
  source: string
  landingPageId?: string | null
  landingPageTitle?: string | null
  sharePageId?: string | null
  generationId?: string | null
  metadata?: Partial<GrowthActivityEventMetadata>
}): GrowthActivityEventView {
  const metadata: GrowthActivityEventMetadata = {
    sourceSystem: input.source,
    sourceRecordId: input.id,
    channel: input.metadata?.channel ?? null,
    sharePageId: input.sharePageId ?? input.metadata?.sharePageId ?? null,
    landingPageId: input.landingPageId ?? input.metadata?.landingPageId ?? null,
    generationId: input.generationId ?? input.metadata?.generationId ?? null,
    opportunityId: input.metadata?.opportunityId ?? null,
    isUnread: input.metadata?.isUnread ?? false,
    ownerUserId: input.metadata?.ownerUserId ?? null,
    signalType: input.metadata?.signalType ?? null,
    rawEventType: input.metadata?.rawEventType ?? input.type,
  }

  const actions = buildGrowthActivityEventQuickActions({
    leadId: input.leadId,
    landingPageId: input.landingPageId,
    sharePageId: input.sharePageId,
    generationId: input.generationId,
    category: input.category,
  })

  return {
    id: input.id,
    type: input.type,
    category: input.category,
    title: input.title,
    description: input.description,
    leadId: input.leadId,
    leadName: input.leadName,
    companyName: input.companyName,
    occurredAt: input.occurredAt,
    urgency: input.urgency,
    score: input.score,
    source: input.source,
    landingPageId: input.landingPageId,
    landingPageTitle: input.landingPageTitle,
    actions,
    metadata,
  }
}

export function mapSendrActivityFeedRowToEventView(row: GrowthSendrActivityFeedRow): GrowthActivityEventView {
  return buildEventView({
    id: `sendr:${row.id}`,
    type: row.eventType,
    category: "content",
    title: row.eventLabel,
    description: row.landingPageTitle,
    leadId: row.leadId,
    leadName: row.leadName,
    companyName: row.companyName,
    occurredAt: row.occurredAt,
    urgency: resolveUrgencyFromScore(row.intentScore),
    score: row.intentScore,
    source: "personalized_video",
    landingPageId: row.landingPageId,
    landingPageTitle: row.landingPageTitle,
    metadata: { rawEventType: row.eventType },
  })
}

export function mapEngagementTimelineEventToEventView(
  event: GrowthEngagementTimelineEvent,
): GrowthActivityEventView {
  const companyName =
    typeof event.metadata.company_name === "string" ? event.metadata.company_name : null
  const leadName = typeof event.metadata.lead_name === "string" ? event.metadata.lead_name : null
  const score =
    typeof event.metadata.intent_score === "number" ? event.metadata.intent_score : null

  return buildEventView({
    id: `engagement:${event.eventId}`,
    type: event.eventType,
    category: resolveCategoryFromEngagementEvent(event.eventType),
    title: event.title,
    description: event.description || null,
    leadId: event.leadId,
    leadName,
    companyName,
    occurredAt: event.occurredAt,
    urgency: resolveUrgencyFromScore(score),
    score,
    source: "share_page",
    sharePageId: event.sharePageId,
    metadata: { rawEventType: event.eventType, channel: "web" },
  })
}

export function mapSignalFeedItemToEventView(item: GrowthSignalFeedItem): GrowthActivityEventView {
  const score = item.signal_score ?? Math.round(item.confidence * 100)
  const urgency: GrowthActivityUrgency =
    item.urgency === "critical" || item.priority === "urgent"
      ? "critical"
      : item.urgency === "high" || item.priority === "high"
        ? "high"
        : resolveUrgencyFromScore(score)

  return buildEventView({
    id: `signal:${item.id}`,
    type: String(item.signal_type),
    category: resolveCategoryFromSignalType(String(item.signal_type)),
    title: item.signal_label,
    description: item.recommended_action || item.reasoning,
    leadId: item.lead_id,
    leadName: null,
    companyName: item.company_name,
    occurredAt: item.occurred_at,
    urgency,
    score,
    source: "signal_feed",
    metadata: {
      isUnread: item.status === "new",
      signalType: String(item.signal_type),
      rawEventType: String(item.signal_type),
    },
  })
}

export function mapLeadTimelineRowToEventView(row: GrowthActivityLeadTimelineRow): GrowthActivityEventView {
  const channel =
    typeof row.payload.channel === "string"
      ? row.payload.channel
      : /sms/i.test(row.eventType)
        ? "sms"
        : /email|reply|inbox/i.test(row.eventType)
          ? "email"
          : null

  return buildEventView({
    id: `timeline:${row.id}`,
    type: row.eventType,
    category: resolveCategoryFromTimelineEventType(row.eventType),
    title: row.title,
    description: row.summary,
    leadId: row.leadId,
    leadName: row.leadName,
    companyName: row.companyName,
    occurredAt: row.occurredAt,
    urgency: resolveUrgencyFromScore(
      typeof row.payload.intent_score === "number" ? row.payload.intent_score : null,
    ),
    score: typeof row.payload.intent_score === "number" ? row.payload.intent_score : null,
    source: "lead_timeline",
    metadata: { channel, rawEventType: row.eventType },
  })
}

function personalizationEventTitle(status: string, isRegeneration: boolean): string {
  if (status === "approved") return "Draft Approved"
  if (status === "rejected") return "Draft Rejected"
  if (isRegeneration) return "Draft Regenerated"
  return "Draft Generated"
}

export function mapPersonalizationGenerationToEventViews(
  generation: GrowthPersonalizationGeneration,
): GrowthActivityEventView[] {
  const events: GrowthActivityEventView[] = []
  const operatorMetadata = (generation as { operatorMetadata?: { prior_generation_id?: string } })
    .operatorMetadata
  const isRegeneration = Boolean(operatorMetadata?.prior_generation_id)

  events.push(
    buildEventView({
      id: `personalization:${generation.id}:created`,
      type: isRegeneration ? "personalization_regenerated" : "personalization_generated",
      category: "personalization",
      title: personalizationEventTitle(generation.status, isRegeneration),
      description: generation.subject,
      leadId: generation.leadId,
      leadName: generation.leadLabel,
      companyName: generation.leadLabel,
      occurredAt: generation.createdAt,
      urgency: generation.riskLevel === "critical" ? "critical" : generation.riskLevel === "high" ? "high" : "medium",
      score: generation.personalizationScore,
      source: "personalization",
      generationId: generation.id,
      metadata: { generationId: generation.id, rawEventType: "personalization_generated" },
    }),
  )

  if (generation.approvedAt) {
    events.push(
      buildEventView({
        id: `personalization:${generation.id}:approved`,
        type: "personalization_approved",
        category: "personalization",
        title: "Draft Approved",
        description: generation.subject,
        leadId: generation.leadId,
        leadName: generation.leadLabel,
        companyName: generation.leadLabel,
        occurredAt: generation.approvedAt,
        urgency: "low",
        score: generation.personalizationScore,
        source: "personalization",
        generationId: generation.id,
        metadata: { generationId: generation.id, rawEventType: "personalization_approved" },
      }),
    )
  }

  if (generation.rejectedAt) {
    events.push(
      buildEventView({
        id: `personalization:${generation.id}:rejected`,
        type: "personalization_rejected",
        category: "personalization",
        title: "Draft Rejected",
        description: generation.blockedReason || generation.subject,
        leadId: generation.leadId,
        leadName: generation.leadLabel,
        companyName: generation.leadLabel,
        occurredAt: generation.rejectedAt,
        urgency: "medium",
        score: generation.personalizationScore,
        source: "personalization",
        generationId: generation.id,
        metadata: { generationId: generation.id, rawEventType: "personalization_rejected" },
      }),
    )
  }

  return events
}

export function mapSendrHotProspectToRailCard(
  prospect: GrowthSendrActivityHotProspect,
  queueId: GrowthActivityRailQueueId = "hot-prospects",
): GrowthActivityRailCardView {
  return {
    leadId: prospect.leadId,
    name: prospect.leadName ?? "Unknown lead",
    company: prospect.companyName,
    score: prospect.intentScore,
    reason:
      prospect.recommendations[0] ??
      `${prospect.pageViews} views · ${prospect.videoCompletionPercent}% complete · ${prospect.ctaClicks} CTA`,
    queueId,
    lastActivityAt: prospect.lastActivityAt,
    actions: buildGrowthActivityEventQuickActions({
      leadId: prospect.leadId,
      landingPageId: prospect.landingPageId,
      category: "content",
    }),
  }
}

export function mapSignalFeedItemToRailCard(
  item: GrowthSignalFeedItem,
  queueId: GrowthActivityRailQueueId,
): GrowthActivityRailCardView {
  return {
    leadId: item.lead_id ?? `signal:${item.id}`,
    name: item.company_name ?? item.signal_label,
    company: item.company_name,
    score: item.signal_score ?? Math.round(item.confidence * 100),
    reason: item.recommended_action || item.reasoning,
    queueId,
    lastActivityAt: item.occurred_at,
    actions: buildGrowthActivityEventQuickActions({
      leadId: item.lead_id,
      category: resolveCategoryFromSignalType(String(item.signal_type)),
    }),
  }
}

export function mapSendrActivityFeedRows(rows: GrowthSendrActivityFeedRow[]): GrowthActivityEventView[] {
  return rows.map(mapSendrActivityFeedRowToEventView)
}

export function mapSendrHotProspects(
  prospects: GrowthSendrActivityHotProspect[],
): GrowthActivityRailCardView[] {
  return prospects.map((prospect) => mapSendrHotProspectToRailCard(prospect))
}

/** @deprecated Use mapSendrHotProspectToRailCard */
export const mapSendrHotProspectToHighIntentView = mapSendrHotProspectToRailCard
