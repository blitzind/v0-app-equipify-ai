import "server-only"

/** Async `ai_jobs` migration for certificate template import: `@/lib/ai/jobs/certificate-import-async-note.ts`. */

import { executeOpenAiStructuredFileExtraction } from "@/lib/ai/openai-structured-file-task"
import { applyUserPromptTemplate, getPromptForTask } from "@/lib/ai/prompts"
import { aiImportResponseSchema } from "@/lib/calibration-templates/ai-import-schema"
import { mapAiImportResponseToDraft, type MappedImportDraft } from "@/lib/calibration-templates/map-ai-import-response"

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConfigError"
  }
}

/**
 * Certificate template extraction via centralized task `certificate_cleanup`
 * (multimodal PDF / image handling in `lib/ai/openai-structured-file-task.ts`).
 * Prompts: `equipify.certificate.template_extraction`.
 */
export async function generateTemplateDraftFromCertificateFile(args: {
  buffer: Buffer
  fileName: string
  mimeType: string
  organizationId: string | null
}): Promise<MappedImportDraft> {
  try {
    const prompt = getPromptForTask("certificate_cleanup")
    const userInstruction = applyUserPromptTemplate(prompt.userPromptTemplate, {})
    const parsed = await executeOpenAiStructuredFileExtraction({
      organizationId: args.organizationId,
      task: "certificate_cleanup",
      buffer: args.buffer,
      fileName: args.fileName || "certificate",
      mimeType: args.mimeType,
      systemPrompt: prompt.systemPrompt,
      userInstruction,
      schema: aiImportResponseSchema,
      skipUsageLog: !args.organizationId,
    })
    return mapAiImportResponseToDraft(parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("OPENAI_API_KEY") || msg.includes("not configured")) {
      throw new ConfigError("AI import is not configured. Add OPENAI_API_KEY.")
    }
    if (msg.includes("Unsupported media")) {
      throw new Error("Unsupported media type for vision import.")
    }
    if (msg.includes("timed out")) {
      throw new Error(msg)
    }
    if (msg.includes("empty response")) {
      throw new Error("The model returned an empty response. Try again.")
    }
    if (/required|Expected string|Expected number|invalid_type|too_small|Unexpected token|JSON at position/i.test(msg)) {
      throw new Error("The model returned an invalid template shape. Try again with a clearer file.")
    }
    if (msg.includes("below threshold") || msg.includes("Confidence")) {
      throw new Error("The model returned an invalid template shape. Try again with a clearer file.")
    }
    throw new Error("Import failed. Try again.")
  }
}
