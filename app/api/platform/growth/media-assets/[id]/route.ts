import { NextResponse } from "next/server"
import { z } from "zod"
import {
  archiveMediaAsset,
  getMediaAsset,
  updateMediaAsset,
} from "@/lib/growth/media/media-asset-repository"
import {
  assertMediaAssetOrgScope,
  requireMediaAssetPlatformAccess,
} from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaAssetError } from "@/lib/growth/media/media-asset-route-utils"
import { GROWTH_MEDIA_ASSETS_QA_MARKER } from "@/lib/growth/media/media-asset-types"

export const runtime = "nodejs"

const UpdateSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(4000).optional(),
  tags: z.array(z.string().min(1).max(80)).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
  thumbnail_storage_key: z.string().max(1000).nullable().optional(),
  waveform_storage_key: z.string().max(1000).nullable().optional(),
  duration_seconds: z.number().nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
})

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const asset = await getMediaAsset(access.admin, id)
    if (!asset) {
      return NextResponse.json({ ok: false, error: "asset_not_found" }, { status: 404 })
    }
    const scopeError = assertMediaAssetOrgScope(asset, access.organizationId)
    if (scopeError) return scopeError

    return NextResponse.json({
      ok: true,
      asset,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
    })
  } catch (error) {
    return mapMediaAssetError(error)
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => ({})))
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

    const asset = await updateMediaAsset(access.admin, id, {
      title: parsed.data.title,
      description: parsed.data.description,
      tags: parsed.data.tags,
      metadata: parsed.data.metadata,
      thumbnailStorageKey: parsed.data.thumbnail_storage_key,
      waveformStorageKey: parsed.data.waveform_storage_key,
      durationSeconds: parsed.data.duration_seconds,
      width: parsed.data.width,
      height: parsed.data.height,
    })
    return NextResponse.json({
      ok: true,
      asset,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
    })
  } catch (error) {
    return mapMediaAssetError(error)
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const existing = await getMediaAsset(access.admin, id)
    if (!existing) {
      return NextResponse.json({ ok: false, error: "asset_not_found" }, { status: 404 })
    }
    const scopeError = assertMediaAssetOrgScope(existing, access.organizationId)
    if (scopeError) return scopeError

    const asset = await archiveMediaAsset(access.admin, id)
    return NextResponse.json({
      ok: true,
      asset,
      archived: true,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
    })
  } catch (error) {
    return mapMediaAssetError(error)
  }
}
