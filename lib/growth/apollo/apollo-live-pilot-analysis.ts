/** Apollo AI-2 live pilot analysis — quality, cost, limits, go/no-go. Client-safe. */

import { evaluateApolloImportReadiness } from "@/lib/growth/apollo/apollo-import-readiness"
import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import { APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"

export const APOLLO_LIVE_PILOT_ANALYSIS_QA_MARKER = "apollo-live-pilot-analysis-ai-2-v1" as const

export type ApolloLivePilotCostPerCompany = {
  credits: number
  api_calls: number
  contacts_mapped: number
  contactable_contacts: number
  sequence_ready_contacts: number
}

export type ApolloLivePilotCostProjection = {
  companies: number
  estimated_credits: number
  estimated_api_calls: number
  estimated_contacts_mapped: number
  estimated_contactable: number
  estimated_sequence_ready: number
}

export type ApolloLivePilotOperatingLimits = {
  companies_per_run: number
  contacts_per_company: number
  safe_pilot_volume_per_day: number
  recommended_rollout_volume_per_day: number
  max_bulk_enrollment: number
  rationale: string[]
}

export type ApolloLivePilotGoNoGoVerdict = "go" | "conditional_go" | "no_go"

export type ApolloLivePilotGoNoGoAssessment = {
  verdict: ApolloLivePilotGoNoGoVerdict
  ready_for_controlled_production: boolean
  ready_for_bulk_enrollment: boolean
  blockers: string[]
  justification: string
}

export type ApolloLivePilotAnalysis = {
  qa_marker: typeof APOLLO_LIVE_PILOT_ANALYSIS_QA_MARKER
  evidence_marker: typeof APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER
  pilot_mode: "mock" | "live"
  canonical_matching: {
    company: ApolloLivePilotEvidence["canonical_matching"]["company"]
    person: ApolloLivePilotEvidence["canonical_matching"]["person"]
    duplicate_risk: "low" | "medium" | "high"
    duplicate_risk_notes: string[]
  }
  contact_quality: {
    decision_maker_rate: number
    email_rate: number
    verified_email_rate: number
    phone_rate: number
    buying_committee_rate: number
    findings: string[]
  }
  readiness_funnel: ApolloLivePilotEvidence["readiness_funnel"] & {
    fallout: {
      imported_to_research_complete: number
      research_complete_to_score: number
      score_to_contactable: number
      contactable_to_sequence_ready: number
    }
  }
  research_pipeline: ApolloLivePilotEvidence["research_pipeline"] & {
    all_automated: boolean
    missing_signals: string[]
  }
  cost_per_company: ApolloLivePilotCostPerCompany
  cost_projections: ApolloLivePilotCostProjection[]
  operating_limits: ApolloLivePilotOperatingLimits
  go_no_go: ApolloLivePilotGoNoGoAssessment
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

function assessDuplicateRisk(
  evidence: ApolloLivePilotEvidence,
): ApolloLivePilotAnalysis["canonical_matching"]["duplicate_risk"] {
  const { person, company } = evidence.canonical_matching
  const dedupedTotal = person.deduped + company.deduped
  const mapped = evidence.discovery.contacts_mapped
  if (mapped === 0) return "high"
  if (dedupedTotal / mapped > 0.5) return "medium"
  if (person.rejected + company.rejected > mapped) return "medium"
  return "low"
}

export function computeApolloLivePilotCostPerCompany(
  evidence: ApolloLivePilotEvidence,
): ApolloLivePilotCostPerCompany {
  const mapped = Math.max(evidence.discovery.contacts_mapped, 1)
  const contactable = evidence.readiness_funnel.contactable
  const sequenceReady = evidence.readiness_funnel.sequence_ready
  return {
    credits: evidence.runtime.credits_consumed,
    api_calls: evidence.runtime.api_calls,
    contacts_mapped: evidence.discovery.contacts_mapped,
    contactable_contacts: contactable,
    sequence_ready_contacts: sequenceReady,
  }
}

export function projectApolloLivePilotCostScaling(
  evidence: ApolloLivePilotEvidence,
  companyCounts: number[] = [100, 500, 1000],
): ApolloLivePilotCostProjection[] {
  const perCompany = computeApolloLivePilotCostPerCompany(evidence)
  const mappedRate =
    evidence.discovery.contacts_mapped / Math.max(evidence.discovery.raw_contacts_returned, 1)
  const contactableRate = perCompany.contactable_contacts / Math.max(perCompany.contacts_mapped, 1)
  const sequenceRate = perCompany.sequence_ready_contacts / Math.max(perCompany.contacts_mapped, 1)

  return companyCounts.map((companies) => ({
    companies,
    estimated_credits: Math.round(perCompany.credits * companies),
    estimated_api_calls: Math.round(perCompany.api_calls * companies),
    estimated_contacts_mapped: Math.round(
      perCompany.contacts_mapped > 0
        ? perCompany.contacts_mapped * companies
        : Math.ceil(mappedRate * 20 * companies),
    ),
    estimated_contactable: Math.round(
      perCompany.contacts_mapped > 0
        ? perCompany.contactable_contacts * companies
        : Math.ceil(mappedRate * 20 * contactableRate * companies),
    ),
    estimated_sequence_ready: Math.round(
      perCompany.contacts_mapped > 0
        ? perCompany.sequence_ready_contacts * companies
        : Math.ceil(mappedRate * 20 * sequenceRate * companies),
    ),
  }))
}

export function deriveApolloLivePilotOperatingLimits(
  evidence: ApolloLivePilotEvidence,
): ApolloLivePilotOperatingLimits {
  const perCompany = computeApolloLivePilotCostPerCompany(evidence)
  const rationale: string[] = []

  const contactsPerCompany = Math.min(Math.max(perCompany.contacts_mapped, 5), 25)
  rationale.push(`Pilot returned ${perCompany.contacts_mapped} mapped contacts — cap per company at ${contactsPerCompany}.`)

  const companiesPerRun = evidence.runtime.api_calls <= 1 ? 10 : 54
  rationale.push(
    perCompany.sequence_ready_contacts >= 1
      ? "At least one sequence-ready contact in pilot — allow 10 companies/run for next pilot wave."
      : "No sequence-ready contacts in pilot — limit to 1 company/run until research funnel improves.",
  )

  const safePilot = perCompany.sequence_ready_contacts >= 1 ? 10 : 1
  const rollout = perCompany.sequence_ready_contacts >= 1 ? 25 : 5

  rationale.push("Bulk automated enrollment remains disabled — manual approval per sequence job.")
  rationale.push("Voice Drop × Apollo requires VD-4 live certification before multichannel outreach.")

  return {
    companies_per_run: companiesPerRun,
    contacts_per_company: contactsPerCompany,
    safe_pilot_volume_per_day: safePilot,
    recommended_rollout_volume_per_day: rollout,
    max_bulk_enrollment: 0,
    rationale,
  }
}

export function assessApolloLivePilotGoNoGo(evidence: ApolloLivePilotEvidence): ApolloLivePilotGoNoGoAssessment {
  const blockers: string[] = []
  const mapped = evidence.discovery.contacts_mapped
  const linked =
    evidence.canonical_matching.person.matched +
    evidence.canonical_matching.person.created
  const errors = evidence.runtime.errors

  if (evidence.mock) {
    blockers.push("Pilot ran in mock mode — live API evidence required for production go.")
  }
  if (!evidence.mock && evidence.runtime.api_calls < 1) {
    blockers.push("Live pilot recorded zero API calls.")
  }
  if (mapped < 1) {
    blockers.push("No contacts mapped from Apollo search.")
  }
  if (linked < 1) {
    blockers.push("No canonical person match or create recorded.")
  }
  if (!evidence.company.canonical_company_id) {
    blockers.push("Canonical company not linked.")
  }
  if (errors.length > 0) {
    blockers.push(`Runtime errors: ${errors.join("; ")}`)
  }
  if (evidence.readiness_funnel.sequence_ready < 1) {
    blockers.push("No sequence-ready contacts in pilot funnel.")
  }
  if (!evidence.research_pipeline.automated_flow_confirmed) {
    blockers.push("Research pipeline automation not confirmed end-to-end.")
  }

  const ready_for_controlled_production =
    !evidence.mock &&
    mapped >= 1 &&
    linked >= 1 &&
    Boolean(evidence.company.canonical_company_id) &&
    errors.length === 0 &&
    evidence.research_pipeline.automated_flow_confirmed

  const ready_for_bulk_enrollment = false

  let verdict: ApolloLivePilotGoNoGoVerdict = "no_go"
  if (ready_for_controlled_production && evidence.readiness_funnel.sequence_ready >= 1) {
    verdict = "go"
  } else if (ready_for_controlled_production || (mapped >= 1 && linked >= 1 && !evidence.mock)) {
    verdict = "conditional_go"
  }

  const justification =
    verdict === "go"
      ? "Live pilot verified canonical matching, research automation, and at least one sequence-ready contact."
      : verdict === "conditional_go"
        ? "Partial live validation — address blockers before expanding beyond single-company pilots."
        : "Pilot evidence insufficient for controlled production usage."

  return {
    verdict,
    ready_for_controlled_production,
    ready_for_bulk_enrollment,
    blockers,
    justification,
  }
}

export function analyzeApolloLivePilotEvidence(evidence: ApolloLivePilotEvidence): ApolloLivePilotAnalysis {
  const mapped = evidence.discovery.contacts_mapped
  const funnel = evidence.readiness_funnel

  const duplicateRiskNotes: string[] = []
  if (evidence.canonical_matching.person.deduped > 0) {
    duplicateRiskNotes.push(`${evidence.canonical_matching.person.deduped} person row(s) deduped at sync.`)
  }
  if (evidence.canonical_matching.company.deduped > 0) {
    duplicateRiskNotes.push(`${evidence.canonical_matching.company.deduped} company linkage dedupe event(s).`)
  }
  if (evidence.discovery.contacts_skipped > 0) {
    duplicateRiskNotes.push(`${evidence.discovery.contacts_skipped} contact(s) skipped at mapper (identity/title filters).`)
  }

  const qualityFindings: string[] = []
  if (evidence.contact_quality.irrelevant_title_skipped > 0) {
    qualityFindings.push(
      `${evidence.contact_quality.irrelevant_title_skipped} irrelevant title(s) filtered before import.`,
    )
  }
  if (evidence.contact_quality.average_decision_maker_score != null) {
    qualityFindings.push(
      `Average decision-maker score ${evidence.contact_quality.average_decision_maker_score}.`,
    )
  }
  if (evidence.contact_quality.with_verified_email === 0 && evidence.contact_quality.with_email > 0) {
    qualityFindings.push("Emails present but none verified — enrichment may be required for email outreach.")
  }

  const missingSignals: string[] = []
  const rp = evidence.research_pipeline
  if (!rp.company_intelligence_present) missingSignals.push("company_intelligence")
  if (!rp.buying_committee_present) missingSignals.push("buying_committee")
  if (!rp.fit_score_present) missingSignals.push("fit_score")
  if (!rp.relationship_intelligence_present) missingSignals.push("relationship_intelligence")
  if (!rp.next_best_action_present) missingSignals.push("next_best_action")

  const perContactReadiness = evaluateApolloImportReadiness({
    discovery_contacts: mapped,
    company_contacts_synced: evidence.discovery.company_contacts_synced,
    canonical_persons_linked:
      evidence.canonical_matching.person.matched + evidence.canonical_matching.person.created,
    research_summary_present: rp.company_intelligence_present,
    lead_score: rp.fit_score_present ? 70 : null,
    email_eligible: evidence.contact_quality.with_email > 0,
    phone_eligible: evidence.contact_quality.with_phone > 0,
    sequence_readiness_state:
      funnel.sequence_ready > 0 ? "ready" : funnel.contactable > 0 ? "insufficient_coverage" : null,
    apollo_source_metadata_present: true,
  })

  if (perContactReadiness.overall_state === "sequence_ready") {
    qualityFindings.push("Readiness evaluator confirms sequence_ready state for pilot cohort.")
  }

  return {
    qa_marker: APOLLO_LIVE_PILOT_ANALYSIS_QA_MARKER,
    evidence_marker: APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER,
    pilot_mode: evidence.mock ? "mock" : "live",
    canonical_matching: {
      company: evidence.canonical_matching.company,
      person: evidence.canonical_matching.person,
      duplicate_risk: assessDuplicateRisk(evidence),
      duplicate_risk_notes: duplicateRiskNotes,
    },
    contact_quality: {
      decision_maker_rate: safeRate(evidence.contact_quality.decision_maker_count, mapped),
      email_rate: safeRate(evidence.contact_quality.with_email, mapped),
      verified_email_rate: safeRate(evidence.contact_quality.with_verified_email, mapped),
      phone_rate: safeRate(evidence.contact_quality.with_phone, mapped),
      buying_committee_rate: safeRate(evidence.contact_quality.buying_committee_relevant, mapped),
      findings: qualityFindings,
    },
    readiness_funnel: {
      ...funnel,
      fallout: {
        imported_to_research_complete: funnel.imported - funnel.research_complete,
        research_complete_to_score: funnel.research_complete - funnel.score_available,
        score_to_contactable: funnel.score_available - funnel.contactable,
        contactable_to_sequence_ready: funnel.contactable - funnel.sequence_ready,
      },
    },
    research_pipeline: {
      ...rp,
      all_automated: rp.automated_flow_confirmed && missingSignals.length === 0,
      missing_signals: missingSignals,
    },
    cost_per_company: computeApolloLivePilotCostPerCompany(evidence),
    cost_projections: projectApolloLivePilotCostScaling(evidence),
    operating_limits: deriveApolloLivePilotOperatingLimits(evidence),
    go_no_go: assessApolloLivePilotGoNoGo(evidence),
  }
}
