import { NextResponse } from "next/server"
import { requireOrgMigrationAccess } from "@/lib/migration-imports/require-org-migration-access"

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

  const gate = await requireOrgMigrationAccess(organizationId)
  if ("error" in gate) return gate.error

  const { supabase } = gate

  const { data: job, error } = await supabase
    .from("organization_import_jobs")
    .select(
      "kind, source_system, status, file_name, storage_path, column_mapping, options, preview_json, validation_summary, row_count, success_count, error_count, user_message, created_at, started_at, completed_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  }
  if (!job) {
    return NextResponse.json({ error: "not_found", message: "Import job not found." }, { status: 404 })
  }

  return NextResponse.json({
    job: {
      jobId,
      importRef: jobId.replace(/-/g, "").slice(0, 8).toUpperCase(),
      ...(job as Record<string, unknown>),
    },
  })
}
