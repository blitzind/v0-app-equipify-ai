/** GE-AIOS-15D — Relationship lead snapshot projection (client-safe, read-only). */

import type { GrowthRelationshipStage } from "@/lib/growth/lead-memory/memory-types"

export const GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER =
  "ge-aios-15d-relationship-lead-snapshot-v1" as const

/** Persisted + projected relationship state for a single lead workspace row. */
export type RelationshipLeadSnapshot = {
  qa_marker: typeof GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER
  lead_id: string
  canonical_company_id?: string | null
  relationship_stage?: GrowthRelationshipStage | null
  /** Projection label — typically relationship_summary or workflow_health. */
  relationship_health?: string | null
  relationship_strength_tier?: string | null
  last_meaningful_touch_at?: string | null
  next_touch_at?: string | null
  follow_up_due_at?: string | null
  latest_conversation_thread_id?: string | null
  latest_conversation_status?: string | null
  latest_reply_at?: string | null
  latest_reply_sentiment?: string | null
  conversation_timeline_summary?: string | null
  waiting_on_operator?: boolean
  waiting_on_customer?: boolean
  blocked_reason?: string | null
  next_best_action?: string | null
  next_best_action_reason?: string | null
  memory_context_available?: boolean
  conversation_context_available?: boolean
}

export type RelationshipLeadSnapshotMap = Record<string, RelationshipLeadSnapshot>
