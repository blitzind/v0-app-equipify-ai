/** LLM turn coach — structured live sales coaching from recent transcript. */

import "server-only"

import { z } from "zod"
import { runAiTask } from "@/lib/ai/router"
import { phraseViolatesStagePolicy } from "@/lib/growth/live-coaching/stage-coaching-policy"
import { lastCustomerFacingTranscriptEvent } from "@/lib/growth/live-coaching/prospect-turn-detection"
import {
  CONVERSATION_STAGE_OBJECTIVES,
  CONVERSATION_STAGES,
  type ConversationCoachTurn,
  type ConversationStage,
} from "@/lib/growth/live-coaching/types"
import type { GrowthRealtimeLiveSnapshot, GrowthRealtimeTranscriptEvent } from "@/lib/growth/realtime/realtime-call-types"

const llmCoachTurnSchema = z.object({
  primaryPhrase: z.string().min(8).max(200),
  rationale: z.string().min(12).max(400),
  stage: z.enum(CONVERSATION_STAGES),
  confidence: z.number().min(0).max(1),
})

export type LlmTurnCoachInput = {
  organizationId: string
  events: GrowthRealtimeTranscriptEvent[]
  stage: ConversationStage
  stageObjective: string
  snapshot: GrowthRealtimeLiveSnapshot
  inbound?: boolean
  previousCoach?: ConversationCoachTurn | null
}

function buildSystemPrompt(stage: ConversationStage): string {
  return [
    "You are a live sales coach whispering one line for the rep to say next on an active call.",
    "Respond directly to the prospect's most recent statement.",
    "Provide exact speakable wording — conversational, not corporate.",
    "Advance the conversation naturally for the current stage.",
    "Never lead with decision-maker, budget, or timeline questions unless stage is buying_process or close.",
    `Current stage: ${stage}. Objective: ${CONVERSATION_STAGE_OBJECTIVES[stage]}.`,
    "Return JSON only: primaryPhrase, rationale, stage, confidence.",
  ].join(" ")
}

function recentWindow(events: GrowthRealtimeTranscriptEvent[], limit = 10) {
  return events.slice(-limit).map((event) => ({
    speaker: event.speaker,
    content: event.content,
    sequenceNumber: event.sequenceNumber,
  }))
}

function lastProspectEvent(
  events: GrowthRealtimeTranscriptEvent[],
  previousCoach?: ConversationCoachTurn | null,
) {
  return lastCustomerFacingTranscriptEvent(events, { previousCoach })
}

export async function generateLlmCoachTurn(input: LlmTurnCoachInput): Promise<ConversationCoachTurn | null> {
  const lastProspect = lastProspectEvent(input.events, input.previousCoach)
  if (!lastProspect) return null

  const userPayload = {
    stage: input.stage,
    stageObjective: input.stageObjective,
    inbound: input.inbound ?? false,
    lastProspectStatement: lastProspect.content,
    recentTranscript: recentWindow(input.events),
    objections: input.snapshot.objections.map((entry) => entry.label),
    buyingSignals: input.snapshot.buyingSignals.map((entry) => entry.label),
  }

  const result = await runAiTask({
    task: "growth_live_turn_coach",
    organizationId: input.organizationId,
    input: {
      system: buildSystemPrompt(input.stage),
      user: `CALL CONTEXT (JSON):\n${JSON.stringify(userPayload)}`,
    },
    schema: llmCoachTurnSchema,
    cacheSchemaVersion: "live_turn_coach_v1",
    taskOverrides: {
      cacheable: false,
      allowResponseCaching: false,
    },
    skipCache: true,
  })

  if (!result.ok) return null

  const output = result.output
  if (phraseViolatesStagePolicy(output.stage, output.primaryPhrase)) return null

  return {
    primaryPhrase: output.primaryPhrase.trim(),
    rationale: output.rationale.trim(),
    stage: output.stage,
    stageObjective: CONVERSATION_STAGE_OBJECTIVES[output.stage],
    evidenceQuote: lastProspect.content.slice(0, 120),
    triggeredBySequenceNumber: lastProspect.sequenceNumber,
    source: "llm",
    confidence: output.confidence,
    updatedAt: new Date().toISOString(),
  }
}
