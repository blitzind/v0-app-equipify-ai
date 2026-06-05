/**
 * Phase 7.PS-HO-FIX — Provider runtime env resolution audit (client-safe).
 */

import {
  GROWTH_PRODUCTION_ENV_SOURCES,
  mergeGrowthProductionEnvLayers,
  parseGrowthProductionEnvFile,
} from "@/lib/growth/qa/reply-flow-env-bootstrap"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

export const GROWTH_PROVIDER_RUNTIME_ENV_RESOLUTION_QA_MARKER =
  "growth-provider-runtime-env-resolution-7-ps-ho-fix-v1" as const

export const GROWTH_PROVIDER_RUNTIME_ENV_KEYS = [
  "ZEROBOUNCE_API_KEY",
  "GROWTH_ZEROBOUNCE_API_KEY",
  "PEOPLE_DATA_LABS_API_KEY",
  "PDL_API_KEY",
] as const

export type GrowthProviderRuntimeEnvKey = (typeof GROWTH_PROVIDER_RUNTIME_ENV_KEYS)[number]

export type GrowthProviderEnvValueShape =
  | "missing"
  | "empty_unquoted"
  | "empty_quoted_literal"
  | "present"

export type GrowthProviderRuntimeEnvKeyAudit = {
  key: GrowthProviderRuntimeEnvKey
  aliases: string[]
  file_layers: Array<{
    source: string
    shape: GrowthProviderEnvValueShape
    merged_into_runtime: boolean
    masked: string
  }>
  process_env_before_bootstrap: {
    shape: GrowthProviderEnvValueShape
    masked: string
  }
  file_merge_result: {
    shape: GrowthProviderEnvValueShape
    source: string | null
    masked: string
  }
  process_env_fallback: {
    applied: boolean
    shape: GrowthProviderEnvValueShape
    masked: string
  }
  runtime_resolution: {
    source: string | null
    shape: GrowthProviderEnvValueShape
    masked: string
    configured: boolean
  }
}

export type GrowthLocalCertEnvStatus = {
  scope: "local_cert_runner_process_env"
  note: string
  zerobounce_configured: boolean
  pdl_configured: boolean
  file_placeholder_keys: string[]
}

export type GrowthProviderRuntimeEnvResolutionAudit = {
  qa_marker: typeof GROWTH_PROVIDER_RUNTIME_ENV_RESOLUTION_QA_MARKER
  resolution_order: string[]
  loaded_files: string[]
  local_cert_env_status: GrowthLocalCertEnvStatus
  zerobounce: {
    reads: ["ZEROBOUNCE_API_KEY", "GROWTH_ZEROBOUNCE_API_KEY"]
    configured: boolean
    winning_key: GrowthProviderRuntimeEnvKey | null
  }
  pdl: {
    reads: ["PEOPLE_DATA_LABS_API_KEY", "PDL_API_KEY"]
    configured: boolean
    winning_key: GrowthProviderRuntimeEnvKey | null
  }
  keys: GrowthProviderRuntimeEnvKeyAudit[]
  local_resolution_notes: string[]
  remediation: string[]
  /** @deprecated Use local_resolution_notes — kept for backward compatibility. */
  root_cause_summary: string[]
}

function isPresentEnvValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export function classifyProviderEnvValueShape(value: string | undefined): GrowthProviderEnvValueShape {
  if (value === undefined) return "missing"
  const trimmed = value.trim()
  if (!trimmed) return "empty_unquoted"
  if (trimmed === '""' || trimmed === "''") return "empty_quoted_literal"
  return "present"
}

export function maskProviderEnvValue(value: string | undefined): string {
  const shape = classifyProviderEnvValueShape(value)
  if (shape === "missing") return "(missing)"
  if (shape === "empty_unquoted") return "(empty)"
  if (shape === "empty_quoted_literal") return '(empty quoted literal: "")'
  const trimmed = value!.trim()
  if (trimmed.length <= 4) return `present(len=${trimmed.length})`
  return `present(len=${trimmed.length}, prefix=${trimmed.slice(0, 3)}***)`
}

