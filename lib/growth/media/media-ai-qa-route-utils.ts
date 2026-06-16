import { NextResponse } from "next/server"

export function mapMediaAiQaError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "qa_failed"
  const status =
    message === "organization_id_required" ||
    message === "question_template_required" ||
    message === "invalid_policy_id" ||
    message === "invalid_knowledge_source_refs" ||
    message === "invalid_status_transition"
      ? 400
      : message === "qa_session_not_found"
        ? 404
        : message === "organization_scope_mismatch"
          ? 403
          : 500

  return NextResponse.json({ ok: false, error: message }, { status })
}
