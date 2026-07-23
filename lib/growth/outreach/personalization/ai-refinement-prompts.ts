/** AI refinement prompts for outreach personalization (slice 6.15B + GS-AI-PLAYBOOK-1C). */

import { formatPlaybookRulesForCopilotPrompt } from "@/lib/growth/ai-copilot-playbook-prompts"
import type { GrowthAiCopilotPlaybookResolvedRule } from "@/lib/growth/ai-copilot-playbook-types"
import type { GrowthOutboundIdentityContext } from "@/lib/growth/signatures/outbound-identity-types"
import { buildGrowthOutboundIdentitySystemPromptAppendix } from "@/lib/growth/signatures/outbound-sender-persona-instructions"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import type {
  OutreachPersonalizationDraft,
  SelectedMessageBlock,
} from "@/lib/growth/outreach/personalization/personalization-types"
import {
  buildRegenerationFeedbackDirectives,
  type GrowthIndustryContext,
} from "@/lib/growth/playbooks/growth-industry-context"
import { buildGrowthPlaybookOrchestratedPrompt } from "@/lib/growth/playbooks/narrative/growth-playbook-prompt-orchestrator"
import { buildGrowthNarrativeBriefPromptBlock } from "@/lib/growth/reasoning/growth-reasoning-diagnostics"
import { buildGrowthSequenceGuidancePromptBlock } from "@/lib/growth/sequence-intelligence/growth-sequence-diagnostics"
import type { GrowthOutreachPersonalizationOrganizationKnowledgeBlock } from "@/lib/growth/outreach/personalization/growth-outreach-personalization-organization-knowledge"
import { normalizeIndustryPlaybookModuleLabel } from "@/lib/growth/playbooks/industry-capability-normalization"

export function buildOutreachRefinementSystemPrompt(
  maxWords: number,
  outboundIdentity?: GrowthOutboundIdentityContext | null,
  organizationKnowledge?: GrowthOutreachPersonalizationOrganizationKnowledgeBlock | null,
): string {
  const identityBlock = buildGrowthOutboundIdentitySystemPromptAppendix(outboundIdentity)
  const orgName =
    organizationKnowledge?.companyName?.trim() ||
    outboundIdentity?.company?.trim() ||
    "the organization"
  return [
    `You refine pre-written B2B outreach copy for ${orgName}'s Growth Engine.`,
    identityBlock,
    organizationKnowledge?.source === "approved_business_profile"
      ? "Use the approved organizationKnowledge block as canonical seller positioning, tone, products, and words to avoid. Industry context is advisory only."
      : "When organizationKnowledge is thin, use generic language — do not invent product names or brand the organization as Equipify.",
    "You may ONLY smooth wording, improve flow, improve readability, reduce spam language, and vary phrasing.",
    "You must NOT invent research, website findings, pain points, company facts, metrics, or personalization.",
    "Do NOT add compliments, urgency, hype, or claims not present in the deterministic draft or allowed facts list.",
    "Do NOT attribute company-specific pain unless it appears under verified company facts.",
    "Industry context must use phrasing like 'Teams in this space often…' — never 'Company X struggles with…' unless verified.",
    "Do NOT add URLs, product features, or customer stories not in the source material.",
    `Keep the email body at or below ${maxWords} words.`,
    "Return JSON: { subject: string|null, content: string }.",
  ].join("\n")
}

