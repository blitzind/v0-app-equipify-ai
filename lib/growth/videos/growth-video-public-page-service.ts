import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_VIDEO_PAGES_QA_MARKER,
  GROWTH_VIDEO_PERSONALIZATION_QA_MARKER,
  GROWTH_VIDEO_THUMBNAILS_QA_MARKER,
  type GrowthVideoPublicPage,
} from "@/lib/growth/videos/growth-video-types"
import {
  parseGrowthVideoPageBranding,
  parseGrowthVideoPagePersonalization,
  buildGrowthVideoPublicPath,
} from "@/lib/growth/videos/growth-video-page-validation"
import { renderGrowthVideoPageFields } from "@/lib/growth/videos/growth-video-personalization-service"
import { resolveGrowthVideoPublicThumbnailUrls } from "@/lib/growth/videos/growth-video-thumbnail-service"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"
import { createGrowthVideoStorageService } from "@/lib/growth/videos/growth-video-storage-factory"
import { isGrowthVideoPagesSchemaReady } from "@/lib/growth/videos/growth-video-schema-health"

export type GrowthVideoPublicRenderContext = {
  leadId?: string | null
  companyCandidateId?: string | null
  personCandidateId?: string | null
  personalizationProfileId?: string | null
  enrollmentCandidateId?: string | null
  sequenceCandidateId?: string | null
}

export type GrowthVideoPublicPageResolveResult =
  | { ok: true; page: GrowthVideoPublicPage; pageId: string; videoAssetId: string }
  | { ok: false; error: "not_found" | "pages_schema_not_ready" | "ambiguous_slug" }

function asTrimmed(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function resolveGrowthVideoPublicPageBySlug(
  admin: SupabaseClient,
  slug: string,
  renderContext?: GrowthVideoPublicRenderContext,
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
      "id, organization_id, video_asset_id, slug, title, description, status, cta_label, cta_url, calendar_url, branding_json, personalization_json, metadata_json",
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
    personalization_json: Record<string, unknown> | null
    metadata_json: Record<string, unknown> | null
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
  const personalization = parseGrowthVideoPagePersonalization(row.personalization_json)
  const metadata = row.metadata_json ?? {}

  const leadId =
    asTrimmed(renderContext?.leadId) ??
    asTrimmed(typeof metadata.lead_id === "string" ? metadata.lead_id : null)
  const companyCandidateId =
    asTrimmed(renderContext?.companyCandidateId) ??
    asTrimmed(typeof metadata.company_candidate_id === "string" ? metadata.company_candidate_id : null)
  const personCandidateId =
    asTrimmed(renderContext?.personCandidateId) ??
    asTrimmed(typeof metadata.person_candidate_id === "string" ? metadata.person_candidate_id : null)

  const rendered = await renderGrowthVideoPageFields(
    admin,
    {
      organizationId: row.organization_id,
      leadId,
      companyCandidateId,
      personCandidateId,
      personalizationProfileId: asTrimmed(renderContext?.personalizationProfileId),
      pagePersonalization: personalization,
    },
    {
      title: row.title,
      description: row.description,
      ctaLabel: row.cta_label,
      ctaUrl: row.cta_url,
      calendarUrl: row.calendar_url,
      branding,
    },
  )

  const hasMergeTokens = /\{\{\s*[a-z0-9_.]+\s*\}\}/i.test(
    [row.title, row.description, row.cta_label, row.cta_url, row.calendar_url, branding.buttonLabelOverride]
      .filter(Boolean)
      .join(" "),
  )

  const thumbnailUrls = await resolveGrowthVideoPublicThumbnailUrls(admin, {
    organizationId: row.organization_id,
    videoAssetId: row.video_asset_id,
    metadata,
    mergeValues: rendered.mergeContext.variables,
    branding,
    pageTitle: rendered.title,
    ctaLabel: rendered.ctaLabel,
  })

  const qaMarker = thumbnailUrls.ogImageUrl
    ? GROWTH_VIDEO_THUMBNAILS_QA_MARKER
    : hasMergeTokens
      ? GROWTH_VIDEO_PERSONALIZATION_QA_MARKER
      : GROWTH_VIDEO_PAGES_QA_MARKER

  return {
    ok: true,
    pageId: row.id,
    videoAssetId: row.video_asset_id,
    page: {
      slug: row.slug,
      title: rendered.title,
      description: rendered.description,
      ctaLabel: rendered.ctaLabel,
      ctaUrl: rendered.ctaUrl,
      calendarUrl: rendered.calendarUrl,
      branding: rendered.branding,
      playbackUrl,
      playbackExpiresAt,
      videoTitle,
      personalizationApplied: hasMergeTokens,
      missingVariables: rendered.missingVariables,
      thumbnailUrl: thumbnailUrls.thumbnailUrl,
      ogImageUrl: thumbnailUrls.ogImageUrl,
      qa_marker: qaMarker,
    },
  }
}

export function buildGrowthVideoPublicPageUrl(slug: string, origin?: string): string {
  const path = buildGrowthVideoPublicPath(slug)
  if (origin?.trim()) return `${origin.replace(/\/$/, "")}${path}`
  return path
}

export function parseGrowthVideoPublicRenderContext(
  searchParams: Record<string, string | string[] | undefined>,
): GrowthVideoPublicRenderContext {
  function pick(key: string): string | null {
    const value = searchParams[key]
    if (typeof value === "string") return asTrimmed(value)
    if (Array.isArray(value)) return asTrimmed(value[0])
    return null
  }

  return {
    leadId: pick("lead_id"),
    companyCandidateId: pick("company_candidate_id"),
    personCandidateId: pick("person_candidate_id"),
    personalizationProfileId: pick("personalization_profile_id"),
    enrollmentCandidateId: pick("enrollment_candidate_id"),
    sequenceCandidateId: pick("sequence_candidate_id"),
  }
}
