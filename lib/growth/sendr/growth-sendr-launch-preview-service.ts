import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { runAiTask } from "@/lib/ai/router"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { GROWTH_AUDIENCE_LIMITS } from "@/lib/growth/audiences/growth-audience-config"
import { classifyAudienceMemberEnrollmentReadiness } from "@/lib/growth/audiences/growth-audience-enrollment-readiness"
import { getGrowthAudience, listGrowthAudienceMembers } from "@/lib/growth/audiences/growth-audience-repository"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import { buildIndustryContextPromptBlock } from "@/lib/growth/playbooks/growth-industry-context-prompts"
import type { GrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context-types"
import {
  buildGrowthReasoningDiagnosticsFromIndustryInput,
} from "@/lib/growth/reasoning/growth-reasoning-engine"
import { buildGrowthNarrativeBriefPromptBlock } from "@/lib/growth/reasoning/growth-reasoning-diagnostics"
import { buildGrowthSequenceIntelligenceFromIndustryInput } from "@/lib/growth/sequence-intelligence/growth-sequence-engine"
import { buildGrowthSequenceGuidancePromptBlock } from "@/lib/growth/sequence-intelligence/growth-sequence-diagnostics"
import {
  GROWTH_SENDR_LAUNCH_QA_MARKER,
  GROWTH_SENDR_LIMITS,
  GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN,
  type GrowthSendrLandingPageSectionType,
} from "@/lib/growth/sendr/growth-sendr-config"
import { getGrowthSendrPageTemplate } from "@/lib/growth/sendr/growth-sendr-builder-config"
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
      sequence: `Hi {{first_name}}, view your page: ${GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN}`,
    },
  })

  const sampleVariables: Record<string, string> = {
    ...personalization.resolved,
    video_page_url: sendrPageUrl ?? GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN,
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

export const GROWTH_SENDR_PAGE_AI_GENERATION_QA_MARKER = "growth-sendr-page-ai-generation-gs-sendr-7b-v1" as const

export type GrowthSendrPageDraftSection = {
  sectionType: GrowthSendrLandingPageSectionType
  sortOrder: number
  content: Record<string, unknown>
}

export type GrowthSendrPageAiGenerationInput = {
  targetCompany?: string
  targetPerson?: string
  industry?: string
  painPoints?: string
  desiredCta?: string
  tone?: string
  templateId?: string
  verifiedFacts?: string[]
  industryContext?: GrowthIndustryContext | null
}

export type GrowthSendrPageAiGenerationResult = {
  title: string
  sections: GrowthSendrPageDraftSection[]
  provider: "ai" | "template_fallback"
  message?: string
  qaMarker: typeof GROWTH_SENDR_PAGE_AI_GENERATION_QA_MARKER
}

const aiDraftSchema = z.object({
  title: z.string().min(1),
  heroHeadline: z.string().min(1),
  heroBody: z.string().min(1),
  ctaLabel: z.string().min(1),
  benefits: z.array(z.string()).default([]),
  faq: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .default([]),
  testimonialQuote: z.string().optional(),
})

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => vars[key] ?? `{{${key}}}`)
}

function buildFallbackDraft(input: GrowthSendrPageAiGenerationInput): GrowthSendrPageAiGenerationResult {
  const template = getGrowthSendrPageTemplate(input.templateId ?? "general_field_service")
  const company = input.targetCompany?.trim() || "{{company_name}}"
  const person = input.targetPerson?.trim() || "{{first_name}}"
  const vars = {
    company_name: company,
    first_name: person,
    meeting_link: "{{meeting_link}}",
  }

  const base = template ?? getGrowthSendrPageTemplate("general_field_service")!
  const title = interpolate(base.suggestedTitle, vars)
  const sections = base.sections.map((section, index) => ({
    sectionType: section.sectionType,
    sortOrder: index,
    content: JSON.parse(interpolate(JSON.stringify(section.content), vars)) as Record<string, unknown>,
  }))

  if (input.painPoints?.trim()) {
    const hero = sections.find((s) => s.sectionType === "hero")
    if (hero && typeof hero.content.body === "string") {
      hero.content.body = `${hero.content.body}\n\n${input.painPoints.trim()}`
    }
  }
  if (input.desiredCta?.trim()) {
    for (const section of sections) {
      if (section.sectionType === "cta" || section.sectionType === "calendar") {
        section.content.label = input.desiredCta.trim()
      }
    }
  }

  return {
    title,
    sections,
    provider: "template_fallback",
    message: "AI provider unavailable — applied a structured template draft for your review.",
    qaMarker: GROWTH_SENDR_PAGE_AI_GENERATION_QA_MARKER,
  }
}

