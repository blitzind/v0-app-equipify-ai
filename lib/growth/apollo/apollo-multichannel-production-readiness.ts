/** Apollo AI-3 multichannel production safety assessment — client-safe, no new gates. */

import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"

export const APOLLO_MULTICHANNEL_READINESS_QA_MARKER = "apollo-multichannel-readiness-ai-3-v1" as const

export type ApolloMultichannelGateStatus = "pass" | "fail" | "manual" | "blocked"

export type ApolloMultichannelGate = {
  id: string
  channel: "apollo_import" | "research" | "sequence" | "voice_drop" | "email" | "sms" | "call"
  status: ApolloMultichannelGateStatus
  message: string
}

export type ApolloMultichannelProductionReadiness = {
  qa_marker: typeof APOLLO_MULTICHANNEL_READINESS_QA_MARKER
  path_safe_for_controlled_production: boolean
  voice_drop_production_safe: boolean
  gates: ApolloMultichannelGate[]
  blockers: string[]
  assessment: string
}

export function assessApolloMultichannelProductionReadiness(input: {
  evidence: ApolloLivePilotEvidence
  voice_drop_vd4_live_certified?: boolean
  compliance_orchestration_enabled?: boolean
}): ApolloMultichannelProductionReadiness {
  const { evidence } = input
  const vd4Cert = input.voice_drop_vd4_live_certified ?? false
  const compliance = input.compliance_orchestration_enabled ?? false
  const gates: ApolloMultichannelGate[] = []
  const blockers: string[] = []

  gates.push({
    id: "apollo.live_pilot",
    channel: "apollo_import",
    status: evidence.mock ? "blocked" : evidence.runtime.errors.length === 0 ? "pass" : "fail",
    message: evidence.mock
      ? "Live Apollo pilot evidence required."
      : evidence.runtime.errors.length === 0
        ? "Live pilot completed without runtime errors."
        : `Pilot errors: ${evidence.runtime.errors.join("; ")}`,
  })

  gates.push({
    id: "research.pipeline",
    channel: "research",
    status: evidence.research_pipeline.automated_flow_confirmed ? "pass" : "manual",
    message: evidence.research_pipeline.automated_flow_confirmed
      ? "Discovery → sync → canonical backfill confirmed."
      : "Research automation not fully confirmed — verify Lead Engine run.",
  })

  gates.push({
    id: "sequence.readiness",
    channel: "sequence",
    status:
      evidence.readiness_funnel.sequence_ready > 0
        ? "pass"
        : evidence.readiness_funnel.contactable > 0
          ? "manual"
          : "fail",
    message:
      evidence.readiness_funnel.sequence_ready > 0
        ? `${evidence.readiness_funnel.sequence_ready} sequence-ready contact(s).`
        : "No sequence-ready contacts — enrollment blocked until funnel improves.",
  })

  gates.push({
    id: "sequence.approval",
    channel: "sequence",
    status: "pass",
    message: "Sequence execution requires human job approval (unchanged — no autonomous enrollment).",
  })

  gates.push({
    id: "compliance.orchestration",
    channel: "apollo_import",
    status: compliance ? "pass" : "manual",
    message: compliance
      ? "VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true"
      : "Enable compliance orchestration in production environments.",
  })

  gates.push({
    id: "voice_drop.vd4_cert",
    channel: "voice_drop",
    status: vd4Cert ? "pass" : "blocked",
    message: vd4Cert
      ? "VD-4 live Voice Drop certification signed off."
      : "Voice Drop multichannel path blocked pending VD-4 live certification.",
  })

  gates.push({
    id: "voice_drop.approval",
    channel: "voice_drop",
    status: "pass",
    message: "Voice Drop campaigns and sequence jobs remain approval-gated.",
  })

  gates.push({
    id: "voice_drop.fatigue",
    channel: "voice_drop",
    status: "pass",
    message: "Cross-channel fatigue rules active (cooldown, SMS/call windows, call hours, opt-out).",
  })

  gates.push({
    id: "email.channel",
    channel: "email",
    status: evidence.contact_quality.with_email > 0 ? "pass" : "manual",
    message:
      evidence.contact_quality.with_email > 0
        ? "Email channel available on pilot contacts."
        : "No email on pilot contacts — email sequences unavailable for this cohort.",
  })

  gates.push({
    id: "sms.channel",
    channel: "sms",
    status: evidence.contact_quality.with_phone > 0 ? "pass" : "manual",
    message:
      evidence.contact_quality.with_phone > 0
        ? "Phone present — SMS/call channels potentially available after compliance checks."
        : "No phone on pilot contacts.",
  })

  for (const gate of gates) {
    if (gate.status === "blocked" || gate.status === "fail") {
      blockers.push(`${gate.id}: ${gate.message}`)
    }
  }

  const path_safe_for_controlled_production =
    !evidence.mock &&
    evidence.discovery.contacts_mapped >= 1 &&
    evidence.runtime.errors.length === 0 &&
    evidence.research_pipeline.automated_flow_confirmed &&
    !gates.some((g) => g.status === "fail")

  const voice_drop_production_safe =
    path_safe_for_controlled_production && vd4Cert && evidence.readiness_funnel.sequence_ready > 0

  const assessment = voice_drop_production_safe
    ? "Apollo → research → sequence path is production-safe for controlled rollout; Voice Drop multichannel enabled with VD-4 sign-off."
    : path_safe_for_controlled_production
      ? "Apollo import and sequence enrollment path approved for controlled production; Voice Drop remains blocked until VD-4."
      : "Multichannel path not production-safe — complete live pilot and address blockers."

  return {
    qa_marker: APOLLO_MULTICHANNEL_READINESS_QA_MARKER,
    path_safe_for_controlled_production,
    voice_drop_production_safe,
    gates,
    blockers,
    assessment,
  }
}
