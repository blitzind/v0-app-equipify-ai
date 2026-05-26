import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchIntentPixelAdminDiagnostics } from "@/lib/growth/intent-pixel/intent-pixel-admin-repository"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const siteKey = url.searchParams.get("site_key")?.trim() || "equipify-sandbox"

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "unavailable", message: "Diagnostics unavailable." },
      { status: 503 },
    )
  }

  const diagnostics = await fetchIntentPixelAdminDiagnostics(admin, siteKey)
  return NextResponse.json({ ok: true, diagnostics })
}
