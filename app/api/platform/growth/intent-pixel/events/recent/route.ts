import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchIntentPixelRecentEvents } from "@/lib/growth/intent-pixel/intent-pixel-admin-repository"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const siteKey = url.searchParams.get("site_key")?.trim() || "equipify-sandbox"
  const limitRaw = Number(url.searchParams.get("limit") ?? "40")
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.round(limitRaw))) : 40

  const stream = await fetchIntentPixelRecentEvents(access.admin, siteKey, limit)
  return NextResponse.json({ ok: true, stream })
}
