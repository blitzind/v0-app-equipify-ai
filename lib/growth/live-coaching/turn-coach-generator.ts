/** Deterministic turn coach — responds to the prospect's last statement within stage. */

import { phraseViolatesStagePolicy } from "@/lib/growth/live-coaching/stage-coaching-policy"
import { lastCustomerFacingTranscriptEvent } from "@/lib/growth/live-coaching/prospect-turn-detection"
import {
  CONVERSATION_STAGE_OBJECTIVES,
  type ConversationCoachTurn,
  type ConversationStage,
} from "@/lib/growth/live-coaching/types"
import type { GrowthRealtimeLiveSnapshot, GrowthRealtimeTranscriptEvent } from "@/lib/growth/realtime/realtime-call-types"

function trimPhrase(value: string, max = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= max) return normalized
  const cut = normalized.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > 50 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function lastProspectEvent(
  events: GrowthRealtimeTranscriptEvent[],
  previousCoach?: ConversationCoachTurn | null,
): GrowthRealtimeTranscriptEvent | null {
  return lastCustomerFacingTranscriptEvent(events, { previousCoach })
}

function extractTopicSnippet(content: string): string {
  const trimmed = content.trim()
  if (trimmed.length <= 60) return trimmed
  return `${trimmed.slice(0, 57).trim()}…`
}

function buildStageDefault(stage: ConversationStage, inbound: boolean): { phrase: string; rationale: string } {
  switch (stage) {
    case "rapport":
      return inbound
        ? {
            phrase: "Thanks for calling — what prompted you to reach out today?",
            rationale: "Inbound call just connected; open with context before discovery.",
          }
        : {
            phrase: "Before we dive in — what's happening on your side that made this worth a conversation?",
            rationale: "Early outbound call; establish why they're taking the meeting.",
          }
    case "discovery":
      return {
        phrase: "Walk me through how you're handling this today — what does a typical week look like?",
        rationale: "Discovery stage; understand current state before probing pain.",
      }
    case "pain":
      return {
        phrase: "When that happens, what's the first thing that breaks for your team?",
        rationale: "Pain surfaced; deepen specificity before impact or solution.",
      }
    case "impact":
      return {
        phrase: "If this stayed the same for another quarter, what would that cost you — time, revenue, or morale?",
        rationale: "Quantify impact before discussing solution or budget.",
      }
    case "solution_fit":
      return {
        phrase: "Based on what you shared, would it help if I showed how teams like yours solve this?",
        rationale: "Pain and impact are clear; bridge to solution relevance.",
      }
    case "buying_process":
      return {
        phrase: "Besides yourself, who else would weigh in before a decision like this?",
        rationale: "Solution interest present; map stakeholders appropriately.",
      }
    case "close":
      return {
        phrase: "Would it make sense to schedule a working session next week to outline next steps?",
        rationale: "Buying intent is warm; propose a concrete next step.",
      }
  }
}

function respondToProspectUtterance(input: {
  content: string
  stage: ConversationStage
  snapshot: GrowthRealtimeLiveSnapshot
}): { phrase: string; rationale: string } | null {
  const { content, stage, snapshot } = input
  const snippet = extractTopicSnippet(content)

  if (/\b(price|pricing|cost|expensive|budget)\b/i.test(content)) {
    if (stage === "rapport" || stage === "discovery") {
      return {
        phrase: "Totally fair — before we talk numbers, help me understand what problem you're trying to solve.",
        rationale: "Prospect raised price early; redirect to pain before budget talk.",
      }
    }
    return {
      phrase: "Compared to what you're doing today, what feels expensive about solving this?",
      rationale: "Pricing came up; anchor value before defending price.",
    }
  }

  if (/\b(not interested|busy|bad time|call back)\b/i.test(content)) {
    return {
      phrase: "Understood — what's the one thing that would make a follow-up worth your time?",
      rationale: "Prospect pushed back; respect timing while keeping a thread open.",
    }
  }

  if (/\b(already|current vendor|using|competitor)\b/i.test(content)) {
    const competitor = snapshot.competitorGuidance[0]?.competitor ?? "your current setup"
    return {
      phrase: `Got it — what would you improve about ${competitor} if you could?`,
      rationale: "Prospect mentioned incumbent; explore gaps without trash-talking.",
    }
  }

  if (PAIN_IN_PROSPECT.test(content)) {
    return {
      phrase: `When you say "${snippet.toLowerCase()}", what's the hardest part day to day?`,
      rationale: "Prospect named a pain; reflect their words and go deeper.",
    }
  }

  if (/\b(we need|looking for|trying to|want to|goal is)\b/i.test(content)) {
    return {
      phrase: "What would success look like if this worked exactly the way you want?",
      rationale: "Prospect stated a goal; clarify success criteria before pitching.",
    }
  }

  if (/\?\s*$/.test(content)) {
    return {
      phrase: "Great question — before I answer, what's driving that concern on your side?",
      rationale: "Prospect asked a question; answer with a clarifying question first.",
    }
  }

  return null
}