export function applyProcessEnvProviderKeyFallback(
  merged: Record<string, string>,
  sources: Record<string, string>,
  processEnv: NodeJS.ProcessEnv = process.env,
): {
  merged: Record<string, string>
  sources: Record<string, string>
  applied: GrowthProviderRuntimeEnvKey[]
} {
  const next = { ...merged }
  const nextSources = { ...sources }
  const applied: GrowthProviderRuntimeEnvKey[] = []

  for (const key of GROWTH_PROVIDER_RUNTIME_ENV_KEYS) {
    if (isPresentEnvValue(next[key])) continue
    const fromProcess = processEnv[key]
    if (!isPresentEnvValue(fromProcess)) continue
    next[key] = fromProcess.trim()
    nextSources[key] = "(environment)"
    applied.push(key)
  }

  return { merged: next, sources: nextSources, applied }
}

function providerAliases(key: GrowthProviderRuntimeEnvKey): string[] {
  if (key === "ZEROBOUNCE_API_KEY") return ["GROWTH_ZEROBOUNCE_API_KEY"]
  if (key === "GROWTH_ZEROBOUNCE_API_KEY") return ["ZEROBOUNCE_API_KEY"]
  if (key === "PEOPLE_DATA_LABS_API_KEY") return ["PDL_API_KEY"]
  return ["PEOPLE_DATA_LABS_API_KEY"]
}

function resolveWinningProviderKey(
  keys: GrowthProviderRuntimeEnvKey[],
  env: NodeJS.ProcessEnv,
): GrowthProviderRuntimeEnvKey | null {
  for (const key of keys) {
    if (isPresentEnvValue(env[key])) return key
  }
  return null
}

