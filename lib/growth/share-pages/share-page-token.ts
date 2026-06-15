import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export const GROWTH_SHARE_PAGE_DEFAULT_EXPIRY_DAYS = 90 as const

export type GrowthSharePageTokenBundle = {
  rawToken: string
  tokenHash: string
  tokenPrefix: string
}

function sharePageTokenPepper(): string {
  return (
    process.env.GROWTH_SHARE_PAGE_TOKEN_PEPPER?.trim() ||
    process.env.GROWTH_TRACKING_TOKEN_SECRET?.trim() ||
    "growth_share_page_token_pepper_dev_only"
  )
}

export function hashSharePageToken(rawToken: string): string {
  const normalized = rawToken.trim()
  return createHash("sha256")
    .update(sharePageTokenPepper())
    .update("|growth-share-page-token|")
    .update(normalized)
    .digest("hex")
}

export function extractSharePageTokenPrefix(rawToken: string): string {
  const normalized = rawToken.trim()
  return normalized.slice(0, 8)
}

export function generateSharePageOpaqueToken(): string {
  return randomBytes(24).toString("base64url")
}

export function generateSharePageTokenBundle(): GrowthSharePageTokenBundle {
  const rawToken = generateSharePageOpaqueToken()
  return {
    rawToken,
    tokenHash: hashSharePageToken(rawToken),
    tokenPrefix: extractSharePageTokenPrefix(rawToken),
  }
}

export function generateSharePagePreviewTokenBundle(): GrowthSharePageTokenBundle {
  const rawToken = `pv_${generateSharePageOpaqueToken()}`
  return {
    rawToken,
    tokenHash: hashSharePageToken(rawToken),
    tokenPrefix: extractSharePageTokenPrefix(rawToken),
  }
}

export function verifySharePageToken(rawToken: string, expectedHash: string): boolean {
  const normalized = rawToken.trim()
  const expected = expectedHash.trim()
  if (!normalized || !expected) return false

  const actualHash = hashSharePageToken(normalized)
  const actualBuf = Buffer.from(actualHash)
  const expectedBuf = Buffer.from(expected)
  if (actualBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(actualBuf, expectedBuf)
}

export function isSharePageTokenFormatValid(rawToken: string): boolean {
  const normalized = rawToken.trim()
  if (normalized.length < 16 || normalized.length > 128) return false
  return /^[A-Za-z0-9_-]+$/.test(normalized)
}

export function resolveSharePageExpirationIso(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt?.trim()) return false
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) return false
  return date.getTime() <= now.getTime()
}

export function buildDefaultSharePageExpirationIso(
  days: number = GROWTH_SHARE_PAGE_DEFAULT_EXPIRY_DAYS,
  now: Date = new Date(),
): string {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : GROWTH_SHARE_PAGE_DEFAULT_EXPIRY_DAYS
  const expires = new Date(now.getTime())
  expires.setUTCDate(expires.getUTCDate() + safeDays)
  return expires.toISOString()
}

function sharePageBaseUrl(baseUrl?: string): string {
  return (
    baseUrl?.trim() ||
    process.env.GROWTH_TRACKING_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "https://app.equipify.ai"
  ).replace(/\/+$/, "")
}

export function buildSharePagePublicUrl(rawToken: string, baseUrl?: string): string {
  return `${sharePageBaseUrl(baseUrl)}/p/${encodeURIComponent(rawToken.trim())}`
}

export function buildSharePagePreviewUrl(rawToken: string, baseUrl?: string): string {
  return `${sharePageBaseUrl(baseUrl)}/p-preview/${encodeURIComponent(rawToken.trim())}`
}
