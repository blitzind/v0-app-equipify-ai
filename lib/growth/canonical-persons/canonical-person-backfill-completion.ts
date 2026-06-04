/**
 * Phase 7.2B — Backfill completion verification (client-safe).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_CANONICAL_PERSON_SOURCE_TABLES,
  type GrowthCanonicalPersonBackfillCursor,
  type GrowthCanonicalPersonBackfillVerification,
  type GrowthCanonicalPersonSourceTable,
} from "@/lib/growth/canonical-persons/canonical-person-types"

export type PendingBySource = Record<GrowthCanonicalPersonSourceTable, number>

export async function fetchPendingBySource(
  admin: SupabaseClient,
  countUnlinked: (admin: SupabaseClient, table: GrowthCanonicalPersonSourceTable) => Promise<number>,
): Promise<PendingBySource> {
  const pending_by_source = {} as PendingBySource
  for (const table of GROWTH_CANONICAL_PERSON_SOURCE_TABLES) {
    pending_by_source[table] = await countUnlinked(admin, table)
  }
  return pending_by_source
}

export function sumPendingTotal(pending_by_source: PendingBySource): number {
  return GROWTH_CANONICAL_PERSON_SOURCE_TABLES.reduce(
    (sum, table) => sum + (pending_by_source[table] ?? 0),
    0,
  )
}

export async function verifyCanonicalPersonBackfillComplete(
  admin: SupabaseClient,
  countUnlinked: (admin: SupabaseClient, table: GrowthCanonicalPersonSourceTable) => Promise<number>,
): Promise<GrowthCanonicalPersonBackfillVerification> {
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
  sources: GrowthCanonicalPersonSourceTable[],
): GrowthCanonicalPersonSourceTable | null {
  for (const table of sources) {
    if ((pending_by_source[table] ?? 0) > 0) return table
  }
  return null
}

export function buildResumeCursor(
  pending_by_source: PendingBySource,
  sources: GrowthCanonicalPersonSourceTable[],
  identity_counts: Record<string, number>,
): GrowthCanonicalPersonBackfillCursor | null {
  const table = firstSourceTableWithPending(pending_by_source, sources)
  if (!table) return null
  return {
    source_table: table,
    after_id: null,
    identity_counts,
  }
}

export type ResolveBackfillDoneInput = {
  sources: GrowthCanonicalPersonSourceTable[]
  identity_counts: Record<string, number>
  error_count: number
  verification: GrowthCanonicalPersonBackfillVerification
}

export function resolveBackfillDoneState(input: ResolveBackfillDoneInput): {
  done: boolean
  cursor: GrowthCanonicalPersonBackfillCursor | null
  certification: "pass" | "conditional_pass" | "fail"
} {
  const { verification, sources, identity_counts, error_count } = input

  if (!verification.passed) {
    return {
      done: false,
      cursor: buildResumeCursor(verification.pending_by_source, sources, identity_counts),
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
