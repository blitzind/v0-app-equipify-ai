/** Phase GS-3D — Conversational Playbooks types (client-safe). */

export const CONVERSATIONAL_PLAYBOOK_QA_MARKER = "growth-conversational-playbooks-gs3d-v1" as const

export const CONVERSATIONAL_PLAYBOOK_CONFIRM = "RUN_CONVERSATIONAL_PLAYBOOKS_CERTIFICATION" as const

export const CONVERSATIONAL_PLAYBOOK_CONSUMERS = [
  "reply_intelligence",
  "sms",
  "email",
  "voice_drop",
  "call_coaching",
  "meeting_prep",
  "opportunity_intelligence",
  "operator_inbox",
] as const

export type ConversationalPlaybookConsumer = (typeof CONVERSATIONAL_PLAYBOOK_CONSUMERS)[number]

export const CONVERSATIONAL_PLAYBOOK_TYPES = [
  "objection_handling",
  "discovery",
  "qualification",
  "follow_up",
  "competitive",
  "pricing",
  "next_step",
  "meeting",
] as const

export type ConversationalPlaybookType = (typeof CONVERSATIONAL_PLAYBOOK_TYPES)[number]

export const CONVERSATIONAL_PLAYBOOK_SECTION_TYPES = [
  "situation_summary",
  "talking_points",
  "discovery_questions",
  "objection_handling",
  "qualification_guidance",
  "suggested_next_steps",
  "risks_and_watchouts",
] as const

export type ConversationalPlaybookSectionType = (typeof CONVERSATIONAL_PLAYBOOK_SECTION_TYPES)[number]

export const CONVERSATIONAL_PLAYBOOK_SECTION_LABELS: Record<ConversationalPlaybookSectionType, string> = {
  situation_summary: "Situation summary",
  talking_points: "Recommended talking points",
  discovery_questions: "Discovery questions",
  objection_handling: "Objection handling",
  qualification_guidance: "Qualification guidance",
  suggested_next_steps: "Suggested next steps",
  risks_and_watchouts: "Risks and watch-outs",
}

export const CONVERSATIONAL_PLAYBOOK_TYPE_LABELS: Record<ConversationalPlaybookType, string> = {
  objection_handling: "Objection handling",
  discovery: "Discovery",
  qualification: "Qualification",
  follow_up: "Follow-up",
  competitive: "Competitive positioning",
  pricing: "Pricing",
  next_step: "Next step",
  meeting: "Meeting",
}

export const CONVERSATIONAL_PLAYBOOK_CONSUMER_LABELS: Record<ConversationalPlaybookConsumer, string> = {
  reply_intelligence: "Reply intelligence",
  sms: "SMS conversations",
  email: "Email conversations",
  voice_drop: "Voice Drop",
  call_coaching: "Call coaching",
  meeting_prep: "Meeting prep",
  opportunity_intelligence: "Opportunity intelligence",
  operator_inbox: "Operator inbox",
}

export type ConversationalPlaybookCitation = {
  document_id: string
  title: string
  category: string
}

export type ConversationalPlaybookSection = {
  section_id: string
  section_type: ConversationalPlaybookSectionType
  title: string
  items: string[]
  citations: ConversationalPlaybookCitation[]
}

export type ConversationalPlaybookRecommendation = {
  recommendation_id: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  citations: ConversationalPlaybookCitation[]
  action_type: "view_playbook" | "open_document" | "mark_reviewed"
}

export type ConversationalPlaybookExecutionGuide = {
  human_review_required: true
  do_not_autosend: true
  do_not_auto_reply: true
  do_not_schedule: true
  suggested_operator_actions: string[]
  channel_notes: string[]
}

export type ConversationalPlaybook = {
  qa_marker: typeof CONVERSATIONAL_PLAYBOOK_QA_MARKER
  playbook_id: string
  consumer: ConversationalPlaybookConsumer
  playbook_type: ConversationalPlaybookType
  title: string
  confidence_score: number
  review_status: "pending" | "reviewed"
  sections: ConversationalPlaybookSection[]
  recommendations: ConversationalPlaybookRecommendation[]
  citations: ConversationalPlaybookCitation[]
  execution_guide: ConversationalPlaybookExecutionGuide
  requires_human_review: true
  autonomous_execution_enabled: false
  generated_at: string
}

export const CONVERSATIONAL_PLAYBOOK_ACTIONS = ["mark_reviewed", "view_playbook"] as const
export type ConversationalPlaybookActionType = (typeof CONVERSATIONAL_PLAYBOOK_ACTIONS)[number]

export const CONVERSATIONAL_PLAYBOOK_AUDIT_EVENTS = [
  "conversational_playbook_generated",
  "conversational_playbook_reviewed",
  "conversational_playbook_viewed",
] as const

export type ConversationalPlaybookAuditEvent = (typeof CONVERSATIONAL_PLAYBOOK_AUDIT_EVENTS)[number]

export type ConversationalPlaybookGenerateRequest = {
  consumer: ConversationalPlaybookConsumer
  organization_id?: string | null
  lead_id?: string | null
  company_id?: string | null
  industry?: string | null
  query?: string | null
  playbook_type?: ConversationalPlaybookType | null
  limit?: number
  include_private?: boolean
}
