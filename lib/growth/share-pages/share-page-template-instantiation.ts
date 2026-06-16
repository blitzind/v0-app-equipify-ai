import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildGrowthSharePageContext } from "@/lib/growth/share-pages/share-page-context-service"
import { createSharePage } from "@/lib/growth/share-pages/share-page-repository"
import {
  compileTemplateVersionToSharePageFields,
  type SharePageTemplateMergeContext,
} from "@/lib/growth/share-pages/share-page-template-instantiation-compile"
import {
  getPublishedTemplateVersionForInstantiation,
  getTemplate,
} from "@/lib/growth/share-pages/share-page-template-repository"
import type { GrowthSharePage, GrowthSharePagePersonalizationContext } from "@/lib/growth/share-pages/share-page-types"

export type InstantiateSharePageFromTemplateInput = {
  templateId: string
  organizationId: string
  leadId: string
  actorUserId?: string | null
  companyId?: string | null
  bookingPageIdOverride?: string | null
  draftTitleOverride?: string | null
  personalizationOverride?: Partial<GrowthSharePagePersonalizationContext> | Record<string, unknown> | null
  buildContext?: boolean
}

export type InstantiateSharePageFromTemplateResult = {
  sharePage: GrowthSharePage
  templateId: string
  templateVersionId: string
  templateVersionNumber: number
  noLivePagePublish: true
}

export async function instantiateSharePageFromTemplate(
  admin: SupabaseClient,
  input: InstantiateSharePageFromTemplateInput,
): Promise<InstantiateSharePageFromTemplateResult> {
  const template = await getTemplate(admin, input.templateId)
  if (!template) throw new Error("template_not_found")
  if (template.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")
  if (template.status === "archived") throw new Error("template_archived")

  const publishedVersion = await getPublishedTemplateVersionForInstantiation(admin, input.templateId)
  if (!publishedVersion) throw new Error("template_not_published")

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("lead_not_found")

  let personalization: GrowthSharePagePersonalizationContext | Record<string, unknown> = {}
  const shouldBuildContext = input.buildContext !== false
  if (shouldBuildContext) {
    personalization = await buildGrowthSharePageContext(admin, {
      leadId: input.leadId,
      companyId: input.companyId ?? null,
      bookingPageId: input.bookingPageIdOverride ?? publishedVersion.defaultBookingPageId ?? null,
    })
  }

  if (input.personalizationOverride && typeof input.personalizationOverride === "object") {
    personalization = { ...personalization, ...input.personalizationOverride }
  }

  const mergeContext: SharePageTemplateMergeContext = {
    prospectName:
      (typeof personalization === "object" &&
      personalization &&
      "prospectName" in personalization &&
      typeof personalization.prospectName === "string"
        ? personalization.prospectName
        : lead.contactName?.trim()) || "there",
    companyName:
      (typeof personalization === "object" &&
      personalization &&
      "companyName" in personalization &&
      typeof personalization.companyName === "string"
        ? personalization.companyName
        : lead.companyName?.trim()) || "your team",
    bookingLink:
      typeof personalization === "object" &&
      personalization &&
      "bookingLink" in personalization &&
      typeof personalization.bookingLink === "string"
        ? personalization.bookingLink
        : null,
  }

  const compiled = compileTemplateVersionToSharePageFields({
    version: publishedVersion,
    mergeContext,
    bookingPageIdOverride: input.bookingPageIdOverride,
  })

  const snapshot = {
    ...(typeof personalization === "object" ? personalization : {}),
    templateInstantiation: {
      templateId: template.id,
      templateName: template.name,
      templateVersionId: publishedVersion.id,
      templateVersionNumber: publishedVersion.versionNumber,
      draftTitleOverride: input.draftTitleOverride ?? null,
      instantiatedAt: new Date().toISOString(),
    },
  }

  const created = await createSharePage(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    companyId: input.companyId ?? null,
    sourceChannel: "manual",
    status: "draft",
    headline: input.draftTitleOverride?.trim() || compiled.headline,
    subheadline: compiled.subheadline,
    heroMessage: compiled.heroMessage,
    whyReachingOut: compiled.whyReachingOut,
    companyObservations: compiled.companyObservations,
    ctaConfig: compiled.ctaConfig,
    resources: compiled.resources,
    bookingPageId: compiled.bookingPageId,
    theme: compiled.theme,
    heroMediaType: compiled.heroMediaType,
    heroMediaUrl: compiled.heroMediaUrl,
    heroMediaThumbnailUrl: compiled.heroMediaThumbnailUrl,
    voiceAssetId: compiled.voiceAssetId,
    videoAssetId: compiled.videoAssetId,
    personalizationSnapshot: snapshot,
    personalizationContextVersion: 1,
    sourcesUsed:
      typeof personalization === "object" &&
      personalization &&
      "sourcesUsed" in personalization &&
      Array.isArray(personalization.sourcesUsed)
        ? personalization.sourcesUsed
        : [],
    evidenceCoverageScore:
      typeof personalization === "object" &&
      personalization &&
      "evidenceCoverageScore" in personalization &&
      typeof personalization.evidenceCoverageScore === "number"
        ? personalization.evidenceCoverageScore
        : null,
    sharePageTemplateId: template.id,
    sharePageTemplateVersionId: publishedVersion.id,
    templateBlocksSnapshot: compiled.templateBlocksSnapshot,
    createdBy: input.actorUserId ?? null,
  })

  return {
    sharePage: created.page,
    templateId: template.id,
    templateVersionId: publishedVersion.id,
    templateVersionNumber: publishedVersion.versionNumber,
    noLivePagePublish: true,
  }
}