export function auditProviderRuntimeEnvResolution(input?: {
  cwd?: string
  sources?: readonly string[]
  processEnv?: NodeJS.ProcessEnv
  /** When set, simulates post-bootstrap process.env for runtime reads. */
  runtimeProcessEnv?: NodeJS.ProcessEnv
}): GrowthProviderRuntimeEnvResolutionAudit {
  const cwd = input?.cwd ?? process.cwd()
  const sourceFiles = input?.sources ?? GROWTH_PRODUCTION_ENV_SOURCES
  const processEnv = input?.processEnv ?? process.env
  const runtimeEnv = input?.runtimeProcessEnv ?? processEnv

  const layers: Array<{ source: string; values: Record<string, string> }> = []
  const loaded_files: string[] = []

  for (const relativePath of sourceFiles) {
    const absolutePath = resolve(cwd, relativePath)
    if (!existsSync(absolutePath)) continue
    try {
      layers.push({ source: relativePath, values: parseGrowthProductionEnvFile(absolutePath) })
      loaded_files.push(relativePath)
    } catch {
      /* optional */
    }
  }

  const { merged: fileMerged, sources: fileSources } = mergeGrowthProductionEnvLayers(layers)
  const fallback = applyProcessEnvProviderKeyFallback(fileMerged, fileSources, processEnv)

  const keys = GROWTH_PROVIDER_RUNTIME_ENV_KEYS.map((key): GrowthProviderRuntimeEnvKeyAudit => {
    const file_layers = layers
      .filter((layer) => key in layer.values)
      .map((layer) => {
        const raw = layer.values[key]
        const shape = classifyProviderEnvValueShape(raw)
        return {
          source: layer.source,
          shape,
          merged_into_runtime: isPresentEnvValue(raw),
          masked: maskProviderEnvValue(raw),
        }
      })

    const fileValue = fileMerged[key]
    const fallbackValue = fallback.merged[key]
    const fallbackApplied =
      !isPresentEnvValue(fileValue) &&
      isPresentEnvValue(fallbackValue) &&
      fallback.applied.includes(key)

    const runtimeValue = runtimeEnv[key]
    const runtimeConfigured = isPresentEnvValue(runtimeValue)

    return {
      key,
      aliases: providerAliases(key),
      file_layers,
      process_env_before_bootstrap: {
        shape: classifyProviderEnvValueShape(processEnv[key]),
        masked: maskProviderEnvValue(processEnv[key]),
      },
      file_merge_result: {
        shape: classifyProviderEnvValueShape(fileValue),
        source: fileSources[key] ?? null,
        masked: maskProviderEnvValue(fileValue),
      },
      process_env_fallback: {
        applied: fallbackApplied,
        shape: classifyProviderEnvValueShape(fallbackValue),
        masked: maskProviderEnvValue(fallbackValue),
      },
      runtime_resolution: {
        source: runtimeConfigured
          ? "(process.env after bootstrap)"
          : fileSources[key] ?? (fallbackApplied ? "(environment)" : null),
        shape: classifyProviderEnvValueShape(runtimeValue),
        masked: maskProviderEnvValue(runtimeValue),
        configured: runtimeConfigured,
      },
    }
  })

  const zbWinning = resolveWinningProviderKey(
    ["ZEROBOUNCE_API_KEY", "GROWTH_ZEROBOUNCE_API_KEY"],
    runtimeEnv,
  )
  const pdlWinning = resolveWinningProviderKey(
    ["PEOPLE_DATA_LABS_API_KEY", "PDL_API_KEY"],
    runtimeEnv,
  )

  const local_resolution_notes: string[] = []
  const remediation: string[] = []

  const file_placeholder_keys = keys
    .filter((k) =>
      k.file_layers.some(
        (l) => l.shape === "empty_quoted_literal" || l.shape === "empty_unquoted",
      ),
    )
    .map((k) => k.key)

  if (file_placeholder_keys.length > 0) {
    local_resolution_notes.push(
      `Local cert env files contain empty placeholders for: ${file_placeholder_keys.join(", ")}. mergeGrowthProductionEnvLayers skips empty values — this affects only the local cert runner, not deployed Vercel Production runtime.`,
    )
    remediation.push(
      "For local-only testing: export ZEROBOUNCE_API_KEY / PEOPLE_DATA_LABS_API_KEY in the shell, or replace KEY=\"\" placeholders in .env.local.active.",
    )
  }

  if (!zbWinning && !pdlWinning) {
    local_resolution_notes.push(
      "Local cert runner process.env has no non-empty provider keys after file merge and process.env fallback.",
    )
  }

  local_resolution_notes.push(
    "Authoritative production provider availability: GET /api/platform/growth/providers/runtime-diagnostics on the deployed app (CRON_SECRET or platform admin). Do not infer deployed secret state from vercel env pull KEY=\"\" placeholders.",
  )

  remediation.push(
    "Probe deployed runtime: pnpm test:growth-provider-runtime-cert-7-ps-ho-runtime (uses vercel crons run + cron_execution_runs telemetry when CRON_SECRET is unavailable locally).",
  )

  const local_cert_env_status: GrowthLocalCertEnvStatus = {
    scope: "local_cert_runner_process_env",
    note: "Reflects local cert/bootstrap process only — not Vercel Production serverless runtime.",
    zerobounce_configured: Boolean(zbWinning),
    pdl_configured: Boolean(pdlWinning),
    file_placeholder_keys,
  }

  return {
    qa_marker: GROWTH_PROVIDER_RUNTIME_ENV_RESOLUTION_QA_MARKER,
    resolution_order: [
      "1. parseGrowthProductionEnvFile per GROWTH_PRODUCTION_ENV_SOURCES (later file wins on non-empty)",
      "2. mergeGrowthProductionEnvLayers skips empty/whitespace values",
      "3. applyProcessEnvProviderKeyFallback fills gaps from process.env",
      "4. bootstrapVerifiedChannelsCertEnv writes non-empty merged values into process.env",
      "5. getZeroBounceApiKey(): ZEROBOUNCE_API_KEY || GROWTH_ZEROBOUNCE_API_KEY",
      "6. getPdlApiKey(): PEOPLE_DATA_LABS_API_KEY || PDL_API_KEY",
    ],
    loaded_files,
    zerobounce: {
      reads: ["ZEROBOUNCE_API_KEY", "GROWTH_ZEROBOUNCE_API_KEY"],
      configured: Boolean(zbWinning),
      winning_key: zbWinning,
    },
    pdl: {
      reads: ["PEOPLE_DATA_LABS_API_KEY", "PDL_API_KEY"],
      configured: Boolean(pdlWinning),
      winning_key: pdlWinning,
    },
    keys,
    local_cert_env_status,
    local_resolution_notes,
    remediation,
    root_cause_summary: local_resolution_notes,
  }
}
