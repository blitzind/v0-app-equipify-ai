import { NextResponse } from "next/server"
import { requireOrgMemberRead } from "@/lib/catalog/require-org-catalog-write"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; jobId: string }> },
) {
  const { organizationId, jobId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(jobId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgMemberRead(organizationId)
  if ("error" in gate) return gate.error

  const { data: row, error } = await gate.svc
    .from("ai_jobs")
    .select(
      "id, organization_id, task, status, progress_percent, current_step, result_json, error_message, created_at, updated_at, started_at, completed_at, source_type, source_id",
    )
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "load_failed", message: error.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: "not_found", message: "Job not found." }, { status: 404 })
  }

  const status = row.status as string
  const result = row.result_json as Record<string, unknown> | null

  let resultSummary: Record<string, unknown> | null = null
  if (result && typeof result === "object") {
    resultSummary = {
      kind: result.kind,
      importId: result.importId,
      rowCount: result.rowCount,
      warningCount: result.warningCount,
    }
  }

  return NextResponse.json({
    job: {
      id: row.id,
      task: row.task,
      status,
      progress_percent:
        typeof row.progress_percent === "number"
          ? row.progress_percent
          : Number(row.progress_percent ?? 0),
      current_step: typeof row.current_step === "string" ? row.current_step : null,
      error_message: typeof row.error_message === "string" ? row.error_message : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      source_type: row.source_type,
      source_id: row.source_id,
    },
    result_summary: resultSummary,
  })
}
