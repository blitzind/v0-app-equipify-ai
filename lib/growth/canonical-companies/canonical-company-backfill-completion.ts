/**
 * Phase 7.2A — Backfill completion verification (client-safe).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_CANONICAL_COMPANY_SOURCE_TABLES,
  type GrowthCanonicalCompanyBackfillCursor,
  type GrowthCanonicalCompanyBackfillVerification,
  type GrowthCanonicalCompanySourceTable,
} from "@/lib/growth/canonical-companies/canonical-company-types"

export type PendingBySource = Record<GrowthCanonicalCompanySourceTable, number>

export async function fetchPendingBySource(
  admin: SupabaseClient,
  countUnlinked: (admin: SupabaseClient, table: GrowthCanonicalCompanySourceTable) => Promise<number>,
): Promise<PendingBySource> {
  const pending_by_source = {} as PendingBySource
  for (const table of GROWTH_CANONICAL_COMPANY_SOURCE_TABLES) {
    pending_by_source[table] = await countUnlinked(admin, table)
  }
  return pending_by_source
}

export function sumPendingTotal(pending_by_source: PendingBySource): number {
  return GROWTH_CANONICAL_COMPANY_SOURCE_TABLES.reduce((sum, table) => sum + (pending_by_source[table] ?? 0), 0)
}

export async function verifyCanonicalCompanyBackfillComplete(
  admin: SupabaseClient,
  countUnlinked: (admin: SupabaseClient, table: GrowthCanonicalCompanySourceTable) => Promise<number>,
): Promise<GrowthCanonicalCompanyBackfillVerification> {
  const pending_by_source = await fetchPendingBySource(admin, countUnlinked)
  const pending_total = sumPendingTotal(pending_by_source)
  return {
    passed: pending_total === 0,
    pending_by_source,
    pending_total,
  }
}

export function firstSourceTableWithPending(
  pending_by_source: PendingBySource,
  sources: GrowthCanonicalCompanySourceTable[],
): GrowthCanonicalCompanySourceTable | null {
  for (const table of sources) {
    if ((pending_by_source[table] ?? 0) > 0) return table
  }
  return null
}

export function buildResumeCursor(
  pending_by_source: PendingBySource,
  sources: GrowthCanonicalCompanySourceTable[],
  domain_counts: Record<string, number>,
): GrowthCanonicalCompanyBackfillCursor | null {
  const table = firstSourceTableWithPending(pending_by_source, sources)
  if (!table) return null
  return {
    source_table: table,
    after_id: null,
    domain_counts,
  }
}

export type ResolveBackfillDoneInput = {
  sources: GrowthCanonicalCompanySourceTable[]
  domain_counts: Record<string, number>
  error_count: number
  verification: GrowthCanonicalCompanyBackfillVerification
}

export function resolveBackfillDoneState(input: ResolveBackfillDoneInput): {
  done: boolean
  cursor: GrowthCanonicalCompanyBackfillCursor | null
  certification: "pass" | "conditional_pass" | "fail"
} {
  const { verification, sources, domain_counts, error_count } = input

  if (!verification.passed) {
    return {
      done: false,
      cursor: buildResumeCursor(verification.pending_by_source, sources, domain_counts),
      certification: "fail",
    }
  }

  if (error_count > 0) {
    return {
      done: true,
      cursor: null,
      certification: "conditional_pass",
    }
  }

  return {
    done: true,
    cursor: null,
    certification: "pass",
  }
}
