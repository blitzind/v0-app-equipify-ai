import { NextResponse } from "next/server"
import { previewQuickBooksHistoricalImport, type QuickBooksHistoricalImportOptions } from "@/lib/integrations/quickbooks/historical-import"
import { requireOrgMigrationAccess } from "@/lib/migration-imports/require-org-migration-access"
import { resolveImportStrategy } from "@/lib/migration-imports/strategy"

export const runtime = "nodejs"
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireOrgMigrationAccess(organizationId)
  if ("error" in gate) return gate.error

  let body: QuickBooksHistoricalImportOptions
  try {
    body = (await request.json()) as QuickBooksHistoricalImportOptions
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Expected JSON." }, { status: 400 })
  }

  try {
    const preview = await previewQuickBooksHistoricalImport(gate.svc, organizationId, body)
    const strategy = resolveImportStrategy({ strategy: body.strategy })
    const { data: job, error } = await gate.supabase
      .from("organization_import_jobs")
      .insert({
        organization_id: organizationId,
        created_by: gate.userId,
        kind: "quickbooks_snapshot",
        source_system: "quickbooks_online",
        status: "draft",
        file_name: "QuickBooks Online historical import",
        storage_path: null,
        column_mapping: {},
        options: { ...body, strategy },
        preview_json: preview,
        validation_summary: {
          sourceType: "quickbooks_online",
          strategy,
          dateRange: preview.dateRange,
          breakdown: preview.breakdown,
          warnings: preview.warnings,
        },
        row_count: Object.values(preview.breakdown).reduce((sum, b) => sum + b.total, 0),
        strategy,
        user_message: "Previewed historical QuickBooks import. QuickBooks has not been modified.",
      })
      .select("id")
      .maybeSingle()
    if (error || !job) {
      return NextResponse.json({ error: "job_failed", message: error?.message ?? "Could not create import job." }, { status: 500 })
    }
    return NextResponse.json({ ok: true, jobId: (job as { id: string }).id, preview, strategy })
  } catch (e) {
    return NextResponse.json(
      { error: "quickbooks_preview_failed", message: e instanceof Error ? e.message : "QuickBooks preview failed." },
      { status: 400 },
    )
  }
}
