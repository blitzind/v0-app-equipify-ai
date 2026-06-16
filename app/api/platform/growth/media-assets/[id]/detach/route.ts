import { NextResponse } from "next/server"
import { z } from "zod"
import { detachMediaAsset, getMediaAsset } from "@/lib/growth/media/media-asset-repository"
import {
  assertMediaAssetOrgScope,
  requireMediaAssetPlatformAccess,
} from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaAssetError } from "@/lib/growth/media/media-asset-route-utils"
import {
  GROWTH_MEDIA_ASSET_RELATIONSHIP_TYPES,
  GROWTH_MEDIA_ASSETS_QA_MARKER,
} from "@/lib/growth/media/media-asset-types"

export const runtime = "nodejs"

const DetachSchema = z.object({
  relationship_type: z.enum(GROWTH_MEDIA_ASSET_RELATIONSHIP_TYPES),
  relationship_id: z.string().uuid(),
})

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = DetachSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const existing = await getMediaAsset(access.admin, id)
    if (!existing) {
      return NextResponse.json({ ok: false, error: "asset_not_found" }, { status: 404 })
    }
    const scopeError = assertMediaAssetOrgScope(existing, access.organizationId)
    if (scopeError) return scopeError

    await detachMediaAsset(access.admin, {
      organizationId: access.organizationId,
      assetId: id,
      relationshipType: parsed.data.relationship_type,
      relationshipId: parsed.data.relationship_id,
    })
    return NextResponse.json({
      ok: true,
      detached: true,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
    })
  } catch (error) {
    return mapMediaAssetError(error)
  }
}
