/** Prospect Search contact intelligence bridge — deterministic, evidence-backed (Sprint 4C). Client-safe. */

import type { GrowthBuyingCommitteeRole } from "@/lib/growth/contact-discovery/contact-discovery-types"
import type { GrowthLeadDecisionMaker } from "@/lib/growth/decision-maker-types"
import { decisionMakerCandidateScore } from "@/lib/growth/decision-maker-source-weight"
import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import {
  GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER,
  type GrowthProspectSearchContactIntelligence,
  type ProspectSearchCommitteeRoleMapping,
  type ProspectSearchContactEvidence,
  type ProspectSearchContactOverlay,
  type ProspectSearchFirstContactRecommendation,
  type ProspectSearchLeadEngineContactHandoffContext,
} from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { mergeProspectSearchContactInputs } from "@/lib/growth/prospect-search/prospect-search-contact-merge"
import { computeProspectSearchContactOutreachReadiness } from "@/lib/growth/prospect-search/prospect-search-contact-readiness"

export const MAX_CONTACT_CONFIDENCE_RANK_BOOST = 0.05

export type ProspectSearchContactIntelligenceInputContact = {
  id: string
  full_name: string
  title?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  confidence: number
  role_type?: string | null
  is_primary?: boolean
  source_evidence: ProspectSearchContactEvidence[]
  source_page_url?: string | null
  last_checked_at?: string | null
  verification_status?: string | null
  discovery_sources?: string[]
  discovered_at?: string | null
  last_verified_at?: string | null
  email_status?: string | null
  phone_status?: string | null
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function hasEvidence(contact: ProspectSearchContactIntelligenceInputContact): boolean {
  return contact.source_evidence.some(
    (item) => item.claim.trim().length > 0 && item.evidence.trim().length > 0,
  )
}

function inferRoleType(title: string | null | undefined, roleType?: string | null): string {
  const explicit = trimOrNull(roleType ?? null)
  if (explicit) return explicit.replace(/_/g, " ")
  const blob = (title ?? "").toLowerCase()
  if (blob.includes("owner") || blob.includes("founder") || blob.includes("president")) return "owner"
  if (blob.includes("cfo") || blob.includes("finance") || blob.includes("procurement")) {
    return "economic buyer"
  }
  if (blob.includes("cto") || blob.includes("technical") || blob.includes("engineer")) {
    return "technical buyer"
  }
  if (blob.includes("director") || blob.includes("vp") || blob.includes("head")) return "decision maker"
  if (blob.includes("manager") || blob.includes("operations") || blob.includes("service")) return "operator"
  if (blob.includes("champion") || blob.includes("lead")) return "champion"
  return "operator"
}

function authorityScore(title: string | null | undefined): number {
  const blob = (title ?? "").toLowerCase()
  if (blob.includes("chief") || blob.includes("president") || blob.includes("owner")) return 5
  if (blob.includes("director") || blob.includes("vp") || blob.includes("head")) return 4
  if (blob.includes("manager")) return 3
  if (blob.includes("lead") || blob.includes("supervisor")) return 2
  return 1
}

function dedupeContacts(
  contacts: ProspectSearchContactIntelligenceInputContact[],
): ProspectSearchContactIntelligenceInputContact[] {
  return mergeProspectSearchContactInputs(contacts)
}

export function decisionMakerToContactInput(
  dm: GrowthLeadDecisionMaker,
): ProspectSearchContactIntelligenceInputContact | null {
  const full_name = trimOrNull(dm.fullName)
  if (!full_name || dm.status === "rejected") return null

  const evidence: ProspectSearchContactEvidence[] = []
  if (dm.evidenceExcerpt) {
    evidence.push({
      claim: "Decision maker evidence",
      evidence: dm.evidenceExcerpt,
      source: dm.source,
    })
  }
  if (dm.sourceDetail) {
    evidence.push({
      claim: "Source detail",
      evidence: dm.sourceDetail,
      source: dm.source,
    })
  }
  if (evidence.length === 0) return null

  return {
    id: dm.id,
    full_name,
    title: dm.title,
    email: dm.email,
    phone: dm.phone,
    linkedin_url: dm.linkedinUrl,
    confidence: dm.confidence ?? decisionMakerCandidateScore({ source: dm.source, confidence: dm.confidence }) / 100,
    is_primary: dm.isPrimary,
    source_evidence: evidence,
  }
}

export function leadEngineContactResearchToInputs(
  output: GrowthLeadEngineContactResearchOutput,
): ProspectSearchContactIntelligenceInputContact[] {
  const contacts: ProspectSearchContactIntelligenceInputContact[] = []
  for (const [index, candidate] of output.contact_candidates.entries()) {
    const full_name = trimOrNull(candidate.full_name)
    if (!full_name) continue
    const source_evidence = candidate.source_evidence
      .map((item) => ({
        claim: trimOrNull(item.claim) ?? "",
        evidence: trimOrNull(item.evidence) ?? "",
        source: trimOrNull(item.source) ?? "lead_engine_contact_research",
      }))
      .filter((item) => item.claim && item.evidence)
    if (source_evidence.length === 0) continue

    contacts.push({
      id: `lead-engine-contact-${index}-${normalizeName(full_name)}`,
      full_name,
      title: trimOrNull(candidate.job_title),
      email: trimOrNull(candidate.email),
      phone: trimOrNull(candidate.phone),
      linkedin_url: trimOrNull(candidate.linkedin_url),
      confidence: candidate.confidence,
      role_type: trimOrNull(candidate.role_match_type),
      source_evidence,
    })
  }
  return contacts
}

export function contactDiscoveryCandidateToInput(
  contact: {
    id: string
    full_name: string
    job_title: string | null
    email: string | null
    phone: string | null
    linkedin_url: string | null
    confidence: number
    evidence: ProspectSearchContactEvidence[]
    provider_type?: string
    provider_name?: string
    verification_state?: string
    updated_at?: string | null
    metadata?: Record<string, unknown>
  },
  committeeRole?: GrowthBuyingCommitteeRole | null,
): ProspectSearchContactIntelligenceInputContact | null {
  const full_name = trimOrNull(contact.full_name)
  if (!full_name) return null
  const source_evidence = contact.evidence
    .map((item) => ({
      claim: trimOrNull(item.claim) ?? "",
      evidence: trimOrNull(item.evidence) ?? "",
      source: trimOrNull(item.source) ?? "contact_discovery",
    }))
    .filter((item) => item.claim && item.evidence)
  if (source_evidence.length === 0) return null

  return {
    id: contact.id,
    full_name,
    title: contact.job_title,
    email: contact.email,
    phone: contact.phone,
    linkedin_url: contact.linkedin_url,
    confidence: contact.confidence,
    role_type: committeeRole ?? null,
    source_evidence,
    source_page_url:
      typeof contact.metadata?.source_page_url === "string" ? contact.metadata.source_page_url : null,
    last_checked_at: contact.updated_at ?? null,
    verification_status: contact.verification_state,
    discovery_sources: [contact.provider_type, contact.provider_name],
  }
}

function toOverlay(
  contact: ProspectSearchContactIntelligenceInputContact,
  recommended_priority: number,
  companySuppressed: boolean,
): ProspectSearchContactOverlay {
  const role_type = inferRoleType(contact.title, contact.role_type)
  const readiness = computeProspectSearchContactOutreachReadiness({
    email: contact.email,
    phone: contact.phone,
    verification_status: contact.verification_status,
    confidence: contact.confidence,
    suppressed: companySuppressed,
  })
  const source_label =
    contact.source_evidence[0]?.source?.replace(/_/g, " ") ??
    contact.discovery_sources?.[0]?.replace(/_/g, " ") ??
    null
  const overlay: ProspectSearchContactOverlay = {
    id: contact.id,
    name: contact.full_name,
    title: contact.title ?? null,
    confidence: Number(Math.min(1, Math.max(0, contact.confidence)).toFixed(3)),
    source_evidence: contact.source_evidence,
    role_type,
    recommended_priority,
    source_page_url: contact.source_page_url ?? contact.source_evidence[0]?.page_url ?? null,
    last_checked_at: contact.last_checked_at ?? null,
    verification_status: contact.verification_status ?? null,
    outreach_ready: readiness.outreach_ready,
    source_label,
  }
  if (contact.linkedin_url) overlay.linkedin_url = contact.linkedin_url
  if (contact.phone) overlay.phone = contact.phone
  if (contact.email) overlay.email = contact.email
  if (contact.discovered_at) overlay.discovered_at = contact.discovered_at
  if (contact.last_verified_at) overlay.last_verified_at = contact.last_verified_at
  if (contact.last_checked_at) overlay.source_last_seen_at = contact.last_checked_at
  return overlay
}

function buildCommitteeRolesFromHypothesis(
  hypothesis: GrowthLeadEngineDecisionMakerHypothesisOutput | null | undefined,
  overlays: ProspectSearchContactOverlay[],
): ProspectSearchCommitteeRoleMapping[] {
  const roles: ProspectSearchCommitteeRoleMapping[] = []
  let order = 1

  const namedByRole = new Map<string, ProspectSearchContactOverlay>()
  for (const contact of overlays) {
    const key = contact.role_type.toLowerCase()
    if (!namedByRole.has(key)) namedByRole.set(key, contact)
  }

  const addHypothesisRole = (role: string, confidence: number, role_type: string) => {
    const normalizedRoleType = role_type.toLowerCase()
    const named = [...namedByRole.values()].find(
      (contact) =>
        contact.role_type.toLowerCase() === normalizedRoleType ||
        (contact.title ?? "").toLowerCase().includes(role.toLowerCase()),
    )
    roles.push({
      role,
      role_type: role_type.replace(/_/g, " "),
      confidence: Number(Math.min(1, Math.max(0, confidence)).toFixed(3)),
      recommended_order: order++,
      has_named_contact: Boolean(named),
      contact_name: named?.name ?? null,
    })
  }

  if (hypothesis) {
    for (const target of hypothesis.buying_committee.primary_targets) {
      addHypothesisRole(target.role, target.confidence, inferRoleType(target.role))
    }
    for (const target of hypothesis.buying_committee.secondary_targets) {
      addHypothesisRole(target.role, target.confidence, inferRoleType(target.role))
    }
    for (const role of hypothesis.engagement_priority) {
      if (roles.some((entry) => entry.role.toLowerCase() === role.toLowerCase())) continue
      addHypothesisRole(role, hypothesis.confidence_assessment.score / 100, inferRoleType(role))
    }
  }

  for (const contact of overlays) {
    if (roles.some((entry) => entry.contact_name === contact.name)) continue
    roles.push({
      role: contact.title ?? contact.role_type,
      role_type: contact.role_type,
      confidence: contact.confidence,
      recommended_order: order++,
      has_named_contact: true,
      contact_name: contact.name,
    })
  }

  return roles
}

export function recommendFirstContact(
  overlays: ProspectSearchContactOverlay[],
): ProspectSearchFirstContactRecommendation | null {
  if (overlays.length === 0) return null

  const ranked = [...overlays].sort((a, b) => {
    const scoreA = a.confidence + authorityScore(a.title) * 0.05 + a.source_evidence.length * 0.02
    const scoreB = b.confidence + authorityScore(b.title) * 0.05 + b.source_evidence.length * 0.02
    return scoreB - scoreA
  })

  const top = ranked[0]!
  const reasons: string[] = []
  if (top.confidence >= 0.8) reasons.push("Highest evidence")
  else reasons.push("Strongest available evidence")
  if (authorityScore(top.title) >= 4) reasons.push("Most authority")
  if (top.title) reasons.push("Strong title alignment")
  if (top.source_evidence.length > 1) reasons.push("Multiple corroborating sources")

  return {
    contact_id: top.id,
    role: top.title ?? top.role_type,
    name: top.name,
    confidence: top.confidence,
    reasons: [...new Set(reasons)].slice(0, 4),
  }
}

export function buildContactConfidenceExplanation(input: {
  first_contact: ProspectSearchFirstContactRecommendation | null
  contacts: ProspectSearchContactOverlay[]
}): GrowthProspectSearchContactIntelligence["confidence_explanation"] {
  if (!input.first_contact) return null
  const contact =
    input.contacts.find((row) => row.id === input.first_contact!.contact_id) ?? input.contacts[0]
  if (!contact) return null

  const evidence = contact.source_evidence.map((item) => item.evidence).slice(0, 6)
  const reasoning = [
    `${contact.source_evidence.length} evidence source(s) support this contact.`,
    contact.title ? `Title observed: ${contact.title}.` : "Role inferred from available evidence.",
  ]

  return {
    confidence: input.first_contact.confidence,
    evidence,
    reasoning,
  }
}

export function buildProspectSearchContactIntelligence(input: {
  contacts: ProspectSearchContactIntelligenceInputContact[]
  decision_maker_hypothesis?: GrowthLeadEngineDecisionMakerHypothesisOutput | null
  committee_completeness?: number | null
  schema_ready?: boolean
  source_labels?: string[]
  empty_reason?: string | null
  contact_coverage_score?: number | null
  contact_coverage_label?: string | null
  contact_confidence_score?: number | null
  primary_contact_id?: string | null
  recommended_contact_id?: string | null
  schema_health?: import("@/lib/growth/schema-health/growth-schema-health-types").GrowthSchemaHealthSummary | null
  company_suppressed?: boolean
}): GrowthProspectSearchContactIntelligence {
  const schema_ready = input.schema_ready ?? true
  const evidenceBacked = dedupeContacts(input.contacts.filter(hasEvidence))
  const overlays = evidenceBacked
    .sort((a, b) => {
      const scoreA = a.confidence + authorityScore(a.title) * 0.04 + (a.is_primary ? 0.15 : 0)
      const scoreB = b.confidence + authorityScore(b.title) * 0.04 + (b.is_primary ? 0.15 : 0)
      return scoreB - scoreA
    })
    .map((contact, index) => toOverlay(contact, index + 1, input.company_suppressed === true))

  const committee_roles = buildCommitteeRolesFromHypothesis(input.decision_maker_hypothesis, overlays)
  const first_contact = recommendFirstContact(overlays)
  const confidence_explanation = buildContactConfidenceExplanation({
    first_contact,
    contacts: overlays,
  })

  const committeeFromHypothesis = input.decision_maker_hypothesis?.committee_completeness
  const committee_completeness_pct =
    input.committee_completeness != null
      ? Math.round(input.committee_completeness * 100)
      : committeeFromHypothesis
        ? Math.round(
            (Math.max(
              0,
              committeeFromHypothesis.recommended_contacts -
                committeeFromHypothesis.critical_missing_roles.length,
            ) /
              Math.max(1, committeeFromHypothesis.recommended_contacts)) *
              100,
          )
        : overlays.length > 0
          ? Math.min(100, Math.round((overlays.length / 5) * 100))
          : null

  const outreach_recommendation = first_contact
    ? `Recommended first contact: ${first_contact.role}${first_contact.name ? ` (${first_contact.name})` : ""} — ${Math.round(first_contact.confidence * 100)}% confidence. ${first_contact.reasons.join(" · ")}.`
    : committee_roles[0]
      ? `No named contacts yet — prioritize role hypothesis: ${committee_roles[0].role}.`
      : null

  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER,
    schema_ready,
    has_contacts: overlays.length > 0,
    contacts: overlays,
    committee_roles,
    committee_completeness_pct,
    first_contact,
    confidence_explanation,
    outreach_recommendation,
    source_labels: input.source_labels ?? [],
    empty_reason:
      overlays.length === 0
        ? input.empty_reason ?? "No evidence-backed contacts available for this company."
        : null,
    contact_coverage_score: input.contact_coverage_score ?? null,
    contact_coverage_label: input.contact_coverage_label ?? null,
    contact_confidence_score: input.contact_confidence_score ?? null,
    primary_contact_id: input.primary_contact_id ?? null,
    recommended_contact_id: input.recommended_contact_id ?? null,
    schema_health: input.schema_health ?? null,
  }
}

