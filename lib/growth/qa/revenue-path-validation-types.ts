/** Phase RV-1 — End-to-end revenue path validation types (client-safe). */

export const REVENUE_PATH_VALIDATION_QA_MARKER = "revenue-path-validation-rv1-v1" as const

/** Full operator revenue path from Apollo through forecast. */
export const REVENUE_PATH_STAGES = [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
  "Voice Drop",
  "Multi-Channel",
  "Sequence Execution",
  "Reply Intelligence",
  "Meeting Candidate",
  "Meeting",
  "AI Meeting Prep",
  "Opportunity Draft",
  "Opportunity",
  "Deal Intelligence",
  "Revenue Forecast",
] as const

export type RevenuePathStage = (typeof REVENUE_PATH_STAGES)[number]

export const REVENUE_PATH_QUEUE_DEFINITIONS = [
  {
    id: "enrollment",
    label: "Enrollment",
    table: "apollo_enrollment_candidates",
    statusField: "status",
    api: "/api/platform/growth/apollo-enrollment-automation/enrollment-queue",
  },
  {
    id: "account_playbook",
    label: "Account Playbook",
    table: "account_playbooks",
    statusField: "status",
    api: "/api/platform/growth/apollo-account-playbooks/playbook-queue",
  },
  {
    id: "voice_drop",
    label: "Voice Drop",
    table: "apollo_voice_drop_candidates",
    statusField: "status",
    api: "/api/platform/growth/apollo-voice-drop-automation/voice-drop-queue",
  },
  {
    id: "multichannel",
    label: "Multi-Channel",
    table: "apollo_multichannel_sequence_candidates",
    statusField: "status",
    api: "/api/platform/growth/apollo-multichannel-orchestration/multichannel-queue",
  },
  {
    id: "sequence_execution",
    label: "Sequence Execution",
    table: "apollo_sequence_execution_candidates",
    statusField: "status",
    api: "/api/platform/growth/apollo-sequence-execution-automation/execution-queue",
  },
  {
    id: "meeting_candidate",
    label: "Meeting Candidate",
    table: "meeting_candidates",
    statusField: "status",
    api: "/api/platform/growth/meeting-candidates/queue",
  },
  {
    id: "ai_meeting_prep",
    label: "AI Meeting Prep",
    table: "ai_meeting_preparations",
    statusField: "status",
    api: "/api/platform/growth/ai-meeting-prep/queue",
  },
  {
    id: "opportunity_draft",
    label: "Opportunity Draft",
    table: "opportunity_drafts",
    statusField: "status",
    api: "/api/platform/growth/opportunity-drafts/queue",
  },
] as const

export const REVENUE_PATH_PILOT_COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a" as const
export const REVENUE_PATH_HENRY_LEAD_ID = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56" as const
