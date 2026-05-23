import "server-only"

/** Map Postgres/Supabase errors to API-friendly import failure messages. */
export function growthImportErrorMessage(error: unknown): { status: number; error: string; message: string } {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (lower.includes("missing supabase_service_role_key")) {
    return {
      status: 503,
      error: "server_config",
      message:
        "SUPABASE_SERVICE_ROLE_KEY is not configured. Growth import requires the service role client for growth schema access.",
    }
  }

  if (lower.includes("permission denied") && lower.includes("lead_import")) {
    return {
      status: 503,
      error: "schema_grants_missing",
      message:
        "Growth import tables are not granted to service_role. Apply migration 20261229130000_growth_engine_import_batches_service_role_grants.sql.",
    }
  }

  return { status: 500, error: "operation_failed", message }
}
