/**
 * Non-sensitive client diagnostics for the Equipment AI scan upload pipeline.
 * Logs structured JSON to the console (no filenames with PII — use extension + coarse flags only).
 */

export type EquipmentScanDiagEvent =
  | "upload_start"
  | "client_file_selected"
  | "client_compression_start"
  | "client_compression_end"
  | "client_action_start"
  | "file_type"
  | "file_size_mb"
  | "safari_heic_detected"
  /** @deprecated prefer client_compression_end */
  | "compression_done"
  /** @deprecated prefer client_compression_end */
  | "compression_skipped"
  | "compression_failed"
  | "upload_request_started"
  | "upload_response_received"
  | "upload_response_ok"
  | "upload_response_error"
  | "extraction_started"
  | "extraction_failed"
  | "upload_failed"
  | "timeout_hit"

export function equipmentScanDiag(
  event: EquipmentScanDiagEvent,
  fields: Record<string, string | number | boolean | null | undefined> = {},
): void {
  try {
    const payload = {
      ns: "equipment_scan",
      event,
      ...fields,
    }
    console.info("[equipment_scan]", JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function equipmentScanClientHints(): {
  isSafari: boolean
  isIos: boolean
  browserFamily: "safari" | "other"
  osFamily: "ios" | "other"
} {
  if (typeof navigator === "undefined") {
    return { isSafari: false, isIos: false, browserFamily: "other", osFamily: "other" }
  }
  const ua = navigator.userAgent || ""
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1)
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|Edg|OPR|Android/i.test(ua)
  return {
    isSafari,
    isIos,
    browserFamily: isSafari ? "safari" : "other",
    osFamily: isIos ? "ios" : "other",
  }
}
