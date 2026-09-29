import "server-only"

import { getPublicAppOrigin } from "@/lib/email/config"
import { PORTAL_DASHBOARD_PATH } from "@/lib/portal/constants"
import { sanitizePortalNext } from "@/lib/portal/safe-portal-next"

/**
 * Trusted public origin + `/portal/login?token=` (+ optional safe `next`).
 * Always use URLSearchParams — never concatenate query strings by hand.
 * Never log `rawToken`.
 */
export function buildPortalAccessLoginUrl(args: {
  rawToken: string
  next?: string | null
  origin?: string
}): string {
  const origin = (args.origin ?? getPublicAppOrigin()).replace(/\/+$/, "")
  const url = new URL("/portal/login", `${origin}/`)
  url.searchParams.set("token", args.rawToken)
  url.searchParams.set("next", sanitizePortalNext(args.next) ?? PORTAL_DASHBOARD_PATH)
  return url.toString()
}
