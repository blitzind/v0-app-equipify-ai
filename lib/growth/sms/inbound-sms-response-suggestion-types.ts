/** Client-safe types for Phase 5.6 inbound SMS response suggestions. */

import type { GrowthInboxClassification } from "@/lib/growth/inbox/inbox-types"
import type { GrowthNextBestAction } from "@/lib/growth/nba-types"
import type {
  GrowthReplyConfidenceTier,
  GrowthReplyIntent,
  GrowthReplyUncertaintyState,
} from "@/lib/growth/reply-intelligence/reply-intent-types"
import type { GrowthSmsInboxDraftSuggestion } from "@/lib/growth/sms/personalization/sms-personalization-types"

export const GROWTH_SMS_INBOUND_RESPONSE_SUGGESTIONS_QA_MARKER =
  "growth-sms-inbound-response-suggestions-v1" as const

export const GROWTH_SMS_EMAIL_FOLLOW_UP_KINDS = [
  "send_details_by_email",
  "send_short_overview",
  "send_scheduling_link",
  "send_proposal_context",
] as const

export type GrowthSmsEmailFollowUpKind = (typeof GROWTH_SMS_EMAIL_FOLLOW_UP_KINDS)[number]

export type GrowthSmsEmailFollowUpSuggestion = {
  kind: GrowthSmsEmailFollowUpKind
  label: string
  summary: string
  suggestedSubject: string | null
  humanApprovalRequired: true
}

export type GrowthSmsCallPromptSuggestion = {
  whyCallNow: string
  openingLine: string
  keyQuestion: string
  desiredOutcome: string
  humanApprovalRequired: true
}

export type GrowthInboundSmsReplyContext = {
  inboundBody: string
  intent: GrowthReplyIntent
  classification: string
  confidence: number
  confidenceTier: GrowthReplyConfidenceTier
  sentiment: string
  engagementSignal: string
  uncertaintyState: GrowthReplyUncertaintyState
  matchedPhrases: string[]
  threadClassification: GrowthInboxClassification | null
}

export type GrowthInboundSmsResponseSuggestions = {
  qa_marker: typeof GROWTH_SMS_INBOUND_RESPONSE_SUGGESTIONS_QA_MARKER
  channel: "sms"
  humanApprovalRequired: true
  replyContext: GrowthInboundSmsReplyContext
  smsReply: GrowthSmsInboxDraftSuggestion
  emailFollowUp: GrowthSmsEmailFollowUpSuggestion | null
  callPrompt: GrowthSmsCallPromptSuggestion | null
  nextBestAction: GrowthNextBestAction | null
  nextBestActionLabel: string | null
  contextUsed: string[]
  memoryUsed: string[]
  safetyWarnings: string[]
}
