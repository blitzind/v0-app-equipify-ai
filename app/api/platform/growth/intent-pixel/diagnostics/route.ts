import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchIntentPixelDiagnostics } from "@/lib/growth/intent-pixel/intent-pixel-repository"
import {
  GROWTH_INTENT_PIXEL_QA_MARKER,
  type GrowthIntentPixelDiagnostics,
} from "@/lib/growth/intent-pixel/intent-pixel-types"
import { GROWTH_INTENT_PIXEL_PRIVACY_NOTE } from "@/lib/growth/intent-pixel/pii-policy"
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

  const counts = await fetchIntentPixelDiagnostics(admin, siteKey)
  const diagnostics: GrowthIntentPixelDiagnostics = {
    qa_marker: GROWTH_INTENT_PIXEL_QA_MARKER,
    privacy_note: GROWTH_INTENT_PIXEL_PRIVACY_NOTE,
    ...counts,
  }

  return NextResponse.json({ ok: true, diagnostics })
}
