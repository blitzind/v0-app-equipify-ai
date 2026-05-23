import type { SupabaseClient } from "@supabase/supabase-js"

/** Growth provider connection table (service-role, growth schema). */
export function growthEmailProviderConnectionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("email_provider_connections")
}

/**
 * PostgREST `.is()` exists on filter builders returned by `.select()` / `.update()`,
 * not on the table query builder from `.from()`. Always call after select/update.
 */
export function withActiveProviderConnectionScope<
  T extends { is: (column: string, value: null) => T },
>(query: T, softDelete: boolean): T {
  if (softDelete) {
    return query.is("deleted_at", null)
  }
  return query
}

/** Defense-in-depth when soft-delete columns are selected. */
export function isActiveProviderConnectionRow(row: { deleted_at?: string | null | undefined }): boolean {
  return row.deleted_at == null
}

export function filterActiveProviderConnectionRows<T extends { deleted_at?: string | null | undefined }>(
  rows: T[],
  softDelete: boolean,
): T[] {
  if (!softDelete) return rows
  return rows.filter(isActiveProviderConnectionRow)
}
