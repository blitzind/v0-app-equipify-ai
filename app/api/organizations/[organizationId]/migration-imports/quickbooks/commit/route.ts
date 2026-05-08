import { NextResponse } from "next/server"
import { commitQuickBooksHistoricalImport, type QuickBooksHistoricalImportOptions } from "@/lib/integrations/quickbooks/historical-import"
import { requireOrgMigrationAccess } from "@/lib/migration-imports/require-org-migration-access"
import { outcomesForClient } from "@/lib/migration-imports/public-response"
import { resolveImportStrategy } from "@/lib/migration-imports/strategy"

export const runtime = "nodejs"
export const maxDuration = 300

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

  let body: QuickBooksHistoricalImportOptions & { jobId?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Expected JSON." }, { status: 400 })
  }
  const strategy = resolveImportStrategy({ strategy: body.strategy })
  let jobId = body.jobId
  if (jobId && !UUID_RE.test(jobId)) {
    return NextResponse.json({ error: "invalid_job", message: "Invalid import job." }, { status: 400 })
  }

  if (!jobId) {
    const { data: job, error } = await gate.supabase
      .from("organization_import_jobs")
      .insert({
        organization_id: organizationId,
        created_by: gate.userId,
        kind: "quickbooks_snapshot",
        source_system: "quickbooks_online",
        status: "draft",
        file_name: "QuickBooks Online historical import",
        options: { ...body, strategy },
        strategy,
      })
      .select("id")
      .maybeSingle()
    if (error || !job) {
      return NextResponse.json({ error: "job_failed", message: error?.message ?? "Could not create import job." }, { status: 500 })
    }
    jobId = (job as { id: string }).id
  }

  const startedAt = new Date().toISOString()
  await gate.supabase
    .from("organization_import_jobs")
    .update({
      status: "processing",
      started_at: startedAt,
      completed_at: null,
      committed_by: gate.userId,
      options: { ...body, strategy },
      strategy,
      user_message: null,
      processed_count: 0,
    })
    .eq("organization_id", organizationId)
    .eq("id", jobId)

  const { data: log } = await gate.svc
    .from("quickbooks_sync_logs")
    .insert({
      organization_id: organizationId,
      sync_kind: "full_initial",
      direction: "import",
      status: "started",
      detail: {
        source: "migration_center_historical_import",
        entities: body.entities,
        invoiceStartDate: body.invoiceStartDate ?? null,
        invoiceEndDate: body.invoiceEndDate ?? null,
        strategy,
        importJobId: jobId,
      },
    })
    .select("id")
    .maybeSingle()

  try {
    const result = await commitQuickBooksHistoricalImport({
      svc: gate.svc,
      organizationId,
      userId: gate.userId,
      importJobId: jobId,
      options: { ...body, strategy },
    })

    await gate.supabase.from("organization_import_job_rows").delete().eq("import_job_id", jobId)
    const rowPayload = result.outcomes.map((o) => ({
      import_job_id: jobId,
      row_index: o.rowIndex,
      status: o.status,
      codes: o.codes,
      message: o.message,
      entity_kind: o.entityKind ?? null,
      entity_id: o.entityId ?? null,
      snapshot: {
        matchedLabel: o.matchedLabel ?? null,
        source: "quickbooks_online",
      },
    }))
    for (let i = 0; i < rowPayload.length; i += 500) {
      const chunk = rowPayload.slice(i, i + 500)
      if (chunk.length) await gate.supabase.from("organization_import_job_rows").insert(chunk)
    }

    const completedAt = new Date().toISOString()
    await gate.supabase
      .from("organization_import_jobs")
      .update({
        status: result.errorCount > 0 ? "completed_with_errors" : "completed",
        completed_at: completedAt,
        processed_count: result.outcomes.length,
        success_count: result.createdCount,
        updated_count: result.updatedCount,
        skipped_count: result.skippedCount,
        error_count: result.errorCount,
        user_message: `QuickBooks historical import completed. Created ${result.createdCount}, updated ${result.updatedCount}, skipped ${result.skippedCount}, errors ${result.errorCount}.`,
      })
      .eq("organization_id", organizationId)
      .eq("id", jobId)

    if (log) {
      await gate.svc
        .from("quickbooks_sync_logs")
        .update({
          status: result.errorCount > 0 ? "partial" : "success",
          records_attempted: result.outcomes.length,
          records_succeeded: result.createdCount + result.updatedCount,
          error_message: result.errorCount > 0 ? `${result.errorCount} rows had errors.` : null,
          detail: { importJobId: jobId, strategy, source: "migration_center_historical_import", created: result.createdCount, updated: result.updatedCount, skipped: result.skippedCount, errors: result.errorCount },
          completed_at: completedAt,
        })
        .eq("id", (log as { id: string }).id)
    }

    return NextResponse.json({ ok: true, jobId, result: { ...result, outcomes: outcomesForClient(result.outcomes) } })
  } catch (e) {
    const message = e instanceof Error ? e.message : "QuickBooks import failed."
    const completedAt = new Date().toISOString()
    await gate.supabase
      .from("organization_import_jobs")
      .update({ status: "failed", completed_at: completedAt, error_count: 1, user_message: message })
      .eq("organization_id", organizationId)
      .eq("id", jobId)
    if (log) {
      await gate.svc
        .from("quickbooks_sync_logs")
        .update({ status: "failed", records_attempted: 0, records_succeeded: 0, error_message: message, detail: { importJobId: jobId, source: "migration_center_historical_import" }, completed_at: completedAt })
        .eq("id", (log as { id: string }).id)
    }
    return NextResponse.json({ error: "quickbooks_import_failed", message, jobId }, { status: 400 })
  }
}
