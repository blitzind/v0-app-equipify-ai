/** Phone verification — business/mobile/invalid classification. Client-safe. */

export type PhoneVerificationResult = {
  phone: string
  phone_status: "unknown" | "business" | "mobile" | "invalid"
  confidence: number
  reasons: string[]
}

const PHONE_FORMAT = /^(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}$/

const MOBILE_HINTS = /\b(mobile|cell|sms|text)\b/i
const BUSINESS_HINTS = /\b(office|main|direct|ext|fax|service|dispatch)\b/i

export function verifyPhoneNumber(phone: string | null | undefined, context = ""): PhoneVerificationResult | null {
  const normalized = (phone ?? "").replace(/[^\d+().-\s]/g, "").trim()
  if (!normalized) return null

  const reasons: string[] = []
  if (!PHONE_FORMAT.test(normalized)) {
    return {
      phone: normalized,
      phone_status: "invalid",
      confidence: 0,
      reasons: ["Invalid phone format"],
    }
  }

  let phone_status: PhoneVerificationResult["phone_status"] = "unknown"
  let confidence = 0.45

  if (MOBILE_HINTS.test(context)) {
    phone_status = "mobile"
    confidence = 0.65
    reasons.push("Mobile context hint")
  } else if (BUSINESS_HINTS.test(context) || normalized.startsWith("(") || normalized.includes("ext")) {
    phone_status = "business"
    confidence = 0.7
    reasons.push("Business line pattern")
  } else {
    phone_status = "business"
    confidence = 0.55
    reasons.push("Valid North American number — default business classification")
  }

  return { phone: normalized, phone_status, confidence, reasons }
}
