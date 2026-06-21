import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { runAiTask } from "@/lib/ai/router"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import { buildIndustryContextPromptBlock } from "@/lib/growth/playbooks/growth-industry-context-prompts"
import type { GrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context-types"
import {
  buildGrowthReasoningDiagnosticsFromIndustryInput,
} from "@/lib/growth/reasoning/growth-reasoning-engine"
import { buildGrowthNarrativeBriefPromptBlock } from "@/lib/growth/reasoning/growth-reasoning-diagnostics"
import { buildGrowthSequenceIntelligenceFromIndustryInput } from "@/lib/growth/sequence-intelligence/growth-sequence-engine"
import { buildGrowthSequenceGuidancePromptBlock } from "@/lib/growth/sequence-intelligence/growth-sequence-diagnostics"
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
import { getSharePageQuickTemplate } from "@/lib/growth/share-pages/share-page-types"
import {
  GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER,
  type GrowthSharePageApproveResponse,
  type GrowthSharePageCreateResponse,
  type GrowthSharePageListItem,
  type GrowthSharePageOperatorDetail,
  type GrowthSharePagePreviewResponse,
} from "@/lib/growth/share-pages/share-page-operator-types"

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
    sequenceEnrollmentStepId: input.body.sequence_enrollment_step_id ?? null,
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
    theme: input.body.theme,
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
    theme: input.body.theme,
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

export const GROWTH_SHARE_PAGE_AI_GENERATION_QA_MARKER = "growth-share-page-ai-generation-gs-share-7b-v1" as const

export type SharePageAiGenerationInput = {
  targetCompany?: string
  targetPerson?: string
  industry?: string
  pageObjective?: string
  painPoints?: string
  desiredCta?: string
  tone?: string
  templateId?: string
  verifiedFacts?: string[]
  industryContext?: GrowthIndustryContext | null
}

export type SharePageAiDraft = {
  headline: string
  heroMessage: string
  whyReachingOut: string
  companyObservations: string[]
  ctaLabel: string
  resources: Array<{ id: string; title: string; kind: "link"; url: string }>
  provider: "ai" | "template_fallback"
  message?: string
  qaMarker: typeof GROWTH_SHARE_PAGE_AI_GENERATION_QA_MARKER
}

const aiDraftSchema = z.object({
  headline: z.string().min(1),
  heroMessage: z.string().min(1),
  whyReachingOut: z.string().min(1),
  benefits: z.array(z.string()).default([]),
  faq: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .default([]),
  ctaLabel: z.string().min(1),
  testimonialQuote: z.string().optional(),
})

function buildFallbackDraft(input: SharePageAiGenerationInput): SharePageAiDraft {
  const template = getSharePageQuickTemplate(input.templateId ?? "general_field_service")
  const base = template ?? getSharePageQuickTemplate("general_field_service")!
  const company = input.targetCompany?.trim() || "{{company.name}}"
  const person = input.targetPerson?.trim() || "{{lead.first_name}}"

  const interpolate = (text: string) =>
    text.replace(/\{\{\s*company\.name\s*\}\}/gi, company).replace(/\{\{\s*lead\.first_name\s*\}\}/gi, person)

  let whyReachingOut = interpolate(base.whyReachingOut)
  if (input.painPoints?.trim()) {
    whyReachingOut = `${whyReachingOut}\n\n${input.painPoints.trim()}`
  }

  return {
    headline: interpolate(base.headline),
    heroMessage: interpolate(base.heroMessage),
    whyReachingOut,
    companyObservations: base.companyObservations,
    ctaLabel: input.desiredCta?.trim() || base.ctaLabel,
    resources: input.pageObjective?.trim()
      ? [{ id: "resource-1", title: input.pageObjective.trim(), kind: "link", url: "#" }]
      : [],
    provider: "template_fallback",
    message: "AI provider unavailable — applied a structured template draft for your review.",
    qaMarker: GROWTH_SHARE_PAGE_AI_GENERATION_QA_MARKER,
  }
}

function resolveShareIndustryContext(input: SharePageAiGenerationInput): GrowthIndustryContext {
  const base = input.industryContext
    ? input.industryContext
    : buildGrowthIndustryContext({
        companyName: input.targetCompany,
        industryLabel: input.industry,
        verifiedFacts: input.verifiedFacts ?? [],
      })
  const sequenceIntelligenceContext = buildGrowthSequenceIntelligenceFromIndustryInput({
    priorTouchCount: 0,
    priorOutboundSubjects: input.verifiedFacts,
    researchPainPoints: input.painPoints?.split(/[;\n]/).map((entry) => entry.trim()).filter(Boolean),
    industryContext: base,
  })
  const reasoningDiagnostics = buildGrowthReasoningDiagnosticsFromIndustryInput({
    channel: "SHARE_PAGE",
    industryContext: base,
    companyName: input.targetCompany,
    contactName: input.targetPerson,
    verifiedFacts: input.verifiedFacts,
    researchPainPoints: input.painPoints?.split(/[;\n]/).map((entry) => entry.trim()).filter(Boolean),
  })
  return {
    ...base,
    sequenceIntelligenceContext,
    reasoningContext: { channel: "SHARE_PAGE", diagnostics: reasoningDiagnostics },
  }
}

export async function generateSharePageDraft(input: SharePageAiGenerationInput): Promise<SharePageAiDraft> {
  const orgId = getGrowthEngineAiOrgId()
  if (!orgId) {
    return buildFallbackDraft(input)
  }

  const industryContext = resolveShareIndustryContext(input)
  const industryPrompt = buildIndustryContextPromptBlock(industryContext, "page")
  const reasoningPrompt = industryContext.reasoningContext?.diagnostics
    ? buildGrowthNarrativeBriefPromptBlock(
        industryContext.reasoningContext.diagnostics.narrativeBrief,
        industryContext.reasoningContext.diagnostics.messagePlan,
      )
    : ""
  const sequencePrompt = industryContext.sequenceIntelligenceContext?.diagnostics.guidance
    ? buildGrowthSequenceGuidancePromptBlock(industryContext.sequenceIntelligenceContext.diagnostics.guidance)
    : ""

  const userPrompt = [
    "Generate a personalized share page draft for a B2B field service prospect.",
    `Company: ${input.targetCompany ?? "the prospect company"}`,
    `Contact: ${input.targetPerson ?? "the prospect"}`,
    `Industry: ${input.industry ?? industryContext.playbook?.displayName ?? "field service"}`,
    industryPrompt,
    reasoningPrompt,
    sequencePrompt,
    `Page objective: ${input.pageObjective ?? "book a demo"}`,
    `Desired CTA: ${input.desiredCta ?? industryContext.recommendedCtas[0] ?? "Schedule Demo"}`,
    `Tone: ${input.tone ?? "professional, concise, helpful"}`,
    "Return JSON with headline, heroMessage, whyReachingOut, benefits (array of strings), faq (array of {question, answer}), ctaLabel, optional testimonialQuote.",
    "Structure: headline, intro, why reaching out, benefits, CTA, follow-up tone — industry-aware, not generic templates.",
    "Do not invent specific ROI numbers. Do not claim the prospect is already a customer.",
    "Do not claim company-specific pain unless listed under verified company facts.",
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const result = await runAiTask({
      task: "growth_ai_personalization",
      organizationId: orgId,
      input: {
        system:
          "You draft operator-reviewed share page copy. Return JSON only. No outbound sending or autonomous actions.",
        user: userPrompt,
      },
      schema: aiDraftSchema,
      taskOverrides: { structuredMode: "json_object" },
      skipPlanGateCheck: true,
      skipBudgetCheck: true,
    })

    if (!result.ok) {
      return buildFallbackDraft(input)
    }

    const data = result.output
    const observations = data.benefits.length > 0 ? data.benefits : data.faq.map((row) => row.question)

    return {
      headline: data.headline,
      heroMessage: data.heroMessage,
      whyReachingOut: data.whyReachingOut,
      companyObservations: observations.slice(0, 8),
      ctaLabel: data.ctaLabel,
      resources: data.testimonialQuote?.trim()
        ? [{ id: "testimonial", title: data.testimonialQuote.trim(), kind: "link", url: "#" }]
        : [],
      provider: "ai",
      message: "AI draft generated — review all copy before publishing.",
      qaMarker: GROWTH_SHARE_PAGE_AI_GENERATION_QA_MARKER,
    }
  } catch {
    return buildFallbackDraft(input)
  }
}
