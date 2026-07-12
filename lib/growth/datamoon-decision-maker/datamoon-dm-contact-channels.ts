/**
 * GE-AIOS-CONTACT-1A — DataMoon contact channel extraction & normalization (client-safe).
 * Does not fabricate emails/phones. Preserves provider provenance.
 */

import { normalizeEmail, normalizePhone, trimOrNull } from "@/lib/growth/import/normalize"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"

export const GROWTH_AIOS_CONTACT_1A_QA_MARKER =
  "ge-aios-contact-1a-datamoon-email-phone-completion-v1" as const

export const DATAMOON_EMAIL_FIELD_KEYS = [
  "business_email",
  "work_email",
  "email",
  "primary_email",
  "personal_emails",
  "personal_email",
  "alternate_emails",
  "emails",
] as const

export const DATAMOON_PHONE_FIELD_KEYS = [
  "personal_phone",
  "mobile_phone",
  "mobile",
  "direct_phone",
  "direct_dial",
  "work_phone",
  "business_phone",
  "phone",
  "company_phone",
  "office_phone",
  "main_phone",
] as const

export type DatamoonNormalizedEmailChannel = {
  value: string
  normalized: string
  emailType: "work" | "personal" | "unknown"
  rawProviderValue: string
  fieldKey: string
  providerConfidence: number | null
}

export type DatamoonNormalizedPhoneChannel = {
  value: string
  normalized: string
  e164: string | null
  extension: string | null
  phoneType: "mobile" | "direct" | "work" | "company" | "unknown"
  isCompanySwitchboard: boolean
  rawProviderValue: string
  fieldKey: string
  providerConfidence: number | null
}

export type DatamoonExtractedContactChannels = {
  emails: DatamoonNormalizedEmailChannel[]
  phones: DatamoonNormalizedPhoneChannel[]
  primaryEmail: string | null
  primaryPhone: string | null
  rejectedEmails: string[]
  rejectedPhones: string[]
}

function pickRawValues(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (typeof value === "string") {
    return value
      .split(/[,;|]/)
      .map((part) => part.trim())
      .filter(Boolean)
  }
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => {
        if (typeof entry === "string") return [entry]
        if (entry && typeof entry === "object") {
          const obj = entry as Record<string, unknown>
          for (const nested of ["email", "value", "address", "phone", "number"]) {
            if (typeof obj[nested] === "string") return [obj[nested] as string]
          }
        }
        return []
      })
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return []
}

function classifyEmailType(fieldKey: string): DatamoonNormalizedEmailChannel["emailType"] {
  if (fieldKey.includes("personal")) return "personal"
  if (fieldKey.includes("business") || fieldKey.includes("work")) return "work"
  return "unknown"
}

function classifyPhoneType(fieldKey: string): DatamoonNormalizedPhoneChannel["phoneType"] {
  if (fieldKey.includes("mobile")) return "mobile"
  if (fieldKey.includes("direct")) return "direct"
  if (fieldKey.includes("company") || fieldKey.includes("main") || fieldKey.includes("office")) {
    return "company"
  }
  if (fieldKey.includes("work") || fieldKey.includes("business")) return "work"
  if (fieldKey.includes("personal")) return "mobile"
  return "unknown"
}

function extractPhoneExtension(raw: string): { numberPart: string; extension: string | null } {
  const extMatch = raw.match(/(?:ext\.?|x|extension)\s*[:.]?\s*(\d{1,8})\b/i)
  const extension = extMatch?.[1] ?? null
  const numberPart = extension
    ? raw.replace(/(?:ext\.?|x|extension)\s*[:.]?\s*\d{1,8}\b/i, "").trim()
    : raw
  return { numberPart, extension }
}

function looksLikeCompanySwitchboard(input: {
  fieldKey: string
  raw: string
  phoneType: DatamoonNormalizedPhoneChannel["phoneType"]
}): boolean {
  if (input.phoneType === "company") return true
  const hay = `${input.fieldKey} ${input.raw}`.toLowerCase()
  return /switchboard|reception|main\s*line|front\s*desk|company\s*phone|office\s*main/.test(hay)
}

function pickConfidence(record: Record<string, unknown>): number | null {
  for (const key of ["confidence", "score", "match_confidence", "email_confidence", "phone_confidence"]) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 1 ? Math.min(1, value / 100) : Math.max(0, Math.min(1, value))
    }
  }
  return null
}

/**
 * Extract and normalize all usable contact channels from a raw DataMoon person record.
 */
