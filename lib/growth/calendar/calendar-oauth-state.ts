import { createHmac, timingSafeEqual } from "crypto"

export type GrowthCalendarOAuthStatePayload = {
  userId: string
  returnTo: string
  ts: number
}

function getSecret(): string | null {
  const s = process.env.INTEGRATION_OAUTH_STATE_SECRET?.trim()
  return s && s.length >= 16 ? s : null
}

export function signGrowthCalendarOAuthState(payload: GrowthCalendarOAuthStatePayload): string | null {
  const secret = getSecret()
  if (!secret) return null
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${sig}`
}

export function verifyGrowthCalendarOAuthState(
  token: string,
  maxAgeMs: number,
): GrowthCalendarOAuthStatePayload | null {
  const secret = getSecret()
  if (!secret) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [body, sig] = parts
  if (!body || !sig) return null
  const expected = createHmac("sha256", secret).update(body).digest("base64url")
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  let parsed: GrowthCalendarOAuthStatePayload
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GrowthCalendarOAuthStatePayload
  } catch {
    return null
  }
  if (!parsed.userId || typeof parsed.ts !== "number") return null
  if (Date.now() - parsed.ts > maxAgeMs) return null
  if (!parsed.returnTo.startsWith("/admin/growth")) return null
  return parsed
}
