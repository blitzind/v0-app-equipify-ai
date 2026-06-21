/** GS-AI-PLAYBOOK-4A — Buying stage messaging guidance (client-safe). */

import type {
  GrowthBuyingStage,
  GrowthBuyingStageMessagingGuidance,
  GrowthConversationState,
} from "@/lib/growth/buyer-journey/growth-buying-stage-types"
import type {
  GrowthPlaybookRankedCta,
  GrowthPlaybookRankedStoryline,
} from "@/lib/growth/playbooks/context/growth-playbook-context-types"
import type { GrowthIndustryPlaybookCapabilityMapping } from "@/lib/growth/playbooks/industry-playbook-types"

const BUYING_STAGE_GUIDANCE_BOOST = 12
const BUYING_STAGE_GUIDANCE_DEPRIORITIZE = -10

const STAGE_GUIDANCE: Record<GrowthBuyingStage, GrowthBuyingStageMessagingGuidance> = {
  unaware: {
    educate: true,
    diagnose: false,
    compareApproaches: false,
    removeFriction: false,
    reengage: false,
    preferredTone: "educational",
    preferredCtaStyles: ["discovery"],
    avoidActions: ["Demo request", "Pricing discussion", "Hard meeting ask"],
    narrativeBias: ["operational"],
  },
  problem_aware: {
    educate: false,
    diagnose: true,
    compareApproaches: false,
    removeFriction: false,
    reengage: false,
    preferredTone: "consultative",
    preferredCtaStyles: ["discovery", "workflow_review", "proof_share"],
    avoidActions: ["Demo request", "Pricing discussion"],
    narrativeBias: ["operational", "compliance"],
  },
  solution_aware: {
    educate: false,
    diagnose: true,
    compareApproaches: false,
    removeFriction: false,
    reengage: false,
    preferredTone: "consultative",
    preferredCtaStyles: ["workflow_review", "proof_share"],
    avoidActions: ["Generic demo", "Aggressive close"],
    narrativeBias: ["operational"],
  },
  evaluating: {
    educate: false,
    diagnose: false,
    compareApproaches: true,
    removeFriction: false,
    reengage: false,
    preferredTone: "direct",
    preferredCtaStyles: ["meeting", "workflow_review"],
    avoidActions: ["Vague discovery-only CTA"],
    narrativeBias: ["operational", "financial"],
  },
  buying_committee: {
    educate: false,
    diagnose: false,
    compareApproaches: true,
    removeFriction: false,
    reengage: false,
    preferredTone: "executive",
    preferredCtaStyles: ["meeting", "proof_share"],
    avoidActions: ["Single-threaded demo push"],
    narrativeBias: ["financial", "compliance"],
  },
  proposal: {
    educate: false,
    diagnose: false,
    compareApproaches: false,
    removeFriction: true,
    reengage: false,
    preferredTone: "supportive",
    preferredCtaStyles: ["meeting"],
    avoidActions: ["Re-opening broad discovery"],
    narrativeBias: ["operational"],
  },
  decision: {
    educate: false,
    diagnose: false,
    compareApproaches: false,
    removeFriction: true,
    reengage: false,
    preferredTone: "direct",
    preferredCtaStyles: ["meeting"],
    avoidActions: ["Feature dumping"],
    narrativeBias: ["financial"],
  },
  customer: {
    educate: false,
    diagnose: false,
    compareApproaches: false,
    removeFriction: false,
    reengage: false,
    preferredTone: "supportive",
    preferredCtaStyles: ["low_pressure"],
    avoidActions: ["Cold outbound framing"],
    narrativeBias: ["growth"],
  },
  dormant: {
    educate: false,
    diagnose: false,
    compareApproaches: false,
    removeFriction: false,
    reengage: true,
    preferredTone: "consultative",
    preferredCtaStyles: ["low_pressure", "proof_share"],
    avoidActions: ["Demo request", "Pricing discussion", "Pressure close"],
    narrativeBias: ["operational"],
  },
}

export function buildBuyingStageMessagingGuidance(input: {
  buyingStage: GrowthBuyingStage
  conversationState: GrowthConversationState
}): GrowthBuyingStageMessagingGuidance {
  const base = { ...STAGE_GUIDANCE[input.buyingStage] }
  if (input.conversationState === "hot") {
    base.preferredCtaStyles = ["meeting", ...base.preferredCtaStyles.filter((entry) => entry !== "meeting")]
    base.preferredTone = "direct"
  }
  if (input.conversationState === "stalled" || input.conversationState === "reengagement") {
    base.reengage = true
    base.preferredCtaStyles = ["low_pressure", "proof_share"]
    base.avoidActions = [...new Set([...base.avoidActions, "Demo request"])]
  }
  return base
}

