import "server-only"

import sharp from "sharp"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE,
} from "@/lib/growth/media/media-video-thumbnail-types"
import { GROWTH_VIDEOS_STORAGE_BUCKET } from "@/lib/growth/videos/growth-video-types"
import { resolveGrowthVideoMergeContext } from "@/lib/growth/videos/growth-video-merge-context-service"
import { extractSequenceHooks } from "@/lib/growth/videos/growth-video-personalization-service"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"
import { createGrowthVideoStorageService } from "@/lib/growth/videos/growth-video-storage-factory"
import { previewGrowthVideoThumbnail } from "@/lib/growth/videos/growth-video-thumbnail-preview-service"
import {
  computeGrowthVideoThumbnailScore,
  renderGrowthVideoThumbnailSvg,
} from "@/lib/growth/videos/growth-video-thumbnail-render-service"
import { renderGrowthVideoOgImageSvg } from "@/lib/growth/videos/growth-video-og-image-service"
import type {
  GrowthVideoPage,
  GrowthVideoThumbnailAiPayload,
  GrowthVideoThumbnailHookMetadata,
  GrowthVideoThumbnailMetadata,
  GrowthVideoThumbnailPreviewFormInput,
  GrowthVideoThumbnailType,
} from "@/lib/growth/videos/growth-video-types"
import {
  buildGrowthVideoOgImagePath,
  buildGrowthVideoPersonalizedThumbnailPath,
} from "@/lib/growth/videos/growth-video-validation"

const METADATA_KEY = "growth_video_thumbnail_b3"

export type GrowthVideoThumbnailGenerateInput = {
  organizationId: string
  pageId: string
  thumbnailType: GrowthVideoThumbnailType
  previewForm?: GrowthVideoThumbnailPreviewFormInput
  persist?: boolean
}

function parseStoredMetadata(metadata: Record<string, unknown>): GrowthVideoThumbnailMetadata | null {
  const raw = metadata[METADATA_KEY]
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  return {
    type: (row.type as GrowthVideoThumbnailType) ?? "prospect",
    thumbnailStoragePath: typeof row.thumbnailStoragePath === "string" ? row.thumbnailStoragePath : null,
    ogStoragePath: typeof row.ogStoragePath === "string" ? row.ogStoragePath : null,
    mergeValues:
      row.mergeValues && typeof row.mergeValues === "object"
        ? (row.mergeValues as Record<string, string>)
        : {},
    layout:
      row.layout && typeof row.layout === "object"
        ? (row.layout as GrowthVideoThumbnailMetadata["layout"])
        : { headline: "", subheadline: "", badge: "", ctaText: "" },
    generatedAt: typeof row.generatedAt === "string" ? row.generatedAt : null,
    videoAssetId: typeof row.videoAssetId === "string" ? row.videoAssetId : "",
    videoPageId: typeof row.videoPageId === "string" ? row.videoPageId : "",
    hooks:
      row.hooks && typeof row.hooks === "object"
        ? (row.hooks as GrowthVideoThumbnailHookMetadata)
        : undefined,
    aiPayload:
      row.aiPayload && typeof row.aiPayload === "object"
        ? (row.aiPayload as GrowthVideoThumbnailAiPayload)
        : undefined,
  } as GrowthVideoThumbnailMetadata & { aiPayload?: GrowthVideoThumbnailAiPayload }
}

async function rasterizeSvgToJpeg(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg, "utf8"), { density: 144 }).jpeg({ quality: 90 }).toBuffer()
}

async function uploadGrowthVideoImage(
  admin: SupabaseClient,
  storagePath: string,
  body: Buffer,
): Promise<void> {
  const { error } = await admin.storage.from(GROWTH_VIDEOS_STORAGE_BUCKET).upload(storagePath, body, {
    contentType: DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE,
    upsert: true,
  })
  if (error) throw new Error(error.message)
}

async function resolveSignedUrl(
  admin: SupabaseClient,
  storagePath: string | null,
): Promise<string | null> {
  if (!storagePath) return null
  const storage = createGrowthVideoStorageService(admin)
  const asset = await storage.resolveObjectRef("supabase_storage", storagePath)
  return asset?.signedUrl ?? null
}

function buildHooks(page: GrowthVideoPage): GrowthVideoThumbnailHookMetadata {
  const hooks = extractSequenceHooks(page.metadata)
  return {
    lead_id: hooks.lead_id ?? null,
    company_candidate_id: hooks.company_candidate_id ?? null,
    person_candidate_id: hooks.person_candidate_id ?? null,
    video_page_id: page.id,
    video_asset_id: page.videoAssetId,
  }
}

