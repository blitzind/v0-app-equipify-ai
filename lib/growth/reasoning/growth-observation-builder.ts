/** GS-AI-PLAYBOOK-4B — Observation builder (client-safe). */

import { buyingStageLabel, conversationStateLabel } from "@/lib/growth/buyer-journey/growth-buying-stage-guidance"
import { nextBestActionLabel } from "@/lib/growth/buyer-journey/growth-next-best-action"
import { buildVerifiedFactsFromContextPacket } from "@/lib/growth/outreach/personalization/allowed-facts-from-context-packet"
import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import type {
  GrowthReasoningChannel,
  GrowthReasoningObservation,
  GrowthReasoningObservationCategory,
} from "@/lib/growth/reasoning/growth-reasoning-types"
import type { GrowthSequenceGuidance } from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"
import { ctaStageLabel } from "@/lib/growth/sequence-intelligence/growth-cta-progression"
import { narrativeThemeLabel } from "@/lib/growth/sequence-intelligence/growth-narrative-progression"
import { proofStageLabel } from "@/lib/growth/sequence-intelligence/growth-proof-progression"
import { sequenceStateLabel } from "@/lib/growth/sequence-intelligence/growth-sequence-state"

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function addObservation(
  bucket: GrowthReasoningObservation[],
  input: {
    category: GrowthReasoningObservationCategory
    statement: string
    confidence: number
    importance: number
    freshness?: number
  },
): void {
  const statement = input.statement.trim()
  if (statement.length < 8) return
  if (bucket.some((entry) => entry.statement.toLowerCase() === statement.toLowerCase())) return
  bucket.push({
    id: `${input.category}_${bucket.length + 1}`,
    category: input.category,
    statement,
    confidence: clamp(input.confidence),
    importance: clamp(input.importance),
    freshness: clamp(input.freshness ?? 70),
  })
}

