import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildOutreachObjectionSummaries,
  resolveConversationCompetitorMentionNames,
  resolveOperationalCapacityConstraintLabels,
} from "@/lib/growth/outreach/personalization/context-lead-field-guards"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { listGrowthOutboundMessagesForLead } from "@/lib/growth/outbound/message-repository"
import { listGrowthOutboundRepliesForLead } from "@/lib/growth/outbound/reply-repository"
import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import { listGrowthOutreachQueueItems } from "@/lib/growth/outreach/outreach-queue-repository"
import { fetchLatestUsableGrowthLeadResearchRun } from "@/lib/growth/research-repository"
import { normalizeGrowthResearchConfidence } from "@/lib/growth/research/research-confidence"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import { resolveLeadEngineGuidanceFromLeadMetadata } from "@/lib/growth/outreach/personalization/lead-engine-guidance-bridge"
import { buildOutreachVerifiedFactsFromPacket } from "@/lib/growth/outreach/personalization/outreach-verified-facts"
import {
  buildOutreachIndustryContextForLead,
  fetchLatestPersonalizationRegenerationFeedback,
} from "@/lib/growth/outreach/personalization/outreach-industry-context-builder"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import { buildLeadMemoryInfluenceContext, mergeMemoryObjectionSummaries } from "@/lib/growth/lead-memory/memory-influence-context"
import {
  filterUsableOutreachMemorySnippet,
  isRedactedContactName,
  isUnusableOutreachMemoryEvidence,
} from "@/lib/growth/lead-memory/outreach-memory-evidence-guard"
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

function resolveOutreachContactName(
  lead: GrowthLead,
  decisionMakers: Awaited<ReturnType<typeof listGrowthLeadDecisionMakers>>,
): string | null {
  const dm = primaryDecisionMaker(decisionMakers)
  if (dm.name && !isRedactedContactName(dm.name)) return dm.name
  if (lead.contactName && !isRedactedContactName(lead.contactName)) return lead.contactName
  return dm.name ?? lead.contactName ?? null
}

function resolveApolloCompanyContactId(lead: GrowthLead): string | null {
  const metadata = lead.metadata && typeof lead.metadata === "object" ? lead.metadata : null
  if (!metadata) return null
  const primary = metadata.apollo_primary_contact
  if (primary && typeof primary === "object") {
    const id = (primary as { company_contact_id?: unknown }).company_contact_id
    if (typeof id === "string" && id.trim()) return id.trim()
  }
  const enrollment = metadata.apollo_enrollment_automation
  if (enrollment && typeof enrollment === "object") {
    const id = (enrollment as { company_contact_id?: unknown }).company_contact_id
    if (typeof id === "string" && id.trim()) return id.trim()
  }
  return null
}

