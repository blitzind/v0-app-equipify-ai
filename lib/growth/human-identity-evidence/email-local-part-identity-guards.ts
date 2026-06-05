/** Phase 7.PS-IN — Reject false-positive email local-part identity names. Client-safe. */

import { isPlausiblePersonName } from "@/lib/growth/contact-discovery/extract/extract-shared"

export const ROLE_LOCAL_PART_IDENTITY_NAMES = new Set([
  "info",
  "contact",
  "sales",
  "support",
  "hello",
  "admin",
  "office",
  "service",
  "dispatch",
  "billing",
  "hr",
  "careers",
  "help",
  "team",
  "noreply",
  "no-reply",
  "orders",
  "custserv",
  "cs",
  "customerservice",
  "asap",
])

const COMPANY_FRAGMENT_NAME_TOKENS =
  /\b(medical|biomedical|technologies|technology|technicians|services|service|equipment|supply|solutions|vanguard|repair|biomed)\b/i

export function isRoleLocalPartIdentityName(full_name: string, email?: string | null): boolean {
  const name = full_name.trim().toLowerCase()
  if (!name) return false
  if (ROLE_LOCAL_PART_IDENTITY_NAMES.has(name)) return true

  const local = email?.split("@")[0]?.trim().toLowerCase() ?? ""
  if (local && local === name && ROLE_LOCAL_PART_IDENTITY_NAMES.has(local)) return true
  if (/^(info|contact|sales|support|service|admin|office|help|team|orders|custserv|asap)/i.test(name)) {
    return true
  }
  return false
}

export function isCompanyNameLocalPartIdentity(full_name: string, email?: string | null): boolean {
  const normalizedName = full_name.replace(/\s+/g, "").toLowerCase()
  const local = email?.split("@")[0]?.trim().toLowerCase() ?? ""
  if (!normalizedName || !local) return false
  if (normalizedName !== local) return false
  if (COMPANY_FRAGMENT_NAME_TOKENS.test(full_name) && !isPlausiblePersonName(full_name)) return true
  if (local.length >= 10 && !isPlausiblePersonName(full_name)) return true
  return false
}

export function isFalsePositiveEmailLocalPartIdentity(
  full_name: string,
  email?: string | null,
): boolean {
  return (
    isRoleLocalPartIdentityName(full_name, email) ||
    isCompanyNameLocalPartIdentity(full_name, email)
  )
}

export function shouldRejectEmailLocalPartNamingUpgrade(
  full_name: string,
  email?: string | null,
): boolean {
  return isFalsePositiveEmailLocalPartIdentity(full_name, email)
}

/** Capitalized single-token name whose email local part matches (legitimate PS-IK pattern). */
export function emailLocalPartMatchesCapitalizedSingleTokenName(
  full_name: string,
  email?: string | null,
): boolean {
  const name = full_name.trim()
  const local = email?.split("@")[0]?.trim().toLowerCase() ?? ""
  if (!name || !local) return false
  if (!/^[A-Z][a-z]{2,}$/.test(name)) return false
  return local === name.toLowerCase()
}

export function isLegitimateEmailLocalPartPersonIdentity(
  full_name: string,
  email?: string | null,
): boolean {
  if (isFalsePositiveEmailLocalPartIdentity(full_name, email)) return false
  if (isPlausiblePersonName(full_name)) return true
  return emailLocalPartMatchesCapitalizedSingleTokenName(full_name, email)
}
