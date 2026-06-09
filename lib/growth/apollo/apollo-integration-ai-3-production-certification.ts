/** Apollo AI-3 production rollout certification — bundles live evidence analysis. Client-safe. */

import { analyzeApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-analysis"
import type { ApolloLivePilotAnalysis } from "@/lib/growth/apollo/apollo-live-pilot-analysis"
import {
  assertApolloLivePilotEvidence,
  validateApolloLivePilotEvidence,
  type ApolloLivePilotEvidence,
} from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import { scoreApolloContactQuality, type ApolloContactQualityScore } from "@/lib/growth/apollo/apollo-contact-quality-score"
import {
  assessApolloMultichannelProductionReadiness,
  type ApolloMultichannelProductionReadiness,
} from "@/lib/growth/apollo/apollo-multichannel-production-readiness"
import {
  analyzeApolloReadinessFunnel,
  type ApolloReadinessFunnelAnalysis,
} from "@/lib/growth/apollo/apollo-readiness-funnel-analysis"
import {
  buildApolloControlledRolloutPlan,
  type ApolloControlledRolloutPlan,
} from "@/lib/growth/apollo/apollo-rollout-plan"

export const APOLLO_INTEGRATION_AI_3_QA_MARKER = "apollo-integration-ai-3-v1" as const

export type ApolloAi3FinalVerdict = "approved" | "conditionally_approved" | "rejected"

export type ApolloAi3FinalGoNoGo = {
  verdict: ApolloAi3FinalVerdict
  approved_for_controlled_production: boolean
  approved_for_bulk_enrollment: false
  based_on_live_evidence_only: boolean
  blockers: string[]
  justification: string
}

export type ApolloAi3ProductionCertification = {
  qa_marker: typeof APOLLO_INTEGRATION_AI_3_QA_MARKER
  certified_at: string
  evidence_valid: boolean
  pilot: {
    company_name: string
    domain: string | null
    mock: boolean
    contacts_mapped: number
    api_calls: number
    credits_consumed: number
    runtime_ms: number
    errors: string[]
  }
  analysis: ApolloLivePilotAnalysis
  quality: ApolloContactQualityScore
  funnel: ApolloReadinessFunnelAnalysis
  multichannel: ApolloMultichannelProductionReadiness
  rollout: ApolloControlledRolloutPlan
  final_go_no_go: ApolloAi3FinalGoNoGo
}

export function assessApolloAi3FinalGoNoGo(input: {
  evidence: ApolloLivePilotEvidence
  analysis: ApolloLivePilotAnalysis
  quality: ApolloContactQualityScore
  multichannel: ApolloMultichannelProductionReadiness
}): ApolloAi3FinalGoNoGo {
  const blockers: string[] = []

  if (input.evidence.mock) {
    blockers.push("Evidence is mock — live Apollo pilot required for production approval.")
  }
  if (input.evidence.runtime.api_calls < 1 && !input.evidence.mock) {
    blockers.push("Zero API calls recorded in live evidence.")
  }
  if (input.evidence.discovery.contacts_mapped < 1) {
    blockers.push("No contacts mapped.")
  }
  blockers.push(...input.analysis.go_no_go.blockers.filter((b) => !/mock mode/i.test(b)))

  if (input.quality.composite_score < 45) {
    blockers.push(`Contact quality composite ${input.quality.composite_score} below minimum threshold (45).`)
  }

  const liveOk =
    !input.evidence.mock &&
    input.evidence.runtime.errors.length === 0 &&
    input.evidence.discovery.contacts_mapped >= 1 &&
    input.multichannel.path_safe_for_controlled_production

  const productionReady =
    liveOk &&
    input.analysis.go_no_go.ready_for_controlled_production &&
    input.evidence.readiness_funnel.sequence_ready >= 1

  let verdict: ApolloAi3FinalVerdict = "rejected"
  if (productionReady && input.quality.composite_score >= 65) {
    verdict = "approved"
  } else if (liveOk && input.analysis.go_no_go.verdict !== "no_go" && input.quality.composite_score >= 45) {
    verdict = "conditionally_approved"
  }

  const justification =
    verdict === "approved"
      ? "Live Apollo pilot evidence supports controlled production usage at Phase 1 rollout limits."
      : verdict === "conditionally_approved"
        ? "Live pilot partially validated — proceed only at Phase 1 (1–10 companies/day) with daily ops review."
        : input.evidence.mock
          ? "Rejected — submit live pilot evidence via pnpm run:apollo-live-pilot-ai-3 before production approval."
          : "Rejected — live evidence does not meet AI-3 production certification thresholds."

  return {
    verdict,
    approved_for_controlled_production: verdict !== "rejected",
    approved_for_bulk_enrollment: false,
    based_on_live_evidence_only: !input.evidence.mock,
    blockers: [...new Set(blockers)],
    justification,
  }
}

export function certifyApolloProductionRollout(input: {
  evidence: unknown
  voice_drop_vd4_live_certified?: boolean
  compliance_orchestration_enabled?: boolean
  nowIso?: string
}): { ok: boolean; errors: string[]; certification: ApolloAi3ProductionCertification | null } {
  const validation = validateApolloLivePilotEvidence(input.evidence)
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, certification: null }
  }

  assertApolloLivePilotEvidence(input.evidence)
  const evidence = input.evidence

  const analysis = analyzeApolloLivePilotEvidence(evidence)
  const quality = scoreApolloContactQuality(evidence)
  const funnel = analyzeApolloReadinessFunnel(evidence)
  const multichannel = assessApolloMultichannelProductionReadiness({
    evidence,
    voice_drop_vd4_live_certified: input.voice_drop_vd4_live_certified,
    compliance_orchestration_enabled: input.compliance_orchestration_enabled,
  })
  const rollout = buildApolloControlledRolloutPlan({ evidence, analysis, quality })
  const final_go_no_go = assessApolloAi3FinalGoNoGo({ evidence, analysis, quality, multichannel })

  return {
    ok: true,
    errors: [],
    certification: {
      qa_marker: APOLLO_INTEGRATION_AI_3_QA_MARKER,
      certified_at: input.nowIso ?? new Date().toISOString(),
      evidence_valid: true,
      pilot: {
        company_name: evidence.company.company_name,
        domain: evidence.company.domain,
        mock: evidence.mock,
        contacts_mapped: evidence.discovery.contacts_mapped,
        api_calls: evidence.runtime.api_calls,
        credits_consumed: evidence.runtime.credits_consumed,
        runtime_ms: evidence.runtime.duration_ms,
        errors: evidence.runtime.errors,
      },
      analysis,
      quality,
      funnel,
      multichannel,
      rollout,
      final_go_no_go,
    },
  }
}

