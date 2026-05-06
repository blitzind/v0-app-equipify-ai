import "server-only"

import { randomUUID } from "crypto"
import { executeOpenAiStructuredFileExtraction } from "@/lib/ai/openai-structured-file-task"
import { applyUserPromptTemplate, getPromptForTask } from "@/lib/ai/prompts"
import {
  extractedCatalogRowSchema,
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

/**
 * Extract catalog rows from a PDF using the centralized AI router task `catalog_extraction`
 * (OpenAI file upload handled in `lib/ai/openai-structured-file-task.ts`).
 * Prompts: `lib/ai/prompts/registry.ts` → `equipify.catalog.price_list_extraction`.
 */
export async function extractPriceListPayloadFromPdf(args: {
  buffer: Buffer
  fileName: string
  organizationId: string
}): Promise<StoredPriceListPayload> {
  try {
    const prompt = getPromptForTask("catalog_extraction")
    const userInstruction = applyUserPromptTemplate(prompt.userPromptTemplate, {})
    const parsed = await executeOpenAiStructuredFileExtraction({
      organizationId: args.organizationId,
      task: "catalog_extraction",
      buffer: args.buffer,
      fileName: args.fileName || "price-list.pdf",
      mimeType: "application/pdf",
      systemPrompt: prompt.systemPrompt,
      userInstruction,
      schema: priceListAiResponseSchema,
    })

    const rows: ExtractedCatalogRow[] = parsed.rows.map((r) =>
      mapAiRowToExtracted(extractedCatalogRowSchema.parse(r), randomUUID()),
    )

    return {
      version: 1,
      manufacturerName: parsed.manufacturerName?.trim() || null,
      effectiveDate: parsed.effectiveDate?.trim() || null,
      warnings: parsed.warnings ?? [],
      rows,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("OPENAI_API_KEY") || msg.includes("not configured")) {
      throw new PriceListExtractConfigError("AI extraction is not configured. Add OPENAI_API_KEY.")
    }
    if (msg.includes("timed out")) {
      throw new Error(msg)
    }
    if (msg.includes("empty response")) {
      throw new Error("The model returned an empty response.")
    }
    if (msg.includes("below threshold") || msg.includes("Confidence")) {
      throw new Error("The model returned an unexpected JSON shape. Try re-running extraction.")
    }
    if (/No JSON object found|unexpected JSON token|Unexpected token|JSON at position/i.test(msg)) {
      throw new Error("The model returned invalid JSON.")
    }
    if (/required|Expected string|Expected number|invalid_type|too_small/i.test(msg)) {
      throw new Error("The model returned an unexpected JSON shape. Try re-running extraction.")
    }
    throw new Error("AI extraction failed. Try a smaller PDF or try again.")
  }
}
