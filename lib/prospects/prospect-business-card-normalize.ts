import type { ProspectBusinessCardScanFields } from "@/lib/prospects/prospect-business-card-scan-schema"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clip(value: string | null | undefined, max: number): string | null {
  const trimmed = (value ?? "").trim()
  if (!trimmed) return null
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trimEnd()
}

function normalizeWebsite(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (!url.hostname) return null
    return url.href
  } catch {
    return null
  }
}

/** Formats US 10-digit numbers like demo seed data: (408) 555-0100 */
export function normalizeProspectPhone(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return null

  const digits = trimmed.replace(/\D/g, "")
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const local = digits.slice(1)
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
  }

  return clip(trimmed, 60)
}

export function normalizeProspectEmail(raw: string | null | undefined): string | null | "invalid" {
  const trimmed = (raw ?? "").trim().toLowerCase()
  if (!trimmed) return null
  if (!EMAIL_PATTERN.test(trimmed)) return "invalid"
  return trimmed.slice(0, 320)
}

export function normalizeProspectBusinessCardFields(
  parsed: Record<string, string | number | null | undefined>,
): ProspectBusinessCardScanFields {
  const websiteRaw = clip(typeof parsed.website === "string" ? parsed.website : null, 2000)
  let website: string | null = null
  if (websiteRaw) {
    website = normalizeWebsite(websiteRaw)
  }

  const emailResult = normalizeProspectEmail(
    typeof parsed.contact_email === "string" ? parsed.contact_email : null,
  )

  return {
    company_name: clip(typeof parsed.company_name === "string" ? parsed.company_name : null, 500),
    contact_name: clip(typeof parsed.contact_name === "string" ? parsed.contact_name : null, 500),
    contact_email: emailResult === "invalid" ? null : emailResult,
    contact_phone: normalizeProspectPhone(
      typeof parsed.contact_phone === "string" ? parsed.contact_phone : null,
    ),
    website,
    address_line1: clip(typeof parsed.address_line1 === "string" ? parsed.address_line1 : null, 500),
    address_line2: clip(typeof parsed.address_line2 === "string" ? parsed.address_line2 : null, 500),
    city: clip(typeof parsed.city === "string" ? parsed.city : null, 200),
    state: clip(typeof parsed.state === "string" ? parsed.state : null, 120),
    postal_code: clip(typeof parsed.postal_code === "string" ? parsed.postal_code : null, 40),
    country: clip(typeof parsed.country === "string" ? parsed.country : null, 120),
    notes: clip(typeof parsed.notes === "string" ? parsed.notes : null, 4000),
    confidence:
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.min(1, Math.max(0, parsed.confidence))
        : null,
  }
}

export function hasExtractedBusinessCardText(fields: ProspectBusinessCardScanFields): boolean {
  return Boolean(
    fields.company_name ||
      fields.contact_name ||
      fields.contact_email ||
      fields.contact_phone ||
      fields.website ||
      fields.address_line1 ||
      fields.address_line2 ||
      fields.city ||
      fields.state ||
      fields.postal_code ||
      fields.country ||
      fields.notes,
  )
}
