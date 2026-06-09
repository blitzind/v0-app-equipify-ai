/** Apollo AI-5 production activation & first outreach certification — evidence only, no API calls. */

import { unwrapApolloLivePilotEvidenceBundle } from "@/lib/growth/apollo/apollo-live-pilot-evidence-bundle"
import {
  assertApolloLivePilotEvidence,
  validateApolloLivePilotEvidence,
  type ApolloLivePilotEvidence,
} from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import {
  assessApolloOutreachChannelReadiness,
  type ApolloOutreachChannelReadiness,
} from "@/lib/growth/apollo/apollo-outreach-channel-readiness"
import {
  buildApolloProductionActivationLimits,
  type ApolloProductionActivationLimits,
} from "@/lib/growth/apollo/apollo-production-activation-limits"
import {
  buildApolloQualityBenchmarkReport,
  type ApolloQualityBenchmarkReport,
} from "@/lib/growth/apollo/apollo-quality-benchmark-report"
import {
  validateApolloPipelineE2E,
  type ApolloPipelineE2EValidation,
} from "@/lib/growth/apollo/apollo-pipeline-e2e-validation"
import {
  certifyApolloSequenceEligibility,
  type ApolloSequenceEligibilityCertification,
} from "@/lib/growth/apollo/apollo-sequence-eligibility-certification"
import { scoreApolloContactQuality } from "@/lib/growth/apollo/apollo-contact-quality-score"
import { analyzeApolloReadinessFunnel } from "@/lib/growth/apollo/apollo-readiness-funnel-analysis"

export const APOLLO_INTEGRATION_AI_5_QA_MARKER = "apollo-integration-ai-5-v1" as const

export type ApolloProductionActivationVerdict = "approved" | "conditionally_approved" | "rejected"

export type ApolloProductionActivationDecision = {
  verdict: ApolloProductionActivationVerdict
  approved_for_controlled_production: boolean
  approved_for_first_enrollment: boolean
  approved_for_bulk_enrollment: false
  based_on_live_evidence: boolean
  blockers: string[]
  justification: string
}

export type ApolloLiveEvidenceSummary = {
  company_name: string
  company_candidate_id: string
  domain: string | null
  mock: boolean
  pilot_at: string
  contacts_mapped: number
  contacts_stored: number
  api_calls: number
  credits_consumed: number
  runtime_ms: number
  errors: string[]
  canonical_company_linked: boolean
  canonical_persons_linked: number
}

export type ApolloProductionActivationCertification = {
  qa_marker: typeof APOLLO_INTEGRATION_AI_5_QA_MARKER
  certified_at: string
  evidence_valid: boolean
  evidence_source: string | null
  live_evidence_summary: ApolloLiveEvidenceSummary
  pipeline: ApolloPipelineE2EValidation
  sequence_eligibility: ApolloSequenceEligibilityCertification
  channel_readiness: ApolloOutreachChannelReadiness
  quality_benchmark: ApolloQualityBenchmarkReport
  rollout_limits: ApolloProductionActivationLimits
  readiness_funnel: ReturnType<typeof analyzeApolloReadinessFunnel>
  activation_decision: ApolloProductionActivationDecision
}

export function loadApolloPilotEvidenceFromJson(raw: unknown): {
  evidence: ApolloLivePilotEvidence
  source_label: string
} {
  if (!raw || typeof raw !== "object") {
    throw new Error("Evidence JSON must be an object")
  }
  const record = raw as Record<string, unknown>
  const { evidence } = unwrapApolloLivePilotEvidenceBundle(raw)
  const validation = validateApolloLivePilotEvidence(evidence)
  if (!validation.ok) {
    throw new Error(`Malformed evidence: ${validation.errors.join("; ")}`)
  }
  assertApolloLivePilotEvidence(evidence)
  const source =
    record.qa_marker === "apollo-live-pilot-evidence-bundle-ai-4-v1"
      ? "AI-4 evidence bundle"
      : "AI-2/AI-3 pilot evidence"
  return { evidence, source_label: source }
}

