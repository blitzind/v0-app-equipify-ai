import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_VIDEO_PAGES_QA_MARKER,
  type GrowthVideoPublicPage,
} from "@/lib/growth/videos/growth-video-types"
import {
  parseGrowthVideoPageBranding,
  buildGrowthVideoPublicPath,
} from "@/lib/growth/videos/growth-video-page-validation"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"
import { createGrowthVideoStorageService } from "@/lib/growth/videos/growth-video-storage-factory"
import { isGrowthVideoPagesSchemaReady } from "@/lib/growth/videos/growth-video-schema-health"

export type GrowthVideoPublicPageResolveResult =
  | { ok: true; page: GrowthVideoPublicPage; pageId: string; videoAssetId: string }
  | { ok: false; error: "not_found" | "pages_schema_not_ready" | "ambiguous_slug" }

export async function resolveGrowthVideoPublicPageBySlug(
  admin: SupabaseClient,
  slug: string,
): Promise<GrowthVideoPublicPageResolveResult> {
  if (!(await isGrowthVideoPagesSchemaReady(admin))) {
    return { ok: false, error: "pages_schema_not_ready" }
  }

  const normalizedSlug = slug.trim().toLowerCase()
  if (!normalizedSlug) return { ok: false, error: "not_found" }

  const { data: pages, error } = await admin
    .schema("growth")
    .from("video_pages")
    .select(
      "id, organization_id, video_asset_id, slug, title, description, status, cta_label, cta_url, calendar_url, branding_json",
    )
    .eq("slug", normalizedSlug)
    .eq("status", "published")
    .limit(2)

  if (error) throw new Error(error.message)
  if (!pages?.length) return { ok: false, error: "not_found" }
  if (pages.length > 1) return { ok: false, error: "ambiguous_slug" }

  const row = pages[0] as {
    id: string
    organization_id: string
    video_asset_id: string
    slug: string
    title: string
    description: string | null
    cta_label: string | null
    cta_url: string | null
    calendar_url: string | null
    branding_json: Record<string, unknown> | null
  }

  const videoService = createGrowthVideoService(admin)
  const assetResult = await videoService.getAssetById({
    organizationId: row.organization_id,
    assetId: row.video_asset_id,
  })

  let playbackUrl: string | null = null
  let playbackExpiresAt: string | null = null
  let videoTitle: string | null = null

  if (assetResult.ok) {
    videoTitle = assetResult.asset.title
    if (assetResult.asset.storagePath && assetResult.asset.storageProvider) {
      const storageService = createGrowthVideoStorageService(admin)
      const playback = await storageService.resolveObjectRef(
        assetResult.asset.storageProvider,
        assetResult.asset.storagePath,
      )
      playbackUrl = playback?.signedUrl ?? null
      playbackExpiresAt = (playback?.metadata?.expires_at as string | undefined) ?? null
    }
  }

  const branding = parseGrowthVideoPageBranding(row.branding_json)

  return {
    ok: true,
    pageId: row.id,
    videoAssetId: row.video_asset_id,
    page: {
      slug: row.slug,
      title: row.title,
      description: row.description,
      ctaLabel: row.cta_label,
      ctaUrl: row.cta_url,
      calendarUrl: row.calendar_url,
      branding,
      playbackUrl,
      playbackExpiresAt,
      videoTitle,
      qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER,
    },
  }
}

export function buildGrowthVideoPublicPageUrl(slug: string, origin?: string): string {
  const path = buildGrowthVideoPublicPath(slug)
  if (origin?.trim()) return `${origin.replace(/\/$/, "")}${path}`
  return path
}
