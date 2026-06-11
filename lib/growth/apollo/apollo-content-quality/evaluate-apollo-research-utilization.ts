/** Research and evidence utilization scoring (Phase 11B). */

import type { ApolloUnifiedPersonalizationContext } from "@/lib/growth/apollo/apollo-unified-personalization-context"
import { computeContextUtilization } from "@/lib/growth/outreach/personalization/context-utilization"
import type { OutreachContextPacket, SelectedMessageStrategy } from "@/lib/growth/outreach/personalization/personalization-types"

import type { ApolloResearchUtilizationResult } from "@/lib/growth/apollo/apollo-content-quality/apollo-content-quality-types"

const APOLLO_EVIDENCE_SOURCE_KEYS = [
  "website_excerpt",
  "lead_research",
  "pain_points",
  "company_intelligence",
  "account_playbook",
  "buying_committee",
  "prior_interactions",
  "memory",
  "previous_replies",
  "qualification_evidence",
] as const

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function hasItems(values: string[] | undefined): boolean {
  return Boolean(values?.some((entry) => entry.trim().length > 0))
}

export function listApolloEvidenceSourcesAvailable(input: {
  packet: OutreachContextPacket
  unifiedContext?: ApolloUnifiedPersonalizationContext | null
}): string[] {
  const { packet, unifiedContext } = input
  const available: string[] = []

  if (hasText(packet.websiteTextExcerpt) || hasItems(packet.websiteFindings)) {
    available.push("website_excerpt")
  }
  if (
    hasText(packet.companySummary) ||
    hasText(packet.websiteSummary) ||
    hasItems(packet.outreachAngles) ||
    hasItems(packet.enrichmentFindings)
  ) {
    available.push("lead_research")
  }
  if (hasItems(packet.researchPainPoints)) available.push("pain_points")
  if (
    hasText(packet.companySummary) ||
    hasText(unifiedContext?.company_intelligence_summary) ||
    hasText(packet.industryLabel)
  ) {
    available.push("company_intelligence")
  }
  if (hasText(unifiedContext?.account_playbook_summary)) available.push("account_playbook")
  if (
    hasItems(packet.memoryCommitteeSummaries) ||
    hasText(unifiedContext?.buying_committee_summary)
  ) {
    available.push("buying_committee")
  }
  if (hasItems(packet.priorTouchSummaries) || hasItems(packet.sequenceHistorySummaries)) {
    available.push("prior_interactions")
  }
  if (
    packet.memoryAvailable ||
    hasItems(packet.memoryInteractionSummaries) ||
    hasItems(packet.memoryCommitmentSummaries)
  ) {
    available.push("memory")
  }
  if (hasItems(packet.priorReplySummaries)) available.push("previous_replies")
  if (
    hasText(unifiedContext?.apollo_evidence_summary) ||
    unifiedContext?.qualification_score != null
  ) {
    available.push("qualification_evidence")
  }

  return available
}

function mapResearchOpenerSource(source: string | undefined): string | null {
  switch (source) {
    case "website_finding":
    case "website_summary":
      return "website_excerpt"
    case "research_pain_point":
    case "lead_engine_pain":
      return "pain_points"
    case "company_summary":
    case "outreach_angle":
    case "lead_engine_angle":
      return "lead_research"
    case "industry_context":
      return "company_intelligence"
    default:
      return null
  }
}

function inferUsedSourcesFromStrategy(input: {
  packet: OutreachContextPacket
  unifiedContext?: ApolloUnifiedPersonalizationContext | null
  strategy: SelectedMessageStrategy
}): string[] {
  const used = new Set<string>()
  const { packet, strategy, unifiedContext } = input

  if (strategy.researchOpener) {
    const mapped = mapResearchOpenerSource(strategy.researchOpener.source)
    if (mapped) used.add(mapped)
    used.add("pain_points")
    used.add("lead_research")
    if (packet.hasWebsiteResearch || hasItems(packet.websiteFindings)) used.add("website_excerpt")
    if (hasText(packet.companySummary) || hasText(packet.websiteSummary)) used.add("company_intelligence")
  }
  if (strategy.memoryOpener) {
    used.add("memory")
    if (packet.priorReplySummaries.length > 0) used.add("previous_replies")
    if (packet.priorTouchSummaries.length > 0) used.add("prior_interactions")
  }
  if (strategy.subjectIntelligence?.evidence) {
    const mapped = mapResearchOpenerSource(strategy.subjectIntelligence.evidenceSource)
    if (mapped) used.add(mapped)
  }
  if (strategy.ctaIntelligence?.evidence) {
    used.add("pain_points")
  }
  if (strategy.memoryInfluence?.committeeReferenced) {
    used.add("buying_committee")
  }
  if (
    hasText(unifiedContext?.account_playbook_summary) &&
    (strategy.researchOpener || strategy.memoryInfluence?.committeeReferenced)
  ) {
    used.add("account_playbook")
  }
  if (hasText(unifiedContext?.apollo_evidence_summary)) used.add("qualification_evidence")
  if (unifiedContext?.qualification_score != null) used.add("qualification_evidence")

  const contextUsed = computeContextUtilization({ packet, strategy })
  for (const key of contextUsed.contextSourcesUsed) {
    used.add(mapContextKeyToApolloSource(key))
  }

  return [...used]
}

