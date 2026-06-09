/** Apollo AI-4 live pilot dry-run — no Apollo API calls. Client-safe. */

import { buildApolloLivePilotEnvReadinessReport } from "@/lib/growth/apollo/apollo-live-pilot-env-readiness"
import { buildApolloActivationReport } from "@/lib/growth/apollo/apollo-integration-activation"
import { buildApolloLivePilotSafetyReport } from "@/lib/growth/apollo/apollo-live-pilot-safety"
import {
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
  resolveApolloCreditLimits,
} from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_LIVE_PILOT_DRY_RUN_QA_MARKER = "apollo-live-pilot-dry-run-ai-4-v1" as const

export type ApolloLivePilotDryRunTargetCompany = {
  company_candidate_id: string
  company_name: string
  domain: string | null
  canonical_company_id: string | null
  existing_apollo_contacts: number | null
  suitable: boolean
  suitability_notes: string[]
}

export type ApolloLivePilotDryRunReport = {
  qa_marker: typeof APOLLO_LIVE_PILOT_DRY_RUN_QA_MARKER
  generated_at: string
  will_call_apollo_api: false
  target_company: ApolloLivePilotDryRunTargetCompany | null
  env_readiness: ReturnType<typeof buildApolloLivePilotEnvReadinessReport>
  safety: ReturnType<typeof buildApolloLivePilotSafetyReport>
  gates: {
    mock_mode: boolean
    live_mode: boolean
    enrichment_enabled: boolean
    enrichment_ack: boolean
    pilot_enabled: boolean
    benchmark_ack: boolean
    kill_switch: boolean
  }
  caps: {
    max_companies_this_run: 1
    max_contacts_per_company: number
    max_api_calls_per_run: number
    default_contact_limit: number
  }
  credit_risk: {
    search_only_credits: number
    enrichment_credits_if_enabled: string
    estimated_total_credits: number
    risk_level: "none" | "low" | "medium" | "high"
    notes: string[]
  }
  ready_to_execute_live: boolean
  blockers: string[]
}

export function buildApolloLivePilotDryRunReport(input: {
  env?: NodeJS.ProcessEnv
  target_company?: ApolloLivePilotDryRunTargetCompany | null
  nowIso?: string
}): ApolloLivePilotDryRunReport {
  const env = input.env ?? process.env
  const env_readiness = buildApolloLivePilotEnvReadinessReport(env, input.nowIso)
  const safety = buildApolloLivePilotSafetyReport(env)
  const activation = buildApolloActivationReport(env)
  const limits = resolveApolloCreditLimits(env)
  const mock = isApolloMockEnabled(env)
  const enrich = isApolloEmailEnrichmentEnabled(env)
  const enrichAck = env.GROWTH_APOLLO_ENRICH_EMAILS_ACK === "1"

  const blockers = [...env_readiness.blockers]
  if (input.target_company && !input.target_company.suitable) {
    blockers.push(`Test company not suitable: ${input.target_company.suitability_notes.join("; ")}`)
  }
  if (!input.target_company && !env_readiness.company_candidate_id) {
    blockers.push("No target company — run pnpm select:apollo-live-pilot-test-company-ai-4")
  }

  const searchCredits = 0
  let enrichmentNote = "Disabled — search-only pilot (0 enrichment credits)."
  let estimatedCredits = 0
  let riskLevel: ApolloLivePilotDryRunReport["credit_risk"]["risk_level"] = "none"

  if (enrich && enrichAck) {
    enrichmentNote = "Enabled — bulk_match may consume credits per batch."
    estimatedCredits = 1
    riskLevel = "medium"
    blockers.push("First pilot should keep GROWTH_APOLLO_ENRICH_EMAILS=false")
  } else if (enrich) {
    enrichmentNote = "Blocked — enrichment flag set without ACK."
  }

  if (mock) {
    blockers.push("Dry-run OK but live execution blocked: mock mode enabled.")
  }

  const ready_to_execute_live =
    env_readiness.ready_for_live_pilot &&
    safety.all_enforced &&
    (!input.target_company || input.target_company.suitable) &&
    blockers.filter((b) => !b.includes("mock mode")).length === 0

  return {
    qa_marker: APOLLO_LIVE_PILOT_DRY_RUN_QA_MARKER,
    generated_at: input.nowIso ?? new Date().toISOString(),
    will_call_apollo_api: false,
    target_company: input.target_company ?? null,
    env_readiness,
    safety,
    gates: {
      mock_mode: mock,
      live_mode: activation.mode === "live_search" || activation.mode === "live_enrichment",
      enrichment_enabled: enrich,
      enrichment_ack: enrichAck,
      pilot_enabled:
        env.GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED === "true" ||
        env.GROWTH_APOLLO_AI_4_LIVE_PILOT_ENABLED === "true",
      benchmark_ack: env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK === "1",
      kill_switch: env.GROWTH_DISCOVERY_DISABLE_APOLLO === "1",
    },
    caps: {
      max_companies_this_run: 1,
      max_contacts_per_company: limits.max_contacts_per_company,
      max_api_calls_per_run: limits.max_api_calls_per_run,
      default_contact_limit: 10,
    },
    credit_risk: {
      search_only_credits: searchCredits,
      enrichment_credits_if_enabled: enrichmentNote,
      estimated_total_credits: estimatedCredits,
      risk_level: riskLevel,
      notes: [
        "mixed_people/api_search is search-only (0 credits by default).",
        "Pilot processes one company and ~10 contacts unless limit overridden.",
      ],
    },
    ready_to_execute_live: ready_to_execute_live && !mock,
    blockers: [...new Set(blockers)],
  }
}

export function formatApolloLivePilotDryRunMarkdown(report: ApolloLivePilotDryRunReport): string {
  const tc = report.target_company
  return [
    "# Apollo Live Pilot — Dry Run (no API calls)",
    "",
    `Generated: ${report.generated_at}`,
    `Ready to execute live: **${report.ready_to_execute_live ? "YES" : "NO"}**`,
    "",
    "## Target company",
    "",
    tc
      ? `- Name: ${tc.company_name}\n- Candidate ID: ${tc.company_candidate_id}\n- Domain: ${tc.domain ?? "(none)"}\n- Existing Apollo contacts: ${tc.existing_apollo_contacts ?? "unknown"}\n- Suitable: ${tc.suitable}`
      : "- Not loaded — set GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID or run company selector",
    "",
    "## Gates",
    "",
    `- Mock: ${report.gates.mock_mode}`,
    `- Live mode: ${report.gates.live_mode}`,
    `- Enrichment: ${report.gates.enrichment_enabled}`,
    `- Benchmark ACK: ${report.gates.benchmark_ack}`,
    `- Kill switch: ${report.gates.kill_switch}`,
    "",
    "## Caps",
    "",
    `- Companies this run: ${report.caps.max_companies_this_run}`,
    `- Max contacts/company: ${report.caps.max_contacts_per_company}`,
    `- Max API calls/run: ${report.caps.max_api_calls_per_run}`,
    `- Default contact limit: ${report.caps.default_contact_limit}`,
    "",
    "## Credit risk",
    "",
    `- Search credits: ${report.credit_risk.search_only_credits}`,
    `- ${report.credit_risk.enrichment_credits_if_enabled}`,
    `- Risk: ${report.credit_risk.risk_level}`,
    "",
    report.blockers.length > 0
      ? `## Blockers\n\n${report.blockers.map((b) => `- ${b}`).join("\n")}`
      : "## Blockers\n\nNone",
  ].join("\n")
}
