import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchIntentPixelAdminDiagnostics } from "@/lib/growth/intent-pixel/intent-pixel-admin-repository"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const siteKey = url.searchParams.get("site_key")?.trim() || "equipify-sandbox"

  const diagnostics = await fetchIntentPixelAdminDiagnostics(access.admin, siteKey)
  return NextResponse.json({ ok: true, diagnostics })
}
