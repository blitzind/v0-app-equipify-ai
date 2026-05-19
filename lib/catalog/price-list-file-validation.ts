/** Shared client + server validation for catalog price list uploads (PDF and CSV). */

export const PRICE_LIST_MAX_BYTES = 50 * 1024 * 1024

export const PRICE_LIST_CSV_MAX_ROWS = 5000

export type PriceListFileKind = "pdf" | "csv"

export const PRICE_LIST_INVALID_TYPE_MESSAGE =
  "This file type could not be imported. Please upload a CSV or PDF price list."

/** MIME types accepted at upload validation for CSV files. */
export const PRICE_LIST_CSV_MIMES = [
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/comma-separated-values",
] as const

/** MIME types accepted at upload validation for PDF files. */
export const PRICE_LIST_PDF_MIMES = ["application/pdf"] as const

/**
 * MIME types allowed on the price-list-imports storage bucket.
 * Keep in sync with supabase/migrations/*price_list*storage*mimes*.sql
 */
export const PRICE_LIST_STORAGE_BUCKET_MIMES = [
  ...PRICE_LIST_PDF_MIMES,
  ...PRICE_LIST_CSV_MIMES,
  "text/plain",
  "application/octet-stream",
] as const

const CSV_MIME_SET = new Set<string>(PRICE_LIST_CSV_MIMES)

const GENERIC_CSV_MIMES = new Set(["text/plain", "application/octet-stream"])

export function getPriceListFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? ""
}

export function priceListInvalidTypeMessage(mimeType?: string | null): string {
  const mime = (mimeType || "").trim()
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development" && mime) {
    return `${PRICE_LIST_INVALID_TYPE_MESSAGE} (MIME: ${mime})`
  }
  return PRICE_LIST_INVALID_TYPE_MESSAGE
}

export function detectPriceListFileKind(fileName: string, mimeType: string): PriceListFileKind | null {
  const mime = (mimeType || "").toLowerCase().trim()
  const ext = getPriceListFileExtension(fileName)

  if (mime === "application/pdf" || ext === "pdf") return "pdf"

  if (CSV_MIME_SET.has(mime) || ext === "csv") return "csv"

  if (GENERIC_CSV_MIMES.has(mime) && ext === "csv") return "csv"

  return null
}

export function isAllowedPriceListFile(fileName: string, mimeType: string): boolean {
  return detectPriceListFileKind(fileName, mimeType) !== null
}

export type PriceListFileValidationLog = {
  fileName: string
  extension: string
  mimeType: string
  sizeBytes: number
  ok: boolean
  kind?: PriceListFileKind
  reason?: string
}

export function logPriceListFileValidation(entry: PriceListFileValidationLog): void {
  const payload = {
    scope: "price_list_file_validation",
    fileName: entry.fileName,
    extension: entry.extension,
    mimeType: entry.mimeType || "(empty)",
    sizeBytes: entry.sizeBytes,
    ok: entry.ok,
    kind: entry.kind ?? null,
    reason: entry.reason ?? null,
  }
  if (entry.ok) {
    if (process.env.NODE_ENV === "development" || process.env.CATALOG_CSV_IMPORT_DEBUG === "1") {
      console.info("[price-list-file-validation]", JSON.stringify(payload))
    }
    return
  }
  console.warn("[price-list-file-validation]", JSON.stringify(payload))
}

export type PriceListFileValidationResult =
  | { ok: true; kind: PriceListFileKind }
  | { ok: false; error: string; message: string; reason: string }

export function validatePriceListFile(
  fileName: string,
  mimeType: string,
  size: number,
): PriceListFileValidationResult {
  const mime = (mimeType || "").toLowerCase().trim()
  const ext = getPriceListFileExtension(fileName)
  const baseLog = { fileName, extension: ext, mimeType: mime, sizeBytes: size }

  if (size < 1) {
    const reason = "empty_file"
    logPriceListFileValidation({ ...baseLog, ok: false, reason })
    return { ok: false, error: "invalid_file", message: "Choose a price list file.", reason }
  }

  if (size > PRICE_LIST_MAX_BYTES) {
    const reason = "file_too_large"
    logPriceListFileValidation({ ...baseLog, ok: false, reason })
    return {
      ok: false,
      error: "file_too_large",
      message: "Price list files must be 50MB or smaller.",
      reason,
    }
  }

  if (mime === "text/plain" && ext !== "csv") {
    const reason = "plain_text_without_csv_extension"
    logPriceListFileValidation({ ...baseLog, ok: false, reason })
    return {
      ok: false,
      error: "invalid_type",
      message: priceListInvalidTypeMessage(mime),
      reason,
    }
  }

  if (mime === "application/octet-stream" && ext !== "csv") {
    const reason = "octet_stream_without_csv_extension"
    logPriceListFileValidation({ ...baseLog, ok: false, reason })
    return {
      ok: false,
      error: "invalid_type",
      message: priceListInvalidTypeMessage(mime),
      reason,
    }
  }

  const kind = detectPriceListFileKind(fileName, mimeType)
  if (!kind) {
    const reason = "unsupported_mime_or_extension"
    logPriceListFileValidation({ ...baseLog, ok: false, reason })
    return {
      ok: false,
      error: "invalid_type",
      message: priceListInvalidTypeMessage(mime),
      reason,
    }
  }

  logPriceListFileValidation({ ...baseLog, ok: true, kind })
  return { ok: true, kind }
}

/** Normalize to a storage-bucket-safe content type (always PDF or CSV). */
export function priceListStorageContentType(kind: PriceListFileKind): string {
  return kind === "csv" ? "text/csv" : "application/pdf"
}

export function priceListStorageExtension(kind: PriceListFileKind): string {
  return kind === "csv" ? ".csv" : ".pdf"
}

export function defaultPriceListFileName(kind: PriceListFileKind): string {
  return kind === "csv" ? "price-list.csv" : "price-list.pdf"
}

/** Map Supabase storage MIME rejection errors to user-friendly copy. */
export function friendlyPriceListStorageUploadError(
  rawMessage: string,
  contentType?: string | null,
): string {
  const lower = rawMessage.toLowerCase()
  if (lower.includes("mime type") && lower.includes("not supported")) {
    if (process.env.NODE_ENV === "development" && contentType?.trim()) {
      return `${PRICE_LIST_INVALID_TYPE_MESSAGE} Storage rejected MIME: ${contentType.trim()}.`
    }
    return PRICE_LIST_INVALID_TYPE_MESSAGE
  }
  if (lower.includes("payload too large") || lower.includes("file size")) {
    return "Price list files must be 50MB or smaller."
  }
  return "Could not store the price list file. Try again."
}
