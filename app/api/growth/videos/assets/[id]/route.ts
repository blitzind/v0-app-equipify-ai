import { NextResponse } from "next/server"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"
import { createGrowthVideoStorageService } from "@/lib/growth/videos/growth-video-storage-factory"
import { growthVideoAssetPatchSchema } from "@/lib/growth/videos/growth-video-api-schema"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { requireGrowthVideoPlatformAccess } from "@/lib/growth/videos/growth-video-platform-access"
import { GROWTH_VIDEO_ASSETS_QA_MARKER } from "@/lib/growth/videos/growth-video-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const service = createGrowthVideoService(access.admin)
    const result = await service.getAssetById({
      organizationId: access.organizationId,
      assetId: id,
    })
    if (!result.ok) return mapGrowthVideoApiError(new Error(result.error))

    const storageService = createGrowthVideoStorageService(access.admin)
    const playback =
      result.asset.storagePath && result.asset.storageProvider
        ? await storageService.resolveObjectRef(result.asset.storageProvider, result.asset.storagePath)
        : null

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        asset: result.asset,
        playbackUrl: playback?.signedUrl ?? null,
        playbackExpiresAt: (playback?.metadata?.expires_at as string | undefined) ?? null,
        qa_marker: GROWTH_VIDEO_ASSETS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = growthVideoAssetPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const service = createGrowthVideoService(access.admin)
    const result = await service.updateAsset({
      organizationId: access.organizationId,
      assetId: id,
      patch: {
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
      },
    })
    if (!result.ok) return mapGrowthVideoApiError(new Error(result.error))

    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        asset: result.asset,
        qa_marker: GROWTH_VIDEO_ASSETS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const service = createGrowthVideoService(access.admin)
    const existing = await service.getAssetById({
      organizationId: access.organizationId,
      assetId: id,
    })
    if (!existing.ok) return mapGrowthVideoApiError(new Error(existing.error))

    if (existing.asset.storageProvider && existing.asset.storagePath) {
      const storageService = createGrowthVideoStorageService(access.admin)
      await storageService.deleteObject(existing.asset.storageProvider, existing.asset.storagePath)
    }
    if (existing.asset.thumbnailPath && existing.asset.storageProvider) {
      const storageService = createGrowthVideoStorageService(access.admin)
      await storageService.deleteObject(existing.asset.storageProvider, existing.asset.thumbnailPath)
    }

    const deleted = await service.deleteAsset({
      organizationId: access.organizationId,
      assetId: id,
    })
    if (!deleted.ok) return mapGrowthVideoApiError(new Error(deleted.error))

    return NextResponse.json(growthVideoSafetyJson({ ok: true, qa_marker: GROWTH_VIDEO_ASSETS_QA_MARKER }))
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
