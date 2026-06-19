import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { createGrowthVideoAnalyticsSummaryService } from "@/lib/growth/videos/growth-video-analytics-summary-service"
import { resolveGrowthVideoMergeContext } from "@/lib/growth/videos/growth-video-merge-context-service"
import { GROWTH_VIDEO_OVERLAY_B2_METADATA_KEY } from "@/lib/growth/videos/growth-video-overlay-render-service"
import { extractSequenceHooks } from "@/lib/growth/videos/growth-video-personalization-service"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import {
  buildGrowthVideoScriptPreviewPrompt,
  buildGrowthVideoScriptSystemPrompt,
  buildGrowthVideoScriptUserPrompt,
  growthVideoScriptModelSchema,
  mapGrowthVideoScriptModelOutput,
  normalizeGrowthVideoScriptGenerationInput,
} from "@/lib/growth/videos/growth-video-script-prompt-service"
import {
  buildDeterministicGrowthVideoScript,
  buildGrowthVideoScriptAiPayload,
  previewGrowthVideoScriptContext,
} from "@/lib/growth/videos/growth-video-script-preview-service"
import {
  appendGrowthVideoScriptVersion,
  getCurrentGrowthVideoScriptVersion,
  GROWTH_VIDEO_SCRIPT_B4_METADATA_KEY,
  parseGrowthVideoScriptMetadata,
  patchGrowthVideoScriptMetadata,
} from "@/lib/growth/videos/growth-video-script-version-service"
import type {
  GrowthVideoPage,
  GrowthVideoScriptAiPayload,
  GrowthVideoScriptB4Metadata,
  GrowthVideoScriptGeneratedOutput,
  GrowthVideoScriptGenerationInput,
  GrowthVideoScriptPreviewContext,
  GrowthVideoScriptVersion,
} from "@/lib/growth/videos/growth-video-types"

export { GROWTH_VIDEO_SCRIPT_B4_METADATA_KEY }

function extractOverlayHints(metadata: Record<string, unknown>): string[] {
  const raw = metadata[GROWTH_VIDEO_OVERLAY_B2_METADATA_KEY]
  if (!raw || typeof raw !== "object") return []
  const row = raw as Record<string, unknown>
  if (!Array.isArray(row.items)) return []
  return row.items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => (typeof item.textTemplate === "string" ? item.textTemplate.trim() : ""))
    .filter(Boolean)
    .slice(0, 5)
}

function extractThumbnailHints(metadata: Record<string, unknown>): string[] {
  const raw = metadata.growth_video_thumbnails_b3
  if (!raw || typeof raw !== "object") return []
  const row = raw as Record<string, unknown>
  const layout = row.layout
  if (!layout || typeof layout !== "object") return []
  const layoutRow = layout as Record<string, unknown>
  return [
    typeof layoutRow.headline === "string" ? layoutRow.headline : "",
    typeof layoutRow.subheadline === "string" ? layoutRow.subheadline : "",
    typeof layoutRow.badge === "string" ? layoutRow.badge : "",
  ].filter(Boolean)
}

async function loadEngagementSummary(
  admin: SupabaseClient,
  input: { organizationId: string; pageId: string },
): Promise<string | null> {
  try {
    const analytics = createGrowthVideoAnalyticsSummaryService(admin)
    const summaries = await analytics.listSummaries({
      organizationId: input.organizationId,
      videoPageId: input.pageId,
      limit: 5,
    })
    if (summaries.length === 0) return null
    const top = summaries.sort((a, b) => b.engagementScore - a.engagementScore)[0]!
    return `Video engagement score ${top.engagementScore}: ${top.totalViews} views, ${Math.round(top.highestPercentWatched)}% max watch, ${top.totalCtaClicks} CTA clicks.`
  } catch {
    return null
  }
}

