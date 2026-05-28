/** Normalization helpers for contact identity resolution. Client-safe. */

export function normalizeContactIdentityName(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s.-]/g, "")
}

export function normalizeContactIdentityEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase()
  return trimmed && trimmed.includes("@") ? trimmed : null
}

export function normalizeContactIdentityPhone(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, "") ?? ""
  if (digits.length < 10) return null
  return digits.slice(-10)
}

export function normalizeContactIdentityLinkedIn(url: string | null | undefined): string | null {
  const trimmed = url?.trim().toLowerCase()
  if (!trimmed || !trimmed.includes("linkedin.com")) return null
  return trimmed.split("?")[0]?.replace(/\/$/, "") ?? null
}

export function normalizeContactIdentityTitle(title: string | null | undefined): string {
  return (title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

const TITLE_SYNONYMS: Record<string, string[]> = {
  owner: ["owner", "founder", "president", "ceo", "principal"],
  operations: ["operations", "ops", "operating", "general manager", "gm"],
  sales: ["sales", "business development", "bd", "account executive"],
  service: ["service", "field service", "technician", "dispatch"],
}

export function contactIdentityTitlesSimilar(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeContactIdentityTitle(left)
  const b = normalizeContactIdentityTitle(right)
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  for (const synonyms of Object.values(TITLE_SYNONYMS)) {
    const aHit = synonyms.some((term) => a.includes(term))
    const bHit = synonyms.some((term) => b.includes(term))
    if (aHit && bHit) return true
  }
  return false
}

export function isGenericRoleEmail(email: string | null | undefined): boolean {
  const normalized = normalizeContactIdentityEmail(email)
  if (!normalized) return false
  const local = normalized.split("@")[0] ?? ""
  return /^(info|contact|hello|office|admin|support|sales|service|help|team|careers|billing|dispatch)$/.test(
    local,
  )
}

export function buildContactIdentityAnchorKey(input: {
  company_id: string
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  full_name?: string | null
}): string {
  const email = normalizeContactIdentityEmail(input.email)
  if (email) return `${input.company_id}:email:${email}`
  const phone = normalizeContactIdentityPhone(input.phone)
  if (phone) return `${input.company_id}:phone:${phone}`
  const linkedin = normalizeContactIdentityLinkedIn(input.linkedin_url)
  if (linkedin) return `${input.company_id}:linkedin:${linkedin}`
  const name = normalizeContactIdentityName(input.full_name)
  return `${input.company_id}:name:${name || "unknown"}`
}
