/** GE-AIOS-18A — Autonomous Sales Execution Loop (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import { buildGrowthHomeOrganizationalKnowledge } from "@/lib/growth/memory/knowledge/organization-knowledge-repository"
import { persistValidatedSalesOutcomeMemoryEvents } from "@/lib/growth/memory/storage/organization-memory-repository"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  delegateWorkItem,
  finalizeSalesSpecialistOutcomes,
} from "@/lib/growth/specialists/execution/sales-specialist-execution-bridge"
import {
  AUTONOMOUS_SALES_LOOP_DEFAULT_DAILY_BUDGET_MINUTES,
  AUTONOMOUS_SALES_LOOP_DEFAULT_ESTIMATED_MINUTES,
  AUTONOMOUS_SALES_LOOP_DEFAULT_MAX_ITERATIONS,
  GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER,
  type AutonomousSalesLoopIterationResult,
  type AutonomousSalesLoopResult,
  type AutonomousSalesLoopStopReason,
  type AutonomousSalesSchedulerTickResult,
  type ContinueOperatingRhythmExecutionResult,
} from "@/lib/growth/specialists/execution/autonomous-sales-loop-types"
import { executeSalesWorkflowAgent } from "@/lib/growth/specialists/execution/execute-sales-workflow-agent"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import {
  AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS,
  logAutonomousSalesLoopEvent,
} from "@/lib/growth/specialists/execution/autonomous-sales-loop-observability"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import type {
  AutonomousSalesLoopSelectedWorkItem,
} from "@/lib/growth/specialists/execution/autonomous-sales-loop-types"
import type { SalesOutcome } from "@/lib/growth/specialists/execution/sales-outcome-types"
import {
  executeReadyWorkItems,
  runWorkManager,
  type RunWorkManagerInput,
} from "@/lib/growth/work-manager/manager/run-work-manager"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import { withSchedulerWorkTimeout } from "@/lib/growth/runtime-guardrails/growth-scheduler-runtime-budget-1a"
import {
  AUTONOMOUS_SALES_LOOP_PER_WORK_ITEM_TIMEOUT_MS,
  AUTONOMOUS_SALES_LOOP_SCHEDULER_MAX_ITERATIONS,
  GROWTH_RUNTIME_THROUGHPUT_1A_QA_MARKER,
  resolveAutonomousSalesLoopSchedulerOrgTimeoutMs,
} from "@/lib/growth/specialists/execution/growth-runtime-throughput-1a"
import { continueCurrentPhase } from "@/lib/growth/operating-rhythm/engine/run-operating-rhythm"
import {
  countReconciledAslResearchOutcomesSince,
} from "@/lib/growth/specialists/execution/reconcile-asl-prospect-research-outcome-8b4"

export type RunAutonomousSalesLoopInput = {
  admin: SupabaseClient
  organizationId: string
  generatedAt?: string
  maxIterations?: number
  dailyBudgetMinutes?: number
  workManagerInput?: RunWorkManagerInput
  salesOutcomes?: SalesOutcome[]
  /** GE-AIOS-18B — Inspect selected work without agent execution or persistence. */
  dryRun?: boolean
  /** GE-AIOS-RUNTIME-THROUGHPUT-1A — per work-item timeout; slow leads yield to the next candidate. */
  perWorkItemTimeoutMs?: number
}

function estimateWorkItemMinutes(item: import("@/lib/growth/work-manager/types").AvaWorkItem): number {
  return item.estimated_minutes ?? AUTONOMOUS_SALES_LOOP_DEFAULT_ESTIMATED_MINUTES
}

function buildSelectedWorkSnapshot(input: {
  workItem: import("@/lib/growth/work-manager/types").AvaWorkItem
  workflowAgent: string
  routingReason: string | null
}): AutonomousSalesLoopSelectedWorkItem {
  return {
    work_item_id: input.workItem.id,
    title: input.workItem.title,
    workflow_agent: input.workflowAgent,
    lead_id: extractLeadIdFromWorkItem(input.workItem),
    decision_score: input.workItem.decision_score,
    estimated_minutes: input.workItem.estimated_minutes,
    routing_reason: input.routingReason,
  }
}

