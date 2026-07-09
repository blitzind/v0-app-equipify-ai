/** GE-AIOS-10A — Ava Narrative Intelligence Engine (canonical export). */

export {
  GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER,
  GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER,
  type AvaDailyActivityLine,
  type AvaDailyActivityNarrative,
  type AvaDailyActivitySection,
  type NarrativeIntelligenceFocus,
  type AvaDailyBriefing,
  type AvaNarrativeContext,
  type AvaNarrativeFact,
  type AvaNarrativeMetricsSnapshot,
  type AvaPrioritizedStory,
  type AvaStoryBlock,
  type AvaStoryKind,
} from "@/lib/growth/ava-home/narrative/narrative-types"

export {
  AVA_NARRATIVE_ALL_NORMAL_LINE,
  AVA_NARRATIVE_PRIORITY_TITLE,
  AVA_NARRATIVE_SINCE_YESTERDAY_TITLE,
  AVA_NARRATIVE_TODAY_PRIORITIES_TITLE,
  AVA_NARRATIVE_WORKED_ON_TITLE,
  capitalizeSentence,
  pluralize,
} from "@/lib/growth/ava-home/narrative/copy/narrative-copy"

export {
  buildAvaNarrativeContext,
  buildAvaNarrativeMetricsSnapshotFromContext,
  type BuildAvaNarrativeContextInput,
} from "@/lib/growth/ava-home/narrative/context/build-ava-narrative-context"

export {
  AVA_NARRATIVE_SNAPSHOT_STORAGE_KEY,
  buildSinceYesterdayLines,
  readAvaNarrativeMetricsSnapshot,
  writeAvaNarrativeMetricsSnapshot,
} from "@/lib/growth/ava-home/narrative/context/ava-narrative-snapshot-memory"

export { prioritizeAvaStories, resolveStoryPriority } from "@/lib/growth/ava-home/narrative/priorities/prioritize-ava-story"

export {
  applyAvaNarrativeEnhancer,
  buildAvaDailyBriefing,
  resolveNarrativeDayPartFocus,
  type AvaNarrativeEnhancer,
  type BuildAvaDailyBriefingInput,
} from "@/lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"

export {
  buildAvaDailyActivityNarrative,
  buildDailyActivityCompletedLines,
  buildDailyActivityLearnedLines,
  buildDailyActivityWaitingLines,
  buildDailyActivityWorkingNowLines,
  buildDailyActivityWorkingNextLines,
  dailyActivityLinesToStoryBlocks,
  AVA_DAILY_ACTIVITY_SECTION_LABELS,
  AVA_DAILY_ACTIVITY_SECTION_ORDER,
} from "@/lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative"

export {
  GROWTH_AVA_NARRATIVE_INTELLIGENCE_18F_QA_MARKER,
  NARRATIVE_INTELLIGENCE_SECTION_LABELS,
  buildNarrativeIntelligenceOpeningLine,
  resolveNarrativeIntelligenceFocus,
  resolveNarrativeIntelligenceSectionOrder,
} from "@/lib/growth/ava-home/narrative/engine/growth-home-narrative-intelligence-18f"

export { buildAccomplishmentStories, buildTodayFocus, buildTodayPriorities } from "@/lib/growth/ava-home/narrative/stories/accomplishment-story"
export { buildApprovalStory } from "@/lib/growth/ava-home/narrative/stories/approval-story"
export { buildDiscoveryStory } from "@/lib/growth/ava-home/narrative/stories/discovery-story"
export { buildOpportunityStory } from "@/lib/growth/ava-home/narrative/stories/opportunity-story"
export { buildRiskStory } from "@/lib/growth/ava-home/narrative/stories/risk-story"
export {
  buildMeetingStory,
  buildMissionStory,
  buildReplyStory,
  buildResearchStory,
  buildWaitingStory,
} from "@/lib/growth/ava-home/narrative/stories/waiting-story"
