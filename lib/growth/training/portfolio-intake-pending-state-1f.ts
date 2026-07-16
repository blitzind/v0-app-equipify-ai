/**
 * GE-AIOS-PORTFOLIO-INTAKE-PENDING-STATE-1F — Durable intake lifecycle (client-safe).
 */

import { PORTFOLIO_INTAKE_IDEMPOTENCY_DESIGN } from "@/lib/growth/prospect-search/prospect-search-datamoon-intake-lifecycle-1f"

export const GROWTH_AIOS_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER =
  "ge-aios-portfolio-intake-pending-state-1f-v1" as const

export const PORTFOLIO_INTAKE_LIFECYCLE_OWNERSHIP = {
  promotionOwner: "Portfolio Manager (runAutonomousPortfolioDiscoveryBatch)",
  pushFunction: "executeBulkPushToLeadInbox",
  prospectSearchRole: "Produces qualified survivors only — never owns promotion",
  intakePath: "Portfolio Manager → Lead promotion → Unified Intake → Admission",
} as const

export type PortfolioIntakeLifecycleTransition = {
  from: string
  to: string
  trigger: string
  owner: string
}

/** Durable state machine after 1F. */
export const PORTFOLIO_INTAKE_STATE_TRANSITIONS: PortfolioIntakeLifecycleTransition[] = [
  {
    from: "pending_build",
    to: "building",
    trigger: "DataMoon provider accepts audience build",
    owner: "Prospect Search (provider lifecycle only)",
  },
  {
    from: "building",
    to: "completed",
    trigger: "Provider poll observes terminal provider status",
    owner: "Prospect Search (provider lifecycle only)",
  },
  {
    from: "completed",
    to: "intake_pending",
    trigger: "markAutonomousRunIntakePending when survivors > 0",
    owner: "Prospect Search metadata witness — promotion deferred to Portfolio Manager",
  },
  {
    from: "completed",
    to: "intake_completed",
    trigger: "markAutonomousRunIntakeCompleted when zero survivors",
    owner: "Prospect Search metadata witness",
  },
  {
    from: "intake_pending",
    to: "intake_completed",
    trigger: "executeBulkPushToLeadInbox batch + markAutonomousRunIntakeCompleted",
    owner: "Portfolio Manager",
  },
  {
    from: "intake_completed",
    to: "terminal",
    trigger: "findLatestIntakePending skips run — no further promotion obligation",
    owner: "Portfolio Manager scheduler",
  },
]

export const PORTFOLIO_INTAKE_EXAMPLE_ORPHAN_REPLAY = {
  company: "Halliburton Company",
  scenario: "Provider completion between scheduler ticks",
  expectedPath: [
    "completed",
    "intake_pending (durable metadata)",
    "findLatestIntakePendingAutonomousProspectSearchDatamoonRun",
    "resumeAutonomousProspectSearchDatamoonDiscoveryFromIntakePendingRun",
    "executeBulkPushToLeadInbox",
    "intake_completed",
  ],
  mustNotOccur: ["startDatamoonAudienceImportRun", "duplicate promotion"],
} as const

export { PORTFOLIO_INTAKE_IDEMPOTENCY_DESIGN }

export const PORTFOLIO_INTAKE_REMAINING_BLOCKERS = [
  {
    id: "multi_batch_single_run_cursor",
    severity: "medium" as const,
    description:
      "Runs with survivor count > replenish batch size require intake_promotion_offset for sequential batch promotion within one run",
    note: "1F fixes between-tick orphan; multi-batch within-run is a separate milestone",
  },
  {
    id: "production_scheduler_tick",
    severity: "operational" as const,
    description:
      "Legacy completed runs reclassified as waiting_for_scheduler until next autonomous portfolio tick executes intake resume",
    note: "Classification bug count reaches 0 immediately; lead promotion requires live scheduler",
  },
] as const