function buildLoopFailureResult(input: {
  reason: AutonomousSalesLoopStopReason
  iterations?: number
  outcomesCompleted?: number
  minutesSpent?: number
  iterationLog?: AutonomousSalesLoopIterationResult[]
  dryRun?: boolean
  selectedWork?: AutonomousSalesLoopSelectedWorkItem[]
}): AutonomousSalesLoopResult {
  return {
    qa_marker: GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER,
    executed: false,
    reason: input.reason,
    iterations: input.iterations ?? 0,
    outcomes_completed: input.outcomesCompleted ?? 0,
    minutes_spent: input.minutesSpent ?? 0,
    stop_reason: input.reason,
    iteration_log: input.iterationLog ?? [],
    queue_reprioritized: false,
    memory_events_persisted: 0,
    knowledge_items_count: 0,
    dry_run: input.dryRun,
    selected_work: input.selectedWork,
  }
}

async function loadAutonomousSalesLoopContext(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generatedAt: string
    operatorEmail?: string
    actorUserId?: string
  },
): Promise<{
  workManagerInput: RunWorkManagerInput
  salesOutcomes: SalesOutcome[]
  organizationalKnowledge: import("@/lib/growth/memory/knowledge/organization-knowledge-types").OrganizationalKnowledgeItem[]
  persistedMemoryStore: import("@/lib/growth/memory/types").AvaOrganizationalMemoryStore
} | null> {
  const canonicalOrganizationId = getGrowthEngineAiOrgId()
  if (canonicalOrganizationId && input.organizationId !== canonicalOrganizationId) {
    return null
  }

  const snapshot = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
  }).catch(() => null)

  if (!snapshot) return null

  return {
    workManagerInput: snapshot.workManagerInput,
    salesOutcomes: snapshot.salesOutcomes.outcomes,
    organizationalKnowledge: snapshot.organizationalKnowledge.store.items,
    persistedMemoryStore: snapshot.organizationalMemory.store,
    portfolioLeads: snapshot.portfolioLeads,
  }
}

function buildWorkManagerState(input: {
  workManagerInput: RunWorkManagerInput
  salesOutcomes: SalesOutcome[]
  organizationalKnowledge: import("@/lib/growth/memory/knowledge/organization-knowledge-types").OrganizationalKnowledgeItem[]
  persistedMemoryStore: import("@/lib/growth/memory/types").AvaOrganizationalMemoryStore
  organizationId: string
  generatedAt: string
  portfolioLeads?: import("@/lib/growth/types").GrowthLead[]
}): { workResult: AvaWorkManagerResult; salesOutcomes: SalesOutcome[] } {
  const { summary: memorySummary } = runMemoryEngine({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    workspaceSummary: input.workManagerInput.workspaceSummary,
    waitingOnYou: input.workManagerInput.waitingOnYou,
    dailyWorkQueue: input.workManagerInput.dailyWorkQueue,
    accomplishments: input.workManagerInput.accomplishments,
    timeline: input.workManagerInput.timeline,
    persistedStore: input.persistedMemoryStore,
    salesOutcomes: input.salesOutcomes,
    organizationalKnowledge: input.organizationalKnowledge,
  })

  const workResult = runWorkManager({
    ...input.workManagerInput,
    memorySummary,
    organizationId: input.organizationId,
    portfolioLeads: input.portfolioLeads ?? null,
  })

  return { workResult, salesOutcomes: input.salesOutcomes }
}

