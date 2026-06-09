/** LE-2 live evidence validation — real evidence only, no fixtures. */

import { isApolloLivePilotEvidenceBundle } from "@/lib/growth/apollo/apollo-live-pilot-evidence-bundle"
import { certifyApolloProductionRollout } from "@/lib/growth/apollo/apollo-integration-ai-3-production-certification"
import type { ApolloAi3ProductionCertification } from "@/lib/growth/apollo/apollo-integration-ai-3-production-certification"
import {
  certifyApolloProductionActivation,
  loadApolloPilotEvidenceFromJson,
  type ApolloProductionActivationCertification,
} from "@/lib/growth/apollo/apollo-integration-ai-5-production-activation"
import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import { buildApolloProductionActivationLimits } from "@/lib/growth/apollo/apollo-production-activation-limits"
import { buildApolloQualityBenchmarkReport } from "@/lib/growth/apollo/apollo-quality-benchmark-report"
import { scoreApolloContactQuality } from "@/lib/growth/apollo/apollo-contact-quality-score"
import { certifyLe1ApolloVoiceDropProduction } from "@/lib/growth/live-execution/le-1-apollo-voice-drop-production-certification"
import type { Le1ProductionReadinessReport } from "@/lib/growth/live-execution/le-1-apollo-voice-drop-production-certification"
import {
  validateLe2EmailExecutionEvidence,
  type Le2EmailExecutionEvidence,
} from "@/lib/growth/live-execution/le-2-email-execution-evidence"

export const LE_2_LIVE_EVIDENCE_VALIDATION_QA_MARKER = "le-2-live-evidence-validation-v1" as const

export type Le2ProductionVerdict = "approved" | "conditionally_approved" | "rejected"

export type Le2EmailExecutionResult = {
  present: boolean
  valid: boolean
  evidence: Le2EmailExecutionEvidence | null
  errors: string[]
  summary: string
}

export type Le2ObservedLaunchLimits = {
  contacts_per_company: number
  sequence_ready_per_company: number
  sequence_ready_pct: number
  quality_composite: number
  week_1_companies_per_day_max: number
  week_1_enrollments_per_day_max: number
  source: "live_apollo_evidence"
}

export type Le2LiveEvidenceValidationReport = {
  qa_marker: typeof LE_2_LIVE_EVIDENCE_VALIDATION_QA_MARKER
  validated_at: string
  evidence_paths: {
    apollo: string | null
    manual_enrollment: string | null
    non_voice_channels: string | null
    email_execution: string | null
    voice_drop: string | null
  }
  apollo_evidence: ApolloLivePilotEvidence | null
  apollo_mock: boolean
  ai3: ApolloAi3ProductionCertification | null
  ai5: ApolloProductionActivationCertification | null
  le1: Le1ProductionReadinessReport | null
  email_execution: Le2EmailExecutionResult
  observed_launch_limits: Le2ObservedLaunchLimits | null
  blockers: string[]
  final_verdict: Le2ProductionVerdict
  final_justification: string
}

export type Le2EvidenceBundle = {
  apollo?: unknown
  manual_enrollment?: unknown
  non_voice_channels?: unknown
  email_execution?: unknown
  voice_drop?: unknown
}

function unwrapApollo(raw: unknown): ApolloLivePilotEvidence {
  return loadApolloPilotEvidenceFromJson(raw).evidence
}