function buildLiveEvidenceSummary(evidence: ApolloLivePilotEvidence): ApolloLiveEvidenceSummary {
  const { person, company } = evidence.canonical_matching
  return {
    company_name: evidence.company.company_name,
    company_candidate_id: evidence.company.company_candidate_id,
    domain: evidence.company.domain,
    mock: evidence.mock,
    pilot_at: evidence.pilot_at,
    contacts_mapped: evidence.discovery.contacts_mapped,
    contacts_stored: evidence.discovery.candidates_stored,
    api_calls: evidence.runtime.api_calls,
    credits_consumed: evidence.runtime.credits_consumed,
    runtime_ms: evidence.runtime.duration_ms,
    errors: evidence.runtime.errors,
    canonical_company_linked: company.matched + company.created > 0,
    canonical_persons_linked: person.matched + person.created + person.deduped,
  }
}

export function assessApolloProductionActivationDecision(input: {
  evidence: ApolloLivePilotEvidence
  pipeline: ApolloPipelineE2EValidation
  sequence_eligibility: ApolloSequenceEligibilityCertification
  channel_readiness: ApolloOutreachChannelReadiness
  quality_benchmark: ApolloQualityBenchmarkReport
  compliance_orchestration_enabled?: boolean
}): ApolloProductionActivationDecision {
  const blockers: string[] = []

  if (input.evidence.mock) {
    blockers.push("Evidence is mock — load live pilot JSON from pnpm run:apollo-live-pilot-ai-3")
  }
  if (input.evidence.runtime.errors.length > 0) {
    blockers.push(`Pilot runtime errors: ${input.evidence.runtime.errors.join("; ")}`)
  }
  if (input.evidence.discovery.contacts_mapped < 1) {
    blockers.push("No contacts mapped in live evidence")
  }
  if (!input.evidence.mock && input.evidence.runtime.api_calls < 1) {
    blockers.push("Zero Apollo API calls in live evidence")
  }
  if (!input.pipeline.funnel_integrity_ok) {
    blockers.push(...input.pipeline.integrity_errors)
  }
  blockers.push(...input.sequence_eligibility.failures.filter((f) => f.includes("sequence_ready")))

  const liveOk =
    !input.evidence.mock &&
    input.evidence.runtime.errors.length === 0 &&
    input.evidence.discovery.contacts_mapped >= 1 &&
    input.pipeline.funnel_integrity_ok

  const qualityOk = input.quality_benchmark.quality.composite_score >= 65
  const qualityPartial = input.quality_benchmark.quality.composite_score >= 45
  const sequenceReady = input.evidence.readiness_funnel.sequence_ready >= 1
  const enrollmentReady = input.sequence_eligibility.enrollment_ready
  const channelReady = input.channel_readiness.any_channel_ready

  let verdict: ApolloProductionActivationVerdict = "rejected"

  if (liveOk && qualityOk && sequenceReady && enrollmentReady && channelReady) {
    verdict = "approved"
  } else if (liveOk && qualityPartial && sequenceReady) {
    verdict = "conditionally_approved"
  } else if (liveOk && qualityPartial && input.evidence.readiness_funnel.contactable >= 1) {
    verdict = "conditionally_approved"
    blockers.push("Sequence-ready or channel readiness incomplete — enrollment requires ops review")
  }

  const justification =
    verdict === "approved"
      ? "Live Apollo evidence validates end-to-end pipeline through sequence readiness with channel eligibility. Approved for controlled production and first human-approved enrollments."
      : verdict === "conditionally_approved"
        ? "Live evidence partially validates pipeline — proceed at Week 1 limits with daily ops review. First enrollment requires addressing documented failures."
        : input.evidence.mock
          ? "Rejected — load ./evidence/apollo-ai-3-pilot.json from successful AI-4 live pilot."
          : "Rejected — live evidence does not meet AI-5 production activation thresholds."

  return {
    verdict,
    approved_for_controlled_production: verdict !== "rejected",
    approved_for_first_enrollment: verdict === "approved" || (verdict === "conditionally_approved" && sequenceReady),
    approved_for_bulk_enrollment: false,
    based_on_live_evidence: !input.evidence.mock,
    blockers: [...new Set(blockers)],
    justification,
  }
}

