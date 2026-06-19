import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveGrowthVideoMergeContext } from "@/lib/growth/videos/growth-video-merge-context-service"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import { buildGrowthVideoBrandingPreview } from "@/lib/growth/videos/growth-video-branding-service"
import {
  buildGrowthVideoOverlayAiPayload,
  previewGrowthVideoOverlays,
} from "@/lib/growth/videos/growth-video-overlay-preview-service"
import {
  GROWTH_VIDEO_OVERLAY_B2_METADATA_KEY,
  normalizeGrowthVideoOverlayConfig,
  resolveGrowthVideoOverlayPreviewItems,
} from "@/lib/growth/videos/growth-video-overlay-render-service"
import { extractSequenceHooks } from "@/lib/growth/videos/growth-video-personalization-service"
import type {
  GrowthVideoOverlayAiPayload,
  GrowthVideoOverlayB2Config,
  GrowthVideoOverlayPreviewFormInput,
  GrowthVideoOverlayResolvedPreviewItem,
  GrowthVideoPage,
  GrowthVideoPublicOverlayItem,
} from "@/lib/growth/videos/growth-video-types"

export { GROWTH_VIDEO_OVERLAY_B2_METADATA_KEY }

function parseStoredOverlayConfig(metadata: Record<string, unknown>): GrowthVideoOverlayB2Config | null {
  const raw = metadata[GROWTH_VIDEO_OVERLAY_B2_METADATA_KEY]
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  return normalizeGrowthVideoOverlayConfig({
    enabled: row.enabled === true,
    items: Array.isArray(row.items) ? (row.items as GrowthVideoOverlayB2Config["items"]) : [],
    branding:
      row.branding && typeof row.branding === "object"
        ? (row.branding as GrowthVideoOverlayB2Config["branding"])
        : undefined,
  })
}

export async function resolveGrowthVideoOverlayMergeValues(
  admin: SupabaseClient,
  input: {
    organizationId: string
    page: GrowthVideoPage
    previewForm?: GrowthVideoOverlayPreviewFormInput
  },
): Promise<{ mergeValues: Record<string, string>; sourcesUsed: string[]; missing: string[] }> {
  const hooks = extractSequenceHooks(input.page.metadata)
  const previewFormRecord: Record<string, string> | null = input.previewForm
    ? {
        firstName: input.previewForm.firstName ?? "",
        lastName: input.previewForm.lastName ?? "",
        company: input.previewForm.company ?? "",
        industry: input.previewForm.industry ?? "",
        title: input.previewForm.title ?? "",
        senderName: input.previewForm.senderName ?? "",
        senderCompany: input.previewForm.senderCompany ?? "",
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
    missing: mergeContext.missing,
  }
}

export async function getGrowthVideoPageOverlayState(
  admin: SupabaseClient,
  input: { organizationId: string; pageId: string },
): Promise<{
  page: GrowthVideoPage
  config: GrowthVideoOverlayB2Config
  aiPayload: GrowthVideoOverlayAiPayload | null
}> {
  const pageService = createGrowthVideoPageService(admin)
  const page = await pageService.getPageById(input)
  if (!page) throw new Error("not_found")

  const stored = parseStoredOverlayConfig(page.metadata) ?? normalizeGrowthVideoOverlayConfig(null)
  const raw = page.metadata[GROWTH_VIDEO_OVERLAY_B2_METADATA_KEY] as Record<string, unknown> | undefined
  const aiPayload =
    raw?.aiPayload && typeof raw.aiPayload === "object"
      ? (raw.aiPayload as GrowthVideoOverlayAiPayload)
      : null

  return { page, config: stored, aiPayload }
}

export async function patchGrowthVideoPageOverlayConfig(
  admin: SupabaseClient,
  input: {
    organizationId: string
    pageId: string
    config: GrowthVideoOverlayB2Config
    previewForm?: GrowthVideoOverlayPreviewFormInput
  },
): Promise<{
  page: GrowthVideoPage
  config: GrowthVideoOverlayB2Config
  previewItems: GrowthVideoOverlayResolvedPreviewItem[]
  aiPayload: GrowthVideoOverlayAiPayload
}> {
  const pageService = createGrowthVideoPageService(admin)
  const page = await pageService.getPageById({
    organizationId: input.organizationId,
    pageId: input.pageId,
  })
  if (!page) throw new Error("not_found")

  const config = normalizeGrowthVideoOverlayConfig(input.config)
  const { mergeValues, sourcesUsed } = await resolveGrowthVideoOverlayMergeValues(admin, {
    organizationId: input.organizationId,
    page,
    previewForm: input.previewForm,
  })

  const brandingPreview = buildGrowthVideoBrandingPreview(page.branding, config.branding)
  const previewItems = resolveGrowthVideoOverlayPreviewItems({
    config,
    mergeValues,
    accentColor: brandingPreview.accentColor,
  })
  const aiPayload = buildGrowthVideoOverlayAiPayload({
    config,
    mergeValues,
    previewItems,
    sourcesUsed,
  })

  const updated = await pageService.updatePage({
    organizationId: input.organizationId,
    pageId: input.pageId,
    patch: {
      metadata: {
        [GROWTH_VIDEO_OVERLAY_B2_METADATA_KEY]: {
          ...config,
          aiPayload,
        },
      },
    },
  })

  return {
    page: updated,
    config,
    previewItems,
    aiPayload,
  }
}

export async function previewGrowthVideoPageOverlays(
  admin: SupabaseClient,
  input: {
    organizationId: string
    page: GrowthVideoPage | null
    config: GrowthVideoOverlayB2Config
    previewForm?: GrowthVideoOverlayPreviewFormInput
  },
) {
  let mergeValues: Record<string, string> = {}
  let sourcesUsed: string[] = ["preview_form", "growth_video_overlay_render"]
  let missing: string[] = []

  if (input.page) {
    const resolved = await resolveGrowthVideoOverlayMergeValues(admin, {
      organizationId: input.organizationId,
      page: input.page,
      previewForm: input.previewForm,
    })
    mergeValues = resolved.mergeValues
    sourcesUsed = resolved.sourcesUsed
    missing = resolved.missing
  } else if (input.previewForm) {
    const preview = previewGrowthVideoOverlays({
      config: input.config,
      pageBranding: {},
      previewForm: input.previewForm,
    })
    mergeValues = preview.mergeValues
  }

  const pageBranding = input.page?.branding ?? {}
  const result = previewGrowthVideoOverlays({
    config: input.config,
    pageBranding,
    previewForm: input.previewForm ?? {},
    sourcesUsed,
  })

  return {
    ...result,
    missingVariables: missing.length ? missing : result.aiPayload.missing_variables,
  }
}

export function resolveGrowthVideoPublicOverlays(input: {
  config: GrowthVideoOverlayB2Config | null
  mergeValues: Record<string, string>
  accentColor?: string | null
}): GrowthVideoPublicOverlayItem[] {
  const config = normalizeGrowthVideoOverlayConfig(input.config)
  if (!config.enabled) return []

  return resolveGrowthVideoOverlayPreviewItems({
    config,
    mergeValues: input.mergeValues,
    accentColor: input.accentColor,
  }).map((item) => ({
    id: item.id,
    type: item.type,
    text: item.resolvedText,
    position: item.position,
    style: item.style,
  }))
}
