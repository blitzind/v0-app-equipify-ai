import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { staffMayOpenPortalPreview } from "@/lib/portal/preview-access"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function portalLoginUrl(request: NextRequest, extra: Record<string, string> = {}) {
  const u = new URL("/portal/login", request.url)
  for (const [k, v] of Object.entries(extra)) {
    u.searchParams.set(k, v)
  }
  return u
}

/**
 * Staff preview bridge (GET): verifies dashboard Supabase session + org membership,
 * then redirects to `/portal/preview` — a staff-authenticated preview that does **not**
 * mint a customer portal session cookie.
 *
 * Customers continue to use invite tokens and `/portal/login`; preview never bypasses that flow.
 */
export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? ""
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.redirect(
      portalLoginUrl(request, {
        next: "/portal/dashboard",
        notice: "invalid_preview",
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email?.trim()) {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", `/portal/preview?organizationId=${encodeURIComponent(organizationId)}`)
    return NextResponse.redirect(login)
  }

  const rawRole = await getOrganizationMemberRole(supabase, user.id, organizationId)
  if (!staffMayOpenPortalPreview(rawRole)) {
    return NextResponse.redirect(
      portalLoginUrl(request, {
        next: "/portal/dashboard",
        error: "preview_forbidden",
      }),
    )
  }

  const previewUrl = new URL("/portal/preview", request.url)
  previewUrl.searchParams.set("organizationId", organizationId)
  return NextResponse.redirect(previewUrl)
}