function resolveSendrIndustryContext(input: GrowthSendrPageAiGenerationInput): GrowthIndustryContext {
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
    channel: "VIDEO",
    industryContext: base,
    companyName: input.targetCompany,
    contactName: input.targetPerson,
    verifiedFacts: input.verifiedFacts,
    researchPainPoints: input.painPoints?.split(/[;\n]/).map((entry) => entry.trim()).filter(Boolean),
  })
  return {
    ...base,
    sequenceIntelligenceContext,
    reasoningContext: { channel: "VIDEO", diagnostics: reasoningDiagnostics },
  }
}

export async function generateGrowthSendrPageDraft(
  input: GrowthSendrPageAiGenerationInput,
): Promise<GrowthSendrPageAiGenerationResult> {
  const orgId = getGrowthEngineAiOrgId()
  if (!orgId) {
    return buildFallbackDraft(input)
  }

  const industryContext = resolveSendrIndustryContext(input)
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
    "Generate a personalized video landing page draft for a B2B field service prospect.",
    `Company: ${input.targetCompany ?? "the prospect company"}`,
    `Contact: ${input.targetPerson ?? "the prospect"}`,
    `Industry: ${input.industry ?? industryContext.playbook?.displayName ?? "field service"}`,
    industryPrompt,
    reasoningPrompt,
    sequencePrompt,
    `Desired CTA: ${input.desiredCta ?? industryContext.recommendedCtas[0] ?? "Schedule Demo"}`,
    `Tone: ${input.tone ?? "professional, concise, helpful"}`,
    "Return JSON with title, heroHeadline, heroBody, ctaLabel, benefits (array of strings), faq (array of {question, answer}), optional testimonialQuote.",
    "Structure: industry-aware headline, verified company observation, capability mapping, booking CTA.",
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
          "You draft operator-reviewed landing page copy for personalized video pages. Return JSON only. No outbound sending.",
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
    const companyToken = input.targetCompany?.trim() ? input.targetCompany.trim() : "{{company_name}}"
    const personToken = input.targetPerson?.trim() ? input.targetPerson.trim() : "{{first_name}}"

    const sections: GrowthSendrPageDraftSection[] = [
      {
        sectionType: "hero",
        sortOrder: 0,
        content: {
          headline: data.heroHeadline.replace(/the prospect company/gi, companyToken),
          body: data.heroBody,
          personalizationLabel: `Personalized for ${companyToken}`,
        },
      },
      {
        sectionType: "text",
        sortOrder: 1,
        content: {
          presentationKind: "benefits",
          headline: "Why this matters for your team",
          items: data.benefits.map((title) => ({ title })),
        },
      },
    ]

    if (data.faq.length > 0) {
      sections.push({
        sectionType: "faq",
        sortOrder: sections.length,
        content: { headline: "Questions", items: data.faq },
      })
    }

    if (data.testimonialQuote?.trim()) {
      sections.push({
        sectionType: "text",
        sortOrder: sections.length,
        content: {
          presentationKind: "testimonials",
          items: [{ quote: data.testimonialQuote.trim(), author: "Operations leader", company: "Service business" }],
        },
      })
    }

    sections.push({
      sectionType: "calendar",
      sortOrder: sections.length,
      content: { label: data.ctaLabel, href: "{{meeting_link}}" },
    })

    return {
      title: data.title,
      sections,
      provider: "ai",
      message: "AI draft generated — review all copy before publishing.",
      qaMarker: GROWTH_SENDR_PAGE_AI_GENERATION_QA_MARKER,
    }
  } catch {
    return buildFallbackDraft(input)
  }
}

export { GROWTH_SENDR_LAUNCH_QA_MARKER }
