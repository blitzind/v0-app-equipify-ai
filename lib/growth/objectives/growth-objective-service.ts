/** GE-AUTO-1F/2A — Objective service: CRUD, planning, runtime (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { evaluateObjectivePlanOrchestration } from "@/lib/growth/objectives/growth-objective-orchestration"
import { planGrowthObjective } from "@/lib/growth/objectives/growth-objective-planner"
import { buildGrowthObjectiveEventSubscriptions } from "@/lib/growth/objectives/growth-objective-subscriptions"
import {
  getGrowthObjective,
  insertGrowthObjective,
  listGrowthObjectives,
  normalizeGrowthObjectiveExecutionPlan,
  updateGrowthObjective,
} from "@/lib/growth/objectives/growth-objective-repository"
import {
  ingestGrowthObjectiveSignal,
  pauseGrowthObjectiveRuntime,
  resumeGrowthObjectiveRuntime,
  startGrowthObjectiveRuntime,
  stopGrowthObjectiveRuntime,
} from "@/lib/growth/objectives/growth-objective-runtime-service"
import { rebuildGrowthObjectiveExecutionContext } from "@/lib/growth/objectives/growth-objective-materialization-service"
import { summarizeObjectiveExecutionContext } from "@/lib/growth/objectives/growth-objective-execution-context"
import {
  GROWTH_OBJECTIVE_QA_MARKER,
  GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
  type GrowthObjective,
  type GrowthObjectiveCreateInput,
  type GrowthObjectiveInboundSignal,
  type GrowthObjectiveSignalSnapshot,
} from "@/lib/growth/objectives/growth-objective-types"

export type GrowthObjectiveDashboardModel = {
  qa_marker: typeof GROWTH_OBJECTIVE_QA_MARKER
  runtime_qa_marker: typeof GROWTH_OBJECTIVE_RUNTIME_QA_MARKER
  objectives: GrowthObjective[]
  activeCount: number
  pausedCount: number
  runningCount: number
  totalTarget: number
  totalProgress: number
  emergencyStopActive: boolean
  objectiveModeEnabled: boolean
}

export type GrowthObjectiveExecutionSummary = ReturnType<typeof summarizeObjectiveExecutionContext>

function hydrateObjectivePlanForRead(objective: GrowthObjective): GrowthObjective {
  if (objective.plan) return objective
  if (objective.status === "draft" || objective.status === "planning" || objective.status === "archived") {
    return objective
  }
  return {
    ...objective,
    plan: planGrowthObjective(objective),
  }
}

export async function loadGrowthObjectiveDashboard(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthObjectiveDashboardModel> {
  const objectives = (await listGrowthObjectives(admin, organizationId)).map(hydrateObjectivePlanForRead)
  const killSwitches = await getRuntimeKillSwitchStates(admin)

  return {
    qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
    runtime_qa_marker: GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
    objectives,
    activeCount: objectives.filter((entry) => entry.status === "active").length,
    pausedCount: objectives.filter((entry) => entry.status === "paused").length,
    runningCount: objectives.filter((entry) => entry.runtime?.running).length,
    totalTarget: objectives.reduce((sum, entry) => sum + entry.targetValue, 0),
    totalProgress: objectives.reduce((sum, entry) => sum + entry.currentValue, 0),
    emergencyStopActive: !killSwitches.autonomy_enabled,
    objectiveModeEnabled: Boolean(killSwitches.autonomy_objective_mode_enabled),
  }
}


export async function createGrowthObjectiveWithPlan(
  admin: SupabaseClient,
  organizationId: string,
  input: GrowthObjectiveCreateInput,
  options?: {
    certificationMode?: boolean
    autoStart?: boolean
    actorUserId?: string
    actorUserEmail?: string
  },
): Promise<{ objective: GrowthObjective; orchestration: Awaited<ReturnType<typeof evaluateObjectivePlanOrchestration>> }> {
  const created = await insertGrowthObjective(admin, organizationId, input)
  const plan = planGrowthObjective(created)
  const subscriptions = buildGrowthObjectiveEventSubscriptions({ ...created, plan })
  const orchestration = await evaluateObjectivePlanOrchestration(admin, {
    organizationId,
    plan,
  })
  await updateGrowthObjective(admin, organizationId, created.id, {
    plan,
    status: "active",
    eventSubscriptions: subscriptions,
    executionHistory: [],
    recentSignals: [],
  })

  if (options?.autoStart === false) {
    const objective = await getGrowthObjective(admin, organizationId, created.id)
    if (!objective) throw new Error("Objective not found after create.")
    return { objective, orchestration }
  }

  const runtimeInput = {
    certificationMode: options?.certificationMode ?? false,
    actorUserId: options?.actorUserId ?? input.ownerUserId ?? null,
    actorUserEmail: options?.actorUserEmail ?? null,
  }

  const objective = await startGrowthObjectiveRuntime(admin, organizationId, created.id, runtimeInput)

  return { objective, orchestration }
}

export async function replanGrowthObjective(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
): Promise<{ objective: GrowthObjective; orchestration: Awaited<ReturnType<typeof evaluateObjectivePlanOrchestration>> }> {
  const current = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!current) throw new Error("Objective not found.")
  if (current.emergencyStopActive || current.status === "paused") {
    throw new Error("Cannot replan while objective is paused or emergency stop is active.")
  }

  const plan = planGrowthObjective(current)
  const subscriptions = buildGrowthObjectiveEventSubscriptions({ ...current, plan })
  const orchestration = await evaluateObjectivePlanOrchestration(admin, { organizationId, plan })
  const objective = await updateGrowthObjective(admin, organizationId, objectiveId, {
    plan,
    eventSubscriptions: subscriptions,
    status: current.status === "draft" ? "planning" : current.status,
  })
  return { objective, orchestration }
}

/** @deprecated Use ingestGrowthObjectiveSignal via runtime service */
export async function adaptGrowthObjective(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  signals: GrowthObjectiveSignalSnapshot,
): Promise<GrowthObjective> {
  const inbound: GrowthObjectiveInboundSignal[] = []
  if (signals.bookings > 0) {
    for (let i = 0; i < signals.bookings; i += 1) {
      inbound.push({ type: "booking_completed" })
    }
  }
  let objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective) throw new Error("Objective not found.")
  for (const signal of inbound) {
    objective = await ingestGrowthObjectiveSignal(admin, organizationId, objectiveId, signal)
  }
  if (inbound.length === 0) {
    objective = await ingestGrowthObjectiveSignal(
      admin,
      organizationId,
      objectiveId,
      {
        type: "engagement_open",
        payload: signals as unknown as Record<string, unknown>,
      },
    )
  }
  return objective
}

