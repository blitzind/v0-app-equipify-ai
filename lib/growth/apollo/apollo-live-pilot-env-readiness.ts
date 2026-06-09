/** Apollo AI-4 live pilot environment readiness — client-safe, no secrets. */

import { getApolloApiKey } from "@/lib/growth/providers/apollo/apollo-config"
import {
  diagnoseApolloContactDiscoveryConfig,
  type ApolloConfigDiagnostics,
} from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import { buildApolloActivationReport } from "@/lib/growth/apollo/apollo-integration-activation"

export const APOLLO_LIVE_PILOT_ENV_READINESS_QA_MARKER = "apollo-live-pilot-env-readiness-ai-4-v1" as const

export type ApolloLivePilotEnvCheck = {
  id: string
  variable: string
  required_for_live_pilot: boolean
  satisfied: boolean
  detail: string
}

export type ApolloLivePilotEnvReadinessReport = {
  qa_marker: typeof APOLLO_LIVE_PILOT_ENV_READINESS_QA_MARKER
  checked_at: string
  ready_for_live_pilot: boolean
  ready_for_dry_run: boolean
  apollo_kill_switch_active: boolean
  mock_mode: boolean
  api_key: {
    configured: boolean
    source: "APOLLO_API_KEY" | "GROWTH_APOLLO_API_KEY" | null
  }
  company_candidate_id: string | null
  output_path: string | null
  checks: ApolloLivePilotEnvCheck[]
  config_diagnostics: ApolloConfigDiagnostics
  blockers: string[]
  warnings: string[]
}

function resolveCompanyCandidateId(env: NodeJS.ProcessEnv): string | null {
  return (
    env.GROWTH_APOLLO_AI_4_COMPANY_CANDIDATE_ID?.trim() ||
    env.GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID?.trim() ||
    env.GROWTH_APOLLO_AI_2_COMPANY_CANDIDATE_ID?.trim() ||
    null
  )
}

function resolveOutputPath(env: NodeJS.ProcessEnv): string | null {
  return (
    env.GROWTH_APOLLO_AI_4_OUTPUT_PATH?.trim() ||
    env.GROWTH_APOLLO_AI_3_OUTPUT_PATH?.trim() ||
    env.GROWTH_APOLLO_AI_2_OUTPUT_PATH?.trim() ||
    null
  )
}

function resolvePilotEnabled(env: NodeJS.ProcessEnv): boolean {
  return (
    env.GROWTH_APOLLO_AI_4_LIVE_PILOT_ENABLED === "true" ||
    env.GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED === "true" ||
    env.GROWTH_APOLLO_AI_2_LIVE_PILOT_ENABLED === "true"
  )
}

function apiKeySource(env: NodeJS.ProcessEnv): ApolloLivePilotEnvReadinessReport["api_key"]["source"] {
  if (env.APOLLO_API_KEY?.trim()) return "APOLLO_API_KEY"
  if (env.GROWTH_APOLLO_API_KEY?.trim()) return "GROWTH_APOLLO_API_KEY"
  return null
}

