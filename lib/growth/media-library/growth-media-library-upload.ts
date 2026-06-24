import {
  GROWTH_MEDIA_LIBRARY_ACCEPT_ATTR,
  type GrowthMediaLibraryAsset,
  type GrowthMediaLibraryKind,
} from "@/lib/growth/media-library/growth-media-library-types"
import { readImageFileDimensions } from "@/lib/growth/media-library/growth-media-library-format"
import { validateGrowthMediaLibraryFile } from "@/lib/growth/media-library/growth-media-library-validation"
import {
  GROWTH_MEDIA_LIBRARY_TAG,
  growthMediaLibraryKindTag,
} from "@/lib/growth/media-library/growth-media-library-types"
import { buildGrowthMediaLibraryPublicUrl } from "@/lib/growth/media-library/growth-media-library-url"
import { normalizeGrowthMediaLibraryPersistedUrl } from "@/lib/growth/media-library/growth-media-library-canonical-url"

export type GrowthMediaLibraryUploadResult = {
  asset: GrowthMediaLibraryAsset
  publicUrl: string
}

async function uploadFileToSignedUrl(writeUrl: string, file: File): Promise<void> {
  if (writeUrl.startsWith("stub://")) return

  const response = await fetch(writeUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body: file,
  })
  if (!response.ok) {
    throw new Error("storage_upload_failed")
  }
}

export async function uploadGrowthMediaLibraryFile(input: {
  file: File
  title?: string
  libraryKind?: GrowthMediaLibraryKind
  altText?: string | null
  onProgress?: (message: string) => void
}): Promise<GrowthMediaLibraryUploadResult> {
  const validation = validateGrowthMediaLibraryFile(input.file)
  if (!validation.ok) {
    throw new Error(validation.error)
  }

  input.onProgress?.("Preparing upload…")

  const sessionResponse = await fetch("/api/platform/growth/media-assets/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title?.trim() || input.file.name,
      library_kind: input.libraryKind ?? "image",
      mime_type: validation.mimeType,
      file_size_bytes: input.file.size,
      alt_text: input.altText ?? null,
      original_filename: input.file.name,
    }),
  })

  const sessionPayload = (await sessionResponse.json()) as {
    ok?: boolean
    asset?: GrowthMediaLibraryAsset
    upload_session?: { writeUrl: string | null }
    public_url?: string
    error?: string
    message?: string
  }

  if (!sessionResponse.ok || !sessionPayload.ok || !sessionPayload.asset?.id) {
    throw new Error(sessionPayload.error ?? sessionPayload.message ?? "upload_session_failed")
  }

  const writeUrl = sessionPayload.upload_session?.writeUrl
  if (!writeUrl) {
    throw new Error("upload_write_url_missing")
  }

  input.onProgress?.("Uploading image…")
  await uploadFileToSignedUrl(writeUrl, input.file)

  input.onProgress?.("Finalizing…")
  const dimensions = await readImageFileDimensions(input.file)
  const completeResponse = await fetch(
    `/api/platform/growth/media-assets/${sessionPayload.asset.id}/complete-upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_size_bytes: input.file.size }),
    },
  )
  const completePayload = (await completeResponse.json()) as {
    ok?: boolean
    error?: string
    message?: string
  }
  if (!completeResponse.ok || !completePayload.ok) {
    throw new Error(completePayload.error ?? completePayload.message ?? "upload_complete_failed")
  }

  if (dimensions) {
    await fetch(`/api/platform/growth/media-assets/${sessionPayload.asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        width: dimensions.width,
        height: dimensions.height,
      }),
    })
  }

  const publicUrl = normalizeGrowthMediaLibraryPersistedUrl(
    sessionPayload.public_url ?? buildGrowthMediaLibraryPublicUrl(sessionPayload.asset.id),
    { assetId: sessionPayload.asset.id },
  )

  return {
    asset: {
      ...sessionPayload.asset,
      width: dimensions?.width ?? sessionPayload.asset.width,
      height: dimensions?.height ?? sessionPayload.asset.height,
      publicUrl,
      previewUrl: publicUrl,
    },
    publicUrl,
  }
}

export async function listGrowthMediaLibraryAssets(input?: {
  libraryKind?: GrowthMediaLibraryKind | "all"
  search?: string
}): Promise<GrowthMediaLibraryAsset[]> {
  const params = new URLSearchParams({ library: "1", limit: "100" })
  if (input?.libraryKind && input.libraryKind !== "all") {
    params.set("library_kind", input.libraryKind)
  }
  if (input?.search?.trim()) params.set("search", input.search.trim())

  const response = await fetch(`/api/platform/growth/media-assets?${params.toString()}`, {
    cache: "no-store",
  })
  const payload = (await response.json()) as {
    ok?: boolean
    items?: GrowthMediaLibraryAsset[]
    error?: string
  }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "library_list_failed")
  }
  return payload.items ?? []
}

export async function updateGrowthMediaLibraryAsset(input: {
  assetId: string
  title?: string
  altText?: string | null
  libraryKind?: GrowthMediaLibraryKind
}): Promise<void> {
  const body: Record<string, unknown> = {}
  if (input.title !== undefined) body.title = input.title.trim()
  if (input.altText !== undefined) body.metadata = { alt_text: input.altText?.trim() || null }
  if (input.libraryKind) {
    body.tags = [GROWTH_MEDIA_LIBRARY_TAG, growthMediaLibraryKindTag(input.libraryKind)]
  }

  const response = await fetch(`/api/platform/growth/media-assets/${input.assetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as { ok?: boolean; error?: string }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "update_failed")
  }
}

export async function archiveGrowthMediaLibraryAsset(assetId: string): Promise<void> {
  const response = await fetch(`/api/platform/growth/media-assets/${assetId}`, { method: "DELETE" })
  const payload = (await response.json()) as { ok?: boolean; error?: string }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "archive_failed")
  }
}

export { GROWTH_MEDIA_LIBRARY_ACCEPT_ATTR }
