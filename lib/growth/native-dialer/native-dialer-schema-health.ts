import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { looksLikePostgrestMissingSchemaError } from "@/lib/blitzpay/blitzpay-schema-health-detect"

/**
 * Manual QA (native dialer schema health v2):
 * - If probeUncertain persists after migrations, reload the Supabase PostgREST schema cache
 *   (Dashboard → Settings → API → Reload schema, or `supabase db reset` locally).
 * - Apply 20270315123000_growth_engine_native_dialer_service_role_grants.sql when dial CRUD
 *   fails despite tables existing (missing service_role GRANTs from 20270315120000).
 * - After grants + cache reload, start / end / wrap-up API routes should succeed.
 */

export const GROWTH_NATIVE_DIALER_SCHEMA_HEALTH_QA_MARKER = "native-dialer-schema-health-v2" as const
export const GROWTH_NATIVE_DIALER_SCHEMA_PROBE_VERSION = "v2" as const

export const GROWTH_NATIVE_DIALER_REQUIRED_TABLES = [
  "native_dialer_settings",
  "native_dialer_queue_items",
  "native_call_workspace_sessions",
  "native_call_wrapups",
] as const

export type GrowthNativeDialerRequiredTable = (typeof GROWTH_NATIVE_DIALER_REQUIRED_TABLES)[number]

export const GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE =
  "Native dialer tables are not ready. Apply migration 20270315120000_growth_engine_native_dialer.sql."

export const GROWTH_NATIVE_DIALER_SCHEMA_VERIFICATION_INCOMPLETE_MESSAGE =
  "Dialer setup verification incomplete. Tables may still be provisioning — try again shortly."

export type GrowthNativeDialerSchemaProbeResult = {
  qaMarker: typeof GROWTH_NATIVE_DIALER_SCHEMA_HEALTH_QA_MARKER
  schemaProbeVersion: typeof GROWTH_NATIVE_DIALER_SCHEMA_PROBE_VERSION
  schemaReady: boolean
  probeUncertain: boolean
  missingTables: GrowthNativeDialerRequiredTable[]
  detectedTables: GrowthNativeDialerRequiredTable[]
  setupMessage: string | null
}

type TableProbeOutcome = "detected" | "missing" | "uncertain"

let cachedProbe: { expiresAt: number; result: GrowthNativeDialerSchemaProbeResult } | null = null
const CACHE_MS = 30_000

function isPostgrestSchemaCacheStaleError(message: string, code?: string): boolean {
  const m = message.toLowerCase()
  if (code === "PGRST205") return true
  if (m.includes("schema cache") && m.includes("could not find")) return true
  return false
}

function isDefinitiveMissingTableError(message: string, code?: string): boolean {
  if (code === "42P01") return true
  const m = message.toLowerCase()
  if (m.includes("does not exist") && m.includes("relation")) return true
  return false
}

function classifyTableProbeError(message: string, code?: string): TableProbeOutcome {
  if (isDefinitiveMissingTableError(message, code)) return "missing"
  if (isPostgrestSchemaCacheStaleError(message, code)) return "uncertain"
  if (looksLikePostgrestMissingSchemaError(message, code)) return "uncertain"
  return "uncertain"
}

async function probeTableViaPostgrestClient(
  admin: SupabaseClient,
  tableName: GrowthNativeDialerRequiredTable,
): Promise<TableProbeOutcome> {
  const { error } = await admin.schema("growth").from(tableName).select("id").limit(0)
  if (!error) return "detected"
  const message = error.message ?? String(error)
  return classifyTableProbeError(message, error.code)
}

async function probeTableViaRestCatalog(
  tableName: GrowthNativeDialerRequiredTable,
): Promise<TableProbeOutcome> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return "uncertain"

  try {
    const res = await fetch(`${url}/rest/v1/${tableName}?select=id&limit=0`, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        "Accept-Profile": "growth",
        "Content-Profile": "growth",
      },
      cache: "no-store",
    })

    if (res.ok) return "detected"

    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string }
    const message = body.message ?? res.statusText
    return classifyTableProbeError(message, body.code)
  } catch {
    return "uncertain"
  }
}

