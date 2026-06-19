import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import { listContentVariables } from "@/lib/growth/content/snippet-repository"
import { buildAllowedVariableKeySet } from "@/lib/growth/content/variable-registry"
import { applySharePageTemplateMergeFields } from "@/lib/growth/share-pages/share-page-template-instantiation-compile"
import {
  resolveGrowthVideoMergeContext,
  type ResolveGrowthVideoMergeContextInput,
} from "@/lib/growth/videos/growth-video-merge-context-service"
import {
  buildGrowthVideoPreviewFormMergeValues,
  extractGrowthVideoMissingTokens,
  renderGrowthVideoPreviewFields,
} from "@/lib/growth/videos/growth-video-preview-render-service"
import type {
  GrowthVideoAiPayload,
  GrowthVideoPage,
  GrowthVideoPageBranding,
  GrowthVideoPreviewFormInput,
  GrowthVideoRenderedPreview,
  GrowthVideoSequenceHookMetadata,
} from "@/lib/growth/videos/growth-video-types"
import {
  GROWTH_VIDEO_LEGACY_ALIAS_KEYS,
  resolveGrowthVideoVariableAlias,
} from "@/lib/growth/videos/growth-video-variable-alias-service"

export type GrowthVideoPersonalizationVariableSummary = {
  registryVariables: Array<{
    key: string
    label: string
    namespace: string
    exampleValue: string
    fallbackToken: string
  }>
  legacyAliases: Array<{ alias: string; canonicalKey: string }>
}

export type GrowthVideoPageRenderInput = {
  title: string
  description: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  calendarUrl: string | null
  branding: GrowthVideoPageBranding
}

export type GrowthVideoPageRenderOutput = GrowthVideoPageRenderInput & {
  missingVariables: string[]
  mergeContext: Awaited<ReturnType<typeof resolveGrowthVideoMergeContext>>
}

function collectMergeTexts(fields: GrowthVideoPageRenderInput): string[] {
  return [
    fields.title,
    fields.description ?? "",
    fields.ctaLabel ?? "",
    fields.ctaUrl ?? "",
    fields.calendarUrl ?? "",
    fields.branding.buttonLabelOverride ?? "",
  ].filter(Boolean)
}

function computePersonalizationScore(input: {
  mergeMap: Record<string, string>
  missing: string[]
  usedKeys: string[]
}): number {
  if (input.usedKeys.length === 0) return 100
  const resolvedCount = input.usedKeys.filter((key) => {
    const canonical = resolveGrowthVideoVariableAlias(key)
    const value = input.mergeMap[key.toLowerCase()] ?? input.mergeMap[canonical]
    return Boolean(value?.trim()) && !input.missing.includes(canonical)
  }).length
  return Math.round((resolvedCount / input.usedKeys.length) * 100)
}

export async function listGrowthVideoPersonalizationVariables(
  admin: SupabaseClient,
): Promise<GrowthVideoPersonalizationVariableSummary> {
  const variables = await listContentVariables(admin)
  return {
    registryVariables: variables
      .filter((entry) => entry.allowed)
      .map((entry) => ({
        key: entry.variableKey,
        label: entry.label,
        namespace: entry.namespace,
        exampleValue: entry.exampleValue,
        fallbackToken: entry.fallbackToken,
      })),
    legacyAliases: GROWTH_VIDEO_LEGACY_ALIAS_KEYS.map((alias) => ({
      alias,
      canonicalKey: resolveGrowthVideoVariableAlias(alias),
    })),
  }
}

export async function renderGrowthVideoPageFields(
  admin: SupabaseClient,
  contextInput: Omit<ResolveGrowthVideoMergeContextInput, "admin">,
  fields: GrowthVideoPageRenderInput,
): Promise<GrowthVideoPageRenderOutput> {
  const mergeContext = await resolveGrowthVideoMergeContext({
    admin,
    ...contextInput,
    pageFields: {
      ctaUrl: fields.ctaUrl,
      calendarUrl: fields.calendarUrl,
    },
  })

  const mergeMap = mergeContext.variables
  const usedKeys = collectMergeTexts(fields).flatMap((text) => extractContentMergeFields(text))
  const tokenMissing = collectMergeTexts(fields).flatMap((text) =>
    extractGrowthVideoMissingTokens(text, mergeMap),
  )
  const missingVariables = [...new Set([...mergeContext.missing, ...tokenMissing])]

  return {
    title: applySharePageTemplateMergeFields(fields.title, mergeMap),
    description: fields.description
      ? applySharePageTemplateMergeFields(fields.description, mergeMap)
      : null,
    ctaLabel: fields.ctaLabel ? applySharePageTemplateMergeFields(fields.ctaLabel, mergeMap) : null,
    ctaUrl: fields.ctaUrl ? applySharePageTemplateMergeFields(fields.ctaUrl, mergeMap) : null,
    calendarUrl: fields.calendarUrl
      ? applySharePageTemplateMergeFields(fields.calendarUrl, mergeMap)
      : null,
    branding: {
      ...fields.branding,
      buttonLabelOverride: fields.branding.buttonLabelOverride
        ? applySharePageTemplateMergeFields(fields.branding.buttonLabelOverride, mergeMap)
        : null,
    },
    missingVariables,
    mergeContext: {
      ...mergeContext,
      missing: missingVariables,
    },
  }
}

