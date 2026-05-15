export const EQUIPMENT_SCAN_MAX_BYTES_IMAGE = 12 * 1024 * 1024
export const EQUIPMENT_SCAN_MAX_BYTES_PDF = 12 * 1024 * 1024

/** Stay under typical serverless request caps (~4.5MB on Vercel) after multipart overhead. */
export const EQUIPMENT_SCAN_SAFE_UPLOAD_BYTES = 4_100_000
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
  // HEIF / HEIC: major + compatible brands (iPhone varies: heic, mif1, hevc, hevx, …)
  if (buffer.length >= 16 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const heifBrands = new Set([
      "heic",
      "heix",
      "hevc",
      "hevx",
      "mif1",
      "msf1",
      "heim",
      "heis",
    ])
    const scanEnd = Math.min(buffer.length, 64)
    for (let o = 8; o + 4 <= scanEnd; o += 4) {
      const brand = buffer.toString("ascii", o, o + 4)
      if (heifBrands.has(brand)) return "heic"
    }
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
