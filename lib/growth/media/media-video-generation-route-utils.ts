import { NextResponse } from "next/server"

export function mapMediaVideoGenerationError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "generation_failed"
  const status =
    message === "organization_id_required" ||
    message === "script_template_required" ||
    message === "invalid_avatar_id" ||
    message === "avatar_id_required" ||
    message === "invalid_status_transition"
      ? 400
      : message === "generation_not_found"
        ? 404
        : message === "organization_scope_mismatch"
          ? 403
          : 500

  return NextResponse.json({ ok: false, error: message }, { status })
}
