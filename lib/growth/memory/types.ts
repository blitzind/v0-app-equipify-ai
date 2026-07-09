/** GE-AIOS-12A / GE-AIOS-17C — Ava Organizational Memory types (client-safe). */

import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"

import type { AvaNarrativeMetricsSnapshot } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AvaOperatingRhythmMemory } from "@/lib/growth/operating-rhythm/types"

export const GROWTH_MEMORY_ENGINE_QA_MARKER = "ge-aios-12a-memory-engine-v1" as const

export const AVA_ORGANIZATIONAL_MEMORY_STORAGE_KEY = "equipify:ava-organizational-memory/v1" as const

export type AvaMemoryCategory =
  | "business"
  | "customer"
  | "lead"
  | "opportunity"
  | "meeting"
  | "mission"
  | "approval"
  | "outreach"
  | "reply"
  | "decision"
  | "preference"
  | "learning"
  | "risk"
  | "win"
  | "loss"
  | "correction"

export type AvaMemoryEntityType =
  | "organization"
  | "lead"
  | "company"
  | "meeting"
  | "mission"
  | "approval"
  | "outreach"
  | "reply"
  | "preference"
  | "pattern"

export type AvaMemoryEventSource =
  | "workspace_summary"
  | "accomplishment"
  | "timeline"
  | "waiting_on_you"
  | "daily_work_queue"
  | "research_loop"
  | "narrative_snapshot"
  | "operating_rhythm"
  | "business_intelligence"
  | "sales_specialist"
  | "pattern_detection"
  | "preference"

export type AvaMemoryEvent = {
  id: string
  category: AvaMemoryCategory
  timestamp: string
  importance: number
  organizationId: string
  entityType: AvaMemoryEntityType
  entityId: string
  source: AvaMemoryEventSource
  summary: string
  metadata: Record<string, string | number | boolean | null>
}

export type AvaOrganizationalPreference = {
  id: string
  key: string
  statement: string
  importance: number
  source: AvaMemoryEventSource
  capturedAt: string
}

export type AvaMemoryPattern = {
  id: string
  label: string
  detail: string
  confidence: number
  supporting_event_ids: string[]
}

export type AvaMemoryTimelinePeriod = {
  id: string
  label: string
  events: AvaMemoryEvent[]
}

export type AvaMemoryCorrection = {
  id: string
  summary: string
  capturedAt: string
}

export type AvaOrganizationalMemoryStore = {
  capturedAt: string
  organizationId: string
  events: AvaMemoryEvent[]
  preferences: AvaOrganizationalPreference[]
}

export type AvaMemorySummary = {
  qaMarker: typeof GROWTH_MEMORY_ENGINE_QA_MARKER
  recent_events: AvaMemoryEvent[]
  important_events: AvaMemoryEvent[]
  preferences: AvaOrganizationalPreference[]
  detected_patterns: AvaMemoryPattern[]
  corrections: AvaMemoryCorrection[]
  unanswered_questions: string[]
  timeline: AvaMemoryTimelinePeriod[]
  learned_insights: string[]
  period_summary: string | null
  /** GE-AIOS-17C — Durable conclusions derived from Evidence → BI → Memory */
  organizational_knowledge: OrganizationalKnowledgeItem[]
}

export type MemoryEngineAdapterInput = {
  previousSnapshot?: AvaNarrativeMetricsSnapshot | null
  operatingRhythmMemory?: AvaOperatingRhythmMemory | null
}
