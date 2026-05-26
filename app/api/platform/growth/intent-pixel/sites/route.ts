import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createIntentPixelSite,
  listIntentPixelSites,
} from "@/lib/growth/intent-pixel/intent-pixel-admin-repository"
import { GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER } from "@/lib/growth/intent-pixel/intent-pixel-admin-types"
import {
  GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION,
  isGrowthIntentPixelSchemaReady,
} from "@/lib/growth/intent-pixel/intent-pixel-schema-health"
import {
  isValidIntentPixelSiteKey,
  normalizeDomainAllowlist,
  parseTrackingModeInput,
} from "@/lib/growth/intent-pixel/intent-pixel-site-config"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const origin = new URL(request.url).origin
  const schema_ready = await isGrowthIntentPixelSchemaReady(access.admin)
  const sites = schema_ready ? await listIntentPixelSites(access.admin, origin) : []
  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER,
    schema_ready,
    schema_migration: GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION,
    sites,
  })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const site_key = typeof body.site_key === "string" ? body.site_key.trim().toLowerCase() : ""
  const site_name = typeof body.site_name === "string" ? body.site_name.trim() : ""
  const tracking_mode = parseTrackingModeInput(body.tracking_mode) ?? "consent_gated"
  const domain_allowlist = Array.isArray(body.domain_allowlist)
    ? body.domain_allowlist.filter((e): e is string => typeof e === "string")
    : []

  if (!(await isGrowthIntentPixelSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        error: "schema_missing",
        message: `Apply migration ${GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION} before creating sites.`,
        schema_migration: GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION,
      },
      { status: 503 },
    )
  }

  if (!isValidIntentPixelSiteKey(site_key)) {
    return NextResponse.json(
      { ok: false, error: "invalid_site_key", message: "Invalid site_key." },
      { status: 400 },
    )
  }

  try {
    const origin = new URL(request.url).origin
    const site = await createIntentPixelSite(access.admin, origin, {
      site_key,
      site_name: site_name || site_key,
      domain_allowlist: normalizeDomainAllowlist(domain_allowlist),
      tracking_mode,
    })
    return NextResponse.json({ ok: true, site })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message.includes("duplicate") || message.includes("unique") ? 409 : 500
    return NextResponse.json({ ok: false, error: "create_failed", message }, { status })
  }
}