const PAIN_IN_PROSPECT = /\b(problem|pain|struggle|manual|broken|hard|slow|frustrat|issue|can't|cannot)\b/i

export function generateDeterministicCoachTurn(input: {
  events: GrowthRealtimeTranscriptEvent[]
  stage: ConversationStage
  snapshot: GrowthRealtimeLiveSnapshot
  inbound?: boolean
  triggeredBySequenceNumber?: number | null
  previousCoach?: ConversationCoachTurn | null
}): ConversationCoachTurn {
  const now = new Date().toISOString()
  const stageObjective = CONVERSATION_STAGE_OBJECTIVES[input.stage]
  const prospectEvent = lastProspectEvent(input.events, input.previousCoach)

  if (prospectEvent) {
    const tailored = respondToProspectUtterance({
      content: prospectEvent.content,
      stage: input.stage,
      snapshot: input.snapshot,
    })
    if (tailored && !phraseViolatesStagePolicy(input.stage, tailored.phrase)) {
      return {
        primaryPhrase: trimPhrase(tailored.phrase),
        rationale: tailored.rationale,
        stage: input.stage,
        stageObjective,
        evidenceQuote: extractTopicSnippet(prospectEvent.content),
        triggeredBySequenceNumber: prospectEvent.sequenceNumber,
        source: "deterministic",
        confidence: prospectEvent.speaker === "prospect" ? 0.78 : 0.62,
        updatedAt: now,
      }
    }

    const snippet = extractTopicSnippet(prospectEvent.content)
    const reflectPhrase = trimPhrase(
      `Got it — when you mention "${snippet.toLowerCase()}", what's the main thing you're trying to solve?`,
    )
    if (!phraseViolatesStagePolicy(input.stage, reflectPhrase)) {
      return {
        primaryPhrase: reflectPhrase,
        rationale: "Reflect the customer's latest statement and invite them to expand.",
        stage: input.stage,
        stageObjective,
        evidenceQuote: snippet,
        triggeredBySequenceNumber: prospectEvent.sequenceNumber,
        source: "deterministic",
        confidence: prospectEvent.speaker === "prospect" ? 0.74 : 0.6,
        updatedAt: now,
      }
    }
  }

  const fallback = buildStageDefault(input.stage, input.inbound ?? false)
  return {
    primaryPhrase: trimPhrase(fallback.phrase),
    rationale: fallback.rationale,
    stage: input.stage,
    stageObjective,
    evidenceQuote: prospectEvent ? extractTopicSnippet(prospectEvent.content) : null,
    triggeredBySequenceNumber:
      input.triggeredBySequenceNumber ?? prospectEvent?.sequenceNumber ?? null,
    source: "deterministic",
    confidence: 0.7,
    updatedAt: now,
  }
}

export function buildInboundBootstrapCoachTurn(): ConversationCoachTurn {
  const now = new Date().toISOString()
  return {
    primaryPhrase: "Thanks for calling — what prompted you to reach out today?",
    rationale: "Inbound call just connected; open with context before discovery.",
    stage: "rapport",
    stageObjective: CONVERSATION_STAGE_OBJECTIVES.rapport,
    evidenceQuote: null,
    triggeredBySequenceNumber: null,
    source: "bootstrap",
    confidence: 0.9,
    updatedAt: now,
  }
}

export function buildOutboundBootstrapCoachTurn(): ConversationCoachTurn {
  const now = new Date().toISOString()
  return {
    primaryPhrase: "Appreciate you taking the time — what's top of mind for you today?",
    rationale: "Call connected; open with rapport before structured discovery.",
    stage: "rapport",
    stageObjective: CONVERSATION_STAGE_OBJECTIVES.rapport,
    evidenceQuote: null,
    triggeredBySequenceNumber: null,
    source: "bootstrap",
    confidence: 0.88,
    updatedAt: now,
  }
}