export function certifyApolloProductionActivation(input: {
  evidence: unknown
  evidence_source?: string | null
  voice_drop_vd4_live_certified?: boolean
  compliance_orchestration_enabled?: boolean
  nowIso?: string
}): { ok: boolean; errors: string[]; certification: ApolloProductionActivationCertification | null } {
  const validation = validateApolloLivePilotEvidence(input.evidence)
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, certification: null }
  }

  assertApolloLivePilotEvidence(input.evidence)
  const evidence = input.evidence

  const pipeline = validateApolloPipelineE2E(evidence)
  const sequence_eligibility = certifyApolloSequenceEligibility({
    evidence,
    compliance_orchestration_enabled: input.compliance_orchestration_enabled,
  })
  const channel_readiness = assessApolloOutreachChannelReadiness({
    evidence,
    voice_drop_vd4_live_certified: input.voice_drop_vd4_live_certified,
    compliance_orchestration_enabled: input.compliance_orchestration_enabled,
  })
  const quality_benchmark = buildApolloQualityBenchmarkReport(evidence)
  const quality = scoreApolloContactQuality(evidence)
  const rollout_limits = buildApolloProductionActivationLimits({ evidence, quality, benchmark: quality_benchmark })
  const readiness_funnel = analyzeApolloReadinessFunnel(evidence)
  const activation_decision = assessApolloProductionActivationDecision({
    evidence,
    pipeline,
    sequence_eligibility,
    channel_readiness,
    quality_benchmark,
    compliance_orchestration_enabled: input.compliance_orchestration_enabled,
  })

  return {
    ok: true,
    errors: [],
    certification: {
      qa_marker: APOLLO_INTEGRATION_AI_5_QA_MARKER,
      certified_at: input.nowIso ?? new Date().toISOString(),
      evidence_valid: true,
      evidence_source: input.evidence_source ?? null,
      live_evidence_summary: buildLiveEvidenceSummary(evidence),
      pipeline,
      sequence_eligibility,
      channel_readiness,
      quality_benchmark,
      rollout_limits,
      readiness_funnel,
      activation_decision,
    },
  }
}

export function formatApolloProductionActivationMarkdown(
  cert: ApolloProductionActivationCertification,
): string {
  const s = cert.live_evidence_summary
  const p = cert.pipeline.counts
  const m = cert.quality_benchmark.metrics
  const lines = [
    "# Apollo AI-5 Production Activation Certification",
    "",
    `Certified at: ${cert.certified_at}`,
    `Activation verdict: **${cert.activation_decision.verdict.toUpperCase()}**`,
    "",
    cert.activation_decision.justification,
    "",
    "## Live Evidence Summary",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Company | ${s.company_name} |`,
    `| Candidate ID | ${s.company_candidate_id} |`,
    `| Mock | ${s.mock} |`,
    `| Contacts mapped | ${s.contacts_mapped} |`,
    `| API calls | ${s.api_calls} |`,
    `| Credits | ${s.credits_consumed} |`,
    `| Canonical persons linked | ${s.canonical_persons_linked} |`,
    "",
    "## Pipeline Funnel (Imported → Sequence Ready)",
    "",
    `| Stage | Count |`,
    `|-------|-------|`,
    `| Imported | ${p.imported} |`,
    `| Canonical | ${p.canonical} |`,
    `| Research | ${p.research} |`,
    `| Scored | ${p.scored} |`,
    `| Contactable | ${p.contactable} |`,
    `| Sequence ready | ${p.sequence_ready} |`,
    "",
    cert.pipeline.summary,
    "",
    "## Channel Readiness (assessment only)",
    "",
    ...cert.channel_readiness.channels.map(
      (c) =>
        `- **${c.channel}**: ${c.status} — ${c.estimated_sequence_ready_eligible} est. sequence-ready eligible`,
    ),
    "",
    cert.channel_readiness.summary,
    "",
    "## Quality Benchmark",
    "",
    `| Metric | % |`,
    `|--------|---|`,
    `| Decision makers | ${m.decision_maker_pct} |`,
    `| Executives | ${m.executive_pct} |`,
    `| Managers | ${m.manager_pct} |`,
    `| Contactability | ${m.contactability_pct} |`,
    `| Sequence-ready | ${m.sequence_ready_pct} |`,
    "",
    `Benchmark grade: **${cert.quality_benchmark.benchmark_grade}** (composite ${cert.quality_benchmark.quality.composite_score}/100)`,
    "",
    "## Rollout Limits",
    "",
    ...cert.rollout_limits.weeks.map(
      (w) =>
        `- **${w.label}**: ${w.companies_per_day.min}–${w.companies_per_day.max} companies/day, ${w.contacts_per_day.min}–${w.contacts_per_day.max} contacts/day, ${w.enrollments_per_day.min}–${w.enrollments_per_day.max} enrollments/day`,
    ),
    "",
    "## Sequence Eligibility",
    "",
    cert.sequence_eligibility.summary,
  ]
  return lines.join("\n")
}