export function buildApolloLivePilotEnvReadinessReport(
  env: NodeJS.ProcessEnv = process.env,
  nowIso?: string,
): ApolloLivePilotEnvReadinessReport {
  const config_diagnostics = diagnoseApolloContactDiscoveryConfig(env)
  const activation = buildApolloActivationReport(env)
  const checks: ApolloLivePilotEnvCheck[] = []
  const blockers: string[] = []
  const warnings: string[] = []

  const apolloEnabled = env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED === "true"
  checks.push({
    id: "apollo_enabled",
    variable: "GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED",
    required_for_live_pilot: true,
    satisfied: apolloEnabled,
    detail: apolloEnabled ? "true" : "Must be true",
  })

  const mockOff = env.GROWTH_APOLLO_USE_MOCK !== "true" && env.GROWTH_APOLLO_USE_MOCK !== "1"
  checks.push({
    id: "mock_disabled",
    variable: "GROWTH_APOLLO_USE_MOCK",
    required_for_live_pilot: true,
    satisfied: mockOff,
    detail: mockOff ? "Mock disabled (live HTTP allowed)" : "Set false for live pilot",
  })

  const keySource = apiKeySource(env)
  const keyConfigured = Boolean(getApolloApiKey(env))
  checks.push({
    id: "api_key",
    variable: "APOLLO_API_KEY | GROWTH_APOLLO_API_KEY",
    required_for_live_pilot: true,
    satisfied: keyConfigured,
    detail: keyConfigured ? `Configured via ${keySource}` : "API key missing",
  })

  const benchmarkAck = env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK === "1"
  checks.push({
    id: "benchmark_ack",
    variable: "GROWTH_APOLLO_LIVE_BENCHMARK_ACK",
    required_for_live_pilot: true,
    satisfied: benchmarkAck,
    detail: benchmarkAck ? "ACK=1" : "Set to 1 before live pilot",
  })

  const pilotEnabled = resolvePilotEnabled(env)
  checks.push({
    id: "pilot_enabled",
    variable: "GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED",
    required_for_live_pilot: true,
    satisfied: pilotEnabled,
    detail: pilotEnabled ? "Live pilot flag enabled" : "Set GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=true",
  })

  const companyId = resolveCompanyCandidateId(env)
  checks.push({
    id: "company_candidate_id",
    variable: "GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID",
    required_for_live_pilot: true,
    satisfied: Boolean(companyId),
    detail: companyId ? `Set (${companyId.slice(0, 8)}…)` : "Select one test company UUID",
  })

  const outputPath = resolveOutputPath(env)
  checks.push({
    id: "output_path",
    variable: "GROWTH_APOLLO_AI_3_OUTPUT_PATH",
    required_for_live_pilot: false,
    satisfied: Boolean(outputPath),
    detail: outputPath ?? "Recommended: ./evidence/apollo-ai-3-pilot.json",
  })

  const killSwitch = env.GROWTH_DISCOVERY_DISABLE_APOLLO === "1"
  checks.push({
    id: "kill_switch",
    variable: "GROWTH_DISCOVERY_DISABLE_APOLLO",
    required_for_live_pilot: true,
    satisfied: !killSwitch,
    detail: killSwitch ? "Kill switch active — Apollo blocked" : "Not set (OK)",
  })

  const enrichEnabled = activation.ready_for_enrichment
  checks.push({
    id: "enrichment_disabled",
    variable: "GROWTH_APOLLO_ENRICH_EMAILS",
    required_for_live_pilot: true,
    satisfied: !enrichEnabled,
    detail: enrichEnabled
      ? "Enrichment enabled — requires GROWTH_APOLLO_ENRICH_EMAILS_ACK=1 and consumes credits"
      : "Enrichment disabled (recommended for first pilot)",
  })

  for (const check of checks) {
    if (check.required_for_live_pilot && !check.satisfied) {
      blockers.push(`${check.variable}: ${check.detail}`)
    } else if (!check.satisfied) {
      warnings.push(`${check.variable}: ${check.detail}`)
    }
  }

  if (config_diagnostics.mock_mode) {
    blockers.push("GROWTH_APOLLO_USE_MOCK is enabled — live pilot will not call Apollo.")
  }

  const ready_for_live_pilot =
    blockers.length === 0 &&
    activation.ready_for_live_benchmark &&
    Boolean(companyId) &&
    pilotEnabled

  return {
    qa_marker: APOLLO_LIVE_PILOT_ENV_READINESS_QA_MARKER,
    checked_at: nowIso ?? new Date().toISOString(),
    ready_for_live_pilot,
    ready_for_dry_run: Boolean(companyId) || true,
    apollo_kill_switch_active: killSwitch,
    mock_mode: config_diagnostics.mock_mode,
    api_key: { configured: keyConfigured, source: keySource },
    company_candidate_id: companyId,
    output_path: outputPath,
    checks,
    config_diagnostics,
    blockers,
    warnings,
  }
}

export function formatApolloLivePilotEnvReadinessMarkdown(
  report: ApolloLivePilotEnvReadinessReport,
): string {
  const lines = [
    "# Apollo Live Pilot — Environment Readiness",
    "",
    `Checked at: ${report.checked_at}`,
    `Ready for live pilot: **${report.ready_for_live_pilot ? "YES" : "NO"}**`,
    "",
    "## Summary (no secrets)",
    "",
    `- Apollo enabled: ${report.checks.find((c) => c.id === "apollo_enabled")?.satisfied}`,
    `- Mock mode: ${report.mock_mode}`,
    `- API key configured: ${report.api_key.configured}${report.api_key.source ? ` (${report.api_key.source})` : ""}`,
    `- Kill switch: ${report.apollo_kill_switch_active ? "ACTIVE" : "off"}`,
    `- Company candidate: ${report.company_candidate_id ? `${report.company_candidate_id.slice(0, 8)}…` : "(not set)"}`,
    `- Output path: ${report.output_path ?? "(not set)"}`,
    "",
    "## Checks",
    "",
    "| Variable | Required | OK | Detail |",
    "|----------|----------|-----|--------|",
    ...report.checks.map(
      (c) =>
        `| ${c.variable} | ${c.required_for_live_pilot} | ${c.satisfied} | ${c.detail} |`,
    ),
  ]

  if (report.blockers.length > 0) {
    lines.push("", "## Blockers", "", ...report.blockers.map((b) => `- ${b}`))
  }
  if (report.warnings.length > 0) {
    lines.push("", "## Warnings", "", ...report.warnings.map((w) => `- ${w}`))
  }

  return lines.join("\n")
}