function deriveContactNameFromEmail(email: string | null | undefined): string | null {
  const local = email?.split("@")[0]?.trim()
  if (!local) return null
  const parts = local.replace(/[._+-]+/g, " ").split(/\s+/).filter(Boolean)
  if (!parts.length) return null
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

async function resolveOutreachContactNameFromLead(
  admin: SupabaseClient,
  lead: GrowthLead,
  decisionMakers: Awaited<ReturnType<typeof listGrowthLeadDecisionMakers>>,
): Promise<string | null> {
  const resolved = resolveOutreachContactName(lead, decisionMakers)
  if (resolved && !isRedactedContactName(resolved)) return resolved

  const companyContactId = resolveApolloCompanyContactId(lead)
  if (companyContactId) {
    const { data } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("full_name, email")
      .eq("id", companyContactId)
      .maybeSingle()
    const fullName = typeof data?.full_name === "string" ? data.full_name.trim() : ""
    if (fullName && !isRedactedContactName(fullName)) return fullName
    const fromEmail = deriveContactNameFromEmail(typeof data?.email === "string" ? data.email : null)
    if (fromEmail && !isRedactedContactName(fromEmail)) return fromEmail
  }

  return resolved
}

function usableReplySummary(reply: { bodyPreview: string; classification?: string | null }): string | null {
  const classification = reply.classification ? ` (${reply.classification})` : ""
  const raw = `${reply.bodyPreview}${classification}`.trim()
  if (isUnusableOutreachMemoryEvidence({ evidence: raw })) return null
  return truncate(raw)
}

export async function buildOutreachContextPacket(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<OutreachContextPacket> {
  const [decisionMakers, messages, replies, researchRun, prospectRun, queueItems, timelineEvents, memory] =
    await Promise.all([
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
    buildLeadMemoryInfluenceContext(admin, lead.id),
  ])

  const dm = primaryDecisionMaker(decisionMakers)
  const contactName = await resolveOutreachContactNameFromLead(admin, lead, decisionMakers)
  const research = researchRun?.result
  const leadEngineGuidance = resolveLeadEngineGuidanceFromLeadMetadata(lead.metadata)

  const websiteSummaryRaw = research?.websiteSummary?.trim() ? truncate(research.websiteSummary, 200) : null
  const websiteTextExcerpt = researchRun?.websiteTextExcerpt?.trim()
    ? truncate(researchRun.websiteTextExcerpt, 200)
    : null

  const websiteFindings = [
    ...(prospectRun?.signals?.companyEvidence_v22?.profile.industriesServed?.values ?? []).map((entry) =>
      truncate(`Verified industry: ${entry}`, 100),
    ),
    ...(prospectRun?.signals?.companyEvidence_v22?.profile.primaryServices?.values ?? []).map((entry) =>
      truncate(`Verified service: ${entry}`, 100),
    ),
    ...(prospectRun?.signals?.companyEvidence_v22?.profile.primaryProducts?.values ?? []).map((entry) =>
      truncate(`Verified product: ${entry}`, 100),
    ),
    ...(prospectRun?.signals?.companyEvidence_v22?.evidenceSources ?? []).map((entry) =>
      truncate(`Source: ${entry}`, 120),
    ),
    prospectRun?.researchSummary ? truncate(prospectRun.researchSummary, 160) : null,
    websiteSummaryRaw,
    ...(research?.serviceAreaClues ?? []).map((entry) => truncate(entry, 80)),
    ...(research?.equipmentServiceIndicators ?? []).map((entry) => truncate(entry, 80)),
  ].filter(Boolean) as string[]

  const researchOutreachAngles = (research?.outreachAngles ?? []).map((entry) => truncate(entry, 100))
  const bridgedOutreachAngles = [
    ...researchOutreachAngles,
    ...(leadEngineGuidance?.prioritizedOutreachAngles ?? []),
  ]
  const outreachAngles = [...new Set(bridgedOutreachAngles.map((entry) => entry.trim()).filter(Boolean))]

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

  const priorOutboundSubjects = [
    ...messages
      .slice(0, 6)
      .map((message) => truncate(message.subject ?? "", 120))
      .filter((entry) => entry.trim().length > 0),
    ...queueItems
      .map((item) => truncate(item.payloadSnapshot.subject ?? "", 120))
      .filter((entry) => entry.trim().length > 0),
  ]

  const priorTouchSummaries = [
    ...messages.slice(0, 4).map((message) => truncate(message.subject ?? message.bodyPreview ?? "Prior outbound message")),
    ...queueItems
      .filter((item) => item.status === "executed" || item.status === "approved")
      .slice(0, 2)
      .map((item) => truncate(item.payloadSnapshot.subject ?? item.payloadSnapshot.body ?? "Queued outreach")),
  ]

  const priorReplySummaries = replies
    .slice(0, 4)
    .map((reply) => usableReplySummary(reply))
    .filter((entry): entry is string => Boolean(entry))

  const objectionSummaries = mergeMemoryObjectionSummaries(
    buildOutreachObjectionSummaries({
      conversationObjectionProfile: lead.conversationObjectionProfile,
      conversationTopSignals: lead.conversationTopSignals,
    }).map((entry) => truncate(entry, 80)),
    memory,
  )

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
    .map((event) => {
      if (isUnusableOutreachMemoryEvidence({ title: event.title, evidence: event.summary ?? "" })) return null
      return truncate(`${event.title}${event.summary ? ` — ${event.summary}` : ""}`, 120)
    })
    .filter((entry): entry is string => Boolean(entry))

  const capacityConstraints = resolveOperationalCapacityConstraintLabels(lead.operationalCapacityTopConstraints)
  const capacitySignals = [
    lead.capacityProtectionRecommendation,
    lead.operationalCapacitySummary,
    ...capacityConstraints,
  ]
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => truncate(entry, 100))

  const competitorMentions = resolveConversationCompetitorMentionNames(lead.conversationCompetitorMentions)
  const competitorPressure =
    competitorMentions.length > 0
      ? truncate(competitorMentions.join(", "), 120) || null
      : lead.fieldServiceStackDetected
        ? truncate(`Existing stack: ${lead.fieldServiceStackDetected}`, 120)
        : null

  const buyingIntent =
    lead.conversationBuyingIntent ??
    (lead.opportunityBuyingSignalStrength !== "none" ? lead.opportunityBuyingSignalStrength : null)

  const metadata = (lead.metadata ?? {}) as Record<string, unknown>
  const metadataCodes = (...keys: string[]): string[] => {
    const values: string[] = []
    for (const key of keys) {
      const raw = metadata[key]
      if (typeof raw === "string" && raw.trim()) values.push(raw.trim())
      if (Array.isArray(raw)) {
        for (const entry of raw) {
          if (typeof entry === "string" && entry.trim()) values.push(entry.trim())
        }
      }
    }
    return [...new Set(values)]
  }

  const packetBase = {
    companyName: lead.companyName,
    industryLabel: research?.likelyServiceCategory ?? lead.industry ?? lead.sourceChannel,
    website: lead.website,
    employeeSize: lead.estimatedEmployeeCount ?? research?.estimatedEmployeeCount ?? null,
    location: locationLabel(lead),
    decisionMakerName: contactName,
    decisionMakerTitle: dm.title,
    fitScore: lead.score,
    engagementScore: lead.engagementScore,
    opportunityReadinessTier: lead.opportunityReadinessTier,
    buyingIntent: buyingIntent ? String(buyingIntent) : null,
    competitorPressure,
    capacitySignals,
    websiteSummary: websiteSummaryRaw,
    websiteTextExcerpt,
    websiteFindings,
    hiringSignals,
    enrichmentFindings,
    researchRecommendedNextAction: research?.recommendedNextAction?.trim()
      ? truncate(research.recommendedNextAction, 120)
      : prospectRun?.recommendedNextAction?.trim()
        ? truncate(prospectRun.recommendedNextAction, 120)
        : null,
    priorTouchSummaries,
    priorReplySummaries,
    objectionSummaries,
    sequenceHistorySummaries,
    timelineEventSummaries,
    researchConfidence: normalizeGrowthResearchConfidence(
      research?.researchConfidence ?? researchRun?.researchConfidence ?? null,
    ),
    researchPainPoints: (research?.equipifyPainPoints ?? []).map((entry) => truncate(entry, 100)),
    equipmentServiceIndicators: (research?.equipmentServiceIndicators ?? []).map((entry) => truncate(entry, 100)),
    companySummary: research?.companySummary ? truncate(research.companySummary, 160) : null,
    outreachAngles,
    priorOutboundSubjects,
    priorTouchCount: priorTouchSummaries.length,
    hasWebsiteResearch: Boolean(research?.websiteSummary || websiteFindings.length > 0),
    hasDecisionMaker: Boolean(dm.name) || lead.decisionMakerStatus === "confirmed",
    memoryAvailable: memory.available,
    memoryCoverageScore: memory.memoryCoverageScore,
    relationshipStage: memory.relationshipStage,
    relationshipSummary: memory.relationshipSummary ? truncate(memory.relationshipSummary, 400) : null,
    memoryPreferenceSummaries: memory.topPreferences.map((entry) => truncate(entry, 100)),
    memoryInteractionSummaries: memory.priorInteractionSummaries.map((entry) => truncate(entry, 120)),
    memoryCommitmentSummaries: memory.commitmentSummaries.map((entry) => truncate(entry, 120)),
    memoryAvoidRepeating: memory.avoidRepeating.map((entry) => truncate(entry, 100)),
    memoryRiskFlags: memory.riskFlags.map((entry) => truncate(entry, 100)),
    memoryCommitteeSummaries: memory.committeeContext
      .map((entry) => filterUsableOutreachMemorySnippet(entry, 120))
      .filter((entry): entry is string => Boolean(entry)),
    memoryOpenLoopSummaries: [
      ...memory.priorInteractionSummaries,
      ...priorReplySummaries,
    ]
      .filter((entry) =>
        /\b(asked|requested|pricing|breakdown|routing|proposal|send|share|wondering|question|follow up on)\b/i.test(
          entry,
        ),
      )
      .map((entry) => truncate(entry, 120))
      .slice(0, 4),
    memoryEngagementTrend: memory.engagementTrend,
    memoryProgressionScore: memory.progressionScore,
    memoryUnresolvedObjectionCount: memory.unresolvedObjectionCount,
    leadEngineGuidance,
  } satisfies Omit<OutreachContextPacket, "industryContext">

  const regenerationFeedback = await fetchLatestPersonalizationRegenerationFeedback(admin, lead.id)
  const verifiedFacts = buildOutreachVerifiedFactsFromPacket(packetBase as OutreachContextPacket)
  const industryContext = buildGrowthIndustryContext({
    companyName: lead.companyName,
    industryLabel: packetBase.industryLabel,
    description: research?.companySummary ?? null,
    websiteText: researchRun?.websiteTextExcerpt ?? null,
    researchSummary: research?.websiteSummary ?? null,
    naics: metadataCodes("naics", "naics_codes", "naicsCodes"),
    sic: metadataCodes("sic", "sic_codes", "sicCodes"),
    verifiedFacts,
    regenerationFeedback,
    leadSignals: [
      ...(packetBase.researchPainPoints ?? []),
      ...(packetBase.equipmentServiceIndicators ?? []),
      ...(packetBase.hiringSignals ?? []),
    ],
    researchSignals: [
      packetBase.companySummary,
      ...(packetBase.outreachAngles ?? []),
      ...(packetBase.websiteFindings ?? []),
    ].filter(Boolean) as string[],
    hiringSignals: packetBase.hiringSignals ?? [],
    websiteSignals: [
      packetBase.websiteTextExcerpt,
      ...(packetBase.websiteFindings ?? []),
      ...(packetBase.equipmentServiceIndicators ?? []),
    ].filter(Boolean) as string[],
    companySize: packetBase.employeeSize,
    decisionMakerTitle: packetBase.decisionMakerTitle,
    accountIntelligence: {
      outreachAngles: packetBase.outreachAngles,
      equipmentServiceIndicators: packetBase.equipmentServiceIndicators,
      enrichmentFindings: packetBase.enrichmentFindings,
      websiteFindings: packetBase.websiteFindings,
      researchFindings: packetBase.researchPainPoints,
      researchConfidence: packetBase.researchConfidence,
      observedAt: researchRun?.finishedAt ?? prospectRun?.completedAt ?? null,
      leadMetadata: {
        crmDetected: lead.crmDetected,
        fieldServiceStackDetected: lead.fieldServiceStackDetected,
        estimatedEmployeeCount: lead.estimatedEmployeeCount,
        estimatedAnnualRevenue: lead.estimatedAnnualRevenue,
        fleetSizeEstimate: lead.fleetSizeEstimate,
      },
      crmMetadata: {
        industry: packetBase.industryLabel,
        location: packetBase.location,
        buyingIntent: packetBase.buyingIntent,
        competitorPressure: packetBase.competitorPressure,
      },
    },
  })

  return {
    ...packetBase,
    industryContext,
  }
}

export async function resolveOutreachLeadIndustryTags(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<string[]> {
  const context = await buildOutreachIndustryContextForLead(admin, lead)
  return context.leadIndustryTags
}

export { buildAllowedFactsFromContextPacket } from "@/lib/growth/outreach/personalization/allowed-facts-from-context-packet"
