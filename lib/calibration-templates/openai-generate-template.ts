import "server-only"

import OpenAI, { toFile } from "openai"
import type {
  ChatCompletion,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions/completions"
import { aiImportResponseSchema } from "@/lib/calibration-templates/ai-import-schema"
import { mapAiImportResponseToDraft, type MappedImportDraft } from "@/lib/calibration-templates/map-ai-import-response"

const SYSTEM_PROMPT = `You are an expert at calibration and metrology certificate layouts.

You will receive a calibration certificate as a PDF file and/or image. Your job is to output a **reusable certificate template** definition — NOT a filled certificate.

Output ONE JSON object only (no markdown), with this exact shape:
{
  "templateName": string,
  "equipmentCategory": string (optional),
  "confidence": number between 0 and 1,
  "fields": [
    {
      "id": string (unique string per row),
      "type": "section" | "text" | "number" | "checkbox" | "pass_fail" | "notes",
      "label": string,
      "unit": string (optional, for number),
      "required": boolean (optional),
      "options": string[] (optional),
      "helpText": string (optional)
    }
  ],
  "warnings": string[]
}

Rules:
- Identify structure: section headings, measurement tables, pass/fail checks, notes, signature/date areas.
- Field types:
  - section = section title / grouping only (no data entry).
  - text = short labeled line (use labels from the form, not filled values).
  - number = numeric measurement; set unit when shown (e.g. V, A, Ω, °C).
  - checkbox = tick-box items.
  - pass_fail = explicit pass/fail or tolerance rows.
  - notes = remarks, observations, free text areas.
- Do NOT embed customer names, serial numbers, readings, dates, or signatures as data. Treat filled values as hints for field labels only (e.g. reading "120.1 V" → number field "Voltage", unit "V").
- Use clear labels derived from the document; strip instance-specific values from labels.
- confidence reflects how well you inferred the layout (0–1).`

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConfigError"
  }
}

export async function generateTemplateDraftFromCertificateFile(args: {
  buffer: Buffer
  fileName: string
  mimeType: string
}): Promise<MappedImportDraft> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey?.trim()) {
    throw new ConfigError("AI import is not configured. Add OPENAI_API_KEY.")
  }

  const model = process.env.OPENAI_IMPORT_MODEL?.trim() || "gpt-4o"
  const client = new OpenAI({ apiKey })

  const isPdf = args.mimeType === "application/pdf"
  const isImage = args.mimeType === "image/png" || args.mimeType === "image/jpeg"

  let uploadedFileId: string | null = null

  try {
    const userContent: ChatCompletionContentPart[] = []

    if (isPdf) {
      let uploaded: { id: string }
      try {
        const file = await toFile(args.buffer, args.fileName || "certificate.pdf", {
          type: "application/pdf",
        })
        uploaded = await client.files.create({ file, purpose: "user_data" })
      } catch {
        throw new Error("Import failed. Try again.")
      }
      uploadedFileId = uploaded.id
      userContent.push({
        type: "file",
        file: { file_id: uploaded.id },
      })
    } else if (isImage) {
      const b64 = args.buffer.toString("base64")
      const dataUrl = `data:${args.mimeType};base64,${b64}`
      userContent.push({
        type: "image_url",
        image_url: { url: dataUrl, detail: "high" },
      })
    } else {
      throw new Error("Unsupported media type for vision import.")
    }

    userContent.push({
      type: "text",
      text: "Analyze this calibration certificate and output the JSON template object as specified.",
    })

    let completion: ChatCompletion
    try {
      completion = await client.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      })
    } catch {
      throw new Error("Import failed. Try again.")
    }

    const rawText = completion.choices[0]?.message?.content?.trim()
    if (!rawText) {
      throw new Error("The model returned an empty response. Try again.")
    }

    let json: unknown
    try {
      json = JSON.parse(rawText) as unknown
    } catch {
      throw new Error("The model returned invalid JSON. Try again.")
    }

    const parsed = aiImportResponseSchema.safeParse(json)
    if (!parsed.success) {
      throw new Error("The model returned an invalid template shape. Try again with a clearer file.")
    }

    return mapAiImportResponseToDraft(parsed.data)
  } finally {
    if (uploadedFileId) {
      try {
        await client.files.del(uploadedFileId)
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
}
