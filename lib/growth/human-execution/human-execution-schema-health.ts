import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { looksLikePostgrestMissingSchemaError } from "@/lib/blitzpay/blitzpay-schema-health-detect"

/**
 * Manual QA (human execution schema health v2):
 * - If probeUncertain persists after migrations, reload the Supabase PostgREST schema cache
 *   (Dashboard → Settings → API → Reload schema, or `supabase db reset` locally).
 * - Apply 20270313123000_growth_engine_human_approved_execution_service_role_grants.sql when
 *   tables exist but probes fail with permission errors (missing service_role GRANTs).
 */

export const GROWTH_HUMAN_EXECUTION_SCHEMA_HEALTH_QA_MARKER = "human-execution-schema-health-v2" as const
export const GROWTH_HUMAN_EXECUTION_SCHEMA_PROBE_VERSION = "v2" as const

export const GROWTH_HUMAN_EXECUTION_SCHEMA_MIGRATION =
  "20270313120000_growth_engine_human_approved_execution.sql" as const

export const GROWTH_HUMAN_EXECUTION_SCHEMA_GRANTS_MIGRATION =
  "20270313123000_growth_engine_human_approved_execution_service_role_grants.sql" as const

export const GROWTH_HUMAN_EXECUTION_REQUIRED_TABLES = [
  "human_execution_plans",
  "human_execution_plan_steps",
  "human_execution_approvals",
] as const

export type GrowthHumanExecutionRequiredTable = (typeof GROWTH_HUMAN_EXECUTION_REQUIRED_TABLES)[number]

export const GROWTH_HUMAN_EXECUTION_REQUIRED_COLUMNS: Record<GrowthHumanExecutionRequiredTable, string[]> = {
  human_execution_plans: ["id", "organization_id", "lead_id", "status", "readiness_score"],
  human_execution_plan_steps: ["id", "plan_id", "step_order", "channel", "approval_status"],
  human_execution_approvals: ["id", "organization_id", "lead_id", "approval_status", "readiness_score"],
}

/** @deprecated Prefer probeGrowthHumanExecutionSchemaHealth().setupMessage */
export const GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE =
  "Human-approved execution tables are not ready. Apply migration 20270313120000_growth_engine_human_approved_execution.sql."

export const GROWTH_HUMAN_EXECUTION_SCHEMA_VERIFICATION_INCOMPLETE_MESSAGE =
  "Human execution setup verification incomplete. Tables may still be provisioning — reload the PostgREST schema cache and try again."

export type GrowthHumanExecutionSchemaFailureReason =
  | "missing_tables"
  | "permission_blocked"
  | "postgrest_cache_stale"
  | "env_misconfigured"
  | "verification_incomplete"
  | null

export type GrowthHumanExecutionTableProbeStatus = {
  table: GrowthHumanExecutionRequiredTable
  schema: "growth"
  outcome: "detected" | "missing" | "permission_blocked" | "uncertain"
  columns: string[]
}

export type GrowthHumanExecutionSchemaProbeResult = {
  qaMarker: typeof GROWTH_HUMAN_EXECUTION_SCHEMA_HEALTH_QA_MARKER
  schemaProbeVersion: typeof GROWTH_HUMAN_EXECUTION_SCHEMA_PROBE_VERSION
  schemaReady: boolean
  probeUncertain: boolean
  failureReason: GrowthHumanExecutionSchemaFailureReason
  missingTables: GrowthHumanExecutionRequiredTable[]
  permissionBlockedTables: GrowthHumanExecutionRequiredTable[]
  detectedTables: GrowthHumanExecutionRequiredTable[]
  uncertainTables: GrowthHumanExecutionRequiredTable[]
  tableProbes: GrowthHumanExecutionTableProbeStatus[]
  supabaseProjectRef: string | null
  envHint: string | null
  setupMessage: string | null
}

type TableProbeOutcome = "detected" | "missing" | "permission_blocked" | "uncertain"

let cachedProbe: { expiresAt: number; result: GrowthHumanExecutionSchemaProbeResult } | null = null
const CACHE_MS = 30_000

function resolveSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!url) return null
  try {
    return new URL(url).hostname.split(".")[0] ?? null
  } catch {
    return null
  }
}

function buildEnvHint(): string | null {
  const ref = resolveSupabaseProjectRef()
  if (!ref) {
    return "Production is connected to a different Supabase project — NEXT_PUBLIC_SUPABASE_URL is missing or invalid. Verify env matches the project where migrations were applied."
  }
  return `Connected to Supabase project "${ref}". If migrations were applied elsewhere, update env to match that project.`
}

function isPostgrestSchemaCacheStaleError(message: string, code?: string): boolean {
  const m = message.toLowerCase()
  if (code === "PGRST205") return true
  if (m.includes("schema cache") && m.includes("could not find")) return true
  return false
}

function isDefinitiveMissingTableError(message: string, code?: string): boolean {
  if (code === "42P01" || code === "42703") return true
  const m = message.toLowerCase()
  if (m.includes("does not exist") && (m.includes("relation") || m.includes("column"))) return true
  return false
}

function isPermissionBlockedError(message: string, code?: string): boolean {
  if (code === "42501") return true
  const m = message.toLowerCase()
  return m.includes("permission denied")
}

function classifyTableProbeError(message: string, code?: string): TableProbeOutcome {
  if (isDefinitiveMissingTableError(message, code)) return "missing"
  if (isPermissionBlockedError(message, code)) return "permission_blocked"
  if (isPostgrestSchemaCacheStaleError(message, code)) return "uncertain"
  if (looksLikePostgrestMissingSchemaError(message, code)) return "uncertain"
  return "uncertain"
}

async function probeTableViaPostgrestClient(
  admin: SupabaseClient,
  tableName: GrowthHumanExecutionRequiredTable,
): Promise<TableProbeOutcome> {
  const columns = GROWTH_HUMAN_EXECUTION_REQUIRED_COLUMNS[tableName]
  const { error } = await admin.schema("growth").from(tableName).select(columns.join(", ")).limit(0)
  if (!error) return "detected"
  return classifyTableProbeError(error.message ?? String(error), error.code)
}

async function probeTableViaRestCatalog(
  tableName: GrowthHumanExecutionRequiredTable,
): Promise<TableProbeOutcome> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return "uncertain"

  const columns = GROWTH_HUMAN_EXECUTION_REQUIRED_COLUMNS[tableName]

  try {
    const res = await fetch(
      `${url}/rest/v1/${tableName}?select=${encodeURIComponent(columns.join(","))}&limit=0`,
      {
        method: "GET",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          "Accept-Profile": "growth",
          "Content-Profile": "growth",
        },
        cache: "no-store",
      },
    )

    if (res.ok) return "detected"

    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string }
    return classifyTableProbeError(body.message ?? res.statusText, body.code)
  } catch {
    return "uncertain"
  }
}

async function probeTableViaOpenApiCatalog(
  tableName: GrowthHumanExecutionRequiredTable,
): Promise<"detected" | "uncertain"> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return "uncertain"

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
  tableName: GrowthHumanExecutionRequiredTable,
): Promise<TableProbeOutcome> {
  const clientOutcome = await probeTableViaPostgrestClient(admin, tableName)
  if (clientOutcome === "detected") return "detected"
  if (clientOutcome === "missing") return "missing"
  if (clientOutcome === "permission_blocked") return "permission_blocked"

  const restOutcome = await probeTableViaRestCatalog(tableName)
  if (restOutcome === "detected") return "detected"
  if (restOutcome === "missing") return "missing"
  if (restOutcome === "permission_blocked") return "permission_blocked"

  const catalogOutcome = await probeTableViaOpenApiCatalog(tableName)
  if (catalogOutcome === "detected") return "uncertain"

  return "uncertain"
}

