/** Conversation stage classifier — deterministic, transcript-driven. */

import type { GrowthRealtimeLiveSnapshot, GrowthRealtimeTranscriptEvent } from "@/lib/growth/realtime/realtime-call-types"
import {
  CONVERSATION_STAGE_OBJECTIVES,
  type ConversationStage,
} from "@/lib/growth/live-coaching/types"

const STAGE_ORDER: ConversationStage[] = [
  "rapport",
  "discovery",
  "pain",
  "impact",
  "solution_fit",
  "buying_process",
  "close",
]

const PAIN_SIGNAL = /\b(problem|pain|struggle|frustrat|manual|broken|hard|difficult|slow|inefficient|chaos|overwhelm|bottleneck|issue|can't|cannot)\b/i
const IMPACT_SIGNAL = /\b(cost|lose|losing|hours|revenue|margin|waste|delay|impact|money|expensive|productivity)\b/i
const SOLUTION_SIGNAL = /\b(how would|would this|does it|can it|integrate|fit|work for|compare|demo|show me|walk me through)\b/i
const BUYING_PROCESS_SIGNAL = /\b(approv|procurement|legal|committee|stakeholder|decision|sign.?off|buying|vendor|contract)\b/i
const CLOSE_SIGNAL = /\b(next step|schedule|calendar|send|proposal|pilot|move forward|this week|tomorrow)\b/i

export type ConversationStageResult = {
  stage: ConversationStage
  stageObjective: string
  confidence: number
  transitionReason: string
}

function stageIndex(stage: ConversationStage): number {
  return STAGE_ORDER.indexOf(stage)
}

function maxStage(a: ConversationStage, b: ConversationStage): ConversationStage {
  return stageIndex(a) >= stageIndex(b) ? a : b
}

function transcriptText(events: GrowthRealtimeTranscriptEvent[]): string {
  return events.map((event) => event.content).join("\n")
}

function prospectText(events: GrowthRealtimeTranscriptEvent[]): string {
  return events.filter((event) => event.speaker === "prospect").map((event) => event.content).join("\n")
}

function inferCandidateStage(input: {
  events: GrowthRealtimeTranscriptEvent[]
  snapshot: GrowthRealtimeLiveSnapshot
}): { stage: ConversationStage; reason: string } {
  const { events, snapshot } = input
  const all = transcriptText(events)
  const prospect = prospectText(events)
  const turnCount = events.length

  if (
    snapshot.buyingSignals.some((signal) =>
      ["commitment_language", "timeline_urgency", "implementation_signal"].includes(signal.key),
    ) &&
    CLOSE_SIGNAL.test(all)
  ) {
    return { stage: "close", reason: "Commitment language with next-step intent" }
  }

  if (BUYING_PROCESS_SIGNAL.test(all) || snapshot.discovery.covered.includes("decision_maker_confirmed")) {
    return { stage: "buying_process", reason: "Buying process or authority signals detected" }
  }

  if (SOLUTION_SIGNAL.test(all) || snapshot.buyingSignals.some((signal) => signal.key === "pricing_interest")) {
    return { stage: "solution_fit", reason: "Solution-fit or product evaluation language" }
  }

  if (IMPACT_SIGNAL.test(prospect) || snapshot.objections.some((entry) => entry.key === "budget_concern")) {
    return { stage: "impact", reason: "Business impact or cost language from prospect" }
  }

  if (PAIN_SIGNAL.test(prospect) || snapshot.objections.length > 0) {
    return { stage: "pain", reason: "Pain or objection language detected" }
  }

  if (turnCount >= 3 || /\b(we|our team|currently|today|right now)\b/i.test(prospect)) {
    return { stage: "discovery", reason: "Enough context to explore situation" }
  }

  return { stage: "rapport", reason: "Early call — establish context first" }
}

export function classifyConversationStage(input: {
  events: GrowthRealtimeTranscriptEvent[]
  snapshot: GrowthRealtimeLiveSnapshot
  previousStage?: ConversationStage | null
}): ConversationStageResult {
  const candidate = inferCandidateStage(input)
  const stage = input.previousStage
    ? maxStage(input.previousStage, candidate.stage)
    : candidate.stage

  return {
    stage,
    stageObjective: CONVERSATION_STAGE_OBJECTIVES[stage],
    confidence: input.events.length >= 2 ? 0.82 : 0.65,
    transitionReason: candidate.reason,
  }
}
