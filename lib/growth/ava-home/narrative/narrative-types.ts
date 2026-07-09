/** GE-AIOS-10A — Ava Narrative Intelligence Engine types (client-safe). */

export const GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER = "ge-aios-10a-narrative-engine-v1" as const

export type AvaStoryKind =
  | "approval"
  | "reply"
  | "meeting"
  | "opportunity"
  | "discovery"
  | "research"
  | "accomplishment"
  | "risk"
  | "mission"
  | "waiting"
  | "general"

export type AvaNarrativeFact = {
  id: string
  kind: AvaStoryKind
  label: string
  detail?: string | null
  href?: string | null
  count?: number
  companyName?: string | null
  industry?: string | null
  severity?: number
}

export type AvaNarrativeContext = {
  accomplishments: AvaNarrativeFact[]
  discoveries: AvaNarrativeFact[]
  opportunities: AvaNarrativeFact[]
  approvalsWaiting: AvaNarrativeFact[]
  inboxWaiting: AvaNarrativeFact[]
  repliesReceived: AvaNarrativeFact[]
  meetingsBooked: AvaNarrativeFact[]
  risks: AvaNarrativeFact[]
  missionsRunning: AvaNarrativeFact[]
  businessUnderstanding: {
    hasApprovedProfile: boolean
    hasBusinessResearch: boolean
    profileIncomplete: boolean
  }
  activityTimeline: AvaNarrativeFact[]
  metrics: {
    researched: number
    qualified: number
    readyForReview: number
    repliesToday: number
    meetingsToday: number
    approvalsWaiting: number
    hotCompanies: number
  }
}

export type AvaStoryBlock = {
  id: string
  kind: AvaStoryKind
  priority: number
  text: string
  href?: string | null
}

export type AvaPrioritizedStory = {
  kind: AvaStoryKind
  priority: number
  factId: string
}

export type AvaDailyBriefing = {
  qaMarker: typeof GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER
  title: string
  summary: string
  story_blocks: AvaStoryBlock[]
  top_priority: AvaStoryBlock | null
  waiting_on_user: AvaStoryBlock[]
  today_focus: string[]
  today_priorities: string[]
  since_yesterday: string[]
  risks: AvaStoryBlock[]
  wins: AvaStoryBlock[]
  supporting_metrics: Array<{ id: string; label: string; value: string }>
  metrics_snapshot: AvaNarrativeMetricsSnapshot
  work_manager_qa_marker?: string | null
  work_manager_result?: import("@/lib/growth/work-manager/types").AvaWorkManagerResult
  operating_rhythm_qa_marker?: string | null
  operating_rhythm_result?: import("@/lib/growth/operating-rhythm/types").AvaOperatingRhythm
  memory_qa_marker?: string | null
  memory_result?: import("@/lib/growth/memory/types").AvaMemorySummary
  memory_store?: import("@/lib/growth/memory/types").AvaOrganizationalMemoryStore
  specialist_orchestrator_qa_marker?: string | null
  specialist_orchestrator_result?: import("@/lib/growth/specialists/types").AvaSpecialistOrchestratorResult | null
  /** @deprecated GE-AIOS-11A — use work_manager_result */
  decision_engine_qa_marker?: string | null
  /** @deprecated GE-AIOS-11A — use work_manager_result */
  next_best_actions?: import("@/lib/growth/decision-engine/types").NextBestAction[]
}

export type AvaNarrativeMetricsSnapshot = {
  capturedAt: string
  researched: number
  qualified: number
  readyForReview: number
  repliesToday: number
  meetingsToday: number
  approvalsWaiting: number
  opportunitiesCount: number
}
