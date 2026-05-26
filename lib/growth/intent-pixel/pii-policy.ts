import {
  GROWTH_INTENT_PIXEL_PII_CAPTURE_SOURCES,
  type GrowthIntentPixelConversionType,
  type GrowthIntentPixelPiiCaptureSource,
  type GrowthIntentPixelSubmittedIdentity,
} from "@/lib/growth/intent-pixel/intent-pixel-types"

const CONVERSION_TO_PII_SOURCE: Partial<Record<GrowthIntentPixelConversionType, GrowthIntentPixelPiiCaptureSource>> = {
  form_submit: "form",
  booking: "booking",
  chat: "chat",
  login: "login",
  lead_capture: "lead_capture",
}

function asString(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed || null
}

export function resolvePiiCaptureSource(
  conversionType: GrowthIntentPixelConversionType | undefined,
): GrowthIntentPixelPiiCaptureSource | null {
  if (!conversionType) return null
  return CONVERSION_TO_PII_SOURCE[conversionType] ?? null
}

export function sanitizeSubmittedIdentity(
  identity: GrowthIntentPixelSubmittedIdentity | undefined,
  captureSource: GrowthIntentPixelPiiCaptureSource | null,
): {
  allowed: boolean
  identity: GrowthIntentPixelSubmittedIdentity | null
  reason: string
} {
  if (!identity) {
    return { allowed: false, identity: null, reason: "No submitted identity provided." }
  }

  if (!captureSource || !GROWTH_INTENT_PIXEL_PII_CAPTURE_SOURCES.includes(captureSource)) {
    return {
      allowed: false,
      identity: null,
      reason: "PII cannot be attached without an explicit capture source (form, booking, chat, login, lead_capture).",
    }
  }

  const sanitized: GrowthIntentPixelSubmittedIdentity = {
    email: asString(identity.email),
    phone: asString(identity.phone),
    full_name: asString(identity.full_name),
    linkedin_url: asString(identity.linkedin_url),
    company_name: asString(identity.company_name),
  }

  const hasField = Object.values(sanitized).some((value) => value != null)
  if (!hasField) {
    return { allowed: false, identity: null, reason: "Submitted identity empty after sanitization." }
  }

  return {
    allowed: true,
    identity: sanitized,
    reason: `PII attached from explicit ${captureSource} capture.`,
  }
}

/** Anonymous visitors must never receive inferred PII from pageviews alone. */
export const GROWTH_INTENT_PIXEL_PRIVACY_NOTE =
  "Anonymous visitors are not assigned name, email, phone, or LinkedIn. PII is stored only when submitted via form, booking, chat, login, lead capture, or a future compliant enrichment source." as const