async function probeTableViaInformationSchemaCatalog(
  tableName: GrowthNativeDialerRequiredTable,
): Promise<TableProbeOutcome> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return "uncertain"

  // PostgREST-safe catalog probe: query pg_catalog-backed OpenAPI paths (no row reads).
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/openapi+json",
        "Accept-Profile": "growth",
      },
      cache: "no-store",
    })
    if (!res.ok) return "uncertain"
    const spec = (await res.json().catch(() => null)) as { paths?: Record<string, unknown> } | null
    if (!spec?.paths) return "uncertain"
    if (`/${tableName}` in spec.paths) return "detected"
    return "uncertain"
  } catch {
    return "uncertain"
  }
}

async function probeSingleTable(
  admin: SupabaseClient,
  tableName: GrowthNativeDialerRequiredTable,
): Promise<TableProbeOutcome> {
  const clientOutcome = await probeTableViaPostgrestClient(admin, tableName)
  if (clientOutcome === "detected") return "detected"
  if (clientOutcome === "missing") return "missing"

  const restOutcome = await probeTableViaRestCatalog(tableName)
  if (restOutcome === "detected") return "detected"
  if (restOutcome === "missing") return "missing"

  const catalogOutcome = await probeTableViaInformationSchemaCatalog(tableName)
  if (catalogOutcome === "detected") return "detected"

  return "uncertain"
}

function buildProbeResult(input: {
  detectedTables: GrowthNativeDialerRequiredTable[]
  missingTables: GrowthNativeDialerRequiredTable[]
  uncertainTables: GrowthNativeDialerRequiredTable[]
}): GrowthNativeDialerSchemaProbeResult {
  const probeUncertain = input.uncertainTables.length > 0
  const allDetected = input.detectedTables.length === GROWTH_NATIVE_DIALER_REQUIRED_TABLES.length
  const schemaReady = input.missingTables.length === 0 && (allDetected || probeUncertain)

  let setupMessage: string | null = null
  if (!schemaReady) {
    setupMessage = GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE
  } else if (probeUncertain) {
    setupMessage = GROWTH_NATIVE_DIALER_SCHEMA_VERIFICATION_INCOMPLETE_MESSAGE
  }

  return {
    qaMarker: GROWTH_NATIVE_DIALER_SCHEMA_HEALTH_QA_MARKER,
    schemaProbeVersion: GROWTH_NATIVE_DIALER_SCHEMA_PROBE_VERSION,
    schemaReady,
    probeUncertain,
    missingTables: input.missingTables,
    detectedTables: input.detectedTables,
    setupMessage,
  }
}

function readCachedGrowthNativeDialerSchemaProbe(): GrowthNativeDialerSchemaProbeResult | null {
  if (cachedProbe && Date.now() < cachedProbe.expiresAt) {
    return cachedProbe.result
  }
  return null
}

function writeCachedGrowthNativeDialerSchemaProbe(result: GrowthNativeDialerSchemaProbeResult): void {
  cachedProbe = { expiresAt: Date.now() + CACHE_MS, result }
}

export function invalidateGrowthNativeDialerSchemaProbeCache(): void {
  cachedProbe = null
}

export async function probeGrowthNativeDialerSchemaHealth(
  admin: SupabaseClient,
): Promise<GrowthNativeDialerSchemaProbeResult> {
  const cached = readCachedGrowthNativeDialerSchemaProbe()
  if (cached) return cached

  const outcomes = await Promise.all(
    GROWTH_NATIVE_DIALER_REQUIRED_TABLES.map(async (tableName) => ({
      tableName,
      outcome: await probeSingleTable(admin, tableName),
    })),
  )

  const detectedTables: GrowthNativeDialerRequiredTable[] = []
  const missingTables: GrowthNativeDialerRequiredTable[] = []
  const uncertainTables: GrowthNativeDialerRequiredTable[] = []

  for (const row of outcomes) {
    if (row.outcome === "detected") detectedTables.push(row.tableName)
    else if (row.outcome === "missing") missingTables.push(row.tableName)
    else uncertainTables.push(row.tableName)
  }

  const result = buildProbeResult({ detectedTables, missingTables, uncertainTables })
  writeCachedGrowthNativeDialerSchemaProbe(result)
  return result
}

