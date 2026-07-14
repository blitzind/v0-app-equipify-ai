/**
 * GE-AIOS-ADAPTIVE-LOOP-1B — Live relationship event ingestion types (client-safe).
 * Records via existing lead_memory_events — no parallel event bus or persistence.
 */

import type { AdaptiveProspectEvent, AdaptiveProspectEventType } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"

export const GROWTH_AIOS_ADAPTIVE_LOOP_1B_QA_MARKER =
  "ge-aios-adaptive-loop-1b-live-relationship-event-ingestion-v1" as const

export const GROWTH_AIOS_ADAPTIVE_LOOP_1B_SOURCE_SYSTEM =
  "ge-aios-adaptive-loop-1b" as const

export const GROWTH_AIOS_ADAPTIVE_LOOP_1B_RELATIONSHIP_WAKE_CONDITION =
  "relationship_material_change" as const

export type LiveRelationshipEventSource =
  | "reply_intelligence"
  | "meeting_pipeline"
  | "buying_committee"
  | "outbound_tracking"
  | "company_research"
  | "operator_action"
  | "call_workspace"

export type LiveRelationshipIngestionResult = {
  qaMarker: typeof GROWTH_AIOS_ADAPTIVE_LOOP_1B_QA_MARKER
  leadId: string
  eventType: AdaptiveProspectEventType
  source: LiveRelationshipEventSource
  recorded: boolean
  materialChange: boolean
  strategyRefreshScheduled: boolean
  skipReason?: string | null
}

export type CanonicalRelationshipEventRecord = {
  id: string
  leadId: string
  event: AdaptiveProspectEvent
  source: LiveRelationshipEventSource
  materialChange: boolean
  processedForStrategy: boolean
  recordedAt: string
}

export type RelationshipMaterialChangeContext = {
  priorEngagementOpens?: number
  priorLinkClicks?: number
  strategyRelevantSignal?: boolean
  researchDeltaScore?: number
  hiringSignalStrength?: number
  organizationalImpactScore?: number
}

export const ADAPTIVE_LOOP_1B_ALWAYS_MATERIAL_EVENT_TYPES = [
  "reply_received",
  "meeting_booked",
  "meeting_completed",
  "objection",
  "already_have_software",
  "pricing_discussion",
  "proposal_requested",
  "champion_identified",
  "executive_engagement",
  "buying_committee_expansion",
  "referral",
  "competitor_mentioned",
  "budget_objection",
  "timing_objection",
  "relationship_deterioration",
  "unsubscribe",
  "decision_maker_changed",
] as const satisfies readonly AdaptiveProspectEventType[]

export const ADAPTIVE_LOOP_1B_CONDITIONAL_EVENT_TYPES = [
  "ghosting",
  "contact_changed",
  "company_research_updated",
  "website_changes",
  "funding",
  "acquisition",
  "organizational_changes",
] as const satisfies readonly AdaptiveProspectEventType[]

export const ADAPTIVE_LOOP_1B_NEVER_REBUILD_ALONE_SOURCES = [
  "email_delivered",
  "email_bounced",
  "tracking_pixel",
  "page_view",
  "profile_view",
  "signature_change",
  "retry_attempt",
  "internal_operator_action",
] as const

export type AdaptiveLoopNeverRebuildAloneSource =
  (typeof ADAPTIVE_LOOP_1B_NEVER_REBUILD_ALONE_SOURCES)[number]