export function emptyProspectSearchContactIntelligence(
  reason: string,
  options?: {
    schema_ready?: boolean
    source_labels?: string[]
    schema_health?: import("@/lib/growth/schema-health/growth-schema-health-types").GrowthSchemaHealthSummary | null
  },
): GrowthProspectSearchContactIntelligence {
  return buildProspectSearchContactIntelligence({
    contacts: [],
    schema_ready: options?.schema_ready ?? true,
    source_labels: options?.source_labels ?? [],
    empty_reason: reason,
    schema_health: options?.schema_health ?? null,
  })
}

export function computeContactConfidenceRankBoost(
  intelligence: GrowthProspectSearchContactIntelligence | null | undefined,
): number {
  if (!intelligence?.has_contacts || !intelligence.first_contact) return 0
  const confidence = intelligence.first_contact.confidence
  if (confidence >= 0.85) return MAX_CONTACT_CONFIDENCE_RANK_BOOST
  if (confidence >= 0.7) return 0.03
  if (confidence >= 0.5) return 0.015
  return 0
}

export function computeContactCoverageRankBoost(decision_maker_count: number): number {
  if (decision_maker_count >= 3) return MAX_CONTACT_CONFIDENCE_RANK_BOOST
  if (decision_maker_count >= 1) return 0.025
  return 0
}

