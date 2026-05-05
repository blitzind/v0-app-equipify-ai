import { NextRequest, NextResponse } from "next/server"
import {
  membershipOnlyArchivedOrgs,
  signOutAndRedirect,
  updateSession,
} from "@/lib/supabase/middleware"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

const PUBLIC_ROUTES = new Set(["/login", "/onboarding"])

const DASHBOARD_PREFIXES = [
  "/customers",
  "/equipment",
  "/work-orders",
  "/service-schedule",
  "/maintenance-plans",
  "/technicians",
  "/quotes",
  "/invoices",
  "/purchase-orders",
  "/integrations",
  "/insights",
  "/reports",
  "/settings",
]

function isProtectedRoute(pathname: string) {
  if (pathname === "/") return true
  if (pathname === "/test-maintenance-plan-create") return true
  if (pathname.startsWith("/portal")) return true
  if (pathname.startsWith("/admin")) return true
  return DASHBOARD_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function skipArchivedOrgGuard(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api")
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { response, user } = await updateSession(request)
  const isAuthenticated = Boolean(user)

  if (pathname.startsWith("/admin")) {
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
