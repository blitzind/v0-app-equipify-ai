import "server-only"

import {
  buildDebugEquipmentScanSuccess,
  extractEquipmentFieldsFromUpload,
} from "@/lib/equipment/equipment-ai-scan"
import type { EquipmentScanActionResult } from "@/lib/equipment/equipment-scan-action-result"
import { equipmentScanServerLog } from "@/lib/equipment/equipment-scan-server-log"
import { sniffEquipmentScanFileKind } from "@/lib/equipment/equipment-scan-upload-validate"

function debugEquipmentScanMockEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEBUG_EQUIPMENT_SCAN === "true" ||
    process.env.DEBUG_EQUIPMENT_SCAN_MOCK === "true"
  )
}

/**
 * Buffer → sniff / debug mock / OpenAI extraction. Caller must enforce org + create permissions.
 */
export async function ingestEquipmentScanUpload(args: {
  organizationId: string
  buffer: Buffer
  fileName: string
}): Promise<EquipmentScanActionResult> {
  const { organizationId, buffer, fileName } = args
  equipmentScanServerLog("ingest_enter", { byteLength: buffer.byteLength })

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
    fileName,
  })
  equipmentScanServerLog("response_return", { ok: out.ok })
  return out
}
