/** Client-safe conversation coach types — Growth Live Coaching V2. */

export const CONVERSATION_STAGES = [
  "rapport",
  "discovery",
  "pain",
  "impact",
  "solution_fit",
  "buying_process",
  "close",
] as const

export type ConversationStage = (typeof CONVERSATION_STAGES)[number]

export const CONVERSATION_STAGE_LABELS: Record<ConversationStage, string> = {
  rapport: "Rapport",
  discovery: "Discovery",
  pain: "Pain",
  impact: "Impact",
  solution_fit: "Solution fit",
  buying_process: "Buying process",
  close: "Close",
}

export const CONVERSATION_STAGE_OBJECTIVES: Record<ConversationStage, string> = {
  rapport: "Establish context and make the prospect comfortable",
  discovery: "Understand their situation and goals",
  pain: "Surface specific problems they want to solve",
  impact: "Quantify the cost of the status quo",
  solution_fit: "Connect your solution to their pain",
  buying_process: "Map how decisions get made",
  close: "Secure a concrete next step",
}

export type ConversationCoachTurn = {
  primaryPhrase: string
  rationale: string
  stage: ConversationStage
  stageObjective: string
  evidenceQuote: string | null
  triggeredBySequenceNumber: number | null
  source: "bootstrap" | "deterministic" | "llm"
  confidence: number
  updatedAt: string
}

export type ConversationCoachSnapshot = ConversationCoachTurn

export const GROWTH_LIVE_COACHING_V2_QA_MARKER = "growth-live-coaching-v2-v1" as const
