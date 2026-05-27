import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

export type TrackingTokenKind = "open" | "click"

export type TrackingOpenTokenPayload = {
  t: "open"
  a: string
}

export type TrackingClickTokenPayload = {
  t: "click"
  a: string
  u: string
  k: string
}

export type TrackingTokenPayload = TrackingOpenTokenPayload | TrackingClickTokenPayload

function trackingTokenSecret(): string {
  return process.env.GROWTH_TRACKING_TOKEN_SECRET?.trim() || "growth_tracking_token_secret_dev_only"
}

function encodePayload(payload: TrackingTokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

function decodePayload(body: string): TrackingTokenPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TrackingTokenPayload
    if (!parsed || typeof parsed !== "object") return null
    if (parsed.t === "open" && typeof parsed.a === "string") return parsed
    if (parsed.t === "click" && typeof parsed.a === "string" && typeof parsed.u === "string" && typeof parsed.k === "string") {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function signTrackingToken(payload: TrackingTokenPayload): string {
  const body = encodePayload(payload)
  const sig = createHmac("sha256", trackingTokenSecret()).update(body).digest("base64url").slice(0, 24)
  return `${body}.${sig}`
}

export function verifyTrackingToken(token: string): TrackingTokenPayload | null {
  const trimmed = token.trim()
  const dot = trimmed.lastIndexOf(".")
  if (dot <= 0) return null
  const body = trimmed.slice(0, dot)
  const sig = trimmed.slice(dot + 1)
  const expected = createHmac("sha256", trackingTokenSecret()).update(body).digest("base64url").slice(0, 24)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
  return decodePayload(body)
}

export function createOpenTrackingToken(deliveryAttemptId: string): string {
  return signTrackingToken({ t: "open", a: deliveryAttemptId })
}

export function createClickTrackingToken(deliveryAttemptId: string, destinationUrl: string): string {
  const key = createHash("sha256").update(destinationUrl).digest("hex").slice(0, 16)
  return signTrackingToken({ t: "click", a: deliveryAttemptId, u: destinationUrl, k: key })
}

export function generateOpaqueTrackingToken(): string {
  return randomBytes(18).toString("base64url")
}

export function hashTrackingIp(ip: string | null | undefined): string | null {
  const normalized = ip?.trim()
  if (!normalized) return null
  const pepper = process.env.GROWTH_TRACKING_IP_PEPPER?.trim() || "growth_tracking_ip_pepper_dev_only"
  return createHash("sha256").update(pepper).update("|growth-tracking-ip|").update(normalized).digest("hex").slice(0, 32)
}

export function inferDeviceType(userAgent: string | null | undefined): string | null {
  if (!userAgent?.trim()) return null
  const ua = userAgent.toLowerCase()
  if (/ipad|tablet|kindle|playbook/.test(ua)) return "tablet"
  if (/mobile|iphone|ipod|android|blackberry|windows phone/.test(ua)) return "mobile"
  return "desktop"
}

export function resolveTrackingBaseUrl(): string {
  const configured =
    process.env.GROWTH_TRACKING_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim()
  return (configured ?? "https://app.equipify.ai").replace(/\/+$/, "")
}

export function buildOpenTrackingUrl(token: string, baseUrl = resolveTrackingBaseUrl()): string {
  return `${baseUrl}/api/growth/track/open/${encodeURIComponent(token)}`
}

export function buildClickTrackingUrl(token: string, baseUrl = resolveTrackingBaseUrl()): string {
  return `${baseUrl}/api/growth/track/click/${encodeURIComponent(token)}`
}
