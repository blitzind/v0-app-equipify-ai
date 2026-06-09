/** Apollo AI-4 live pilot safety gates — client-safe confirmation. */

import { VOICE_DROP_APPROVAL_REQUIRED, VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED } from "@/lib/voice/voice-drops/types"
import {
  isApolloContactDiscoveryEnabled,
  isApolloDiscoveryDisabled,
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
  resolveApolloCreditLimits,
} from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_LIVE_PILOT_SAFETY_QA_MARKER = "apollo-live-pilot-safety-ai-4-v1" as const

export type ApolloLivePilotSafetyGate = {
  id: string
  enforced: boolean
  detail: string
}

export type ApolloLivePilotSafetyReport = {
  qa_marker: typeof APOLLO_LIVE_PILOT_SAFETY_QA_MARKER
  gates: ApolloLivePilotSafetyGate[]
  all_enforced: boolean
  outreach_triggered_by_pilot: false
  bulk_enrollment_blocked: true
}

export function buildApolloLivePilotSafetyReport(env: NodeJS.ProcessEnv = process.env): ApolloLivePilotSafetyReport {
  const mock = isApolloMockEnabled(env)
  const enrich = isApolloEmailEnrichmentEnabled(env)
  const enrichAck = env.GROWTH_APOLLO_ENRICH_EMAILS_ACK === "1"
  const benchmarkAck = env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK === "1"
  const limits = resolveApolloCreditLimits(env)

  const gates: ApolloLivePilotSafetyGate[] = [
    {
      id: "mock_blocks_http",
      enforced: true,
      detail: mock
        ? "GROWTH_APOLLO_USE_MOCK=true — Apollo client uses fixtures only, no HTTP."
        : "Mock disabled — live HTTP requires API key + benchmark ACK.",
    },
    {
      id: "live_requires_benchmark_ack",
      enforced: !mock,
      detail: mock
        ? "N/A in mock mode"
        : benchmarkAck
          ? "GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1"
          : "Live pilot blocked without GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1",
    },
    {
      id: "single_company_only",
      enforced: true,
      detail: "Pilot runner processes exactly one GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID per invocation.",
    },
    {
      id: "contact_limit_cap",
      enforced: true,
      detail: `Default contact limit 10; hard cap ${limits.max_contacts_per_company} per company.`,
    },
    {
      id: "enrichment_ack",
      enforced: !enrich || enrichAck,
      detail: enrich
        ? enrichAck
          ? "Enrichment enabled with ACK"
          : "Enrichment blocked without GROWTH_APOLLO_ENRICH_EMAILS_ACK=1"
        : "Email enrichment disabled (recommended)",
    },
    {
      id: "bulk_enrollment_blocked",
      enforced: true,
      detail: "AI-3 certification always sets approved_for_bulk_enrollment=false.",
    },
    {
      id: "no_sequence_enrollment",
      enforced: true,
      detail: "Pilot runs discovery → sync → canonical backfill only — no sequence enrollment.",
    },
    {
      id: "no_outreach_send",
      enforced: true,
      detail: "Pilot does not queue email, SMS, voice drop, or call execution jobs.",
    },
    {
      id: "voice_drop_autonomous_disabled",
      enforced: VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED,
      detail: "VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED remains true in code.",
    },
    {
      id: "voice_drop_approval_required",
      enforced: VOICE_DROP_APPROVAL_REQUIRED,
      detail: "VOICE_DROP_APPROVAL_REQUIRED remains true in code.",
    },
    {
      id: "apollo_kill_switch",
      enforced: !isApolloDiscoveryDisabled(env),
      detail: isApolloDiscoveryDisabled(env)
        ? "GROWTH_DISCOVERY_DISABLE_APOLLO=1 — Apollo skipped"
        : "Kill switch off",
    },
    {
      id: "apollo_master_enable",
      enforced: isApolloContactDiscoveryEnabled(env),
      detail: isApolloContactDiscoveryEnabled(env)
        ? "GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true"
        : "Apollo master switch off",
    },
  ]

  const all_enforced = gates.every((g) => g.enforced)

  return {
    qa_marker: APOLLO_LIVE_PILOT_SAFETY_QA_MARKER,
    gates,
    all_enforced,
    outreach_triggered_by_pilot: false,
    bulk_enrollment_blocked: true,
  }
}