export function buildGrowthReasoningObservations(input: {
  packet: OutreachContextPacket
  channel: GrowthReasoningChannel
  sequenceGuidance?: GrowthSequenceGuidance | null
}): GrowthReasoningObservation[] {
  const observations: GrowthReasoningObservation[] = []
  const packet = input.packet
  const industry = packet.industryContext

  for (const fact of buildVerifiedFactsFromContextPacket(packet).slice(0, 4)) {
    addObservation(observations, {
      category: "verified_company",
      statement: fact.replace(/^(Summary|Website|Service focus|Observed):\s*/i, "").trim(),
      confidence: 88,
      importance: 92,
      freshness: 85,
    })
  }

  for (const fact of (industry?.verifiedFacts ?? []).slice(0, 3)) {
    addObservation(observations, {
      category: "verified_company",
      statement: fact,
      confidence: 86,
      importance: 90,
      freshness: 82,
    })
  }

  for (const fact of industry?.industryFacts.slice(0, 2) ?? []) {
    addObservation(observations, {
      category: "industry",
      statement: fact,
      confidence: 72,
      importance: 68,
      freshness: 75,
    })
  }

  if (industry?.playbook?.displayName) {
    addObservation(observations, {
      category: "industry",
      statement: `Industry playbook applied: ${industry.playbook.displayName}.`,
      confidence: clamp(industry.confidence),
      importance: 64,
      freshness: 80,
    })
  }

  const persona = industry?.personaMessagingContext
  if (persona) {
    addObservation(observations, {
      category: "persona",
      statement: `${persona.framework.persona.title} persona detected (${persona.framework.archetype.replace(/_/g, " ")}).`,
      confidence: persona.diagnostics.confidence === "high" ? 86 : persona.diagnostics.confidence === "medium" ? 72 : 58,
      importance: 84,
      freshness: 78,
    })
    if (persona.diagnostics.preferredProof) {
      addObservation(observations, {
        category: "persona",
        statement: `Preferred proof: ${persona.diagnostics.preferredProof.split(";")[0]?.trim()}.`,
        confidence: 70,
        importance: 62,
        freshness: 75,
      })
    }
  }

  const account = industry?.accountIntelligenceContext
  if (account?.model.companySummary.length) {
    for (const summary of account.model.companySummary.slice(0, 2)) {
      addObservation(observations, {
        category: "account",
        statement: summary,
        confidence: clamp(account.model.confidence),
        importance: 80,
        freshness: 76,
      })
    }
  }
  for (const signal of account?.model.operationalSignals.slice(0, 2) ?? []) {
    addObservation(observations, {
      category: "account",
      statement: signal,
      confidence: clamp(account.model.confidence),
      importance: 74,
      freshness: 72,
    })
  }

  const journey = industry?.buyerJourneyContext
  if (journey) {
    addObservation(observations, {
      category: "buyer_journey",
      statement: `Buyer appears ${buyingStageLabel(journey.buyingStage.stage).toLowerCase()}.`,
      confidence: journey.buyingStage.confidenceScore,
      importance: 88,
      freshness: 80,
    })
    addObservation(observations, {
      category: "buyer_journey",
      statement: `Conversation state: ${conversationStateLabel(journey.conversationState.state).toLowerCase()}.`,
      confidence: journey.conversationState.confidenceScore,
      importance: 82,
      freshness: 78,
    })
    addObservation(observations, {
      category: "buyer_journey",
      statement: `Next best action: ${nextBestActionLabel(journey.nextBestActions.primaryAction)}.`,
      confidence: 76,
      importance: 78,
      freshness: 80,
    })
  }

  if ((packet.priorTouchCount ?? 0) > 0) {
    addObservation(observations, {
      category: "engagement",
      statement: `${packet.priorTouchCount} prior touch${packet.priorTouchCount === 1 ? "" : "es"} recorded.`,
      confidence: 80,
      importance: 70,
      freshness: 65,
    })
  }
  if (packet.priorReplySummaries.length > 0) {
    addObservation(observations, {
      category: "engagement",
      statement: "Prospect has replied in prior outreach.",
      confidence: 90,
      importance: 92,
      freshness: 88,
    })
  } else if ((packet.engagementScore ?? 0) >= 40) {
    addObservation(observations, {
      category: "engagement",
      statement: "Prior email engagement detected.",
      confidence: clamp(packet.engagementScore ?? 55),
      importance: 76,
      freshness: 70,
    })
  }

  if (packet.memoryAvailable) {
    if (packet.relationshipSummary) {
      addObservation(observations, {
        category: "memory",
        statement: packet.relationshipSummary,
        confidence: clamp(packet.memoryCoverageScore ?? 60),
        importance: 78,
        freshness: 68,
      })
    }
    for (const loop of packet.memoryOpenLoopSummaries.slice(0, 2)) {
      addObservation(observations, {
        category: "memory",
        statement: `Open loop: ${loop}`,
        confidence: 72,
        importance: 74,
        freshness: 66,
      })
    }
    for (const objection of packet.objectionSummaries.slice(0, 1)) {
      addObservation(observations, {
        category: "memory",
        statement: `Objection noted: ${objection}`,
        confidence: 78,
        importance: 80,
        freshness: 70,
      })
    }
  }

  const outcome = industry?.outcomeGuidanceContext
  if (outcome?.guidance.preferredCtaTypes.length) {
    addObservation(observations, {
      category: "outcome_guidance",
      statement: `Outcome guidance favors ${outcome.guidance.preferredCtaTypes[0]?.replace(/_/g, " ")} CTAs.`,
      confidence: outcome.guidance.confidence === "high" ? 82 : outcome.guidance.confidence === "medium" ? 68 : 55,
      importance: 66,
      freshness: clamp(100 - outcome.guidance.freshnessDays),
    })
  }
  for (const pattern of outcome?.diagnostics.winningPatterns.slice(0, 2) ?? []) {
    addObservation(observations, {
      category: "outcome_guidance",
      statement: `Winning pattern: ${pattern}.`,
      confidence: 70,
      importance: 64,
      freshness: clamp(100 - (outcome?.guidance.freshnessDays ?? 30)),
    })
  }

  for (const pain of packet.researchPainPoints.slice(0, 2)) {
    addObservation(observations, {
      category: "industry",
      statement: pain.endsWith(".") ? pain : `${pain}.`,
      confidence: 68,
      importance: 72,
      freshness: 74,
    })
  }

  const sequence = input.sequenceGuidance
  if (sequence) {
    addObservation(observations, {
      category: "sequence",
      statement: `Sequence state: ${sequenceStateLabel(sequence.sequenceState)} (touch ${packet.priorTouchCount}).`,
      confidence: sequence.confidence,
      importance: 86,
      freshness: 78,
    })
    addObservation(observations, {
      category: "sequence",
      statement: `Recommended narrative: ${narrativeThemeLabel(sequence.nextNarrative)}.`,
      confidence: 76,
      importance: 80,
      freshness: 80,
    })
    addObservation(observations, {
      category: "sequence",
      statement: `Recommended proof: ${proofStageLabel(sequence.nextProof)}.`,
      confidence: 74,
      importance: 76,
      freshness: 78,
    })
    addObservation(observations, {
      category: "sequence",
      statement: `Recommended CTA: ${ctaStageLabel(sequence.nextCta)}.`,
      confidence: 78,
      importance: 82,
      freshness: 80,
    })
    if (sequence.fatigueLevel !== "none") {
      addObservation(observations, {
        category: "sequence",
        statement: `Sequence fatigue: ${sequence.fatigueLevel}.`,
        confidence: 72,
        importance: 84,
        freshness: 70,
      })
    }
  }

  return observations
}
