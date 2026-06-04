/**
 * Phase 7.2B — Canonical person backfill API (client-safe request/response helpers).
 */

import { z } from "zod"
import {
  GROWTH_CANONICAL_PERSON_QA_MARKER,
  GROWTH_CANONICAL_PERSON_BACKFILL_DEFAULT_BATCH_SIZE,
  GROWTH_CANONICAL_PERSON_BACKFILL_MAX_BATCH_SIZE,
  GROWTH_CANONICAL_PERSON_SOURCE_TABLES,
  type GrowthCanonicalPersonBackfillCursor,
  type GrowthCanonicalPersonBackfillErrorRow,
  type GrowthCanonicalPersonBackfillResult,
  type GrowthCanonicalPersonBackfillStats,
} from "@/lib/growth/canonical-persons/canonical-person-types"

export const GROWTH_CANONICAL_PERSON_APPLY_CONFIRM = "APPLY_GROWTH_CANONICAL_PERSONS_7_2B" as const

export const GROWTH_CANONICAL_PERSON_BACKFILL_API_QA_MARKER =
  "growth-canonical-person-backfill-api-7.2b-v1" as const

const CursorSchema = z.object({
  source_table: z.enum(GROWTH_CANONICAL_PERSON_SOURCE_TABLES),
  after_id: z.string().uuid().nullable(),
  identity_counts: z.record(z.string(), z.number()).optional().default({}),
})

const RequestSchema = z.object({
  mode: z.enum(["dry_run", "apply"]),
  confirm: z.string().optional(),
  batch_size: z.number().int().min(1).max(GROWTH_CANONICAL_PERSON_BACKFILL_MAX_BATCH_SIZE).optional(),
  cursor: CursorSchema.nullable().optional(),
})

export type ParsedCanonicalPersonBackfillRequest =
  | {
      ok: true
      mode: "dry_run" | "apply"
      batchSize: number
      cursor: GrowthCanonicalPersonBackfillCursor | null
    }
  | { ok: false; error: string; message: string }

export function parseCanonicalPersonBackfillRequest(body: unknown): ParsedCanonicalPersonBackfillRequest {
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_body",
      message: 'Body must include mode: "dry_run" or "apply".',
    }
  }

  if (parsed.data.mode === "apply") {
    if (parsed.data.confirm !== GROWTH_CANONICAL_PERSON_APPLY_CONFIRM) {
      return {
        ok: false,
        error: "confirm_required",
        message: `Apply requires confirm: "${GROWTH_CANONICAL_PERSON_APPLY_CONFIRM}".`,
      }
    }
  }

  const batchSize = parsed.data.batch_size ?? GROWTH_CANONICAL_PERSON_BACKFILL_DEFAULT_BATCH_SIZE
  const cursor = parsed.data.cursor
    ? {
        source_table: parsed.data.cursor.source_table,
        after_id: parsed.data.cursor.after_id,
        identity_counts: parsed.data.cursor.identity_counts ?? {},
      }
    : null

  return { ok: true, mode: parsed.data.mode, batchSize, cursor }
}

export function mergeCanonicalPersonBackfillErrorRows(
  cumulative: GrowthCanonicalPersonBackfillErrorRow[],
  chunk: GrowthCanonicalPersonBackfillErrorRow[],
): GrowthCanonicalPersonBackfillErrorRow[] {
  return [...cumulative, ...chunk]
}

export function mergeCanonicalPersonBackfillStats(
  cumulative: GrowthCanonicalPersonBackfillStats,
  chunk: GrowthCanonicalPersonBackfillStats,
): GrowthCanonicalPersonBackfillStats {
  const merged = { ...cumulative, sources: { ...cumulative.sources } }
  for (const table of GROWTH_CANONICAL_PERSON_SOURCE_TABLES) {
    const a = cumulative.sources[table]
    const b = chunk.sources[table]
    merged.sources[table] = {
      rows_processed: a.rows_processed + b.rows_processed,
      already_linked: a.already_linked + b.already_linked,
      resolved_normalized_email: a.resolved_normalized_email + b.resolved_normalized_email,
      resolved_normalized_linkedin: a.resolved_normalized_linkedin + b.resolved_normalized_linkedin,
      resolved_normalized_phone: a.resolved_normalized_phone + b.resolved_normalized_phone,
      resolved_name_company: a.resolved_name_company + b.resolved_name_company,
      would_create_new: a.would_create_new + b.would_create_new,
      errors: a.errors + b.errors,
    }
  }
  merged.merge_groups_by_email = chunk.merge_groups_by_email
  merged.unique_normalized_emails = chunk.unique_normalized_emails
  merged.canonical_persons_after = chunk.canonical_persons_after
  return merged
}

export function resolveCanonicalPersonRuntimeContext(): {
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

export function buildCanonicalPersonBackfillWarnings(stats: GrowthCanonicalPersonBackfillStats): string[] {
  const warnings: string[] = []
  for (const table of GROWTH_CANONICAL_PERSON_SOURCE_TABLES) {
    const source = stats.sources[table]
    if (source.errors > 0) {
      warnings.push(`${table}: ${source.errors} error(s) during processing`)
    }
  }
  if (stats.merge_groups_by_email > 0) {
    warnings.push(`${stats.merge_groups_by_email} email group(s) with multiple staging contacts`)
  }
  return warnings
}

export function buildCanonicalPersonBackfillApiResponse(input: {
  mode: "dry_run" | "apply"
  result: GrowthCanonicalPersonBackfillResult
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
  const warnings = buildCanonicalPersonBackfillWarnings(stats)
  const errors = totalErrorsFromStats(stats)

  return {
    ok: true,
    qa_marker: GROWTH_CANONICAL_PERSON_QA_MARKER,
    api_qa_marker: GROWTH_CANONICAL_PERSON_BACKFILL_API_QA_MARKER,
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
    ...resolveCanonicalPersonRuntimeContext(),
    stats,
    warnings,
    duration_ms: input.duration_ms,
    summary: {
      canonical_persons_existing: stats.canonical_persons_existing,
      canonical_persons_after: stats.canonical_persons_after,
      merge_groups_by_email: stats.merge_groups_by_email,
      unique_normalized_emails: stats.unique_normalized_emails,
      skipped_already_linked: Object.values(stats.sources).reduce((sum, s) => sum + s.already_linked, 0),
      would_create_new: Object.values(stats.sources).reduce((sum, s) => sum + s.would_create_new, 0),
      processed_in_chunk: progress.processed_in_chunk,
      batch_size: progress.batch_size,
      errors,
      error_row_count: error_rows.length,
    },
  }
}

function totalErrorsFromStats(stats: GrowthCanonicalPersonBackfillStats): number {
  return GROWTH_CANONICAL_PERSON_SOURCE_TABLES.reduce((sum, table) => sum + stats.sources[table].errors, 0)
}

export function canonicalPersonBackfillResponseExcludesSecrets(payload: Record<string, unknown>): boolean {
  const raw = JSON.stringify(payload).toLowerCase()
  return (
    !raw.includes("service_role") &&
    !raw.includes("supabase_service_role_key") &&
    !raw.includes("eyj")
  )
}
