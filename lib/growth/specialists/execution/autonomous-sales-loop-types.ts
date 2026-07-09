/** GE-AIOS-18A — Autonomous Sales Execution Loop types (client-safe). */

import type { ExecuteReadyWorkItemsResult } from "@/lib/growth/work-manager/manager/run-work-manager"

export const GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER =
  "ge-aios-18a-autonomous-sales-loop-v1" as const

export const AUTONOMOUS_SALES_LOOP_DEFAULT_MAX_ITERATIONS = 5 as const
export const AUTONOMOUS_SALES_LOOP_DEFAULT_DAILY_BUDGET_MINUTES = 120 as const
export const AUTONOMOUS_SALES_LOOP_DEFAULT_ESTIMATED_MINUTES = 15 as const

export type AutonomousSalesLoopStopReason =
  | "daily_budget_exhausted"
  | "max_iterations_reached"
  | "no_executable_work"
  | "autonomy_disabled"
  | "context_unavailable"

export type AutonomousSalesLoopIterationResult = {
  work_item_id: string
  workflow_agent: string
  completed: boolean
  skip_reason?: string
  outcome_type?: string
}

export type AutonomousSalesLoopSelectedWorkItem = {
  work_item_id: string
  title: string
  workflow_agent: string
  lead_id: string | null
  decision_score: number
  estimated_minutes: number | null
  routing_reason: string | null
}

export type AutonomousSalesLoopResult = ExecuteReadyWorkItemsResult & {
  qa_marker: typeof GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER
  iterations: number
  outcomes_completed: number
  minutes_spent: number
  stop_reason: AutonomousSalesLoopStopReason | null
  iteration_log: AutonomousSalesLoopIterationResult[]
  queue_reprioritized: boolean
  memory_events_persisted: number
  knowledge_items_count: number
  /** GE-AIOS-18B — Dry-run inspects selected work without agent execution or persistence. */
  dry_run?: boolean
  selected_work?: AutonomousSalesLoopSelectedWorkItem[]
}

export type AutonomousSalesSchedulerTickResult = {
  qa_marker: typeof GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER
  organizations_attempted: number
  organizations_executed: number
  total_outcomes_completed: number
  total_iterations: number
  skipped_reason: string | null
  dry_run?: boolean
  organization_results: Array<{
    organizationId: string
    executed: boolean
    outcomes_completed: number
    stop_reason: AutonomousSalesLoopStopReason | null
    selected_work_count?: number
  }>
}

export type ContinueOperatingRhythmExecutionResult =
  | {
      continued: false
      reason: "autonomy_not_enabled" | "no_executable_work" | "planning_only"
    }
  | {
      continued: true
      reason: "sales_loop_executed"
      qa_marker: typeof GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER
      iterations: number
      outcomes_completed: number
    }
