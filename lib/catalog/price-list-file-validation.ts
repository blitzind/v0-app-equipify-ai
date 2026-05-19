/** Shared client + server validation for catalog price list uploads (PDF and CSV). */

export const PRICE_LIST_MAX_BYTES = 50 * 1024 * 1024

export const PRICE_LIST_CSV_MAX_ROWS = 5000

export type PriceListFileKind = "pdf" | "csv"

const CSV_MIMES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/comma-separated-values",
  "application/vnd.ms-excel.sheet.macroenabled.12",
])

export function detectPriceListFileKind(fileName: string, mimeType: string): PriceListFileKind | null {
  const mime = (mimeType || "").toLowerCase().trim()
  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""

  if (mime === "application/pdf" || ext === "pdf") return "pdf"

  if (CSV_MIMES.has(mime) || ext === "csv") return "csv"

  if (mime === "text/plain" && ext === "csv") return "csv"

  // Browsers often send CSV uploads as octet-stream; trust .csv extension.
  if (mime === "application/octet-stream" && ext === "csv") return "csv"

  return null
}

export function isAllowedPriceListFile(fileName: string, mimeType: string): boolean {
  return detectPriceListFileKind(fileName, mimeType) !== null
}

export type PriceListFileValidationResult =
  | { ok: true; kind: PriceListFileKind }
  | { ok: false; error: string; message: string }

export function validatePriceListFile(
  fileName: string,
  mimeType: string,
  size: number,
): PriceListFileValidationResult {
  if (size < 1) {
    return { ok: false, error: "invalid_file", message: "Choose a price list file." }
  }
  if (size > PRICE_LIST_MAX_BYTES) {
    return {
      ok: false,
      error: "file_too_large",
      message: "Price list files must be 50MB or smaller.",
    }
  }

  const mime = (mimeType || "").toLowerCase().trim()
  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""

  if (mime === "text/plain" && ext !== "csv") {
    return {
      ok: false,
      error: "invalid_type",
      message: "Plain-text uploads must use a .csv file extension.",
    }
  }

  const kind = detectPriceListFileKind(fileName, mimeType)
  if (!kind) {
    return {
      ok: false,
      error: "invalid_type",
      message: "Upload a PDF or CSV price list.",
    }
  }

  return { ok: true, kind }
}

export function priceListStorageExtension(kind: PriceListFileKind): string {
  return kind === "csv" ? ".csv" : ".pdf"
}

export function priceListStorageContentType(kind: PriceListFileKind): string {
  return kind === "csv" ? "text/csv" : "application/pdf"
}

export function defaultPriceListFileName(kind: PriceListFileKind): string {
  return kind === "csv" ? "price-list.csv" : "price-list.pdf"
}
