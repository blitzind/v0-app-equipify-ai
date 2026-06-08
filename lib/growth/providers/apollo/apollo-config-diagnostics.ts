/** Phase 7.PCA-3 — Apollo env validation and ambiguous-state diagnostics. Client-safe. */

import {
  getApolloApiKey,
  isApolloContactDiscoveryEnabled,
  isApolloDiscoveryDisabled,
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
  isApolloProviderConfigured,
  resolveApolloCreditLimits,
} from "@/lib/growth/providers/apollo/apollo-config"

export const GROWTH_APOLLO_CONFIG_DIAGNOSTICS_QA_MARKER =
  "growth-apollo-config-diagnostics-7-pca-3-v1" as const

export type ApolloConfigDiagnosticIssue = {
  code: string
  severity: "error" | "warning" | "info"
  message: string
}

export type ApolloConfigDiagnostics = {
  qa_marker: typeof GROWTH_APOLLO_CONFIG_DIAGNOSTICS_QA_MARKER
  ready_for_live_search: boolean
  ready_for_live_benchmark: boolean
  ready_for_enrichment: boolean
  mock_mode: boolean
  enrich_emails: boolean
  apollo_enabled: boolean
  apollo_disabled_flag: boolean
  api_key_present: boolean
  api_key_source: "APOLLO_API_KEY" | "GROWTH_APOLLO_API_KEY" | null
  credit_limits: ReturnType<typeof resolveApolloCreditLimits>
  issues: ApolloConfigDiagnosticIssue[]
}

function apiKeySource(env: NodeJS.ProcessEnv): ApolloConfigDiagnostics["api_key_source"] {
  if (env.APOLLO_API_KEY?.trim()) return "APOLLO_API_KEY"
  if (env.GROWTH_APOLLO_API_KEY?.trim()) return "GROWTH_APOLLO_API_KEY"
  return null
}

export function diagnoseApolloContactDiscoveryConfig(
  env: NodeJS.ProcessEnv = process.env,
): ApolloConfigDiagnostics {
  const issues: ApolloConfigDiagnosticIssue[] = []
  const mock_mode = isApolloMockEnabled(env)
  const enrich_emails = isApolloEmailEnrichmentEnabled(env)
  const apollo_enabled = isApolloContactDiscoveryEnabled(env)
  const apollo_disabled_flag = isApolloDiscoveryDisabled(env)
  const api_key_present = Boolean(getApolloApiKey(env))
  const credit_limits = resolveApolloCreditLimits(env)

  if (apollo_disabled_flag) {
    issues.push({
      code: "apollo_discovery_disabled",
      severity: "error",
      message: "GROWTH_DISCOVERY_DISABLE_APOLLO=1 — Apollo will not run.",
    })
  }

  if (!apollo_enabled) {
    issues.push({
      code: "apollo_not_enabled",
      severity: "warning",
      message: "Set GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true to activate Apollo.",
    })
  }

  if (mock_mode && api_key_present) {
    issues.push({
      code: "mock_overrides_live_key",
      severity: "warning",
      message: "GROWTH_APOLLO_USE_MOCK=true with API key present — mock mode wins; no live HTTP.",
    })
  }

  if (!mock_mode && !api_key_present) {
    issues.push({
      code: "missing_api_key",
      severity: "error",
      message: "Live Apollo requires APOLLO_API_KEY or GROWTH_APOLLO_API_KEY.",
    })
  }

  const mockEnvRaw = env.GROWTH_APOLLO_USE_MOCK?.trim().toLowerCase()
  if (mockEnvRaw && !["0", "1", "true", "false", "yes", "no"].includes(mockEnvRaw)) {
    issues.push({
      code: "ambiguous_mock_flag",
      severity: "warning",
      message: `GROWTH_APOLLO_USE_MOCK=${mockEnvRaw} is ambiguous — treated as enabled.`,
    })
  }

  const enrichRaw = env.GROWTH_APOLLO_ENRICH_EMAILS?.trim().toLowerCase()
  if (enrichRaw && !["0", "1", "true", "false", "yes", "no"].includes(enrichRaw)) {
    issues.push({
      code: "ambiguous_enrich_flag",
      severity: "warning",
      message: `GROWTH_APOLLO_ENRICH_EMAILS=${enrichRaw} is ambiguous.`,
    })
  }

  if (enrich_emails && mock_mode) {
    issues.push({
      code: "enrich_with_mock",
      severity: "warning",
      message: "Email enrichment flag set while mock mode is on — enrichment will not call bulk_match.",
    })
  }

  if (enrich_emails && env.GROWTH_APOLLO_ENRICH_EMAILS_ACK !== "1") {
    issues.push({
      code: "enrichment_ack_missing",
      severity: "warning",
      message: "GROWTH_APOLLO_ENRICH_EMAILS=true requires GROWTH_APOLLO_ENRICH_EMAILS_ACK=1 for benchmark/live runs.",
    })
  }

  const ready_for_live_search =
    !apollo_disabled_flag &&
    apollo_enabled &&
    !mock_mode &&
    api_key_present &&
    !issues.some((i) => i.severity === "error")

  const live_benchmark_ack = env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK === "1"
  if (!live_benchmark_ack && ready_for_live_search) {
    issues.push({
      code: "live_benchmark_ack_missing",
      severity: "info",
      message: "Live benchmark requires GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1 to prevent accidental credit usage.",
    })
  }

  const ready_for_live_benchmark = ready_for_live_search && live_benchmark_ack

  const ready_for_enrichment =
    ready_for_live_search &&
    enrich_emails &&
    env.GROWTH_APOLLO_ENRICH_EMAILS_ACK === "1"

  if (!isApolloProviderConfigured(env) && !mock_mode) {
    issues.push({
      code: "provider_not_configured",
      severity: "info",
      message: "Apollo provider isConfigured() is false with current env.",
    })
  }

  return {
    qa_marker: GROWTH_APOLLO_CONFIG_DIAGNOSTICS_QA_MARKER,
    ready_for_live_search,
    ready_for_live_benchmark,
    ready_for_enrichment,
    mock_mode,
    enrich_emails,
    apollo_enabled,
    apollo_disabled_flag,
    api_key_present,
    api_key_source: apiKeySource(env),
    credit_limits,
    issues,
  }
}

export function assertApolloLiveBenchmarkAllowed(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean
  diagnostics: ApolloConfigDiagnostics
  error: string | null
} {
  const diagnostics = diagnoseApolloContactDiscoveryConfig(env)
  if (diagnostics.mock_mode) {
    return { ok: false, diagnostics, error: "Live benchmark refused: GROWTH_APOLLO_USE_MOCK is enabled." }
  }
  if (diagnostics.enrich_emails && env.GROWTH_APOLLO_ENRICH_EMAILS_ACK !== "1") {
    return {
      ok: false,
      diagnostics,
      error: "Live benchmark refused: enrichment enabled without GROWTH_APOLLO_ENRICH_EMAILS_ACK=1.",
    }
  }
  if (!diagnostics.ready_for_live_benchmark) {
    const blocking = diagnostics.issues.filter((i) => i.severity === "error").map((i) => i.message)
    return {
      ok: false,
      diagnostics,
      error:
        blocking.join(" ") ||
        "Live benchmark refused: set GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1 and valid Apollo env.",
    }
  }
  return { ok: true, diagnostics, error: null }
}
