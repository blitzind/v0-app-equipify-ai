/** Deterministic message strategy selection (Growth Engine slice 6.15B). */

import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { detectOutreachIndustry } from "@/lib/growth/outreach/personalization/industry-detection"
import {
  buildResearchBackedOpener,
} from "@/lib/growth/outreach/personalization/research-backed-opener"
import { buildMemoryBackedOpener } from "@/lib/growth/outreach/personalization/memory-backed-opener"
import {
  classifyMemoryObjection,
  hasCompetitiveMemoryRisk,
  hasMemoryRelationshipEngagement,
  prefersConciseOutreach,
  resolveMemoryInfluencedPainId,
  shouldAvoidPainBlock,
  shouldPreferMemoryOpener,
} from "@/lib/growth/outreach/personalization/memory-strategy"
import {
  industryBlocksFor,
  interpolateBlockText,
  OUTREACH_MESSAGE_BLOCK_LIBRARY,
  type MessageBlockTemplate,
} from "@/lib/growth/outreach/personalization/message-blocks"
import { selectEmailOpeningStyleId } from "@/lib/growth/outreach/personalization/email-variation-engine"
import {
  buildPersonalizationVariationKey,
  pickVariantIndex,
} from "@/lib/growth/outreach/personalization/message-variability"
import type {
  MessageAngleKey,
  MessageBlockKey,
  OutreachContextPacket,
  PersonalizationSignalKey,
  SelectedMessageBlock,
  SelectedMessageStrategy,
} from "@/lib/growth/outreach/personalization/personalization-types"
import { OUTREACH_PERSONALIZATION_STRATEGY_VERSION } from "@/lib/growth/outreach/personalization/personalization-types"

type StrategyPick = {
  angle: MessageAngleKey
  painId: string
  proofId: string
  ctaId: string
  openingId: string
  industryId: string
}

function pickBlock(
  templates: MessageBlockTemplate[],
  blockId: string,
  key: MessageBlockKey,
  variationSeed: string,
  tokens: { companyName: string; contactName: string | null },
): SelectedMessageBlock {
  const template = templates.find((entry) => entry.id === blockId) ?? templates[0]!
  const variantIndex = pickVariantIndex(`${variationSeed}:${key}:${template.id}`, template.variants.length)
  return {
    key,
    blockId: template.id,
    label: template.label,
    text: interpolateBlockText(template.variants[variantIndex] ?? template.variants[0]!, tokens),
  }
}