function inferUsedSourcesFromContent(input: {
  packet: OutreachContextPacket
  unifiedContext?: ApolloUnifiedPersonalizationContext | null
  subject?: string
  body: string
  strategy?: SelectedMessageStrategy
}): string[] {
  const used = new Set<string>()
  const combined = `${input.subject ?? ""} ${input.body}`.toLowerCase()
  const packet = input.packet
  const unified = input.unifiedContext

  const mentions = (value: string | null | undefined) =>
    hasText(value) && combined.includes(value!.trim().toLowerCase().slice(0, 16))

  if (
    mentions(packet.websiteTextExcerpt) ||
    packet.websiteFindings.some((f) => combined.includes(f.toLowerCase().slice(0, 16)))
  ) {
    used.add("website_excerpt")
  }
  if (
    mentions(packet.companySummary) ||
    mentions(packet.websiteSummary) ||
    packet.outreachAngles.some((a) => combined.includes(a.toLowerCase().slice(0, 16)))
  ) {
    used.add("lead_research")
    if (packet.outreachAngles.some((a) => /playbook/i.test(a) && combined.includes(a.toLowerCase().slice(0, 16)))) {
      used.add("account_playbook")
    }
  }
  if (packet.researchPainPoints.some((p) => combined.includes(p.toLowerCase().slice(0, 16)))) {
    used.add("pain_points")
  }
  if (
    mentions(packet.companySummary) ||
    mentions(unified?.company_intelligence_summary) ||
    (packet.industryLabel && combined.includes(packet.industryLabel.toLowerCase().slice(0, 12)))
  ) {
    used.add("company_intelligence")
  }
  if (mentions(unified?.account_playbook_summary)) used.add("account_playbook")
  if (
    packet.memoryCommitteeSummaries.some((c) => combined.includes(c.toLowerCase().slice(0, 16))) ||
    mentions(unified?.buying_committee_summary)
  ) {
    used.add("buying_committee")
  }
  if (
    packet.priorTouchSummaries.some((t) => combined.includes(t.toLowerCase().slice(0, 16))) ||
    packet.sequenceHistorySummaries.some((t) => combined.includes(t.toLowerCase().slice(0, 16)))
  ) {
    used.add("prior_interactions")
  }
  if (
    packet.memoryInteractionSummaries.some((m) => combined.includes(m.toLowerCase().slice(0, 16))) ||
    packet.memoryCommitmentSummaries.some((m) => combined.includes(m.toLowerCase().slice(0, 16)))
  ) {
    used.add("memory")
  }
  if (packet.priorReplySummaries.some((r) => combined.includes(r.toLowerCase().slice(0, 16)))) {
    used.add("previous_replies")
  }
  if (
    mentions(unified?.apollo_evidence_summary) ||
    (unified?.qualification_score != null && /qualif|score|verified/i.test(combined))
  ) {
    used.add("qualification_evidence")
  }

  if (input.strategy) {
    const contextUsed = computeContextUtilization({ packet, strategy: input.strategy })
    if (contextUsed.utilizationPercentage >= 40) {
      if (hasItems(packet.researchPainPoints)) used.add("pain_points")
      if (hasText(packet.websiteSummary)) used.add("lead_research")
      if (packet.memoryAvailable) used.add("memory")
    }
  }

  return [...used]
}

export function evaluateApolloResearchUtilization(input: {
  packet: OutreachContextPacket
  unifiedContext?: ApolloUnifiedPersonalizationContext | null
  subject?: string
  body: string
  strategy?: SelectedMessageStrategy
}): ApolloResearchUtilizationResult {
  const sources_available = listApolloEvidenceSourcesAvailable({
    packet: input.packet,
    unifiedContext: input.unifiedContext,
  })
  const contentUsed = inferUsedSourcesFromContent(input)
  const strategyUsed = input.strategy
    ? inferUsedSourcesFromStrategy({
        packet: input.packet,
        unifiedContext: input.unifiedContext,
        strategy: input.strategy,
      })
    : []

  const sources_used = [...new Set([...contentUsed, ...strategyUsed])].filter((key) =>
    sources_available.includes(key),
  )

  const sources_unused = sources_available.filter((key) => !sources_used.includes(key))
  const evidence_present = sources_available.length > 0

  const catalogScore =
    evidence_present ? Math.round((sources_used.length / sources_available.length) * 100) : 100
  const contextScore = input.strategy
    ? computeContextUtilization({ packet: input.packet, strategy: input.strategy }).utilizationPercentage
    : 0

  const research_utilization_score = evidence_present
    ? Math.max(catalogScore, contextScore)
    : 100

  return {
    research_utilization_score,
    sources_available,
    sources_used,
    sources_unused,
    evidence_present,
  }
}

function mapContextKeyToApolloSource(key: string): string {
  switch (key) {
    case "website_text_excerpt":
    case "website_findings":
      return "website_excerpt"
    case "research_pain_points":
      return "pain_points"
    case "company_summary":
    case "website_summary":
    case "outreach_angles":
      return "lead_research"
    case "memory":
      return "memory"
    case "prior_replies":
      return "previous_replies"
    case "prior_touches":
    case "sequence_history":
      return "prior_interactions"
    default:
      return "company_intelligence"
  }
}

export const APOLLO_EVIDENCE_SOURCE_CATALOG = APOLLO_EVIDENCE_SOURCE_KEYS
