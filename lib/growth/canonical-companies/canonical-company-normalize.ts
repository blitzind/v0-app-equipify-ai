/** Deterministic normalization for canonical company identity (Phase 7.2A). */

import { normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import { normalizeCompanyName, normalizeWebsiteDomain } from "@/lib/growth/import/normalize"

export function canonicalNormalizedDomain(
  domain: string | null | undefined,
  website: string | null | undefined,
): string | null {
  return normalizeDomain(domain) ?? normalizeWebsiteDomain(website)
}

export function canonicalExactDomain(domain: string | null | undefined): string | null {
  const normalized = normalizeDomain(domain)
  if (normalized) return normalized
  const raw = (domain ?? "").trim().toLowerCase()
  return raw || null
}

export function canonicalNormalizedCompanyName(name: string | null | undefined): string | null {
  return normalizeCompanyName(name)
}

export function canonicalNameCityKey(
  name: string | null | undefined,
  city: string | null | undefined,
): string | null {
  const n = canonicalNormalizedCompanyName(name)
  const c = (city ?? "").trim().toLowerCase()
  if (!n || !c) return null
  return `${n}|${c}`
}

export function canonicalNameStateKey(
  name: string | null | undefined,
  state: string | null | undefined,
): string | null {
  const n = canonicalNormalizedCompanyName(name)
  const s = (state ?? "").trim().toLowerCase()
  if (!n || !s) return null
  return `${n}|${s}`
}

export function canonicalDisplayName(name: string | null | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ").slice(0, 200) || "Unknown"
}