export async function pauseGrowthObjective(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
): Promise<GrowthObjective> {
  return pauseGrowthObjectiveRuntime(admin, organizationId, objectiveId)
}

export async function resumeGrowthObjective(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  options?: { certificationMode?: boolean },
): Promise<GrowthObjective> {
  return resumeGrowthObjectiveRuntime(admin, organizationId, objectiveId, options)
}

export async function archiveGrowthObjective(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
): Promise<GrowthObjective> {
  await stopGrowthObjectiveRuntime(admin, organizationId, objectiveId, { reason: "Archived" })
  return updateGrowthObjective(admin, organizationId, objectiveId, { status: "archived" })
}

export async function emergencyStopGrowthObjective(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
): Promise<GrowthObjective> {
  return stopGrowthObjectiveRuntime(admin, organizationId, objectiveId, {
    emergency: true,
    reason: "Objective emergency stop",
  })
}

export async function adjustGrowthObjectiveTarget(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  targetValue: number,
): Promise<GrowthObjective> {
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    throw new Error("Target value must be a positive number.")
  }
  const current = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!current) throw new Error("Objective not found.")
  const plan = current.plan ? planGrowthObjective({ ...current, targetValue }) : null
  return updateGrowthObjective(admin, organizationId, objectiveId, { targetValue, plan })
}

export {
  ingestGrowthObjectiveSignal,
  startGrowthObjectiveRuntime,
  stopGrowthObjectiveRuntime,
} from "@/lib/growth/objectives/growth-objective-runtime-service"

export { rebuildGrowthObjectiveExecutionContext }
export { summarizeObjectiveExecutionContext } from "@/lib/growth/objectives/growth-objective-execution-context"
