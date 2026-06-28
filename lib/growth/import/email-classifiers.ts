/** Shared email classification helpers for Growth recipient intelligence. Client-safe. */

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "yopmail.com",
  "throwaway.email",
])

export function isDisposableEmailDomain(domain: string | null | undefined): boolean {
  const normalized = domain?.trim().toLowerCase()
  if (!normalized) return false
  return DISPOSABLE_EMAIL_DOMAINS.has(normalized)
}

export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
])

export function isFreeEmailDomain(domain: string | null | undefined): boolean {
  const normalized = domain?.trim().toLowerCase()
  if (!normalized) return false
  return FREE_EMAIL_DOMAINS.has(normalized)
}

/** Verification / prospect-search role local-parts (not website channel taxonomy). */
const ROLE_EMAIL_LOCAL_PARTS = new Set([
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
])

export function isRoleEmailLocalPart(localPart: string | null | undefined): boolean {
  const normalized = localPart?.trim().toLowerCase()
  if (!normalized) return false
  return ROLE_EMAIL_LOCAL_PARTS.has(normalized)
}
