/**
 * Phase 7.2A — Canonical company backfill API (client-safe request/response helpers).
 */

import { z } from "zod"
import {
  GROWTH_CANONICAL_COMPANY_QA_MARKER,
  GROWTH_CANONICAL_COMPANY_BACKFILL_DEFAULT_BATCH_SIZE,
  GROWTH_CANONICAL_COMPANY_BACKFILL_MAX_BATCH_SIZE,
  GROWTH_CANONICAL_COMPANY_SOURCE_TABLES,
  type GrowthCanonicalCompanyBackfillCursor,
  type GrowthCanonicalCompanyBackfillErrorRow,
  type GrowthCanonicalCompanyBackfillResult,
  type GrowthCanonicalCompanyBackfillStats,
} from "@/lib/growth/canonical-companies/canonical-company-types"

export const GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM = "APPLY_GROWTH_CANONICAL_COMPANIES_7_2A" as const

export const GROWTH_CANONICAL_COMPANY_BACKFILL_API_QA_MARKER =
  "growth-canonical-company-backfill-api-7.2a-v1" as const

const CursorSchema = z.object({
  source_table: z.enum(GROWTH_CANONICAL_COMPANY_SOURCE_TABLES),
  after_id: z.string().uuid().nullable(),
  domain_counts: z.record(z.string(), z.number()).optional().default({}),
})

const RequestSchema = z.object({
  mode: z.enum(["dry_run", "apply"]),
  confirm: z.string().optional(),
  batch_size: z.number().int().min(1).max(GROWTH_CANONICAL_COMPANY_BACKFILL_MAX_BATCH_SIZE).optional(),
  cursor: CursorSchema.nullable().optional(),
})

export type ParsedCanonicalCompanyBackfillRequest =
  | {
      ok: true
      mode: "dry_run" | "apply"
      batchSize: number
      cursor: GrowthCanonicalCompanyBackfillCursor | null
    }
  | { ok: false; error: string; message: string }

export function parseCanonicalCompanyBackfillRequest(
  body: unknown,
): ParsedCanonicalCompanyBackfillRequest {
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_body",
      message: 'Body must include mode: "dry_run" or "apply".',
    }
  }

  if (parsed.data.mode === "apply") {
    if (parsed.data.confirm !== GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM) {
      return {
        ok: false,
        error: "confirm_required",
        message: `Apply requires confirm: "${GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM}".`,
      }
    }
  }

  const batchSize = parsed.data.batch_size ?? GROWTH_CANONICAL_COMPANY_BACKFILL_DEFAULT_BATCH_SIZE
  const cursor = parsed.data.cursor
    ? {
        source_table: parsed.data.cursor.source_table,
        after_id: parsed.data.cursor.after_id,
        domain_counts: parsed.data.cursor.domain_counts ?? {},
      }
    : null

  return { ok: true, mode: parsed.data.mode, batchSize, cursor }
}

export function mergeCanonicalCompanyBackfillErrorRows(
  cumulative: GrowthCanonicalCompanyBackfillErrorRow[],
  chunk: GrowthCanonicalCompanyBackfillErrorRow[],
): GrowthCanonicalCompanyBackfillErrorRow[] {
  return [...cumulative, ...chunk]
}

export function mergeCanonicalCompanyBackfillStats(
  cumulative: GrowthCanonicalCompanyBackfillStats,
  chunk: GrowthCanonicalCompanyBackfillStats,
): GrowthCanonicalCompanyBackfillStats {
  const merged = { ...cumulative, sources: { ...cumulative.sources } }
  for (const table of GROWTH_CANONICAL_COMPANY_SOURCE_TABLES) {
    const a = cumulative.sources[table]
    const b = chunk.sources[table]
    merged.sources[table] = {
      rows_processed: a.rows_processed + b.rows_processed,
      already_linked: a.already_linked + b.already_linked,
      resolved_normalized_domain: a.resolved_normalized_domain + b.resolved_normalized_domain,
      resolved_domain_alias: a.resolved_domain_alias + b.resolved_domain_alias,
      resolved_name_city: a.resolved_name_city + b.resolved_name_city,
      resolved_name_state: a.resolved_name_state + b.resolved_name_state,
      would_create_new: a.would_create_new + b.would_create_new,
      review_tier: a.review_tier + b.review_tier,
      errors: a.errors + b.errors,
    }
  }
  merged.merge_groups_by_domain = chunk.merge_groups_by_domain
  merged.unique_normalized_domains = chunk.unique_normalized_domains
  merged.canonical_companies_after = chunk.canonical_companies_after
  return merged
}

