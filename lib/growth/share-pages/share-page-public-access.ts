/** Growth Engine SR-2B-1 — Share page public access helpers (client-safe). */

import type { GrowthSharePagePublicAccessReason } from "@/lib/growth/share-pages/share-page-types"
import { validateSharePageRouteToken } from "@/lib/growth/share-pages/share-page-token-validation"

export function validateSharePagePublicRouteToken(
  rawToken: string | undefined,
): GrowthSharePagePublicAccessReason | "invalid_format" {
  const token = typeof rawToken === "string" ? rawToken.trim() : ""
  if (!token) return "not_found"
  const validated = validateSharePageRouteToken(token)
  if (!validated.ok) return "invalid_format"
  return "granted"
}
