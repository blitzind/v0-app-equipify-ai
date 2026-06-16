import { NextResponse } from "next/server"

export function mapMediaBookingHandoffError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "booking_handoff_failed"
  const status =
    message === "organization_id_required" ||
    message === "invalid_qualification_goal" ||
    message === "invalid_status_transition"
      ? 400
      : message === "booking_handoff_not_found"
        ? 404
        : message === "organization_scope_mismatch"
          ? 403
          : 500

  return NextResponse.json({ ok: false, error: message }, { status })
}