export async function resolveGrowthVideoThumbnailMergeValues(
  admin: SupabaseClient,
  input: {
    organizationId: string
    page: GrowthVideoPage
    previewForm?: GrowthVideoThumbnailPreviewFormInput
  },
): Promise<{ mergeValues: Record<string, string>; sourcesUsed: string[] }> {
  const hooks = extractSequenceHooks(input.page.metadata)
  const previewFormRecord: Record<string, string> | null = input.previewForm
    ? {
        firstName: input.previewForm.firstName ?? "",
        lastName: input.previewForm.lastName ?? "",
        company: input.previewForm.company ?? "",
        industry: input.previewForm.industry ?? "",
        title: input.previewForm.title ?? "",
      }
    : null

  const mergeContext = await resolveGrowthVideoMergeContext({
    admin,
    organizationId: input.organizationId,
    leadId: hooks.lead_id,
    companyCandidateId: hooks.company_candidate_id,
    personCandidateId: hooks.person_candidate_id,
    pagePersonalization: input.page.personalization,
    pageFields: {
      ctaUrl: input.page.ctaUrl,
      calendarUrl: input.page.calendarUrl,
    },
    previewForm: previewFormRecord,
  })

  return {
    mergeValues: mergeContext.variables,
    sourcesUsed: mergeContext.sourcesUsed,
  }
}

export async function generateGrowthVideoThumbnailAssets(
  admin: SupabaseClient,
  input: GrowthVideoThumbnailGenerateInput,
): Promise<{
  metadata: GrowthVideoThumbnailMetadata
  aiPayload: GrowthVideoThumbnailAiPayload
  preview: ReturnType<typeof previewGrowthVideoThumbnail>
}> {
  const pageService = createGrowthVideoPageService(admin)
  const page = await pageService.getPageById({
    organizationId: input.organizationId,
    pageId: input.pageId,
  })
  if (!page) throw new Error("not_found")

  const { mergeValues, sourcesUsed } = await resolveGrowthVideoThumbnailMergeValues(admin, {
    organizationId: input.organizationId,
    page,
    previewForm: input.previewForm,
  })

  const preview = previewGrowthVideoThumbnail({
    type: input.thumbnailType,
    form: input.previewForm ?? {},
    primaryColor: page.branding.primaryColor,
    pageTitle: page.title,
    sourcesUsed,
  })

  const thumbnailRender =
    input.thumbnailType === "open_graph"
      ? renderGrowthVideoOgImageSvg({
          mergeValues,
          primaryColor: page.branding.primaryColor,
          ctaLabel: input.previewForm?.ctaLabel ?? page.ctaLabel,
          pageTitle: page.title,
        })
      : renderGrowthVideoThumbnailSvg({
          type: input.thumbnailType,
          mergeValues,
          primaryColor: page.branding.primaryColor,
          ctaLabel: input.previewForm?.ctaLabel ?? page.ctaLabel,
          pageTitle: page.title,
        })

  const ogRender = renderGrowthVideoOgImageSvg({
    mergeValues,
    primaryColor: page.branding.primaryColor,
    ctaLabel: input.previewForm?.ctaLabel ?? page.ctaLabel,
    pageTitle: page.title,
  })

  let thumbnailStoragePath: string | null = null
  let ogStoragePath: string | null = null

  if (input.persist !== false) {
    const thumbnailBytes = await rasterizeSvgToJpeg(thumbnailRender.svg)
    const ogBytes = await rasterizeSvgToJpeg(ogRender.svg)
    thumbnailStoragePath = buildGrowthVideoPersonalizedThumbnailPath({
      organizationId: input.organizationId,
      assetId: page.videoAssetId,
      thumbnailType: input.thumbnailType,
      extension: "jpg",
    })
    ogStoragePath = buildGrowthVideoOgImagePath({
      organizationId: input.organizationId,
      assetId: page.videoAssetId,
      extension: "jpg",
    })
    await uploadGrowthVideoImage(admin, thumbnailStoragePath, thumbnailBytes)
    await uploadGrowthVideoImage(admin, ogStoragePath, ogBytes)

    const videoService = createGrowthVideoService(admin)
    await videoService.updateAsset({
      organizationId: input.organizationId,
      assetId: page.videoAssetId,
      patch: { thumbnailPath: thumbnailStoragePath },
    })
  }

  const aiPayload: GrowthVideoThumbnailAiPayload = {
    thumbnail_variables: preview.aiPayload.thumbnail_variables,
    resolved_values: mergeValues,
    rendered_thumbnail_url: thumbnailStoragePath
      ? await resolveSignedUrl(admin, thumbnailStoragePath)
      : preview.previewDataUrl,
    rendered_og_image_url: ogStoragePath
      ? await resolveSignedUrl(admin, ogStoragePath)
      : preview.ogPreviewDataUrl,
    sources_used: sourcesUsed,
    thumbnail_score: computeGrowthVideoThumbnailScore({ mergeValues }),
  }

  const metadata: GrowthVideoThumbnailMetadata = {
    type: input.thumbnailType,
    thumbnailStoragePath,
    ogStoragePath,
    thumbnailSignedUrl: await resolveSignedUrl(admin, thumbnailStoragePath),
    ogSignedUrl: await resolveSignedUrl(admin, ogStoragePath),
    mergeValues,
    layout: thumbnailRender.layout,
    generatedAt: new Date().toISOString(),
    videoAssetId: page.videoAssetId,
    videoPageId: page.id,
    hooks: buildHooks(page),
  }

  if (input.persist !== false) {
    await pageService.updatePage({
      organizationId: input.organizationId,
      pageId: page.id,
      patch: {
        metadata: {
          [METADATA_KEY]: {
            ...metadata,
            aiPayload,
          },
        },
      },
    })
  }

  return { metadata, aiPayload, preview }
}

