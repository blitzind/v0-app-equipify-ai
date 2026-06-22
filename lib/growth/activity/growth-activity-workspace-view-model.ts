/** GS-AI-PLAYBOOK-5B/5C — Activity view model re-exports (client-safe). */

export {
  mapEngagementTimelineEventToEventView,
  mapLeadTimelineRowToEventView,
  mapPersonalizationGenerationToEventViews,
  mapSendrActivityFeedRowToEventView,
  mapSendrActivityFeedRows,
  mapSendrHotProspectToHighIntentView,
  mapSendrHotProspectToRailCard,
  mapSendrHotProspects,
  mapSignalFeedItemToEventView,
  mapSignalFeedItemToRailCard,
} from "@/lib/growth/activity/growth-activity-source-adapters"

export type { GrowthActivityLeadTimelineRow } from "@/lib/growth/activity/growth-activity-source-adapters"

export {
  buildGrowthActivityRailQueues,
  buildGrowthActivitySourceAudit,
  computeGrowthActivityMetrics,
  mergeGrowthActivityEvents,
} from "@/lib/growth/activity/growth-activity-unified-feed"

export type { GrowthActivityRailQueues } from "@/lib/growth/activity/growth-activity-unified-feed"
