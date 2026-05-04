/**
 * Client-side certificate template import: POST multipart to /api/certificates/import-template
 * (OpenAI runs only on the server; OPENAI_API_KEY is never exposed to the browser).
 */

import type { CalibrationTemplateField } from "@/lib/calibration-certificates"

export type ImportDraftResult = {
  suggestedName: string
  equipmentCategoryId: string
  fields: CalibrationTemplateField[]
  confidenceMessage: string
  extractionWarnings: string[]
}

function parseErrorPayload(body: unknown): string | null {
  if (!body || typeof body !== "object") return null
  const err = (body as { error?: unknown }).error
  return typeof err === "string" && err.trim() ? err.trim() : null
}

export async function runCertificateTemplateImport(file: File): Promise<ImportDraftResult> {
  const form = new FormData()
  form.append("file", file)

  let res: Response
  try {
    res = await fetch("/api/certificates/import-template", {
      method: "POST",
      body: form,
    })
  } catch {
    throw new Error("Network error while uploading. Check your connection and try again.")
  }

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    const parsed = parseErrorPayload(body)
    if (parsed) throw new Error(parsed)
    if (res.status === 503) {
      throw new Error("AI import is not configured. Add OPENAI_API_KEY.")
    }
    throw new Error("Import failed.")
  }

  if (!body || typeof body !== "object") {
    throw new Error("Invalid response from import service.")
  }

  const d = body as Partial<ImportDraftResult>
  if (!Array.isArray(d.fields)) {
    throw new Error("Invalid response from import service.")
  }

  return {
    suggestedName: typeof d.suggestedName === "string" ? d.suggestedName : "Imported template",
    equipmentCategoryId: typeof d.equipmentCategoryId === "string" ? d.equipmentCategoryId : "",
    fields: d.fields,
    confidenceMessage:
      typeof d.confidenceMessage === "string"
        ? d.confidenceMessage
        : "AI created a draft. Review all fields before using this template.",
    extractionWarnings: Array.isArray(d.extractionWarnings)
      ? d.extractionWarnings.filter((x): x is string => typeof x === "string")
      : [],
  }
}
