import { NextRequest, NextResponse } from "next/server"
import {
  membershipOnlyArchivedOrgs,
  signOutAndRedirect,
  updateSession,
} from "@/lib/supabase/middleware"
import {
  isPlatformAdminEmail,
  logPlatformAdminDevDiagnostics,
} from "@/lib/platform-admin-policy"
import { portalAuthGate } from "@/lib/portal/middleware-gate"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"

const PUBLIC_ROUTES = new Set(["/login", "/onboarding"])

/** Public booking pages + APIs — no auth required (`/book/*`, `/api/book/*`). */

const DASHBOARD_PREFIXES = [
  "/customers",
  "/communications",
  "/equipment",
  "/inventory",
  "/work-orders",
  "/service-schedule",
  "/maintenance-plans",
  "/technicians",
  "/quotes",
  "/invoices",
  "/purchase-orders",
  "/integrations",
  "/insights",
  "/ai-assistants",
  "/reports",
  "/settings",
]

function isProtectedRoute(pathname: string) {
  if (pathname.startsWith("/portal")) return false
  if (pathname.startsWith("/book")) return false
  if (pathname.startsWith("/api/book")) return false
  if (pathname === "/") return true
  if (pathname === "/test-maintenance-plan-create") return true
  if (pathname.startsWith("/admin")) return true
  if (pathname === GROWTH_WORKSPACE_BASE_PATH || pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/`)) {
    return true
  }
  return DASHBOARD_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function skipArchivedOrgGuard(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin") ||
    pathname === GROWTH_WORKSPACE_BASE_PATH ||
    pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/`) ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/portal")
  )
}

function shouldSkipSupabaseSessionRefresh(pathname: string): boolean {
  // Provider ingress only (Twilio webhooks, inbound TwiML, media websocket) — no operator session.
  return pathname.startsWith("/api/voice/")
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (shouldSkipSupabaseSessionRefresh(pathname)) {
    return NextResponse.next()
  }

  const portalRedirect = await portalAuthGate(request)
  if (portalRedirect) return portalRedirect

  const { response, user } = await updateSession(request)
  const isAuthenticated = Boolean(user)

  if (pathname.startsWith("/admin")) {
    logPlatformAdminDevDiagnostics("middleware:/admin gate", user?.email ?? undefined)
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    if (!isPlatformAdminEmail(user.email)) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return response
  }

  if (pathname === GROWTH_WORKSPACE_BASE_PATH || pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/`)) {
    logPlatformAdminDevDiagnostics("middleware:/growth gate", user?.email ?? undefined)
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    if (!isPlatformAdminEmail(user.email)) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return response
  }

  if (pathname === "/login" && isAuthenticated) {
    if (await membershipOnlyArchivedOrgs(request, user.id)) {
      return signOutAndRedirect(request, "/login?error=archived")
    }
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (isProtectedRoute(pathname) && !PUBLIC_ROUTES.has(pathname) && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (
    isAuthenticated &&
    !skipArchivedOrgGuard(pathname) &&
    isProtectedRoute(pathname) &&
    !PUBLIC_ROUTES.has(pathname) &&
    !isPlatformAdminEmail(user.email ?? undefined)
  ) {
    if (await membershipOnlyArchivedOrgs(request, user.id)) {
      return signOutAndRedirect(request, "/login?error=archived")
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)",
  ],
}
