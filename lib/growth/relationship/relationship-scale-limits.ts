/** GE-AIOS-15B / GE-AIOS-15F — Bounded batch windows for relationship-scale read paths. */

export const GROWTH_RELATIONSHIP_SCALE_QA_MARKER = "ge-aios-15b-relationship-scale-v1" as const

export const GROWTH_HOME_WORKLOAD_SCALE_15F_QA_MARKER =
  "ge-aios-15f-sales-workload-scaling-pagination-v1" as const

/** Phase 1 scale targets (documentation — no unbounded fetches). */
export const GROWTH_PHASE1_SCALE_COMPANY_TARGET = 1_000 as const
export const GROWTH_PHASE1_SCALE_CONTACT_TARGET = 10_000 as const

/** Home workspace summary first-page lead pool. */
export const GROWTH_HOME_LEAD_POOL_BATCH_LIMIT = 250 as const

/** Revenue Queue projection batch window. */
export const GROWTH_REVENUE_QUEUE_BATCH_LIMIT = 250 as const

/** Daily revenue work queue lead input window. */
export const GROWTH_DAILY_WORK_QUEUE_LEAD_BATCH_LIMIT = 250 as const

/** Native dialer / call workspace lead resolve window. */
export const GROWTH_RELATIONSHIP_CALL_QUEUE_BATCH_LIMIT = 250 as const

/** Ava research loop batch window (orchestrator reads). */
export const GROWTH_RESEARCH_QUEUE_BATCH_LIMIT = 200 as const

/** Prospect search overlay hydration per auxiliary table. */
export const GROWTH_PROSPECT_SEARCH_OVERLAY_BATCH_LIMIT = 200 as const

/** Operator inbox / briefing lead-linked batch window. */
export const GROWTH_INBOX_OPERATOR_BATCH_LIMIT = 200 as const

/** Maximum allowed single-batch fetch for relationship-scale surfaces. */
export const GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT = 500 as const

/** Relationship snapshot auxiliary table row cap (GE-AIOS-15E). */
export const GROWTH_HOME_RELATIONSHIP_SNAPSHOT_AUX_ROW_LIMIT = 500 as const

/** Centralized cap registry for certification and ops documentation. */
export const GROWTH_SALES_WORKLOAD_CAP_REGISTRY = {
  qaMarker: GROWTH_HOME_WORKLOAD_SCALE_15F_QA_MARKER,
  homeLeadPool: GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  revenueQueue: GROWTH_REVENUE_QUEUE_BATCH_LIMIT,
  dailyWorkQueue: GROWTH_DAILY_WORK_QUEUE_LEAD_BATCH_LIMIT,
  callQueue: GROWTH_RELATIONSHIP_CALL_QUEUE_BATCH_LIMIT,
  researchQueue: GROWTH_RESEARCH_QUEUE_BATCH_LIMIT,
  prospectSearchOverlay: GROWTH_PROSPECT_SEARCH_OVERLAY_BATCH_LIMIT,
  inboxOperator: GROWTH_INBOX_OPERATOR_BATCH_LIMIT,
  relationshipSnapshotAux: GROWTH_HOME_RELATIONSHIP_SNAPSHOT_AUX_ROW_LIMIT,
  relationshipMaxBatch: GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT,
  phase1CompanyTarget: GROWTH_PHASE1_SCALE_COMPANY_TARGET,
  phase1ContactTarget: GROWTH_PHASE1_SCALE_CONTACT_TARGET,
} as const

export function clampRelationshipBatchLimit(requested: number | null | undefined, fallback: number): number {
  const value = requested ?? fallback
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(Math.floor(value), GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT)
}
