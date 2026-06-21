/** Allowed facts guardrails for outreach AI refinement (Phase 4.4C + GS-AI-PLAYBOOK-1C). Client-safe. */

import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"

function baseAllowedFacts(packet: OutreachContextPacket): string[] {
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
    ...packet.memoryCommitteeSummaries,
    ...packet.memoryOpenLoopSummaries,
    ...(packet.memoryEngagementTrend ? [`Engagement trend: ${packet.memoryEngagementTrend}`] : []),
    ...(packet.memoryProgressionScore != null ? [`Relationship progression: ${packet.memoryProgressionScore}`] : []),
    ...leadEngineFacts,
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

export function buildVerifiedFactsFromContextPacket(packet: OutreachContextPacket): string[] {
  const verified = packet.industryContext?.verifiedFacts ?? []
  if (verified.length > 0) return verified
  return [
    packet.companyName,
    packet.companySummary,
    packet.websiteSummary,
    ...packet.websiteFindings,
    ...packet.equipmentServiceIndicators,
    ...packet.outreachAngles,
    ...packet.enrichmentFindings,
    ...packet.hiringSignals,
    packet.decisionMakerTitle,
    packet.websiteTextExcerpt,
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

export function buildIndustryFactsFromContextPacket(packet: OutreachContextPacket): string[] {
  return packet.industryContext?.industryFacts ?? []
}

export function buildAllowedFactsFromContextPacket(packet: OutreachContextPacket): string[] {
  const industryFacts = buildIndustryFactsFromContextPacket(packet)
  const verifiedFacts = buildVerifiedFactsFromContextPacket(packet)
  return [...new Set([...baseAllowedFacts(packet), ...verifiedFacts, ...industryFacts])]
}
