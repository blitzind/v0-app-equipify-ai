export const EQUIPMENT_SCAN_MAX_BYTES_IMAGE = 12 * 1024 * 1024
export const EQUIPMENT_SCAN_MAX_BYTES_PDF = 12 * 1024 * 1024
export const EQUIPMENT_SCAN_MIN_PDF_TEXT_CHARS = 80
export const EQUIPMENT_SCAN_PDF_TEXT_MAX_CHARS = 28_000

export type EquipmentScanSniffKind = "pdf" | "jpeg" | "png" | "webp" | "gif" | "heic" | "unknown"

/** Inspect leading bytes — do not trust client-supplied MIME alone. */
export function sniffEquipmentScanFileKind(buffer: Buffer): EquipmentScanSniffKind {
  if (buffer.length < 12) return "unknown"
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "pdf"
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg"
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png"
  }
  const g1 = buffer.toString("ascii", 0, 6)
  if (g1 === "GIF87a" || g1 === "GIF89a") return "gif"
  if (g1 === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp"
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12)
    if (brand === "heic" || brand === "heix" || brand === "mif1" || brand === "msf1") return "heic"
  }
  return "unknown"
}

export function mimeForSniff(kind: EquipmentScanSniffKind): string | null {
  switch (kind) {
    case "pdf":
      return "application/pdf"
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    case "gif":
      return "image/gif"
    case "webp":
      return "image/webp"
    case "heic":
      return "image/heic"
    default:
      return null
  }
}
