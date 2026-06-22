import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildSenderMergeFields } from "@/lib/growth/signatures/sender-merge-fields"
import { getSenderProfile } from "@/lib/growth/signatures/sender-profile-repository"
import {
  resolveVideoPageVoiceScript,
} from "@/lib/growth/media/growth-ai-voice-generation-service"
import type { GeV13ProspectGenerationInput, GeV13ResolvedProspectScript } from "@/lib/growth/media/ge-v1-3-types"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import {
  extractGrowthVideoMissingTokens,
  renderGrowthVideoPreviewText,
} from "@/lib/growth/videos/growth-video-preview-render-service"
import { resolveGrowthVideoMergeContext } from "@/lib/growth/videos/growth-video-merge-context-service"

function appendOperatorInstructions(script: string, instructions: string | null | undefined): string {
  const trimmed = instructions?.trim()
  if (!trimmed) return script
  return `${script.trim()}\n\n${trimmed}`
}

export async function resolvePersonalizedVideoGenerationScript(
  admin: SupabaseClient,
  input: {
    organizationId: string
    videoPageId: string
    scriptVersionId?: string | null
    prospect?: GeV13ProspectGenerationInput | null
  },
): Promise<GeV13ResolvedProspectScript> {
  const { script: rawScript, scriptVersionId, videoAssetId } = await resolveVideoPageVoiceScript(admin, {
    organizationId: input.organizationId,
    videoPageId: input.videoPageId,
    scriptVersionId: input.scriptVersionId,
  })

  const pageService = createGrowthVideoPageService(admin)
  const page = await pageService.getPageById({
    organizationId: input.organizationId,
    pageId: input.videoPageId,
  })
  if (!page) throw new Error("video_page_not_found")

  const prospect = input.prospect ?? {}
  const mergeContext = await resolveGrowthVideoMergeContext({
    admin,
    organizationId: input.organizationId,
    leadId: prospect.leadId,
    companyCandidateId: prospect.companyCandidateId,
    personCandidateId: prospect.personCandidateId,
    personalizationProfileId: prospect.personalizationProfileId,
    pagePersonalization: page.personalization,
    pageFields: {
      ctaUrl: page.ctaUrl,
      calendarUrl: page.calendarUrl,
    },
  })

  const mergeValues = { ...mergeContext.variables }

  if (prospect.senderProfileId?.trim()) {
    const profile = await getSenderProfile(admin, prospect.senderProfileId.trim())
    if (profile) {
      Object.assign(
        mergeValues,
        buildSenderMergeFields(profile, profile.email ?? "", profile.display_name, null),
      )
      mergeContext.sourcesUsed.push("sender_profile")
    }
  }

  const mergedScript = renderGrowthVideoPreviewText(rawScript, mergeValues)
  const missingFromTokens = extractGrowthVideoMissingTokens(rawScript, mergeValues)
  const missingVariables = [...new Set([...mergeContext.missing, ...missingFromTokens])]
  const finalScript = appendOperatorInstructions(mergedScript, prospect.operatorInstructions)

  return {
    rawScript,
    mergedScript: finalScript,
    scriptVersionId,
    videoAssetId,
    mergeValues,
    missingVariables,
    sourcesUsed: [...new Set(mergeContext.sourcesUsed)],
    degraded: missingVariables.length > 0,
  }
}
