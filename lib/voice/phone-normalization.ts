/** E.164-ish normalization for deterministic voice records. */

const DIGITS_ONLY = /[^\d+]/g

export function normalizePhoneNumber(input: string | null | undefined): string {
  if (!input) return ""
  const trimmed = input.trim()
  if (!trimmed) return ""
  const digits = trimmed.replace(DIGITS_ONLY, "")
  if (!digits) return ""
  if (digits.startsWith("+")) return `+${digits.slice(1).replace(/\D/g, "")}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return `+${digits.replace(/\D/g, "")}`
}

export function phoneNumbersEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhoneNumber(a)
  const nb = normalizePhoneNumber(b)
  if (!na || !nb) return false
  return na === nb
}
