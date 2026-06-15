import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildGrowthSharePageContext } from "@/lib/growth/share-pages/share-page-context-service"
import type { growthSharePageCreateSchema, growthSharePagePatchSchema } from "@/lib/growth/share-pages/share-page-api-schema"
import {
  approveSharePage,
  archiveSharePage,
  createSharePage,
  fetchGrowthSharePageById,
  getSharePageAnalyticsSummary,
  listGrowthSharePagesForOrganization,
  listSharePageEventsForPage,
  regenerateSharePagePreviewToken,
  revokeSharePage,
  searchSharePageLeadIds,
  updateSharePage,
} from "@/lib/growth/share-pages/share-page-repository"
import {
  buildSharePagePreviewUrl,
  buildSharePagePublicUrl,
} from "@/lib/growth/share-pages/share-page-token"
import type {
  GrowthSharePage,
  GrowthSharePageCTA,
  GrowthSharePagePersonalizationContext,
  GrowthSharePageResource,
  GrowthSharePageSourceChannel,
  GrowthSharePageStatus,
} from "@/lib/growth/share-pages/share-page-types"
import {
  GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER,
  type GrowthSharePageApproveResponse,
  type GrowthSharePageCreateResponse,
  type GrowthSharePageListItem,
  type GrowthSharePageOperatorDetail,
  type GrowthSharePagePreviewResponse,
} from "@/lib/growth/share-pages/share-page-operator-types"
import type { z } from "zod"

type CreateBody = z.infer<typeof growthSharePageCreateSchema>
type PatchBody = z.infer<typeof growthSharePagePatchSchema>

function leadLabel(contactName: string | null | undefined, companyName: string): string {
  const contact = contactName?.trim()
  if (contact && companyName) return `${contact} · ${companyName}`
  return contact || companyName || "Unknown lead"
}

async function resolveLeadLabels(
  admin: SupabaseClient,
  leadId: string,
): Promise<{ leadLabel: string; companyName: string; contactName: string | null }> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  const companyName = lead?.companyName?.trim() || "Unknown company"
  const contactName = lead?.contactName?.trim() || null
  return {
    leadLabel: leadLabel(contactName, companyName),
    companyName,
    contactName,
  }
}

function mapListItem(page: GrowthSharePage, labels: { leadLabel: string; companyName: string }): GrowthSharePageListItem {
  return {
    id: page.id,
    organizationId: page.organizationId,
    leadId: page.leadId,
    leadLabel: labels.leadLabel,
    companyName: labels.companyName,
    status: page.status,
    sourceChannel: page.sourceChannel,
    tokenPrefix: page.tokenPrefix,
    viewCount: page.engagementSummary.viewCount,
    ctaClickCount: page.engagementSummary.ctaClickCount,
    bookingCompletedCount: page.engagementSummary.bookingCompletedCount,
    lastViewedAt: page.lastViewedAt,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    requiresHumanReview: true,
  }
}

function assertNoTokenHashes(payload: unknown, path = "root"): void {
  if (!payload || typeof payload !== "object") return
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const nextPath = `${path}.${key}`
    if (/token_hash|preview_token_hash/i.test(key)) {
      throw new Error(`token_hash_leak:${nextPath}`)
    }
    if (value && typeof value === "object") assertNoTokenHashes(value, nextPath)
  }
}

export async function listSharePagesForOperator(
  admin: SupabaseClient,
  input: {
    organizationId: string
    status?: GrowthSharePageStatus
    sourceChannel?: GrowthSharePageSourceChannel
    search?: string
    limit?: number
    offset?: number
  },
): Promise<{ items: GrowthSharePageListItem[]; total: number; qaMarker: typeof GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER }> {
  let leadIds: string[] | null = null
  if (input.search?.trim()) {
    leadIds = await searchSharePageLeadIds(admin, input.search)
    if (leadIds.length === 0) {
      return { items: [], total: 0, qaMarker: GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER }
    }
  }

  const { pages, total } = await listGrowthSharePagesForOrganization(admin, {
    organizationId: input.organizationId,
    status: input.status,
    sourceChannel: input.sourceChannel,
    leadIds,
    limit: input.limit,
    offset: input.offset,
  })

  const labelCache = new Map<string, { leadLabel: string; companyName: string }>()
  const items: GrowthSharePageListItem[] = []
  for (const page of pages) {
    let labels = labelCache.get(page.leadId)
    if (!labels) {
      const resolved = await resolveLeadLabels(admin, page.leadId)
      labels = { leadLabel: resolved.leadLabel, companyName: resolved.companyName }
      labelCache.set(page.leadId, labels)
    }
    items.push(mapListItem(page, labels))
  }

  return { items, total, qaMarker: GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER }
}