export function buildOutreachRefinementUserPrompt(input: {
  draft: OutreachPersonalizationDraft
  blocks: SelectedMessageBlock[]
  allowedFacts: string[]
  verifiedFacts?: string[]
  industryFacts?: string[]
  industryContext?: GrowthIndustryContext | null
  playbookRules?: GrowthAiCopilotPlaybookResolvedRule[]
  generationType?: GrowthAiCopilotGenerationType
  maxWords: number
  avoidRepeatingTopics?: string[]
  outboundIdentity?: GrowthOutboundIdentityContext | null
  organizationKnowledge?: GrowthOutreachPersonalizationOrganizationKnowledgeBlock | null
}): string {
  const organizationKnowledge =
    input.organizationKnowledge ??
    input.industryContext?.organizationKnowledge ??
    null
  const verifiedFacts = input.verifiedFacts ?? input.industryContext?.verifiedFacts ?? []
  const industryFacts = input.industryFacts ?? input.industryContext?.industryFacts ?? []
  const regenerationDirectives = buildRegenerationFeedbackDirectives(input.industryContext?.regenerationFeedback ?? null)
  const orchestratedPrompt = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: input.industryContext ?? null,
    narrativeContext: input.industryContext?.narrativeContext ?? null,
    channel: "email",
    optimizationChannel: "REFINEMENT",
  })
  const reasoningBlock = input.industryContext?.reasoningContext?.diagnostics
    ? buildGrowthNarrativeBriefPromptBlock(
        input.industryContext.reasoningContext.diagnostics.narrativeBrief,
        input.industryContext.reasoningContext.diagnostics.messagePlan,
      )
    : ""
  const sequenceBlock = input.industryContext?.sequenceIntelligenceContext?.diagnostics.guidance
    ? buildGrowthSequenceGuidancePromptBlock(input.industryContext.sequenceIntelligenceContext.diagnostics.guidance)
    : ""
  const playbookBlock =
    input.playbookRules && input.generationType
      ? formatPlaybookRulesForCopilotPrompt(input.playbookRules, input.generationType)
      : ""

  return JSON.stringify(
    {
      task: "refine_outreach_copy",
      structure: [
        "1. Industry context (teams in this space often…)",
        "2. Verified company facts (we noticed…)",
        "3. Capability mapping (how the organization helps with industry needs…)",
        "4. Recommended CTA",
      ],
      rules: {
        allowed: ["smooth wording", "improve flow", "improve readability", "reduce spam language", "vary phrasing"],
        forbidden: [
          "invent research",
          "invent website findings",
          "invent pain points",
          "invent company facts",
          "invent personalization",
          "claim unverified company pain",
          "fake urgency",
          "hype language",
          "re-ask questions already answered in relationship memory",
        ],
        maxWords: input.maxWords,
      },
      organizationKnowledge: organizationKnowledge
        ? {
            source: organizationKnowledge.source,
            companyName: organizationKnowledge.companyName,
            productsServices: organizationKnowledge.productsServices,
            primaryValueProposition: organizationKnowledge.primaryValueProposition,
            elevatorPitch: organizationKnowledge.elevatorPitch,
            mission: organizationKnowledge.mission,
            tone: organizationKnowledge.tone,
            formality: organizationKnowledge.formality,
            wordsToAvoid: organizationKnowledge.wordsToAvoid,
            neverSay: organizationKnowledge.neverSay,
            positioning: organizationKnowledge.positioning,
            qualificationStandards: organizationKnowledge.qualificationStandards,
            competitiveAdvantages: organizationKnowledge.competitiveAdvantages,
            objections: organizationKnowledge.objections,
          }
        : null,
      industryContext: input.industryContext?.playbookApplied
        ? {
            industryId: input.industryContext.industryId,
            confidence: input.industryContext.confidence,
            displayName: input.industryContext.playbook?.displayName ?? null,
            capabilityMappings: input.industryContext.capabilityMappings.map((mapping) => ({
              capability: mapping.capability,
              painSignal: mapping.painSignal,
              industryNeutralModule: normalizeIndustryPlaybookModuleLabel(mapping.equipifyModule),
              industryFraming: mapping.industryFraming,
            })),
            recommendedCtas: input.industryContext.recommendedCtas,
            advisoryOnly: true,
          }
        : null,
      narrativeOrchestration: orchestratedPrompt
        ? {
            narrativeType: input.industryContext?.narrativeContext?.narrativeType ?? null,
            recommendedTone: orchestratedPrompt.recommendedTone,
            narrativeDirection: orchestratedPrompt.narrativeDirection,
            buyerPersona: orchestratedPrompt.buyerPersona,
            buyerPersonaFramework: orchestratedPrompt.buyerPersonaFramework,
            preferredLanguage: orchestratedPrompt.recommendedLanguage,
            preferredProof: orchestratedPrompt.preferredProof,
            preferredCta: orchestratedPrompt.preferredCta,
            topicsToAvoid: orchestratedPrompt.topicsToAvoid,
            personaDiagnostics: orchestratedPrompt.personaDiagnostics ?? null,
            accountIntelligenceDiagnostics: orchestratedPrompt.accountIntelligenceDiagnostics ?? null,
            weightingInstructions: orchestratedPrompt.weightingInstructions,
            emphasize: orchestratedPrompt.emphasize,
            avoid: orchestratedPrompt.avoid,
            formattedBlock: orchestratedPrompt.formattedBlock,
            reasoningDiagnostics: orchestratedPrompt.reasoningDiagnostics ?? null,
          }
        : null,
      narrativeBriefPlanning: reasoningBlock || undefined,
      sequenceGuidancePlanning: sequenceBlock || undefined,
      verifiedCompanyFacts: verifiedFacts,
      industryContextFacts: industryFacts,
      regenerationFeedbackDirectives: regenerationDirectives,
      copilotPlaybookRules: playbookBlock || undefined,
      deterministicDraft: {
        subject: input.draft.subject,
        body: input.draft.body,
        wordCount: input.draft.wordCount,
      },
      selectedBlocks: input.blocks.map((block) => ({
        key: block.key,
        label: block.label,
        text: block.text,
      })),
      allowedFacts: input.allowedFacts,
      avoidRepeatingTopics: input.avoidRepeatingTopics ?? [],
      outboundIdentity: input.outboundIdentity
        ? {
            displayName: input.outboundIdentity.displayName,
            title: input.outboundIdentity.title,
            company: input.outboundIdentity.company,
            personaKey: input.outboundIdentity.personaKey,
          }
        : undefined,
    },
    null,
    2,
  )
}
