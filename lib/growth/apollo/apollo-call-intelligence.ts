/** Apollo call intelligence — evidence-backed talking points from unified context. */

import type { ApolloUnifiedPersonalizationContext } from "@/lib/growth/apollo/apollo-unified-personalization-context"
import {
  resolveApolloUnifiedBusinessProblem,
  resolveApolloUnifiedCompanyInsight,
  resolveApolloUnifiedResearchInsight,
  resolveApolloUnifiedRoleInsight,
} from "@/lib/growth/apollo/apollo-unified-personalization-context"

export const APOLLO_CALL_INTELLIGENCE_QA_MARKER = "apollo-call-intelligence-v1" as const

export type ApolloCallIntelligence = {
  qa_marker: typeof APOLLO_CALL_INTELLIGENCE_QA_MARKER
  opening_angle: string
  likely_pain_points: string[]
  discovery_questions: string[]
  objection_handling: string[]
  cta: string
  evidence_sources: string[]
}

function uniqueNonEmpty(values: string[], limit = 4): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
    if (result.length >= limit) break
  }
  return result
}

export function buildApolloCallIntelligence(
  context: ApolloUnifiedPersonalizationContext,
): ApolloCallIntelligence {
  const packet = context.outreach_packet
  const company = context.contact_company_name
  const name = context.contact_full_name.split(/\s+/)[0] || "there"
  const roleInsight = resolveApolloUnifiedRoleInsight(context)
  const companyInsight = resolveApolloUnifiedCompanyInsight(context)
  const researchInsight = resolveApolloUnifiedResearchInsight(context)
  const businessProblem = resolveApolloUnifiedBusinessProblem(context)

  const openingParts = [
    roleInsight ? `Connect with ${name} as ${context.contact_title ?? "the contact"}.` : `Open with ${name} at ${company}.`,
    companyInsight ? `Reference: ${companyInsight}` : null,
    researchInsight ? `Research note: ${researchInsight}` : null,
  ].filter(Boolean)

  const painPoints = uniqueNonEmpty([
    ...packet.researchPainPoints,
    ...packet.equipmentServiceIndicators,
    businessProblem ?? "",
    packet.competitorPressure ? `Competitive pressure: ${packet.competitorPressure}` : "",
  ])

  const discoveryQuestions = uniqueNonEmpty([
    businessProblem ? `How are you handling ${businessProblem.slice(0, 80)} today?` : "",
    packet.capacitySignals[0]
      ? `What impact does ${packet.capacitySignals[0]} have on your service team?`
      : "",
    context.buying_committee_summary
      ? "Who else should be involved in evaluating equipment service workflow changes?"
      : "Who owns equipment lifecycle decisions on your team?",
    packet.hasWebsiteResearch
      ? "What prompted you to explore improvements in equipment operations recently?"
      : "What would make a workflow review worthwhile for your team?",
  ])

  const objectionHandling = uniqueNonEmpty([
    ...packet.objectionSummaries.map((entry) => `Prior objection: ${entry}`),
    ...packet.memoryAvoidRepeating.map((entry) => `Avoid repeating: ${entry}`),
    packet.memoryUnresolvedObjectionCount > 0
      ? "Acknowledge unresolved objections before pushing for next step."
      : "",
    "If timing is the concern, offer a brief async summary instead of a long call.",
  ])

  const cta =
    packet.researchRecommendedNextAction?.trim() ||
    `Suggest a 10-minute discovery call to explore fit for ${company}.`

  const evidence_sources = uniqueNonEmpty([
    packet.hasWebsiteResearch ? "lead_research" : "",
    packet.memoryAvailable ? "relationship_memory" : "",
    context.account_playbook_summary ? "account_playbook" : "",
    context.apollo_evidence_summary ? "apollo_evidence" : "",
    packet.priorTouchCount > 0 ? "prior_interactions" : "",
    context.buying_committee_summary ? "buying_committee" : "",
  ], 6)

  return {
    qa_marker: APOLLO_CALL_INTELLIGENCE_QA_MARKER,
    opening_angle: openingParts.join(" ") || `Introduce Equipify relevance for ${company}.`,
    likely_pain_points: painPoints.length
      ? painPoints
      : ["Equipment service coordination and uptime visibility (generic — limited research)."],
    discovery_questions: discoveryQuestions.length
      ? discoveryQuestions
      : ["What equipment service challenges are top of mind this quarter?"],
    objection_handling: objectionHandling.length
      ? objectionHandling
      : ["Listen first; confirm whether outreach timing is appropriate."],
    cta,
    evidence_sources,
  }
}

export function formatApolloCallIntelligenceBody(intelligence: ApolloCallIntelligence): string {
  return [
    `Opening: ${intelligence.opening_angle}`,
    `Pain points: ${intelligence.likely_pain_points.join("; ")}`,
    `Discovery: ${intelligence.discovery_questions.join(" | ")}`,
    `Objections: ${intelligence.objection_handling.join("; ")}`,
    `CTA: ${intelligence.cta}`,
  ].join("\n")
}