export async function getSharePageDetailForOperator(
  admin: SupabaseClient,
  input: { sharePageId: string; organizationId: string; origin: string },
): Promise<GrowthSharePageOperatorDetail | null> {
  const page = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!page || page.organizationId !== input.organizationId) return null

  const [labels, analytics, recentEvents] = await Promise.all([
    resolveLeadLabels(admin, page.leadId),
    getSharePageAnalyticsSummary(admin, page.id).catch(() => null),
    listSharePageEventsForPage(admin, page.id, 40),
  ])

  const detail: GrowthSharePageOperatorDetail = {
    page,
    leadLabel: labels.leadLabel,
    companyName: labels.companyName,
    contactName: labels.contactName,
    analytics,
    recentEvents,
    previewPath: "/p-preview/{token}",
    publicPath: page.status === "published" ? "/p/{token}" : null,
    tokenPrefix: page.tokenPrefix,
    bookingPageId: page.bookingPageId,
    personalizationSnapshot: page.personalizationSnapshot as GrowthSharePagePersonalizationContext | Record<string, unknown>,
    engagementSummary: page.engagementSummary,
    requiresHumanReview: true,
    autonomousExecutionEnabled: false,
    outreachExecution: false,
    enrollmentExecution: false,
    qaMarker: GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER,
  }

  assertNoTokenHashes(detail)
  return detail
}

export async function createSharePageForOperator(
  admin: SupabaseClient,
  input: {
    organizationId: string
    createdBy: string | null
    body: CreateBody
    origin: string
  },
): Promise<GrowthSharePageCreateResponse> {
  const lead = await fetchGrowthLeadById(admin, input.body.lead_id)
  if (!lead) throw new Error("lead_not_found")

  let context: GrowthSharePagePersonalizationContext | null = null
  const shouldBuildContext = input.body.build_context !== false
  if (shouldBuildContext) {
    context = await buildGrowthSharePageContext(admin, {
      leadId: input.body.lead_id,
      companyId: input.body.company_id ?? null,
      campaignId: input.body.campaign_id ?? null,
      enrollmentId: input.body.enrollment_id ?? null,
      bookingPageId: input.body.booking_page_id ?? null,
    })
  }

  const ctaConfig: GrowthSharePageCTA[] =
    input.body.cta_config ??
    (context?.suggestedCta ? [context.suggestedCta] : [])

  const resources: GrowthSharePageResource[] = input.body.resources ?? context?.resources ?? []

  const created = await createSharePage(admin, {
    organizationId: input.organizationId,
    leadId: input.body.lead_id,
    companyId: input.body.company_id ?? null,
    campaignId: input.body.campaign_id ?? null,
    enrollmentId: input.body.enrollment_id ?? null,
    sequenceStepId: input.body.sequence_step_id ?? null,
    sequenceExecutionJobId: input.body.sequence_execution_job_id ?? null,
    sourceChannel: input.body.source_channel ?? "manual",
    status: "pending_review",
    headline: input.body.headline ?? context?.headline ?? "",
    subheadline: input.body.subheadline ?? null,
    heroMessage: input.body.hero_message ?? context?.personalizedMessage ?? "",
    whyReachingOut: input.body.why_reaching_out ?? context?.whyReachingOut ?? null,
    companyObservations: input.body.company_observations ?? context?.companyObservations ?? [],
    ctaConfig,
    resources,
    bookingPageId: input.body.booking_page_id ?? null,
    personalizationSnapshot: context ?? {},
    personalizationContextVersion: 1,
    sourcesUsed: context?.sourcesUsed ?? [],
    evidenceCoverageScore: context?.evidenceCoverageScore ?? null,
    createdBy: input.createdBy ?? null,
  })

  const response: GrowthSharePageCreateResponse = {
    page: created.page,
    publicToken: created.publicToken,
    previewToken: created.previewToken,
    publicUrl: buildSharePagePublicUrl(created.publicToken, input.origin),
    previewUrl: buildSharePagePreviewUrl(created.previewToken, input.origin),
    requiresHumanReview: true,
  }

  assertNoTokenHashes(response)
  return response
}

