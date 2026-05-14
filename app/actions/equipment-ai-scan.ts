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
  } catch {
    return {
      ok: false,
      message: "Something went wrong while processing the file. Try again or use manual entry.",
    }
  }
}
