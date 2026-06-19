/** Growth Engine SP-UX-2 — Share page operator workspace assembly (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import { fetchGrowthLeadById, updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import { GROWTH_NEXT_BEST_ACTION_LABELS } from "@/lib/growth/nba-types"
import { buildGrowthSharePageOperatorAnalyticsPanel } from "@/lib/growth/share-pages/growth-share-page-operator-analytics-service"
import { buildGrowthSharePageOperatorPreviewModel } from "@/lib/growth/share-pages/growth-share-page-preview-service"
import {
  buildGrowthSharePageOperatorSummaryCards,
  buildGrowthSharePageOperatorWorkspaceActions,
  emptyGrowthSharePageOperatorWorkspaceOperatorState,
} from "@/lib/growth/share-pages/growth-share-page-operator-summary-service"
import {
  GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_METADATA_KEY,
  GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER,
  type GrowthSharePageOperatorLeadContext,
  type GrowthSharePageOperatorReviewContext,
  type GrowthSharePageOperatorWorkspaceListItem,
  type GrowthSharePageOperatorWorkspaceMetadata,
  type GrowthSharePageOperatorWorkspaceOperatorState,
  type GrowthSharePageOperatorWorkspaceView,
} from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"
import { buildGrowthSharePageOperatorTimeline } from "@/lib/growth/share-pages/growth-share-page-timeline-service"
import {
  fetchGrowthSharePageById,
  getSharePageAnalyticsSummary,
  listSharePageEventsForPage,
  listGrowthSharePagesForOrganization,
} from "@/lib/growth/share-pages/share-page-repository"
import { getTemplate } from "@/lib/growth/share-pages/share-page-template-repository"
import type {
  GrowthSharePage,
  GrowthSharePagePersonalizationContext,
} from "@/lib/growth/share-pages/share-page-types"

function asPersonalizationContext(
  snapshot: GrowthSharePagePersonalizationContext | Record<string, unknown>,
): GrowthSharePagePersonalizationContext | null {
  if (!snapshot || typeof snapshot !== "object") return null
  if ("headline" in snapshot && "personalizedMessage" in snapshot) {
    return snapshot as GrowthSharePagePersonalizationContext
  }
  return null
}

function leadLabel(contactName: string | null | undefined, companyName: string): string {
  const contact = contactName?.trim()
  if (contact && companyName) return `${contact} · ${companyName}`
  return contact || companyName || "Unknown lead"
}

function emptyOperatorMetadata(): GrowthSharePageOperatorWorkspaceMetadata {
  return {
    qa_marker: GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER,
    parent_qa_marker: "share-pages-operator-sr2b5-v1",
    operatorStates: {},
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }
}

export function parseGrowthSharePageOperatorWorkspaceMetadata(
  leadMetadata: Record<string, unknown> | null | undefined,
): GrowthSharePageOperatorWorkspaceMetadata {
  const raw = leadMetadata?.[GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_METADATA_KEY]
  if (!raw || typeof raw !== "object") return emptyOperatorMetadata()

  const record = raw as Record<string, unknown>
  const operatorStates =
    record.operatorStates && typeof record.operatorStates === "object"
      ? (record.operatorStates as Record<string, GrowthSharePageOperatorWorkspaceOperatorState>)
      : {}

  return {
    qa_marker: GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER,
    parent_qa_marker: "share-pages-operator-sr2b5-v1",
    operatorStates,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }
}

export async function persistGrowthSharePageOperatorWorkspaceMetadata(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    metadata: GrowthSharePageOperatorWorkspaceMetadata
  },
): Promise<GrowthSharePageOperatorWorkspaceMetadata> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("not_found")

  const existing = (lead.metadata ?? {}) as Record<string, unknown>
  await updateGrowthLeadFromImportMerge(admin, input.leadId, {
    metadata: {
      ...existing,
      [GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_METADATA_KEY]: input.metadata,
    },
  })

  return input.metadata
}

export function getGrowthSharePageOperatorWorkspaceOperatorState(
  metadata: GrowthSharePageOperatorWorkspaceMetadata,
  pageId: string,
): GrowthSharePageOperatorWorkspaceOperatorState {
  return metadata.operatorStates[pageId] ?? emptyGrowthSharePageOperatorWorkspaceOperatorState()
}

export async function patchGrowthSharePageOperatorWorkspaceOperatorState(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    pageId: string
    patch: Partial<GrowthSharePageOperatorWorkspaceOperatorState>
  },
): Promise<GrowthSharePageOperatorWorkspaceOperatorState> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("not_found")

  const metadata = parseGrowthSharePageOperatorWorkspaceMetadata(lead.metadata)
  const current = getGrowthSharePageOperatorWorkspaceOperatorState(metadata, input.pageId)
  const next: GrowthSharePageOperatorWorkspaceOperatorState = {
    ...current,
    ...input.patch,
    updatedAt: new Date().toISOString(),
  }

  await persistGrowthSharePageOperatorWorkspaceMetadata(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    metadata: {
      ...metadata,
      operatorStates: {
        ...metadata.operatorStates,
        [input.pageId]: next,
      },
    },
  })

  return next
}

function buildLeadContext(input: {
  lead: Awaited<ReturnType<typeof fetchGrowthLeadById>>
  context: GrowthSharePagePersonalizationContext | null
}): GrowthSharePageOperatorLeadContext {
  const lead = input.lead
  const nbaLabel = lead?.nextBestAction
    ? GROWTH_NEXT_BEST_ACTION_LABELS[lead.nextBestAction] ?? lead.nextBestAction
    : null

  return {
    recipient: {
      name: lead?.contactName ?? input.context?.prospectName ?? null,
      company: lead?.companyName ?? input.context?.companyName ?? null,
      email: lead?.contactEmail ?? null,
      title: lead?.notes ? null : null,
    },
    research: {
      painPoints: input.context?.companyObservations?.slice(0, 4) ?? [],
      outreachAngles: input.context?.whyReachingOut ? [input.context.whyReachingOut] : [],
      lastActivity: lead?.engagementLastActivityAt ?? lead?.lastHumanTouchAt ?? null,
      fitSummary: input.context?.researchSummary ?? lead?.relationshipSummary ?? null,
    },
    relationship: {
      lastInteraction: lead?.relationshipLastMeaningfulTouchAt ?? lead?.lastHumanTouchAt ?? null,
      openOpportunities: lead?.opportunityReadinessSummary ?? null,
      meetingReadiness: lead?.opportunityReadinessTier ?? null,
      nbaRecommendations: nbaLabel,
    },
  }
}

function buildReviewContext(input: {
  page: GrowthSharePage
  context: GrowthSharePagePersonalizationContext | null
  templateName: string | null
  templateCategory: string | null
  templateUpdatedAt: string | null
}): GrowthSharePageOperatorReviewContext {
  const mergeSource = [
    input.page.headline,
    input.page.subheadline ?? "",
    input.page.heroMessage,
    input.page.whyReachingOut ?? "",
    ...input.page.companyObservations,
  ].join("\n")
  const used = [...new Set(extractContentMergeFields(mergeSource))]
  const resolvedValues: Record<string, string> = {}
  for (const field of used) {
    resolvedValues[field] = field.startsWith("prospect")
      ? input.context?.prospectName ?? ""
      : field.startsWith("company")
        ? input.context?.companyName ?? input.page.headline
        : ""
  }

  const primaryCta = input.page.ctaConfig[0] ?? input.context?.suggestedCta ?? null

  return {
    template: {
      name: input.templateName,
      category: input.templateCategory,
      lastUpdatedAt: input.templateUpdatedAt ?? input.page.updatedAt,
    },
    personalization: {
      headline: input.page.headline || input.context?.headline || "",
      intro: input.page.heroMessage || input.context?.personalizedMessage || "",
      cta: primaryCta?.label ?? null,
      calendarUrl: input.context?.bookingLink ?? primaryCta?.destinationUrl ?? null,
      heroImageUrl: input.page.theme.heroImageUrl ?? input.page.heroMediaUrl,
      logoUrl: input.page.theme.logoUrl,
      brandColors: {
        primary: input.page.theme.brandColor,
        accent: input.page.theme.accentColor,
      },
    },
    mergeVariables: {
      used,
      missing: used.filter((field) => !resolvedValues[field]?.trim()),
      resolvedValues,
    },
  }
}

async function resolveTemplateMeta(
  admin: SupabaseClient,
  page: GrowthSharePage,
): Promise<{ name: string | null; category: string | null; updatedAt: string | null }> {
  if (!page.sharePageTemplateId) {
    return { name: null, category: null, updatedAt: null }
  }
  const template = await getTemplate(admin, page.sharePageTemplateId)
  if (!template) return { name: null, category: null, updatedAt: null }
  return {
    name: template.name,
    category: template.category ?? null,
    updatedAt: template.updatedAt,
  }
}

async function assembleGrowthSharePageOperatorWorkspaceView(
  admin: SupabaseClient,
  input: { organizationId: string; sharePageId: string; origin: string },
): Promise<GrowthSharePageOperatorWorkspaceView | null> {
  const page = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!page || page.organizationId !== input.organizationId) return null

  const [lead, analytics, recentEvents, templateMeta] = await Promise.all([
    fetchGrowthLeadById(admin, page.leadId),
    getSharePageAnalyticsSummary(admin, page.id).catch(() => null),
    listSharePageEventsForPage(admin, page.id, 40),
    resolveTemplateMeta(admin, page),
  ])

  const operatorMetadata = parseGrowthSharePageOperatorWorkspaceMetadata(lead?.metadata)
  const operatorState = getGrowthSharePageOperatorWorkspaceOperatorState(operatorMetadata, page.id)
  const context = asPersonalizationContext(page.personalizationSnapshot)
  const contactName = lead?.contactName?.trim() || context?.prospectName || null
  const companyName = lead?.companyName?.trim() || context?.companyName || "Unknown company"

  const summary = buildGrowthSharePageOperatorSummaryCards({
    page,
    lead,
    analytics,
    templateName: templateMeta.name,
    operatorState,
  })

  const preview = buildGrowthSharePageOperatorPreviewModel({
    page,
    contactName,
    companyName,
    previewUrl: `/p-preview/{token}`,
    publicUrl: page.status === "published" ? `/p/{token}` : null,
  })

  const analyticsPanel = await buildGrowthSharePageOperatorAnalyticsPanel(admin, {
    page,
    analytics,
    recentEvents,
  })

  const timeline = buildGrowthSharePageOperatorTimeline({
    page,
    operatorState,
    recentEvents,
  })

  const actions = buildGrowthSharePageOperatorWorkspaceActions({
    page,
    operatorState,
    hasPublicUrl: page.status === "published",
  })

  return {
    id: page.id,
    organizationId: page.organizationId,
    leadId: page.leadId,
    page,
    leadLabel: leadLabel(contactName, companyName),
    companyName,
    contactName,
    summary,
    actions,
    operatorState,
    leadContext: buildLeadContext({ lead, context }),
    review: buildReviewContext({
      page,
      context,
      templateName: templateMeta.name,
      templateCategory: templateMeta.category,
      templateUpdatedAt: templateMeta.updatedAt,
    }),
    preview,
    analytics: analyticsPanel,
    timeline,
    personalizationSnapshot: page.personalizationSnapshot,
    theme: page.theme,
    ctaConfig: page.ctaConfig,
    sourcesUsed: page.sourcesUsed,
    requiresHumanReview: true,
    autonomousExecutionEnabled: false,
    outreachExecution: false,
    enrollmentExecution: false,
  }
}

export async function listGrowthSharePageOperatorWorkspaces(
  admin: SupabaseClient,
  input: { organizationId: string; leadId?: string | null; limit?: number },
): Promise<GrowthSharePageOperatorWorkspaceListItem[]> {
  const { pages } = await listGrowthSharePagesForOrganization(admin, {
    organizationId: input.organizationId,
    leadIds: input.leadId ? [input.leadId] : null,
    limit: input.limit ?? 50,
  })

  const leadCache = new Map<string, Awaited<ReturnType<typeof fetchGrowthLeadById>>>()
  const items: GrowthSharePageOperatorWorkspaceListItem[] = []

  for (const page of pages) {
    let lead = leadCache.get(page.leadId)
    if (!lead) {
      lead = await fetchGrowthLeadById(admin, page.leadId)
      leadCache.set(page.leadId, lead)
    }

    const operatorMetadata = parseGrowthSharePageOperatorWorkspaceMetadata(lead?.metadata)
    const operatorState = getGrowthSharePageOperatorWorkspaceOperatorState(operatorMetadata, page.id)
    const templateMeta = await resolveTemplateMeta(admin, page)
    const analytics = await getSharePageAnalyticsSummary(admin, page.id).catch(() => null)
    const context = asPersonalizationContext(page.personalizationSnapshot)
    const contactName = lead?.contactName?.trim() || context?.prospectName || null
    const companyName = lead?.companyName?.trim() || context?.companyName || "Unknown company"

    items.push({
      id: page.id,
      organizationId: page.organizationId,
      leadId: page.leadId,
      leadLabel: leadLabel(contactName, companyName),
      companyName,
      contactName,
      status: page.status,
      updatedAt: page.updatedAt,
      summary: buildGrowthSharePageOperatorSummaryCards({
        page,
        lead,
        analytics,
        templateName: templateMeta.name,
        operatorState,
      }),
      actions: buildGrowthSharePageOperatorWorkspaceActions({
        page,
        operatorState,
        hasPublicUrl: page.status === "published",
      }),
      operatorState,
      requiresHumanReview: true,
      autonomousExecutionEnabled: false,
      outreachExecution: false,
      enrollmentExecution: false,
    })
  }

  return items
}

export async function getGrowthSharePageOperatorWorkspace(
  admin: SupabaseClient,
  input: { organizationId: string; sharePageId: string; origin: string },
): Promise<GrowthSharePageOperatorWorkspaceView | null> {
  return assembleGrowthSharePageOperatorWorkspaceView(admin, input)
}
