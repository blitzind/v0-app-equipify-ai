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
import type {
  EquipmentScanActionErr,
  EquipmentScanActionOk,
  EquipmentScanActionResult,
} from "@/lib/equipment/equipment-scan-action-result"
import { equipmentScanServerLog } from "@/lib/equipment/equipment-scan-server-log"
import {
  EQUIPMENT_SCAN_MAX_BYTES_IMAGE,
  EQUIPMENT_SCAN_MAX_BYTES_PDF,
  mimeForSniff,
  sniffEquipmentScanFileKind,
} from "@/lib/equipment/equipment-scan-upload-validate"
import { extractPdfPlainTextForEquipmentScan } from "@/lib/equipment/extract-pdf-text-server"

const AI_UNAVAILABLE = "AI extraction is temporarily unavailable."

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

function defaultEquipmentName(parsed: EquipmentAiScanModelResult): string {
  const parts = [parsed.manufacturer, parsed.model].map((s) => (s ?? "").trim()).filter(Boolean)
  if (parts.length > 0) return parts.join(" ").trim()
  const n = (parsed.equipmentName ?? "").trim()
  return n
}

function mapThrownOpenAiError(err: unknown, stage: string): EquipmentScanActionErr {
  const m = err instanceof Error ? err.message : String(err)
  const lower = m.toLowerCase()
  if (lower.includes("not configured") && lower.includes("openai")) {
    return { ok: false, code: "ai_not_configured", stage: "openai_config", message: AI_UNAVAILABLE }
  }
  if (lower.includes("no openai models configured")) {
    return { ok: false, code: "ai_models_missing", stage: "openai_config", message: AI_UNAVAILABLE }
  }
  if (lower.includes("unavailable while billing")) {
    return { ok: false, code: "ai_billing_restricted", stage: "openai_config", message: AI_UNAVAILABLE }
  }
  if (lower.includes("unsupported media type for vision")) {
    return {
      ok: false,
      code: "image_mime_unsupported",
      stage: "openai_prepare",
      message: "This image format is not supported for AI scan. Try JPG or PNG.",
    }
  }
  if (lower.includes("ai extraction timed out") || lower.includes("aborted") || lower.includes("abort")) {
    return {
      ok: false,
      code: "ai_timeout",
      stage: "openai_call_end",
      message: "AI extraction timed out. Try a smaller file or try again.",
    }
  }
  if (lower.includes("budget") || lower.includes("plan")) {
    return { ok: false, code: "ai_plan_or_budget", stage: "openai_config", message: AI_UNAVAILABLE }
  }
  return { ok: false, code: "ai_extraction_failed", stage, message: AI_UNAVAILABLE }
}

/** Debug / transport smoke-test: proves Server Action + multipart without calling OpenAI. */
export function buildDebugEquipmentScanSuccess(sourceKind: "image" | "pdf"): EquipmentScanActionOk {
  return {
    ok: true,
    data: {
      sourceKind,
      fields: {
        name: "DEBUG: upload path OK (mock)",
        equipmentType: "Debug / equipment scan",
        subcategory: "",
        manufacturer: "Debug OEM",
        model: "Mock model",
        serialNumber: "",
        installDate: "",
        warrantyExpiration: "",
        lastServiceDate: "",
        nextServiceDue: "",
        nextCalibrationDue: "",
        calibrationIntervalMonths: "",
        serviceInterval: "",
        notes: "This response was generated because DEBUG_EQUIPMENT_SCAN_MOCK or NEXT_PUBLIC_DEBUG_EQUIPMENT_SCAN is enabled. Disable for live AI extraction.",
        documentCustomerHint: "",
      },
    },
  }
}

