/** GE-PROVIDERS-1A — PDL env validation and ambiguous-state diagnostics. Client-safe. */

import {
  getPdlApiKey,
  isPdlContactDiscoveryEnabled,
  isPdlDiscoveryDisabled,
  isPdlMockEnabled,
  isPdlProviderConfigured,
  isPdlSandboxEnabled,
  resolvePdlCreditLimits,
  resolvePdlSandboxEnvConfig,
} from "@/lib/growth/providers/pdl/pdl-config"

export const GROWTH_PDL_CONFIG_DIAGNOSTICS_QA_MARKER =
  "growth-pdl-config-diagnostics-ge-providers-1a-v1" as const

export type PdlConfigDiagnosticIssue = {
  code: string
  severity: "error" | "warning" | "info"
  message: string
}

export type PdlConfigDiagnostics = {
  qa_marker: typeof GROWTH_PDL_CONFIG_DIAGNOSTICS_QA_MARKER
  ready_for_live_search: boolean
  ready_for_live_benchmark: boolean
  ready_for_enrichment: boolean
  mock_mode: boolean
  sandbox_mode: boolean
  pdl_enabled: boolean
  pdl_disabled_flag: boolean
  api_key_present: boolean
  api_key_source: "PEOPLE_DATA_LABS_API_KEY" | "PDL_API_KEY" | null
  credit_limits: ReturnType<typeof resolvePdlCreditLimits>
  issues: PdlConfigDiagnosticIssue[]
}

function apiKeySource(env: NodeJS.ProcessEnv): PdlConfigDiagnostics["api_key_source"] {
  if (env.PEOPLE_DATA_LABS_API_KEY?.trim()) return "PEOPLE_DATA_LABS_API_KEY"
  if (env.PDL_API_KEY?.trim()) return "PDL_API_KEY"
  return null
}

export function diagnosePdlContactDiscoveryConfig(
  env: NodeJS.ProcessEnv = process.env,
): PdlConfigDiagnostics {
  const issues: PdlConfigDiagnosticIssue[] = []
  const mock_mode = isPdlMockEnabled(env)
  const sandbox_mode = isPdlSandboxEnabled(env)
  const sandbox_config = resolvePdlSandboxEnvConfig(env)
  const pdl_enabled = isPdlContactDiscoveryEnabled(env)
  const pdl_disabled_flag = isPdlDiscoveryDisabled(env)
  const api_key_present = Boolean(getPdlApiKey(env))
  const credit_limits = resolvePdlCreditLimits(env)

  if (pdl_disabled_flag) {
    issues.push({
      code: "pdl_discovery_disabled",
      severity: "error",
      message: "GROWTH_DISCOVERY_DISABLE_PDL=1 — PDL will not run.",
    })
  }

  if (!pdl_enabled) {
    issues.push({
      code: "pdl_not_enabled",
      severity: "warning",
      message: "Set GROWTH_CONTACT_DISCOVERY_PDL_ENABLED=true to activate PDL.",
    })
  }

  if (mock_mode && api_key_present) {
    issues.push({
      code: "mock_overrides_live_key",
      severity: "warning",
      message: "GROWTH_PDL_USE_MOCK=true with API key present — mock mode wins; no live HTTP.",
    })
  }

  if (!mock_mode && !api_key_present) {
    issues.push({
      code: "missing_api_key",
      severity: "error",
      message: "Live PDL requires PEOPLE_DATA_LABS_API_KEY or PDL_API_KEY.",
    })
  }

  if (sandbox_mode && !sandbox_config.env_explicit) {
    issues.push({
      code: "sandbox_implicit",
      severity: "info",
      message: "PDL_USE_SANDBOX unset — live API used (production-first default).",
    })
  }

  if (sandbox_config.env_explicit && sandbox_mode) {
    issues.push({
      code: "sandbox_explicit",
      severity: "info",
      message: "PDL_USE_SANDBOX=true — sandbox API (no live credits).",
    })
  }

  const ready_for_live_search =
    !pdl_disabled_flag &&
    pdl_enabled &&
    !mock_mode &&
    !sandbox_mode &&
    api_key_present &&
    !issues.some((i) => i.severity === "error")

  const live_benchmark_ack = env.GROWTH_PDL_LIVE_BENCHMARK_ACK === "1"
  if (!live_benchmark_ack && ready_for_live_search) {
    issues.push({
      code: "live_benchmark_ack_missing",
      severity: "info",
      message: "Live benchmark requires GROWTH_PDL_LIVE_BENCHMARK_ACK=1 to prevent accidental credit usage.",
    })
  }

  const ready_for_live_benchmark = ready_for_live_search && live_benchmark_ack
  const ready_for_enrichment = ready_for_live_benchmark

  if (!isPdlProviderConfigured(env) && !mock_mode) {
    issues.push({
      code: "provider_not_configured",
      severity: "info",
      message: "PDL provider isConfigured() is false with current env.",
    })
  }

  return {
    qa_marker: GROWTH_PDL_CONFIG_DIAGNOSTICS_QA_MARKER,
    ready_for_live_search,
    ready_for_live_benchmark,
    ready_for_enrichment,
    mock_mode,
    sandbox_mode,
    pdl_enabled,
    pdl_disabled_flag,
    api_key_present,
    api_key_source: apiKeySource(env),
    credit_limits,
    issues,
  }
}

export function assertPdlLiveBenchmarkAllowed(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean
  diagnostics: PdlConfigDiagnostics
  error: string | null
} {
  const diagnostics = diagnosePdlContactDiscoveryConfig(env)
  if (diagnostics.mock_mode) {
    return { ok: false, diagnostics, error: "Live benchmark refused: GROWTH_PDL_USE_MOCK is enabled." }
  }
  if (diagnostics.sandbox_mode) {
    return {
      ok: false,
      diagnostics,
      error: "Live benchmark refused: PDL_USE_SANDBOX is enabled.",
    }
  }
  if (!diagnostics.ready_for_live_benchmark) {
    const blocking = diagnostics.issues.filter((i) => i.severity === "error").map((i) => i.message)
    return {
      ok: false,
      diagnostics,
      error:
        blocking.join(" ") ||
        "Live benchmark refused: set GROWTH_PDL_LIVE_BENCHMARK_ACK=1 and valid PDL env.",
    }
  }
  return { ok: true, diagnostics, error: null }
}
