/**
 * GROWTH-WORKSPACE-AVA-IDENTITY-1D — Ava-first operator UX copy (client-safe).
 * Customer-visible strings only — internal identifiers unchanged elsewhere.
 */

import { AI_TEAMMATE_DEFAULT_NAME } from "@/lib/workspace/ai-teammate-identity"

export const GROWTH_WORKSPACE_AVA_IDENTITY_1D_QA_MARKER =
  "growth-workspace-ava-identity-1d-v1" as const

export const GROWTH_AVA_DISPLAY_NAME = AI_TEAMMATE_DEFAULT_NAME

/** Primary panel / drawer titles */
export const GROWTH_AVA_PANEL_TITLE = "Ava" as const
export const GROWTH_AVA_REPLY_ASSIST_TITLE = "Reply with Ava" as const
export const GROWTH_AVA_CALL_ASSIST_TITLE = "Ava · Call assist" as const
export const GROWTH_AVA_MEETING_PREP_TITLE = "Meeting prep from Ava" as const
export const GROWTH_AVA_INSIGHT_TITLE = "What Ava noticed" as const
export const GROWTH_AVA_DRAFT_PREVIEW_TITLE = "Draft prepared by Ava" as const
export const GROWTH_AVA_PERSONALIZATION_TITLE = "Personalization from Ava" as const
export const GROWTH_AVA_FOLLOW_UP_TITLE = "Follow-up from Ava" as const
export const GROWTH_AVA_RESPONSE_STYLE_TITLE = "Response style" as const

/** Recommendation card language */
export const GROWTH_AVA_RECOMMENDS_NEXT_COPY =
  "The highest-impact move Ava recommends next." as const
export const GROWTH_AVA_RECOMMENDS_OUTCOME_COPY =
  "The highest-impact outcome Ava recommends next." as const
export const GROWTH_AVA_RECOMMENDS_DOING_NEXT_HINT = "What Ava recommends doing next" as const
export const GROWTH_AVA_RECOMMENDED_ACTIONS_TITLE = "Ava recommends" as const

/** Empty states */
export const GROWTH_AVA_EMPTY_RECOMMENDATIONS = "Ava doesn't have any recommendations yet." as const
export const GROWTH_AVA_EMPTY_SUMMARY = "Ava will summarize activity as it comes in." as const
export const GROWTH_AVA_EMPTY_THREAD_GUIDANCE = "Select a thread to see guidance from Ava." as const
export const GROWTH_AVA_EMPTY_REPLY_DRAFTS = "Select a thread for Ava to prepare reply drafts." as const
export const GROWTH_AVA_EMPTY_ASSIST_UNAVAILABLE = "Ava is unavailable for this thread right now." as const

/** Status language */
export const GROWTH_AVA_STATUS_READY = "Ava is ready" as const
export const GROWTH_AVA_STATUS_UNAVAILABLE = "Ava is unavailable" as const
export const GROWTH_AVA_STATUS_LEARNING = "Ava is learning from your workspace" as const
export const GROWTH_AVA_STATUS_OPERATING = "Ava is operating normally" as const
export const GROWTH_AVA_STATUS_INACTIVE = "Inactive" as const
export const GROWTH_AVA_STATUS_ENABLED = "Enabled" as const

/** Settings operator labels */
export const GROWTH_AVA_SETTINGS_TITLE = "Ava" as const
export const GROWTH_AVA_PREFERENCES_TITLE = "Ava preferences" as const
export const GROWTH_AVA_CALL_ASSISTANCE_TITLE = "Call assistance from Ava" as const
export const GROWTH_AVA_TEAMMATE_LABEL = "Your AI teammate" as const

/** Source labels */
export const GROWTH_AVA_REPLY_SOURCE_LABEL = "Reply with Ava" as const

/** Operator surfaces audited in certification 1D */
export const GROWTH_AVA_IDENTITY_OPERATOR_SURFACES = [
  "lib/growth/workspace/growth-workspace-ava-identity.ts",
  "lib/workspace/ai-os-outcome-first-terminology.ts",
  "lib/growth/hubs/growth-leads-hub-config.ts",
  "lib/growth/prospect-search/prospect-search-engine-intelligence-ux.ts",
  "lib/growth/hubs/growth-inbox-conversation-workspace-config.ts",
  "components/growth/workspace/executive-briefing/growth-home-recommendation-card.tsx",
  "components/growth/growth-ai-copilot.tsx",
  "components/growth/growth-call-copilot.tsx",
  "components/growth/growth-call-workspace-ai-copilot-section.tsx",
  "components/growth/inbox/growth-inbox-intelligence-sidebar.tsx",
  "components/growth/inbox/growth-inbox-reply-intelligence-panel.tsx",
  "components/growth/inbox/growth-inbox-action-center-copilot-embed.tsx",
  "components/growth/inbox/growth-inbox-recommended-action-card.tsx",
  "components/growth/inbox/growth-inbox-action-center-workflow-embeds.tsx",
  "components/growth/hubs/inbox/growth-inbox-operator-copilot.tsx",
  "components/growth/personalization/growth-personalization-draft-editor.tsx",
  "components/growth/prospect-search/company-signal-ai-insight-panel.tsx",
  "components/growth/settings/growth-ai-settings-readiness-summary.tsx",
  "components/growth/settings/growth-settings-ai-preferences-page.tsx",
  "components/growth/settings/growth-ai-teammate-settings-panel.tsx",
  "components/growth/growth-inbox-opportunity-intelligence-panel.tsx",
  "components/growth/personalization/embedded/growth-personalization-embedded-panel.tsx",
  "components/growth/personalization/embedded/growth-personalization-summary-card.tsx",
  "components/growth/growth-meeting-prep-panel.tsx",
  "components/growth/growth-operator-assist-preferences.tsx",
  "components/growth/settings/growth-settings-calling-preferences-page.tsx",
  "components/growth/settings/growth-calling-preferences-readiness-summary.tsx",
  "components/growth/growth-reply-drafting-panel.tsx",
  "components/growth/growth-reply-inbox-dashboard.tsx",
  "components/growth/growth-call-workspace-unified-assist-panel.tsx",
  "components/growth/sendr/growth-sendr-activity-dashboard.tsx",
  "components/growth/hubs/leads/growth-leads-hub-recommendations.tsx",
  "components/growth/growth-ai-copilot-settings.tsx",
  "components/growth/ai-os/command-center/growth-ai-os-daily-briefing-section.tsx",
  "components/growth/ai-os/command-center/growth-ai-os-growth-lead-research-workflow-section.tsx",
  "components/growth/ai-os/executive-planning-review/growth-ai-os-executive-summary-section.tsx",
  "components/growth/growth-call-action-sheet.tsx",
  "lib/growth/inbox/inbox-timeline-labels.ts",
  "lib/growth/prospect-search/prospect-pipeline-automation.ts",
] as const

/** Generic AI labels that must not appear in operator UX after 1D */
export const GROWTH_AVA_FORBIDDEN_OPERATOR_LABELS = [
  /AI Summary/,
  /AI Recommendation/,
  /AI Insight/,
  /AI Assistant/,
  /AI Draft Preview/,
  /AI reply copilot/i,
  /\bAI Copilot\b/,
  /\bAI recommends\b/,
  /AI generated/,
  /AI thinks/,
  /Operator Copilot/,
  /Reply Copilot/,
  /No recommendations at this time/,
  /No recommendations for this thread yet/,
  /No recommendations in this range/,
  /No recommendations yet\./,
] as const
