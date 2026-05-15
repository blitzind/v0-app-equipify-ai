"use server"

import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import { ingestEquipmentScanUpload } from "@/lib/equipment/equipment-scan-ingest"
import type { EquipmentScanActionResult } from "@/lib/equipment/equipment-scan-action-result"
import { equipmentScanServerLog } from "@/lib/equipment/equipment-scan-server-log"
import { isNextRedirectError } from "@/lib/server/is-next-redirect-error"

/**
 * @deprecated Prefer POST `/api/organizations/{organizationId}/equipment/ai-scan` from the client
 * (multipart Server Actions can be fragile). Kept for scripts / backward compatibility.
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

    const out = await ingestEquipmentScanUpload({
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