export function resolveCanonicalCompanyRuntimeContext(): {
  target_schema: "growth"
  supabase_project_ref: string | null
  deployment_environment: string
} {
  const vercel = process.env.VERCEL_ENV?.trim()
  let deployment_environment = "unknown"
  if (vercel === "production" || vercel === "preview" || vercel === "development") {
    deployment_environment = vercel
  } else if (process.env.NODE_ENV === "production") {
    deployment_environment = "production"
  } else if (process.env.NODE_ENV === "development") {
    deployment_environment = "development"
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  let supabase_project_ref: string | null = null
  if (url) {
    try {
      const match = new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)
      supabase_project_ref = match?.[1] ?? null
    } catch {
      supabase_project_ref = null
    }
  }

  return {
    target_schema: "growth",
    supabase_project_ref,
    deployment_environment,
  }
}

export function buildCanonicalCompanyBackfillWarnings(
  stats: GrowthCanonicalCompanyBackfillStats,
): string[] {
  const warnings: string[] = []
  for (const table of Object.keys(stats.sources) as (keyof typeof stats.sources)[]) {
    const source = stats.sources[table]
    if (source.review_tier > 0) {
      warnings.push(`${table}: ${source.review_tier} review-tier (name+city/state) resolution(s)`)
    }
    if (source.errors > 0) {
      warnings.push(`${table}: ${source.errors} error(s) during processing`)
    }
  }
  if (stats.merge_groups_by_domain > 0) {
    warnings.push(`${stats.merge_groups_by_domain} domain group(s) with multiple staging candidates`)
  }
  return warnings
}

export function buildCanonicalCompanyBackfillApiResponse(input: {
  mode: "dry_run" | "apply"
  result: GrowthCanonicalCompanyBackfillResult
  duration_ms: number
}): Record<string, unknown> {
  const {
    stats,
    done,
    cursor,
    progress,
    pending_by_source,
    pending_total,
    error_rows,
    verification,
    certification,
  } = input.result
  const warnings = buildCanonicalCompanyBackfillWarnings(stats)
  const errors = totalErrorsFromStats(stats)

  return {
    ok: true,
    qa_marker: GROWTH_CANONICAL_COMPANY_QA_MARKER,
    api_qa_marker: GROWTH_CANONICAL_COMPANY_BACKFILL_API_QA_MARKER,
    mode: input.mode,
    done,
    cursor,
    progress,
    pending_by_source,
    pending_total,
    error_rows,
    errors,
    verification,
    certification,
    ...resolveCanonicalCompanyRuntimeContext(),
    stats,
    warnings,
    duration_ms: input.duration_ms,
    summary: {
      canonical_companies_existing: stats.canonical_companies_existing,
      canonical_companies_after: stats.canonical_companies_after,
      merge_groups_by_domain: stats.merge_groups_by_domain,
      unique_normalized_domains: stats.unique_normalized_domains,
      skipped_already_linked: Object.values(stats.sources).reduce(
        (sum, s) => sum + s.already_linked,
        0,
      ),
      would_create_new: Object.values(stats.sources).reduce(
        (sum, s) => sum + s.would_create_new,
        0,
      ),
      processed_in_chunk: progress.processed_in_chunk,
      batch_size: progress.batch_size,
      errors,
      error_row_count: error_rows.length,
    },
  }
}

function totalErrorsFromStats(stats: GrowthCanonicalCompanyBackfillStats): number {
  return (
    stats.sources.external_company_candidates.errors +
    stats.sources.real_world_company_candidates.errors +
    stats.sources.discovery_candidates.errors
  )
}

/** Returns true when serialized API payload must not include secrets. */
export function canonicalCompanyBackfillResponseExcludesSecrets(payload: Record<string, unknown>): boolean {
  const raw = JSON.stringify(payload).toLowerCase()
  return (
    !raw.includes("service_role") &&
    !raw.includes("supabase_service_role_key") &&
    !raw.includes("eyj")
  )
}
