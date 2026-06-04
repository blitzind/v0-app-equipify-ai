/** Deterministic work-email pattern generation (candidates only — not valid until verified). */

import { canonicalNormalizedPersonEmail } from "@/lib/growth/canonical-persons/canonical-person-normalize"

function slugPart(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

export function generateWorkEmailPatterns(input: {
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  domain: string
}): string[] {
  const domain = input.domain.trim().toLowerCase().replace(/^www\./, "")
  if (!domain || !domain.includes(".")) return []

  let first = slugPart(input.first_name)
  let last = slugPart(input.last_name)
  if (!first || !last) {
    const parts = (input.full_name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    if (!first && parts[0]) first = slugPart(parts[0])
    if (!last && parts.length > 1) last = slugPart(parts[parts.length - 1])
  }
  if (!first || !last) return []

  const fi = first[0] ?? ""
  const li = last[0] ?? ""
  const patterns = [
    `${first}@${domain}`,
    `${first}.${last}@${domain}`,
    `${first}${last}@${domain}`,
    `${fi}${last}@${domain}`,
    `${fi}.${last}@${domain}`,
    `${first}.${li}@${domain}`,
    `${last}@${domain}`,
  ]

  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of patterns) {
    const normalized = canonicalNormalizedPersonEmail(raw)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(raw.trim().toLowerCase())
  }
  return out
}
