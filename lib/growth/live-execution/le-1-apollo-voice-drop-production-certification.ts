/** LE-1 Apollo + Voice Drop final production certification — evidence only, no API calls. */

import { certifyApolloProductionRollout } from "@/lib/growth/apollo/apollo-integration-ai-3-production-certification"
import {
  certifyApolloProductionActivation,
  loadApolloPilotEvidenceFromJson,
} from "@/lib/growth/apollo/apollo-integration-ai-5-production-activation"
import type { ApolloProductionActivationCertification } from "@/lib/growth/apollo/apollo-integration-ai-5-production-activation"
import type { ApolloAi3ProductionCertification } from "@/lib/growth/apollo/apollo-integration-ai-3-production-certification"
import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import {
  assertLe1ManualEnrollmentEvidence,
  assertLe1NonVoiceChannelEvidence,
  assertLe1VoiceDropLiveEvidence,
  validateLe1ManualEnrollmentEvidence,
  validateLe1NonVoiceChannelEvidence,
  validateLe1VoiceDropLiveEvidence,
  type Le1ManualEnrollmentEvidence,
  type Le1NonVoiceChannelEvidence,
  type Le1VoiceDropLiveEvidence,
} from "@/lib/growth/live-execution/le-1-evidence-types"
import { validateLe1RollbackKillSwitches } from "@/lib/growth/live-execution/le-1-rollback-validation"
import {
  validateLe1SequenceReadyContactPath,
  type Le1SequenceReadyContactValidation,
} from "@/lib/growth/live-execution/le-1-sequence-ready-contact-validation"

export const LE_1_APOLLO_VOICE_DROP_PRODUCTION_QA_MARKER = "le-1-apollo-voice-drop-production-v1" as const

export type Le1ProductionReadinessVerdict = "approved" | "conditionally_approved" | "rejected"

export type Le1ManualEnrollmentResult = {
  present: boolean
  valid: boolean
  evidence: Le1ManualEnrollmentEvidence | null
  errors: string[]
  summary: string
}

export type Le1NonVoiceChannelResult = {
  present: boolean
  valid: boolean
  evidence: Le1NonVoiceChannelEvidence | null
  errors: string[]
  summary: string
}

export type Le1VoiceDropLiveResult = {
  present: boolean
  valid: boolean
  evidence: Le1VoiceDropLiveEvidence | null
  errors: string[]
  chain_complete: boolean
  summary: string
}

export type Le1ProductionReadinessReport = {
  qa_marker: typeof LE_1_APOLLO_VOICE_DROP_PRODUCTION_QA_MARKER
  generated_at: string
  evidence_sources: {
    apollo: string | null
    manual_enrollment: string | null
    non_voice_channels: string | null
    voice_drop_live: string | null
  }
  apollo_live_summary: ApolloProductionActivationCertification["live_evidence_summary"] | null
  ai3_verdict: ApolloAi3ProductionCertification["final_go_no_go"]["verdict"] | null
  ai5_verdict: ApolloProductionActivationCertification["activation_decision"]["verdict"] | null
  sequence_ready_contact: Le1SequenceReadyContactValidation
  channel_readiness: ApolloProductionActivationCertification["channel_readiness"] | null
  manual_enrollment: Le1ManualEnrollmentResult
  non_voice_channels: Le1NonVoiceChannelResult
  voice_drop_live: Le1VoiceDropLiveResult
  rollback: ReturnType<typeof validateLe1RollbackKillSwitches>
  recommended_pilot_limits: ApolloProductionActivationCertification["rollout_limits"] | null
  remaining_blockers: string[]
  final_verdict: Le1ProductionReadinessVerdict
  final_justification: string
}

export function parseLe1OptionalEvidence<T>(
  raw: unknown,
  validate: (input: unknown) => { ok: boolean; errors: string[] },
): { ok: boolean; errors: string[]; value: T | null } {
  if (raw == null) return { ok: true, errors: [], value: null }
  const result = validate(raw)
  return { ok: result.ok, errors: result.errors, value: result.ok ? (raw as T) : null }
}

