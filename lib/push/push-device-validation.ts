/** Shared validation for Expo push tokens (safe to import from tests). */

const EXPO_PUSH_TOKEN_RE = /^(Exponent|Expo)PushToken\[[\w-]+\]$/i

export type PushDevicePlatform = "ios" | "android" | "unknown"

export function normalizePushDevicePlatform(value: string | null | undefined): PushDevicePlatform {
  const v = value?.trim().toLowerCase()
  if (v === "ios") return "ios"
  if (v === "android") return "android"
  return "unknown"
}

export function isValidExpoPushToken(token: string | null | undefined): boolean {
  if (!token) return false
  const trimmed = token.trim()
  if (trimmed.length < 20 || trimmed.length > 200) return false
  return EXPO_PUSH_TOKEN_RE.test(trimmed)
}
