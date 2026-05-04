import type { SupabaseClient } from "@supabase/supabase-js"
import type { Part, RepairLog } from "@/lib/mock-data"
import { repairLogJsonForPersist } from "@/lib/work-orders/parse-repair-log"

export const WORK_ORDER_ATTACHMENTS_BUCKET = "work-order-attachments"

/** Max bytes aligned with bucket file_size_limit (15 MiB). */
export const WO_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024

const ALLOWED_ATTACHMENT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
])

export function validateWorkOrderAttachmentFile(file: File): string | null {
  if (file.size > WO_ATTACHMENT_MAX_BYTES) {
    return `File too large (max ${Math.round(WO_ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB).`
  }
  if (!ALLOWED_ATTACHMENT_MIME.has(file.type)) {
    return "File type not allowed. Use images, PDF, or common document formats."
  }
  return null
}

/** Image types shown in the Photos grid; other allowed uploads (e.g. PDF) are listed under Documents. */
export function isWorkOrderPhotoCategoryMime(mime: string): boolean {
  const m = (mime || "").toLowerCase()
  return (
    m === "image/jpeg" ||
    m === "image/png" ||
    m === "image/webp" ||
    m === "image/gif"
  )
}

function sanitizeStorageFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "-").replace(/[^\w.\- ()[\]]+/g, "_").trim() || "file"
  return base.slice(0, 180)
}

export type DbWorkOrderTaskRow = {
  id: string
  title: string
  description: string | null
  completed: boolean
  sort_order: number
  completed_at: string | null
}

export type DbWorkOrderLineItemRow = {
  id: string
  description: string
  quantity: string | number
  unit_cost_cents: number
  line_total_cents: number
  vendor_id: string | null
  purchase_order_id: string | null
}

export type DbWorkOrderAttachmentRow = {
  id: string
  file_name: string
  file_type: string
  storage_path: string
  uploaded_at: string
  category: "photo" | "document"
  file_size_bytes: number | null
}

export function mapLineItemRowToPart(row: DbWorkOrderLineItemRow): Part {
  const qty =
    typeof row.quantity === "number" ? row.quantity : Number.parseFloat(String(row.quantity)) || 1
  return {
    id: row.id,
    name: row.description,
    partNumber: "",
    quantity: qty,
    unitCost: row.unit_cost_cents / 100,
    vendorId: row.vendor_id,
    purchaseOrderId: row.purchase_order_id,
  }
}

export function mapPartToLineItemInsert(
  organizationId: string,
  workOrderId: string,
  p: Part,
): Record<string, unknown> {
  return {
    organization_id: organizationId,
    work_order_id: workOrderId,
    description: p.name.trim() || "Item",
    quantity: p.quantity,
    unit_cost_cents: Math.max(0, Math.round(p.unitCost * 100)),
    vendor_id: p.vendorId ?? null,
    purchase_order_id: p.purchaseOrderId ?? null,
  }
}