async function resolveScriptContext(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generationInput: GrowthVideoScriptGenerationInput
    page?: GrowthVideoPage | null
  },
): Promise<{
  page: GrowthVideoPage | null
  mergeVariables: Record<string, string>
  sourcesUsed: string[]
  previewContext: GrowthVideoScriptPreviewContext
}> {
  const normalized = normalizeGrowthVideoScriptGenerationInput(input.generationInput)
  let page = input.page ?? null

  if (!page && normalized.videoPageId) {
    const pageService = createGrowthVideoPageService(admin)
    page = await pageService.getPageById({
      organizationId: input.organizationId,
      pageId: normalized.videoPageId,
    })
  }

  const hooks = extractSequenceHooks(page?.metadata)
  const mergeContext = await resolveGrowthVideoMergeContext({
    admin,
    organizationId: input.organizationId,
    leadId: normalized.leadId ?? hooks.lead_id,
    companyCandidateId: normalized.companyCandidateId ?? hooks.company_candidate_id,
    personCandidateId: normalized.personCandidateId ?? hooks.person_candidate_id,
    personalizationProfileId: normalized.personalizationProfileId,
    pagePersonalization: page?.personalization ?? null,
    pageFields: {
      ctaUrl: page?.ctaUrl ?? null,
      calendarUrl: page?.calendarUrl ?? null,
    },
  })

  const engagementSummary = page
    ? await loadEngagementSummary(admin, {
        organizationId: input.organizationId,
        pageId: page.id,
      })
    : null

  const overlayHints = page ? extractOverlayHints(page.metadata) : []
  const thumbnailHints = page ? extractThumbnailHints(page.metadata) : []

  const previewContext: GrowthVideoScriptPreviewContext = {
    promptPreview: "",
    mergeVariables: mergeContext.variables,
    sourcesUsed: mergeContext.sourcesUsed,
    engagementSummary,
    overlayHints,
    thumbnailHints,
  }

  previewContext.promptPreview = buildGrowthVideoScriptPreviewPrompt({
    generationInput: normalized,
    previewContext,
  })

  return {
    page,
    mergeVariables: mergeContext.variables,
    sourcesUsed: mergeContext.sourcesUsed,
    previewContext,
  }
}

async function generateWithAi(input: {
  organizationId: string
  generationInput: GrowthVideoScriptGenerationInput
  previewContext: GrowthVideoScriptPreviewContext
  page?: GrowthVideoPage | null
}): Promise<{
  output: GrowthVideoScriptGeneratedOutput
  provider: string
  model: string | null
} | null> {
  const aiOrgId = getGrowthEngineAiOrgId()
  if (!aiOrgId) return null

  const normalized = normalizeGrowthVideoScriptGenerationInput(input.generationInput)

  try {
    const result = await runAiTask({
      task: "growth_video_script_generation",
      organizationId: aiOrgId,
      input: {
        system: buildGrowthVideoScriptSystemPrompt(),
        user: buildGrowthVideoScriptUserPrompt({
          generationInput: normalized,
          previewContext: input.previewContext,
          pageTitle: input.page?.title ?? null,
          pageDescription: input.page?.description ?? null,
        }),
      },
      schema: growthVideoScriptModelSchema,
      cacheSchemaVersion: "growth_video_script_generation_v1",
      skipPlanGateCheck: true,
      skipBudgetCheck: true,
      forceLiveAi: true,
      taskOverrides: { structuredMode: "json_object" },
    })

    if (!result.ok) return null

    return {
      output: mapGrowthVideoScriptModelOutput(result.output, [
        ...input.previewContext.sourcesUsed,
        "growth_video_script_generation",
        result.meta.provider,
      ]),
      provider: result.meta.provider,
      model: result.meta.model,
    }
  } catch {
    return null
  }
}

export async function previewGrowthVideoScriptGeneration(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generationInput: GrowthVideoScriptGenerationInput
    page?: GrowthVideoPage | null
  },
): Promise<{
  previewContext: GrowthVideoScriptPreviewContext
  fallbackScript: GrowthVideoScriptGeneratedOutput
  aiPayload: GrowthVideoScriptAiPayload
}> {
  const context = await resolveScriptContext(admin, input)
  const normalized = normalizeGrowthVideoScriptGenerationInput(input.generationInput)

  return previewGrowthVideoScriptContext({
    generationInput: normalized,
    mergeVariables: context.mergeVariables,
    sourcesUsed: context.sourcesUsed,
    engagementSummary: context.previewContext.engagementSummary,
    overlayHints: context.previewContext.overlayHints,
    thumbnailHints: context.previewContext.thumbnailHints,
  })
}

