import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"
import { createGrowthVideoStorageService } from "@/lib/growth/videos/growth-video-storage-factory"
import type { GrowthVideoAsset } from "@/lib/growth/videos/growth-video-types"
import { GROWTH_SENDR_GROWTH_VIDEO_INTEGRATION_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import { updateGrowthSendrLandingPage, getGrowthSendrLandingPage, updateGrowthSendrLandingPageSection, listGrowthSendrLandingPageSections } from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import type {
  GrowthSendrAssetPickerItem,
  GrowthSendrPublicPageSection,
  GrowthSendrPublicSectionVideoPlayback,
  GrowthSendrVideoAsset,
} from "@/lib/growth/sendr/growth-sendr-types"
import {
  getGrowthSendrVideoAsset,
  registerGrowthSendrVideoAssetMetadata,
  updateGrowthSendrVideoAssetMetadata,
} from "@/lib/growth/sendr/growth-sendr-video-runtime-repository"

export type GrowthVideoPlaybackForSendr = {
  growthVideoAssetId: string
  title: string
  playbackUrl: string | null
  playbackExpiresAt: string | null
  posterUrl: string | null
  durationSeconds: number | null
  sourceType: string
  status: string
  createdAt: string
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function formatCreatedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return iso.slice(0, 10)
  }
}

async function resolveSignedObjectUrl(
  admin: SupabaseClient,
  storageProvider: string | null,
  storagePath: string | null,
): Promise<string | null> {
  if (!storageProvider || !storagePath) return null
  const storageService = createGrowthVideoStorageService(admin)
  const resolved = await storageService.resolveObjectRef(storageProvider, storagePath)
  return resolved?.signedUrl ?? null
}

export async function resolveGrowthVideoPlaybackForSendr(
  admin: SupabaseClient,
  input: {
    organizationId: string
    growthVideoAssetId: string
  },
): Promise<GrowthVideoPlaybackForSendr | null> {
  const videoService = createGrowthVideoService(admin)
  const assetResult = await videoService.getAssetById({
    organizationId: input.organizationId,
    assetId: input.growthVideoAssetId,
  })
  if (!assetResult.ok) return null

  const asset = assetResult.asset
  let playbackUrl: string | null = null
  let playbackExpiresAt: string | null = null

  if (asset.storagePath && asset.storageProvider) {
    const storageService = createGrowthVideoStorageService(admin)
    const playback = await storageService.resolveObjectRef(asset.storageProvider, asset.storagePath)
    playbackUrl = playback?.signedUrl ?? null
    playbackExpiresAt = (playback?.metadata?.expires_at as string | undefined) ?? null
  }

  const posterUrl = await resolveSignedObjectUrl(admin, asset.storageProvider, asset.thumbnailPath)

  return {
    growthVideoAssetId: asset.id,
    title: asset.title,
    playbackUrl,
    playbackExpiresAt,
    posterUrl,
    durationSeconds: asset.durationSeconds,
    sourceType: asset.sourceType,
    status: asset.status,
    createdAt: asset.createdAt,
  }
}

function growthAssetToPickerItem(
  asset: GrowthVideoAsset,
  previewUrl: string | null,
): GrowthSendrAssetPickerItem {
  const durationLabel = formatDuration(asset.durationSeconds)
  const createdLabel = formatCreatedDate(asset.createdAt)
  const subtitleParts = [durationLabel, createdLabel, asset.sourceType].filter(Boolean)

  return {
    id: asset.id,
    assetKind: "video",
    name: asset.title,
    subtitle: subtitleParts.join(" · "),
    status: asset.status,
    previewUrl,
    metadata: {
      source: "growth_library",
      growthVideoAssetId: asset.id,
      durationSeconds: asset.durationSeconds,
      createdAt: asset.createdAt,
      sourceType: asset.sourceType,
      uploadStatus: asset.uploadStatus,
    },
  }
}

export async function listGrowthVideoAssetsForSendrPicker(
  admin: SupabaseClient,
  input: {
    organizationId: string
    search?: string
    limit?: number
  },
): Promise<GrowthSendrAssetPickerItem[]> {
  const videoService = createGrowthVideoService(admin)
  const listed = await videoService.listAssets({
    organizationId: input.organizationId,
    search: input.search,
    limit: input.limit ?? 50,
  })
  if (!listed.ok) return []

  const items: GrowthSendrAssetPickerItem[] = []
  for (const asset of listed.items) {
    const posterUrl = await resolveSignedObjectUrl(admin, asset.storageProvider, asset.thumbnailPath)
    items.push(growthAssetToPickerItem(asset, posterUrl))
  }
  return items
}

export async function findGrowthSendrVideoAssetByLegacyId(
  admin: SupabaseClient,
  organizationId: string,
  legacyVideoAssetId: string,
): Promise<GrowthSendrVideoAsset | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("growth_video_assets")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("legacy_video_asset_id", legacyVideoAssetId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return getGrowthSendrVideoAsset(admin, String(data.id))
}

