import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { appendGrowthImportBatchEvent } from "@/lib/growth/import/batch-events-repository"
import {
  createGrowthImportBatch,
  listGrowthImportBatches,
  updateGrowthImportBatch,
} from "@/lib/growth/import/batch-repository"
import { GROWTH_IMPORT_MAX_BYTES, GROWTH_IMPORT_VENDOR_SCHEMA_VERSION } from "@/lib/growth/import/constants"
import { growthImportErrorMessage } from "@/lib/growth/import/errors"
import { initializeGrowthImportBatchFromUpload } from "@/lib/growth/import/pipeline"
import { uploadGrowthImportCsv } from "@/lib/growth/import/storage"
import { GROWTH_IMPORT_BATCH_STATUSES } from "@/lib/growth/import/types"
import { getImportVendorAdapter } from "@/lib/growth/import/vendors/registry"

export const runtime = "nodejs"
export const maxDuration = 120

const optionalText = z.string().trim().max(200).optional().nullable()

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const statusParam = url.searchParams.get("status")
  const status =
    statusParam && GROWTH_IMPORT_BATCH_STATUSES.includes(statusParam as (typeof GROWTH_IMPORT_BATCH_STATUSES)[number])
      ? (statusParam as (typeof GROWTH_IMPORT_BATCH_STATUSES)[number])
      : undefined

  try {
    const batches = await listGrowthImportBatches(access.admin, { status })
    return NextResponse.json({ ok: true, batches })
  } catch (e) {
    const mapped = growthImportErrorMessage(e)
    return NextResponse.json({ error: mapped.error, message: mapped.message }, { status: mapped.status })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const form = await request.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: "invalid_body", message: "Expected multipart form data." }, { status: 400 })
  }

  const file = form.get("file")
  const batchName = String(form.get("batchName") ?? "").trim()
  const sourceVendor = String(form.get("sourceVendor") ?? "manual_csv").trim()
  const sourceChannel = optionalText.parse(form.get("sourceChannel")?.toString() ?? null)
  const sourceCampaign = optionalText.parse(form.get("sourceCampaign")?.toString() ?? null)

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "invalid_body", message: "CSV file is required." }, { status: 400 })
  }
  if (!batchName) {
    return NextResponse.json({ error: "invalid_body", message: "Batch name is required." }, { status: 400 })
  }
  if (file.size > GROWTH_IMPORT_MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large", message: "CSV exceeds 30MB limit." }, { status: 400 })
  }

  try {
    const adapter = getImportVendorAdapter(sourceVendor)
    const bytes = Buffer.from(await file.arrayBuffer())

    const batch = await createGrowthImportBatch(access.admin, {
      batchName,
      sourceVendor: adapter.vendorKey(),
      sourceChannel,
      sourceCampaign,
      vendorSchemaVersion: adapter.vendorSchemaVersion() ?? GROWTH_IMPORT_VENDOR_SCHEMA_VERSION,
      fileName: file.name,
      createdBy: access.userId,
    })

    const { storagePath } = await uploadGrowthImportCsv(access.admin, {
      batchId: batch.id,
      fileName: file.name,
      bytes,
    })

    const withStorage = await updateGrowthImportBatch(access.admin, batch.id, { storagePath })
    if (!withStorage) throw new Error("batch_update_failed")

    await appendGrowthImportBatchEvent(access.admin, {
      batchId: batch.id,
      eventType: "batch_created",
      title: "Import batch created",
      summary: batchName,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    await appendGrowthImportBatchEvent(access.admin, {
      batchId: batch.id,
      eventType: "file_uploaded",
      title: "CSV uploaded",
      summary: file.name,
      payload: { rowBytes: file.size },
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    const initialized = await initializeGrowthImportBatchFromUpload(access.admin, withStorage)

    await appendGrowthImportBatchEvent(access.admin, {
      batchId: batch.id,
      eventType: "preview_generated",
      title: "Preview generated",
      summary: `${initialized.batch.rowCount} rows detected`,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    logGrowthEngine("import_batch_upload_success", { batchId: batch.id, actorEmail: access.userEmail })

    return NextResponse.json(
      {
        ok: true,
        batch: initialized.batch,
        suggestedMapping: initialized.suggestedMapping,
        headers: initialized.headers,
      },
      { status: 201 },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message.startsWith("unknown_import_vendor")) {
      return NextResponse.json({ error: "invalid_vendor", message: "Unknown import vendor." }, { status: 400 })
    }
    const mapped = growthImportErrorMessage(e)
    return NextResponse.json({ error: mapped.error, message: mapped.message }, { status: mapped.status })
  }
}
