/** Growth Engine SP-UX-2 — Operator workspace actions (server-only, human review only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  approveSharePageForOperator,
  archiveSharePageForOperator,
  regenerateSharePagePreviewForOperator,
} from "@/lib/growth/share-pages/share-page-operator-service"
import {
  getGrowthSharePageOperatorWorkspace,
  getGrowthSharePageOperatorWorkspaceOperatorState,
  parseGrowthSharePageOperatorWorkspaceMetadata,
  patchGrowthSharePageOperatorWorkspaceOperatorState,
} from "@/lib/growth/share-pages/growth-share-page-operator-workspace-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import type { GrowthSharePageOperatorWorkspaceView } from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"
import {
  createSharePage,
  fetchGrowthSharePageById,
  updateSharePage,
} from "@/lib/growth/share-pages/share-page-repository"
import { buildSharePagePublicUrl } from "@/lib/growth/share-pages/share-page-token"

async function reloadWorkspace(
  admin: SupabaseClient,
  input: { organizationId: string; sharePageId: string; origin: string },
): Promise<GrowthSharePageOperatorWorkspaceView> {
  const workspace = await getGrowthSharePageOperatorWorkspace(admin, input)
  if (!workspace) throw new Error("not_found")
  return workspace
}

export async function approveGrowthSharePageOperatorDraft(
  admin: SupabaseClient,
  input: { organizationId: string; sharePageId: string; leadId: string; actorUserId: string; origin: string },
): Promise<GrowthSharePageOperatorWorkspaceView> {
  const page = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!page || page.organizationId !== input.organizationId || page.leadId !== input.leadId) {
    throw new Error("not_found")
  }
  if (page.status !== "draft" && page.status !== "pending_review") {
    throw new Error("share_page_not_approvable")
  }

  if (page.status === "draft") {
    await updateSharePage(admin, input.sharePageId, { status: "pending_review" })
  }

  await patchGrowthSharePageOperatorWorkspaceOperatorState(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    pageId: input.sharePageId,
    patch: {
      draftApprovedAt: new Date().toISOString(),
      draftApprovedBy: input.actorUserId,
    },
  })

  return reloadWorkspace(admin, input)
}

export async function publishGrowthSharePageOperatorPage(
  admin: SupabaseClient,
  input: { organizationId: string; sharePageId: string; leadId: string; actorUserId: string; origin: string },
): Promise<GrowthSharePageOperatorWorkspaceView & { publicUrl: string | null }> {
  const page = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!page || page.organizationId !== input.organizationId || page.leadId !== input.leadId) {
    throw new Error("not_found")
  }

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  const operatorMetadata = parseGrowthSharePageOperatorWorkspaceMetadata(lead?.metadata)
  const operatorState = getGrowthSharePageOperatorWorkspaceOperatorState(operatorMetadata, input.sharePageId)
  if (!operatorState.draftApprovedAt) {
    throw new Error("draft_not_approved")
  }

  await approveSharePageForOperator(admin, {
    sharePageId: input.sharePageId,
    organizationId: input.organizationId,
    approvedBy: input.actorUserId,
    origin: input.origin,
  })

  const workspace = await reloadWorkspace(admin, input)
  return {
    ...workspace,
    publicUrl: null,
  }
}

export async function duplicateGrowthSharePageOperatorPage(
  admin: SupabaseClient,
  input: { organizationId: string; sharePageId: string; leadId: string; actorUserId: string; origin: string },
): Promise<{ workspace: GrowthSharePageOperatorWorkspaceView; duplicatePageId: string }> {
  const source = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!source || source.organizationId !== input.organizationId || source.leadId !== input.leadId) {
    throw new Error("not_found")
  }

  const created = await createSharePage(admin, {
    organizationId: source.organizationId,
    leadId: source.leadId,
    companyId: source.companyId,
    campaignId: source.campaignId,
    enrollmentId: source.enrollmentId,
    sequenceStepId: source.sequenceStepId,
    sequenceEnrollmentStepId: source.sequenceEnrollmentStepId,
    sequenceExecutionJobId: source.sequenceExecutionJobId,
    sourceChannel: source.sourceChannel,
    status: "draft",
    personalizationSnapshot: source.personalizationSnapshot,
    personalizationContextVersion: source.personalizationContextVersion,
    sourcesUsed: source.sourcesUsed,
    evidenceCoverageScore: source.evidenceCoverageScore,
    theme: source.theme,
    headline: source.headline,
    subheadline: source.subheadline,
    heroMessage: source.heroMessage,
    whyReachingOut: source.whyReachingOut,
    companyObservations: source.companyObservations,
    ctaConfig: source.ctaConfig,
    resources: source.resources,
    bookingPageId: source.bookingPageId,
    heroMediaType: source.heroMediaType,
    heroMediaUrl: source.heroMediaUrl,
    heroMediaThumbnailUrl: source.heroMediaThumbnailUrl,
    voiceAssetId: source.voiceAssetId,
    videoAssetId: source.videoAssetId,
    sharePageTemplateId: source.sharePageTemplateId,
    sharePageTemplateVersionId: source.sharePageTemplateVersionId,
    templateBlocksSnapshot: source.templateBlocksSnapshot,
    createdBy: input.actorUserId,
  })

  const workspace = await getGrowthSharePageOperatorWorkspace(admin, {
    organizationId: input.organizationId,
    sharePageId: created.page.id,
    origin: input.origin,
  })
  if (!workspace) throw new Error("not_found")

  return { workspace, duplicatePageId: created.page.id }
}

export async function archiveGrowthSharePageOperatorPage(
  admin: SupabaseClient,
  input: { organizationId: string; sharePageId: string; leadId: string; origin: string },
): Promise<GrowthSharePageOperatorWorkspaceView> {
  const page = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!page || page.organizationId !== input.organizationId || page.leadId !== input.leadId) {
    throw new Error("not_found")
  }

  await archiveSharePageForOperator(admin, {
    sharePageId: input.sharePageId,
    organizationId: input.organizationId,
  })

  return reloadWorkspace(admin, input)
}

export async function rebuildGrowthSharePageOperatorPersonalization(
  admin: SupabaseClient,
  input: { organizationId: string; sharePageId: string; leadId: string; origin: string },
): Promise<GrowthSharePageOperatorWorkspaceView> {
  const page = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!page || page.organizationId !== input.organizationId || page.leadId !== input.leadId) {
    throw new Error("not_found")
  }

  await regenerateSharePagePreviewForOperator(admin, {
    sharePageId: input.sharePageId,
    organizationId: input.organizationId,
    origin: input.origin,
    rebuildContext: true,
    leadId: input.leadId,
  })

  await patchGrowthSharePageOperatorWorkspaceOperatorState(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    pageId: input.sharePageId,
    patch: {
      lastPersonalizationRebuildAt: new Date().toISOString(),
    },
  })

  return reloadWorkspace(admin, input)
}

export function resolveGrowthSharePageOperatorPublicUrl(
  publicToken: string | null | undefined,
  origin: string,
): string | null {
  if (!publicToken) return null
  return buildSharePagePublicUrl(publicToken, origin)
}
