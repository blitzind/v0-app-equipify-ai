import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { listGrowthOutboundMessagesForLead } from "@/lib/growth/outbound/message-repository"
import { listGrowthOutboundRepliesForLead } from "@/lib/growth/outbound/reply-repository"
import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import { listGrowthOutreachQueueItems } from "@/lib/growth/outreach/outreach-queue-repository"
import { fetchLatestUsableGrowthLeadResearchRun } from "@/lib/growth/research-repository"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import { listGrowthLeadTimelineEvents } from "@/lib/growth/timeline-repository"
import type { GrowthLead } from "@/lib/growth/types"

function truncate(value: string | null | undefined, max = 180): string {
  const trimmed = value?.trim() ?? ""
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function locationLabel(lead: GrowthLead): string | null {
  const parts = [lead.city, lead.state, lead.country].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : null
}

function primaryDecisionMaker(
  decisionMakers: Awaited<ReturnType<typeof listGrowthLeadDecisionMakers>>,
): { name: string | null; title: string | null } {
  const confirmed = decisionMakers.find((entry) => entry.status === "confirmed")
  const primary = confirmed ?? decisionMakers[0]
  return {
    name: primary?.fullName ?? null,
    title: primary?.title ?? null,
  }
}

export async function buildOutreachContextPacket(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<OutreachContextPacket> {
  const [decisionMakers, messages, replies, researchRun, prospectRun, queueItems, timelineEvents] = await Promise.all([
    listGrowthLeadDecisionMakers(admin, lead.id),
    listGrowthOutboundMessagesForLead(admin, lead.id),
    listGrowthOutboundRepliesForLead(admin, lead.id),
    lead.latestResearchRunId
      ? fetchLatestUsableGrowthLeadResearchRun(admin, lead.id)
      : Promise.resolve(null),
    lead.latestProspectResearchRunId
      ? fetchLatestCompletedProspectResearchRun(admin, lead.id)
      : Promise.resolve(null),
    listGrowthOutreachQueueItems(admin, { leadId: lead.id, limit: 5 }),
    listGrowthLeadTimelineEvents(admin, { leadId: lead.id, limit: 8 }),
  ])

  const dm = primaryDecisionMaker(decisionMakers)
  const research = researchRun?.result

  const websiteFindings = [
    prospectRun?.researchSummary ? truncate(prospectRun.researchSummary, 160) : null,
    research?.websiteSummary ? truncate(research.websiteSummary, 160) : null,
    ...(research?.serviceAreaClues ?? []).map((entry) => truncate(entry, 80)),
    ...(research?.equipmentServiceIndicators ?? []).map((entry) => truncate(entry, 80)),
  ].filter(Boolean) as string[]

  const hiringSignals = (research?.equipifyPainPoints ?? [])
    .filter((entry) => /hiring|technician|staff|headcount|recruit/i.test(entry))
    .map((entry) => truncate(entry, 100))

  const enrichmentFindings = [
    lead.estimatedEmployeeCount,
    lead.estimatedAnnualRevenue,
    lead.fleetSizeEstimate,
    lead.crmDetected,
    lead.fieldServiceStackDetected,
    research?.likelyServiceCategory,
    research?.companySizeEstimate,
  ]
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => truncate(entry, 100))

  const priorTouchSummaries = [
    ...messages.slice(0, 4).map((message) => truncate(message.subject ?? message.bodyPreview ?? "Prior outbound message")),
    ...queueItems
      .filter((item) => item.status === "executed" || item.status === "approved")
      .slice(0, 2)
      .map((item) => truncate(item.payloadSnapshot.subject ?? item.payloadSnapshot.body ?? "Queued outreach")),
  ]

  const priorReplySummaries = replies.slice(0, 4).map((reply) => {
    const classification = reply.classification ? ` (${reply.classification})` : ""
    return truncate(`${reply.bodyPreview}${classification}`)
  })

  const objectionSummaries = [
    ...lead.conversationObjectionProfile.clusters.map((entry) => truncate(entry.key.replace(/_/g, " "), 80)),
    ...lead.conversationTopSignals
      .filter((signal) => /objection|competitor|budget|timing/i.test(signal.label))
      .map((signal) => truncate(signal.label, 80)),
  ]

  const sequenceHistorySummaries = queueItems
    .filter((item) => item.sequencePatternId)
    .map((item) => {
      const step = item.payloadSnapshot.sequenceStep
      return truncate(
        `Sequence step${step != null ? ` ${step}` : ""}: ${item.payloadSnapshot.subject ?? item.status}`,
      )
    })

  const timelineEventSummaries = timelineEvents
    .slice(0, 6)
    .map((event) => truncate(`${event.title}${event.summary ? ` — ${event.summary}` : ""}`, 120))

  const capacitySignals = [
    lead.capacityProtectionRecommendation,
    lead.operationalCapacitySummary,
    ...lead.operationalCapacityTopConstraints.map((entry) => entry.label),
  ]
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => truncate(entry, 100))

  const competitorPressure =
    lead.conversationCompetitorMentions.length > 0
      ? truncate(
          lead.conversationCompetitorMentions
            .map((entry) => entry.name)
            .filter(Boolean)
            .join(", "),
          120,
        ) || null
      : lead.fieldServiceStackDetected
        ? truncate(`Existing stack: ${lead.fieldServiceStackDetected}`, 120)
        : null

  const buyingIntent =
    lead.conversationBuyingIntent ??
    (lead.opportunityBuyingSignalStrength !== "none" ? lead.opportunityBuyingSignalStrength : null)

  return {
    companyName: lead.companyName,
    industryLabel: research?.likelyServiceCategory ?? lead.sourceChannel,
    website: lead.website,
    employeeSize: lead.estimatedEmployeeCount ?? research?.estimatedEmployeeCount ?? null,
    location: locationLabel(lead),
    decisionMakerName: dm.name ?? lead.contactName,
    decisionMakerTitle: dm.title,
    fitScore: lead.score,
    engagementScore: lead.engagementScore,
    opportunityReadinessTier: lead.opportunityReadinessTier,
    buyingIntent: buyingIntent ? String(buyingIntent) : null,
    competitorPressure,
    capacitySignals,
    websiteFindings,
    hiringSignals,
    enrichmentFindings,
    priorTouchSummaries,
    priorReplySummaries,
    objectionSummaries,
    sequenceHistorySummaries,
    timelineEventSummaries,
    researchConfidence: research?.researchConfidence ?? researchRun?.researchConfidence ?? null,
    researchPainPoints: (research?.equipifyPainPoints ?? []).map((entry) => truncate(entry, 100)),
    equipmentServiceIndicators: (research?.equipmentServiceIndicators ?? []).map((entry) => truncate(entry, 100)),
    priorTouchCount: priorTouchSummaries.length,
    hasWebsiteResearch: Boolean(research?.websiteSummary || websiteFindings.length > 0),
    hasDecisionMaker: Boolean(dm.name) || lead.decisionMakerStatus === "confirmed",
  }
}

export function buildAllowedFactsFromContextPacket(packet: OutreachContextPacket): string[] {
  return [
    packet.companyName,
    packet.industryLabel,
    packet.website,
    packet.employeeSize,
    packet.location,
    packet.decisionMakerName,
    packet.decisionMakerTitle,
    packet.opportunityReadinessTier,
    packet.buyingIntent,
    packet.competitorPressure,
    ...packet.capacitySignals,
    ...packet.websiteFindings,
    ...packet.hiringSignals,
    ...packet.enrichmentFindings,
    ...packet.researchPainPoints,
    ...packet.equipmentServiceIndicators,
    ...packet.priorReplySummaries,
    ...packet.objectionSummaries,
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}
