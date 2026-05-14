import "server-only"

import { createHash } from "node:crypto"

import sharp from "sharp"

import { applyUserPromptTemplate, getPromptForTask } from "@/lib/ai/prompts"
import { executeOpenAiStructuredFileExtraction } from "@/lib/ai/openai-structured-file-task"
import { runAiTask } from "@/lib/ai/router"

import {
  equipmentAiScanModelSchema,
  type EquipmentAiScanModelResult,
} from "@/lib/equipment/equipment-ai-scan-schema"
import {
  EQUIPMENT_SCAN_MAX_BYTES_IMAGE,
  EQUIPMENT_SCAN_MAX_BYTES_PDF,
  mimeForSniff,
  sniffEquipmentScanFileKind,
} from "@/lib/equipment/equipment-scan-upload-validate"
import { extractPdfPlainTextForEquipmentScan } from "@/lib/equipment/extract-pdf-text-server"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function cleanDate(raw: string | null | undefined): string {
  const t = (raw ?? "").trim()
  if (!t) return ""
  if (ISO_DATE.test(t)) return t
  const d = new Date(t)
  if (!Number.isFinite(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

function clip(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

function mergeNotesFromModel(parsed: EquipmentAiScanModelResult): string {
  const chunks: string[] = []
  const base = (parsed.notes ?? "").trim()
  if (base) chunks.push(base)

  const docCustomer = (parsed.documentCustomerName ?? "").trim()
  if (docCustomer) {
    chunks.push(`Document customer / account (verify before assigning): ${docCustomer}`)
  }

  const svc = (parsed.serviceIntervalDescription ?? "").trim()
  if (svc) chunks.push(`Service interval (from document): ${clip(svc, 500)}`)

  const support = (parsed.supportingDetails ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)
  if (support.length > 0) {
    chunks.push(["Supporting details (from document):", ...support.map((l) => `• ${clip(l, 360)}`)].join("\n"))
  }

  const merged = chunks.join("\n\n").trim()
  return clip(merged, 4000)
}

export type EquipmentScanExtractionOk = {
  ok: true
  sourceKind: "image" | "pdf"
  /** Normalized form-friendly fields for the Add Equipment UI. */
  fields: {
    name: string
    equipmentType: string
    subcategory: string
    manufacturer: string
    model: string
    serialNumber: string
    installDate: string
    warrantyExpiration: string
    lastServiceDate: string
    nextServiceDue: string
    nextCalibrationDue: string
    calibrationIntervalMonths: string
    serviceInterval: string
    notes: string
    documentCustomerHint: string
  }
}

export type EquipmentScanExtractionResult = EquipmentScanExtractionOk | { ok: false; message: string }

function defaultEquipmentName(parsed: EquipmentAiScanModelResult): string {
  const parts = [parsed.manufacturer, parsed.model].map((s) => (s ?? "").trim()).filter(Boolean)
  if (parts.length > 0) return parts.join(" ").trim()
  const n = (parsed.equipmentName ?? "").trim()
  return n
}

export async function extractEquipmentFieldsFromUpload(args: {
  organizationId: string
  buffer: Buffer
  fileName: string
}): Promise<EquipmentScanExtractionResult> {
  const { organizationId, buffer, fileName } = args
  const sniff = sniffEquipmentScanFileKind(buffer)
  if (sniff === "unknown") {
    return {
      ok: false,
      message:
        "This file type is not supported. Use a JPG, PNG, HEIC, WebP, GIF, or PDF (for example a calibration certificate or spec sheet).",
    }
  }

  if (sniff === "pdf" && buffer.byteLength > EQUIPMENT_SCAN_MAX_BYTES_PDF) {
    return {
      ok: false,
      message: "This PDF is too large. Maximum size is 12 MB. Try a smaller export or a photo instead.",
    }
  }
  if (sniff !== "pdf" && buffer.byteLength > EQUIPMENT_SCAN_MAX_BYTES_IMAGE) {
    return {
      ok: false,
      message: "This file is too large. Maximum size is 12 MB. Try a smaller image or compress the file.",
    }
  }

  let imageBuffer = buffer
  let imageMime = mimeForSniff(sniff) ?? "application/octet-stream"
  if (sniff === "heic") {
    try {
      imageBuffer = await sharp(buffer).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer()
      imageMime = "image/jpeg"
    } catch {
      return {
        ok: false,
        message:
          "Could not read this HEIC image. Convert it to JPG or PNG on your device, then upload again.",
      }
    }
  }

  const pr = getPromptForTask("equipment_ai_scan")
  const userInstruction = applyUserPromptTemplate(pr.userPromptTemplate, {
    fileName: fileName || "upload",
  })

  try {
    if (sniff === "pdf") {
      const pdfText = await extractPdfPlainTextForEquipmentScan(buffer)
      if (!pdfText.ok) {
        return { ok: false, message: pdfText.message }
      }
      const docBlock = pdfText.text
      const userBody = `${userInstruction}\n\n--- Extracted PDF text ---\n${docBlock}\n--- End of extracted text ---`
      const textHash = createHash("sha256").update(docBlock).digest("hex")
      const ai = await runAiTask({
        task: "equipment_ai_scan",
        organizationId,
        input: { system: pr.systemPrompt, user: userBody },
        schema: equipmentAiScanModelSchema,
        cacheKeyExtras: { source: "pdf_text", text_sha256: textHash },
        cacheSchemaVersion: "equipment_scan_v1",
      })
      if (!ai.ok) {
        return {
          ok: false,
          message:
            "AI could not read this document. Try a clearer PDF export or upload a photo of the equipment nameplate.",
        }
      }
      return { ok: true, ...mapModelToResult("pdf", ai.output) }
    }

    const aiImg = await executeOpenAiStructuredFileExtraction({
      organizationId,
      task: "equipment_ai_scan",
      buffer: imageBuffer,
      fileName: fileName || "equipment.jpg",
      mimeType: imageMime,
      systemPrompt: pr.systemPrompt,
      userInstruction,
      schema: equipmentAiScanModelSchema,
    })
    return { ok: true, ...mapModelToResult("image", aiImg) }
  } catch {
    return {
      ok: false,
      message:
        "AI extraction did not complete. Check your file and try again, or enter equipment details manually.",
    }
  }
}

function mapModelToResult(
  sourceKind: "image" | "pdf",
  parsed: EquipmentAiScanModelResult,
): Omit<EquipmentScanExtractionOk, "ok"> {
  const nameGuess = (parsed.equipmentName ?? "").trim() || defaultEquipmentName(parsed)
  const model = (parsed.model ?? "").trim()
  const name = nameGuess || model || "New equipment"

  const calMonths =
    parsed.calibrationIntervalMonths != null && Number.isFinite(parsed.calibrationIntervalMonths)
      ? String(parsed.calibrationIntervalMonths)
      : ""

  return {
    sourceKind,
    fields: {
      name,
      equipmentType: (parsed.equipmentType ?? "").trim(),
      subcategory: (parsed.subcategory ?? "").trim(),
      manufacturer: (parsed.manufacturer ?? "").trim(),
      model,
      serialNumber: (parsed.serialNumber ?? "").trim(),
      installDate: cleanDate(parsed.installDate),
      warrantyExpiration: cleanDate(parsed.warrantyExpiration),
      lastServiceDate: cleanDate(parsed.lastServiceDate),
      nextServiceDue: cleanDate(parsed.nextServiceDue),
      nextCalibrationDue: cleanDate(parsed.nextCalibrationDue),
      calibrationIntervalMonths: calMonths,
      serviceInterval: (parsed.serviceIntervalDescription ?? "").trim(),
      notes: mergeNotesFromModel(parsed),
      documentCustomerHint: (parsed.documentCustomerName ?? "").trim(),
    },
  }
}
