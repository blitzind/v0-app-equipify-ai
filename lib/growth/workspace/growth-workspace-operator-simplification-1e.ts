/**
 * GROWTH-WORKSPACE-OPERATOR-SIMPLIFICATION-1E — operator UX simplification copy (client-safe).
 */
import {
  AI_TEAMMATE_DEFAULT_NAME,
  resolveAiTeammatePresentation,
  type AiTeammatePresentation,
} from "@/lib/workspace/ai-teammate-identity"

export const GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER =
  "growth-workspace-operator-simplification-1e-v1" as const

/** Videos — first-run library */
export const GROWTH_VIDEOS_FIRST_RUN_TITLE = "Record your first video" as const
export const GROWTH_VIDEOS_FIRST_RUN_DESCRIPTION =
  "Personalized video helps you stand out in outreach. Start with a recording or upload an existing clip." as const
export const GROWTH_VIDEOS_FIRST_RUN_RECORD_CTA = "Record your first video" as const
export const GROWTH_VIDEOS_FIRST_RUN_PERSONALIZE_CTA = "Personalize outreach" as const
export const GROWTH_VIDEOS_FIRST_RUN_SHARE_PAGES_CTA = "Share landing pages" as const
export const GROWTH_VIDEOS_FIRST_RUN_UPLOAD_CTA = "Upload a video" as const

/** Share Pages — prospect gate */
export const GROWTH_SHARE_PAGES_NO_PROSPECT_TITLE = "Choose a prospect to continue" as const
export const GROWTH_SHARE_PAGES_NO_PROSPECT_MESSAGE =
  "Share Pages personalize content for a specific prospect. Select a prospect to preview or publish." as const
export const GROWTH_SHARE_PAGES_CHOOSE_PROSPECT_CTA = "Choose prospect" as const

/** Calls — operator status language */
export const GROWTH_CALLS_STATUS_READY = "Ready" as const
export const GROWTH_CALLS_STATUS_UNAVAILABLE = "Unavailable" as const
export const GROWTH_CALLS_STATUS_NEEDS_ADMIN = "Needs Platform Admin" as const
export const GROWTH_CALLS_SETUP_OPERATOR_MESSAGE =
  "Calling is not ready for this workspace yet. Ask Platform Admin to finish telephony setup." as const
export const GROWTH_CALLS_TRANSCRIPT_UNAVAILABLE_COPY =
  "Live transcript will appear once your call connects." as const
export const GROWTH_CALLS_EXECUTION_READINESS_LABEL = "Call readiness" as const

/** Opportunities — actionable pipeline */
export const GROWTH_OPPORTUNITIES_PIPELINE_HEALTH_TITLE = "Pipeline health" as const
export const GROWTH_OPPORTUNITIES_DEALS_NEEDING_ATTENTION_TITLE = "Deals needing attention" as const
export function growthOpportunitiesRecommendsTitle(teammate: AiTeammatePresentation): string {
  return `${teammate.name} recommends`
}
export const GROWTH_OPPORTUNITIES_AVA_RECOMMENDS_TITLE =
  growthOpportunitiesRecommendsTitle(resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME))
export const GROWTH_OPPORTUNITIES_RECENTLY_CHANGED_TITLE = "Recently changed" as const
export const GROWTH_OPPORTUNITIES_PIPELINE_VALUE_TITLE = "Pipeline value" as const
export const GROWTH_OPPORTUNITIES_PIPELINE_EMPTY_TITLE = "Start building your pipeline" as const
export const GROWTH_OPPORTUNITIES_PIPELINE_EMPTY_MESSAGE =
  "Import prospects or qualify leads to begin tracking deals here." as const
export const GROWTH_OPPORTUNITIES_IMPORT_PROSPECTS_CTA = "Import prospects" as const
export const GROWTH_OPPORTUNITIES_QUALIFY_LEADS_CTA = "Qualify leads" as const