export async function getGrowthVideoPageThumbnailState(
  admin: SupabaseClient,
  input: { organizationId: string; pageId: string },
): Promise<{
  page: GrowthVideoPage
  thumbnail: GrowthVideoThumbnailMetadata | null
  aiPayload: GrowthVideoThumbnailAiPayload | null
}> {
  const pageService = createGrowthVideoPageService(admin)
  const page = await pageService.getPageById(input)
  if (!page) throw new Error("not_found")

  const stored = parseStoredMetadata(page.metadata)
  const raw = page.metadata[METADATA_KEY] as Record<string, unknown> | undefined
  const aiPayload =
    raw?.aiPayload && typeof raw.aiPayload === "object"
      ? (raw.aiPayload as GrowthVideoThumbnailAiPayload)
      : null

  if (stored) {
    stored.thumbnailSignedUrl = await resolveSignedUrl(admin, stored.thumbnailStoragePath)
    stored.ogSignedUrl = await resolveSignedUrl(admin, stored.ogStoragePath)
  }

  return { page, thumbnail: stored, aiPayload }
}

export async function patchGrowthVideoPageThumbnailConfig(
  admin: SupabaseClient,
  input: {
    organizationId: string
    pageId: string
    thumbnailType?: GrowthVideoThumbnailType
    previewForm?: GrowthVideoThumbnailPreviewFormInput
  },
): Promise<{ page: GrowthVideoPage; thumbnail: GrowthVideoThumbnailMetadata | null }> {
  const pageService = createGrowthVideoPageService(admin)
  const page = await pageService.getPageById({
    organizationId: input.organizationId,
    pageId: input.pageId,
  })
  if (!page) throw new Error("not_found")

  const existing = parseStoredMetadata(page.metadata) ?? {
    type: "prospect" as GrowthVideoThumbnailType,
    thumbnailStoragePath: null,
    ogStoragePath: null,
    mergeValues: {},
    layout: { headline: "", subheadline: "", badge: "", ctaText: "" },
    generatedAt: null,
    videoAssetId: page.videoAssetId,
    videoPageId: page.id,
    hooks: buildHooks(page),
  }

  const nextConfig = {
    ...existing,
    type: input.thumbnailType ?? existing.type,
    previewForm: input.previewForm ?? undefined,
    hooks: buildHooks(page),
  }

  const updated = await pageService.updatePage({
    organizationId: input.organizationId,
    pageId: input.pageId,
    patch: {
      metadata: {
        [METADATA_KEY]: nextConfig,
      },
    },
  })

  return {
    page: updated,
    thumbnail: parseStoredMetadata(updated.metadata),
  }
}

export async function resolveGrowthVideoPublicThumbnailUrls(
  admin: SupabaseClient,
  input: {
    organizationId: string
    videoAssetId: string
    metadata: Record<string, unknown>
    mergeValues?: Record<string, string>
    branding?: { primaryColor?: string | null }
    pageTitle?: string | null
    ctaLabel?: string | null
  },
): Promise<{ thumbnailUrl: string | null; ogImageUrl: string | null }> {
  const stored = parseStoredMetadata(input.metadata)
  if (stored?.ogStoragePath || stored?.thumbnailStoragePath) {
    return {
      thumbnailUrl: await resolveSignedUrl(admin, stored.thumbnailStoragePath),
      ogImageUrl: await resolveSignedUrl(admin, stored.ogStoragePath),
    }
  }

  if (!input.mergeValues || Object.keys(input.mergeValues).length === 0) {
    const videoService = createGrowthVideoService(admin)
    const asset = await videoService.getAssetById({
      organizationId: input.organizationId,
      assetId: input.videoAssetId,
    })
    if (asset.ok && asset.asset.thumbnailPath) {
      const url = await resolveSignedUrl(admin, asset.asset.thumbnailPath)
      return { thumbnailUrl: url, ogImageUrl: url }
    }
    return { thumbnailUrl: null, ogImageUrl: null }
  }

  const og = renderGrowthVideoOgImageSvg({
    mergeValues: input.mergeValues,
    primaryColor: input.branding?.primaryColor,
    ctaLabel: input.ctaLabel,
    pageTitle: input.pageTitle,
  })

  return {
    thumbnailUrl: null,
    ogImageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(og.svg)}`,
  }
}

export { METADATA_KEY as GROWTH_VIDEO_THUMBNAIL_METADATA_KEY }
