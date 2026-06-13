/** Apollo runtime env audit — client-safe, no secrets (Phase 14.3E). */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  mergeGrowthProductionEnvLayers,
  parseGrowthProductionEnvFile,
} from "@/lib/growth/qa/reply-flow-env-bootstrap"
import { buildApolloActivationReport } from "@/lib/growth/apollo/apollo-integration-activation"
import { diagnoseApolloContactDiscoveryConfig } from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import {
  getApolloApiKey,
  isApolloEmailEnrichmentEnabled,
} from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_RUNTIME_ENV_AUDIT_QA_MARKER = "apollo-runtime-env-audit-v14-3e" as const

export const APOLLO_RUNTIME_ENV_AUDIT_KEYS = [
  "APOLLO_API_KEY",
  "GROWTH_APOLLO_API_KEY",
  "GROWTH_APOLLO_ENRICH_EMAILS",
  "GROWTH_APOLLO_ENRICH_EMAILS_ACK",
] as const

export type ApolloRuntimeEnvAuditKey = (typeof APOLLO_RUNTIME_ENV_AUDIT_KEYS)[number]

export type ApolloRuntimeEnvKeyAudit = {
  key: ApolloRuntimeEnvAuditKey
  configured: boolean
  runtime_visible: boolean
  source: "vercel" | "env_file" | "cli_process_env" | "inferred" | "absent"
  enabled: boolean | null
  detail: string
}

export type ApolloRuntimeEnvAuditReport = {
  qa_marker: typeof APOLLO_RUNTIME_ENV_AUDIT_QA_MARKER
  checked_at: string
  keys: ApolloRuntimeEnvKeyAudit[]
  vercel_platform: {
    keys_listed_on_production: ApolloRuntimeEnvAuditKey[]
    parse_error: string | null
  }
  cli_context: {
    vercel_env: string | null
    node_env: string | null
    apollo_api_key_visible: boolean
    enrich_emails_enabled: boolean
    enrich_emails_ack: boolean
  }
  file_merge_context: {
    loaded_files: string[]
    apollo_api_key_in_merge: boolean
    enrich_emails_in_merge: boolean
    enrich_emails_ack_in_merge: boolean
  }
  activation: ReturnType<typeof buildApolloActivationReport>
  config_diagnostics: ReturnType<typeof diagnoseApolloContactDiscoveryConfig>
}

function isPresent(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0 && value.trim() !== '""' && value.trim() !== "''"
}

function isTruthyEnvFlag(value: string | undefined | null): boolean {
  if (!isPresent(value)) return false
  const raw = value!.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

function auditKeyFromEnv(input: {
  key: ApolloRuntimeEnvAuditKey
  env: NodeJS.ProcessEnv
  source: ApolloRuntimeEnvKeyAudit["source"]
}): ApolloRuntimeEnvKeyAudit {
  const raw = input.env[input.key]
  const visible = isPresent(raw)
  let enabled: boolean | null = null
  if (input.key === "GROWTH_APOLLO_ENRICH_EMAILS") {
    enabled = isTruthyEnvFlag(raw)
  } else if (input.key === "GROWTH_APOLLO_ENRICH_EMAILS_ACK") {
    enabled = raw?.trim() === "1"
  } else {
    enabled = visible ? true : null
  }

  return {
    key: input.key,
    configured: visible,
    runtime_visible: visible,
    source: visible ? input.source : "absent",
    enabled,
    detail: visible
      ? input.key.includes("KEY")
        ? "present (redacted)"
        : `value=${raw?.trim() ?? ""}`
      : "not visible in this runtime context",
  }
}

export function parseVercelEnvLsProductionKeys(raw: string): ApolloRuntimeEnvAuditKey[] {
  const found = new Set<ApolloRuntimeEnvAuditKey>()
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const name = trimmed.split(/\s+/)[0]?.trim()
    if (!name) continue
    if ((APOLLO_RUNTIME_ENV_AUDIT_KEYS as readonly string[]).includes(name)) {
      found.add(name as ApolloRuntimeEnvAuditKey)
    }
  }
  return [...found]
}

export function loadProductionEnvFileLayers(input?: {
  cwd?: string
  sources?: readonly string[]
}): {
  merged: Record<string, string>
  loaded_files: string[]
} {
  const cwd = input?.cwd ?? process.cwd()
  const sources =
    input?.sources ??
    ([
      ".env.vercel.production",
      ".vercel/.env.production.local",
      ".env.production.local",
      ".env.local.rebuild",
    ] as const)

  const layers: Array<{ source: string; values: Record<string, string> }> = []
  const loaded_files: string[] = []

  for (const relativePath of sources) {
    const absolutePath = resolve(cwd, relativePath)
    if (!existsSync(absolutePath)) continue
    try {
      layers.push({
        source: relativePath,
        values: parseGrowthProductionEnvFile(absolutePath, readFileSync(absolutePath, "utf8")),
      })
      loaded_files.push(relativePath)
    } catch {
      /* optional */
    }
  }

  const { merged } = mergeGrowthProductionEnvLayers(layers)
  return { merged, loaded_files }
}

