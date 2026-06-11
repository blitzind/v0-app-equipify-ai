/** Shared Apollo queue loader helpers — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  APOLLO_QUEUE_MAX_SCAN,
  paginateApolloQueueItems,
  type ApolloQueuePaginatedResult,
  type ApolloQueuePaginationInput,
} from "@/lib/growth/apollo/apollo-queue-pagination"

export async function loadApolloQueueRows(
  admin: SupabaseClient,
  input: {
    table: string
    status?: string | "all"
    statusColumn?: string
    company_candidate_id?: string | null
    extraFilters?: Array<{ column: string; value: string }>
    scanLimit?: number
  },
): Promise<Record<string, unknown>[]> {
  let query = admin
    .schema("growth")
    .from(input.table)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input.scanLimit ?? APOLLO_QUEUE_MAX_SCAN)

  if (input.company_candidate_id?.trim()) {
    query = query.eq("company_candidate_id", input.company_candidate_id.trim())
  }

  for (const filter of input.extraFilters ?? []) {
    query = query.eq(filter.column, filter.value)
  }

  const statusColumn = input.statusColumn ?? "status"
  if (input.status && input.status !== "all") {
    query = query.eq(statusColumn, input.status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Record<string, unknown>[]
}

export function paginateMappedApolloQueueRows<T extends {
  company_name?: string | null
  full_name?: string | null
  created_at?: string | null
  qualification_score?: number | null
}>(
  rows: T[],
  pagination?: ApolloQueuePaginationInput,
): ApolloQueuePaginatedResult<T> {
  return paginateApolloQueueItems(rows, pagination)
}
