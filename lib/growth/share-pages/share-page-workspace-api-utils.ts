/** Growth Engine SP-UX-2 — Share page workspace API helpers (server-only). */

import "server-only"

import { NextResponse } from "next/server"

export function mapGrowthSharePageWorkspaceApiError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)

  const statusMap: Record<string, number> = {
    not_found: 404,
    share_page_not_found: 404,
    share_page_not_approvable: 409,
    share_page_not_editable: 409,
    draft_not_approved: 400,
    organization_scope_mismatch: 403,
    schema_not_ready: 503,
  }

  if (message.startsWith("token_hash_leak")) {
    return NextResponse.json({ ok: false, error: "internal_safety_violation" }, { status: 500 })
  }

  const status = statusMap[message] ?? 500
  return NextResponse.json(
    {
      ok: false,
      error: message,
      message: message.replace(/_/g, " "),
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_execution: false,
      enrollment_execution: false,
    },
    { status },
  )
}

export function growthSharePageWorkspaceSafetyJson(extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    worker_execution_enabled: false,
  }
}
