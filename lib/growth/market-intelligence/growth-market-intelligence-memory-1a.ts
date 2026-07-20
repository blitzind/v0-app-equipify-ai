/** GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A — Loop memory via org memory preferences (client-safe). */

import type { AvaOrganizationalMemoryStore } from "@/lib/growth/memory/types"
import {
  GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
  GROWTH_MARKET_INTELLIGENCE_LOOP_MEMORY_PREFERENCE_KEY,
  GROWTH_MARKET_INTELLIGENCE_PROPOSAL_COOLDOWN_DAYS,
  type MarketIntelligenceLoopMemory,
  type MarketIntelligenceProposal,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"

export function emptyMarketIntelligenceLoopMemory(): MarketIntelligenceLoopMemory {
  return {
    qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
    lastEvaluatedAt: null,
    lastProposalId: null,
    lastProposalAt: null,
    lastAcceptedProposalId: null,
    lastAcceptedAt: null,
    pendingProposalId: null,
    pendingProfileDraftId: null,
  }
}

export function parseMarketIntelligenceLoopMemoryFromStore(
  store: AvaOrganizationalMemoryStore | null | undefined,
): MarketIntelligenceLoopMemory {
  const empty = emptyMarketIntelligenceLoopMemory()
  const preference = store?.preferences.find(
    (row) => row.key === GROWTH_MARKET_INTELLIGENCE_LOOP_MEMORY_PREFERENCE_KEY,
  )
  if (!preference?.statement?.trim()) return empty

  try {
    const parsed = JSON.parse(preference.statement) as Partial<MarketIntelligenceLoopMemory>
    return {
      qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
      lastEvaluatedAt: typeof parsed.lastEvaluatedAt === "string" ? parsed.lastEvaluatedAt : null,
      lastProposalId: typeof parsed.lastProposalId === "string" ? parsed.lastProposalId : null,
      lastProposalAt: typeof parsed.lastProposalAt === "string" ? parsed.lastProposalAt : null,
      lastAcceptedProposalId:
        typeof parsed.lastAcceptedProposalId === "string" ? parsed.lastAcceptedProposalId : null,
      lastAcceptedAt: typeof parsed.lastAcceptedAt === "string" ? parsed.lastAcceptedAt : null,
      pendingProposalId: typeof parsed.pendingProposalId === "string" ? parsed.pendingProposalId : null,
      pendingProfileDraftId:
        typeof parsed.pendingProfileDraftId === "string" ? parsed.pendingProfileDraftId : null,
    }
  } catch {
    return empty
  }
}

export function serializeMarketIntelligenceLoopMemory(memory: MarketIntelligenceLoopMemory): string {
  return JSON.stringify(memory)
}

export function marketIntelligenceLoopMemoryPreferencePayload(memory: MarketIntelligenceLoopMemory) {
  return {
    id: "pref:market-intelligence-loop-1a",
    key: GROWTH_MARKET_INTELLIGENCE_LOOP_MEMORY_PREFERENCE_KEY,
    statement: serializeMarketIntelligenceLoopMemory(memory),
    importance: 5,
    source: "learning" as const,
  }
}

export function shouldSkipMarketIntelligenceProposalCreation(input: {
  memory: MarketIntelligenceLoopMemory
  proposal: MarketIntelligenceProposal
  generatedAt: string
}): { skip: boolean; reason: string | null } {
  if (input.memory.pendingProposalId) {
    return { skip: true, reason: "A strategic proposal is already pending operator review." }
  }

  if (input.memory.lastProposalAt) {
    const lastAt = new Date(input.memory.lastProposalAt).getTime()
    const now = new Date(input.generatedAt).getTime()
    const cooldownMs = GROWTH_MARKET_INTELLIGENCE_PROPOSAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    if (now - lastAt < cooldownMs) {
      return { skip: true, reason: "Proposal cooldown active — avoiding operator spam." }
    }
  }

  return { skip: false, reason: null }
}

export function recordMarketIntelligenceEvaluationMemory(input: {
  memory: MarketIntelligenceLoopMemory
  generatedAt: string
}): MarketIntelligenceLoopMemory {
  return {
    ...input.memory,
    qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
    lastEvaluatedAt: input.generatedAt,
  }
}

export function recordMarketIntelligenceProposalMemory(input: {
  memory: MarketIntelligenceLoopMemory
  proposal: MarketIntelligenceProposal
  profileDraftId: string | null
}): MarketIntelligenceLoopMemory {
  return {
    ...input.memory,
    qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
    lastProposalId: input.proposal.proposalId,
    lastProposalAt: input.proposal.createdAt,
    pendingProposalId: input.proposal.proposalId,
    pendingProfileDraftId: input.profileDraftId,
  }
}

export function recordMarketIntelligenceAcceptedMemory(input: {
  memory: MarketIntelligenceLoopMemory
  proposalId: string
  acceptedAt: string
}): MarketIntelligenceLoopMemory {
  return {
    ...input.memory,
    qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
    lastAcceptedProposalId: input.proposalId,
    lastAcceptedAt: input.acceptedAt,
    pendingProposalId: null,
    pendingProfileDraftId: null,
  }
}