export function buildLeadEngineContactHandoffContext(
  intelligence: GrowthProspectSearchContactIntelligence | null | undefined,
  company?: Pick<GrowthProspectSearchCompanyResult, "is_suppressed" | "source_type"> | null,
): ProspectSearchLeadEngineContactHandoffContext | null {
  if (!intelligence && !company) return null

  const contacts = intelligence?.contacts ?? []
  const emailAvailable = contacts.some((contact) => contact.email?.trim())
  const phoneAvailable = contacts.some((contact) => contact.phone?.trim())
  const contactCount = contacts.length
  const suppressed = company?.is_suppressed === true
  const outreachReady = !suppressed && contactCount > 0 && (emailAvailable || phoneAvailable)
  const firstContact = intelligence?.first_contact
  const staleCount = contacts.filter(
    (c) => c.freshness_status === "stale" || c.freshness_status === "expired",
  ).length
  const freshnessNote =
    staleCount > 0
      ? `${staleCount} contact${staleCount === 1 ? "" : "s"} stale or expired — refresh before outreach`
      : null

  return {
    first_contact_role: intelligence?.first_contact?.role ?? null,
    first_contact_name: intelligence?.first_contact?.name ?? null,
    first_contact_confidence: intelligence?.first_contact?.confidence ?? null,
    committee_completeness_pct: intelligence?.committee_completeness_pct ?? null,
    contact_count: contactCount,
    summary: [intelligence?.outreach_recommendation ?? null, freshnessNote]
      .filter(Boolean)
      .join(" · ") || null,
    email_available: emailAvailable,
    phone_available: phoneAvailable,
    contact_sources: intelligence?.source_labels ?? [],
    compliance_status: suppressed ? "suppressed" : outreachReady ? "ready" : "review_required",
    outreach_ready: outreachReady,
    contact_research_required_message:
      outreachReady || suppressed
        ? freshnessNote
        : company?.source_type === "external_discovered"
          ? "Contact research required before outreach."
          : "No verified contacts yet — run contact research before outreach.",
    freshness_status:
      contacts.find((c) => c.id === firstContact?.contact_id)?.freshness_status ?? null,
    confidence_reason: firstContact
      ? `${Math.round(firstContact.confidence * 100)}% confidence from evidence-backed sources`
      : null,
  }
}