function resolveStrategyPick(input: {
  packet: OutreachContextPacket
  signals: PersonalizationSignalKey[]
  generationType: GrowthAiCopilotGenerationType
}): StrategyPick {
  const industry = detectOutreachIndustry(input.packet)
  const defaultIndustryId = industryBlocksFor(industry)[0]?.id ?? "general_ops"

  if (input.packet.memoryAvailable) {
    let memoryPain = resolveMemoryInfluencedPainId(input.packet)
    if (memoryPain && shouldAvoidPainBlock(memoryPain, input.packet)) {
      memoryPain = "service_visibility"
      if (shouldAvoidPainBlock(memoryPain, input.packet)) memoryPain = null
    }

    if (
      input.generationType === "follow_up_email" ||
      input.generationType === "reengagement_email" ||
      input.generationType === "next_message"
    ) {
      if (hasMemoryRelationshipEngagement(input.packet) || input.packet.relationshipStage === "evaluating") {
        return {
          angle: "engagement_follow_up",
          openingId: "opening_follow_up",
          painId: memoryPain ?? "service_visibility",
          proofId: "workflow_proof",
          ctaId: prefersConciseOutreach(input.packet) ? "fifteen_minute" : "operations_review",
          industryId: defaultIndustryId,
        }
      }
    }

    if (memoryPain && input.generationType === "cold_email") {
      return {
        angle: memoryPain === "dispatch_manual" ? "dispatch_pain_capacity" : "capacity_growth_ops",
        openingId: hasMemoryRelationshipEngagement(input.packet) ? "opening_follow_up" : "opening_context",
        painId: memoryPain,
        proofId: memoryPain === "capacity_strain" ? "capacity_proof" : "workflow_proof",
        ctaId: prefersConciseOutreach(input.packet) ? "fifteen_minute" : "operations_review",
        industryId: defaultIndustryId,
      }
    }

    if (hasCompetitiveMemoryRisk(input.packet) && input.generationType === "executive_email") {
      return {
        angle: "executive_outcome",
        openingId: "opening_context",
        painId: memoryPain ?? "capacity_strain",
        proofId: "capacity_proof",
        ctaId: "operations_review",
        industryId: defaultIndustryId,
      }
    }
  }

  if (input.generationType === "response_draft") {
    return {
      angle: "reply_response",
      openingId: "opening_follow_up",
      painId: "service_visibility",
      proofId: "workflow_proof",
      ctaId: "operations_review",
      industryId: industryBlocksFor(industry)[0]?.id ?? "general_ops",
    }
  }

  if (input.generationType === "breakup_email") {
    return {
      angle: "breakup_respectful",
      openingId: "opening_direct",
      painId: "capacity_strain",
      proofId: "workflow_proof",
      ctaId: "quick_walkthrough",
      industryId: industryBlocksFor(industry)[0]?.id ?? "general_ops",
    }
  }

  if (input.generationType === "executive_email") {
    return {
      angle: "executive_outcome",
      openingId: "opening_context",
      painId: "capacity_strain",
      proofId: "capacity_proof",
      ctaId: "operations_review",
      industryId: industryBlocksFor(industry)[0]?.id ?? "general_ops",
    }
  }

  if (input.generationType === "follow_up_email" || input.generationType === "reengagement_email") {
    return {
      angle: "engagement_follow_up",
      openingId: "opening_follow_up",
      painId: input.signals.includes("dispatch_appears_manual") ? "dispatch_manual" : "service_visibility",
      proofId: "workflow_proof",
      ctaId: "fifteen_minute",
      industryId: industryBlocksFor(industry)[0]?.id ?? "general_ops",
    }
  }

  if (industry === "medical_equipment") {
    return {
      angle: "service_visibility_workflow",
      openingId: "opening_context",
      painId: "service_visibility",
      proofId: "workflow_proof",
      ctaId: "operations_review",
      industryId: "medical_ops",
    }
  }

  if (industry === "hvac" && input.signals.includes("dispatch_appears_manual")) {
    return {
      angle: "dispatch_pain_capacity",
      openingId: "opening_context",
      painId: "dispatch_manual",
      proofId: "capacity_proof",
      ctaId: "fifteen_minute",
      industryId: "hvac_ops",
    }
  }

  if (input.signals.includes("capacity_growth_signal")) {
    return {
      angle: "capacity_growth_ops",
      openingId: "opening_context",
      painId: "capacity_strain",
      proofId: "capacity_proof",
      ctaId: "operations_review",
      industryId: industryBlocksFor(industry)[0]?.id ?? "general_ops",
    }
  }

  if (input.signals.includes("field_operations_signal")) {
    return {
      angle: "field_ops_efficiency",
      openingId: "opening_context",
      painId: input.signals.includes("manual_process_signal") ? "scheduling_gaps" : "service_visibility",
      proofId: "field_ops_proof",
      ctaId: "quick_walkthrough",
      industryId: industryBlocksFor(industry)[0]?.id ?? "general_ops",
    }
  }

  return {
    angle: "service_visibility_workflow",
    openingId: "opening_direct",
    painId: input.signals.includes("website_has_no_scheduler") ? "scheduling_gaps" : "service_visibility",
    proofId: "workflow_proof",
    ctaId: "fifteen_minute",
    industryId: industryBlocksFor(industry)[0]?.id ?? "general_ops",
  }
}

