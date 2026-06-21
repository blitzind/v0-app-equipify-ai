/** GS-AI-PLAYBOOK-4A — Buying stage & conversation state types (client-safe). */

export const GROWTH_BUYING_STAGE_QA_MARKER = "growth-buying-stage-gs-ai-playbook-4a-v1" as const

export const GROWTH_BUYING_STAGES = [
  "unaware",
  "problem_aware",
  "solution_aware",
  "evaluating",
  "buying_committee",
  "proposal",
  "decision",
  "customer",
  "dormant",
] as const

export type GrowthBuyingStage = (typeof GROWTH_BUYING_STAGES)[number]

export const GROWTH_CONVERSATION_STATES = [
  "first_touch",
  "engaged",
  "replying",
  "researching",
  "evaluating",
  "stalled",
  "reengagement",
  "hot",
] as const

export type GrowthConversationState = (typeof GROWTH_CONVERSATION_STATES)[number]

export type GrowthBuyingStageConfidence = "low" | "medium" | "high"

export type GrowthBuyingStageAssessment = {
  stage: GrowthBuyingStage
  confidence: GrowthBuyingStageConfidence
  confidenceScore: number
  signals: string[]
  blockers: string[]
  progressionTriggers: string[]
}

export type GrowthConversationStateAssessment = {
  state: GrowthConversationState
  confidence: GrowthBuyingStageConfidence
  confidenceScore: number
  daysSinceLastTouch: number | null
  touchCount: number
  replies: number
  meetings: number
  assetViews: number
  videoCompletion: boolean
  openLoops: string[]
  signals: string[]
}

export type GrowthBuyingStageMessagingGuidance = {
  educate: boolean
  diagnose: boolean
  compareApproaches: boolean
  removeFriction: boolean
  reengage: boolean
  preferredTone: "consultative" | "educational" | "direct" | "supportive" | "executive"
  preferredCtaStyles: Array<"discovery" | "workflow_review" | "proof_share" | "meeting" | "low_pressure">
  avoidActions: string[]
  narrativeBias: Array<"operational" | "financial" | "growth" | "compliance">
}

export type GrowthNextBestActionType =
  | "schedule_workflow_review"
  | "share_case_study"
  | "send_comparison"
  | "reengage"
  | "ask_discovery_question"
  | "book_meeting"
  | "share_compliance_proof"
  | "confirm_implementation"

export type GrowthNextBestActionUrgency = "low" | "medium" | "high"

export type GrowthNextBestActionPlan = {
  primaryAction: GrowthNextBestActionType
  secondaryAction: GrowthNextBestActionType | null
  avoidActions: string[]
  urgency: GrowthNextBestActionUrgency
  rationale: string
}

export type GrowthBuyingStageDiagnostics = {
  buyingStage: GrowthBuyingStage
  conversationState: GrowthConversationState
  confidence: number
  progressionSignals: string[]
  blockers: string[]
  nextBestActions: GrowthNextBestActionPlan
  messagingGuidance: GrowthBuyingStageMessagingGuidance
  guidanceApplied: boolean
  boosts: string[]
  deprioritized: string[]
}

export type GrowthBuyingStageContext = {
  buyingStage: GrowthBuyingStageAssessment
  conversationState: GrowthConversationStateAssessment
  messagingGuidance: GrowthBuyingStageMessagingGuidance
  nextBestActions: GrowthNextBestActionPlan
  diagnostics: GrowthBuyingStageDiagnostics
}
