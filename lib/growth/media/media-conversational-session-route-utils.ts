import { NextResponse } from "next/server"

export function mapMediaConversationalSessionError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "conversation_failed"
  const status =
    message === "organization_id_required" ||
    message === "system_prompt_template_required" ||
    message === "invalid_agent_id" ||
    message === "invalid_qualification_goal" ||
    message === "agent_id_required" ||
    message === "invalid_status_transition"
      ? 400
      : message === "conversation_not_found"
        ? 404
        : message === "organization_scope_mismatch"
          ? 403
          : 500

  return NextResponse.json({ ok: false, error: message }, { status })
}
