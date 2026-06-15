/** Growth Engine SR-2B-1 — Share page token format validation (client-safe). */

import { isSharePageTokenFormatValid } from "@/lib/growth/share-pages/share-page-token"

export function validateSharePageRouteToken(rawToken: string | null | undefined): {
  ok: boolean
  token: string | null
  error: string | null
} {
  const token = typeof rawToken === "string" ? rawToken.trim() : ""
  if (!token) return { ok: false, token: null, error: "token_required" }
  if (!isSharePageTokenFormatValid(token)) {
    return { ok: false, token: null, error: "token_format_invalid" }
  }
  return { ok: true, token, error: null }
}

export function isSharePagePublicRouteTokenValid(rawToken: string | undefined): boolean {
  return validateSharePageRouteToken(rawToken).ok
}