export function validateLe2LiveEvidence(input: {
  evidence: Le2EvidenceBundle
  evidence_paths?: Partial<Le2LiveEvidenceValidationReport["evidence_paths"]>
  voice_drop_vd4_live_certified?: boolean
  compliance_orchestration_enabled?: boolean
  nowIso?: string
}): Le2LiveEvidenceValidationReport {
  const blockers: string[] = []
  let apollo_evidence: ApolloLivePilotEvidence | null = null
  let ai3: ApolloAi3ProductionCertification | null = null
  let ai5: ApolloProductionActivationCertification | null = null

  if (input.evidence.apollo != null) {
    if (!isApolloLivePilotEvidenceBundle(input.evidence.apollo)) {
      blockers.push(
        "Apollo evidence must be AI-4 bundle from pnpm run:apollo-live-pilot-ai-3 (not bare fixture JSON)",
      )
    }
    try {
      apollo_evidence = unwrapApollo(input.evidence.apollo)
      if (apollo_evidence.mock) {
        blockers.push("Apollo evidence is mock — LE-2 requires live pilot evidence only")
      }
      if (apollo_evidence.runtime.api_calls < 1) {
        blockers.push("Apollo evidence shows zero API calls — live pilot not executed")
      }
      const ai3Result = certifyApolloProductionRollout({
        evidence: apollo_evidence,
        voice_drop_vd4_live_certified: input.voice_drop_vd4_live_certified,
        compliance_orchestration_enabled: input.compliance_orchestration_enabled,
      })
      const ai5Result = certifyApolloProductionActivation({
        evidence: apollo_evidence,
        evidence_source: input.evidence_paths?.apollo ?? null,
        voice_drop_vd4_live_certified: input.voice_drop_vd4_live_certified,
        compliance_orchestration_enabled: input.compliance_orchestration_enabled,
      })
      ai3 = ai3Result.certification
      ai5 = ai5Result.certification
      if (ai3Result.errors.length > 0) blockers.push(...ai3Result.errors)
      if (ai5Result.errors.length > 0) blockers.push(...ai5Result.errors)
      if (ai3?.final_go_no_go.verdict === "rejected") {
        blockers.push(`AI-3 rejected: ${ai3.final_go_no_go.justification}`)
      }
    } catch (err) {
      blockers.push(err instanceof Error ? err.message : String(err))
    }
  } else {
    blockers.push("Missing apollo-ai-3-pilot.json — run pnpm run:apollo-live-pilot-ai-3")
  }

  const emailValidation = input.evidence.email_execution
    ? validateLe2EmailExecutionEvidence(input.evidence.email_execution)
    : { ok: false, errors: ["Missing LE-2 email execution evidence"] }

  const email_execution: Le2EmailExecutionResult = {
    present: input.evidence.email_execution != null,
    valid: emailValidation.ok,
    evidence: emailValidation.ok ? (input.evidence.email_execution as Le2EmailExecutionEvidence) : null,
    errors: emailValidation.errors,
    summary: emailValidation.ok
      ? "One approved email send validated with timeline events."
      : emailValidation.errors.join("; ") || "Email execution evidence not captured.",
  }
  if (!email_execution.valid) blockers.push(email_execution.summary)

  const le1Result =
    apollo_evidence != null
      ? certifyLe1ApolloVoiceDropProduction({
          apollo_evidence: apollo_evidence,
          apollo_evidence_source: input.evidence_paths?.apollo ?? null,
          manual_enrollment: input.evidence.manual_enrollment ?? null,
          non_voice_channels: input.evidence.non_voice_channels ?? null,
          voice_drop_live: input.evidence.voice_drop ?? null,
          voice_drop_vd4_live_certified: input.voice_drop_vd4_live_certified,
          compliance_orchestration_enabled: input.compliance_orchestration_enabled,
        })
      : null

  const le1 = le1Result?.report ?? null
  if (le1Result && !le1Result.ok) blockers.push(...le1Result.errors)
  if (le1 && le1.final_verdict === "rejected") {
    blockers.push(`LE-1 rejected: ${le1.final_justification}`)
  }

  let observed_launch_limits: Le2ObservedLaunchLimits | null = null
  if (apollo_evidence && !apollo_evidence.mock) {
    const quality = scoreApolloContactQuality(apollo_evidence)
    const benchmark = buildApolloQualityBenchmarkReport(apollo_evidence)
    const limits = buildApolloProductionActivationLimits({ evidence: apollo_evidence, quality, benchmark })
    const mapped = Math.max(apollo_evidence.discovery.contacts_mapped, 1)
    observed_launch_limits = {
      contacts_per_company: apollo_evidence.discovery.contacts_mapped,
      sequence_ready_per_company: apollo_evidence.readiness_funnel.sequence_ready,
      sequence_ready_pct: Math.round((apollo_evidence.readiness_funnel.sequence_ready / mapped) * 1000) / 10,
      quality_composite: quality.composite_score,
      week_1_companies_per_day_max: limits.weeks[0]!.companies_per_day.max,
      week_1_enrollments_per_day_max: limits.weeks[0]!.enrollments_per_day.max,
      source: "live_apollo_evidence",
    }
  }

  const liveApolloOk = apollo_evidence != null && !apollo_evidence.mock
  const enrollmentOk = le1?.manual_enrollment.valid === true
  const voiceDropOk = le1?.voice_drop_live.valid === true && le1.voice_drop_live.chain_complete === true
  const emailOk = email_execution.valid
  const ai3Ok = ai3?.final_go_no_go.verdict !== "rejected"
  const ai5Ok = ai5?.activation_decision.verdict !== "rejected"

  let final_verdict: Le2ProductionVerdict = "rejected"
  if (liveApolloOk && ai3Ok && ai5Ok && enrollmentOk && emailOk && voiceDropOk && blockers.length === 0) {
    final_verdict = "approved"
  } else if (liveApolloOk && enrollmentOk && emailOk && ai3Ok) {
    final_verdict = "conditionally_approved"
  }

  const final_justification =
    final_verdict === "approved"
      ? "Live evidence chain complete: Apollo → enrollment → approved email → Voice Drop. Ready for controlled production at observed Week 1 limits."
      : final_verdict === "conditionally_approved"
        ? "Apollo import, enrollment, and email validated live. Complete Voice Drop evidence for full controlled production sign-off."
        : blockers[0]?.includes("mock")
          ? "Rejected — LE-2 requires live Apollo pilot evidence, not fixtures or mocks."
          : "Rejected — missing or invalid live evidence. Complete LE-2 execution checklist."

  return {
    qa_marker: LE_2_LIVE_EVIDENCE_VALIDATION_QA_MARKER,
    validated_at: input.nowIso ?? new Date().toISOString(),
    evidence_paths: {
      apollo: input.evidence_paths?.apollo ?? null,
      manual_enrollment: input.evidence_paths?.manual_enrollment ?? null,
      non_voice_channels: input.evidence_paths?.non_voice_channels ?? null,
      email_execution: input.evidence_paths?.email_execution ?? null,
      voice_drop: input.evidence_paths?.voice_drop ?? null,
    },
    apollo_evidence,
    apollo_mock: apollo_evidence?.mock ?? true,
    ai3,
    ai5,
    le1,
    email_execution,
    observed_launch_limits,
    blockers: [...new Set(blockers)],
    final_verdict,
    final_justification,
  }
}

