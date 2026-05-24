/** Deterministic message strategy selection (Growth Engine slice 6.15B). */

import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { detectOutreachIndustry } from "@/lib/growth/outreach/personalization/industry-detection"
import {
  industryBlocksFor,
  interpolateBlockText,
  OUTREACH_MESSAGE_BLOCK_LIBRARY,
  type MessageBlockTemplate,
} from "@/lib/growth/outreach/personalization/message-blocks"
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
  const tokens = { companyName: input.packet.companyName, contactName: input.packet.decisionMakerName }

  const blocks: SelectedMessageBlock[] = [
    pickBlock(OUTREACH_MESSAGE_BLOCK_LIBRARY.opening, pick.openingId, "opening", variationKey, tokens),
    pickBlock(OUTREACH_MESSAGE_BLOCK_LIBRARY.pain, pick.painId, "pain", variationKey, tokens),
    pickBlock(industryBlocksFor(industry), pick.industryId, "industry", variationKey, tokens),
    pickBlock(OUTREACH_MESSAGE_BLOCK_LIBRARY.proof, pick.proofId, "proof", variationKey, tokens),
    pickBlock(OUTREACH_MESSAGE_BLOCK_LIBRARY.cta, pick.ctaId, "cta", variationKey, tokens),
  ]

  return {
    industry,
    angle: pick.angle,
    blocks,
    sourceSignals: input.signals,
    variationKey,
  }
}

export function buildDeterministicSubject(input: {
  packet: OutreachContextPacket
  strategy: SelectedMessageStrategy
}): string {
  const company = input.packet.companyName.trim()
  if (input.strategy.angle === "breakup_respectful") return `Closing the loop — ${company}`
  if (input.strategy.angle === "reply_response") return `Re: ${company} follow-up`
  if (input.strategy.angle === "executive_outcome") return `${company} — ops workflow review`
  if (input.strategy.industry === "hvac") return `${company} dispatch workflow`
  if (input.strategy.industry === "medical_equipment") return `${company} service visibility`
  return `${company} — quick ops note`
}
