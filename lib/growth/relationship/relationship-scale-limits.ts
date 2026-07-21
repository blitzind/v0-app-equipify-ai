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

/** Home canonical missions section — matches HAC top preview window. */
export const GROWTH_HOME_CANONICAL_MISSIONS_DISPLAY_LIMIT = 24 as const

/** Home mission discovery objective window — matches objective scheduler tick cap. */
export const GROWTH_HOME_MISSION_DISCOVERY_OBJECTIVE_LIMIT = 50 as const

/** Home HAC approval preview — matches canonical operator approval loader. */
export const GROWTH_HOME_HAC_TOP_LIMIT = 24 as const
export const GROWTH_HOME_HAC_TOTAL_LIMIT = 120 as const

/** Canonical decision in-process cache (growth-canonical-decision-engine-1c-cache). */
export const GROWTH_CANONICAL_DECISION_CACHE_MAX_ENTRIES = 256 as const

/** DRQ per-lead strategy bundle concurrency (GE-AIOS-HOME-RUNTIME-OPTIMIZATION-1A). */
export const GROWTH_DAILY_WORK_QUEUE_STRATEGY_CONCURRENCY_LIMIT = 8 as const

/** IRE historical learning org snapshot row cap per DRQ pass. */
export const GROWTH_DAILY_WORK_QUEUE_IRE_LEARNING_LIMIT = 500 as const

/** Objective scheduler bounded fetch — wake-time slice before 50-cap selection (GE-AIOS-HOME-RUNTIME-OPTIMIZATION-1A). */
export const GROWTH_OBJECTIVE_SCHEDULER_FETCH_LIMIT = 250 as const

/** Distinct org ids for scheduler sub-ticks (autonomous sales loop / draft factory). */
export const GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT = 20 as const

/** GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Canonical objectives executed per scheduler tick. */
export const GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT = 50 as const

/** GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — DB eligible fetch pool (2× execution cap for org fairness). */
export const GROWTH_OBJECTIVE_SCHEDULER_ELIGIBLE_FETCH_LIMIT = 100 as const

/** GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Parallel objective tick cap within one scheduler invocation. */
export const GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_CONCURRENCY_LIMIT = 2 as const

/** GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Per-objective tick timeout (slow-account isolation). */
export const GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS = 10_000 as const

/** GE-AIOS-RUNTIME-SCALE-1A — Per-organization ASL timeout (parallel research batches). */
export const GROWTH_OBJECTIVE_SCHEDULER_ORG_WORK_TIMEOUT_MS = 85_000 as const

/** GE-AIOS-RUNTIME-SCALE-1A — Outer scheduler wall-clock budget. */
export const GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS = 120_000 as const

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
  homeCanonicalMissionsDisplay: GROWTH_HOME_CANONICAL_MISSIONS_DISPLAY_LIMIT,
  homeMissionDiscoveryObjectives: GROWTH_HOME_MISSION_DISCOVERY_OBJECTIVE_LIMIT,
  homeHacTop: GROWTH_HOME_HAC_TOP_LIMIT,
  homeHacTotal: GROWTH_HOME_HAC_TOTAL_LIMIT,
  canonicalDecisionCacheMax: GROWTH_CANONICAL_DECISION_CACHE_MAX_ENTRIES,
  dailyWorkQueueStrategyConcurrency: GROWTH_DAILY_WORK_QUEUE_STRATEGY_CONCURRENCY_LIMIT,
  dailyWorkQueueIreLearningLimit: GROWTH_DAILY_WORK_QUEUE_IRE_LEARNING_LIMIT,
  objectiveSchedulerFetch: GROWTH_OBJECTIVE_SCHEDULER_FETCH_LIMIT,
  objectiveSchedulerOrgFetch: GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT,
  objectiveSchedulerExecution: GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT,
  objectiveSchedulerEligibleFetch: GROWTH_OBJECTIVE_SCHEDULER_ELIGIBLE_FETCH_LIMIT,
  objectiveSchedulerObjectiveConcurrency: GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_CONCURRENCY_LIMIT,
  objectiveSchedulerMaxRuntimeMs: GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS,
  phase1CompanyTarget: GROWTH_PHASE1_SCALE_COMPANY_TARGET,
  phase1ContactTarget: GROWTH_PHASE1_SCALE_CONTACT_TARGET,
} as const

export function clampRelationshipBatchLimit(requested: number | null | undefined, fallback: number): number {
  const value = requested ?? fallback
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(Math.floor(value), GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT)
}
