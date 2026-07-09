/** GE-AIOS-14A — Ava Specialist Orchestration (canonical export). */

export {
  GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER,
  AVA_SPECIALIST_MY_TEAM_TITLE,
  AVA_SPECIALIST_STUB_MESSAGE,
  type AvaSpecialistId,
  type AvaSpecialistDefinition,
  type AvaSpecialistRouteResult,
  type AvaSpecialistContribution,
  type AvaSpecialistTeamStatus,
  type AvaSpecialistOrchestratorResult,
  type AvaWorkItemWithSpecialist,
} from "@/lib/growth/specialists/types"

export {
  AVA_SPECIALIST_REGISTRY,
  getSpecialistById,
  listRegisteredSpecialists,
  type AvaSpecialistHandler,
} from "@/lib/growth/specialists/registry/specialist-registry"

export {
  routeWorkItem,
  routeWorkItems,
  resolveDefaultSpecialistOrder,
} from "@/lib/growth/specialists/router/route-work-item"

export {
  runSpecialistOrchestrator,
  orchestrateWorkManagerResult,
  delegateWorkItem,
  completeSpecialistWork,
  handoffBetweenSpecialists,
  type RunSpecialistOrchestratorInput,
} from "@/lib/growth/specialists/engine/run-specialist-orchestrator"

export {
  assignSpecialistsToWorkItems,
  buildSpecialistContributions,
  buildSpecialistTeamStatus,
  applySpecialistRoutingToWorkManagerResult,
} from "@/lib/growth/specialists/bridges/work-manager-bridge"

export {
  buildSpecialistNarrativeLines,
  buildSpecialistStoryBlocks,
  buildSpecialistNarrativeSummary,
  buildSpecialistContributionLine,
} from "@/lib/growth/specialists/bridges/narrative-bridge"

export { SALES_SPECIALIST } from "@/lib/growth/specialists/specialists/sales-specialist"
export { MARKETING_SPECIALIST } from "@/lib/growth/specialists/specialists/marketing-specialist"
export { CUSTOMER_SUCCESS_SPECIALIST } from "@/lib/growth/specialists/specialists/customer-success-specialist"
export { SERVICE_SPECIALIST } from "@/lib/growth/specialists/specialists/service-specialist"
export { FINANCE_SPECIALIST } from "@/lib/growth/specialists/specialists/finance-specialist"

export {
  GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
  type SalesOutcome,
  type SalesOutcomeDailySummary,
  type SalesSpecialistDelegationResult,
  type SalesSpecialistCompletionResult,
  type GrowthHomeSalesOutcomesPayload,
} from "@/lib/growth/specialists/execution/sales-outcome-types"

export {
  resolveWorkflowAgentForWorkItem,
  validateSalesOutcome,
  finalizeSalesSpecialistOutcomes,
} from "@/lib/growth/specialists/execution/sales-specialist-execution-bridge"

export {
  buildSalesOutcomeMemoryEvent,
  buildSalesCompletedWorkPeriodSummary,
  buildCompletedWorkNarrativeLines,
  SALES_SPECIALIST_MEMORY_SOURCE,
} from "@/lib/growth/specialists/execution/sales-specialist-memory-bridge"

export {
  GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER,
  AUTONOMOUS_SALES_LOOP_DEFAULT_MAX_ITERATIONS,
  AUTONOMOUS_SALES_LOOP_DEFAULT_DAILY_BUDGET_MINUTES,
  type AutonomousSalesLoopResult,
  type AutonomousSalesSchedulerTickResult,
  type AutonomousSalesLoopSelectedWorkItem,
  type ContinueOperatingRhythmExecutionResult,
} from "@/lib/growth/specialists/execution/autonomous-sales-loop-types"

export {
  GE_AIOS_18B_AUTONOMOUS_SALES_LOOP_OBSERVABILITY_QA_MARKER,
  AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS,
} from "@/lib/growth/specialists/execution/autonomous-sales-loop-observability"

export { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