export async function probeGrowthNativeDialerSchemaHealthWithBudget(
  admin: SupabaseClient,
  budgetMs: number,
): Promise<GrowthNativeDialerSchemaProbeResult> {
  const cached = readCachedGrowthNativeDialerSchemaProbe()
  if (cached) return cached

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    const probe = await Promise.race([
      probeGrowthNativeDialerSchemaHealth(admin).then((result) => {
        writeCachedGrowthNativeDialerSchemaProbe(result)
        return result
      }),
      new Promise<GrowthNativeDialerSchemaProbeResult | null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), budgetMs)
      }),
    ])

    if (probe) return probe

    return {
      qaMarker: GROWTH_NATIVE_DIALER_SCHEMA_HEALTH_QA_MARKER,
      schemaProbeVersion: GROWTH_NATIVE_DIALER_SCHEMA_PROBE_VERSION,
      schemaReady: true,
      probeUncertain: true,
      missingTables: [],
      detectedTables: [],
      setupMessage: "Native dialer schema probe budget exceeded — using fast path.",
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function isGrowthNativeDialerSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const probe = await probeGrowthNativeDialerSchemaHealth(admin)
  return probe.schemaReady
}

export function resetGrowthNativeDialerSchemaProbeCacheForTests(): void {
  cachedProbe = null
}

export function growthNativeDialerSchemaResponseMeta(
  probe: GrowthNativeDialerSchemaProbeResult,
): {
  schemaReady: boolean
  probeUncertain?: boolean
  setupMessage?: string
  schemaProbeVersion: typeof GROWTH_NATIVE_DIALER_SCHEMA_PROBE_VERSION
} {
  if (!probe.schemaReady) {
    return {
      schemaReady: false,
      setupMessage: probe.setupMessage ?? GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE,
      schemaProbeVersion: GROWTH_NATIVE_DIALER_SCHEMA_PROBE_VERSION,
    }
  }
  if (probe.probeUncertain) {
    return {
      schemaReady: true,
      probeUncertain: true,
      setupMessage: probe.setupMessage ?? GROWTH_NATIVE_DIALER_SCHEMA_VERIFICATION_INCOMPLETE_MESSAGE,
      schemaProbeVersion: GROWTH_NATIVE_DIALER_SCHEMA_PROBE_VERSION,
    }
  }
  return {
    schemaReady: true,
    schemaProbeVersion: GROWTH_NATIVE_DIALER_SCHEMA_PROBE_VERSION,
  }
}

export async function requireGrowthNativeDialerSchemaReady(
  admin: SupabaseClient,
): Promise<
  | { ok: true; probe: GrowthNativeDialerSchemaProbeResult }
  | { ok: false; probe: GrowthNativeDialerSchemaProbeResult; status: number }
> {
  const probe = await probeGrowthNativeDialerSchemaHealth(admin)
  if (probe.schemaReady) return { ok: true, probe }
  return { ok: false, probe, status: 503 }
}

export async function requireGrowthNativeDialerSchemaReadyWithBudget(
  admin: SupabaseClient,
  budgetMs: number,
): Promise<
  | { ok: true; probe: GrowthNativeDialerSchemaProbeResult }
  | { ok: false; probe: GrowthNativeDialerSchemaProbeResult; status: number }
> {
  const probe = await probeGrowthNativeDialerSchemaHealthWithBudget(admin, budgetMs)
  if (probe.schemaReady) return { ok: true, probe }
  return { ok: false, probe, status: 503 }
}

export type GrowthNativeDialerSchemaAdminDiagnostics = GrowthNativeDialerSchemaProbeResult & {
  requiredTables: GrowthNativeDialerRequiredTable[]
  uncertainTables: GrowthNativeDialerRequiredTable[]
}

export async function fetchGrowthNativeDialerSchemaAdminDiagnostics(
  admin: SupabaseClient,
): Promise<GrowthNativeDialerSchemaAdminDiagnostics> {
  invalidateGrowthNativeDialerSchemaProbeCache()
  const probe = await probeGrowthNativeDialerSchemaHealth(admin)
  const uncertainTables = GROWTH_NATIVE_DIALER_REQUIRED_TABLES.filter(
    (table) => !probe.detectedTables.includes(table) && !probe.missingTables.includes(table),
  )
  return {
    ...probe,
    requiredTables: [...GROWTH_NATIVE_DIALER_REQUIRED_TABLES],
    uncertainTables,
  }
}
