import type { CalibrationFieldType, CalibrationTemplateField } from "@/lib/calibration-certificates"
import type { AiImportResponse } from "@/lib/calibration-templates/ai-import-schema"

const REVIEW_MESSAGE = "AI created a draft. Review all fields before using this template."

function mapAiTypeToCalibration(t: AiImportResponse["fields"][number]["type"]): CalibrationFieldType {
  if (t === "section") return "section_heading"
  return t
}

function buildCalibrationField(row: AiImportResponse["fields"][number]): CalibrationTemplateField {
  const id = crypto.randomUUID()
  const type = mapAiTypeToCalibration(row.type)
  const helpParts = [
    row.helpText?.trim(),
    row.options?.length ? `Choices: ${row.options.join(", ")}` : "",
  ].filter(Boolean)
  const helpText = helpParts.join("\n\n").trim()

  if (type === "section_heading") {
    return { id, type: "section_heading", label: row.label.trim() || "Section", required: false, helpText }
  }
  if (type === "number") {
    return {
      id,
      type: "number",
      label: row.label.trim() || "Measurement",
      required: Boolean(row.required),
      helpText,
      unit: row.unit?.trim() ?? "",
    }
  }
  return {
    id,
    type,
    label: row.label.trim() || "Field",
    required: Boolean(row.required),
    helpText,
  }
}

export type MappedImportDraft = {
  suggestedName: string
  equipmentCategoryId: string
  fields: CalibrationTemplateField[]
  confidenceMessage: string
  extractionWarnings: string[]
}

export function mapAiImportResponseToDraft(parsed: AiImportResponse): MappedImportDraft {
  const fields = parsed.fields.map(buildCalibrationField)
  const warn = [...parsed.warnings]
  if (Number.isFinite(parsed.confidence)) {
    warn.unshift(`Model confidence: ${Math.round(parsed.confidence * 100) / 100}`)
  }
  return {
    suggestedName: parsed.templateName.trim() || "Imported template",
    equipmentCategoryId: parsed.equipmentCategory?.trim() ?? "",
    fields,
    confidenceMessage: REVIEW_MESSAGE,
    extractionWarnings: warn,
  }
}