export async function extractEquipmentFieldsFromUpload(args: {
  organizationId: string
  buffer: Buffer
  fileName: string
}): Promise<EquipmentScanActionResult> {
  const { organizationId, buffer, fileName } = args

  equipmentScanServerLog("magic_byte_sniff", { byteLength: buffer.byteLength })
  const sniff = sniffEquipmentScanFileKind(buffer)
  equipmentScanServerLog("magic_byte_sniff", { sniff })

  if (sniff === "unknown") {
    return {
      ok: false,
      code: "unsupported_type",
      stage: "magic_byte_sniff",
      message:
        "This file type is not supported. Use a JPG, PNG, HEIC, WebP, GIF, or PDF (for example a calibration certificate or spec sheet).",
    }
  }

  equipmentScanServerLog("file_validation", { sniff, byteLength: buffer.byteLength })
  if (sniff === "pdf" && buffer.byteLength > EQUIPMENT_SCAN_MAX_BYTES_PDF) {
    return {
      ok: false,
      code: "pdf_too_large",
      stage: "file_validation",
      message: "This PDF is too large. Maximum size is 12 MB. Try a smaller export or a photo instead.",
    }
  }
  if (sniff !== "pdf" && buffer.byteLength > EQUIPMENT_SCAN_MAX_BYTES_IMAGE) {
    return {
      ok: false,
      code: "image_too_large",
      stage: "file_validation",
      message: "This file is too large. Maximum size is 12 MB. Try a smaller image or compress the file.",
    }
  }

  let imageBuffer = buffer
  let imageMime = mimeForSniff(sniff) ?? "application/octet-stream"
  if (sniff === "heic") {
    equipmentScanServerLog("image_branch", { phase: "heic_convert_start" })
    try {
      imageBuffer = await sharp(buffer).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer()
      imageMime = "image/jpeg"
      equipmentScanServerLog("image_branch", { phase: "heic_convert_end", ok: true })
    } catch {
      equipmentScanServerLog("image_branch", { phase: "heic_convert_end", ok: false })
      return {
        ok: false,
        code: "heic_decode_failed",
        stage: "heic_convert",
        message:
          "Could not read this HEIC image. Convert it to JPG or PNG on your device, then upload again.",
      }
    }
  }

  let pr: ReturnType<typeof getPromptForTask>
  let userInstruction: string
  try {
    equipmentScanServerLog("prompt_load", { phase: "start" })
    pr = getPromptForTask("equipment_ai_scan")
    userInstruction = applyUserPromptTemplate(pr.userPromptTemplate, {
      fileName: fileName || "upload",
    })
    equipmentScanServerLog("prompt_load", { phase: "end", ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "error"
    equipmentScanServerLog("prompt_load", { phase: "end", ok: false, message: msg })
    return {
      ok: false,
      code: "prompt_misconfigured",
      stage: "prompt_load",
      message: AI_UNAVAILABLE,
    }
  }

  try {
    if (sniff === "pdf") {
      equipmentScanServerLog("pdf_branch", { phase: "enter" })
      const pdfText = await extractPdfPlainTextForEquipmentScan(buffer)
      if (!pdfText.ok) {
        equipmentScanServerLog("pdf_text_extract", { ok: false, code: pdfText.code })
        return {
          ok: false,
          code: pdfText.code === "too_short" ? "pdf_text_too_short" : "pdf_parse_failed",
          stage: "pdf_text_extract",
          message: pdfText.message,
        }
      }
      equipmentScanServerLog("pdf_text_extract", { ok: true, charCount: pdfText.charCount })

      const docBlock = pdfText.text
      const userBody = `${userInstruction}\n\n--- Extracted PDF text ---\n${docBlock}\n--- End of extracted text ---`
      const textHash = createHash("sha256").update(docBlock).digest("hex")

      equipmentScanServerLog("openai_call_start", { branch: "pdf" })
      const ai = await runAiTask({
        task: "equipment_ai_scan",
        organizationId,
        input: { system: pr.systemPrompt, user: userBody },
        schema: equipmentAiScanModelSchema,
        cacheKeyExtras: { source: "pdf_text", text_sha256: textHash },
        cacheSchemaVersion: "equipment_scan_v1",
      })
      equipmentScanServerLog("openai_call_end", { branch: "pdf", ok: ai.ok })
      if (!ai.ok) {
        const reason = ai.error instanceof Error ? ai.error.message.slice(0, 120) : "unknown"
        equipmentScanServerLog("schema_parse", { branch: "pdf", ok: false, reason })
        return {
          ok: false,
          code: "ai_task_failed",
          stage: "openai_call_end",
          message: AI_UNAVAILABLE,
        }
      }
      equipmentScanServerLog("schema_parse", { branch: "pdf", ok: true })
      const mapped = mapModelToResult("pdf", ai.output)
      equipmentScanServerLog("response_return", { branch: "pdf", ok: true })
      return { ok: true, data: { sourceKind: mapped.sourceKind, fields: mapped.fields } }
    }

    equipmentScanServerLog("image_branch", { phase: "enter", mime: imageMime })
    equipmentScanServerLog("openai_call_start", { branch: "image" })
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
    equipmentScanServerLog("openai_call_end", { branch: "image", ok: true })
    equipmentScanServerLog("schema_parse", { branch: "image", ok: true })
    const mapped = mapModelToResult("image", aiImg)
    equipmentScanServerLog("response_return", { branch: "image", ok: true })
    return { ok: true, data: { sourceKind: mapped.sourceKind, fields: mapped.fields } }
  } catch (err) {
    equipmentScanServerLog("openai_call_end", { ok: false, sniff })
    const mapped = mapThrownOpenAiError(err, "openai_call_end")
    equipmentScanServerLog("schema_parse", { ok: false, code: mapped.code })
    return mapped
  }
}

function mapModelToResult(
  sourceKind: "image" | "pdf",
  parsed: EquipmentAiScanModelResult,
): { sourceKind: "image" | "pdf"; fields: EquipmentScanActionOk["data"]["fields"] } {
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
