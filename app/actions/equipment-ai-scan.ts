"use server"

import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import {
  extractEquipmentFieldsFromUpload,
  type EquipmentScanExtractionResult,
} from "@/lib/equipment/equipment-ai-scan"

/**
 * Server-side equipment scan: validates org + create eligibility, sniffs file type,
 * runs image vision or PDF text extraction + structured AI. Returns safe user messages only.
 */
export async function extractEquipmentFromScanUploadAction(
  formData: FormData,
): Promise<EquipmentScanExtractionResult> {
  const organizationId = String(formData.get("organizationId") ?? "").trim()
  if (!organizationId) {
    return { ok: false, message: "No workspace selected. Choose an organization and try again." }
  }

  const gate = await enforceCanCreateRecord(organizationId, "equipment")
  if (!gate.ok) {
    return { ok: false, message: gate.message }
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Please choose a file to upload." }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    return await extractEquipmentFieldsFromUpload({
      organizationId,
      buffer,
      fileName: file.name || "upload",
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ""
    const lower = msg.toLowerCase()
    if (lower.includes("body exceeded") || lower.includes("413")) {
      return {
        ok: false,
        message:
          "Upload is too large for the server. Try a smaller image or a PDF under about 4 MB, then try again.",
      }
    }
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return {
        ok: false,
        message: "AI extraction timed out. Try again with a smaller file or better connectivity.",
      }
    }
    return {
      ok: false,
      message: "Something went wrong while processing the file. Try again or use manual entry.",
    }
  }
}
