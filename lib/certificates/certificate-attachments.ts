/**
 * Certificates + Portal Release Workflow — Phase 2
 *
 * Helpers for uploaded calibration PDFs and supplementary certificate
 * documents. Files are stored in the existing `work-order-attachments`
 * private storage bucket (path scheme: `{org_id}/{work_order_id}/cert-...`)
 * to avoid duplicating storage policies. Metadata lives in the new
 * `certificate_attachments` table.
 *
 * Strict rules:
 *   - tenant-scoped via `organization_id`
 *   - never expose raw UUIDs in user-facing copy
 *   - schema-drift safe: every helper degrades to `[]` / `null` when the
 *     Phase 2 migration has not been applied yet
 */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import {
  WORK_ORDER_ATTACHMENTS_BUCKET,
  signedUrlForAttachmentPath,
} from "@/lib/work-orders/work-order-tab-data"

export type CertificateAttachmentCategory = "external_calibration" | "supplementary"

export type CertificateAttachment = {
  id: string
  workOrderId: string
  equipmentId: string | null
  calibrationRecordId: string | null
  category: CertificateAttachmentCategory
  fileName: string
  fileType: string
  storagePath: string
  fileSizeBytes: number | null
  notes: string | null
  uploadedAt: string
  uploadedBy: string | null
}

/** Mirrors the table column set for client-side selects. */
const CERT_ATTACH_SELECT =
  "id, work_order_id, equipment_id, calibration_record_id, category, file_name, file_type, storage_path, file_size_bytes, notes, uploaded_at, uploaded_by"

const ALLOWED_CERT_ATTACH_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
])

/** Reuse the existing 15 MiB cap — bucket-level limit is enforced regardless. */
export const CERT_ATTACH_MAX_BYTES = 15 * 1024 * 1024

export function validateCertificateAttachmentFile(file: File): string | null {
  if (file.size > CERT_ATTACH_MAX_BYTES) {
    return `File too large (max ${Math.round(CERT_ATTACH_MAX_BYTES / (1024 * 1024))} MB).`
  }
  const t = (file.type || "").toLowerCase()
  if (!ALLOWED_CERT_ATTACH_MIME.has(t)) {
    return "Allowed: PDF, PNG, JPEG, WEBP."
  }
  return null
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "-").replace(/[^\w.\- ()[\]]+/g, "_").trim() || "certificate"
  return base.slice(0, 180)
}

/** True when the table is missing (Phase 2 migration not applied). */
function missingCertificateAttachmentsTable(error: PostgrestError | null | undefined): boolean {
  if (!error) return false
  const m = (error.message ?? "").toLowerCase()
  if (!m.includes("certificate_attachments")) return false
  return error.code === "42P01" || m.includes("does not exist") || m.includes("could not find")
}

type Row = {
  id: string
  work_order_id: string
  equipment_id: string | null
  calibration_record_id: string | null
  category: CertificateAttachmentCategory
  file_name: string
  file_type: string
  storage_path: string
  file_size_bytes: number | null
  notes: string | null
  uploaded_at: string
  uploaded_by: string | null
}

function mapRow(r: Row): CertificateAttachment {
  return {
    id: r.id,
    workOrderId: r.work_order_id,
    equipmentId: r.equipment_id,
    calibrationRecordId: r.calibration_record_id,
    category: r.category,
    fileName: r.file_name,
    fileType: r.file_type,
    storagePath: r.storage_path,
    fileSizeBytes: r.file_size_bytes,
    notes: r.notes,
    uploadedAt: r.uploaded_at,
    uploadedBy: r.uploaded_by,
  }
}

export async function listCertificateAttachmentsForWorkOrder(
  supabase: SupabaseClient,
  args: { organizationId: string; workOrderId: string },
): Promise<CertificateAttachment[]> {
  const { organizationId, workOrderId } = args
  const { data, error } = await supabase
    .from("certificate_attachments")
    .select(CERT_ATTACH_SELECT)
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)
    .order("uploaded_at", { ascending: true })

  if (error) {
    if (missingCertificateAttachmentsTable(error)) return []
    throw new Error(error.message)
  }
  return ((data ?? []) as Row[]).map(mapRow)
}

