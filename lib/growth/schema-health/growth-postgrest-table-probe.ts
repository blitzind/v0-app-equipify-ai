/**
 * PostgREST-backed Growth schema probes — object existence, not migration filenames.
 * Server-only.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { looksLikePostgrestMissingSchemaError } from "@/lib/blitzpay/blitzpay-schema-health-detect"
import {
  summarizeGrowthSchemaProbeResults,
  type GrowthSchemaHealthSummary,
  type GrowthSchemaObjectProbe,
  type GrowthSchemaProbeOutcome,
} from "@/lib/growth/schema-health/growth-schema-health-types"

export { summarizeGrowthSchemaProbeResults } from "@/lib/growth/schema-health/growth-schema-health-types"

export const GROWTH_SCHEMA_HEALTH_PROBE_CACHE_MS = 15_000

type TableProbeOutcome = GrowthSchemaProbeOutcome

const cache = new Map<string, { expiresAt: number; result: GrowthSchemaHealthSummary }>()

function isPostgrestSchemaCacheStaleError(message: string, code?: string): boolean {
  const m = message.toLowerCase()
  if (code === "PGRST205") return true
  if (m.includes("schema cache") && m.includes("could not find")) return true
  return false
}

export function isGrowthPostgrestMissingTableError(message: string, code?: string): boolean {
  if (isDefinitiveMissingObjectError(message, code)) return true
  return isPostgrestSchemaCacheStaleError(message, code)
}

/** Real PostgREST SELECT probe — head/count probes can false-positive when a table is absent from the API cache. */
export async function probeGrowthTablePostgrestAccessible(
  admin: SupabaseClient,
  table: string,
  columns: string[] = ["id"],
): Promise<boolean> {
  const { error } = await admin.schema("growth").from(table).select(columns.join(", ")).limit(0)
  if (!error) return true
  return false
}

function isDefinitiveMissingObjectError(message: string, code?: string): boolean {
  if (code === "42P01" || code === "42703") return true
  const m = message.toLowerCase()
  if (m.includes("does not exist") && (m.includes("relation") || m.includes("column"))) return true
  return false
}

function classifyProbeError(message: string, code?: string): TableProbeOutcome {
  if (isDefinitiveMissingObjectError(message, code)) return "missing"
  if (isPostgrestSchemaCacheStaleError(message, code)) return "uncertain"
  if (looksLikePostgrestMissingSchemaError(message, code)) return "uncertain"
  return "uncertain"
}

async function probeTableViaPostgrestClient(
  admin: SupabaseClient,
  table: string,
  columns: string[],
): Promise<TableProbeOutcome> {
  const { error } = await admin.schema("growth").from(table).select(columns.join(", ")).limit(0)
  if (!error) return "detected"
  return classifyProbeError(error.message ?? String(error), error.code)
}

async function probeTableViaRest(table: string, columns: string[]): Promise<TableProbeOutcome> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return "uncertain"

  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(columns.join(","))}&limit=0`, {
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
    return classifyProbeError(body.message ?? res.statusText, body.code)
  } catch {
    return "uncertain"
  }
}

async function probeSchemaObject(
  admin: SupabaseClient,
  object: GrowthSchemaObjectProbe,
): Promise<TableProbeOutcome> {
  const viaClient = await probeTableViaPostgrestClient(admin, object.table, object.columns)
  if (viaClient === "detected" || viaClient === "missing") return viaClient
  const viaRest = await probeTableViaRest(object.table, object.columns)
  if (viaRest === "detected" || viaRest === "missing") return viaRest
  return "uncertain"
}

export async function probeGrowthSchemaObjects(
  admin: SupabaseClient,
  input: {
    cacheKey: string
    featureLabel: string
    objects: GrowthSchemaObjectProbe[]
  },
): Promise<GrowthSchemaHealthSummary> {
  const cached = cache.get(input.cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.result

  const outcomes = await Promise.all(input.objects.map((object) => probeSchemaObject(admin, object)))
  const result = summarizeGrowthSchemaProbeResults({
    featureLabel: input.featureLabel,
    objects: input.objects,
    outcomes,
  })

  cache.set(input.cacheKey, { expiresAt: Date.now() + GROWTH_SCHEMA_HEALTH_PROBE_CACHE_MS, result })
  return result
}

export function invalidateGrowthSchemaHealthCache(cacheKeyPrefix?: string): void {
  if (!cacheKeyPrefix) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.startsWith(cacheKeyPrefix)) cache.delete(key)
  }
}

export const GROWTH_CONTACT_DISCOVERY_SCHEMA_OBJECTS = [
  { table: "contact_discovery_runs", columns: ["id", "company_candidate_id", "status"], label: "growth.contact_discovery_runs" },
  { table: "contact_candidates", columns: ["id", "company_candidate_id", "full_name", "confidence"], label: "growth.contact_candidates" },
  { table: "buying_committees", columns: ["id", "company_id", "coverage_score"], label: "growth.buying_committees" },
  { table: "buying_committee_members", columns: ["id", "committee_id", "committee_role"], label: "growth.buying_committee_members" },
] as const

export const GROWTH_COMPANY_CONTACTS_SCHEMA_OBJECTS = [
  {
    table: "company_contacts",
    columns: ["id", "company_id", "full_name", "confidence_score", "decision_maker_score", "contact_status"],
    label: "growth.company_contacts",
  },
] as const

export const GROWTH_COMPANY_SIGNAL_SCHEMA_OBJECTS = [
  { table: "company_signal_runs", columns: ["id", "company_candidate_id", "status"], label: "growth.company_signal_runs" },
  { table: "company_signals", columns: ["id", "run_id", "company_candidate_id", "signal_type", "confidence"], label: "growth.company_signals" },
] as const

export const GROWTH_COMPANY_GROWTH_SIGNALS_SCHEMA_OBJECTS = [
  { table: "company_growth_signals", columns: ["id", "company_id", "signal_type", "confidence_score"], label: "growth.company_growth_signals" },
  { table: "company_evidence_sources", columns: ["id", "company_id", "source_type"], label: "growth.company_evidence_sources" },
] as const
