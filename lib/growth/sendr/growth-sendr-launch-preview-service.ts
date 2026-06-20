import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_AUDIENCE_LIMITS } from "@/lib/growth/audiences/growth-audience-config"
import { classifyAudienceMemberEnrollmentReadiness } from "@/lib/growth/audiences/growth-audience-enrollment-readiness"
import { getGrowthAudience, listGrowthAudienceMembers } from "@/lib/growth/audiences/growth-audience-repository"
import {
  GROWTH_SENDR_LAUNCH_QA_MARKER,
  GROWTH_SENDR_LIMITS,
  GROWTH_SENDR_PAGE_URL_MERGE_TOKEN,
} from "@/lib/growth/sendr/growth-sendr-config"
import { buildSendrEnrollmentPageAttachment } from "@/lib/growth/sendr/growth-sendr-audience-enrollment-bridge-service"
import { consumeSendrBudget, checkSendrKillSwitch } from "@/lib/growth/sendr/growth-sendr-guardrails"
import { getGrowthSendrLandingPage } from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import { previewSendrPersonalization } from "@/lib/growth/sendr/growth-sendr-personalization-preview-service"
import type { GrowthSendrLaunchPreviewResult } from "@/lib/growth/sendr/growth-sendr-types"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export async function computeSendrLaunchPreview(
  admin: SupabaseClient,
  input: {
    organizationId: string
    audienceId: string
    sequencePatternId: string
    landingPageId: string
  },
): Promise<GrowthSendrLaunchPreviewResult> {
  const previewSwitch = await isRuntimeKillSwitchEnabled(admin, "sendr_launch_preview_enabled")
  if (!previewSwitch) throw new Error("sendr_launch_preview_disabled")

  const kill = await checkSendrKillSwitch(admin, "sendr_launch_previews")
  if (!kill.allowed) throw new Error(kill.reason ?? "sendr_launch_preview_disabled")

  const budget = await consumeSendrBudget(admin, {
    organizationId: input.organizationId,
    resourceType: "sendr_launch_previews",
  })
  if (!budget.allowed) throw new Error(budget.reason ?? "sendr_launch_preview_budget_exceeded")

  const audience = await getGrowthAudience(admin, input.audienceId)
  if (!audience || audience.organizationId !== input.organizationId) {
    throw new Error("audience_not_found")
  }
  if (!audience.lastSnapshotId) throw new Error("audience_snapshot_required")

  const page = await getGrowthSendrLandingPage(admin, input.landingPageId)
  if (!page || page.organizationId !== input.organizationId || page.status !== "published") {
    throw new Error("landing_page_not_published")
  }

  const cap = Math.min(
    GROWTH_SENDR_LIMITS.MAX_SENDR_PREVIEW_MEMBERS,
    GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_PREVIEW_MEMBERS,
  )
  const batchSize = GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_PREVIEW_BATCH

  let offset = 0
  let memberCount = 0
  let eligibleCount = 0
  let alreadyEnrolledCount = 0
  let missingLeadCount = 0
  let suppressedCount = 0
  let blockedCount = 0
  let rowsRead = 0
  let sampleLeadId: string | null = null

  while (memberCount < cap) {
    const { items } = await listGrowthAudienceMembers(admin, {
      snapshotId: audience.lastSnapshotId,
      limit: batchSize,
      offset,
    })
    if (items.length === 0) break
    rowsRead += items.length + 1

    for (const member of items) {
      if (memberCount >= cap) break
      memberCount += 1
      rowsRead += 3
      const classification = await classifyAudienceMemberEnrollmentReadiness(admin, {
        member,
        sequencePatternId: input.sequencePatternId,
      })
      switch (classification.category) {
        case "eligible":
          eligibleCount += 1
          if (!sampleLeadId && classification.leadId) sampleLeadId = classification.leadId
          break
        case "already_enrolled":
          alreadyEnrolledCount += 1
          break
        case "missing_contact":
          missingLeadCount += 1
          break
        case "suppressed":
          suppressedCount += 1
          break
        case "blocked_by_limits":
          blockedCount += 1
          break
        default:
          break
      }
    }

    offset += items.length
    if (items.length < batchSize) break
  }

  const attachment = await buildSendrEnrollmentPageAttachment(admin, input.landingPageId, {
    leadId: sampleLeadId,
  })
  const sendrPageUrl = attachment?.publicUrl ?? null

  const personalization = await previewSendrPersonalization(admin, {
    leadId: sampleLeadId,
    variableMap: page.variableMap,
    sampleTemplates: {
      sequence: `Hi {{first_name}}, view your page: ${GROWTH_SENDR_PAGE_URL_MERGE_TOKEN}`,
    },
  })

  const sampleVariables: Record<string, string> = {
    ...personalization.resolved,
    sendr_page_url: sendrPageUrl ?? GROWTH_SENDR_PAGE_URL_MERGE_TOKEN,
  }

  return {
    memberCount,
    eligibleCount,
    alreadyEnrolledCount,
    missingLeadCount,
    suppressedCount,
    blockedCount,
    sendrPageUrl,
    sampleVariables,
    estimatedReads: rowsRead,
    estimatedWrites: 0,
  }
}

export { GROWTH_SENDR_LAUNCH_QA_MARKER }
