/** Apollo AI-5 outreach channel readiness — assessment only, no send execution. */

import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"

export const APOLLO_OUTREACH_CHANNEL_READINESS_QA_MARKER = "apollo-outreach-channel-readiness-ai-5-v1" as const

export type ApolloOutreachChannelId = "email" | "sms" | "voice_drop" | "calling"

export type ApolloOutreachChannelAssessment = {
  channel: ApolloOutreachChannelId
  eligible: boolean
  status: "ready" | "partial" | "blocked" | "unavailable"
  contacts_with_channel: number
  estimated_sequence_ready_eligible: number
  requirements_met: string[]
  blockers: string[]
}

export type ApolloOutreachChannelReadiness = {
  qa_marker: typeof APOLLO_OUTREACH_CHANNEL_READINESS_QA_MARKER
  mapped_contacts: number
  sequence_ready_contacts: number
  channels: ApolloOutreachChannelAssessment[]
  any_channel_ready: boolean
  summary: string
}

function safeRate(n: number, d: number): number {
  if (d <= 0) return 0
  return n / d
}

function estimateSequenceReadyWithChannel(
  evidence: ApolloLivePilotEvidence,
  channelCount: number,
): number {
  const mapped = Math.max(evidence.discovery.contacts_mapped, 1)
  const seqReady = evidence.readiness_funnel.sequence_ready
  if (seqReady === 0) return 0
  const contactable = Math.max(evidence.readiness_funnel.contactable, 1)
  const channelOnContactable = Math.min(channelCount, contactable)
  return Math.min(seqReady, Math.round(seqReady * safeRate(channelOnContactable, contactable)))
}

export function assessApolloOutreachChannelReadiness(input: {
  evidence: ApolloLivePilotEvidence
  voice_drop_vd4_live_certified?: boolean
  compliance_orchestration_enabled?: boolean
}): ApolloOutreachChannelReadiness {
  const { evidence } = input
  const vd4 = input.voice_drop_vd4_live_certified ?? false
  const compliance = input.compliance_orchestration_enabled ?? false
  const cq = evidence.contact_quality
  const mapped = evidence.discovery.contacts_mapped
  const seqReady = evidence.readiness_funnel.sequence_ready

  const emailBlockers: string[] = []
  if (cq.with_email === 0) emailBlockers.push("No email on mapped contacts")
  if (cq.with_verified_email === 0 && cq.with_email > 0) {
    emailBlockers.push("No verified emails — deliverability risk")
  }

  const smsBlockers: string[] = []
  if (cq.with_phone === 0) smsBlockers.push("No mobile/phone on mapped contacts")
  if (!compliance) smsBlockers.push("Compliance orchestration not confirmed for SMS")

  const voiceBlockers: string[] = [...smsBlockers]
  if (!vd4) voiceBlockers.push("Voice Drop blocked pending VD-4 live certification")

  const callBlockers: string[] = []
  if (cq.with_phone === 0) callBlockers.push("No callable number on mapped contacts")
  if (!compliance) callBlockers.push("Compliance orchestration not confirmed for calling")

  const channels: ApolloOutreachChannelAssessment[] = [
    {
      channel: "email",
      eligible: cq.with_email > 0 && seqReady > 0,
      status:
        cq.with_email === 0
          ? "unavailable"
          : cq.with_verified_email > 0 && seqReady > 0
            ? "ready"
            : cq.with_email > 0
              ? "partial"
              : "blocked",
      contacts_with_channel: cq.with_email,
      estimated_sequence_ready_eligible: estimateSequenceReadyWithChannel(evidence, cq.with_email),
      requirements_met: [
        cq.with_email > 0 ? "Email present on mapped contacts" : "",
        cq.with_verified_email > 0 ? "Verified email available" : "",
        seqReady > 0 ? "Sequence-ready cohort exists" : "",
      ].filter(Boolean),
      blockers: emailBlockers,
    },
    {
      channel: "sms",
      eligible: cq.with_phone > 0 && compliance && seqReady > 0,
      status:
        cq.with_phone === 0
          ? "unavailable"
          : compliance && seqReady > 0
            ? "ready"
            : cq.with_phone > 0
              ? "partial"
              : "blocked",
      contacts_with_channel: cq.with_phone,
      estimated_sequence_ready_eligible: estimateSequenceReadyWithChannel(evidence, cq.with_phone),
      requirements_met: [
        cq.with_phone > 0 ? "Phone/mobile present" : "",
        compliance ? "Compliance orchestration enabled" : "",
      ].filter(Boolean),
      blockers: smsBlockers,
    },
    {
      channel: "voice_drop",
      eligible: cq.with_phone > 0 && vd4 && compliance && seqReady > 0,
      status:
        cq.with_phone === 0
          ? "unavailable"
          : !vd4
            ? "blocked"
            : compliance && seqReady > 0
              ? "ready"
              : "partial",
      contacts_with_channel: cq.with_phone,
      estimated_sequence_ready_eligible: vd4
        ? estimateSequenceReadyWithChannel(evidence, cq.with_phone)
        : 0,
      requirements_met: [
        cq.with_phone > 0 ? "Phone present for Voice Drop" : "",
        vd4 ? "VD-4 live certification signed off" : "",
        "Voice Drop approval and fatigue gates active in code",
      ].filter(Boolean),
      blockers: voiceBlockers,
    },
    {
      channel: "calling",
      eligible: cq.with_phone > 0 && compliance && seqReady > 0,
      status:
        cq.with_phone === 0
          ? "unavailable"
          : compliance && seqReady > 0
            ? "ready"
            : cq.with_phone > 0
              ? "partial"
              : "blocked",
      contacts_with_channel: cq.with_phone,
      estimated_sequence_ready_eligible: estimateSequenceReadyWithChannel(evidence, cq.with_phone),
      requirements_met: [
        cq.with_phone > 0 ? "Callable number present" : "",
        compliance ? "Compliance orchestration enabled" : "",
      ].filter(Boolean),
      blockers: callBlockers,
    },
  ]

  const any_channel_ready = channels.some((c) => c.status === "ready")

  const readyChannels = channels.filter((c) => c.status === "ready").map((c) => c.channel)
  const summary =
    seqReady === 0
      ? "No sequence-ready contacts — all outreach channels blocked for enrollment."
      : any_channel_ready
        ? `Sequence-ready cohort eligible for: ${readyChannels.join(", ")}. Assessment only — no outreach executed.`
        : `Channels partially available on ${mapped} mapped contacts; address blockers before first enrollment.`

  return {
    qa_marker: APOLLO_OUTREACH_CHANNEL_READINESS_QA_MARKER,
    mapped_contacts: mapped,
    sequence_ready_contacts: seqReady,
    channels,
    any_channel_ready,
    summary,
  }
}
