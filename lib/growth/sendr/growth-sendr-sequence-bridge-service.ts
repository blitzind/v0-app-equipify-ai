import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER,
} from "@/lib/growth/sendr/growth-sendr-config"
import { applySendrPageUrlMergeFields } from "@/lib/growth/sendr/growth-sendr-config"
import { consumeSendrBudget, checkSendrKillSwitch } from "@/lib/growth/sendr/growth-sendr-guardrails"
import { getGrowthSendrLandingPage } from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import {
  createSendrSequencePageLink,
  resolveSendrLinkForSequenceStep,
} from "@/lib/growth/sendr/growth-sendr-sequence-link-repository"
import { resolveSendrExternalPageUrl } from "@/lib/growth/sendr/growth-sendr-personalized-url-service"
import type { GrowthSendrSequencePageLink } from "@/lib/growth/sendr/growth-sendr-types"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

const urlCache = new Map<string, { url: string; expiresAt: number }>()
const CACHE_TTL_MS = 60_000

function cacheKey(
  orgId: string,
  stepId: string | null,
  patternId: string | null,
  leadId?: string | null,
): string {
  return `${orgId}:${stepId ?? ""}:${patternId ?? ""}:${leadId?.trim() ?? ""}`
}

export async function attachSendrPageToSequence(
  admin: SupabaseClient,
  input: {
    organizationId: string
    landingPageId: string
    sequencePatternId: string
    sequencePatternStepId?: string | null
    enrollmentRunId?: string | null
    attachedBy?: string | null
  },
): Promise<GrowthSendrSequencePageLink> {
  const bridge = await checkSendrKillSwitch(admin, "sendr_page_links")
  if (!bridge.allowed) throw new Error(bridge.reason ?? "sendr_sequence_bridge_disabled")

  const timelineSwitch = await isRuntimeKillSwitchEnabled(admin, "sendr_sequence_bridge_enabled")
  if (!timelineSwitch) throw new Error("sendr_sequence_bridge_enabled disabled by kill switch.")

  const budget = await consumeSendrBudget(admin, {
    organizationId: input.organizationId,
    resourceType: "sendr_page_links",
  })
  if (!budget.allowed) throw new Error(budget.reason ?? "sendr_page_link_budget_exceeded")

  const page = await getGrowthSendrLandingPage(admin, input.landingPageId)
  if (!page || page.organizationId !== input.organizationId) {
    throw new Error("landing_page_not_found")
  }
  if (page.status !== "published") {
    throw new Error("landing_page_not_published")
  }

  return createSendrSequencePageLink(admin, {
    ...input,
    metadata: {
      publishedSlug: page.publishedSlug ?? page.slug,
      qa_marker: GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER,
    },
  })
}

/** Read-only cached URL resolution — no writes, no publish side effects. */
export async function resolveSendrPageUrlForSequenceStep(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sequencePatternStepId: string | null
    sequencePatternId?: string | null
    leadId?: string | null
  },
): Promise<string | null> {
  const bridge = await isRuntimeKillSwitchEnabled(admin, "sendr_sequence_bridge_enabled")
  if (!bridge) return null

  const key = cacheKey(
    input.organizationId,
    input.sequencePatternStepId,
    input.sequencePatternId ?? null,
    input.leadId,
  )
  const cached = urlCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const budget = await consumeSendrBudget(admin, {
    organizationId: input.organizationId,
    resourceType: "sendr_url_resolutions",
  })
  if (!budget.allowed) return null

  const link = await resolveSendrLinkForSequenceStep(admin, input)
  if (!link) return null

  const page = await getGrowthSendrLandingPage(admin, link.landingPageId)
  const slug = page?.publishedSlug ?? page?.slug
  if (!slug) return null

  const url = resolveSendrExternalPageUrl({
    slug,
    landingPageId: link.landingPageId,
    leadId: input.leadId,
  })
  urlCache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS })
  return url
}

export { applySendrPageUrlMergeFields } from "@/lib/growth/sendr/growth-sendr-config"

export async function resolveSendrPageUrlBatch(
  admin: SupabaseClient,
  input: {
    organizationId: string
    items: Array<{
      sequencePatternStepId: string | null
      sequencePatternId?: string | null
      leadId?: string | null
    }>
  },
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()
  const batch = input.items.slice(0, 500)
  for (const item of batch) {
    const key = cacheKey(
      input.organizationId,
      item.sequencePatternStepId,
      item.sequencePatternId ?? null,
      item.leadId,
    )
    const url = await resolveSendrPageUrlForSequenceStep(admin, {
      organizationId: input.organizationId,
      sequencePatternStepId: item.sequencePatternStepId,
      sequencePatternId: item.sequencePatternId,
      leadId: item.leadId,
    })
    results.set(key, url)
  }
  return results
}