export async function runAutonomousSalesLoop(
  input: RunAutonomousSalesLoopInput,
): Promise<AutonomousSalesLoopResult> {
  const startedAt = Date.now()
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const maxIterations = input.maxIterations ?? AUTONOMOUS_SALES_LOOP_DEFAULT_MAX_ITERATIONS
  const dailyBudgetMinutes = input.dailyBudgetMinutes ?? AUTONOMOUS_SALES_LOOP_DEFAULT_DAILY_BUDGET_MINUTES
  const dryRun = input.dryRun === true
  const perWorkItemTimeoutMs =
    input.perWorkItemTimeoutMs ?? AUTONOMOUS_SALES_LOOP_PER_WORK_ITEM_TIMEOUT_MS
  const skippedWorkItemIds = new Set<string>()

  logAutonomousSalesLoopEvent(
    dryRun
      ? AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.LOOP_DRY_RUN_STARTED
      : AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.LOOP_TICK_STARTED,
    {
      organization_id: input.organizationId,
      dry_run: dryRun,
      max_iterations: maxIterations,
      daily_budget_minutes: dailyBudgetMinutes,
    },
  )

  const killSwitches = await getRuntimeKillSwitchStates(input.admin)
  if (!dryRun && !killSwitches.autonomy_enabled) {
    logAutonomousSalesLoopEvent(
      AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.LOOP_SKIPPED_AUTONOMY_DISABLED,
      { organization_id: input.organizationId },
    )
    return buildLoopFailureResult({ reason: "autonomy_disabled", dryRun })
  }

  const loadedContext =
    input.workManagerInput && input.salesOutcomes
      ? {
          workManagerInput: input.workManagerInput,
          salesOutcomes: input.salesOutcomes,
          organizationalKnowledge: [] as import("@/lib/growth/memory/knowledge/organization-knowledge-types").OrganizationalKnowledgeItem[],
          persistedMemoryStore: {
            organizationId: input.organizationId,
            capturedAt: generatedAt,
            events: [],
            preferences: [],
          },
        }
      : await loadAutonomousSalesLoopContext(input.admin, {
          organizationId: input.organizationId,
          generatedAt,
        })

  if (!loadedContext) {
    logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.LOOP_ERROR, {
      organization_id: input.organizationId,
      error_reason: "context_unavailable",
    })
    return buildLoopFailureResult({ reason: "context_unavailable", dryRun })
  }

  let { workResult, salesOutcomes } = buildWorkManagerState({
    ...loadedContext,
    organizationId: input.organizationId,
    generatedAt,
  })

  const initialActiveWorkId = workResult.active_work?.id ?? null
  const iterationLog: AutonomousSalesLoopIterationResult[] = []
  const selectedWork: AutonomousSalesLoopSelectedWorkItem[] = []
  let iterations = 0
  let outcomesCompleted = 0
  let minutesSpent = 0
  let memoryEventsPersisted = 0
  let knowledgeItemsCount = loadedContext.organizationalKnowledge.length
  let stopReason: AutonomousSalesLoopStopReason | null = null

  try {
    while (iterations < maxIterations && minutesSpent < dailyBudgetMinutes) {
      const nextItem = selectNextExecutableWorkItem(workResult, { excludeWorkItemIds: skippedWorkItemIds })
      if (!nextItem) {
        stopReason = "no_executable_work"
        logAutonomousSalesLoopEvent(
          AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.NO_EXECUTABLE_WORK,
          { organization_id: input.organizationId, dry_run: dryRun, skipped_count: skippedWorkItemIds.size },
        )
        break
      }

      const delegation = delegateWorkItem(nextItem)
      if (!delegation.delegated) {
        skippedWorkItemIds.add(nextItem.id)
        iterationLog.push({
          work_item_id: nextItem.id,
          workflow_agent: "none",
          completed: false,
          skip_reason: delegation.reason,
        })
        logAutonomousSalesLoopEvent(
          AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.NO_EXECUTABLE_WORK,
          {
            organization_id: input.organizationId,
            work_item_id: nextItem.id,
            skip_reason: delegation.reason,
            dry_run: dryRun,
            continue_after_skip: true,
          },
        )
        continue
      }

      logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.WORK_ITEM_SELECTED, {
        organization_id: input.organizationId,
        work_item_id: nextItem.id,
        workflow_agent: delegation.workflow_agent,
        decision_score: nextItem.decision_score,
        dry_run: dryRun,
      })

      selectedWork.push(
        buildSelectedWorkSnapshot({
          workItem: nextItem,
          workflowAgent: delegation.workflow_agent,
          routingReason: delegation.routing_reason,
        }),
      )

      iterations += 1
      minutesSpent += estimateWorkItemMinutes(nextItem)

      if (dryRun) {
        iterationLog.push({
          work_item_id: nextItem.id,
          workflow_agent: delegation.workflow_agent,
          completed: false,
          skip_reason: "dry_run",
        })
        break
      }

      let execution: Awaited<ReturnType<typeof executeSalesWorkflowAgent>>
      try {
        execution = await withSchedulerWorkTimeout(
          executeSalesWorkflowAgent(input.admin, {
            organizationId: input.organizationId,
            workItem: nextItem,
            delegation,
            generatedAt,
          }),
          perWorkItemTimeoutMs,
          "autonomous_sales_loop_work_item",
        )
      } catch (error) {
        skippedWorkItemIds.add(nextItem.id)
        const skipReason = error instanceof Error ? error.message : "work_item_timeout"
        iterationLog.push({
          work_item_id: nextItem.id,
          workflow_agent: delegation.workflow_agent,
          completed: false,
          skip_reason: skipReason,
        })
        logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.AGENT_SKIPPED, {
          organization_id: input.organizationId,
          work_item_id: nextItem.id,
          workflow_agent: delegation.workflow_agent,
          skip_reason: skipReason,
          throughput_qa_marker: GROWTH_RUNTIME_THROUGHPUT_1A_QA_MARKER,
        })
        continue
      }

      if (!execution.executed) {
        skippedWorkItemIds.add(nextItem.id)
        iterationLog.push({
          work_item_id: nextItem.id,
          workflow_agent: execution.workflow_agent,
          completed: false,
          skip_reason: execution.skip_reason,
        })
        logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.AGENT_SKIPPED, {
          organization_id: input.organizationId,
          work_item_id: nextItem.id,
          workflow_agent: execution.workflow_agent,
          skip_reason: execution.skip_reason,
          throughput_qa_marker: GROWTH_RUNTIME_THROUGHPUT_1A_QA_MARKER,
        })
        continue
      }

      logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.AGENT_EXECUTED, {
        organization_id: input.organizationId,
        work_item_id: nextItem.id,
        workflow_agent: execution.workflow_agent,
        outcome_type: execution.outcome.outcome_type,
        approval_required: execution.outcome.approval_required,
      })

      const validatedOutcomes = finalizeSalesSpecialistOutcomes({
        organizationId: input.organizationId,
        generatedAt,
        outcomes: [execution.outcome],
      })

      if (validatedOutcomes.length === 0) {
        skippedWorkItemIds.add(nextItem.id)
        iterationLog.push({
          work_item_id: nextItem.id,
          workflow_agent: execution.workflow_agent,
          completed: false,
          skip_reason: "validation_failed",
        })
        logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.LOOP_ERROR, {
          organization_id: input.organizationId,
          error_reason: "validation_failed",
          work_item_id: nextItem.id,
        })
        continue
      }

      logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.OUTCOME_FINALIZED, {
        organization_id: input.organizationId,
        work_item_id: nextItem.id,
        outcome_type: execution.outcome.outcome_type,
        outcomes_count: validatedOutcomes.length,
      })

      salesOutcomes = [...salesOutcomes, ...validatedOutcomes]
      outcomesCompleted += validatedOutcomes.length

      const researchOutcomePersistedByReconciliationAuthority =
        execution.workflow_agent === "research_agent" &&
        execution.outcome.outcome_type === "research_completed"

      const persistResult = researchOutcomePersistedByReconciliationAuthority
        ? { inserted: 0, skipped: validatedOutcomes.length, persistedEventIds: [] as string[] }
        : await persistValidatedSalesOutcomeMemoryEvents(input.admin, {
            organizationId: input.organizationId,
            outcomes: validatedOutcomes,
          }).catch(() => ({ inserted: 0, skipped: validatedOutcomes.length, persistedEventIds: [] }))
      memoryEventsPersisted += persistResult.inserted

      logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.MEMORY_PERSISTED, {
        organization_id: input.organizationId,
        inserted: persistResult.inserted,
        skipped: persistResult.skipped,
      })

      const knowledge = await buildGrowthHomeOrganizationalKnowledge({
        admin: input.admin,
        organizationId: input.organizationId,
        generatedAt,
        memoryEvents: loadedContext.persistedMemoryStore.events,
        salesOutcomes,
      }).catch(() => null)
      knowledgeItemsCount = knowledge?.store.items.length ?? knowledgeItemsCount

      logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.KNOWLEDGE_UPDATED, {
        organization_id: input.organizationId,
        knowledge_items_count: knowledgeItemsCount,
      })

      iterationLog.push({
        work_item_id: nextItem.id,
        workflow_agent: execution.workflow_agent,
        completed: true,
        outcome_type: execution.outcome.outcome_type,
      })

      const nextState = buildWorkManagerState({
        workManagerInput: loadedContext.workManagerInput,
        salesOutcomes,
        organizationalKnowledge: knowledge?.store.items ?? loadedContext.organizationalKnowledge,
        persistedMemoryStore: loadedContext.persistedMemoryStore,
        organizationId: input.organizationId,
        generatedAt,
      })
      workResult = nextState.workResult

      if (minutesSpent >= dailyBudgetMinutes) {
        stopReason = "daily_budget_exhausted"
        logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.BUDGET_EXHAUSTED, {
          organization_id: input.organizationId,
          minutes_spent: minutesSpent,
          daily_budget_minutes: dailyBudgetMinutes,
        })
        break
      }
      if (iterations >= maxIterations) {
        stopReason = "max_iterations_reached"
        break
      }
    }
  } catch (error) {
    logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.LOOP_ERROR, {
      organization_id: input.organizationId,
      error_reason: error instanceof Error ? error.message : "unknown_error",
      dry_run: dryRun,
    })
    return buildLoopFailureResult({
      reason: "context_unavailable",
      iterations,
      outcomesCompleted,
      minutesSpent,
      iterationLog,
      dryRun,
      selectedWork,
    })
  }

  if (!stopReason && outcomesCompleted === 0 && !dryRun) {
    stopReason = "no_executable_work"
  }
  if (dryRun && selectedWork.length > 0) {
    stopReason = null
  }

  const queueReprioritized =
    outcomesCompleted > 0 && (workResult.active_work?.id ?? null) !== initialActiveWorkId

  const loopResult: AutonomousSalesLoopResult = {
    qa_marker: GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER,
    executed: dryRun ? selectedWork.length > 0 : outcomesCompleted > 0,
    reason: dryRun
      ? "loop_completed"
      : outcomesCompleted > 0
        ? "loop_completed"
        : stopReason ?? "no_executable_work",
    iterations,
    outcomes_completed: outcomesCompleted,
    minutes_spent: minutesSpent,
    stop_reason: stopReason,
    iteration_log: iterationLog,
    queue_reprioritized: queueReprioritized,
    memory_events_persisted: memoryEventsPersisted,
    knowledge_items_count: knowledgeItemsCount,
    dry_run: dryRun,
    selected_work: selectedWork,
  }

  logAutonomousSalesLoopEvent(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.LOOP_COMPLETED, {
    organization_id: input.organizationId,
    dry_run: dryRun,
    executed: loopResult.executed,
    iterations: loopResult.iterations,
    outcomes_completed: loopResult.outcomes_completed,
    stop_reason: loopResult.stop_reason,
    selected_work_count: selectedWork.length,
    runtime_ms: Date.now() - startedAt,
  })

  executeReadyWorkItems(workResult, { loopResult })
  return loopResult
}

