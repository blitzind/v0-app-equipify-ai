import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { resolveGrowthMediaLibraryContentRedirect } from "@/lib/growth/media-library/growth-media-library-service"
import { GROWTH_MEDIA_LIBRARY_QA_MARKER } from "@/lib/growth/media-library/growth-media-library-types"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "organization_id_required" }, { status: 503 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 })
  }

  try {
    const redirect = await resolveGrowthMediaLibraryContentRedirect(admin, {
      organizationId,
      assetId: id,
    })
    if (!redirect) {
      return NextResponse.json({ ok: false, error: "asset_not_found" }, { status: 404 })
    }

    const headers = new Headers()
    if (redirect.mimeType) headers.set("Content-Type", redirect.mimeType)
    headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
    headers.set("X-Growth-Media-Library-QA", GROWTH_MEDIA_LIBRARY_QA_MARKER)

    return NextResponse.redirect(redirect.url, { status: 302, headers })
  } catch (error) {
    const message = error instanceof Error ? error.message : "content_redirect_failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