export async function listCertificateAttachmentsForRecord(
  supabase: SupabaseClient,
  args: { organizationId: string; calibrationRecordId: string },
): Promise<CertificateAttachment[]> {
  const { organizationId, calibrationRecordId } = args
  const { data, error } = await supabase
    .from("certificate_attachments")
    .select(CERT_ATTACH_SELECT)
    .eq("organization_id", organizationId)
    .eq("calibration_record_id", calibrationRecordId)
    .order("uploaded_at", { ascending: true })

  if (error) {
    if (missingCertificateAttachmentsTable(error)) return []
    throw new Error(error.message)
  }
  return ((data ?? []) as Row[]).map(mapRow)
}

export async function uploadCertificateAttachment(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    workOrderId: string
    equipmentId?: string | null
    calibrationRecordId?: string | null
    category?: CertificateAttachmentCategory
    file: File
    notes?: string | null
  },
): Promise<CertificateAttachment> {
  const errMsg = validateCertificateAttachmentFile(args.file)
  if (errMsg) throw new Error(errMsg)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in")

  const safe = sanitizeFileName(args.file.name)
  // Reuse the existing work-order-attachments bucket. Path satisfies the
  // existing storage RLS policies: {orgUuid}/{woUuid}/cert-{uuid}-{name}.
  const storagePath = `${args.organizationId}/${args.workOrderId}/cert-${crypto.randomUUID()}-${safe}`

  const { error: upErr } = await supabase.storage
    .from(WORK_ORDER_ATTACHMENTS_BUCKET)
    .upload(storagePath, args.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: args.file.type || "application/octet-stream",
    })
  if (upErr) throw new Error(upErr.message)

  const insertPayload = {
    organization_id: args.organizationId,
    work_order_id: args.workOrderId,
    equipment_id: args.equipmentId ?? null,
    calibration_record_id: args.calibrationRecordId ?? null,
    category: args.category ?? "external_calibration",
    file_name: args.file.name,
    file_type: args.file.type || "application/octet-stream",
    storage_path: storagePath,
    file_size_bytes: args.file.size,
    notes: args.notes?.trim() || null,
    uploaded_by: user.id,
  }

  const { data, error } = await supabase
    .from("certificate_attachments")
    .insert(insertPayload)
    .select(CERT_ATTACH_SELECT)
    .single()

  if (error) {
    // Roll back the orphaned upload so we don't leak.
    await supabase.storage.from(WORK_ORDER_ATTACHMENTS_BUCKET).remove([storagePath])
    if (missingCertificateAttachmentsTable(error)) {
      throw new Error(
        "Certificate attachments are not enabled in this database yet — apply migration 20260722120000_certificate_workflow_phase2.sql to enable uploads.",
      )
    }
    throw new Error(error.message)
  }

  return mapRow(data as Row)
}

export async function deleteCertificateAttachment(
  supabase: SupabaseClient,
  args: { organizationId: string; attachmentId: string },
): Promise<void> {
  const { organizationId, attachmentId } = args

  const { data, error: fetchErr } = await supabase
    .from("certificate_attachments")
    .select("storage_path")
    .eq("organization_id", organizationId)
    .eq("id", attachmentId)
    .maybeSingle()
  if (fetchErr) {
    if (missingCertificateAttachmentsTable(fetchErr)) return
    throw new Error(fetchErr.message)
  }
  const storagePath = (data as { storage_path?: string } | null)?.storage_path ?? null

  const { error: delErr } = await supabase
    .from("certificate_attachments")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", attachmentId)
  if (delErr) throw new Error(delErr.message)

  if (storagePath) {
    await supabase.storage.from(WORK_ORDER_ATTACHMENTS_BUCKET).remove([storagePath])
  }
}

/** Resolves a short-lived signed URL for downloading the attachment. */
export async function signedUrlForCertificateAttachment(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  return signedUrlForAttachmentPath(supabase, storagePath, expiresInSeconds)
}

/** UI helper: human-friendly file size. */
export function formatAttachmentSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
