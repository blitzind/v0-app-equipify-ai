/** Apollo unified personalization context — single packet for all Apollo channels. */

import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"

export const APOLLO_UNIFIED_PERSONALIZATION_CONTEXT_QA_MARKER =
  "apollo-unified-personalization-context-v1" as const

export type ApolloUnifiedPersonalizationContext = {
  qa_marker: typeof APOLLO_UNIFIED_PERSONALIZATION_CONTEXT_QA_MARKER
  /** Core outreach personalization packet (research, memory, interactions, committee). */
  outreach_packet: OutreachContextPacket
  /** Apollo pipeline evidence summaries — verified acquisition context only. */
  apollo_evidence_summary: string | null
  apollo_source_label: string | null
  qualification_source: string | null
  enrollment_source: string | null
  account_playbook_source: string | null
  account_playbook_summary: string | null
  buying_committee_summary: string | null
  company_intelligence_summary: string | null
  /** Contact-facing labels from Apollo handoff (not hallucinated). */
  contact_full_name: string
  contact_title: string | null
  contact_company_name: string
  qualification_score: number | null
  attribution_chain: string[]
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function truncate(value: string | null | undefined, max = 200): string | null {
  const trimmed = asString(value)
  if (!trimmed) return null
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

export function buildApolloUnifiedPersonalizationContextFromPacket(input: {
  packet: OutreachContextPacket
  contact_full_name?: string | null
  contact_title?: string | null
  contact_company_name?: string | null
  qualification_score?: number | null
  apollo_evidence_summary?: string | null
  apollo_source_label?: string | null
  qualification_source?: string | null
  enrollment_source?: string | null
  account_playbook_source?: string | null
  account_playbook_summary?: string | null
  buying_committee_summary?: string | null
  attribution_chain?: string[]
}): ApolloUnifiedPersonalizationContext {
  const packet = input.packet
  const committeeFromMemory = packet.memoryCommitteeSummaries.slice(0, 2).join("; ")
  const buyingCommittee =
    truncate(input.buying_committee_summary) ??
    truncate(committeeFromMemory) ??
    (packet.hasDecisionMaker ? "Decision maker identified in lead research." : null)

  const companyIntel = [
    packet.companySummary,
    packet.websiteSummary,
    packet.industryLabel ? `Industry: ${packet.industryLabel}` : null,
    packet.employeeSize ? `Size: ${packet.employeeSize}` : null,
  ]
    .filter(Boolean)
    .join(" — ")

  return {
    qa_marker: APOLLO_UNIFIED_PERSONALIZATION_CONTEXT_QA_MARKER,
    outreach_packet: packet,
    apollo_evidence_summary: truncate(input.apollo_evidence_summary),
    apollo_source_label: truncate(input.apollo_source_label, 120),
    qualification_source: truncate(input.qualification_source, 120),
    enrollment_source: truncate(input.enrollment_source, 120),
    account_playbook_source: truncate(input.account_playbook_source, 120),
    account_playbook_summary: truncate(input.account_playbook_summary),
    buying_committee_summary: buyingCommittee,
    company_intelligence_summary: truncate(companyIntel) ?? truncate(packet.companyName),
    contact_full_name: asString(input.contact_full_name) || "there",
    contact_title: truncate(input.contact_title, 120),
    contact_company_name: asString(input.contact_company_name) || packet.companyName,
    qualification_score: input.qualification_score ?? packet.fitScore,
    attribution_chain: input.attribution_chain ?? [],
  }
}

/** Evidence-backed business problem statement — no invented facts. */
export function resolveApolloUnifiedBusinessProblem(
  context: ApolloUnifiedPersonalizationContext,
): string | null {
  const packet = context.outreach_packet
  const pain = packet.researchPainPoints[0]?.trim()
  if (pain) return truncate(pain, 160)
  const angle = packet.outreachAngles[0]?.trim()
  if (angle) return truncate(angle, 160)
  const equipment = packet.equipmentServiceIndicators[0]?.trim()
  if (equipment) return truncate(equipment, 160)
  return null
}

/** Evidence-backed company insight for voice/call content. */
export function resolveApolloUnifiedCompanyInsight(
  context: ApolloUnifiedPersonalizationContext,
): string | null {
  if (context.company_intelligence_summary) return context.company_intelligence_summary
  const finding = context.outreach_packet.websiteFindings[0]?.trim()
  return finding ? truncate(finding, 160) : null
}

/** Evidence-backed role insight. */
export function resolveApolloUnifiedRoleInsight(
  context: ApolloUnifiedPersonalizationContext,
): string | null {
  const title = context.contact_title ?? context.outreach_packet.decisionMakerTitle
  if (!title) return null
  return `Role focus: ${title}`
}

/** Evidence-backed research insight. */
export function resolveApolloUnifiedResearchInsight(
  context: ApolloUnifiedPersonalizationContext,
): string | null {
  const packet = context.outreach_packet
  const research =
    packet.researchRecommendedNextAction?.trim() ||
    packet.websiteSummary?.trim() ||
    context.apollo_evidence_summary?.trim()
  return research ? truncate(research, 160) : null
}
