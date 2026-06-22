import "server-only"

import { z } from "zod"
import { runAiTask } from "@/lib/ai/router"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { getSharePageQuickTemplate } from "@/lib/growth/share-pages/share-page-types"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import { buildIndustryContextPromptBlock } from "@/lib/growth/playbooks/growth-industry-context-prompts"
import type { GrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context-types"
import {
  buildGrowthReasoningDiagnosticsFromIndustryInput,
} from "@/lib/growth/reasoning/growth-reasoning-engine"
import { buildGrowthNarrativeBriefPromptBlock } from "@/lib/growth/reasoning/growth-reasoning-diagnostics"
import { buildGrowthSequenceIntelligenceFromIndustryInput } from "@/lib/growth/sequence-intelligence/growth-sequence-engine"
import { buildGrowthSequenceGuidancePromptBlock } from "@/lib/growth/sequence-intelligence/growth-sequence-diagnostics"

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