export function formatApolloAi3CertificationMarkdown(cert: ApolloAi3ProductionCertification): string {
  const f = cert.funnel.counts
  const p = cert.analysis.cost_projections
  const lines = [
    `# Apollo AI-3 Production Certification`,
    "",
    `Certified at: ${cert.certified_at}`,
    `Final verdict: **${cert.final_go_no_go.verdict}**`,
    "",
    cert.final_go_no_go.justification,
    "",
    "## Live Pilot",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Company | ${cert.pilot.company_name} |`,
    `| Mock | ${cert.pilot.mock} |`,
    `| Contacts mapped | ${cert.pilot.contacts_mapped} |`,
    `| API calls | ${cert.pilot.api_calls} |`,
    `| Credits | ${cert.pilot.credits_consumed} |`,
    `| Runtime (ms) | ${cert.pilot.runtime_ms} |`,
    "",
    "## Canonical Matching",
    "",
    `| Entity | Matched | Created | Deduped | Rejected |`,
    `|--------|---------|---------|---------|----------|`,
    `| Company | ${cert.analysis.canonical_matching.company.matched} | ${cert.analysis.canonical_matching.company.created} | ${cert.analysis.canonical_matching.company.deduped} | ${cert.analysis.canonical_matching.company.rejected} |`,
    `| Person | ${cert.analysis.canonical_matching.person.matched} | ${cert.analysis.canonical_matching.person.created} | ${cert.analysis.canonical_matching.person.deduped} | ${cert.analysis.canonical_matching.person.rejected} |`,
    `| Duplicate risk | ${cert.analysis.canonical_matching.duplicate_risk} | | | |`,
    "",
    "## Data Quality",
    "",
    `Composite score: **${cert.quality.composite_score}/100** (${cert.quality.grade})`,
    "",
    `| Category | Count |`,
    `|----------|-------|`,
    `| Executives | ${cert.quality.breakdown.executives} |`,
    `| Managers | ${cert.quality.breakdown.managers} |`,
    `| Decision makers | ${cert.quality.breakdown.decision_makers} |`,
    `| Invalid/irrelevant | ${cert.quality.breakdown.invalid_or_irrelevant_titles} |`,
    "",
    "## Readiness Funnel",
    "",
    `| Stage | Count |`,
    `|-------|-------|`,
    `| Imported | ${f.imported} |`,
    `| Research complete | ${f.research_complete} |`,
    `| Score available | ${f.score_available} |`,
    `| Contactable | ${f.contactable} |`,
    `| Sequence ready | ${f.sequence_ready} |`,
    "",
    cert.funnel.summary,
    "",
    "## Cost Projections",
    "",
    ...p.map(
      (row) =>
        `- **${row.companies} companies:** ${row.estimated_api_calls} API calls, ${row.estimated_credits} credits, ${row.estimated_sequence_ready} sequence-ready contacts`,
    ),
    "",
    "## Rollout Plan",
    "",
    ...cert.rollout.phases.map(
      (phase) =>
        `- **Phase ${phase.phase}** (${phase.name}): ${phase.companies_per_day.min}–${phase.companies_per_day.max} companies/day`,
    ),
    "",
    "## Multichannel Assessment",
    "",
    cert.multichannel.assessment,
  ]
  return lines.join("\n")
}
