/** Growth Engine F2 — Video page draft builder (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import type {
  GrowthVideoAutopilotDraftBuildInput,
  GrowthVideoAutopilotPageDraft,
} from "@/lib/growth/videos/growth-video-autopilot-draft-types"
import { GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER } from "@/lib/growth/videos/growth-video-autopilot-draft-types"
import type { GrowthVideoAutopilotRecommendation } from "@/lib/growth/videos/growth-video-autopilot-types"
import { slugFromGrowthVideoPageTitle } from "@/lib/growth/videos/growth-video-page-validation"

export async function buildGrowthVideoAutopilotPageDraft(
  admin: SupabaseClient,
  input: {
    build: GrowthVideoAutopilotDraftBuildInput
    recommendation: GrowthVideoAutopilotRecommendation
  },
): Promise<GrowthVideoAutopilotPageDraft> {
  const title =
    `${input.recommendation.inputSnapshot.contactName ?? "Prospect"} — ${input.recommendation.videoType.replace(/_/g, " ")}`.slice(
      0,
      240,
    )
  const slug = slugFromGrowthVideoPageTitle(title)
  const metadata = {
    qa_marker: GROWTH_VIDEO_AUTOPILOT_DRAFT_QA_MARKER,
    recommendation_id: input.recommendation.id,
    lead_id: input.recommendation.leadId,
    autopilot_draft: true,
    published: false,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }

  if (!input.build.videoAssetId) {
    return {
      videoPageId: null,
      videoAssetId: null,
      slug,
      title,
      description: input.recommendation.recommended.followUpSummary,
      status: "draft",
      ctaLabel: input.recommendation.recommended.ctaLabel,
      ctaUrl: input.recommendation.recommended.ctaUrl,
      calendarUrl: input.recommendation.recommended.calendarUrl,
      published: false,
      metadata,
    }
  }

  const pageService = new GrowthVideoPageService(admin)
  const page = await pageService.createPage({
    organizationId: input.build.organizationId,
    createdBy: input.build.createdBy ?? null,
    videoAssetId: input.build.videoAssetId,
    slug,
    title,
    description: input.recommendation.recommended.followUpSummary,
    ctaLabel: input.recommendation.recommended.ctaLabel,
    ctaUrl: input.recommendation.recommended.ctaUrl,
    calendarUrl: input.recommendation.recommended.calendarUrl,
    personalization: {
      previewContext: {
        first_name: input.recommendation.inputSnapshot.contactName?.split(/\s+/)[0] ?? "",
        company: input.recommendation.inputSnapshot.companyName ?? "",
        industry: input.recommendation.inputSnapshot.industry ?? "",
      },
    },
  })

  await pageService.updatePage({
    organizationId: input.build.organizationId,
    pageId: page.id,
    patch: {
      metadata: {
        ...page.metadata,
        ...metadata,
        growth_video_scripts_b4: {
          current_version_id: null,
          versions: [],
          aiPayload: {
            script: input.recommendation.recommended.script,
            source: "growth_video_autopilot_f2",
          },
          requires_human_review: true,
          autonomous_execution_enabled: false,
        },
      },
    },
  })

  void (async () => {
    try {
      const { bindGrowthObjectiveResource } = await import(
        "@/lib/growth/objectives/growth-objective-resource-binding"
      )
      await bindGrowthObjectiveResource(admin, {
        organizationId: input.build.organizationId,
        resourceType: "video_page",
        resourceId: page.id,
        label: page.title,
      })
    } catch {
      // Best-effort objective resource binding.
    }
  })()

  return {
    videoPageId: page.id,
    videoAssetId: page.videoAssetId,
    slug: page.slug,
    title: page.title,
    description: page.description,
    status: "draft",
    ctaLabel: page.ctaLabel,
    ctaUrl: page.ctaUrl,
    calendarUrl: page.calendarUrl,
    published: false,
    metadata,
  }
}
