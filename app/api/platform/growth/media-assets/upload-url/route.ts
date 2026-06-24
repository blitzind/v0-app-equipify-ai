import { NextResponse } from "next/server"
import { z } from "zod"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaAssetError } from "@/lib/growth/media/media-asset-route-utils"
import { createGrowthMediaLibraryUploadSession } from "@/lib/growth/media-library/growth-media-library-service"
import { GROWTH_MEDIA_LIBRARY_QA_MARKER } from "@/lib/growth/media-library/growth-media-library-types"

export const runtime = "nodejs"

const UploadUrlSchema = z.object({
  title: z.string().max(500).optional(),
  library_kind: z.enum(["image", "logo", "avatar"]).optional(),
  mime_type: z.string().max(200),
  file_size_bytes: z.number().int().positive(),
  alt_text: z.string().max(500).nullable().optional(),
  original_filename: z.string().max(500).nullable().optional(),
})

export async function POST(request: Request) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const parsed = UploadUrlSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid upload payload." }, { status: 400 })
  }

  const origin = new URL(request.url).origin

  try {
    const result = await createGrowthMediaLibraryUploadSession(access.admin, {
      organizationId: access.organizationId,
      createdBy: access.userId,
      title: parsed.data.title,
      libraryKind: parsed.data.library_kind,
      mimeType: parsed.data.mime_type,
      fileSizeBytes: parsed.data.file_size_bytes,
      altText: parsed.data.alt_text,
      originalFilename: parsed.data.original_filename,
      origin,
    })

    return NextResponse.json({
      ok: true,
      asset: result.asset,
      upload_session: result.uploadSession,
      public_url: result.publicUrl,
      qa_marker: GROWTH_MEDIA_LIBRARY_QA_MARKER,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload_session_failed"
    if (message === "invalid_mime_type" || message === "file_too_large" || message === "missing_file") {
      return NextResponse.json({ ok: false, error: message }, { status: 400 })
    }
    return mapMediaAssetError(error)
  }
}