export async function generateGrowthVideoScript(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generationInput: GrowthVideoScriptGenerationInput
    persist?: boolean
  },
): Promise<{
  output: GrowthVideoScriptGeneratedOutput
  aiPayload: GrowthVideoScriptAiPayload
  provider: string
  model: string | null
  version: GrowthVideoScriptVersion | null
  metadata: GrowthVideoScriptB4Metadata | null
}> {
  const normalized = normalizeGrowthVideoScriptGenerationInput(input.generationInput)
  const context = await resolveScriptContext(admin, {
    organizationId: input.organizationId,
    generationInput: normalized,
  })

  const aiResult = await generateWithAi({
    organizationId: input.organizationId,
    generationInput: normalized,
    previewContext: context.previewContext,
    page: context.page,
  })

  const output =
    aiResult?.output ??
    buildDeterministicGrowthVideoScript({
      generationInput: normalized,
      mergeVariables: context.mergeVariables,
      sourcesUsed: context.sourcesUsed,
    })

  const aiPayload = buildGrowthVideoScriptAiPayload({
    generationInput: normalized,
    previewContext: context.previewContext,
    generatedScript: output,
  })

  if (!input.persist || !context.page) {
    return {
      output,
      aiPayload,
      provider: aiResult?.provider ?? "deterministic_fallback",
      model: aiResult?.model ?? null,
      version: null,
      metadata: null,
    }
  }

  const existing = parseGrowthVideoScriptMetadata(context.page.metadata)
  const nextMetadata = appendGrowthVideoScriptVersion({
    existing,
    generationInput: normalized,
    output,
    aiPayload,
    provider: aiResult?.provider ?? "deterministic_fallback",
    model: aiResult?.model ?? null,
  })

  const pageService = createGrowthVideoPageService(admin)
  await pageService.updatePage({
    organizationId: input.organizationId,
    pageId: context.page.id,
    patch: {
      metadata: {
        [GROWTH_VIDEO_SCRIPT_B4_METADATA_KEY]: nextMetadata,
      },
    },
  })

  const version = getCurrentGrowthVideoScriptVersion(nextMetadata)

  return {
    output,
    aiPayload,
    provider: aiResult?.provider ?? "deterministic_fallback",
    model: aiResult?.model ?? null,
    version,
    metadata: nextMetadata,
  }
}

export async function getGrowthVideoPageScriptState(
  admin: SupabaseClient,
  input: { organizationId: string; pageId: string },
): Promise<{
  page: GrowthVideoPage
  metadata: GrowthVideoScriptB4Metadata
  currentVersion: GrowthVideoScriptVersion | null
}> {
  const pageService = createGrowthVideoPageService(admin)
  const page = await pageService.getPageById(input)
  if (!page) throw new Error("not_found")

  const metadata = parseGrowthVideoScriptMetadata(page.metadata)
  return {
    page,
    metadata,
    currentVersion: getCurrentGrowthVideoScriptVersion(metadata),
  }
}

export async function patchGrowthVideoPageScripts(
  admin: SupabaseClient,
  input: {
    organizationId: string
    pageId: string
    currentVersionId?: string | null
    aiPayload?: GrowthVideoScriptAiPayload | null
  },
): Promise<{
  page: GrowthVideoPage
  metadata: GrowthVideoScriptB4Metadata
  currentVersion: GrowthVideoScriptVersion | null
}> {
  const pageService = createGrowthVideoPageService(admin)
  const page = await pageService.getPageById({
    organizationId: input.organizationId,
    pageId: input.pageId,
  })
  if (!page) throw new Error("not_found")

  const existing = parseGrowthVideoScriptMetadata(page.metadata)
  const nextMetadata = patchGrowthVideoScriptMetadata({
    existing,
    currentVersionId: input.currentVersionId,
    aiPayload: input.aiPayload,
  })

  const updated = await pageService.updatePage({
    organizationId: input.organizationId,
    pageId: input.pageId,
    patch: {
      metadata: {
        [GROWTH_VIDEO_SCRIPT_B4_METADATA_KEY]: nextMetadata,
      },
    },
  })

  return {
    page: updated,
    metadata: nextMetadata,
    currentVersion: getCurrentGrowthVideoScriptVersion(nextMetadata),
  }
}
