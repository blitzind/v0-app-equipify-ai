/** E.164 phone normalization for Growth SMS (Phase 5.1F). Client-safe. */

const E164_RE = /^\+[1-9]\d{6,14}$/

export function isValidE164(value: string): boolean {
  return E164_RE.test(value.trim())
}

export function normalizeToE164(input: string, defaultCountryCode = "1"): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (trimmed.startsWith("+")) {
    const digits = `+${trimmed.slice(1).replace(/\D/g, "")}`
    return isValidE164(digits) ? digits : null
  }

  const digitsOnly = trimmed.replace(/\D/g, "")
  if (digitsOnly.length === 10 && defaultCountryCode === "1") {
    const candidate = `+1${digitsOnly}`
    return isValidE164(candidate) ? candidate : null
  }

  if (digitsOnly.length >= 11) {
    const candidate = `+${digitsOnly}`
    return isValidE164(candidate) ? candidate : null
  }

  return null
}

export function phoneLookupKeys(e164: string): string[] {
  const normalized = normalizeToE164(e164)
  if (!normalized) return []

  const keys = [normalized]
  if (normalized.startsWith("+1") && normalized.length === 12) {
    const national = normalized.slice(2)
    keys.push(national, `1${national}`)
  }
  return [...new Set(keys)]
}
