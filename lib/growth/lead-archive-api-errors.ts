import { looksLikePostgrestMissingSchemaError } from "@/lib/blitzpay/blitzpay-schema-health-detect"

export const GROWTH_LEAD_ARCHIVE_SCHEMA_MIGRATION =
  "20270120120000_growth_leads_archive_fields.sql"

export const GROWTH_LEAD_ARCHIVE_SCHEMA_PUBLIC_MESSAGE =
  "Lead archive fields are not installed yet. Apply the latest migration."

export class GrowthLeadArchiveSchemaIncompleteError extends Error {
  constructor(message = GROWTH_LEAD_ARCHIVE_SCHEMA_PUBLIC_MESSAGE) {
    super(message)
    this.name = "GrowthLeadArchiveSchemaIncompleteError"
  }
}

export type GrowthLeadArchiveApiErrorPayload = {
  error: string
  message: string
  status: number
}

export function mapGrowthLeadArchiveApiError(error: unknown): GrowthLeadArchiveApiErrorPayload {
  if (error instanceof GrowthLeadArchiveSchemaIncompleteError) {
    return {
      error: "growth_lead_archive_schema_incomplete",
      message: error.message,
      status: 503,
    }
  }

  const detail = error instanceof Error ? error.message : String(error)
  const lower = detail.toLowerCase()

  if (
    detail === "growth_lead_archive_schema_incomplete" ||
    (looksLikePostgrestMissingSchemaError(detail) &&
      (lower.includes("archived_at") || lower.includes("archived_by") || lower.includes("archive_reason")))
  ) {
    return {
      error: "growth_lead_archive_schema_incomplete",
      message: GROWTH_LEAD_ARCHIVE_SCHEMA_PUBLIC_MESSAGE,
      status: 503,
    }
  }

  return {
    error: "archive_failed",
    message: detail || "Could not archive growth lead.",
    status: 500,
  }
}

export function isGrowthLeadArchiveSchemaIncompleteErrorCode(code: string | undefined): boolean {
  return code === "growth_lead_archive_schema_incomplete"
}
