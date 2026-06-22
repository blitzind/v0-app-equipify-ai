/** GE-v1-4 — Retell Conversational Demo Assistant (client-safe types). */

export const GE_V1_4_DEMO_ASSISTANT_QA_MARKER = "ge-v1-4-retell-demo-assistant-v1" as const

export const GE_V1_4_DEMO_ASSISTANT_SCHEMA_MIGRATION =
  "20270924120000_ge_v1_4_demo_assistant_sessions.sql" as const

export const GE_V1_4_DEMO_ASSISTANT_CONFIRM =
  "RUN_GE_V1_4_RETELL_DEMO_ASSISTANT_CERTIFICATION" as const

export const GE_V1_4_DEFAULT_BOOKING_PATH = "/book/equipify-demo" as const

export const GE_V1_4_KNOWLEDGE_BUNDLE_VERSION = "equipify-demo-knowledge-v1" as const

export const GE_V1_4_DEMO_ASSISTANT_EVENT_TYPES = [
  "agent_opened",
  "question_asked",
  "response_generated",
  "booking_offered",
  "booking_started",
  "booking_completed",
  "conversation_completed",
] as const

export type GeV14DemoAssistantEventType = (typeof GE_V1_4_DEMO_ASSISTANT_EVENT_TYPES)[number]

export const GE_V1_4_DEMO_SESSION_STATUSES = ["active", "completed", "failed"] as const

export type GeV14DemoSessionStatus = (typeof GE_V1_4_DEMO_SESSION_STATUSES)[number]

export type GeV14DemoIntentKind =
  | "pricing"
  | "integration"
  | "implementation"
  | "feature"
  | "demo"
  | "general"

export type GeV14ProspectContext = {
  prospectName?: string | null
  company?: string | null
  role?: string | null
  industry?: string | null
  personalizedPageTitle?: string | null
  meetingLink?: string | null
  senderName?: string | null
  senderCompany?: string | null
  bookingUrl?: string | null
}

export type GeV14DemoIntentResult = {
  primaryIntent: GeV14DemoIntentKind
  detectedIntents: GeV14DemoIntentKind[]
  suggestDemo: boolean
  suggestImmediateFollowUp: boolean
  confidence: "low" | "medium" | "high"
  rationale: string
}

export type GeV14DemoAssistantAnswer = {
  answer: string
  intent: GeV14DemoIntentResult
  bookingOffered: boolean
  bookingUrl: string | null
  knowledgeTopicId: string | null
  provider: "retell" | "bundle"
  usedFallback: boolean
}

export type GeV14ConversationOutcome = {
  summary: string
  keyTopics: string[]
  detectedIntents: GeV14DemoIntentKind[]
  bookingOutcome: "none" | "offered" | "started" | "completed"
  confidenceIndicators: {
    questionCount: number
    highIntentSignals: number
    demoSuggested: boolean
  }
}

export type GeV14DemoAssistantSession = {
  id: string
  organizationId: string
  landingPageId: string
  leadId: string | null
  publishedSlug: string
  publicSessionId: string
  status: GeV14DemoSessionStatus
  retellChatId: string | null
  prospectContext: GeV14ProspectContext
  conversationOutcome: GeV14ConversationOutcome | null
  errorMetadata: Record<string, unknown> | null
  createdAt: string
  completedAt: string | null
}
