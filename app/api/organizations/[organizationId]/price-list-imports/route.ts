import { NextResponse } from "next/server"
import { PRICE_LIST_IMPORTS_BUCKET } from "@/lib/catalog/constants"
import { insertQueuedAiJob } from "@/lib/ai/jobs/create-ai-job"
import { scheduleCatalogExtractionProcessing } from "@/lib/ai/jobs/schedule-catalog-extraction"
import { requireOrgCatalogWrite } from "@/lib/catalog/require-org-catalog-write"
import { maybeCatalogSchemaErrorResponse } from "@/lib/supabase/catalog-schema-errors"

export const runtime = "nodejs"
export const maxDuration = 300

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_BYTES = 50 * 1024 * 1024

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
  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json({ error: "invalid_file", message: "Choose a PDF price list." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large", message: "PDF must be 50MB or smaller." }, { status: 400 })
  }

  const mime = (file.type || "").toLowerCase()
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (mime !== "application/pdf" && ext !== "pdf") {
    return NextResponse.json({ error: "invalid_type", message: "Only PDF uploads are supported for now." }, { status: 400 })
  }

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
      file_name: file.name || "price-list.pdf",
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
  const storagePath = `${organizationId}/${importId}.pdf`

  const { error: upErr } = await svc.storage.from(PRICE_LIST_IMPORTS_BUCKET).upload(storagePath, buffer, {
    contentType: "application/pdf",
    cacheControl: "3600",
    upsert: true,
  })

  if (upErr) {
    await svc.from("price_list_imports").delete().eq("id", importId)
    return NextResponse.json({ error: "upload_failed", message: upErr.message }, { status: 400 })
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
      fileName: file.name || "price-list.pdf",
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
  })
}