/** Automation — operator tab / panel titles */
export const GROWTH_AUTOMATION_PUBLISH_TAB_LABEL = "Publish" as const
export const GROWTH_AUTOMATION_PREVIEW_PANEL_TITLE = "Automation preview" as const
export const GROWTH_AUTOMATION_PUBLISH_PANEL_TITLE = "Publish gate" as const
export const GROWTH_AUTOMATION_STATUS_PANEL_TITLE = "Automation status" as const
export const GROWTH_AUTOMATION_ENROLLMENTS_PANEL_TITLE = "Enrollments" as const
export const GROWTH_AUTOMATION_OBSERVABILITY_PANEL_TITLE = "Activity overview" as const
export const GROWTH_AUTOMATION_ANALYTICS_PANEL_TITLE = "Performance & history" as const

/** Surfaces certified in 1E */
export const GROWTH_OPERATOR_SIMPLIFICATION_1E_SURFACES = [
  "lib/growth/workspace/growth-workspace-operator-simplification-1e.ts",
  "lib/growth/automation/growth-automation-operator-copy.ts",
  "lib/growth/hubs/growth-videos-hub-manifest.ts",
  "lib/growth/hubs/growth-share-pages-hub-manifest.ts",
  "lib/growth/hubs/growth-calls-hub-manifest.ts",
  "lib/growth/hubs/growth-opportunities-hub-manifest.ts",
  "app/(growth)/growth/automation/page.tsx",
  "components/growth/automation/growth-automation-inspector-sidebar.tsx",
  "components/growth/automation/growth-automation-flow-library.tsx",
  "components/growth/automation/growth-automation-compiler-panel.tsx",
  "components/growth/automation/growth-automation-publish-panel.tsx",
  "components/growth/automation/growth-automation-runtime-status-panel.tsx",
  "components/growth/automation/growth-automation-enrollment-panel.tsx",
  "components/growth/automation/growth-automation-observability-panel.tsx",
  "components/growth/automation/growth-automation-analytics-panel.tsx",
  "components/growth/automation/growth-automation-publish-dialog.tsx",
  "components/growth/automation/growth-automation-runtime-activation-dialog.tsx",
  "components/growth/automation/growth-automation-runtime-preview-panel.tsx",
  "components/growth/automation/growth-automation-runtime-execution-panel.tsx",
  "components/growth/videos/growth-video-library-first-run.tsx",
  "components/growth/videos/growth-video-library-panel.tsx",
  "components/growth/videos/growth-video-record-shell.tsx",
  "components/growth/videos/growth-video-templates-shell.tsx",
  "app/(growth)/growth/share-pages/workspace/page.tsx",
  "components/growth/share-pages/growth-share-pages-workspace-prospect-gate.tsx",
  "components/growth/growth-call-workspace.tsx",
  "components/growth/growth-call-workspace-live-transcript-panel.tsx",
  "components/growth/growth-call-workspace-intelligence-rail.tsx",
  "components/growth/growth-call-workspace-center-panel.tsx",
  "components/growth/growth-opportunity-pipeline-dashboard.tsx",
  "lib/growth/native-dialer/call-workspace-coaching-types.ts",
] as const

/** Engineering jargon that must not appear in operator automation UX after 1E */
export const GROWTH_OPERATOR_SIMPLIFICATION_FORBIDDEN_AUTOMATION_LABELS = [
  /SR-3/,
  /\bS5-[A-Z0-9]/,
  /scaffold/i,
  /\bCompile preview\b/,
  /\bRuntime status\b/i,
  /\bRuntime execution\b/i,
  /\bRuntime observability\b/i,
  /\bPause runtime\b/i,
  /\bPublish runtime\b/i,
  /\bActivate runtime\b/i,
  /\bkill switch\b/i,
  /execution engine/i,
] as const

/** Infrastructure / route jargon forbidden in Calls, Share Pages operator UX */
export const GROWTH_OPERATOR_SIMPLIFICATION_FORBIDDEN_INFRA_LABELS = [
  /\?leadId=/,
  /\?lead_id=/,
  /voice infrastructure logs/i,
  /Execution Readiness/,
  /Transcript infrastructure/,
  /sidebar drill-down/i,
  /persistence boundaries/i,
] as const