export async function ensureSendrVideoLinkForGrowthAsset(
  admin: SupabaseClient,
  input: {
    organizationId: string
    ownerUserId: string
    growthVideoAssetId: string
  },
): Promise<{ videoAsset: GrowthSendrVideoAsset; playback: GrowthVideoPlaybackForSendr }> {
  const playback = await resolveGrowthVideoPlaybackForSendr(admin, {
    organizationId: input.organizationId,
    growthVideoAssetId: input.growthVideoAssetId,
  })
  if (!playback) {
    throw new Error("growth_video_asset_not_found")
  }

  let videoAsset =
    (await findGrowthSendrVideoAssetByLegacyId(
      admin,
      input.organizationId,
      input.growthVideoAssetId,
    )) ??
    (await registerGrowthSendrVideoAssetMetadata(admin, {
      organizationId: input.organizationId,
      ownerUserId: input.ownerUserId,
      legacyVideoAssetId: input.growthVideoAssetId,
      durationSeconds: playback.durationSeconds,
      posterUrl: playback.posterUrl,
      sourceUrl: null,
      transcriptStatus: "none",
      captionsStatus: "none",
    }))

  if (videoAsset.legacyVideoAssetId === input.growthVideoAssetId) {
    videoAsset = await updateGrowthSendrVideoAssetMetadata(admin, {
      videoAssetId: videoAsset.id,
      organizationId: input.organizationId,
      posterUrl: playback.posterUrl,
    })
  }

  return { videoAsset, playback }
}

export async function linkGrowthVideoAssetToSendrPage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    ownerUserId: string
    landingPageId: string
    growthVideoAssetId: string
  },
): Promise<{ page: NonNullable<Awaited<ReturnType<typeof getGrowthSendrLandingPage>>>; videoAsset: GrowthSendrVideoAsset }> {
  const currentPage = await getGrowthSendrLandingPage(admin, input.landingPageId)
  if (!currentPage || currentPage.organizationId !== input.organizationId) {
    throw new Error("landing_page_not_found")
  }

  const { videoAsset } = await ensureSendrVideoLinkForGrowthAsset(admin, input)

  const page = await updateGrowthSendrLandingPage(admin, {
    landingPageId: input.landingPageId,
    organizationId: input.organizationId,
    mobileMetadata: {
      ...currentPage.mobileMetadata,
      videoAssetId: videoAsset.id,
      growthVideoAssetId: input.growthVideoAssetId,
      videoSource: "growth_library",
    },
  })

  return { page: page!, videoAsset }
}

export async function detachGrowthVideoFromSendrPage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    landingPageId: string
  },
): Promise<NonNullable<Awaited<ReturnType<typeof getGrowthSendrLandingPage>>>> {
  const currentPage = await getGrowthSendrLandingPage(admin, input.landingPageId)
  if (!currentPage || currentPage.organizationId !== input.organizationId) {
    throw new Error("landing_page_not_found")
  }

  const mobileMetadata = { ...currentPage.mobileMetadata }
  delete mobileMetadata.videoAssetId
  delete mobileMetadata.growthVideoAssetId
  delete mobileMetadata.videoSource

  const page = await updateGrowthSendrLandingPage(admin, {
    landingPageId: input.landingPageId,
    organizationId: input.organizationId,
    mobileMetadata,
  })
  return page!
}

function buildSectionVideoContentPatch(input: {
  growthVideoAssetId: string
  videoAssetId: string
  videoTitle: string
  playback: GrowthVideoPlaybackForSendr
}): Record<string, unknown> {
  return {
    growthVideoAssetId: input.growthVideoAssetId,
    videoAssetId: input.videoAssetId,
    videoSource: "growth_library",
    videoTitle: input.videoTitle,
    sourceUrl: null,
    posterUrl: input.playback.posterUrl,
    durationSeconds: input.playback.durationSeconds,
  }
}

export async function linkGrowthVideoAssetToSendrSection(
  admin: SupabaseClient,
  input: {
    organizationId: string
    ownerUserId: string
    landingPageId: string
    sectionId: string
    growthVideoAssetId: string
  },
): Promise<{ section: Awaited<ReturnType<typeof updateGrowthSendrLandingPageSection>>; videoAsset: GrowthSendrVideoAsset }> {
  const currentPage = await getGrowthSendrLandingPage(admin, input.landingPageId)
  if (!currentPage || currentPage.organizationId !== input.organizationId) {
    throw new Error("landing_page_not_found")
  }

  const { videoAsset, playback } = await ensureSendrVideoLinkForGrowthAsset(admin, input)

  const sections = await listGrowthSendrLandingPageSections(admin, input.landingPageId)
  const existing = sections.find((row) => row.id === input.sectionId)
  if (!existing) {
    throw new Error("section_not_found")
  }

  const section = await updateGrowthSendrLandingPageSection(admin, {
    sectionId: input.sectionId,
    landingPageId: input.landingPageId,
    organizationId: input.organizationId,
    content: {
      ...existing.content,
      ...buildSectionVideoContentPatch({
        growthVideoAssetId: input.growthVideoAssetId,
        videoAssetId: videoAsset.id,
        videoTitle: playback.title,
        playback,
      }),
    },
  })

  return { section, videoAsset }
}

