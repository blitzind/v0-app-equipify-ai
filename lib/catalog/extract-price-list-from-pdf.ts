import "server-only"

import OpenAI, { toFile } from "openai"
import type { ChatCompletion, ChatCompletionContentPart } from "openai/resources/chat/completions/completions"
import { randomUUID } from "crypto"
import {
  mapAiRowToExtracted,
  priceListAiResponseSchema,
  type ExtractedCatalogRow,
  type StoredPriceListPayload,
} from "@/lib/catalog/import-types"

export class PriceListExtractConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PriceListExtractConfigError"
  }
}

const SYSTEM_PROMPT = `You are an expert at reading manufacturer and distributor **price list PDFs** for medical/industrial equipment (e.g. audiometers, accessories, calibration services, rentals).

Extract **sellable catalog line items** only. Output ONE JSON object (no markdown) with this exact shape:
{
  "manufacturerName": string | null,
  "effectiveDate": string | null (ISO date YYYY-MM-DD if you see one),
  "warnings": string[],
  "rows": [
    {
      "category": string,
      "itemType": "equipment" | "part" | "accessory" | "service" | "rental" | "option" | "other",
      "partNumber": string | null,
      "name": string,
      "description": string | null,
      "listPrice": number | string | null,
      "cost": number | string | null,
      "notes": string | null,
      "replacementPartNumber": string | null,
      "status": "active" | "discontinued" | "needs_review",
      "confidence": number | null (0–1 for this row),
      "rawExtractedText": string | null (short snippet from PDF for this row)
    }
  ]
}

Rules:
- **Ignore** pure header/footer rows, page numbers, column titles, and blank lines — they must NOT become rows.
- When you see a **category section heading** (e.g. "Audiometer Prices", "Accessories", "Services"), apply that category string to following rows until another heading appears.
- Map **Suggested List Price / MSRP / List** → listPrice. Map **Dealer Net / Net / Dealer Cost / Your Cost** → cost. If only one price column exists, put it in listPrice and leave cost null unless the column is clearly labeled as cost/net.
- Normalize numeric prices to decimal numbers; blank or "N/A" prices → null (omit or null).
- Rows **discontinued**, "**OBS**", "**Replace by …**", etc.: status "discontinued", capture replacement in replacementPartNumber or notes.
- **Services** without part numbers (calibration, rental blocks): still output rows with itemType "service" or "rental", partNumber null, strong name/description.
- Never invent part numbers; null if absent.
- Keep rows concise; avoid duplicating the whole PDF.
- warnings[]: extraction caveats (e.g. messy tables, rotated pages).`

export async function extractPriceListPayloadFromPdf(args: {
  buffer: Buffer
  fileName: string
}): Promise<StoredPriceListPayload> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey?.trim()) {
    throw new PriceListExtractConfigError("AI extraction is not configured. Add OPENAI_API_KEY.")
  }

  const model = process.env.OPENAI_PRICE_LIST_MODEL?.trim() || process.env.OPENAI_IMPORT_MODEL?.trim() || "gpt-4o"
  const client = new OpenAI({ apiKey })

  let uploadedFileId: string | null = null
  try {
    const file = await toFile(args.buffer, args.fileName || "price-list.pdf", {
      type: "application/pdf",
    })
    const uploaded = await client.files.create({ file, purpose: "user_data" })
    uploadedFileId = uploaded.id

    const userContent: ChatCompletionContentPart[] = [
      { type: "file", file: { file_id: uploaded.id } },
      {
        type: "text",
        text: "Extract catalog line items from this price list PDF and output the JSON object exactly as specified.",
      },
    ]

    let completion: ChatCompletion
    try {
      completion = await client.chat.completions.create({
        model,
        temperature: 0.15,
        max_tokens: 16384,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      })
    } catch {
      throw new Error("AI extraction failed. Try a smaller PDF or try again.")
    }

    const rawText = completion.choices[0]?.message?.content?.trim()
    if (!rawText) {
      throw new Error("The model returned an empty response.")
    }

    let json: unknown
    try {
      json = JSON.parse(rawText) as unknown
    } catch {
      throw new Error("The model returned invalid JSON.")
    }

    const parsed = priceListAiResponseSchema.safeParse(json)
    if (!parsed.success) {
      throw new Error("The model returned an unexpected JSON shape. Try re-running extraction.")
    }

    const rows: ExtractedCatalogRow[] = parsed.data.rows.map((r) => mapAiRowToExtracted(r, randomUUID()))

    const payload: StoredPriceListPayload = {
      version: 1,
      manufacturerName: parsed.data.manufacturerName?.trim() || null,
      effectiveDate: parsed.data.effectiveDate?.trim() || null,
      warnings: parsed.data.warnings ?? [],
      rows,
    }

    return payload
  } finally {
    if (uploadedFileId) {
      try {
        await client.files.del(uploadedFileId)
      } catch {
        /* ignore */
      }
    }
  }
}