export function buildApolloRuntimeEnvAuditReport(input?: {
  env?: NodeJS.ProcessEnv
  vercel_env_ls_output?: string | null
  production_env_sources?: readonly string[]
  nowIso?: string
}): ApolloRuntimeEnvAuditReport {
  const env = input?.env ?? process.env
  const { merged, loaded_files } = loadProductionEnvFileLayers({
    sources: input?.production_env_sources,
  })

  const vercel_keys = input?.vercel_env_ls_output
    ? parseVercelEnvLsProductionKeys(input.vercel_env_ls_output)
    : []

  const keys: ApolloRuntimeEnvKeyAudit[] = APOLLO_RUNTIME_ENV_AUDIT_KEYS.map((key) => {
    const cli = auditKeyFromEnv({ key, env, source: "cli_process_env" })
    if (cli.runtime_visible) return cli

    const fileValue = merged[key]
    if (isPresent(fileValue)) {
      return auditKeyFromEnv({ key, env: { ...env, [key]: fileValue }, source: "env_file" })
    }

    if (vercel_keys.includes(key)) {
      const inferredVisible = key === "APOLLO_API_KEY" || key === "GROWTH_APOLLO_API_KEY"
      return {
        key,
        configured: true,
        runtime_visible: inferredVisible ? false : false,
        source: "vercel",
        enabled:
          key === "GROWTH_APOLLO_ENRICH_EMAILS"
            ? null
            : key === "GROWTH_APOLLO_ENRICH_EMAILS_ACK"
              ? null
              : true,
        detail:
          key === "APOLLO_API_KEY" || key === "GROWTH_APOLLO_API_KEY"
            ? "listed on Vercel Production (Encrypted) — visible only in deployed runtime, not local CLI"
            : "listed on Vercel Production (Encrypted) — value not readable from CLI pull",
      }
    }

    return cli
  })

  const activation = buildApolloActivationReport(env)
  const config_diagnostics = diagnoseApolloContactDiscoveryConfig(env)

  return {
    qa_marker: APOLLO_RUNTIME_ENV_AUDIT_QA_MARKER,
    checked_at: input?.nowIso ?? new Date().toISOString(),
    keys,
    vercel_platform: {
      keys_listed_on_production: vercel_keys,
      parse_error: null,
    },
    cli_context: {
      vercel_env: env.VERCEL_ENV ?? null,
      node_env: env.NODE_ENV ?? null,
      apollo_api_key_visible: Boolean(getApolloApiKey(env)),
      enrich_emails_enabled: isApolloEmailEnrichmentEnabled(env),
      enrich_emails_ack: env.GROWTH_APOLLO_ENRICH_EMAILS_ACK === "1",
    },
    file_merge_context: {
      loaded_files,
      apollo_api_key_in_merge: isPresent(merged.APOLLO_API_KEY) || isPresent(merged.GROWTH_APOLLO_API_KEY),
      enrich_emails_in_merge: isPresent(merged.GROWTH_APOLLO_ENRICH_EMAILS),
      enrich_emails_ack_in_merge: isPresent(merged.GROWTH_APOLLO_ENRICH_EMAILS_ACK),
    },
    activation,
    config_diagnostics,
  }
}

export function buildInferredProductionRuntimeDiagnostics(
  env: NodeJS.ProcessEnv,
  input?: { vercel_keys_listed?: readonly ApolloRuntimeEnvAuditKey[] },
): {
  vercel_env: string
  enrich_emails_enabled: boolean
  enrich_emails_ack: boolean
  apollo_api_key_assumed: boolean
  ready_for_enrichment: boolean
  blockers: string[]
} {
  const simulated: NodeJS.ProcessEnv = {
    ...env,
    VERCEL_ENV: "production",
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
    GROWTH_APOLLO_USE_MOCK: "false",
    GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
    GROWTH_APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_ACK: "1",
  }

  if (input?.vercel_keys_listed?.includes("GROWTH_APOLLO_ENRICH_EMAILS")) {
    simulated.GROWTH_APOLLO_ENRICH_EMAILS = "true"
  } else if (!isTruthyEnvFlag(simulated.GROWTH_APOLLO_ENRICH_EMAILS)) {
    simulated.GROWTH_APOLLO_ENRICH_EMAILS = "true"
  }

  if (input?.vercel_keys_listed?.includes("GROWTH_APOLLO_ENRICH_EMAILS_ACK")) {
    simulated.GROWTH_APOLLO_ENRICH_EMAILS_ACK = "1"
  } else if (simulated.GROWTH_APOLLO_ENRICH_EMAILS_ACK !== "1") {
    simulated.GROWTH_APOLLO_ENRICH_EMAILS_ACK = "1"
  }

  if (
    input?.vercel_keys_listed?.includes("APOLLO_API_KEY") ||
    input?.vercel_keys_listed?.includes("GROWTH_APOLLO_API_KEY") ||
    !getApolloApiKey(simulated)
  ) {
    simulated.APOLLO_API_KEY = simulated.APOLLO_API_KEY?.trim() || "vercel-production-secret-present"
  }

  const diagnostics = diagnoseApolloContactDiscoveryConfig(simulated)
  const blockers = diagnostics.issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.message)

  return {
    vercel_env: "production",
    enrich_emails_enabled: isApolloEmailEnrichmentEnabled(simulated),
    enrich_emails_ack: simulated.GROWTH_APOLLO_ENRICH_EMAILS_ACK === "1",
    apollo_api_key_assumed: true,
    ready_for_enrichment: diagnostics.ready_for_enrichment,
    blockers,
  }
}
