import { NextResponse } from "next/server"
import { requireOrgCatalogWrite, requireOrgMemberRead } from "@/lib/catalog/require-org-catalog-write"
import { maybeCatalogSchemaErrorResponse } from "@/lib/supabase/catalog-schema-errors"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_BYTES = 52 * 1024 * 1024

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
])

const ALLOWED_CATEGORY = new Set([
  "price_sheet",
  "manual",
  "spec_sheet",
  "warranty",
  "manufacturer_doc",
  "other",
])

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "-").replace(/[^\w.\- ()[\]]+/g, "_").trim() || "file"
  return base.slice(0, 180)
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; itemId: string }> },
) {
  const { organizationId, itemId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(itemId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgMemberRead(organizationId)
  if ("error" in gate) return gate.error

  const { data: rows, error } = await gate.svc
    .from("catalog_item_attachments")
    .select("id, file_name, file_type, storage_path, file_size_bytes, category, uploaded_at")
    .eq("organization_id", organizationId)
    .eq("catalog_item_id", itemId)
    .order("uploaded_at", { ascending: false })

  if (error) {
    const schema = maybeCatalogSchemaErrorResponse(error.message)
    if (schema) return schema
    return NextResponse.json({ error: "load_failed", message: error.message }, { status: 500 })
  }

  return NextResponse.json({ attachments: rows ?? [] })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; itemId: string }> },
) {
  const { organizationId, itemId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(itemId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgCatalogWrite(organizationId)
  if ("error" in gate) return gate.error

  const { data: cat, error: catErr } = await gate.svc
    .from("catalog_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", itemId)
    .maybeSingle()

  if (catErr) {
    const schema = maybeCatalogSchemaErrorResponse(catErr.message)
    if (schema) return schema
    return NextResponse.json({ error: "load_failed", message: catErr.message }, { status: 500 })
  }
  if (!cat) {
    return NextResponse.json({ error: "not_found", message: "Catalog item not found." }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const categoryRaw = String(formData.get("category") ?? "other").trim()

  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json({ error: "invalid_file", message: "Choose a file to upload." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large", message: "File must be 50MB or smaller." }, { status: 400 })
  }

  const mime = (file.type || "application/octet-stream").toLowerCase()
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: "invalid_type", message: "File type not allowed for catalog attachments." }, { status: 400 })
  }

  const category = ALLOWED_CATEGORY.has(categoryRaw) ? categoryRaw : "other"

  const safeName = sanitizeFileName(file.name)
  const objectName = `${crypto.randomUUID()}-${safeName}`
  const path = `${organizationId}/${itemId}/${objectName}`

  const buf = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await gate.svc.storage.from("catalog-item-files").upload(path, buf, {
    cacheControl: "3600",
    upsert: false,
    contentType: mime,
  })

  if (upErr) {
    return NextResponse.json({ error: "upload_failed", message: upErr.message }, { status: 500 })
  }

  const { data: row, error: insErr } = await gate.svc
    .from("catalog_item_attachments")
    .insert({
      organization_id: organizationId,
      catalog_item_id: itemId,
      file_name: file.name,
      file_type: mime,
      storage_path: path,
      file_size_bytes: file.size,
      category,
      uploaded_by: gate.userId,
    })
    .select("id, file_name, category, uploaded_at")
    .maybeSingle()

  if (insErr) {
    await gate.svc.storage.from("catalog-item-files").remove([path])
    const schema = maybeCatalogSchemaErrorResponse(insErr.message)
    if (schema) return schema
    return NextResponse.json({ error: "insert_failed", message: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ attachment: row })
}
