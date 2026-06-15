/** Phase GE-OPS-1 — Apollo readiness audit (client-safe). */

import fs from "node:fs"
import path from "node:path"
import { diagnoseApolloContactDiscoveryConfig } from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import { APOLLO_BULK_MATCH_BATCH_SIZE } from "@/lib/growth/providers/apollo/apollo-config"
import type { ApolloReadinessReport, OpsFinding } from "@/lib/growth/e2e/growth-engine-ops-types"

const APOLLO_INTEGRATION_POINTS = [
  "lib/growth/providers/apollo/apollo-config.ts",
  "lib/growth/providers/apollo/apollo-client.ts",
  "lib/growth/providers/apollo/apollo-enrich-people.ts",
  "lib/growth/providers/apollo/apollo-run-guardrails.ts",
  "lib/growth/providers/apollo/map-apollo-contact.ts",
  "lib/growth/apollo/apollo-primary-contact-acquisition.ts",
  "lib/growth/apollo/apollo-import-readiness.ts",
  "lib/growth/prospect-discovery/prospect-provider-selection.ts",
  "lib/growth/prospect-search/prospect-search-human-acquisition.ts",
  "lib/growth/signal-intelligence/signal-event-dedupe.ts",
] as const

export function auditApolloIntegrationPoints(cwd = process.cwd()): {
  verified: number
  total: number
  findings: OpsFinding[]
} {
  const findings: OpsFinding[] = []
  let verified = 0

  for (const relativePath of APOLLO_INTEGRATION_POINTS) {
    const absolutePath = path.join(cwd, relativePath)
    if (!fs.existsSync(absolutePath)) {
      findings.push({
        finding_id: `apollo_missing_${relativePath.replace(/\//g, "_")}`,
        severity: "critical",
        category: "apollo",
        description: `Missing Apollo integration file: ${relativePath}`,
        remediation: "Restore integration file before Apollo dogfooding",
      })
      continue
    }
    verified += 1

    const source = fs.readFileSync(absolutePath, "utf8")
    if (relativePath.includes("apollo-client") && !source.includes("429")) {
      findings.push({
        finding_id: "apollo_rate_limit_handling",
        severity: "warning",
        category: "apollo",
        description: "Apollo client may lack explicit 429 rate-limit handling",
        remediation: "Verify isApolloRateLimitError and retry backoff in apollo-client.ts",
      })
    }
    if (relativePath.includes("map-apollo-contact") && !source.includes("duplicate")) {
      findings.push({
        finding_id: "apollo_duplicate_prevention",
        severity: "warning",
        category: "apollo",
        description: "Apollo contact mapper may lack duplicate prevention",
        remediation: "Verify in-run dedupe by name|email|title",
      })
    }
    if (relativePath.includes("apollo-enrich-people") && !source.includes("APOLLO_BULK_MATCH_BATCH_SIZE")) {
      findings.push({
        finding_id: "apollo_batch_size",
        severity: "info",
        category: "apollo",
        description: "Enrichment batching should use APOLLO_BULK_MATCH_BATCH_SIZE",
        remediation: `Batch bulk_match calls in groups of ${APOLLO_BULK_MATCH_BATCH_SIZE}`,
      })
    }
  }

  return { verified, total: APOLLO_INTEGRATION_POINTS.length, findings }
}

export function buildApolloReadinessReport(env: NodeJS.ProcessEnv = process.env): ApolloReadinessReport {
  const diagnostics = diagnoseApolloContactDiscoveryConfig(env)
  const integration = auditApolloIntegrationPoints()

  const recommendations: string[] = []

  if (diagnostics.mock_mode) {
    recommendations.push("Production dogfooding requires GROWTH_APOLLO_USE_MOCK=false with valid API key.")
  }
  if (!diagnostics.api_key_present && !diagnostics.mock_mode) {
    recommendations.push("Configure APOLLO_API_KEY or GROWTH_APOLLO_API_KEY in Vercel Production env.")
  }
  if (!diagnostics.ready_for_live_benchmark) {
    recommendations.push(
      "Set GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1 before live benchmark runs to prevent accidental credit usage.",
    )
  }
  if (diagnostics.enrich_emails && !diagnostics.ready_for_enrichment) {
    recommendations.push("Email enrichment requires GROWTH_APOLLO_ENRICH_EMAILS_ACK=1 in production.")
  }
  recommendations.push(
    `Credit strategy: max ${diagnostics.credit_limits.max_companies_per_run} companies/run, ${diagnostics.credit_limits.max_api_calls_per_run} API calls/run, bulk_match batches of ${APOLLO_BULK_MATCH_BATCH_SIZE}.`,
  )
  recommendations.push(
    "Use beginApolloRunGuardrails() per acquisition run; never bypass GROWTH_DISCOVERY_DISABLE_APOLLO kill switch.",
  )
  if (integration.findings.some((f) => f.severity === "critical")) {
    recommendations.push("Fix missing Apollo integration files before Equipify sales dogfooding.")
  }

  return {
    ready_for_live_search: diagnostics.ready_for_live_search,
    ready_for_live_benchmark: diagnostics.ready_for_live_benchmark,
    ready_for_enrichment: diagnostics.ready_for_enrichment,
    mock_mode: diagnostics.mock_mode,
    api_key_present: diagnostics.api_key_present,
    api_key_source: diagnostics.api_key_source,
    credit_limits: {
      max_companies_per_run: diagnostics.credit_limits.max_companies_per_run,
      max_api_calls_per_run: diagnostics.credit_limits.max_api_calls_per_run,
      max_enrichment_batches_per_run: diagnostics.credit_limits.max_enrichment_batches_per_run,
      max_contacts_per_company: diagnostics.credit_limits.max_contacts_per_company,
    },
    integration_points_verified: integration.verified,
    integration_points_total: integration.total,
    issues: diagnostics.issues.map((i) => ({
      code: i.code,
      severity: i.severity,
      message: i.message,
    })),
    recommendations,
  }
}

export function apolloReadinessFindings(report: ApolloReadinessReport): OpsFinding[] {
  const findings: OpsFinding[] = []

  for (const issue of report.issues.filter((i) => i.severity === "error")) {
    if (issue.code === "missing_api_key" || issue.code === "apollo_not_enabled") {
      findings.push({
        finding_id: `apollo_${issue.code}`,
        severity: "warning",
        category: "apollo",
        description: issue.message,
        remediation: "Configure Apollo env in Vercel Production before live import dogfooding",
      })
      continue
    }
    findings.push({
      finding_id: `apollo_${issue.code}`,
      severity: "critical",
      category: "apollo",
      description: issue.message,
      remediation: "Resolve Apollo config issue before live import",
    })
  }

  if (report.integration_points_verified < report.integration_points_total) {
    findings.push({
      finding_id: "apollo_integration_incomplete",
      severity: "critical",
      category: "apollo",
      description: `Only ${report.integration_points_verified}/${report.integration_points_total} integration points verified`,
      remediation: "Restore missing Apollo integration files",
    })
  }

  return findings
}
