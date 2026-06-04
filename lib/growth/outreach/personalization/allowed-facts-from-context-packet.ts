/** Allowed facts guardrails for outreach AI refinement (Phase 4.4C). Client-safe. */

import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"

export function buildAllowedFactsFromContextPacket(packet: OutreachContextPacket): string[] {
  const leadEngineFacts = packet.leadEngineGuidance
    ? [
        packet.leadEngineGuidance.personalizationSummary,
        packet.leadEngineGuidance.companyContext,
        packet.leadEngineGuidance.contactContext,
        packet.leadEngineGuidance.recommendedCtaStrategy,
        ...packet.leadEngineGuidance.prioritizedPainPoints,
        ...packet.leadEngineGuidance.prioritizedOutreachAngles,
        ...packet.leadEngineGuidance.communicationGuidance,
        ...packet.leadEngineGuidance.buyingSignalGuidance,
      ]
    : []

  const scoreFacts = [
    packet.fitScore != null ? `Fit score: ${packet.fitScore}` : null,
    packet.engagementScore != null ? `Engagement score: ${packet.engagementScore}` : null,
  ]

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
    packet.researchRecommendedNextAction,
    ...(packet.websiteSummary ? [packet.websiteSummary] : []),
    ...(packet.websiteTextExcerpt ? [packet.websiteTextExcerpt] : []),
    ...scoreFacts,
    ...packet.capacitySignals,
    ...packet.websiteFindings,
    ...packet.hiringSignals,
    ...packet.enrichmentFindings,
    ...packet.researchPainPoints,
    ...packet.equipmentServiceIndicators,
    ...(packet.companySummary ? [packet.companySummary] : []),
    ...packet.outreachAngles,
    ...packet.priorReplySummaries,
    ...packet.priorTouchSummaries,
    ...packet.objectionSummaries,
    ...packet.timelineEventSummaries,
    ...packet.sequenceHistorySummaries,
    ...packet.priorOutboundSubjects,
    ...(packet.relationshipSummary ? [packet.relationshipSummary] : []),
    ...packet.memoryPreferenceSummaries,
    ...packet.memoryInteractionSummaries,
    ...packet.memoryCommitmentSummaries,
    ...leadEngineFacts,
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}