export function extractDatamoonContactChannels(
  record: unknown,
): DatamoonExtractedContactChannels {
  const raw =
    record && typeof record === "object" && !Array.isArray(record)
      ? (record as Record<string, unknown>)
      : {}

  const confidence = pickConfidence(raw)
  const emails: DatamoonNormalizedEmailChannel[] = []
  const rejectedEmails: string[] = []
  const seenEmails = new Set<string>()

  for (const fieldKey of DATAMOON_EMAIL_FIELD_KEYS) {
    for (const candidate of pickRawValues(raw, fieldKey)) {
      const normalized = normalizeEmail(candidate)
      if (!normalized) {
        rejectedEmails.push(candidate)
        continue
      }
      if (seenEmails.has(normalized)) continue
      seenEmails.add(normalized)
      emails.push({
        value: candidate.trim().toLowerCase(),
        normalized,
        emailType: classifyEmailType(fieldKey),
        rawProviderValue: candidate,
        fieldKey,
        providerConfidence: confidence,
      })
    }
  }

  const phones: DatamoonNormalizedPhoneChannel[] = []
  const rejectedPhones: string[] = []
  const seenPhones = new Set<string>()

  for (const fieldKey of DATAMOON_PHONE_FIELD_KEYS) {
    for (const candidate of pickRawValues(raw, fieldKey)) {
      const { numberPart, extension } = extractPhoneExtension(candidate)
      const normalized = normalizePhone(numberPart)
      if (!normalized) {
        rejectedPhones.push(candidate)
        continue
      }
      if (seenPhones.has(normalized)) continue
      seenPhones.add(normalized)
      const phoneType = classifyPhoneType(fieldKey)
      const isCompanySwitchboard = looksLikeCompanySwitchboard({
        fieldKey,
        raw: candidate,
        phoneType,
      })
      phones.push({
        value: numberPart.trim(),
        normalized,
        e164: normalizeToE164(numberPart),
        extension,
        phoneType,
        isCompanySwitchboard,
        rawProviderValue: candidate,
        fieldKey,
        providerConfidence: confidence,
      })
    }
  }

  const personPhones = phones.filter((phone) => !phone.isCompanySwitchboard)
  const primaryEmail =
    emails.find((email) => email.emailType === "work")?.normalized ??
    emails[0]?.normalized ??
    null
  const primaryPhone =
    personPhones.find((phone) => phone.phoneType === "direct" || phone.phoneType === "mobile")
      ?.normalized ??
    personPhones[0]?.normalized ??
    null

  return {
    emails,
    phones,
    primaryEmail,
    primaryPhone,
    rejectedEmails: [...new Set(rejectedEmails)],
    rejectedPhones: [...new Set(rejectedPhones)],
  }
}

export type AiOsContactChannelReadinessState =
  | "verified_email"
  | "email_available_unverified"
  | "verified_phone"
  | "phone_available_unverified"
  | "email_and_phone_verified"
  | "profile_only"
  | "no_usable_channel"

export type AiOsContactChannelReadiness = {
  qaMarker: typeof GROWTH_AIOS_CONTACT_1A_QA_MARKER
  state: AiOsContactChannelReadinessState
  emailAvailable: boolean
  emailVerified: boolean
  phoneAvailable: boolean
  phoneVerified: boolean
  profileAvailable: boolean
  primaryEmail: string | null
  primaryPhone: string | null
  unblocksEmailDrafting: boolean
  unblocksCallPackage: boolean
  reason: string
}

/**
 * Deterministic contact-readiness projection.
 * Provider-returned emails are "available" not "verified" unless verification evidence is present.
 */
export function projectContactChannelReadiness(input: {
  emails?: Array<{ normalized: string; verificationStatus?: string | null }>
  phones?: Array<{
    normalized: string
    verificationStatus?: string | null
    isCompanySwitchboard?: boolean
  }>
  linkedinUrl?: string | null
}): AiOsContactChannelReadiness {
  const emails = input.emails ?? []
  const phones = (input.phones ?? []).filter((phone) => !phone.isCompanySwitchboard)
  const emailVerified = emails.some((email) => email.verificationStatus === "verified")
  const phoneVerified = phones.some(
    (phone) =>
      phone.verificationStatus === "verified" || phone.verificationStatus === "operator_verified",
  )
  const emailAvailable = emails.length > 0
  const phoneAvailable = phones.length > 0
  const profileAvailable = Boolean(trimOrNull(input.linkedinUrl))

  let state: AiOsContactChannelReadinessState = "no_usable_channel"
  let reason = "No usable contact channel."

  if (emailVerified && phoneVerified) {
    state = "email_and_phone_verified"
    reason = "Verified email and phone available."
  } else if (emailVerified) {
    state = "verified_email"
    reason = "Verified email available."
  } else if (phoneVerified && !emailAvailable) {
    state = "verified_phone"
    reason = "Verified phone only — call-oriented package may proceed."
  } else if (emailAvailable) {
    state = "email_available_unverified"
    reason = "Provider email available but not independently verified."
  } else if (phoneAvailable) {
    state = "phone_available_unverified"
    reason = "Provider phone available but not independently verified."
  } else if (profileAvailable) {
    state = "profile_only"
    reason = "Profile URL only — insufficient for drafting."
  }

  return {
    qaMarker: GROWTH_AIOS_CONTACT_1A_QA_MARKER,
    state,
    emailAvailable,
    emailVerified,
    phoneAvailable,
    phoneVerified,
    profileAvailable,
    primaryEmail: emails[0]?.normalized ?? null,
    primaryPhone: phones[0]?.normalized ?? null,
    unblocksEmailDrafting: emailAvailable,
    unblocksCallPackage: phoneAvailable,
    reason,
  }
}
