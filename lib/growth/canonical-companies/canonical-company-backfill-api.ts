/**
 * Phase 7.2A — Canonical company backfill API (client-safe request/response helpers).
 */

import { z } from "zod"
import {
  GROWTH_CANONICAL_COMPANY_QA_MARKER,
  type GrowthCanonicalCompanyBackfillStats,
} from "@/lib/growth/canonical-companies/canonical-company-types"

export const GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM = "APPLY_GROWTH_CANONICAL_COMPANIES_7_2A" as const

export const GROWTH_CANONICAL_COMPANY_BACKFILL_API_QA_MARKER =
  "growth-canonical-company-backfill-api-7.2a-v1" as const

const RequestSchema = z.object({
  mode: z.enum(["dry_run", "apply"]),
  confirm: z.string().optional(),
})

export type ParsedCanonicalCompanyBackfillRequest =
  | { ok: true; mode: "dry_run" | "apply" }
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

  return { ok: true, mode: parsed.data.mode }
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
  stats: GrowthCanonicalCompanyBackfillStats
  duration_ms: number
}): Record<string, unknown> {
  const warnings = buildCanonicalCompanyBackfillWarnings(input.stats)
  return {
    ok: true,
    qa_marker: GROWTH_CANONICAL_COMPANY_QA_MARKER,
    api_qa_marker: GROWTH_CANONICAL_COMPANY_BACKFILL_API_QA_MARKER,
    mode: input.mode,
    ...resolveCanonicalCompanyRuntimeContext(),
    stats: input.stats,
    warnings,
    duration_ms: input.duration_ms,
    summary: {
      canonical_companies_existing: input.stats.canonical_companies_existing,
      canonical_companies_after: input.stats.canonical_companies_after,
      merge_groups_by_domain: input.stats.merge_groups_by_domain,
      unique_normalized_domains: input.stats.unique_normalized_domains,
      skipped_already_linked: Object.values(input.stats.sources).reduce(
        (sum, s) => sum + s.already_linked,
        0,
      ),
      would_create_new: Object.values(input.stats.sources).reduce(
        (sum, s) => sum + s.would_create_new,
        0,
      ),
    },
  }
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
