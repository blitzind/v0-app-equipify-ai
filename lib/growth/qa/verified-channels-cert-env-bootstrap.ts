/**
 * Env bootstrap for verified-channel certification scripts (7.PS-HF+).
 * Skips empty placeholder values; applies production-safe cert defaults.
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { applyProcessEnvProviderKeyFallback } from "@/lib/growth/qa/provider-runtime-env-resolution"
import {
  GROWTH_PRODUCTION_ENV_SOURCES,
  mergeGrowthProductionEnvLayers,
  parseGrowthProductionEnvFile,
} from "@/lib/growth/qa/reply-flow-env-bootstrap"

export const GROWTH_VERIFIED_CHANNELS_CERT_QA_MARKER =
  "growth-verified-channels-cert-env-bootstrap-7-ps-hi-v1" as const

export const GROWTH_VERIFIED_CHANNELS_CERT_ENV_KEYS = [
  "ZEROBOUNCE_API_KEY",
  "GROWTH_ZEROBOUNCE_API_KEY",
  "GROWTH_RESEARCH_WEBSITE_ENABLED",
  "PEOPLE_DATA_LABS_API_KEY",
  "PDL_API_KEY",
  "GROWTH_EMAIL_VERIFICATION_USE_FIXTURE",
  "GROWTH_EMAIL_VERIFICATION_DISABLE",
  "VERCEL_ENV",
  "NODE_ENV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const

export type GrowthVerifiedChannelsCertEnvKey =
  (typeof GROWTH_VERIFIED_CHANNELS_CERT_ENV_KEYS)[number]

export type GrowthVerifiedChannelsEnvKeyStatus =
  | "missing"
  | "empty_placeholder"
  | "configured"
  | "unsafe_for_production"

export type GrowthVerifiedChannelsCertEnvAudit = {
  qa_marker: typeof GROWTH_VERIFIED_CHANNELS_CERT_QA_MARKER
  keys: Record<
    GrowthVerifiedChannelsCertEnvKey,
    {
      status: GrowthVerifiedChannelsEnvKeyStatus
      source: string | null
      production_safe: boolean | null
    }
  >
  production_like: boolean
  loaded_files: string[]
  applied_defaults: string[]
}

function isPresentEnvValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isProductionLike(env: Record<string, string>): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production"
}

function classifyEnvKey(
  key: GrowthVerifiedChannelsCertEnvKey,
  value: string | undefined,
  productionLike: boolean,
): GrowthVerifiedChannelsEnvKeyStatus {
  if (!isPresentEnvValue(value)) return "missing"
  const trimmed = value.trim()
  if (trimmed === '""' || trimmed === "''") return "empty_placeholder"

  if (key === "GROWTH_EMAIL_VERIFICATION_USE_FIXTURE" && productionLike) {
    const lower = trimmed.toLowerCase()
    if (lower === "1" || lower === "true") return "unsafe_for_production"
  }

  return "configured"
}

function isSupabaseServiceRoleJwt(jwt: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString()) as {
      role?: string
      iss?: string
    }
    return payload.role === "service_role" || String(payload.iss ?? "").includes("supabase")
  } catch {
    return false
  }
}

function extractServiceRoleJwtFromFiles(cwd: string): string | null {
  const candidates: string[] = []
  for (const relativePath of GROWTH_PRODUCTION_ENV_SOURCES) {
    const absolutePath = resolve(cwd, relativePath)
    if (!existsSync(absolutePath)) continue
    try {
      const jwts = readFileSync(absolutePath, "utf8").match(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      )
      if (jwts) candidates.push(...jwts)
    } catch {
      /* optional */
    }
  }
  return candidates.find(isSupabaseServiceRoleJwt) ?? null
}

function resolveSupabaseUrl(env: Record<string, string>, jwt: string | null): string | null {
  const direct = [env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_URL]
    .map((value) => (value ?? "").trim())
    .find((value) => value.startsWith("http"))
  if (direct) return direct
  if (!jwt) return null
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString()) as {
      ref?: string
    }
    if (payload.ref) return `https://${payload.ref}.supabase.co`
  } catch {
    return null
  }
  return null
}

function applyVerifiedChannelsCertDefaults(env: Record<string, string>): {
  env: Record<string, string>
  applied_defaults: string[]
} {
  const next = { ...env }
  const applied_defaults: string[] = []

  if (!isPresentEnvValue(next.GROWTH_RESEARCH_WEBSITE_ENABLED)) {
    next.GROWTH_RESEARCH_WEBSITE_ENABLED = "true"
    applied_defaults.push("GROWTH_RESEARCH_WEBSITE_ENABLED=true")
  }

  const productionLike = isProductionLike(next)
  if (productionLike && !isPresentEnvValue(next.NODE_ENV)) {
    next.NODE_ENV = "production"
    applied_defaults.push("NODE_ENV=production (production-like cert)")
  }

  if (productionLike && !isPresentEnvValue(next.GROWTH_EMAIL_VERIFICATION_USE_FIXTURE)) {
    next.GROWTH_EMAIL_VERIFICATION_USE_FIXTURE = "false"
    applied_defaults.push("GROWTH_EMAIL_VERIFICATION_USE_FIXTURE=false")
  }

  return { env: next, applied_defaults }
}

