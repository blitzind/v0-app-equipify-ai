import { NextResponse } from "next/server"
import { runPriceListImportExtractionJob } from "@/lib/ai/jobs/process-ai-job"
import { insertQueuedAiJob } from "@/lib/ai/jobs/create-ai-job"
import { scheduleCatalogExtractionProcessing } from "@/lib/ai/jobs/schedule-catalog-extraction"
import { PRICE_LIST_IMPORTS_BUCKET } from "@/lib/catalog/constants"
import { logCatalogCsvImport } from "@/lib/catalog/csv-import-debug-log"
import { readPriceListImportJobOutcome } from "@/lib/catalog/price-list-import-upload-result"
import {
  defaultPriceListFileName,
  getPriceListFileExtension,
  priceListStorageExtension,
  validatePriceListFile,
} from "@/lib/catalog/price-list-file-validation"
import { uploadPriceListImportFile } from "@/lib/catalog/price-list-storage-upload"
import { requireOrgCatalogWrite } from "@/lib/catalog/require-org-catalog-write"
import { maybeCatalogSchemaErrorResponse } from "@/lib/supabase/catalog-schema-errors"

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

  const gate = await requireOrgCatalogWrite(organizationId)
  if ("error" in gate) return gate.error

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "invalid_body", message: "Send multipart form data with file." }, { status: 400 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Could not read upload." }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "invalid_file", message: "Choose a price list file." }, { status: 400 })
  }

  const fileValidation = validatePriceListFile(file.name || "", file.type || "", file.size)
  if (!fileValidation.ok) {
    return NextResponse.json(
      { error: fileValidation.error, message: fileValidation.message },
      { status: 400 },
    )
  }
  const fileKind = fileValidation.kind

  logCatalogCsvImport("upload_received", {
    organizationId,
    fileName: file.name || defaultPriceListFileName(fileKind),
    mimeType: file.type || null,
    sizeBytes: file.size,
    detectedKind: fileKind,
    detectedExtension: getPriceListFileExtension(file.name || ""),
    storageExtension: priceListStorageExtension(fileKind),
  })

  const manufacturerNameField = form.get("manufacturerName")
  const manufacturerName =
    typeof manufacturerNameField === "string" && manufacturerNameField.trim()
      ? manufacturerNameField.trim()
      : null

  const vendorField = form.get("vendorId")
  const vendorId =
    typeof vendorField === "string" && UUID_RE.test(vendorField.trim()) ? vendorField.trim() : null

  const buffer = Buffer.from(await file.arrayBuffer())
  const { svc, userId } = gate

  const { data: inserted, error: insErr } = await svc
    .from("price_list_imports")
    .insert({
      organization_id: organizationId,
      uploaded_by: userId,
      vendor_id: vendorId,
      manufacturer_name: manufacturerName,
      file_name: file.name || defaultPriceListFileName(fileKind),
      status: "processing",
      extracted_json: {} as unknown as Record<string, unknown>,
      error_message: null,
    })
    .select("id")
    .single()

  if (insErr || !inserted?.id) {
    const schema = maybeCatalogSchemaErrorResponse(insErr?.message)
    if (schema) return schema
    return NextResponse.json(
      { error: "insert_failed", message: insErr?.message ?? "Could not create import." },
      { status: 500 },
    )
  }

  const importId = inserted.id as string
  const storagePath = `${organizationId}/${importId}${priceListStorageExtension(fileKind)}`

  const storageUpload = await uploadPriceListImportFile({
    svc,
    storagePath,
    buffer,
    kind: fileKind,
  })

  if (!storageUpload.ok) {
    await svc.from("price_list_imports").delete().eq("id", importId)
    return NextResponse.json({ error: "upload_failed", message: storageUpload.message }, { status: 400 })
  }

  await svc
    .from("price_list_imports")
    .update({ file_url: storagePath, updated_at: new Date().toISOString() })
    .eq("id", importId)

  const jobInsert = await insertQueuedAiJob(svc, {
    organization_id: organizationId,
    created_by: userId,
    task: "catalog_extraction",
    input_json: {
      kind: "price_list_import_upload",
      importId,
      storagePath,
      fileName: file.name || defaultPriceListFileName(fileKind),
      fileKind,
      manufacturerName,
      vendorId,
    },
    source_type: "price_list_import",
    source_id: importId,
  })

  if ("error" in jobInsert) {
    await svc.from("price_list_imports").delete().eq("id", importId)
    await svc.storage.from(PRICE_LIST_IMPORTS_BUCKET).remove([storagePath])
    return NextResponse.json({ error: "job_create_failed", message: jobInsert.error }, { status: 500 })
  }

  const jobId = jobInsert.jobId

  if (fileKind === "csv") {
    logCatalogCsvImport("upload_inline_extract_start", {
      organizationId,
      importId,
      jobId,
      storagePath,
      fileName: file.name || defaultPriceListFileName(fileKind),
      fileKind,
      sizeBytes: file.size,
    })

    try {
      await runPriceListImportExtractionJob({ svc, organizationId, jobId })
    } catch (e) {
      console.error("[POST price-list-imports] inline csv extraction error", {
        organizationId,
        importId,
        jobId,
        message: e instanceof Error ? e.message : String(e),
      })
    }

    const outcome = await readPriceListImportJobOutcome(svc, organizationId, importId, jobId)

    logCatalogCsvImport("upload_inline_extract_outcome", {
      organizationId,
      importId,
      jobId,
      ok: outcome.ok,
      status: outcome.status,
      rowCount: outcome.ok ? outcome.rowCount : undefined,
      message: outcome.ok ? undefined : outcome.message,
    })

    if (outcome.ok) {
      return NextResponse.json({
        ok: true,
        importId,
        jobId,
        status: "completed",
        rowCount: outcome.rowCount,
        extractionReady: true,
      })
    }

    return NextResponse.json(
      {
        ok: false,
        importId,
        jobId,
        status: outcome.status,
        message: outcome.message,
      },
      { status: 422 },
    )
  }

  logCatalogCsvImport("upload_queued_pdf", {
    organizationId,
    importId,
    jobId,
    storagePath,
    fileKind,
  })

  scheduleCatalogExtractionProcessing({
    organizationId,
    jobId,
    importIdForCleanup: importId,
  })

  return NextResponse.json({
    ok: true,
    importId,
    jobId,
    status: "queued",
    extractionReady: false,
  })
}
