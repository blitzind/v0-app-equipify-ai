/** GROWTH-WORKSPACE-LAUNCH-POLISH-1B — launch polish certification marker. */
export const GROWTH_WORKSPACE_LAUNCH_POLISH_1B_QA_MARKER =
  "growth-workspace-launch-polish-1b-v1" as const

/** Hub manifests that must ship contextual empty metric copy (no bare dashes). */
export const GROWTH_WORKSPACE_LAUNCH_POLISH_HUB_MANIFESTS = [
  "lib/growth/hubs/growth-calls-hub-manifest.ts",
  "lib/growth/hubs/growth-opportunities-hub-manifest.ts",
  "lib/growth/hubs/growth-videos-hub-manifest.ts",
  "lib/growth/hubs/growth-share-pages-hub-manifest.ts",
  "lib/growth/hubs/growth-campaigns-hub-manifest.ts",
  "lib/growth/hubs/growth-inbox-hub-manifest.ts",
  "lib/growth/hubs/growth-leads-hub-manifest.ts",
] as const

/** Page titles aligned with workspace nav labels in polish 1B. */
export const GROWTH_WORKSPACE_LAUNCH_POLISH_PAGE_TITLES = {
  conversations: "Conversations",
  relationships: "Relationships",
  meetings: "Meetings",
  leadRecords: "Lead Records",
} as const
