"use server"

import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import {
  buildDebugEquipmentScanSuccess,
  extractEquipmentFieldsFromUpload,
} from "@/lib/equipment/equipment-ai-scan"
import type { EquipmentScanActionResult } from "@/lib/equipment/equipment-scan-action-result"
import { equipmentScanServerLog } from "@/lib/equipment/equipment-scan-server-log"
import { sniffEquipmentScanFileKind } from "@/lib/equipment/equipment-scan-upload-validate"
import { isNextRedirectError } from "@/lib/server/is-next-redirect-error"

function debugEquipmentScanMockEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEBUG_EQUIPMENT_SCAN === "true" ||
    process.env.DEBUG_EQUIPMENT_SCAN_MOCK === "true"
  )
}

/**
 * Server-side equipment scan: validates org + create eligibility, sniffs file type,
 * runs image vision or PDF text extraction + structured AI.
 * Always returns a plain JSON-serializable object (never throws except Next redirects).
 */
export async function extractEquipmentFromScanUploadAction(
  formData: FormData,
): Promise<EquipmentScanActionResult> {
  try {
    equipmentScanServerLog("server_action_enter", {})

    const organizationId = String(formData.get("organizationId") ?? "").trim()
    if (!organizationId) {
      return {
        ok: false,
        code: "no_organization",
        stage: "server_action_enter",
        message: "No workspace selected. Choose an organization and try again.",
      }
    }

    equipmentScanServerLog("permission_check", { phase: "start" })
    const gate = await enforceCanCreateRecord(organizationId, "equipment")
    if (!gate.ok) {
      const stage = gate.code === "unauthorized" ? "auth_check" : "permission_check"
      equipmentScanServerLog(stage, { ok: false, code: gate.code })
      return {
        ok: false,
        code: gate.code,
        stage,
        message: gate.message,
      }
    }
    equipmentScanServerLog("permission_check", { ok: true })

    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) {
      equipmentScanServerLog("file_validation", { ok: false, reason: "missing_or_empty" })
      return {
        ok: false,
        code: "no_file",
        stage: "file_validation",
        message: "Please choose a file to upload.",
      }
    }

    equipmentScanServerLog("file_validation", { ok: true, bytes: file.size })

    let buffer: Buffer
    try {
      buffer = Buffer.from(await file.arrayBuffer())
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 160) : String(e)
      equipmentScanServerLog("file_validation", { ok: false, reason: "array_buffer", message: msg })
      return {
        ok: false,
        code: "buffer_read_failed",
        stage: "file_validation",
        message: "Could not read the uploaded file. Try again or pick a different file.",
      }
    }

    if (debugEquipmentScanMockEnabled()) {
      equipmentScanServerLog("debug_mock_bypass", { active: true })
      const sniff = sniffEquipmentScanFileKind(buffer)
      equipmentScanServerLog("magic_byte_sniff", { sniff, mock: true })
      if (sniff === "unknown") {
        return {
          ok: false,
          code: "unsupported_type",
          stage: "magic_byte_sniff",
          message:
            "This file type is not supported. Use a JPG, PNG, HEIC, WebP, GIF, or PDF (for example a calibration certificate or spec sheet).",
        }
      }
      const out = buildDebugEquipmentScanSuccess(sniff === "pdf" ? "pdf" : "image")
      equipmentScanServerLog("response_return", { mock: true, ok: true })
      return out
    }

    const out = await extractEquipmentFieldsFromUpload({
      organizationId,
      buffer,
      fileName: file.name || "upload",
    })
    equipmentScanServerLog("response_return", { ok: out.ok })
    return out
  } catch (err) {
    if (isNextRedirectError(err)) throw err
    const msg = err instanceof Error ? err.message : String(err)
    const lower = msg.toLowerCase()
    equipmentScanServerLog("server_action_fatal", { message: msg.slice(0, 200) })
    if (lower.includes("body exceeded") || lower.includes("413")) {
      return {
        ok: false,
        code: "payload_too_large",
        stage: "server_action",
        message:
          "Upload is too large for the server. Try a smaller image or a PDF under about 4 MB, then try again.",
      }
    }
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return {
        ok: false,
        code: "server_timeout",
        stage: "server_action",
        message: "AI extraction timed out. Try again with a smaller file or better connectivity.",
      }
    }
    return {
      ok: false,
      code: "unexpected",
      stage: "server_action",
      message: "Something went wrong while processing the scan. Try again or use manual entry.",
    }
  }
}
