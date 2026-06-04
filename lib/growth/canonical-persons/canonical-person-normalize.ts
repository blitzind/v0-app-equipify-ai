/** Deterministic normalization for canonical person identity (Phase 7.2B). */

import { normalizeEmail, normalizeLinkedIn, normalizePhone } from "@/lib/growth/import/normalize"

export function canonicalNormalizedPersonName(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s.-]/g, "")
}

export function canonicalNormalizedPersonEmail(email: string | null | undefined): string | null {
  return normalizeEmail(email)
}

export function canonicalNormalizedPersonPhone(phone: string | null | undefined): string | null {
  return normalizePhone(phone)
}

export function canonicalNormalizedPersonLinkedIn(url: string | null | undefined): string | null {
  const slug = normalizeLinkedIn(url)
  if (slug) return `linkedin:in:${slug}`
  const trimmed = (url ?? "").trim().toLowerCase()
  if (!trimmed || !trimmed.includes("linkedin.com")) return null
  const path = trimmed.split("?")[0]?.replace(/\/$/, "") ?? ""
  return path ? `linkedin:url:${path}` : null
}

export function canonicalNameCompanyKey(
  companyId: string | null | undefined,
  name: string | null | undefined,
): string | null {
  const company = (companyId ?? "").trim()
  const normalized = canonicalNormalizedPersonName(name)
  if (!company || !normalized) return null
  return `${company}|${normalized}`
}

export function canonicalDisplayPersonName(input: {
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
}): string {
  const full = (input.full_name ?? "").trim().replace(/\s+/g, " ")
  if (full) return full.slice(0, 200)
  const combined = [input.first_name, input.last_name]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" ")
  return combined.slice(0, 200) || "Unknown"
}

export function splitPersonName(fullName: string | null | undefined): {
  first_name: string | null
  last_name: string | null
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: null, last_name: null }
  if (parts.length === 1) return { first_name: parts[0] ?? null, last_name: null }
  return {
    first_name: parts[0] ?? null,
    last_name: parts.slice(1).join(" ") || null,
  }
}