export async function patchSharePageForOperator(
  admin: SupabaseClient,
  input: { sharePageId: string; organizationId: string; body: PatchBody },
): Promise<GrowthSharePage> {
  const existing = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!existing || existing.organizationId !== input.organizationId) {
    throw new Error("share_page_not_found")
  }

  return updateSharePage(admin, input.sharePageId, {
    headline: input.body.headline,
    subheadline: input.body.subheadline,
    heroMessage: input.body.hero_message,
    whyReachingOut: input.body.why_reaching_out,
    companyObservations: input.body.company_observations,
    ctaConfig: input.body.cta_config,
    resources: input.body.resources,
    bookingPageId: input.body.booking_page_id,
    expiresAt: input.body.expires_at,
    maxViews: input.body.max_views,
    heroMediaType: input.body.hero_media_type,
    heroMediaUrl: input.body.hero_media_url,
    heroMediaThumbnailUrl: input.body.hero_media_thumbnail_url,
  })
}

export async function regenerateSharePagePreviewForOperator(
  admin: SupabaseClient,
  input: {
    sharePageId: string
    organizationId: string
    origin: string
    rebuildContext?: boolean
    leadId?: string
    companyId?: string | null
    campaignId?: string | null
    enrollmentId?: string | null
    bookingPageId?: string | null
  },
): Promise<GrowthSharePagePreviewResponse> {
  const existing = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!existing || existing.organizationId !== input.organizationId) {
    throw new Error("share_page_not_found")
  }

  let context: GrowthSharePagePersonalizationContext | undefined
  if (input.rebuildContext) {
    context = await buildGrowthSharePageContext(admin, {
      leadId: input.leadId ?? existing.leadId,
      companyId: input.companyId ?? existing.companyId,
      campaignId: input.campaignId ?? existing.campaignId,
      enrollmentId: input.enrollmentId ?? existing.enrollmentId,
      bookingPageId: input.bookingPageId ?? existing.bookingPageId,
    })

    await updateSharePage(admin, input.sharePageId, {
      headline: context.headline,
      heroMessage: context.personalizedMessage,
      whyReachingOut: context.whyReachingOut,
      companyObservations: context.companyObservations,
      resources: context.resources,
      ctaConfig: context.suggestedCta ? [context.suggestedCta] : existing.ctaConfig,
      personalizationSnapshot: context,
      sourcesUsed: context.sourcesUsed,
      evidenceCoverageScore: context.evidenceCoverageScore,
    })
  }

  const regenerated = await regenerateSharePagePreviewToken(admin, input.sharePageId)
  const response: GrowthSharePagePreviewResponse = {
    page: regenerated.page,
    previewToken: regenerated.previewToken,
    previewUrl: buildSharePagePreviewUrl(regenerated.previewToken, input.origin),
    context,
  }

  assertNoTokenHashes(response)
  return response
}

export async function approveSharePageForOperator(
  admin: SupabaseClient,
  input: { sharePageId: string; organizationId: string; approvedBy: string; origin: string },
): Promise<GrowthSharePageApproveResponse> {
  const existing = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!existing || existing.organizationId !== input.organizationId) {
    throw new Error("share_page_not_found")
  }

  const page = await approveSharePage(admin, input.sharePageId, { approvedBy: input.approvedBy })
  const response: GrowthSharePageApproveResponse = {
    page,
    publicUrl: null,
    message:
      "Share page published. Use the public link issued at creation (token prefix shown on detail). Raw public tokens are not stored after create.",
  }

  assertNoTokenHashes(response)
  return response
}

export async function revokeSharePageForOperator(
  admin: SupabaseClient,
  input: { sharePageId: string; organizationId: string },
): Promise<GrowthSharePage> {
  const existing = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!existing || existing.organizationId !== input.organizationId) {
    throw new Error("share_page_not_found")
  }
  return revokeSharePage(admin, input.sharePageId)
}

export async function archiveSharePageForOperator(
  admin: SupabaseClient,
  input: { sharePageId: string; organizationId: string },
): Promise<GrowthSharePage> {
  const existing = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!existing || existing.organizationId !== input.organizationId) {
    throw new Error("share_page_not_found")
  }
  return archiveSharePage(admin, input.sharePageId)
}

export function sanitizeSharePageApiPayload(payload: unknown): void {
  assertNoTokenHashes(payload)
}
