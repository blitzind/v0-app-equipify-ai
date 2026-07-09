/** GE-AIOS-18B — Structured observability for autonomous sales loop (server-only). */

import "server-only"

import { logGrowthEngine } from "@/lib/growth/growth-engine-log"
import { GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER } from "@/lib/growth/specialists/execution/autonomous-sales-loop-types"

export const GE_AIOS_18B_AUTONOMOUS_SALES_LOOP_OBSERVABILITY_QA_MARKER =
  "ge-aios-18b-autonomous-sales-loop-observability-v1" as const

export const AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS = {
  LOOP_TICK_STARTED: "autonomous_sales_loop_tick_started",
  LOOP_SKIPPED_AUTONOMY_DISABLED: "autonomous_sales_loop_skipped_autonomy_disabled",
  LOOP_DRY_RUN_STARTED: "autonomous_sales_loop_dry_run_started",
  WORK_ITEM_SELECTED: "autonomous_sales_loop_work_item_selected",
  AGENT_EXECUTED: "autonomous_sales_loop_agent_executed",
  AGENT_SKIPPED: "autonomous_sales_loop_agent_skipped",
  OUTCOME_FINALIZED: "autonomous_sales_loop_outcome_finalized",
  MEMORY_PERSISTED: "autonomous_sales_loop_memory_persisted",
  KNOWLEDGE_UPDATED: "autonomous_sales_loop_knowledge_updated",
  BUDGET_EXHAUSTED: "autonomous_sales_loop_budget_exhausted",
  NO_EXECUTABLE_WORK: "autonomous_sales_loop_no_executable_work",
  LOOP_COMPLETED: "autonomous_sales_loop_completed",
  LOOP_ERROR: "autonomous_sales_loop_error",
} as const

export type AutonomousSalesLoopObservabilityEvent =
  (typeof AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS)[keyof typeof AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS]

export function logAutonomousSalesLoopEvent(
  event: AutonomousSalesLoopObservabilityEvent,
  details: Record<string, unknown>,
): void {
  logGrowthEngine(event, {
    qa_marker: GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER,
    observability_qa_marker: GE_AIOS_18B_AUTONOMOUS_SALES_LOOP_OBSERVABILITY_QA_MARKER,
    ...details,
  })
}