export async function fetchWorkOrderTasks(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<DbWorkOrderTaskRow[]> {
  const { data, error } = await supabase
    .from("work_order_tasks")
    .select("id,title,description,completed,sort_order,completed_at")
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as DbWorkOrderTaskRow[]
}

export async function fetchWorkOrderLineItems(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<DbWorkOrderLineItemRow[]> {
  const { data, error } = await supabase
    .from("work_order_line_items")
    .select("id,description,quantity,unit_cost_cents,line_total_cents,vendor_id,purchase_order_id")
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as DbWorkOrderLineItemRow[]
}

export async function fetchWorkOrderAttachments(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<DbWorkOrderAttachmentRow[]> {
  const { data, error } = await supabase
    .from("work_order_attachments")
    .select("id,file_name,file_type,storage_path,uploaded_at,category,file_size_bytes")
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)
    .order("uploaded_at", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as DbWorkOrderAttachmentRow[]
}

export async function signedUrlForAttachmentPath(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(WORK_ORDER_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function replaceWorkOrderTasks(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
  tasks: { label: string; done: boolean; description?: string }[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from("work_order_tasks")
    .delete()
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)

  if (delErr) throw new Error(delErr.message)
  if (tasks.length === 0) return

  const rows = tasks.map((t, i) => ({
    organization_id: organizationId,
    work_order_id: workOrderId,
    title: t.label.trim(),
    description: t.description?.trim() || null,
    completed: t.done,
    sort_order: i,
  }))

  const { error: insErr } = await supabase.from("work_order_tasks").insert(rows)
  if (insErr) throw new Error(insErr.message)
}

export async function replaceWorkOrderLineItems(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
  parts: Part[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from("work_order_line_items")
    .delete()
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)

  if (delErr) throw new Error(delErr.message)

  if (parts.length === 0) return

  const rows = parts.map((p) => mapPartToLineItemInsert(organizationId, workOrderId, p))
  const { error: insErr } = await supabase.from("work_order_line_items").insert(rows)
  if (insErr) throw new Error(insErr.message)
}

export async function uploadWorkOrderAttachment(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
  file: File,
): Promise<void> {
  const errMsg = validateWorkOrderAttachmentFile(file)
  if (errMsg) throw new Error(errMsg)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in")

  const safe = sanitizeStorageFileName(file.name)
  const objectName = `${crypto.randomUUID()}-${safe}`
  const path = `${organizationId}/${workOrderId}/${objectName}`

  const { error: upErr } = await supabase.storage
    .from(WORK_ORDER_ATTACHMENTS_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false })

  if (upErr) throw new Error(upErr.message)

  const category: "photo" | "document" = isWorkOrderPhotoCategoryMime(file.type) ? "photo" : "document"

  const { error: rowErr } = await supabase.from("work_order_attachments").insert({
    organization_id: organizationId,
    work_order_id: workOrderId,
    file_name: file.name,
    file_type: file.type || "application/octet-stream",
    storage_path: path,
    file_size_bytes: file.size,
    uploaded_by: user.id,
    category,
  })

  if (rowErr) {
    await supabase.storage.from(WORK_ORDER_ATTACHMENTS_BUCKET).remove([path])
    throw new Error(rowErr.message)
  }
}

export async function deleteWorkOrderAttachment(
  supabase: SupabaseClient,
  organizationId: string,
  attachmentId: string,
): Promise<void> {
  const { data: row, error: fErr } = await supabase
    .from("work_order_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (fErr) throw new Error(fErr.message)
  const storagePath = (row as { storage_path: string } | null)?.storage_path
  if (!storagePath) return

  const { error: dErr } = await supabase
    .from("work_order_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("organization_id", organizationId)

  if (dErr) throw new Error(dErr.message)

  await supabase.storage.from(WORK_ORDER_ATTACHMENTS_BUCKET).remove([storagePath])
}

/** Upload PNG to `work-order-attachments`, set `work_orders.signature_url` + `signature_captured_at`, merge signer into `repair_log`. */
export async function persistWorkOrderCustomerSignature(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
  pngBlob: Blob,
  signerName: string,
  repairLogBase: RepairLog,
  persistOpts: { stripTasks?: boolean; stripParts?: boolean },
): Promise<void> {
  const trimmed = signerName.trim()
  if (!trimmed) throw new Error("Signer name is required.")

  const { data: existing, error: fe } = await supabase
    .from("work_orders")
    .select("signature_url")
    .eq("id", workOrderId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (fe) throw new Error(fe.message)
  const oldPath = (existing as { signature_url: string | null } | null)?.signature_url ?? null

  const path = `${organizationId}/${workOrderId}/customer-signature-${crypto.randomUUID()}.png`

  const { error: upErr } = await supabase.storage
    .from(WORK_ORDER_ATTACHMENTS_BUCKET)
    .upload(path, pngBlob, { cacheControl: "3600", upsert: false, contentType: "image/png" })

  if (upErr) throw new Error(upErr.message)

  const capturedAt = new Date().toISOString()
  const mergedRl: RepairLog = {
    ...repairLogBase,
    signatureDataUrl: "",
    signedBy: trimmed,
    signedAt: capturedAt,
  }

  const { error: upWo } = await supabase
    .from("work_orders")
    .update({
      signature_url: path,
      signature_captured_at: capturedAt,
      repair_log: repairLogJsonForPersist(mergedRl, persistOpts),
      updated_at: capturedAt,
    })
    .eq("id", workOrderId)
    .eq("organization_id", organizationId)

  if (upWo) {
    await supabase.storage.from(WORK_ORDER_ATTACHMENTS_BUCKET).remove([path])
    throw new Error(upWo.message)
  }

  if (oldPath && oldPath !== path) {
    await supabase.storage.from(WORK_ORDER_ATTACHMENTS_BUCKET).remove([oldPath])
  }
}