export async function inspectAutonomousSalesLoopDryRun(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string },
): Promise<AutonomousSalesLoopResult> {
  return runAutonomousSalesLoop({
    admin,
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    dryRun: true,
    maxIterations: 1,
    dailyBudgetMinutes: AUTONOMOUS_SALES_LOOP_DEFAULT_DAILY_BUDGET_MINUTES,
  })
}

export async function tickAutonomousSalesLoopForScheduler(
  admin: SupabaseClient,
  input: {
    organizationIds: string[]
    startedAt?: number
    maxRuntimeMs?: number
    maxOrganizations?: number
    perOrganizationTimeoutMs?: number
    dryRun?: boolean
  },
): Promise<AutonomousSalesSchedulerTickResult> {
  const startedAt = input.startedAt ?? Date.now()
  const maxRuntimeMs = input.maxRuntimeMs ?? 20_000
  const organizationIds = [...new Set(input.organizationIds)].slice(0, input.maxOrganizations ?? 5)
  const perOrganizationTimeoutMs =
    input.perOrganizationTimeoutMs ??
    resolveAutonomousSalesLoopSchedulerOrgTimeoutMs({
      salesLoopBudgetMs: maxRuntimeMs,
      organizationCount: Math.max(1, organizationIds.length),
    })

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  if (!input.dryRun && !killSwitches.autonomy_enabled) {
    logAutonomousSalesLoopEvent(
      AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.LOOP_SKIPPED_AUTONOMY_DISABLED,
      { scheduler_tick: true },
    )
    return {
      qa_marker: GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER,
      organizations_attempted: 0,
      organizations_executed: 0,
      total_outcomes_completed: 0,
      total_outcomes_reconciled: 0,
      total_iterations: 0,
      skipped_reason: "autonomy_disabled",
      dry_run: input.dryRun,
      organization_results: [],
    }
  }

  logAutonomousSalesLoopEvent(
    input.dryRun
      ? AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.LOOP_DRY_RUN_STARTED
      : AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS.LOOP_TICK_STARTED,
    {
      scheduler_tick: true,
      organization_count: organizationIds.length,
      dry_run: input.dryRun === true,
    },
  )

  const organizationResults: AutonomousSalesSchedulerTickResult["organization_results"] = []
  let totalOutcomesCompleted = 0
  let totalOutcomesReconciled = 0
  let totalIterations = 0
  let organizationsExecuted = 0
  const tickStartedAtIso = new Date(startedAt).toISOString()

  for (const organizationId of organizationIds) {
    if (Date.now() - startedAt >= maxRuntimeMs) break

    const canonicalOrganizationId = getGrowthEngineAiOrgId()
    if (canonicalOrganizationId && organizationId !== canonicalOrganizationId) {
      organizationResults.push({
        organizationId,
        executed: false,
        outcomes_completed: 0,
        outcomes_reconciled: 0,
        stop_reason: "context_unavailable",
      })
      continue
    }

    let loopResult: Awaited<ReturnType<typeof runAutonomousSalesLoop>>
    try {
      loopResult = await withSchedulerWorkTimeout(
        runAutonomousSalesLoop({
          admin,
          organizationId,
          maxIterations: input.dryRun ? 1 : AUTONOMOUS_SALES_LOOP_SCHEDULER_MAX_ITERATIONS,
          dailyBudgetMinutes: 30,
          dryRun: input.dryRun,
          perWorkItemTimeoutMs: AUTONOMOUS_SALES_LOOP_PER_WORK_ITEM_TIMEOUT_MS,
        }),
        perOrganizationTimeoutMs,
        "autonomous_sales_loop_org",
      )
    } catch {
      const reconciled = await countReconciledAslResearchOutcomesSince(admin, {
        organizationId,
        sinceIso: tickStartedAtIso,
      }).catch(() => ({ count: 0, runIds: [] }))

      organizationResults.push({
        organizationId,
        executed: false,
        outcomes_completed: 0,
        outcomes_reconciled: reconciled.count,
        stop_reason: "org_work_timeout",
      })
      totalOutcomesReconciled += reconciled.count
      continue
    }

    const reconciled = await countReconciledAslResearchOutcomesSince(admin, {
      organizationId,
      sinceIso: tickStartedAtIso,
    }).catch(() => ({ count: 0, runIds: [] }))

    organizationResults.push({
      organizationId,
      executed: loopResult.executed,
      outcomes_completed: loopResult.outcomes_completed,
      outcomes_reconciled: reconciled.count,
      stop_reason: loopResult.stop_reason,
      selected_work_count: loopResult.selected_work?.length ?? 0,
    })

    if (loopResult.executed) organizationsExecuted += 1
    totalOutcomesCompleted += loopResult.outcomes_completed
    totalOutcomesReconciled += reconciled.count
    totalIterations += loopResult.iterations
  }

  return {
    qa_marker: GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER,
    organizations_attempted: organizationIds.length,
    organizations_executed: organizationsExecuted,
    total_outcomes_completed: totalOutcomesCompleted,
    total_outcomes_reconciled: totalOutcomesReconciled,
    total_iterations: totalIterations,
    skipped_reason: null,
    dry_run: input.dryRun,
    organization_results: organizationResults,
  }
}

export async function continueOperatingRhythmExecution(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string },
): Promise<ContinueOperatingRhythmExecutionResult> {
  const loopResult = await runAutonomousSalesLoop({
    admin,
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
  })

  if (!loopResult.executed) {
    return {
      continued: false,
      reason: loopResult.stop_reason === "autonomy_disabled" ? "autonomy_not_enabled" : "no_executable_work",
    }
  }

  const phaseResult = continueCurrentPhase({
    loopResult: {
      continued: true,
      reason: "sales_loop_executed",
      qa_marker: GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER,
      iterations: loopResult.iterations,
      outcomes_completed: loopResult.outcomes_completed,
    },
  })

  if (!phaseResult.continued) {
    return { continued: false, reason: "planning_only" }
  }

  return phaseResult
}

export const AutonomousSalesLoop = {
  runAutonomousSalesLoop,
  inspectAutonomousSalesLoopDryRun,
  tickAutonomousSalesLoopForScheduler,
  continueOperatingRhythmExecution,
} as const

export { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