export function formatLe2LiveEvidenceMarkdown(report: Le2LiveEvidenceValidationReport): string {
  const apollo = report.apollo_evidence
  const limits = report.observed_launch_limits
  return [
    "# LE-2 Live Evidence Validation Report",
    "",
    `Validated: ${report.validated_at}`,
    `Final verdict: **${report.final_verdict.toUpperCase()}**`,
    "",
    report.final_justification,
    "",
    "## Apollo Live Evidence",
    "",
    apollo
      ? `| Metric | Value |\n|--------|-------|\n| Company | ${apollo.company.company_name} |\n| Mock | ${apollo.mock} |\n| Contacts mapped | ${apollo.discovery.contacts_mapped} |\n| Sequence ready | ${apollo.readiness_funnel.sequence_ready} |\n| API calls | ${apollo.runtime.api_calls} |\n| Errors | ${apollo.runtime.errors.length} |`
      : "Not loaded",
    "",
    "## AI-3 Result",
    "",
    report.ai3
      ? `Verdict: **${report.ai3.final_go_no_go.verdict}** — Quality ${report.ai3.quality.composite_score}/100`
      : "Not available",
    "",
    "## AI-5 Result",
    "",
    report.ai5
      ? `Activation: **${report.ai5.activation_decision.verdict}**`
      : "Not available",
    "",
    "## Email Validation",
    "",
    report.email_execution.summary,
    "",
    "## Voice Drop Validation",
    "",
    report.le1?.voice_drop_live.summary ?? "Not available",
    "",
    "## LE-1 Result",
    "",
    report.le1 ? `Verdict: **${report.le1.final_verdict}**` : "Not available",
    "",
    limits
      ? `## Observed Launch Limits (Week 1)\n\n- Companies/day max: ${limits.week_1_companies_per_day_max}\n- Enrollments/day max: ${limits.week_1_enrollments_per_day_max}\n- Sequence-ready rate: ${limits.sequence_ready_pct}%\n- Quality composite: ${limits.quality_composite}/100`
      : "",
    "",
    report.blockers.length > 0
      ? `## Blockers\n\n${report.blockers.map((b) => `- ${b}`).join("\n")}`
      : "## Blockers\n\nNone",
  ]
    .filter(Boolean)
    .join("\n")
}
