/** Phase GS-5C — Smart Follow-Up Policy types (client-safe). */

export const SMART_FOLLOW_UP_POLICY_QA_MARKER = "growth-follow-up-policies-gs5c-v1" as const

export const SMART_FOLLOW_UP_POLICY_CONFIRM = "RUN_FOLLOW_UP_POLICIES_CERTIFICATION" as const

export const SMART_FOLLOW_UP_POLICY_TYPES = [
  "reply_follow_up",
  "meeting_follow_up",
  "proposal_follow_up",
  "opportunity_follow_up",
  "nurture_follow_up",
  "reengagement_follow_up",
  "high_intent_follow_up",
  "manual_review",
] as const

export type SmartFollowUpPolicyType = (typeof SMART_FOLLOW_UP_POLICY_TYPES)[number]

export const SMART_FOLLOW_UP_POLICY_PRIORITIES = ["low", "medium", "high", "urgent"] as const
export type SmartFollowUpPolicyPriority = (typeof SMART_FOLLOW_UP_POLICY_PRIORITIES)[number]

export const SMART_FOLLOW_UP_CHANNELS = ["email", "sms", "voice_drop", "call"] as const
export type SmartFollowUpChannel = (typeof SMART_FOLLOW_UP_CHANNELS)[number]

export const SMART_FOLLOW_UP_POLICY_TYPE_LABELS: Record<SmartFollowUpPolicyType, string> = {
  reply_follow_up: "Reply follow-up",
  meeting_follow_up: "Meeting follow-up",
  proposal_follow_up: "Proposal follow-up",
  opportunity_follow_up: "Opportunity follow-up",
  nurture_follow_up: "Nurture follow-up",
  reengagement_follow_up: "Re-engagement follow-up",
  high_intent_follow_up: "High-intent follow-up",
  manual_review: "Manual review",
}

export const SMART_FOLLOW_UP_FILTERS = [
  "all",
  "urgent",
  "replies",
  "meetings",
  "opportunities",
  "high_intent",
] as const

export type SmartFollowUpFilter = (typeof SMART_FOLLOW_UP_FILTERS)[number]

export const SMART_FOLLOW_UP_ACTIONS = ["mark_reviewed", "dismiss", "view_details"] as const
export type SmartFollowUpActionType = (typeof SMART_FOLLOW_UP_ACTIONS)[number]

export type SmartFollowUpTrigger = {
  trigger_id: string
  trigger_type: string
  reason: string
  evidence: string[]
  source_system: string
  source_ref: string
  occurred_at: string
}

export type SmartFollowUpWindow = {
  window_id: string
  label: string
  earliest_at: string
  latest_at: string
  rationale: string
}

export type SmartFollowUpChannelPlan = {
  channel: SmartFollowUpChannel
  eligible: boolean
  status: "recommended" | "conditional" | "blocked"
  blockers: string[]
  rationale: string
}

export type SmartFollowUpRecommendation = {
  recommendation_id: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  related_href: string | null
  action_type: "view_details" | "open_related" | "mark_reviewed" | "dismiss"
}

export type SmartFollowUpPolicy = {
  qa_marker: typeof SMART_FOLLOW_UP_POLICY_QA_MARKER
  policy_id: string
  policy_type: SmartFollowUpPolicyType
  priority: SmartFollowUpPolicyPriority
  title: string
  description: string
  follow_up_recommended: boolean
  recommended_channels: SmartFollowUpChannel[]
  channel_plans: SmartFollowUpChannelPlan[]
  follow_up_window: SmartFollowUpWindow
  trigger: SmartFollowUpTrigger
  recommendations: SmartFollowUpRecommendation[]
  reasoning: string[]
  risks: string[]
  required_approvals: string[]
  review_status: "pending" | "reviewed" | "dismissed"
  lead_id: string | null
  company_name: string | null
  related_href: string | null
  requires_human_review: true
  autonomous_execution_enabled: false
  generated_at: string
}

export type SmartFollowUpPoliciesResponse = {
  qa_marker: typeof SMART_FOLLOW_UP_POLICY_QA_MARKER
  generated_at: string
  total: number
  urgent_count: number
  recommended_count: number
  type_counts: Record<SmartFollowUpPolicyType, number>
  policies: SmartFollowUpPolicy[]
  requires_human_review: true
  autonomous_execution_enabled: false
}

export const SMART_FOLLOW_UP_AUDIT_EVENTS = [
  "follow_up_policy_generated",
  "follow_up_policy_reviewed",
  "follow_up_policy_dismissed",
  "follow_up_policy_viewed",
] as const

export type SmartFollowUpAuditEvent = (typeof SMART_FOLLOW_UP_AUDIT_EVENTS)[number]

export type SmartFollowUpGenerateRequest = {
  lead_id?: string | null
  filter?: SmartFollowUpFilter
  limit?: number
  include_campaign_readiness?: boolean
  include_interventions?: boolean
}