function buildSetupMessage(input: {
  failureReason: GrowthHumanExecutionSchemaFailureReason
  missingTables: GrowthHumanExecutionRequiredTable[]
  permissionBlockedTables: GrowthHumanExecutionRequiredTable[]
  probeUncertain: boolean
  envHint: string | null
}): string | null {
  if (input.failureReason === "env_misconfigured") {
    return input.envHint
  }

  if (input.failureReason === "missing_tables") {
    const tables = input.missingTables.map((t) => `growth.${t}`).join(", ")
    const parts = [
      `Required table missing: ${tables}. Migration ${GROWTH_HUMAN_EXECUTION_SCHEMA_MIGRATION} is not applied to this Supabase project.`,
    ]
    if (input.envHint) parts.push(input.envHint)
    return parts.join(" ")
  }

  if (input.failureReason === "permission_blocked") {
    const tables = input.permissionBlockedTables.map((t) => `growth.${t}`).join(", ")
    const parts = [
      `Readiness check blocked by permissions on ${tables}. Apply migration ${GROWTH_HUMAN_EXECUTION_SCHEMA_GRANTS_MIGRATION}, then reload the PostgREST schema cache.`,
    ]
    if (input.envHint) parts.push(input.envHint)
    return parts.join(" ")
  }

  if (input.probeUncertain) {
    return GROWTH_HUMAN_EXECUTION_SCHEMA_VERIFICATION_INCOMPLETE_MESSAGE
  }

  return null
}

function buildProbeResult(input: {
  detectedTables: GrowthHumanExecutionRequiredTable[]
  missingTables: GrowthHumanExecutionRequiredTable[]
  permissionBlockedTables: GrowthHumanExecutionRequiredTable[]
  uncertainTables: GrowthHumanExecutionRequiredTable[]
  tableProbes: GrowthHumanExecutionTableProbeStatus[]
}): GrowthHumanExecutionSchemaProbeResult {
  const supabaseProjectRef = resolveSupabaseProjectRef()
  const envHint = buildEnvHint()

  let failureReason: GrowthHumanExecutionSchemaFailureReason = null
  if (!supabaseProjectRef || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    failureReason = "env_misconfigured"
  } else if (input.missingTables.length > 0) {
    failureReason = "missing_tables"
  } else if (input.permissionBlockedTables.length > 0) {
    failureReason = "permission_blocked"
  } else if (input.uncertainTables.length > 0) {
    failureReason = "postgrest_cache_stale"
  }

  const probeUncertain =
    input.uncertainTables.length > 0 &&
    input.missingTables.length === 0 &&
    input.permissionBlockedTables.length === 0

  const allDetected = input.detectedTables.length === GROWTH_HUMAN_EXECUTION_REQUIRED_TABLES.length
  const schemaReady =
    failureReason !== "missing_tables" &&
    failureReason !== "permission_blocked" &&
    failureReason !== "env_misconfigured" &&
    (allDetected || probeUncertain)

  const setupMessage = schemaReady
    ? probeUncertain
      ? GROWTH_HUMAN_EXECUTION_SCHEMA_VERIFICATION_INCOMPLETE_MESSAGE
      : null
    : buildSetupMessage({
        failureReason,
        missingTables: input.missingTables,
        permissionBlockedTables: input.permissionBlockedTables,
        probeUncertain,
        envHint,
      })

  return {
    qaMarker: GROWTH_HUMAN_EXECUTION_SCHEMA_HEALTH_QA_MARKER,
    schemaProbeVersion: GROWTH_HUMAN_EXECUTION_SCHEMA_PROBE_VERSION,
    schemaReady,
    probeUncertain,
    failureReason: schemaReady && !probeUncertain ? null : failureReason,
    missingTables: input.missingTables,
    permissionBlockedTables: input.permissionBlockedTables,
    detectedTables: input.detectedTables,
    uncertainTables: input.uncertainTables,
    tableProbes: input.tableProbes,
    supabaseProjectRef,
    envHint: failureReason === "missing_tables" || failureReason === "permission_blocked" ? envHint : null,
    setupMessage,
  }
}