export function assessLe1FinalVerdict(input: {
  evidence: ApolloLivePilotEvidence
  ai3: ApolloAi3ProductionCertification | null
  ai5: ApolloProductionActivationCertification | null
  sequence_ready: Le1SequenceReadyContactValidation
  manual_enrollment: Le1ManualEnrollmentResult
  non_voice: Le1NonVoiceChannelResult
  voice_drop: Le1VoiceDropLiveResult
  rollback_ok: boolean
}): { verdict: Le1ProductionReadinessVerdict; blockers: string[]; justification: string } {
  const blockers: string[] = []

  if (input.evidence.mock) {
    blockers.push("Apollo evidence is mock — run live pilot first")
  }
  if (!input.ai3 || input.ai3.final_go_no_go.verdict === "rejected") {
    blockers.push("AI-3 production certification rejected or missing")
  }
  if (!input.ai5 || input.ai5.activation_decision.verdict === "rejected") {
    blockers.push("AI-5 production activation rejected or missing")
  }
  if (!input.sequence_ready.path_valid) {
    blockers.push(...input.sequence_ready.failures)
  }
  if (!input.manual_enrollment.valid) {
    blockers.push("Manual enrollment evidence missing or invalid")
  }
  if (!input.rollback_ok) {
    blockers.push("Rollback kill switch validation failed")
  }

  const apolloOk =
    !input.evidence.mock &&
    input.ai3?.final_go_no_go.verdict !== "rejected" &&
    input.ai5?.activation_decision.verdict !== "rejected" &&
    input.sequence_ready.path_valid

  const enrollmentOk = input.manual_enrollment.valid
  const nonVoiceOk = input.non_voice.valid || !input.non_voice.present
  const voiceDropOk = input.voice_drop.valid || !input.voice_drop.present

  if (!input.non_voice.present) {
    blockers.push("Non-voice channel evidence not captured (manual step)")
  }
  if (!input.voice_drop.present) {
    blockers.push("Voice Drop live evidence not captured (optional until VD-4 complete)")
  }

  let verdict: Le1ProductionReadinessVerdict = "rejected"

  if (
    apolloOk &&
    enrollmentOk &&
    input.non_voice.valid &&
    input.voice_drop.valid &&
    input.voice_drop.chain_complete &&
    input.rollback_ok &&
    input.ai5?.activation_decision.verdict === "approved"
  ) {
    verdict = "approved"
  } else if (apolloOk && enrollmentOk && input.rollback_ok) {
    verdict = "conditionally_approved"
  }

  const justification =
    verdict === "approved"
      ? "Live Apollo path, manual enrollment, non-voice channels, and Voice Drop live test validated. Controlled production approved at Week 1 limits."
      : verdict === "conditionally_approved"
        ? "Apollo import and manual enrollment validated — complete non-voice and/or Voice Drop live evidence for full sign-off."
        : input.evidence.mock
          ? "Rejected — execute AI-4 live pilot and capture evidence before LE-1 certification."
          : "Rejected — LE-1 production test thresholds not met."

  return { verdict, blockers: [...new Set(blockers)], justification }
}

