import { NextResponse } from "next/server"
import { z } from "zod"
import { createUploadSession, getMediaAsset } from "@/lib/growth/media/media-asset-repository"
import {
  assertMediaAssetOrgScope,
  requireMediaAssetPlatformAccess,
} from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaAssetError } from "@/lib/growth/media/media-asset-route-utils"
import { GROWTH_MEDIA_ASSETS_QA_MARKER } from "@/lib/growth/media/media-asset-types"

export const runtime = "nodejs"

const UploadSessionSchema = z.object({
  mime_type: z.string().max(200).nullable().optional(),
  extension: z.string().max(20).nullable().optional(),
  file_size_bytes: z.number().int().nonnegative().nullable().optional(),
  signed_url_ttl_seconds: z.number().int().positive().max(86400).optional(),
})

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = UploadSessionSchema.safeParse(await request.json().catch(() => ({})))
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

    const result = await createUploadSession(access.admin, {
      organizationId: access.organizationId,
      assetId: id,
      mimeType: parsed.data.mime_type,
      extension: parsed.data.extension,
      fileSizeBytes: parsed.data.file_size_bytes,
      signedUrlTtlSeconds: parsed.data.signed_url_ttl_seconds,
    })
    return NextResponse.json({
      ok: true,
      asset: result.asset,
      upload_session: result.session,
      no_upload_execution: true,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
    })
  } catch (error) {
    return mapMediaAssetError(error)
  }
}
