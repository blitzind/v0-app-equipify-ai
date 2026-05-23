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
