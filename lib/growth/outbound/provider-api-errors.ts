import { looksLikePostgrestMissingSchemaError } from "@/lib/blitzpay/blitzpay-schema-health-detect"

export const GROWTH_PROVIDER_SCHEMA_DRIFT_PUBLIC_MESSAGE =
  "Growth provider connections need a database update before this section can load."

export type GrowthProviderApiErrorPayload = {
  error: string
  message: string
  status: number
}

export function mapGrowthProviderApiError(error: unknown): GrowthProviderApiErrorPayload {
  const detail = error instanceof Error ? error.message : String(error)
  const lower = detail.toLowerCase()

  if (looksLikePostgrestMissingSchemaError(detail)) {
    if (lower.includes("deleted_at") || lower.includes("deleted_by")) {
      return {
        error: "growth_schema_incomplete",
        message:
          "Apply Supabase migration 20270102120000_growth_engine_provider_connection_soft_delete.sql, then reload this page.",
        status: 503,
      }
    }
    if (lower.includes("lifecycle_status") || lower.includes("capability_snapshot")) {
      return {
        error: "growth_schema_incomplete",
        message:
          "Apply Supabase migration 20270101120000_growth_engine_provider_connector.sql, then reload this page.",
        status: 503,
      }
    }
    return {
      error: "growth_schema_incomplete",
      message: GROWTH_PROVIDER_SCHEMA_DRIFT_PUBLIC_MESSAGE,
      status: 503,
    }
  }

  if (lower.includes("permission denied") || lower.includes("42501")) {
    return {
      error: "growth_schema_access",
      message:
        "Growth provider tables are not accessible. Verify Supabase service role grants for the growth schema.",
      status: 503,
    }
  }

  if (detail === "growth_schema_incomplete_soft_delete") {
    return {
      error: "growth_schema_incomplete",
      message:
        "Apply Supabase migration 20270102120000_growth_engine_provider_connection_soft_delete.sql, then reload this page.",
      status: 503,
    }
  }

  return {
    error: "provider_error",
    message: detail || "Provider connection operation failed.",
    status: 500,
  }
}