function ctaStyleScore(cta: string, guidance: GrowthBuyingStageMessagingGuidance): number {
  const lower = cta.toLowerCase()
  let score = 0
  if (/\bdemo\b|\bshow you\b|\bwalkthrough\b/i.test(lower)) {
    score += guidance.avoidActions.some((entry) => /demo/i.test(entry))
      ? BUYING_STAGE_GUIDANCE_DEPRIORITIZE
      : 0
  }
  if (/\b(price|pricing|quote|cost)\b/i.test(lower)) {
    score += guidance.avoidActions.some((entry) => /pricing/i.test(entry))
      ? BUYING_STAGE_GUIDANCE_DEPRIORITIZE
      : 0
  }
  if (/\b(question|curious|worth|open to)\b/i.test(lower) && guidance.preferredCtaStyles.includes("discovery")) {
    score += BUYING_STAGE_GUIDANCE_BOOST
  }
  if (/\b(workflow|process|review|compare)\b/i.test(lower) && guidance.preferredCtaStyles.includes("workflow_review")) {
    score += BUYING_STAGE_GUIDANCE_BOOST
  }
  if (/\b(meeting|minutes|call|calendar)\b/i.test(lower) && guidance.preferredCtaStyles.includes("meeting")) {
    score += BUYING_STAGE_GUIDANCE_BOOST
  }
  if (/\b(case study|proof|example|compliance)\b/i.test(lower) && guidance.preferredCtaStyles.includes("proof_share")) {
    score += BUYING_STAGE_GUIDANCE_BOOST - 2
  }
  if (/\b(no pressure|when useful|if helpful)\b/i.test(lower) && guidance.preferredCtaStyles.includes("low_pressure")) {
    score += BUYING_STAGE_GUIDANCE_BOOST - 2
  }
  return score
}

export function applyBuyingStageGuidanceToRankedCtas(
  rankedCtas: GrowthPlaybookRankedCta[],
  guidance: GrowthBuyingStageMessagingGuidance,
): { rankedCtas: GrowthPlaybookRankedCta[]; boosts: string[]; deprioritized: string[] } {
  const boosts: string[] = []
  const deprioritized: string[] = []
  const rescored = rankedCtas
    .map((entry, index) => {
      const delta = ctaStyleScore(entry.cta, guidance)
      if (delta > 0) boosts.push(`Stage CTA boost: ${entry.cta.slice(0, 60)}`)
      if (delta < 0) deprioritized.push(`Stage CTA deprioritized: ${entry.cta.slice(0, 60)}`)
      return { entry, score: delta - index * 0.01 }
    })
    .sort((a, b) => b.score - a.score || a.entry.cta.localeCompare(b.entry.cta))
    .map((row, index) => ({
      ...row.entry,
      rank: (index === 0 ? "primary" : index === 1 ? "secondary" : "tertiary") as GrowthPlaybookRankedCta["rank"],
    }))
  return { rankedCtas: rescored, boosts: [...new Set(boosts)], deprioritized: [...new Set(deprioritized)] }
}

export function applyBuyingStageGuidanceToRankedStorylines(
  rankedStorylines: GrowthPlaybookRankedStoryline[],
  guidance: GrowthBuyingStageMessagingGuidance,
): { rankedStorylines: GrowthPlaybookRankedStoryline[]; boosts: string[]; deprioritized: string[] } {
  const boosts: string[] = []
  const deprioritized: string[] = []
  const rescored = rankedStorylines
    .map((entry, index) => {
      const delta = guidance.narrativeBias.includes(entry.category) ? BUYING_STAGE_GUIDANCE_BOOST : 0
      if (delta > 0) boosts.push(`Stage storyline boost: ${entry.storyline.title}`)
      return { entry, score: delta - index * 0.01 }
    })
    .sort((a, b) => b.score - a.score || a.entry.storyline.title.localeCompare(b.entry.storyline.title))
    .map((row) => row.entry)
  return { rankedStorylines: rescored, boosts: [...new Set(boosts)], deprioritized }
}

export function applyBuyingStageGuidanceToCapabilities(
  capabilities: GrowthIndustryPlaybookCapabilityMapping[],
  guidance: GrowthBuyingStageMessagingGuidance,
): { capabilities: GrowthIndustryPlaybookCapabilityMapping[]; boosts: string[]; deprioritized: string[] } {
  if (!guidance.diagnose && !guidance.compareApproaches) {
    return { capabilities, boosts: [], deprioritized: [] }
  }
  const boosts: string[] = []
  const rescored = [...capabilities]
  if (guidance.narrativeBias.includes("compliance")) {
    const match = capabilities.find((entry) => /compliance|audit|regulatory/i.test(`${entry.capability} ${entry.painSignal}`))
    if (match) boosts.push(`Stage proof boost: ${match.capability}`)
  }
  return { capabilities: rescored, boosts, deprioritized: [] }
}

export function buyingStageLabel(stage: GrowthBuyingStage): string {
  return stage
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function conversationStateLabel(state: GrowthConversationState): string {
  if (state === "first_touch") return "First Touch"
  return state.charAt(0).toUpperCase() + state.slice(1)
}
