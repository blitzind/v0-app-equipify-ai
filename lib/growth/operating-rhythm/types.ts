/** GE-AIOS-13A — Ava Operating Rhythm types (client-safe). */

import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"

export const GROWTH_OPERATING_RHYTHM_QA_MARKER = "ge-aios-13a-operating-rhythm-v1" as const

export type AvaOperatingPhaseId =
  | "morning_planning"
  | "research_cycle"
  | "qualification_cycle"
  | "outreach_preparation"
  | "inbox_monitoring"
  | "approval_collection"
  | "reflection"

export type AvaOperatingPhaseStatus = "completed" | "active" | "pending" | "blocked"

export type AvaOperatingPhaseEntry = {
  id: AvaOperatingPhaseId
  label: string
  status: AvaOperatingPhaseStatus
  summary: string | null
}

export type AvaOperatingRhythm = {
  qaMarker: typeof GROWTH_OPERATING_RHYTHM_QA_MARKER
  current_phase: AvaOperatingPhaseId
  completed_phases: AvaOperatingPhaseId[]
  next_phase: AvaOperatingPhaseId | null
  active_cycle: AvaOperatingPhaseEntry | null
  today_plan: string[]
  phase_timeline: AvaOperatingPhaseEntry[]
  interruptions: string[]
  waiting_on_operator: string[]
  end_of_day_summary: string | null
}

export type OperatingRhythmMetrics = {
  researched: number
  qualified: number
  readyForReview: number
  repliesToday: number
  meetingsToday: number
  approvalsWaiting: number
}

export type OperatingRhythmPhaseInput = {
  hour: number
  currentPhase: AvaOperatingPhaseId
  workResult: AvaWorkManagerResult
  metrics: OperatingRhythmMetrics
  sinceYesterday: string[]
  previousMemory: AvaOperatingRhythmMemory | null
}

export type AvaOperatingRhythmMemory = {
  capturedAt: string
  accomplishments: string[]
  interruptions: string[]
  approvals: string[]
  wins: string[]
  risks: string[]
  unfinished_work: string[]
  tomorrow_plan: string[]
}

export const AVA_OPERATING_PHASE_ORDER: AvaOperatingPhaseId[] = [
  "morning_planning",
  "research_cycle",
  "qualification_cycle",
  "outreach_preparation",
  "inbox_monitoring",
  "approval_collection",
  "reflection",
]

export const AVA_OPERATING_PHASE_LABELS: Record<AvaOperatingPhaseId, string> = {
  morning_planning: "Morning Planning",
  research_cycle: "Research",
  qualification_cycle: "Qualification",
  outreach_preparation: "Outreach Preparation",
  inbox_monitoring: "Inbox Monitoring",
  approval_collection: "Waiting on You",
  reflection: "Reflection",
}
