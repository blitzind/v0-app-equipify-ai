import "server-only"

import sharp from "sharp"

import { applyUserPromptTemplate, getPromptForTask } from "@/lib/ai/prompts"
import { executeOpenAiStructuredFileExtraction } from "@/lib/ai/openai-structured-file-task"
import {
  hasExtractedBusinessCardText,
  normalizeProspectBusinessCardFields,
} from "@/lib/prospects/prospect-business-card-normalize"
import {
  prospectBusinessCardScanModelSchema,
  type ProspectBusinessCardScanFields,
  type ProspectBusinessCardScanModelResult,
} from "@/lib/prospects/prospect-business-card-scan-schema"
import {
  mimeForProspectBusinessCardKind,
  PROSPECT_BUSINESS_CARD_SCAN_MAX_BYTES,
  sniffProspectBusinessCardFileKind,
} from "@/lib/prospects/prospect-business-card-upload-validate"

export type ProspectBusinessCardScanFailureCode =
  | "UNSUPPORTED_FILE"
  | "NO_TEXT_FOUND"
  | "AI_UNAVAILABLE"
  | "NO_AI_ACCESS"
  | "RATE_LIMITED"
  | "INVALID_IMAGE"

export type ProspectBusinessCardScanResult =
  | { ok: true; fields: ProspectBusinessCardScanFields }
  | { ok: false; code: ProspectBusinessCardScanFailureCode; message: string }

const AI_UNAVAILABLE = "AI extraction is temporarily unavailable. Try again in a moment."

function mapModelToFields(parsed: ProspectBusinessCardScanModelResult): ProspectBusinessCardScanFields {
  return normalizeProspectBusinessCardFields({
    company_name: parsed.company_name,
    contact_name: parsed.contact_name,
    contact_email: parsed.contact_email,
    contact_phone: parsed.contact_phone,
    website: parsed.website,
    address_line1: parsed.address_line1,
    address_line2: parsed.address_line2,
    city: parsed.city,
    state: parsed.state,
    postal_code: parsed.postal_code,
    country: parsed.country,
    notes: parsed.notes,
    confidence: parsed.confidence ?? null,
  })
}

function mapThrownError(err: unknown): ProspectBusinessCardScanResult {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  if (
    lower.includes("not included") ||
    lower.includes("plan") ||
    lower.includes("upgrade") ||
    lower.includes("billing is restricted")
  ) {
    return {
      ok: false,
      code: "NO_AI_ACCESS",
      message:
        "Business card scanning is available on Growth, Scale, and Enterprise plans. Upgrade in billing to unlock AI prospect tools.",
    }
  }

  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "AI is busy right now. Wait a moment and try again.",
    }
  }

  if (
    lower.includes("unsupported media") ||
    lower.includes("invalid image") ||
    lower.includes("could not process image")
  ) {
    return {
      ok: false,
      code: "INVALID_IMAGE",
      message: "This image could not be processed. Try a clearer photo in JPG or PNG.",
    }
  }

  if (lower.includes("not configured") || lower.includes("no openai")) {
    return { ok: false, code: "AI_UNAVAILABLE", message: AI_UNAVAILABLE }
  }

  return { ok: false, code: "AI_UNAVAILABLE", message: AI_UNAVAILABLE }
}

export async function extractProspectFieldsFromBusinessCardUpload(args: {
  organizationId: string
  buffer: Buffer
  fileName: string
}): Promise<ProspectBusinessCardScanResult> {
  const { organizationId, buffer, fileName } = args

  const sniff = sniffProspectBusinessCardFileKind(buffer)
  if (sniff === "unknown") {
    return {
      ok: false,
      code: "UNSUPPORTED_FILE",
      message: "Unsupported file type. Use JPG, PNG, or HEIC.",
    }
  }

  if (buffer.byteLength > PROSPECT_BUSINESS_CARD_SCAN_MAX_BYTES) {
    return {
      ok: false,
      code: "UNSUPPORTED_FILE",
      message: "This image is too large. Maximum size is 10 MB.",
    }
  }

  let imageBuffer = buffer
  let imageMime = mimeForProspectBusinessCardKind(sniff)

  if (sniff === "heic") {
    try {
      imageBuffer = await sharp(buffer).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer()
      imageMime = "image/jpeg"
    } catch {
      return {
        ok: false,
        code: "INVALID_IMAGE",
        message: "Could not read this HEIC image. Convert it to JPG or PNG and try again.",
      }
    }
  }

  try {
    await sharp(imageBuffer).metadata()
  } catch {
    return {
      ok: false,
      code: "INVALID_IMAGE",
      message: "This image could not be read. Try another photo with better lighting.",
    }
  }

  let pr: ReturnType<typeof getPromptForTask>
  let userInstruction: string
  try {
    pr = getPromptForTask("prospect_business_card_scan")
    userInstruction = applyUserPromptTemplate(pr.userPromptTemplate, {
      fileName: fileName || "business-card.jpg",
    })
  } catch {
    return { ok: false, code: "AI_UNAVAILABLE", message: AI_UNAVAILABLE }
  }

  try {
    const parsed = await executeOpenAiStructuredFileExtraction({
      organizationId,
      task: "prospect_business_card_scan",
      buffer: imageBuffer,
      fileName: fileName || "business-card.jpg",
      mimeType: imageMime,
      systemPrompt: pr.systemPrompt,
      userInstruction,
      schema: prospectBusinessCardScanModelSchema,
    })

    const fields = mapModelToFields(parsed)
    if (!hasExtractedBusinessCardText(fields)) {
      return {
        ok: false,
        code: "NO_TEXT_FOUND",
        message: "No readable business card text was found. Try a clearer photo with the card flat and well lit.",
      }
    }

    return { ok: true, fields }
  } catch (err) {
    return mapThrownError(err)
  }
}