export function selectMessageStrategy(input: {
  leadId: string
  packet: OutreachContextPacket
  signals: PersonalizationSignalKey[]
  generationType: GrowthAiCopilotGenerationType
}): SelectedMessageStrategy {
  const industry = detectOutreachIndustry(input.packet)
  const pick = resolveStrategyPick(input)
  const variationKey = buildPersonalizationVariationKey({
    leadId: input.leadId,
    generationType: input.generationType,
    strategyVersion: OUTREACH_PERSONALIZATION_STRATEGY_VERSION,
    angle: pick.angle,
  })
  const openingId = selectEmailOpeningStyleId({
    variationSeed: variationKey,
    packet: input.packet,
    signals: input.signals,
    generationType: input.generationType,
    fallbackOpeningId: pick.openingId,
  })
  const tokens = { companyName: input.packet.companyName, contactName: input.packet.decisionMakerName }

  const blocks: SelectedMessageBlock[] = [
    pickBlock(OUTREACH_MESSAGE_BLOCK_LIBRARY.opening, openingId, "opening", variationKey, tokens),
    pickBlock(OUTREACH_MESSAGE_BLOCK_LIBRARY.pain, pick.painId, "pain", variationKey, tokens),
    pickBlock(industryBlocksFor(industry), pick.industryId, "industry", variationKey, tokens),
    pickBlock(OUTREACH_MESSAGE_BLOCK_LIBRARY.proof, pick.proofId, "proof", variationKey, tokens),
    pickBlock(OUTREACH_MESSAGE_BLOCK_LIBRARY.cta, pick.ctaId, "cta", variationKey, tokens),
  ]

  const researchOpener = buildResearchBackedOpener({
    packet: input.packet,
    generationType: input.generationType,
    openingBlockId: openingId,
    variationSeed: variationKey,
    tokens,
  })

  const memoryOpener = buildMemoryBackedOpener({
    packet: input.packet,
    generationType: input.generationType,
    variationSeed: variationKey,
    tokens,
  })

  const useMemoryOpener =
    memoryOpener != null &&
    (shouldPreferMemoryOpener(input.packet, input.generationType) || researchOpener == null)

  if (useMemoryOpener && memoryOpener) {
    const openingIndex = blocks.findIndex((block) => block.key === "opening")
    if (openingIndex >= 0) {
      blocks[openingIndex] = {
        ...blocks[openingIndex],
        blockId: "opening_memory_backed",
        label: "Memory-backed opener",
        text: memoryOpener.text,
      }
    }
  } else if (researchOpener) {
    const openingIndex = blocks.findIndex((block) => block.key === "opening")
    if (openingIndex >= 0) {
      blocks[openingIndex] = {
        ...blocks[openingIndex],
        blockId: "opening_research_backed",
        label: "Research-backed opener",
        text: researchOpener.text,
      }
    }
  }

  const industryIndex = blocks.findIndex((block) => block.key === "industry")
  if (industryIndex >= 0) {
    let industryText = blocks[industryIndex].text
    if (input.packet.outreachAngles.length > 0) {
      industryText = `${industryText} ${input.packet.outreachAngles[0]!.trim()}.`
    }
    if (input.packet.memoryCommitteeSummaries.length > 0) {
      industryText = `${industryText} Committee context: ${input.packet.memoryCommitteeSummaries[0]!.trim()}.`
    }
    if (industryText !== blocks[industryIndex].text) {
      blocks[industryIndex] = { ...blocks[industryIndex], text: industryText }
    }
  }

  if (input.packet.researchRecommendedNextAction?.trim()) {
    const proofIndex = blocks.findIndex((block) => block.key === "proof")
    if (proofIndex >= 0) {
      blocks[proofIndex] = {
        ...blocks[proofIndex],
        text: `${blocks[proofIndex].text} Recommended next step from research: ${input.packet.researchRecommendedNextAction.trim()}.`,
      }
    }
  }

  const memoryPainUsed = Boolean(input.packet.memoryAvailable && resolveMemoryInfluencedPainId(input.packet))
  const objectionCategory = classifyMemoryObjection(input.packet)

  return {
    industry,
    angle: pick.angle,
    blocks,
    sourceSignals: input.signals,
    variationKey,
    researchOpener: !useMemoryOpener && researchOpener
      ? {
          source: researchOpener.source,
          evidence: researchOpener.evidence,
          confidenceTier: researchOpener.confidenceTier,
        }
      : undefined,
    memoryOpener: useMemoryOpener && memoryOpener
      ? {
          source: memoryOpener.source,
          evidence: memoryOpener.evidence,
        }
      : undefined,
    memoryInfluence: input.packet.memoryAvailable
      ? {
          painInfluenced: memoryPainUsed,
          objectionAware: objectionCategory != null,
          styleApplied: false,
          avoidedTopics: input.packet.memoryAvoidRepeating.slice(0, 3),
          committeeReferenced: input.packet.memoryCommitteeSummaries.length > 0,
        }
      : undefined,
  }
}

export { buildLegacyDeterministicSubject as buildDeterministicSubject } from "@/lib/growth/outreach/personalization/subject-intelligence"
