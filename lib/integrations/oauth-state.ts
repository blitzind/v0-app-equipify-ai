import { createHmac, timingSafeEqual } from "crypto"

export type QuickBooksOAuthStatePayload = {
  organizationId: string
  userId: string
  ts: number
}

function getSecret(): string | null {
  const s = process.env.INTEGRATION_OAUTH_STATE_SECRET?.trim()
  return s && s.length >= 16 ? s : null
}

/** Signed compact state for OAuth round-trip (HMAC over base64url JSON). */
export function signOAuthState(payload: QuickBooksOAuthStatePayload): string | null {
  const secret = getSecret()
  if (!secret) return null
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${sig}`
}

export function verifyOAuthState(
  token: string,
  maxAgeMs: number,
): QuickBooksOAuthStatePayload | null {
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
  let parsed: QuickBooksOAuthStatePayload
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as QuickBooksOAuthStatePayload
  } catch {
    return null
  }
  if (!parsed.organizationId || !parsed.userId || typeof parsed.ts !== "number") return null
  if (Date.now() - parsed.ts > maxAgeMs) return null
  return parsed
}
