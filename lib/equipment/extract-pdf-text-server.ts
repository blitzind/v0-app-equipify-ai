import "server-only"

import { PDFParse } from "pdf-parse"

import { EQUIPMENT_SCAN_MIN_PDF_TEXT_CHARS, EQUIPMENT_SCAN_PDF_TEXT_MAX_CHARS } from "@/lib/equipment/equipment-scan-upload-validate"

export type PdfTextExtractionResult =
  | { ok: true; text: string; charCount: number }
  | { ok: false; code: "parse_failed" | "too_short"; message: string }

/**
 * Extract plain text from a PDF buffer for downstream AI (no raw PDF sent to the model).
 * Truncates very long documents to keep prompts bounded.
 */
export async function extractPdfPlainTextForEquipmentScan(buffer: Buffer): Promise<PdfTextExtractionResult> {
  let parser: InstanceType<typeof PDFParse> | null = null
  try {
    parser = new PDFParse({ data: new Uint8Array(buffer) })
    const textResult = await parser.getText()
    const raw = (textResult.text ?? "").replace(/\u0000/g, " ").trim()
    const collapsed = raw.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
    const truncated =
      collapsed.length > EQUIPMENT_SCAN_PDF_TEXT_MAX_CHARS
        ? `${collapsed.slice(0, EQUIPMENT_SCAN_PDF_TEXT_MAX_CHARS)}\n\n[… document truncated for processing …]`
        : collapsed
    const charCount = truncated.length
    if (charCount < EQUIPMENT_SCAN_MIN_PDF_TEXT_CHARS) {
      return {
        ok: false,
        code: "too_short",
        message:
          "Could not read enough text from this PDF. Try a text-based certificate or spec sheet, export the PDF again, or upload a clear photo of the nameplate instead.",
      }
    }
    return { ok: true, text: truncated, charCount }
  } catch {
    return {
      ok: false,
      code: "parse_failed",
      message:
        "This PDF could not be read. It may be encrypted, corrupted, or image-only. Try unlocking/exporting the file, or upload a photo of the equipment label instead.",
    }
  } finally {
    if (parser) {
      try {
        await parser.destroy()
      } catch {
        /* ignore */
      }
    }
  }
}
