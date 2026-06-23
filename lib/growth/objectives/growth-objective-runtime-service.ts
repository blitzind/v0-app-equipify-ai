/** GE-AUTO-2A — Closed-loop objective runtime service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { generateGrowthObjectiveAdaptiveRecommendations } from "@/lib/growth/objectives/growth-objective-adaptive-engine"
import { planGrowthObjective } from "@/lib/growth/objectives/growth-objective-planner"
import { getGrowthObjective, updateGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"
import { logGrowthObjectiveRuntimeEvent } from "@/lib/growth/objectives/growth-objective-runtime-logger"
import {
  appendObjectiveRecentSignal,
  buildObjectiveSignalSnapshot,
  computeObjectiveProgressDelta,
  estimateObjectiveCompletionDate,
  isDuplicateObjectiveSignalIngest,
  isObjectiveComplete,
} from "@/lib/growth/objectives/growth-objective-signal-handler"
import { executeGrowthObjectiveStage } from "@/lib/growth/objectives/growth-objective-stage-executors"
import { OBJECTIVE_MATERIALIZATION_STAGE_IDS } from "@/lib/growth/objectives/growth-objective-execution-context"
import { recoverGrowthObjectiveRuntimeContext } from "@/lib/growth/objectives/growth-objective-materialization-service"
import {
  requireObjectiveActorContext,
  resolveObjectiveActorContext,
} from "@/lib/growth/objectives/growth-objective-actor-resolution"
import {
  buildInitialObjectiveRuntimeStageRecords,
  computeObjectiveProgressPercent,
  resolveNextObjectiveStageId,
  transitionObjectiveRuntimeStage,
} from "@/lib/growth/objectives/growth-objective-stage-state-machine"
import {
  GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
  GROWTH_OBJECTIVE_STAGE_IDS,
  type GrowthObjective,
  type GrowthObjectiveExecutionHistoryEntry,
  type GrowthObjectiveInboundSignal,
  type GrowthObjectiveRuntimeState,
  type GrowthObjectiveStageId,
} from "@/lib/growth/objectives/growth-objective-types"

type GrowthObjectiveRuntimeTickInput = {
  certificationMode?: boolean
  actorUserId?: string | null
  actorUserEmail?: string | null
}

async function resolveTickActorContext(
  admin: SupabaseClient,
  objective: GrowthObjective,
  input?: GrowthObjectiveRuntimeTickInput,
): Promise<{ userId: string; userEmail: string }> {
  if (input?.actorUserId && input?.actorUserEmail) {
    return { userId: input.actorUserId, userEmail: input.actorUserEmail }
  }

  if (input?.certificationMode) {
    const resolved = await resolveObjectiveActorContext(admin, objective)
    if (resolved) return resolved
    return {
      userId: objective.ownerUserId ?? "certification-actor",
      userEmail: "certification@equipify.internal",
    }
  }

  const report = await requireObjectiveActorContext(admin, objective)
  return { userId: report.userId, userEmail: report.userEmail }
}

function historyEntry(input: Omit<GrowthObjectiveExecutionHistoryEntry, "id" | "ts">): GrowthObjectiveExecutionHistoryEntry {
  return {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    ...input,
  }
}

function initRuntime(objective: GrowthObjective): GrowthObjectiveRuntimeState {
  return {
    qa_marker: GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
    currentStageId: "discover",
    stageStates: buildInitialObjectiveRuntimeStageRecords(),
    startedAt: new Date().toISOString(),
    lastTickAt: null,
    stoppedAt: null,
    estimatedCompletionDate: estimateObjectiveCompletionDate({
      currentValue: objective.currentValue,
      targetValue: objective.targetValue,
      forecastDays: objective.plan?.forecast.estimatedDays ?? 30,
      startedAt: new Date().toISOString(),
    }),
    running: true,
    lastSignalAt: null,
    lastProgressAt: null,
    stalledSince: null,
    lastSchedulerAt: null,
  }
}

function syncPlanStages(objective: GrowthObjective): GrowthObjective["plan"] {
  if (!objective.plan || !objective.runtime?.stageStates) return objective.plan
  return {
    ...objective.plan,
    stages: objective.plan.stages.map((stage) => {
      const runtimeStage = objective.runtime?.stageStates[stage.id]
      if (!runtimeStage) return stage
      const plannerStatus =
        runtimeStage.state === "completed"
          ? "complete"
          : runtimeStage.state === "running"
            ? "in_progress"
            : runtimeStage.state === "blocked"
              ? "blocked"
              : runtimeStage.state === "failed"
                ? "blocked"
                : stage.status
      return {
        ...stage,
        status: plannerStatus,
        progress: runtimeStage.progress,
        blockers: runtimeStage.blockers,
      }
    }),
  }
}

async function persistObjectiveRuntime(
  admin: SupabaseClient,
  organizationId: string,
  objective: GrowthObjective,
  historyAppend: GrowthObjectiveExecutionHistoryEntry[],
): Promise<GrowthObjective> {
  const plan = syncPlanStages(objective)
  return updateGrowthObjective(admin, organizationId, objective.id, {
    plan,
    runtime: objective.runtime,
    executionContext: objective.executionContext,
    executionHistory: [...historyAppend, ...objective.executionHistory].slice(0, 200),
    recentSignals: objective.recentSignals,
    recommendations: objective.recommendations,
    currentValue: objective.currentValue,
    status: objective.status,
    emergencyStopActive: objective.emergencyStopActive,
  })
}

function assertRunnable(objective: GrowthObjective): void {
  if (objective.emergencyStopActive) {
    throw new Error("Objective emergency stop is active.")
  }
  if (objective.status === "paused") {
    throw new Error("Objective is paused.")
  }
  if (objective.status === "completed" || objective.status === "archived") {
    throw new Error("Objective is not runnable.")
  }
}

export async function startGrowthObjectiveRuntime(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  input?: GrowthObjectiveRuntimeTickInput,
): Promise<GrowthObjective> {
  const objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective) throw new Error("Objective not found.")

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  if (!killSwitches.autonomy_enabled) {
    throw new Error("Platform autonomy emergency stop is active.")
  }

  const plan = objective.plan ?? planGrowthObjective(objective)
  const baseRuntime = initRuntime({ ...objective, plan })
  const existingRuntime = objective.runtime
  const runtime =
    existingRuntime?.currentStageId && existingRuntime.stageStates
      ? {
          ...baseRuntime,
          ...existingRuntime,
          stageStates: { ...baseRuntime.stageStates, ...existingRuntime.stageStates },
        }
      : baseRuntime

  let next: GrowthObjective = {
    ...objective,
    plan,
    status: "active",
    runtime,
    executionHistory: objective.executionHistory ?? [],
    recentSignals: objective.recentSignals ?? [],
  }

  if (!next.runtime) {
    next = { ...next, runtime: initRuntime(next) }
  }

  next.runtime = {
    ...next.runtime,
    running: true,
    stoppedAt: null,
    lastTickAt: new Date().toISOString(),
  }

  const entry = historyEntry({
    stageId: next.runtime.currentStageId,
    action: "start",
    outcome: "success",
    reason: null,
    policyGated: false,
    capability: null,
    detail: input?.certificationMode ? "certification_start" : null,
  })

  await logGrowthObjectiveRuntimeEvent(admin, { organizationId, objectiveId, entry })
  next = await recoverGrowthObjectiveRuntimeContext(admin, organizationId, next)
  next = await persistObjectiveRuntime(admin, organizationId, next, [entry])
  return tickGrowthObjectiveRuntime(admin, organizationId, objectiveId, input)
}

export async function tickGrowthObjectiveRuntime(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  input?: GrowthObjectiveRuntimeTickInput,
): Promise<GrowthObjective> {
  let objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective) throw new Error("Objective not found.")
  objective = await recoverGrowthObjectiveRuntimeContext(admin, organizationId, objective)
  assertRunnable(objective)
  if (!objective.runtime?.running) {
    throw new Error("Objective runtime is not running.")
  }

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  if (!killSwitches.autonomy_enabled) {
    return stopGrowthObjectiveRuntime(admin, organizationId, objectiveId, {
      reason: "Platform emergency stop active.",
    })
  }

  const stageId = objective.runtime.currentStageId
  let stageStates = { ...objective.runtime.stageStates }
  let stageRecord = stageStates[stageId]
  if (!stageRecord) {
    const initialized = buildInitialObjectiveRuntimeStageRecords()
    stageStates = { ...initialized, ...stageStates }
    stageRecord = stageStates[stageId] ?? initialized.discover
    objective = {
      ...objective,
      runtime: { ...objective.runtime, stageStates, currentStageId: stageId ?? "discover" },
    }
  }

  let runtime = { ...objective.runtime, stageStates }

  if (stageRecord.state === "pending" || stageRecord.state === "blocked") {
    stageStates[stageId] = transitionObjectiveRuntimeStage(stageRecord, "running")
  }

  const actor = await resolveTickActorContext(admin, objective, input)
  const execution = await executeGrowthObjectiveStage(admin, {
    organizationId,
    objective,
    stageId,
    certificationMode: input?.certificationMode,
    actorUserId: actor.userId,
    actorUserEmail: actor.userEmail,
  })

  const entry = historyEntry({
    stageId,
    action: "execute_stage",
    outcome: execution.outcome,
    reason: execution.reason,
    policyGated: execution.policyGated,
    capability: execution.capability,
    detail: execution.detail,
  })
  await logGrowthObjectiveRuntimeEvent(admin, { organizationId, objectiveId, entry })

  if (
    execution.outcome === "skipped" &&
    (OBJECTIVE_MATERIALIZATION_STAGE_IDS as readonly string[]).includes(stageId)
  ) {
    const progress =
      typeof execution.artifacts.progress === "number" ? Number(execution.artifacts.progress) : stageStates[stageId].progress
    stageStates[stageId] = {
      ...stageStates[stageId],
      state: "running",
      progress,
      blockers: execution.reason ? [execution.reason] : stageStates[stageId].blockers,
    }
    runtime = { ...runtime, stageStates, lastTickAt: new Date().toISOString() }
    const refreshed = await getGrowthObjective(admin, organizationId, objectiveId)
    return persistObjectiveRuntime(
      admin,
      organizationId,
      { ...(refreshed ?? objective), runtime },
      [entry],
    )
  }

  if (execution.outcome === "blocked") {
    stageStates[stageId] = transitionObjectiveRuntimeStage(stageStates[stageId], "blocked", {
      blockers: [execution.reason ?? "Policy blocked"],
    })
    runtime = { ...runtime, stageStates, lastTickAt: new Date().toISOString() }
    return persistObjectiveRuntime(admin, organizationId, { ...objective, runtime }, [entry])
  }

  if (execution.outcome === "failed") {
    stageStates[stageId] = transitionObjectiveRuntimeStage(stageStates[stageId], "failed", {
      error: execution.reason,
    })
    runtime = { ...runtime, stageStates, running: false, lastTickAt: new Date().toISOString() }
    return persistObjectiveRuntime(admin, organizationId, { ...objective, runtime, status: "paused" }, [entry])
  }

  const isSkipped = execution.outcome === "skipped"
  if (!isSkipped && stageStates[stageId].state !== "completed") {
    stageStates[stageId] = transitionObjectiveRuntimeStage(stageStates[stageId], "completed", {
      progress: 100,
    })
  } else if (
    isSkipped &&
    stageId !== "book" &&
    stageId !== "complete" &&
    stageId !== "monitor" &&
    stageId !== "adapt" &&
    !(OBJECTIVE_MATERIALIZATION_STAGE_IDS as readonly string[]).includes(stageId) &&
    stageStates[stageId].state !== "completed"
  ) {
    stageStates[stageId] = {
      ...stageStates[stageId],
      state: "completed",
      progress: 50,
      completedAt: new Date().toISOString(),
      blockers: execution.reason ? [execution.reason] : stageStates[stageId].blockers,
    }
  }

  if (stageId === "launch" && execution.outcome === "success") {
    try {
      const { wireObjectiveLaunchResources } = await import(
        "@/lib/growth/objectives/growth-objective-launch-wiring"
      )
      const latest = (await getGrowthObjective(admin, organizationId, objectiveId)) ?? objective
      objective = await wireObjectiveLaunchResources(admin, {
        organizationId,
        objective: { ...latest, runtime: { ...runtime, stageStates } },
      })
    } catch {
      // Best-effort launch resource wiring.
    }
  }

  let nextStageId: GrowthObjectiveStageId | null = stageId
  if (!isSkipped || stageId === "book" || stageId === "monitor" || stageId === "launch") {
    nextStageId = resolveNextObjectiveStageId(stageId)
  }

  if (stageId === "monitor" || stageId === "adapt") {
    nextStageId = stageId
  }

  if (stageId === "book" && !isObjectiveComplete(objective)) {
    nextStageId = "book"
    stageStates.book = {
      ...stageStates.book,
      state: "running",
      progress: computeObjectiveProgressPercent({
        currentValue: objective.currentValue,
        targetValue: objective.targetValue,
        completedStages: GROWTH_OBJECTIVE_STAGE_IDS.filter(
          (id) => stageStates[id]?.state === "completed",
        ).length,
        totalStages: GROWTH_OBJECTIVE_STAGE_IDS.length,
      }),
    }
  }

  if (nextStageId && nextStageId !== stageId && !isSkipped) {
    runtime.currentStageId = nextStageId
  }

  runtime = {
    ...runtime,
    stageStates,
    lastTickAt: new Date().toISOString(),
    stalledSince: null,
    estimatedCompletionDate: estimateObjectiveCompletionDate({
      currentValue: objective.currentValue,
      targetValue: objective.targetValue,
      forecastDays: objective.plan?.forecast.estimatedDays ?? 30,
      startedAt: runtime.startedAt,
    }),
  }

  let status = objective.status
  if (stageId === "complete" && execution.outcome === "success") {
    status = "completed"
    runtime.running = false
    runtime.stoppedAt = new Date().toISOString()
  }

  objective = { ...objective, runtime, status }
  const refreshedObjective = await getGrowthObjective(admin, organizationId, objectiveId)
  objective = await persistObjectiveRuntime(
    admin,
    organizationId,
    { ...(refreshedObjective ?? objective), runtime, status },
    [entry],
  )

  if (status === "completed") {
    return objective
  }

  if (nextStageId && nextStageId !== stageId && stageStates[stageId]?.state === "completed") {
    return tickGrowthObjectiveRuntime(admin, organizationId, objectiveId, input)
  }

  return objective
}

export async function pauseGrowthObjectiveRuntime(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
): Promise<GrowthObjective> {
  const objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective?.runtime) {
    return updateGrowthObjective(admin, organizationId, objectiveId, { status: "paused" })
  }

  const stageId = objective.runtime.currentStageId
  const stageStates = { ...objective.runtime.stageStates }
  const current = stageStates[stageId]
  if (current.state === "running") {
    stageStates[stageId] = transitionObjectiveRuntimeStage(current, "paused")
  }

  const entry = historyEntry({
    stageId,
    action: "pause",
    outcome: "success",
    reason: null,
    policyGated: false,
    capability: null,
  })
  await logGrowthObjectiveRuntimeEvent(admin, { organizationId, objectiveId, entry })

  return persistObjectiveRuntime(
    admin,
    organizationId,
    {
      ...objective,
      status: "paused",
      runtime: { ...objective.runtime, running: false, stageStates },
    },
    [entry],
  )
}

export async function resumeGrowthObjectiveRuntime(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  input?: GrowthObjectiveRuntimeTickInput,
): Promise<GrowthObjective> {
  const objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective) throw new Error("Objective not found.")
  if (objective.emergencyStopActive) {
    throw new Error("Cannot resume — objective emergency stop is active.")
  }

  const runtime = objective.runtime
    ? { ...objective.runtime, running: true, stoppedAt: null }
    : initRuntime(objective)

  const updated = await persistObjectiveRuntime(
    admin,
    organizationId,
    { ...objective, status: "active", runtime },
    [
      historyEntry({
        stageId: runtime.currentStageId,
        action: "resume",
        outcome: "success",
        reason: null,
        policyGated: false,
        capability: null,
      }),
    ],
  )

  return tickGrowthObjectiveRuntime(admin, organizationId, objectiveId, input)
}

export async function stopGrowthObjectiveRuntime(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  input?: { reason?: string; emergency?: boolean },
): Promise<GrowthObjective> {
  const objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective) throw new Error("Objective not found.")

  const runtime = objective.runtime
    ? {
        ...objective.runtime,
        running: false,
        stoppedAt: new Date().toISOString(),
      }
    : null

  const entry = historyEntry({
    stageId: runtime?.currentStageId ?? "discover",
    action: input?.emergency ? "emergency_stop" : "stop",
    outcome: "success",
    reason: input?.reason ?? null,
    policyGated: false,
    capability: null,
  })
  await logGrowthObjectiveRuntimeEvent(admin, { organizationId, objectiveId, entry })

  return persistObjectiveRuntime(
    admin,
    organizationId,
    {
      ...objective,
      status: "paused",
      emergencyStopActive: Boolean(input?.emergency),
      runtime,
    },
    [entry],
  )
}

export async function ingestGrowthObjectiveSignal(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  signal: GrowthObjectiveInboundSignal,
  input?: GrowthObjectiveRuntimeTickInput,
): Promise<GrowthObjective> {
  let objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective) throw new Error("Objective not found.")
  if (objective.emergencyStopActive || objective.status === "paused") {
    return objective
  }

  if (isDuplicateObjectiveSignalIngest(objective, signal)) {
    return objective
  }

  const now = new Date().toISOString()
  const recentSignals = appendObjectiveRecentSignal(objective.recentSignals ?? [], signal, objectiveId)
  const delta = computeObjectiveProgressDelta(objective.objectiveType, signal)
  const currentValue = Math.min(objective.targetValue, objective.currentValue + delta)

  const snapshot = buildObjectiveSignalSnapshot(recentSignals)
  const recommendations = generateGrowthObjectiveAdaptiveRecommendations({ objective, signals: snapshot })

  let runtime = objective.runtime
    ? {
        ...objective.runtime,
        lastSignalAt: now,
        lastProgressAt: delta > 0 ? now : objective.runtime.lastProgressAt ?? null,
        stalledSince: null,
      }
    : null

  let plan = objective.plan
  if (plan) {
    plan = {
      ...plan,
      stages: plan.stages.map((stage) =>
        stage.id === "adapt"
          ? {
              ...stage,
              recommendations: recommendations.map((entry) => entry.recommendation),
            }
          : stage.id === "monitor"
            ? { ...stage, status: "in_progress" as const, progress: Math.min(100, snapshot.engagementScore) }
            : stage,
      ),
    }
  }

  const entry = historyEntry({
    stageId: objective.runtime?.currentStageId ?? "monitor",
    action: "ingest_signal",
    outcome: "success",
    reason: null,
    policyGated: false,
    capability: null,
    signalType: signal.type,
    detail: delta > 0 ? `Progress +${delta}` : null,
  })
  await logGrowthObjectiveRuntimeEvent(admin, { organizationId, objectiveId, entry })

  objective = await persistObjectiveRuntime(
    admin,
    organizationId,
    {
      ...objective,
      recentSignals,
      currentValue,
      recommendations,
      plan,
      runtime,
    },
    [entry],
  )

  if (isObjectiveComplete(objective)) {
    const completed = await persistObjectiveRuntime(
      admin,
      organizationId,
      {
        ...objective,
        status: "completed",
        runtime: objective.runtime
          ? {
              ...objective.runtime,
              running: false,
              stoppedAt: new Date().toISOString(),
              currentStageId: "complete",
            }
          : null,
      },
      [
        historyEntry({
          stageId: "complete",
          action: "objective_completed",
          outcome: "success",
          reason: "Target value reached via inbound signals.",
          policyGated: false,
          capability: null,
        }),
      ],
    )
    return completed
  }

  if (
    objective.runtime?.running &&
    (signal.type === "reply" ||
      (buildObjectiveSignalSnapshot(recentSignals).opens > 5 &&
        buildObjectiveSignalSnapshot(recentSignals).sequenceOpenRate < 0.15))
  ) {
    objective = await runGrowthObjectiveAdaptiveLoop(admin, organizationId, objectiveId, input)
  }

  return autoContinueGrowthObjectiveRuntime(admin, organizationId, objectiveId, input)
}

export async function autoContinueGrowthObjectiveRuntime(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  input?: GrowthObjectiveRuntimeTickInput,
): Promise<GrowthObjective> {
  const objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective?.runtime?.running || objective.status !== "active") return objective!

  const stageId = objective.runtime.currentStageId
  const linearStages = [
    "discover",
    "research",
    "enrich",
    "buying_committee",
    "generate_assets",
    "launch",
  ] as const

  if ((linearStages as readonly string[]).includes(stageId)) {
    return tickGrowthObjectiveRuntime(admin, organizationId, objectiveId, input)
  }

  if (stageId === "book" && isObjectiveComplete(objective)) {
    return tickGrowthObjectiveRuntime(admin, organizationId, objectiveId, input)
  }

  return objective
}

export async function retryGrowthObjectiveStage(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  input?: GrowthObjectiveRuntimeTickInput,
): Promise<GrowthObjective> {
  let objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective?.runtime?.running) return objective!

  const stageId = objective.runtime.currentStageId
  const stageRecord = objective.runtime.stageStates[stageId]
  if (stageRecord.state !== "blocked") return objective

  const stageStates = {
    ...objective.runtime.stageStates,
    [stageId]: transitionObjectiveRuntimeStage(stageRecord, "running", { blockers: [] }),
  }

  objective = await persistObjectiveRuntime(
    admin,
    organizationId,
    {
      ...objective,
      runtime: { ...objective.runtime, stageStates },
    },
    [
      historyEntry({
        stageId,
        action: "retry_stage",
        outcome: "success",
        reason: null,
        policyGated: false,
        capability: null,
      }),
    ],
  )

  return tickGrowthObjectiveRuntime(admin, organizationId, objectiveId, input)
}

export async function runGrowthObjectiveAdaptiveLoop(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  input?: GrowthObjectiveRuntimeTickInput,
): Promise<GrowthObjective> {
  let objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective?.runtime?.running) return objective!
  if (objective.runtime.stageStates.adapt?.state === "completed") {
    return objective
  }

  if (objective.runtime.currentStageId !== "adapt") {
    objective = await persistObjectiveRuntime(
      admin,
      organizationId,
      {
        ...objective,
        runtime: { ...objective.runtime, currentStageId: "adapt" },
      },
      [],
    )
  }

  return tickGrowthObjectiveRuntime(admin, organizationId, objectiveId, input)
}

export const GrowthObjectiveRuntimeService = {
  startGrowthObjectiveRuntime,
  tickGrowthObjectiveRuntime,
  pauseGrowthObjectiveRuntime,
  resumeGrowthObjectiveRuntime,
  stopGrowthObjectiveRuntime,
  ingestGrowthObjectiveSignal,
  runGrowthObjectiveAdaptiveLoop,
  autoContinueGrowthObjectiveRuntime,
  retryGrowthObjectiveStage,
} as const
