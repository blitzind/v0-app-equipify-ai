import "server-only"

import { NextResponse } from "next/server"

export function mapGrowthVideoApiError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)

  const statusMap: Record<string, number> = {
    not_found: 404,
    organization_scope_mismatch: 403,
    invalid_video_mime_type: 400,
    invalid_file_size: 400,
    file_too_large: 400,
    upload_url_unavailable: 503,
    schema_not_ready: 503,
    upload_schema_not_ready: 503,
  pages_schema_not_ready: 503,
  slug_conflict: 409,
  video_not_ready: 400,
  }

  const status = statusMap[message] ?? 500
  return NextResponse.json(
    {
      ok: false,
      error: message,
      message: message.replace(/_/g, " "),
      requires_human_review: true,
      autonomous_execution_enabled: false,
    },
    { status },
  )
}

export function growthVideoSafetyJson(extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }
}
