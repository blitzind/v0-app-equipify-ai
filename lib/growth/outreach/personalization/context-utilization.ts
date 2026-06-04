/** Context packet utilization audit (Phase 4.4F). */

import type {
  OutreachContextPacket,
  OutreachContextQualityMetadata,
  OutreachContextSourceKey,
  SelectedMessageStrategy,
} from "@/lib/growth/outreach/personalization/personalization-types"

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function hasItems(values: string[] | undefined): boolean {
  return Boolean(values?.some((entry) => entry.trim().length > 0))
}

export function listAvailableContextSources(packet: OutreachContextPacket): OutreachContextSourceKey[] {
  const available: OutreachContextSourceKey[] = []

  if (hasText(packet.companyName)) available.push("company_name")
  if (hasText(packet.industryLabel)) available.push("industry_label")
  if (hasText(packet.website)) available.push("website")
  if (hasText(packet.location)) available.push("location")
  if (hasText(packet.decisionMakerName) || hasText(packet.decisionMakerTitle)) available.push("decision_maker")
  if (packet.fitScore != null) available.push("fit_score")
  if (packet.engagementScore != null) available.push("engagement_score")
  if (hasText(packet.websiteSummary)) available.push("website_summary")
  if (hasItems(packet.websiteFindings)) available.push("website_findings")
  if (hasItems(packet.outreachAngles)) available.push("outreach_angles")
  if (hasText(packet.companySummary)) available.push("company_summary")
  if (hasItems(packet.researchPainPoints)) available.push("research_pain_points")
  if (hasItems(packet.hiringSignals)) available.push("hiring_signals")
  if (hasItems(packet.timelineEventSummaries)) available.push("timeline_events")
  if (hasItems(packet.sequenceHistorySummaries)) available.push("sequence_history")
  if (hasItems(packet.priorTouchSummaries)) available.push("prior_touches")
  if (hasItems(packet.priorReplySummaries)) available.push("prior_replies")
  if (hasItems(packet.priorOutboundSubjects)) available.push("prior_subjects")
  if (packet.memoryAvailable || hasItems(packet.memoryInteractionSummaries)) available.push("memory")
  if (packet.leadEngineGuidance) available.push("lead_engine_guidance")
  if (hasItems(packet.enrichmentFindings)) available.push("enrichment_findings")
  if (hasItems(packet.equipmentServiceIndicators)) available.push("equipment_indicators")
  if (hasText(packet.competitorPressure)) available.push("competitor_pressure")
  if (hasItems(packet.capacitySignals)) available.push("capacity_signals")
  if (packet.researchConfidence != null) available.push("research_confidence")
  if (hasText(packet.researchRecommendedNextAction)) available.push("research_recommended_next_action")
  if (hasText(packet.websiteTextExcerpt)) available.push("website_text_excerpt")

  return available
}

function openerSourceToContextKey(source: string | undefined): OutreachContextSourceKey | null {
  switch (source) {
    case "website_finding":
      return "website_findings"
    case "website_summary":
      return "website_summary"
    case "outreach_angle":
      return "outreach_angles"
    case "lead_engine_angle":
    case "lead_engine_pain":
      return "lead_engine_guidance"
    case "research_pain_point":
      return "research_pain_points"
    case "company_summary":
      return "company_summary"
    case "industry_context":
      return "location"
    default:
      return null
  }
}

function subjectSourceToContextKey(source: string | undefined): OutreachContextSourceKey | null {
  switch (source) {
    case "website_finding":
      return "website_findings"
    case "website_summary":
      return "website_summary"
    case "outreach_angle":
      return "outreach_angles"
    case "lead_engine_angle":
    case "lead_engine_pain":
      return "lead_engine_guidance"
    case "research_pain_point":
      return "research_pain_points"
    case "company_summary":
      return "company_summary"
    case "memory_commitment":
    case "memory_interaction":
    case "memory_objection":
    case "relationship_stage":
      return "memory"
    case "sequence_context":
      return "sequence_history"
    case "pain_signal":
      return "research_pain_points"
    case "industry_signal":
      return "industry_label"
    default:
      return null
  }
}

function ctaSourceToContextKey(source: string | undefined): OutreachContextSourceKey | null {
  switch (source) {
    case "research_confidence":
      return "research_confidence"
    case "memory_commitment":
    case "memory_interaction":
    case "memory_preference":
      return "memory"
    case "prior_reply":
      return "prior_replies"
    case "booking_signal":
    case "opportunity_signal":
      return "enrichment_findings"
    case "sequence_stage":
      return "sequence_history"
    case "engagement_signal":
      return "engagement_score"
    case "pain_signal":
      return "research_pain_points"
    case "lead_engine_guidance":
      return "lead_engine_guidance"
    default:
      return null
  }
}

export function listUsedContextSources(
  packet: OutreachContextPacket,
  strategy: SelectedMessageStrategy,
): OutreachContextSourceKey[] {
  const used = new Set<OutreachContextSourceKey>(["company_name"])

  const openerKey = openerSourceToContextKey(strategy.researchOpener?.source)
  if (openerKey) used.add(openerKey)

  const subjectKey = subjectSourceToContextKey(strategy.subjectIntelligence?.evidenceSource)
  if (subjectKey) used.add(subjectKey)

  const ctaKey = ctaSourceToContextKey(strategy.ctaIntelligence?.evidenceSource)
  if (ctaKey) used.add(ctaKey)

  if (strategy.sourceSignals.includes("high_fit_signal")) used.add("fit_score")
  if (strategy.sourceSignals.includes("recent_engagement_signal")) used.add("engagement_score")
  if (strategy.sourceSignals.includes("technician_hiring_signal")) used.add("hiring_signals")
  if (strategy.sourceSignals.includes("dispatch_appears_manual")) {
    used.add("website_findings")
    used.add("research_pain_points")
  }
  if (strategy.sourceSignals.includes("repeat_touch_signal")) {
    used.add("prior_touches")
    used.add("sequence_history")
  }
  if (strategy.sourceSignals.includes("slow_response_signal")) used.add("prior_touches")

  if (packet.decisionMakerName || packet.hasDecisionMaker) used.add("decision_maker")
  if (packet.location && strategy.blocks.some((block) => block.text.includes(packet.location!))) {
    used.add("location")
  }

  if (strategy.ctaIntelligence?.evidence) {
    const evidence = strategy.ctaIntelligence.evidence.toLowerCase()
    if (packet.leadEngineGuidance?.recommendedCtaStrategy?.toLowerCase().includes(evidence.slice(0, 20))) {
      used.add("lead_engine_guidance")
    }
  }

  if (packet.leadEngineGuidance && strategy.researchOpener?.source?.startsWith("lead_engine")) {
    used.add("lead_engine_guidance")
  }

  return [...used].filter((key) => listAvailableContextSources(packet).includes(key))
}

export function computeContextUtilization(input: {
  packet: OutreachContextPacket
  strategy: SelectedMessageStrategy
}): OutreachContextQualityMetadata {
  const contextSourcesAvailable = listAvailableContextSources(input.packet)
  const contextSourcesUsed = listUsedContextSources(input.packet, input.strategy)
  const utilizationPercentage =
    contextSourcesAvailable.length === 0
      ? 0
      : Math.round((contextSourcesUsed.length / contextSourcesAvailable.length) * 100)

  return {
    contextSourcesAvailable,
    contextSourcesUsed,
    utilizationPercentage,
  }
}
