import "server-only"

import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  businessProfileAiDraftModelSchema,
  type BusinessProfileAiDraftModel,
} from "@/lib/growth/business-profile/business-profile-ai-draft-schema"
import { mapAiModelToBusinessProfileContent } from "@/lib/growth/business-profile/business-profile-ai-draft-mapper"
import {
  buildBusinessProfileAiDraftSystemPrompt,
  buildBusinessProfileAiDraftUserPrompt,
} from "@/lib/growth/business-profile/business-profile-ai-draft-prompts"
import { buildDeterministicProfileContent } from "@/lib/growth/business-profile/business-profile-draft-generator"
import type {
  BusinessProfileDraft,
  BusinessProfileDraftContent,
  BusinessProfileInput,
} from "@/lib/growth/business-profile/business-profile-types"
import { BUSINESS_PROFILE_DRAFT_LABEL } from "@/lib/growth/business-profile/business-profile-types"
import {
  fetchBusinessProfileWebsiteContext,
  type BusinessProfileWebsiteContextResult,
} from "@/lib/growth/business-profile/business-profile-website-context"

export type BusinessProfileAiDraftDeps = {
  organizationId?: string | null
  fetchWebsiteContext?: (website: string) => Promise<BusinessProfileWebsiteContextResult>
  runAiDraft?: (input: {
    organizationId: string
    companyInput: BusinessProfileInput
    websiteContextSummary: string | null
  }) => Promise<BusinessProfileAiDraftModel | null>
}

function trim(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeWebsite(value: string): string {
  const trimmed = trim(value)
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function normalizeBusinessProfileInput(input: BusinessProfileInput): BusinessProfileInput {
  return {
    companyName: trim(input.companyName),
    website: normalizeWebsite(input.website),
    notes: trim(input.notes) || null,
    whatTheySell: trim(input.whatTheySell) || null,
    whoTheySellTo: trim(input.whoTheySellTo) || null,
    geography: trim(input.geography) || null,
    averageDealSize: trim(input.averageDealSize) || null,
  }
}

async function defaultRunAiDraft(input: {
  organizationId: string
  companyInput: BusinessProfileInput
  websiteContextSummary: string | null
}): Promise<BusinessProfileAiDraftModel | null> {
  try {
    const result = await runAiTask({
      task: "growth_business_profile_draft",
      organizationId: input.organizationId,
      input: {
        system: buildBusinessProfileAiDraftSystemPrompt(),
        user: buildBusinessProfileAiDraftUserPrompt({
          companyInput: input.companyInput,
          websiteContextSummary: input.websiteContextSummary,
        }),
      },
      schema: businessProfileAiDraftModelSchema,
      cacheSchemaVersion: "growth_business_profile_draft_v1",
      skipPlanGateCheck: true,
      skipBudgetCheck: true,
      forceLiveAi: false,
      taskOverrides: { structuredMode: "json_object" },
    })

    if (!result.ok) return null
    return result.output
  } catch {
    return null
  }
}

function buildFallbackProfile(
  companyInput: BusinessProfileInput,
  websiteContext: BusinessProfileWebsiteContextResult,
  reason: string,
): BusinessProfileDraftContent {
  const profile = buildDeterministicProfileContent(companyInput, {
    websiteContextSummary: websiteContext.summary,
  })
  return {
    ...profile,
    draftSource: "ai_fallback",
    websiteContextSummary: websiteContext.summary,
    confidence: {
      ...profile.confidence,
      assumptions: [reason, ...profile.confidence.assumptions],
    },
  }
}

export async function draftBusinessProfileWithAiAssistance(
  input: BusinessProfileInput,
  deps: BusinessProfileAiDraftDeps = {},
): Promise<BusinessProfileDraft> {
  const companyInput = normalizeBusinessProfileInput(input)
  const fetchWebsiteContext = deps.fetchWebsiteContext ?? fetchBusinessProfileWebsiteContext
  const websiteContext = await fetchWebsiteContext(companyInput.website)

  const organizationId = deps.organizationId ?? getGrowthEngineAiOrgId()
  let profile: BusinessProfileDraftContent

  if (organizationId) {
    const runAiDraft = deps.runAiDraft ?? defaultRunAiDraft
    const aiModel = await runAiDraft({
      organizationId,
      companyInput,
      websiteContextSummary: websiteContext.summary,
    })

    if (aiModel) {
      profile = mapAiModelToBusinessProfileContent({
        model: aiModel,
        companyInput,
        websiteContextSummary: websiteContext.summary,
        draftSource: "ai_assisted",
      })
    } else {
      profile = buildFallbackProfile(
        companyInput,
        websiteContext,
        "Fell back to rule-based draft because AI output was unavailable or invalid.",
      )
    }
  } else {
    profile = {
      ...buildDeterministicProfileContent(companyInput, {
        websiteContextSummary: websiteContext.summary,
      }),
      draftSource: "deterministic",
      websiteContextSummary: websiteContext.summary,
    }
  }

  return {
    status: "draft",
    isActive: false,
    input: companyInput,
    profile,
    label: BUSINESS_PROFILE_DRAFT_LABEL,
  }
}