export function certifyLe1ApolloVoiceDropProduction(input: {
  apollo_evidence: unknown
  apollo_evidence_source?: string | null
  manual_enrollment?: unknown | null
  non_voice_channels?: unknown | null
  voice_drop_live?: unknown | null
  voice_drop_vd4_live_certified?: boolean
  compliance_orchestration_enabled?: boolean
  nowIso?: string
}): { ok: boolean; errors: string[]; report: Le1ProductionReadinessReport | null } {
  let evidence: ApolloLivePilotEvidence
  try {
    if (typeof input.apollo_evidence === "object" && input.apollo_evidence !== null) {
      const loaded = loadApolloPilotEvidenceFromJson(input.apollo_evidence)
      evidence = loaded.evidence
    } else {
      return { ok: false, errors: ["apollo_evidence must be a JSON object"], report: null }
    }
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)], report: null }
  }

  const ai3 = certifyApolloProductionRollout({
    evidence,
    voice_drop_vd4_live_certified: input.voice_drop_vd4_live_certified,
    compliance_orchestration_enabled: input.compliance_orchestration_enabled,
  })
  const ai5 = certifyApolloProductionActivation({
    evidence,
    evidence_source: input.apollo_evidence_source,
    voice_drop_vd4_live_certified: input.voice_drop_vd4_live_certified,
    compliance_orchestration_enabled: input.compliance_orchestration_enabled,
  })

  if (!ai3.ok || !ai5.ok) {
    return {
      ok: false,
      errors: [...ai3.errors, ...ai5.errors],
      report: null,
    }
  }

  const manualParsed = parseLe1OptionalEvidence<Le1ManualEnrollmentEvidence>(
    input.manual_enrollment,
    validateLe1ManualEnrollmentEvidence,
  )
  const nonVoiceParsed = parseLe1OptionalEvidence<Le1NonVoiceChannelEvidence>(
    input.non_voice_channels,
    validateLe1NonVoiceChannelEvidence,
  )
  const voiceDropParsed = parseLe1OptionalEvidence<Le1VoiceDropLiveEvidence>(
    input.voice_drop_live,
    validateLe1VoiceDropLiveEvidence,
  )

  const manual_enrollment: Le1ManualEnrollmentResult = {
    present: input.manual_enrollment != null,
    valid: manualParsed.ok && manualParsed.value != null,
    evidence: manualParsed.value,
    errors: manualParsed.errors,
    summary: manualParsed.value
      ? "One contact manually enrolled with operator approval — bulk enrollment false."
      : manualParsed.errors.length > 0
        ? `Manual enrollment invalid: ${manualParsed.errors.join("; ")}`
        : "Manual enrollment evidence not provided.",
  }

  const non_voice_channels: Le1NonVoiceChannelResult = {
    present: input.non_voice_channels != null,
    valid: nonVoiceParsed.ok && nonVoiceParsed.value != null,
    evidence: nonVoiceParsed.value,
    errors: nonVoiceParsed.errors,
    summary: nonVoiceParsed.value
      ? nonVoiceParsed.value.send_executed
        ? "Invalid — send_executed must be false unless explicitly approved"
        : "Non-voice channel path validated (email job, SMS eligibility, approval workflow, timeline)."
      : nonVoiceParsed.errors.length > 0
        ? `Non-voice evidence invalid: ${nonVoiceParsed.errors.join("; ")}`
        : "Non-voice channel evidence not provided.",
  }

  const voiceDropEvidence = voiceDropParsed.value
  const chain_complete = Boolean(
    voiceDropEvidence?.callSid &&
      voiceDropEvidence.deliveryAttemptId &&
      voiceDropEvidence.status_callback_received !== false,
  )

  const voice_drop_live: Le1VoiceDropLiveResult = {
    present: input.voice_drop_live != null,
    valid: voiceDropParsed.ok && voiceDropParsed.value != null,
    evidence: voiceDropParsed.value,
    errors: voiceDropParsed.errors,
    chain_complete,
    summary: voiceDropParsed.value
      ? chain_complete
        ? "Voice Drop live chain validated: step → job → Twilio → AMD → TwiML → callback → timeline."
        : "Voice Drop evidence present but delivery chain incomplete."
      : voiceDropParsed.errors.length > 0
        ? `Voice Drop evidence invalid: ${voiceDropParsed.errors.join("; ")}`
        : "Voice Drop live test not executed — optional until Apollo path validates.",
  }

  const sequence_ready_contact = validateLe1SequenceReadyContactPath(evidence)
  const rollback = validateLe1RollbackKillSwitches()

  const { verdict, blockers, justification } = assessLe1FinalVerdict({
    evidence,
    ai3: ai3.certification,
    ai5: ai5.certification,
    sequence_ready: sequence_ready_contact,
    manual_enrollment,
    non_voice: non_voice_channels,
    voice_drop: voice_drop_live,
    rollback_ok: rollback.all_kill_switches_verified,
  })

  return {
    ok: true,
    errors: [],
    report: {
      qa_marker: LE_1_APOLLO_VOICE_DROP_PRODUCTION_QA_MARKER,
      generated_at: input.nowIso ?? new Date().toISOString(),
      evidence_sources: {
        apollo: input.apollo_evidence_source ?? null,
        manual_enrollment: manual_enrollment.present ? "LE-1 manual enrollment JSON" : null,
        non_voice_channels: non_voice_channels.present ? "LE-1 non-voice channel JSON" : null,
        voice_drop_live: voice_drop_live.present ? "LE-1 / VD-4 Voice Drop JSON" : null,
      },
      apollo_live_summary: ai5.certification!.live_evidence_summary,
      ai3_verdict: ai3.certification!.final_go_no_go.verdict,
      ai5_verdict: ai5.certification!.activation_decision.verdict,
      sequence_ready_contact,
      channel_readiness: ai5.certification!.channel_readiness,
      manual_enrollment,
      non_voice_channels,
      voice_drop_live,
      rollback,
      recommended_pilot_limits: ai5.certification!.rollout_limits,
      remaining_blockers: blockers,
      final_verdict: verdict,
      final_justification: justification,
    },
  }
}

