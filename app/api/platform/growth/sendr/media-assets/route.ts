import { NextResponse } from "next/server"
import { z } from "zod"
import { GROWTH_SENDR_MEDIA_ASSET_TYPES, GROWTH_SENDR_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import { getGrowthSendrMediaAsset } from "@/lib/growth/sendr/growth-sendr-media-asset-repository"
import { registerSendrMediaAsset } from "@/lib/growth/sendr/growth-sendr-media-asset-service"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

const BodySchema = z.object({
  assetType: z.enum(GROWTH_SENDR_MEDIA_ASSET_TYPES),
  name: z.string().min(1).max(200),
  slug: z.string().max(120).optional(),
  metadata: z.record(z.unknown()).optional(),
  legacyMediaAssetId: z.string().uuid().optional(),
  legacySharePageId: z.string().uuid().optional(),
  legacyVideoAssetId: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  try {
    const asset = await registerSendrMediaAsset(access.admin, {
      organizationId: access.organizationId,
      ownerUserId: access.userId,
      ...parsed.data,
    })
    return NextResponse.json({ ok: true, asset, qa_marker: GROWTH_SENDR_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "media_asset_register_failed"
    const status = message.includes("budget") || message.includes("disabled") || message.includes("cap") ? 429 : 500
    return NextResponse.json({ ok: false, message }, { status })
  }
}

export async function GET(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const assetId = new URL(request.url).searchParams.get("assetId")
  if (!assetId) {
    return NextResponse.json({ ok: false, error: "asset_id_required" }, { status: 400 })
  }

  try {
    const asset = await getGrowthSendrMediaAsset(access.admin, assetId)
    if (!asset || asset.organizationId !== access.organizationId) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, asset, qa_marker: GROWTH_SENDR_QA_MARKER })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "media_asset_load_failed" },
      { status: 500 },
    )
  }
}