export function buildGrowthVideoAiPayload(input: {
  mergeContext: Awaited<ReturnType<typeof resolveGrowthVideoMergeContext>>
  renderedPreview: GrowthVideoRenderedPreview
  sequenceHooks?: GrowthVideoSequenceHookMetadata | null
  usedTexts?: string[]
}): GrowthVideoAiPayload {
  const usedKeys =
    input.usedTexts?.flatMap((text) => extractContentMergeFields(text)) ??
    extractContentMergeFields(
      [
        input.renderedPreview.title,
        input.renderedPreview.description ?? "",
        input.renderedPreview.ctaLabel ?? "",
        input.renderedPreview.ctaUrl ?? "",
        input.renderedPreview.calendarUrl ?? "",
        input.renderedPreview.buttonLabelOverride ?? "",
      ].join("\n"),
    )

  return {
    resolved_variables: input.mergeContext.variables,
    aliases_used: input.mergeContext.aliases,
    missing_variables: input.mergeContext.missing,
    sources_used: input.mergeContext.sourcesUsed,
    personalization_score: computePersonalizationScore({
      mergeMap: input.mergeContext.variables,
      missing: input.mergeContext.missing,
      usedKeys,
    }),
    rendered_preview: input.renderedPreview,
    sequence_hooks: input.sequenceHooks ?? undefined,
  }
}

export async function previewGrowthVideoPersonalization(
  admin: SupabaseClient,
  input: {
    page?: Pick<
      GrowthVideoPage,
      "title" | "description" | "ctaLabel" | "ctaUrl" | "calendarUrl" | "branding" | "personalization" | "metadata"
    > | null
    previewForm: GrowthVideoPreviewFormInput
    sampleText?: string | null
    organizationId: string
  },
): Promise<{
  mergeContext: Awaited<ReturnType<typeof resolveGrowthVideoMergeContext>>
  renderedPreview: GrowthVideoRenderedPreview
  renderedSampleText: string | null
  aiPayload: GrowthVideoAiPayload
}> {
  const page = input.page
  const previewFormRecord: Record<string, string> = {
    firstName: input.previewForm.firstName ?? "",
    lastName: input.previewForm.lastName ?? "",
    company: input.previewForm.company ?? "",
    title: input.previewForm.title ?? "",
    industry: input.previewForm.industry ?? "",
    city: input.previewForm.city ?? "",
    state: input.previewForm.state ?? "",
  }

  const mergeContext = await resolveGrowthVideoMergeContext({
    admin,
    organizationId: input.organizationId,
    leadId: asMetadataString(page?.metadata, "lead_id"),
    companyCandidateId: asMetadataString(page?.metadata, "company_candidate_id"),
    personCandidateId: asMetadataString(page?.metadata, "person_candidate_id"),
    personalizationProfileId: null,
    pagePersonalization: page?.personalization ?? null,
    pageFields: {
      ctaUrl: page?.ctaUrl ?? null,
      calendarUrl: page?.calendarUrl ?? null,
    },
    previewForm: previewFormRecord,
  })

  const mergeValues =
    Object.keys(mergeContext.variables).length > 0
      ? mergeContext.variables
      : buildGrowthVideoPreviewFormMergeValues(input.previewForm)

  const renderedPreview = page
    ? renderGrowthVideoPreviewFields({
        title: page.title,
        description: page.description,
        ctaLabel: page.ctaLabel,
        ctaUrl: page.ctaUrl,
        calendarUrl: page.calendarUrl,
        buttonLabelOverride: page.branding.buttonLabelOverride ?? null,
        mergeValues,
      })
    : renderGrowthVideoPreviewFields({
        title: input.sampleText ?? "Hi {{first_name}},",
        description: null,
        mergeValues,
      })

  const renderedSampleText = input.sampleText
    ? applySharePageTemplateMergeFields(input.sampleText, mergeValues)
    : null

  const sequenceHooks = extractSequenceHooks(page?.metadata)

  const aiPayload = buildGrowthVideoAiPayload({
    mergeContext,
    renderedPreview,
    sequenceHooks,
    usedTexts: [
      page?.title ?? "",
      page?.description ?? "",
      input.sampleText ?? "",
    ],
  })

  return { mergeContext, renderedPreview, renderedSampleText, aiPayload }
}

export async function validateGrowthVideoPagePersonalizationText(
  admin: SupabaseClient,
  texts: string[],
): Promise<{ blockedVariables: string[]; unknownVariables: string[] }> {
  const variables = await listContentVariables(admin)
  const allowedKeys = buildAllowedVariableKeySet(variables)
  for (const alias of GROWTH_VIDEO_LEGACY_ALIAS_KEYS) {
    allowedKeys.add(alias)
    allowedKeys.add(resolveGrowthVideoVariableAlias(alias))
  }

  const blockedVariables = new Set<string>()
  const unknownVariables = new Set<string>()

  for (const text of texts) {
    const keys = extractContentMergeFields(text)
    for (const key of keys) {
      const canonical = resolveGrowthVideoVariableAlias(key)
      if (!allowedKeys.has(key) && !allowedKeys.has(canonical)) {
        unknownVariables.add(key)
      }
    }
  }

  return {
    blockedVariables: [...blockedVariables],
    unknownVariables: [...unknownVariables],
  }
}

function asMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function extractSequenceHooks(
  metadata: Record<string, unknown> | undefined,
): GrowthVideoSequenceHookMetadata {
  if (!metadata) return {}
  return {
    sequence_candidate_id: asMetadataString(metadata, "sequence_candidate_id"),
    enrollment_candidate_id: asMetadataString(metadata, "enrollment_candidate_id"),
    company_candidate_id: asMetadataString(metadata, "company_candidate_id"),
    person_candidate_id: asMetadataString(metadata, "person_candidate_id"),
    lead_id: asMetadataString(metadata, "lead_id"),
  }
}
