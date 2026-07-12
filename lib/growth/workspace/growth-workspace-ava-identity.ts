/**
 * GROWTH-WORKSPACE-AVA-IDENTITY-1D / GE-AIOS-IDENTITY-1B —
 * Operator UX copy builders (client-safe). Display strings take the configured teammate.
 * Internal engineering codename remains Ava; customer UI must never hardcode it.
 */

import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { AI_TEAMMATE_DEFAULT_NAME } from "@/lib/workspace/ai-teammate-identity"
import {
  assistUnavailable,
  callAssistTitle,
  callAssistanceTitle,
  draftPreparedByTeammate,
  emptyRecommendations,
  emptyReplyDrafts,
  emptySummary,
  emptyThreadGuidance,
  followUpFromTeammate,
  meetingPrepFromTeammate,
  personalizationFromTeammate,
  preferencesTitle,
  recommends,
  recommendsDoingNext,
  recommendsNext,
  recommendsOutcome,
  replyWithTeammate,
  statusLearning,
  statusOperating,
  statusReady,
  statusUnavailable,
  whatTeammateNoticed,
} from "@/lib/workspace/ai-teammate-voice"

export const GROWTH_WORKSPACE_AVA_IDENTITY_1D_QA_MARKER =
  "growth-workspace-ava-identity-1d-v1" as const

/** Default engineering identity — not for direct customer UI interpolation. */
export const GROWTH_AVA_DISPLAY_NAME = AI_TEAMMATE_DEFAULT_NAME

export function growthAvaPanelTitle(teammate: AiTeammatePresentation): string {
  return teammate.name
}

export function growthAvaReplyAssistTitle(teammate: AiTeammatePresentation): string {
  return replyWithTeammate(teammate)
}

export function growthAvaCallAssistTitle(teammate: AiTeammatePresentation): string {
  return callAssistTitle(teammate)
}

export function growthAvaMeetingPrepTitle(teammate: AiTeammatePresentation): string {
  return meetingPrepFromTeammate(teammate)
}

export function growthAvaInsightTitle(teammate: AiTeammatePresentation): string {
  return whatTeammateNoticed(teammate)
}

export function growthAvaDraftPreviewTitle(teammate: AiTeammatePresentation): string {
  return draftPreparedByTeammate(teammate)
}

export function growthAvaPersonalizationTitle(teammate: AiTeammatePresentation): string {
  return personalizationFromTeammate(teammate)
}

export function growthAvaFollowUpTitle(teammate: AiTeammatePresentation): string {
  return followUpFromTeammate(teammate)
}

export const GROWTH_AVA_RESPONSE_STYLE_TITLE = "Response style" as const

export function growthAvaRecommendsNextCopy(teammate: AiTeammatePresentation): string {
  return recommendsNext(teammate)
}

export function growthAvaRecommendsOutcomeCopy(teammate: AiTeammatePresentation): string {
  return recommendsOutcome(teammate)
}

export function growthAvaRecommendsDoingNextHint(teammate: AiTeammatePresentation): string {
  return recommendsDoingNext(teammate)
}

export function growthAvaRecommendedActionsTitle(teammate: AiTeammatePresentation): string {
  return recommends(teammate)
}

export function growthAvaEmptyRecommendations(teammate: AiTeammatePresentation): string {
  return emptyRecommendations(teammate)
}

export function growthAvaEmptySummary(teammate: AiTeammatePresentation): string {
  return emptySummary(teammate)
}

export function growthAvaEmptyThreadGuidance(teammate: AiTeammatePresentation): string {
  return emptyThreadGuidance(teammate)
}

export function growthAvaEmptyReplyDrafts(teammate: AiTeammatePresentation): string {
  return emptyReplyDrafts(teammate)
}

export function growthAvaEmptyAssistUnavailable(teammate: AiTeammatePresentation): string {
  return assistUnavailable(teammate)
}

export function growthAvaStatusReady(teammate: AiTeammatePresentation): string {
  return statusReady(teammate)
}

export function growthAvaStatusUnavailable(teammate: AiTeammatePresentation): string {
  return statusUnavailable(teammate)
}

export function growthAvaStatusLearning(teammate: AiTeammatePresentation): string {
  return statusLearning(teammate)
}

export function growthAvaStatusOperating(teammate: AiTeammatePresentation): string {
  return statusOperating(teammate)
}

export const GROWTH_AVA_STATUS_INACTIVE = "Inactive" as const
export const GROWTH_AVA_STATUS_ENABLED = "Enabled" as const

export function growthAvaSettingsTitle(teammate: AiTeammatePresentation): string {
  return teammate.name
}

export function growthAvaPreferencesTitle(teammate: AiTeammatePresentation): string {
  return preferencesTitle(teammate)
}

export function growthAvaCallAssistanceTitle(teammate: AiTeammatePresentation): string {
  return callAssistanceTitle(teammate)
}

export const GROWTH_AVA_TEAMMATE_LABEL = "Your AI teammate" as const

export function growthAvaReplySourceLabel(teammate: AiTeammatePresentation): string {
  return replyWithTeammate(teammate)
}

/** Operator surfaces audited in certification 1D / IDENTITY-1B */
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
