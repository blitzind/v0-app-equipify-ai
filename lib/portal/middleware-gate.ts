import { NextRequest, NextResponse } from "next/server"
import { PORTAL_SESSION_COOKIE } from "@/lib/portal/constants"
import { getPortalSessionSecret } from "@/lib/portal/env"
import { verifyPortalToken } from "@/lib/portal/session-token"

/**
 * Next.js middleware hook: non-login `/portal/*` routes require a valid signed portal cookie.
 * Returns a redirect response when unauthenticated; otherwise undefined (caller continues pipeline).
 */
export async function portalAuthGate(request: NextRequest): Promise<NextResponse | undefined> {
  const pathname = request.nextUrl.pathname
  if (!pathname.startsWith("/portal")) return undefined
  if (pathname === "/portal/login") return undefined
  /** Staff preview uses dashboard auth in the route handler — never the customer portal cookie. */
  if (pathname === "/portal/preview" || pathname.startsWith("/portal/preview/")) return undefined

  const secret = getPortalSessionSecret()
  if (!secret) {
    const login = new URL("/portal/login", request.url)
    login.searchParams.set("error", "misconfigured")
    return NextResponse.redirect(login)
  }

  const raw = request.cookies.get(PORTAL_SESSION_COOKIE)?.value
  if (!raw) {
    const login = new URL("/portal/login", request.url)
    login.searchParams.set("next", pathname + request.nextUrl.search)
    return NextResponse.redirect(login)
  }

  const session = await verifyPortalToken(raw, secret)
  if (!session) {
    const login = new URL("/portal/login", request.url)
    login.searchParams.set("next", pathname + request.nextUrl.search)
    const res = NextResponse.redirect(login)
    res.cookies.delete(PORTAL_SESSION_COOKIE)
    return res
  }

  return undefined
}
