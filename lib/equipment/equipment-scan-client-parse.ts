import type { EquipmentScanFieldPayload } from "@/lib/equipment/equipment-scan-action-result"

export type ParsedEquipmentScanAction =
  | { tag: "ok"; sourceKind: "image" | "pdf"; fields: EquipmentScanFieldPayload }
  | { tag: "err"; code: string; stage: string; message: string }
  | { tag: "malformed"; detail: string }

/** Normalize Server Action JSON (supports current `{ ok, data }` and legacy `{ ok, fields, sourceKind }`). */
export function parseEquipmentScanActionResult(input: unknown): ParsedEquipmentScanAction {
  if (input == null || typeof input !== "object") {
    return { tag: "malformed", detail: "not_an_object" }
  }
  const o = input as Record<string, unknown>

  if (o.ok === false) {
    return {
      tag: "err",
      code: typeof o.code === "string" ? o.code : "unknown",
      stage: typeof o.stage === "string" ? o.stage : "unknown",
      message: typeof o.message === "string" ? o.message : "This request could not be completed.",
    }
  }

  if (o.ok === true) {
    if (o.data != null && typeof o.data === "object") {
      const d = o.data as Record<string, unknown>
      const fields = d.fields
      if (fields != null && typeof fields === "object") {
        const sourceKind = d.sourceKind === "pdf" ? "pdf" : "image"
        return { tag: "ok", sourceKind, fields: fields as EquipmentScanFieldPayload }
      }
    }
    if (o.fields != null && typeof o.fields === "object") {
      const sourceKind = o.sourceKind === "pdf" ? "pdf" : "image"
      return { tag: "ok", sourceKind, fields: o.fields as EquipmentScanFieldPayload }
    }
    return { tag: "malformed", detail: "ok_true_missing_fields" }
  }

  return { tag: "malformed", detail: `unexpected_ok_${String(o.ok)}` }
}

export function sanitizeScanClientError(err: unknown, maxLen = 280): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`.replace(/\s+/g, " ").trim().slice(0, maxLen)
  }
  return String(err).replace(/\s+/g, " ").trim().slice(0, maxLen)
}

/** Minimal valid JPEG (1×1) for debug transport probes — binary only, no PII. */
export const EQUIPMENT_SCAN_DEBUG_MIN_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k="
