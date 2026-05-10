/**
 * Phase 56.7 — shared classification for attachment rows in drawers (icons + labels).
 * Keep MIME logic aligned with upload accept lists in document/certificate flows.
 */

export type AttachmentMediaKind = "image" | "pdf" | "document" | "spreadsheet" | "csv" | "unknown"

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(\.[a-z0-9]+)?$/i

export function attachmentKindFromMime(mimeType: string, fileName?: string | null): AttachmentMediaKind {
  const m = (mimeType || "").toLowerCase().trim()
  const name = (fileName || "").toLowerCase()

  if (m.startsWith("image/")) return "image"
  if (/\.(png|jpe?g|gif|webp|avif|svg|bmp|heic)$/i.test(name)) return "image"
  if (m === "application/pdf" || m.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (m === "text/csv" || name.endsWith(".csv")) return "csv"
  if (
    m.includes("spreadsheet") ||
    m.includes("excel") ||
    m === "text/tab-separated-values" ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".ods")
  ) {
    return "spreadsheet"
  }
  if (
    m.includes("word") ||
    m.includes("msword") ||
    m.includes("officedocument") ||
    m === "text/plain" ||
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt") ||
    name.endsWith(".rtf")
  ) {
    return "document"
  }
  return "unknown"
}

/** Short type line for metadata (e.g. under filename). */
export function attachmentKindLabel(mimeType: string, fileName?: string | null): string {
  const kind = attachmentKindFromMime(mimeType, fileName)
  switch (kind) {
    case "image": {
      const sub = (mimeType || "").replace(/^image\//i, "").toUpperCase()
      return sub && sub !== "OCTET-STREAM" ? sub : "Image"
    }
    case "pdf":
      return "PDF"
    case "csv":
      return "CSV"
    case "spreadsheet":
      return "Spreadsheet"
    case "document":
      return "Document"
    default:
      return "File"
  }
}

/**
 * Prefer real filenames; avoid showing bare UUIDs as the primary label.
 */
export function displayAttachmentFileName(fileName: string | null | undefined): string {
  const raw = fileName?.trim()
  if (!raw) return "Attachment"
  const base = raw.replace(/^.*[/\\]/, "").trim() || raw
  const withoutExt = base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : base
  if (UUID_LIKE.test(base) || UUID_LIKE.test(`${withoutExt}.bin`)) {
    const ext = base.includes(".") ? base.slice(base.lastIndexOf(".")) : ""
    return ext ? `Saved file${ext}` : "Saved file"
  }
  return base
}

export function isImageMime(mimeType: string): boolean {
  return (mimeType || "").toLowerCase().startsWith("image/")
}
