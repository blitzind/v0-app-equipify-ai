/** GE-AIOS-AUTONOMY-1B — Canonical Draft Factory wake event types (client-safe). */

export const GROWTH_AIOS_AUTONOMY_1B_PHASE = "GE-AIOS-AUTONOMY-1B" as const

export const GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER =
  "ge-aios-autonomy-1b-draft-factory-wake-bus-v1" as const

export const GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID = "draft_factory_wake_observer" as const

export const GROWTH_DRAFT_FACTORY_WAKE_BUS_RULE =
  "AI OS Event Bus completions fan into Draft Factory durable advance — no parallel wake system, no new scheduler framework." as const

/** Canonical completion events that advance Draft Factory via the bus observer. */
export const GROWTH_DRAFT_FACTORY_WAKE_EVENT_TYPES = [
  "growth.workflow.status_changed",
  "growth.company_intelligence.completed",
  "growth.datamoon.person_requested",
  "growth.datamoon.person_pending",
  "growth.datamoon.person_completed",
  "growth.datamoon.person_failed",
  "growth.execution_plan.review_changed",
  "growth.ava.outreach_package_approval",
  "decision.gate_passed",
  "decision.gate_blocked",
  "growth.contact.verified",
  "growth.contact.available",
  "growth.contact.verification_failed",
  "growth.personalization.completed",
  "growth.mission.changed",
  "growth.company.profile_changed",
  "growth.capacity.available",
  "growth.research.became_stale",
  "growth.budget.window_reset",
] as const

export type GrowthDraftFactoryWakeEventType = (typeof GROWTH_DRAFT_FACTORY_WAKE_EVENT_TYPES)[number]

export const GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER =
  "ge-aios-autonomy-1b-draft-factory-due-scheduler-v1" as const

export const GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ORGS = 20
export const GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG = 10
export const GROWTH_DRAFT_FACTORY_CAPACITY_SLOTS_PER_ORG = 5
/** Candidate pool size before portfolio-aware selection (AUTONOMY-1C). */
export const GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT = 100
/** FIFO candidates evaluated per capacity class before SV1-2 ranks. */
export const GROWTH_DRAFT_FACTORY_DUE_CLASS_CANDIDATE_CAP = 20
