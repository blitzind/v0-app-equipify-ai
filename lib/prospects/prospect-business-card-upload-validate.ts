import {
  mimeForSniff,
  sniffEquipmentScanFileKind,
  type EquipmentScanSniffKind,
} from "@/lib/equipment/equipment-scan-upload-validate"

export const PROSPECT_BUSINESS_CARD_SCAN_MAX_BYTES = 10 * 1024 * 1024

const ALLOWED_KINDS = new Set<EquipmentScanSniffKind>(["jpeg", "png", "heic"])

export type ProspectBusinessCardSniffKind = Extract<EquipmentScanSniffKind, "jpeg" | "png" | "heic">

export function sniffProspectBusinessCardFileKind(buffer: Buffer): ProspectBusinessCardSniffKind | "unknown" {
  const kind = sniffEquipmentScanFileKind(buffer)
  if (ALLOWED_KINDS.has(kind)) {
    return kind as ProspectBusinessCardSniffKind
  }
  return "unknown"
}

export function mimeForProspectBusinessCardKind(kind: ProspectBusinessCardSniffKind): string {
  return mimeForSniff(kind) ?? "application/octet-stream"
}
