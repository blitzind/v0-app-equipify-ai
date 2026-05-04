import { z } from "zod"

/** Raw AI response shape (before mapping to calibration_templates.fields). */
export const aiImportFieldTypeSchema = z.enum([
  "section",
  "text",
  "number",
  "checkbox",
  "pass_fail",
  "notes",
])

export const aiImportFieldSchema = z.object({
  id: z.string(),
  type: aiImportFieldTypeSchema,
  label: z.string(),
  unit: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  helpText: z.string().optional(),
})

export const aiImportResponseSchema = z.object({
  templateName: z.string(),
  equipmentCategory: z.string().optional(),
  confidence: z.number(),
  fields: z.array(aiImportFieldSchema),
  warnings: z.array(z.string()),
})

export type AiImportResponse = z.infer<typeof aiImportResponseSchema>