export function loadVerifiedChannelsCertEnvLayers(input?: {
  cwd?: string
  sources?: readonly string[]
  inheritProcessEnvProviderKeys?: boolean
}): {
  merged: Record<string, string>
  sources: Record<string, string>
  loaded_files: string[]
} {
  const cwd = input?.cwd ?? process.cwd()
  const sourceFiles = input?.sources ?? GROWTH_PRODUCTION_ENV_SOURCES
  const inheritProcessEnvProviderKeys = input?.inheritProcessEnvProviderKeys ?? true
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

  let { merged, sources } = mergeGrowthProductionEnvLayers(layers)
  if (inheritProcessEnvProviderKeys) {
    const fallback = applyProcessEnvProviderKeyFallback(merged, sources, process.env)
    merged = fallback.merged
    sources = fallback.sources
  }
  return { merged, sources, loaded_files }
}

function resolveRawKeyStatus(
  key: GrowthVerifiedChannelsCertEnvKey,
  layers: Array<{ source: string; values: Record<string, string> }>,
  merged: Record<string, string>,
  productionLike: boolean,
): GrowthVerifiedChannelsEnvKeyStatus {
  if (isPresentEnvValue(merged[key])) {
    return classifyEnvKey(key, merged[key], productionLike)
  }
  let sawEmpty = false
  for (const layer of layers) {
    if (!(key in layer.values)) continue
    const value = layer.values[key] ?? ""
    if (isPresentEnvValue(value)) {
      return classifyEnvKey(key, value, productionLike)
    }
    sawEmpty = true
  }
  return sawEmpty ? "empty_placeholder" : "missing"
}

export function auditVerifiedChannelsCertEnv(input?: {
  cwd?: string
  sources?: readonly string[]
  inheritProcessEnvProviderKeys?: boolean
}): GrowthVerifiedChannelsCertEnvAudit {
  const { merged, sources, loaded_files } = loadVerifiedChannelsCertEnvLayers(input)
  const layers: Array<{ source: string; values: Record<string, string> }> = []
  const sourceFiles = input?.sources ?? GROWTH_PRODUCTION_ENV_SOURCES
  for (const relativePath of sourceFiles) {
    const absolutePath = resolve(input?.cwd ?? process.cwd(), relativePath)
    if (!existsSync(absolutePath)) continue
    try {
      layers.push({ source: relativePath, values: parseGrowthProductionEnvFile(absolutePath) })
    } catch {
      /* optional */
    }
  }
  const { env, applied_defaults } = applyVerifiedChannelsCertDefaults(merged)
  const production_like = isProductionLike(env)

  const keys = {} as GrowthVerifiedChannelsCertEnvAudit["keys"]
  for (const key of GROWTH_VERIFIED_CHANNELS_CERT_ENV_KEYS) {
    const status = resolveRawKeyStatus(key, layers, merged, production_like)
    let production_safe: boolean | null = null
    if (key === "GROWTH_EMAIL_VERIFICATION_USE_FIXTURE") {
      production_safe = status !== "unsafe_for_production"
    }
    if (key === "ZEROBOUNCE_API_KEY" || key === "GROWTH_ZEROBOUNCE_API_KEY") {
      const zb =
        isPresentEnvValue(merged.ZEROBOUNCE_API_KEY) ||
        isPresentEnvValue(merged.GROWTH_ZEROBOUNCE_API_KEY)
      production_safe = zb
    }
    keys[key] = {
      status: isPresentEnvValue(env[key]) && status !== "configured" ? "configured" : status,
      source: sources[key] ?? (isPresentEnvValue(env[key]) ? "(default)" : null),
      production_safe,
    }
  }

  return {
    qa_marker: GROWTH_VERIFIED_CHANNELS_CERT_QA_MARKER,
    keys,
    production_like,
    loaded_files,
    applied_defaults,
  }
}

export function bootstrapVerifiedChannelsCertEnv(input?: {
  cwd?: string
  sources?: readonly string[]
  /** When true (default), non-empty process.env provider keys fill gaps after file merge. */
  inheritProcessEnvProviderKeys?: boolean
}): { url: string; jwt: string; audit: GrowthVerifiedChannelsCertEnvAudit } | null {
  const cwd = input?.cwd ?? process.cwd()
  const { merged, loaded_files } = loadVerifiedChannelsCertEnvLayers({
    cwd,
    sources: input?.sources,
    inheritProcessEnvProviderKeys: input?.inheritProcessEnvProviderKeys,
  })
  const { env, applied_defaults } = applyVerifiedChannelsCertDefaults(merged)

  const jwt =
    extractServiceRoleJwtFromFiles(cwd) ??
    (isPresentEnvValue(env.SUPABASE_SERVICE_ROLE_KEY) &&
    isSupabaseServiceRoleJwt(env.SUPABASE_SERVICE_ROLE_KEY)
      ? env.SUPABASE_SERVICE_ROLE_KEY.trim()
      : null)

  const url = resolveSupabaseUrl(env, jwt) ?? "https://byyfylkklbxcdofaspye.supabase.co"
  if (!jwt) return null

  for (const [key, value] of Object.entries(env)) {
    if (isPresentEnvValue(value)) process.env[key] = value.trim()
  }

  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  process.env.SUPABASE_URL = url
  process.env.SUPABASE_SERVICE_ROLE_KEY = jwt
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    isPresentEnvValue(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ? env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() : jwt

  const audit = auditVerifiedChannelsCertEnv({
    cwd,
    sources: input?.sources,
    inheritProcessEnvProviderKeys: input?.inheritProcessEnvProviderKeys,
  })
  audit.loaded_files = loaded_files
  audit.applied_defaults = applied_defaults

  return { url, jwt, audit }
}