export async function probeGrowthHumanExecutionSchemaHealth(
  admin: SupabaseClient,
): Promise<GrowthHumanExecutionSchemaProbeResult> {
  if (cachedProbe && Date.now() < cachedProbe.expiresAt) {
    return cachedProbe.result
  }

  const outcomes = await Promise.all(
    GROWTH_HUMAN_EXECUTION_REQUIRED_TABLES.map(async (tableName) => ({
      tableName,
      outcome: await probeSingleTable(admin, tableName),
    })),
  )

  const detectedTables: GrowthHumanExecutionRequiredTable[] = []
  const missingTables: GrowthHumanExecutionRequiredTable[] = []
  const permissionBlockedTables: GrowthHumanExecutionRequiredTable[] = []
  const uncertainTables: GrowthHumanExecutionRequiredTable[] = []
  const tableProbes: GrowthHumanExecutionTableProbeStatus[] = []

  for (const row of outcomes) {
    const columns = GROWTH_HUMAN_EXECUTION_REQUIRED_COLUMNS[row.tableName]
    tableProbes.push({
      table: row.tableName,
      schema: "growth",
      outcome: row.outcome,
      columns,
    })
    if (row.outcome === "detected") detectedTables.push(row.tableName)
    else if (row.outcome === "missing") missingTables.push(row.tableName)
    else if (row.outcome === "permission_blocked") permissionBlockedTables.push(row.tableName)
    else uncertainTables.push(row.tableName)
  }

  const result = buildProbeResult({
    detectedTables,
    missingTables,
    permissionBlockedTables,
    uncertainTables,
    tableProbes,
  })
  cachedProbe = { expiresAt: Date.now() + CACHE_MS, result }
  return result
}

export async function isGrowthHumanExecutionSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const probe = await probeGrowthHumanExecutionSchemaHealth(admin)
  return probe.schemaReady
}

export function resetGrowthHumanExecutionSchemaProbeCacheForTests(): void {
  cachedProbe = null
}

export function invalidateGrowthHumanExecutionSchemaProbeCache(): void {
  cachedProbe = null
}

export function growthHumanExecutionSchemaResponseMeta(
  probe: GrowthHumanExecutionSchemaProbeResult,
): {
  schemaReady: boolean
  probeUncertain?: boolean
  failureReason?: GrowthHumanExecutionSchemaFailureReason
  setupMessage?: string
  envHint?: string | null
  supabaseProjectRef?: string | null
  schemaProbeVersion: typeof GROWTH_HUMAN_EXECUTION_SCHEMA_PROBE_VERSION
} {
  if (!probe.schemaReady) {
    return {
      schemaReady: false,
      failureReason: probe.failureReason ?? undefined,
      setupMessage: probe.setupMessage ?? GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE,
      envHint: probe.envHint,
      supabaseProjectRef: probe.supabaseProjectRef,
      schemaProbeVersion: GROWTH_HUMAN_EXECUTION_SCHEMA_PROBE_VERSION,
    }
  }
  if (probe.probeUncertain) {
    return {
      schemaReady: true,
      probeUncertain: true,
      failureReason: "postgrest_cache_stale",
      setupMessage: probe.setupMessage ?? GROWTH_HUMAN_EXECUTION_SCHEMA_VERIFICATION_INCOMPLETE_MESSAGE,
      schemaProbeVersion: GROWTH_HUMAN_EXECUTION_SCHEMA_PROBE_VERSION,
    }
  }
  return {
    schemaReady: true,
    schemaProbeVersion: GROWTH_HUMAN_EXECUTION_SCHEMA_PROBE_VERSION,
  }
}

export type GrowthHumanExecutionSchemaAdminDiagnostics = GrowthHumanExecutionSchemaProbeResult & {
  requiredTables: GrowthHumanExecutionRequiredTable[]
}

export async function fetchGrowthHumanExecutionSchemaAdminDiagnostics(
  admin: SupabaseClient,
): Promise<GrowthHumanExecutionSchemaAdminDiagnostics> {
  invalidateGrowthHumanExecutionSchemaProbeCache()
  const probe = await probeGrowthHumanExecutionSchemaHealth(admin)
  return {
    ...probe,
    requiredTables: [...GROWTH_HUMAN_EXECUTION_REQUIRED_TABLES],
  }
}
