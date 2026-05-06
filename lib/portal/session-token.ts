/**
 * Edge-compatible signed portal session tokens (Web Crypto only — safe for middleware).
 */

export type PortalTokenPayload = {
  v: 1
  pu: string
  org: string
  cust: string
  exp: number
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ""
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlToBytes(s: string): Uint8Array | null {
  try {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4))
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let x = 0
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i)! ^ b.charCodeAt(i)!
  return x === 0
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))
  return bufferToBase64Url(sig)
}

export async function signPortalToken(payload: PortalTokenPayload, secret: string): Promise<string> {
  const json = JSON.stringify(payload)
  const sig = await hmacSha256Base64Url(secret, json)
  const payloadPart = bufferToBase64Url(new TextEncoder().encode(json))
  return `${payloadPart}.${sig}`
}

export async function verifyPortalToken(
  token: string,
  secret: string,
): Promise<PortalTokenPayload | null> {
  const dot = token.indexOf(".")
  if (dot <= 0) return null
  const payloadPart = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const bytes = base64UrlToBytes(payloadPart)
  if (!bytes) return null
  const json = new TextDecoder().decode(bytes)
  const expectedSig = await hmacSha256Base64Url(secret, json)
  if (!timingSafeEqualStrings(expectedSig, sig)) return null
  try {
    const raw = JSON.parse(json) as Partial<PortalTokenPayload>
    if (raw.v !== 1 || typeof raw.pu !== "string" || typeof raw.org !== "string" || typeof raw.cust !== "string")
      return null
    if (typeof raw.exp !== "number" || !Number.isFinite(raw.exp)) return null
    if (raw.exp < Math.floor(Date.now() / 1000)) return null
    return { v: 1, pu: raw.pu, org: raw.org, cust: raw.cust, exp: raw.exp }
  } catch {
    return null
  }
}