export function formatLe1ProductionReadinessMarkdown(report: Le1ProductionReadinessReport): string {
  const s = report.apollo_live_summary
  const sr = report.sequence_ready_contact
  const limits = report.recommended_pilot_limits?.weeks[0]

  return [
    "# LE-1 Apollo + Voice Drop Production Readiness Report",
    "",
    `Generated: ${report.generated_at}`,
    `Final verdict: **${report.final_verdict.toUpperCase()}**`,
    "",
    report.final_justification,
    "",
    "## Apollo Live Evidence",
    "",
    s
      ? `| Metric | Value |\n|--------|-------|\n| Company | ${s.company_name} |\n| Contacts mapped | ${s.contacts_mapped} |\n| API calls | ${s.api_calls} |\n| AI-3 | ${report.ai3_verdict} |\n| AI-5 | ${report.ai5_verdict} |`
      : "No Apollo summary",
    "",
    "## Sequence-Ready Contact Path",
    "",
    sr.summary,
    "",
    ...sr.checks.map((c) => `- ${c.id}: ${c.satisfied ? "OK" : "FAIL"} — ${c.detail}`),
    "",
    "## Manual Enrollment",
    "",
    report.manual_enrollment.summary,
    "",
    "## Non-Voice Channels",
    "",
    report.non_voice_channels.summary,
    "",
    "## Voice Drop Live",
    "",
    report.voice_drop_live.summary,
    "",
    "## Recommended Pilot Limits (Week 1)",
    "",
    limits
      ? `- Companies/day: ${limits.companies_per_day.min}–${limits.companies_per_day.max}\n- Contacts/day: ${limits.contacts_per_day.min}–${limits.contacts_per_day.max}\n- Enrollments/day: ${limits.enrollments_per_day.min}–${limits.enrollments_per_day.max}`
      : "See AI-5 rollout limits",
    "",
    "## Rollback Confirmation",
    "",
    report.rollback.summary,
    "",
    report.remaining_blockers.length > 0
      ? `## Remaining Blockers\n\n${report.remaining_blockers.map((b) => `- ${b}`).join("\n")}`
      : "## Remaining Blockers\n\nNone",
  ].join("\n")
}
