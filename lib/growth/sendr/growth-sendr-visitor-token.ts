import { createHmac, timingSafeEqual } from "node:crypto"

export const GROWTH_SENDR_VISITOR_TOKEN_DEFAULT_EXPIRY_DAYS = 90 as const

export type SendrVisitorTokenPayload = {
  t: "sv"
  l: string
  p: string
  e?: number
}

function sendrVisitorTokenSecret(): string {
  return (
    process.env.GROWTH_SENDR_VISITOR_TOKEN_SECRET?.trim() ||
    process.env.GROWTH_TRACKING_TOKEN_SECRET?.trim() ||
    "growth_sendr_visitor_token_secret_dev_only"
  )
}

function encodePayload(payload: SendrVisitorTokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

function decodePayload(body: string): SendrVisitorTokenPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SendrVisitorTokenPayload
    if (!parsed || typeof parsed !== "object") return null
    if (parsed.t !== "sv") return null
    if (typeof parsed.l !== "string" || !parsed.l.trim()) return null
    if (typeof parsed.p !== "string" || !parsed.p.trim()) return null
    if (parsed.e !== undefined && typeof parsed.e !== "number") return null
    return parsed
  } catch {
    return null
  }
}

export function signSendrVisitorToken(payload: SendrVisitorTokenPayload): string {
  const body = encodePayload(payload)
  const sig = createHmac("sha256", sendrVisitorTokenSecret()).update(body).digest("base64url").slice(0, 24)
  return `${body}.${sig}`
}

export function verifySendrVisitorToken(
  token: string,
  expectedLandingPageId: string,
  now: Date = new Date(),
): { leadId: string; landingPageId: string } | null {
  const result = verifySendrVisitorTokenResult(token, expectedLandingPageId, now)
  return result.ok ? { leadId: result.leadId, landingPageId: result.landingPageId } : null
}

export type SendrVisitorTokenVerifyResult =
  | { ok: true; leadId: string; landingPageId: string }
  | { ok: false; reason: "invalid_token" | "expired_token" | "page_mismatch" }

export function verifySendrVisitorTokenResult(
  token: string,
  expectedLandingPageId: string,
  now: Date = new Date(),
): SendrVisitorTokenVerifyResult {
  const trimmed = token.trim()
  const dot = trimmed.lastIndexOf(".")
  if (dot <= 0) return { ok: false, reason: "invalid_token" }

  const body = trimmed.slice(0, dot)
  const sig = trimmed.slice(dot + 1)
  const expectedSig = createHmac("sha256", sendrVisitorTokenSecret()).update(body).digest("base64url").slice(0, 24)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: "invalid_token" }
  }

  const payload = decodePayload(body)
  if (!payload) return { ok: false, reason: "invalid_token" }
  if (payload.p !== expectedLandingPageId) return { ok: false, reason: "page_mismatch" }
  if (payload.e !== undefined && payload.e <= now.getTime()) return { ok: false, reason: "expired_token" }

  return { leadId: payload.l, landingPageId: payload.p, ok: true }
}

export function createSendrVisitorAccessToken(input: {
  leadId: string
  landingPageId: string
  expiresAt?: Date
}): string {
  const payload: SendrVisitorTokenPayload = {
    t: "sv",
    l: input.leadId,
    p: input.landingPageId,
  }
  if (input.expiresAt) {
    payload.e = input.expiresAt.getTime()
  }
  return signSendrVisitorToken(payload)
}

export function isSendrVisitorTokenFormatValid(rawToken: string): boolean {
  const normalized = rawToken.trim()
  if (normalized.length < 24 || normalized.length > 512) return false
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(normalized)
}