export async function detachGrowthVideoFromSendrSection(
  admin: SupabaseClient,
  input: {
    organizationId: string
    landingPageId: string
    sectionId: string
  },
): Promise<Awaited<ReturnType<typeof updateGrowthSendrLandingPageSection>>> {
  const currentPage = await getGrowthSendrLandingPage(admin, input.landingPageId)
  if (!currentPage || currentPage.organizationId !== input.organizationId) {
    throw new Error("landing_page_not_found")
  }

  const sections = await listGrowthSendrLandingPageSections(admin, input.landingPageId)
  const existing = sections.find((row) => row.id === input.sectionId)
  if (!existing) {
    throw new Error("section_not_found")
  }

  return updateGrowthSendrLandingPageSection(admin, {
    sectionId: input.sectionId,
    landingPageId: input.landingPageId,
    organizationId: input.organizationId,
    content: {
      ...existing.content,
      growthVideoAssetId: null,
      videoAssetId: null,
      videoSource: null,
      videoTitle: null,
      sourceUrl: null,
      posterUrl: null,
      durationSeconds: null,
    },
  })
}

export async function resolveSendrSectionVideoPlayback(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sectionContent: Record<string, unknown>
    pageVideoFallback?: GrowthSendrPublicSectionVideoPlayback | null
  },
): Promise<GrowthSendrPublicSectionVideoPlayback | null> {
  const growthVideoAssetId =
    typeof input.sectionContent.growthVideoAssetId === "string"
      ? input.sectionContent.growthVideoAssetId
      : null
  const sendrVideoAssetId =
    typeof input.sectionContent.videoAssetId === "string" ? input.sectionContent.videoAssetId : null
  const legacySourceUrl =
    typeof input.sectionContent.sourceUrl === "string" ? input.sectionContent.sourceUrl : null

  if (growthVideoAssetId) {
    const resolved = await resolveGrowthVideoPlaybackForSendr(admin, {
      organizationId: input.organizationId,
      growthVideoAssetId,
    })
    if (resolved) {
      return {
        sourceUrl: resolved.playbackUrl,
        posterUrl: resolved.posterUrl,
        durationSeconds: resolved.durationSeconds,
        videoAssetId: sendrVideoAssetId,
      }
    }
  }

  if (sendrVideoAssetId) {
    const video = await getGrowthSendrVideoAsset(admin, sendrVideoAssetId)
    if (video) {
      const playback = await resolveSendrPublicVideoPlayback(admin, video)
      return {
        sourceUrl: playback.sourceUrl,
        posterUrl: playback.posterUrl,
        durationSeconds: playback.durationSeconds,
        videoAssetId: sendrVideoAssetId,
      }
    }
  }

  if (legacySourceUrl) {
    return {
      sourceUrl: legacySourceUrl,
      posterUrl:
        typeof input.sectionContent.posterUrl === "string" ? input.sectionContent.posterUrl : null,
      durationSeconds:
        typeof input.sectionContent.durationSeconds === "number"
          ? input.sectionContent.durationSeconds
          : null,
      videoAssetId: sendrVideoAssetId,
    }
  }

  return input.pageVideoFallback ?? null
}

export async function enrichSendrPublicSectionsWithVideoPlayback(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sections: GrowthSendrPublicPageSection[]
    pageVideoFallback?: GrowthSendrPublicSectionVideoPlayback | null
  },
): Promise<GrowthSendrPublicPageSection[]> {
  const enriched: GrowthSendrPublicPageSection[] = []

  for (const section of input.sections) {
    if (section.type !== "video" && section.type !== "avatar_video") {
      enriched.push(section)
      continue
    }

    const playback = await resolveSendrSectionVideoPlayback(admin, {
      organizationId: input.organizationId,
      sectionContent: section.content,
      pageVideoFallback: input.pageVideoFallback,
    })

    enriched.push({
      ...section,
      content: {
        ...section.content,
        ...(playback ? { videoPlayback: playback } : {}),
      },
    })
  }

  return enriched
}

export async function resolveSendrPublicVideoPlayback(
  admin: SupabaseClient,
  videoAsset: GrowthSendrVideoAsset,
): Promise<{
  sourceUrl: string | null
  posterUrl: string | null
  durationSeconds: number | null
}> {
  if (videoAsset.legacyVideoAssetId) {
    const resolved = await resolveGrowthVideoPlaybackForSendr(admin, {
      organizationId: videoAsset.organizationId,
      growthVideoAssetId: videoAsset.legacyVideoAssetId,
    })
    if (resolved) {
      return {
        sourceUrl: resolved.playbackUrl ?? videoAsset.sourceUrl,
        posterUrl: resolved.posterUrl ?? videoAsset.posterUrl,
        durationSeconds: resolved.durationSeconds ?? videoAsset.durationSeconds,
      }
    }
  }

  return {
    sourceUrl: videoAsset.sourceUrl,
    posterUrl: videoAsset.posterUrl,
    durationSeconds: videoAsset.durationSeconds,
  }
}

export { GROWTH_SENDR_GROWTH_VIDEO_INTEGRATION_QA_MARKER }
