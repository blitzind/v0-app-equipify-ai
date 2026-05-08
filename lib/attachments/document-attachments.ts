import { WORK_ORDER_ATTACHMENTS_BUCKET } from "@/lib/work-orders/work-order-tab-data"

export type AttachmentEntityType =
  | "work_order"
  | "invoice"
  | "calibration_record"
  | "equipment"
  | "customer"
  | "quote"

export type AttachmentType =
  | "external_certificate"
  | "generated_certificate"
  | "invoice_pdf"
  | "service_report"
  | "photo"
  | "manual"
  | "compliance_document"
  | "signed_paperwork"
  | "document"
  | "other"

export type AttachmentVisibilityScope =
  | "internal"
  | "portal_visible"
  | "pending_release"
  | "released_after_payment"
  | "released_manual"

export type AttachmentReleaseStatus =
  | "internal"
  | "pending"
  | "pending_release"
  | "withheld_invoice_unpaid"
  | "released"
  | "released_after_payment"
  | "manual_hold"
  | "revoked"

export type DocumentAttachmentRow = {
  id: string
  attachment_type: AttachmentType
  storage_bucket: string
  storage_path: string
  file_name: string
  mime_type: string
  file_size_bytes: number | null
  uploaded_by: string | null
  uploaded_at: string
  visibility_scope: AttachmentVisibilityScope
  related_entity_type: AttachmentEntityType
  related_entity_id: string
  portal_visible: boolean
  portal_release_status: AttachmentReleaseStatus
  source_system: string | null
  metadata_json: unknown
  release_mode_snapshot?: string | null
  released_at?: string | null
  released_by?: string | null
  revoked_at?: string | null
  revoked_by?: string | null
  withheld_reason?: string | null
  linked_invoice_id?: string | null
  linked_work_order_id?: string | null
  linked_customer_id?: string | null
  release_notes?: string | null
}

export const DOCUMENT_ATTACHMENTS_BUCKET = WORK_ORDER_ATTACHMENTS_BUCKET
export const DOCUMENT_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024

export const ATTACHMENT_ENTITY_TYPES = new Set<AttachmentEntityType>([
  "work_order",
  "invoice",
  "calibration_record",
  "equipment",
  "customer",
  "quote",
])

export const ATTACHMENT_TYPES = new Set<AttachmentType>([
  "external_certificate",
  "generated_certificate",
  "invoice_pdf",
  "service_report",
  "photo",
  "manual",
  "compliance_document",
  "signed_paperwork",
  "document",
  "other",
])

export const ATTACHMENT_VISIBILITY_SCOPES = new Set<AttachmentVisibilityScope>([
  "internal",
  "portal_visible",
  "pending_release",
  "released_after_payment",
  "released_manual",
])

export const ALLOWED_DOCUMENT_ATTACHMENT_MIME = new Set([
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

export const DOCUMENT_ATTACHMENT_SELECT =
  "id, attachment_type, storage_bucket, storage_path, file_name, mime_type, file_size_bytes, uploaded_by, uploaded_at, visibility_scope, related_entity_type, related_entity_id, portal_visible, portal_release_status, source_system, metadata_json"

export function validateDocumentAttachmentFile(file: File): string | null {
  if (file.size > DOCUMENT_ATTACHMENT_MAX_BYTES) {
    return `File too large (max ${Math.round(DOCUMENT_ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB).`
  }
  const mime = (file.type || "application/octet-stream").toLowerCase()
  if (!ALLOWED_DOCUMENT_ATTACHMENT_MIME.has(mime)) {
    return "File type not allowed. Use PDFs, images, or common office documents."
  }
  return null
}

export function sanitizeAttachmentFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "-").replace(/[^\w.\- ()[\]]+/g, "_").trim() || "file"
  return base.slice(0, 180)
}

export function formatAttachmentSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function visibilityLabel(scope: AttachmentVisibilityScope | string): string {
  switch (scope) {
    case "portal_visible":
      return "Portal visible"
    case "pending_release":
      return "Pending release"
    case "released_after_payment":
      return "Released after payment"
    case "released_manual":
      return "Released manually"
    default:
      return "Internal only"
  }
}

export function releaseStatusForVisibility(scope: AttachmentVisibilityScope): AttachmentReleaseStatus {
  switch (scope) {
    case "portal_visible":
    case "released_manual":
      return "released"
    case "pending_release":
      return "pending"
    case "released_after_payment":
      return "withheld_invoice_unpaid"
    default:
      return "internal"
  }
}
