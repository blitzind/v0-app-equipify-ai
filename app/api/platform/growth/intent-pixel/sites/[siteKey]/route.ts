import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { updateIntentPixelSite } from "@/lib/growth/intent-pixel/intent-pixel-admin-repository"
import {
  normalizeDomainAllowlist,
  parseTrackingModeInput,
} from "@/lib/growth/intent-pixel/intent-pixel-site-config"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ siteKey: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { siteKey: rawKey } = await context.params
  const siteKey = decodeURIComponent(String(rawKey ?? "").trim())
  if (!siteKey) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Site not found." }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const patch: {
    site_name?: string
    domain_allowlist?: string[]
    tracking_mode?: ReturnType<typeof parseTrackingModeInput>
  } = {}

  if (typeof body.site_name === "string") patch.site_name = body.site_name.trim()
  if (Array.isArray(body.domain_allowlist)) {
    patch.domain_allowlist = normalizeDomainAllowlist(
      body.domain_allowlist.filter((e): e is string => typeof e === "string"),
    )
  }
  const tracking_mode = parseTrackingModeInput(body.tracking_mode)
  if (tracking_mode) patch.tracking_mode = tracking_mode

  try {
    const origin = new URL(request.url).origin
    const site = await updateIntentPixelSite(access.admin, origin, siteKey, patch)
    if (!site) {
      return NextResponse.json({ ok: false, error: "not_found", message: "Site not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, site })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "update_failed", message }, { status: 500 })
  }
}
