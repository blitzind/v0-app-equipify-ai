import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_RUNTIME_GUARDRAILS_SCHEMA_MIGRATION,
  GROWTH_RUNTIME_GUARDRAILS_SCHEMA_TABLES,
} from "@/lib/growth/runtime-guardrails/schema-health"

export const GROWTH_RUNTIME_GUARDRAILS_1C_SCHEMA_MIGRATION =
  "20270901130000_growth_runtime_guardrails_gs_rg_1c.sql" as const

export const GROWTH_RUNTIME_GUARDRAILS_1C_SCHEMA_TABLES = [
  "growth.runtime_user_budgets",
  "growth.runtime_health_counters",
] as const

export type GrowthRuntimeSchemaStatus = "READY" | "WARN" | "MISSING"

export type GrowthRuntimeSchemaProbeResult = {
  status: GrowthRuntimeSchemaStatus
  missingResources: string[]
  partialResources: string[]
  migrations: {
    gsRg1: string
    gsRg1c: string
  }
}

function isMissingTableError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("does not exist") ||
    lower.includes("could not find the table") ||
    lower.includes("schema cache") ||
    lower.includes("relation") && lower.includes("not exist")
  )
}

export async function probeRuntimeTable(
  admin: SupabaseClient,
  tableName: string,
): Promise<{ ok: boolean; missing: boolean; error: string | null }> {
  const { error } = await admin.schema("growth").from(tableName).select("*").limit(1)
  if (!error) return { ok: true, missing: false, error: null }
  if (isMissingTableError(error.message)) return { ok: false, missing: true, error: error.message }
  return { ok: false, missing: false, error: error.message }
}

export async function probeRuntimeGuardrailSchema(
  admin: SupabaseClient,
): Promise<GrowthRuntimeSchemaProbeResult> {
  const missingResources: string[] = []
  const partialResources: string[] = []

  for (const qualified of GROWTH_RUNTIME_GUARDRAILS_SCHEMA_TABLES) {
    const tableName = qualified.replace("growth.", "")
    const probe = await probeRuntimeTable(admin, tableName)
    if (probe.missing) missingResources.push(qualified)
    else if (!probe.ok && probe.error) partialResources.push(`${qualified}:${probe.error}`)
  }

  let gsRg1cMissing = 0
  for (const qualified of GROWTH_RUNTIME_GUARDRAILS_1C_SCHEMA_TABLES) {
    const tableName = qualified.replace("growth.", "")
    const probe = await probeRuntimeTable(admin, tableName)
    if (probe.missing) {
      gsRg1cMissing += 1
      partialResources.push(qualified)
    } else if (!probe.ok && probe.error) {
      partialResources.push(`${qualified}:${probe.error}`)
    }
  }

  let status: GrowthRuntimeSchemaStatus = "READY"
  if (missingResources.length > 0) {
    status = missingResources.length >= GROWTH_RUNTIME_GUARDRAILS_SCHEMA_TABLES.length ? "MISSING" : "WARN"
  } else if (gsRg1cMissing > 0 || partialResources.length > 0) {
    status = "WARN"
  }

  return {
    status,
    missingResources,
    partialResources,
    migrations: {
      gsRg1: GROWTH_RUNTIME_GUARDRAILS_SCHEMA_MIGRATION,
      gsRg1c: GROWTH_RUNTIME_GUARDRAILS_1C_SCHEMA_MIGRATION,
    },
  }
}

export async function safeRuntimeQuery<T>(
  input: {
    resource: string
    probe: GrowthRuntimeSchemaProbeResult
    execute: () => Promise<T>
    fallback: T
    onFailure?: (message: string) => void
  },
): Promise<T> {
  if (input.probe.missingResources.some((r) => input.resource.startsWith(r.replace("growth.", "")) || input.resource === r)) {
    return input.fallback
  }
  try {
    return await input.execute()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isMissingTableError(message)) return input.fallback
    input.onFailure?.(message)
    return input.fallback
  }
}
