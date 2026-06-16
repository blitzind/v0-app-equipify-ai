import { NextResponse } from "next/server"
import { z } from "zod"
import { completeUploadSession, getMediaAsset } from "@/lib/growth/media/media-asset-repository"
import {
  assertMediaAssetOrgScope,
  requireMediaAssetPlatformAccess,
} from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaAssetError } from "@/lib/growth/media/media-asset-route-utils"
import { GROWTH_MEDIA_ASSETS_QA_MARKER } from "@/lib/growth/media/media-asset-types"

export const runtime = "nodejs"

const CompleteUploadSchema = z.object({
  checksum_sha256: z.string().max(128).nullable().optional(),
  file_size_bytes: z.number().int().nonnegative().nullable().optional(),
})

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = CompleteUploadSchema.safeParse(await request.json().catch(() => ({})))
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

    const asset = await completeUploadSession(access.admin, {
      organizationId: access.organizationId,
      assetId: id,
      checksumSha256: parsed.data.checksum_sha256,
      fileSizeBytes: parsed.data.file_size_bytes,
    })
    return NextResponse.json({
      ok: true,
      asset,
      no_upload_execution: true,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
    })
  } catch (error) {
    return mapMediaAssetError(error)
  }
}
