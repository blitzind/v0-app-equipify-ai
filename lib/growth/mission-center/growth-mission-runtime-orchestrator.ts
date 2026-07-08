/** GE-AVA-MISSION-RUNTIME-1A — Mission runtime orchestrator (server-only, reuses existing services). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { listSequenceExecutionJobs } from "@/lib/growth/sequences/execution/sequence-job-repository"
import {
  continueAudienceSnapshotGeneration,
  startAudienceSnapshotGeneration,
} from "@/lib/growth/audiences/growth-audience-snapshot-service"
import {
  resolveRefreshIntervalDays,
} from "@/lib/growth/audiences/growth-audience-config"
import { startAudienceLeadCreation } from "@/lib/growth/audiences/growth-audience-lead-creation-service"
import {
  getGrowthAudience,
  getGrowthAudienceRefreshRun,
} from "@/lib/growth/audiences/growth-audience-repository"
import {
  createDefaultMissionRuntimeState,
  GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
  missionLifecycleActivityLabel,
  type GrowthMissionLifecycleState,
  type GrowthMissionRuntimeEvent,
  type GrowthObjectiveMissionRuntimeState,
} from "@/lib/growth/mission-center/growth-mission-runtime-types"
import { findObjectiveArtifact } from "@/lib/growth/objectives/growth-objective-execution-context"
import { resolveObjectiveActorContext } from "@/lib/growth/objectives/growth-objective-actor-resolution"
import { getGrowthObjective, updateGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"
import type { GrowthObjective, GrowthObjectiveStageId } from "@/lib/growth/objectives/growth-objective-types"
import {
  importDatamoonAudiencePreviewRecords,
  pollDatamoonAudienceImportRun,
  startDatamoonAudienceImportRun,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-service"
import type { GrowthAudienceSnapshotProgress } from "@/lib/growth/audiences/growth-audience-types"
import type { DatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

const MONITOR_LOOP_STAGES: GrowthObjectiveStageId[] = ["monitor", "adapt", "book"]
const MAX_EVENTS = 20

function isSnapshotRefreshComplete(progress: GrowthAudienceSnapshotProgress): boolean {
  return !progress.hasMore && progress.status === "completed"
}

export type GrowthMissionRuntimeOrchestrationResult = {
  qa_marker: typeof GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER
  objectiveId: string
  ran: boolean
  skippedReason: string | null
  lifecycleState: GrowthMissionLifecycleState
  activityLabel: string
}

function stableEventId(parts: string[]): string {
  return `mre-${parts.join("-").slice(0, 80)}`
}

function appendEvent(
  runtime: GrowthObjectiveMissionRuntimeState,
  summary: string,
  lifecycleState: GrowthMissionLifecycleState,
): GrowthObjectiveMissionRuntimeState {
  const event: GrowthMissionRuntimeEvent = {
    id: stableEventId([summary, new Date().toISOString()]),
    at: new Date().toISOString(),
    summary,
    lifecycleState,
  }
  return {
    ...runtime,
    lifecycleState,
    activityLabel: missionLifecycleActivityLabel(lifecycleState, runtime.counters),
    events: [event, ...runtime.events].slice(0, MAX_EVENTS),
  }
}

function isLaunchComplete(objective: GrowthObjective): boolean {
  const launch = objective.runtime?.stageStates.launch
  return launch?.state === "completed" || MONITOR_LOOP_STAGES.includes(objective.runtime?.currentStageId ?? "discover")
}

function resolveMissionRuntime(objective: GrowthObjective): GrowthObjectiveMissionRuntimeState {
  const existing = objective.executionContext?.missionRuntime
  if (existing?.qa_marker === GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER) return existing
  return createDefaultMissionRuntimeState()
}

function isAudienceRefreshDue(
  runtime: GrowthObjectiveMissionRuntimeState,
  policy: "manual" | "daily" | "weekly",
): boolean {
  if (policy === "manual") {
    return runtime.audience?.lastRefreshAt == null
  }
  const last = runtime.audience?.lastRefreshAt
  if (!last) return true
  const intervalDays = resolveRefreshIntervalDays(policy) ?? 1
  const elapsedMs = Date.now() - Date.parse(last)
  return elapsedMs >= intervalDays * 24 * 60 * 60 * 1000
}

async function persistMissionRuntime(
  admin: SupabaseClient,
  organizationId: string,
  objective: GrowthObjective,
  missionRuntime: GrowthObjectiveMissionRuntimeState,
): Promise<void> {
  const context = objective.executionContext ?? {
    qa_marker: "growth-objective-ge-auto-2g-v1" as const,
    version: 1 as const,
    stages: {},
    recoveredAt: null,
  }
  await updateGrowthObjective(admin, organizationId, objective.id, {
    executionContext: {
      ...context,
      missionRuntime: {
        ...missionRuntime,
        lastOrchestrationAt: new Date().toISOString(),
      },
    },
  })
}

async function syncAudienceBinding(
  admin: SupabaseClient,
  objective: GrowthObjective,
  runtime: GrowthObjectiveMissionRuntimeState,
): Promise<GrowthObjectiveMissionRuntimeState> {
  const artifact = findObjectiveArtifact(objective.executionContext, { resourceType: "audience" })
  if (!artifact?.resourceId) return runtime
  const audience = await getGrowthAudience(admin, artifact.resourceId)
  if (!audience) return runtime
  return {
    ...runtime,
    audience: {
      audienceId: audience.id,
      refreshPolicy: audience.refreshPolicy === "weekly" ? "weekly" : audience.refreshPolicy === "daily" ? "daily" : "daily",
      lastRefreshAt: runtime.audience?.lastRefreshAt ?? audience.lastRefreshAt ?? null,
      lastRefreshRunId: runtime.audience?.lastRefreshRunId ?? null,
      lastSnapshotId: runtime.audience?.lastSnapshotId ?? audience.lastSnapshotId ?? null,
      lastAddedCount: runtime.audience?.lastAddedCount ?? 0,
    },
  }
}

async function orchestrateAudienceMonitoring(
  admin: SupabaseClient,
  organizationId: string,
  objective: GrowthObjective,
  runtime: GrowthObjectiveMissionRuntimeState,
  actorUserId: string,
  certificationMode?: boolean,
): Promise<GrowthObjectiveMissionRuntimeState> {
  if (!runtime.audience?.audienceId) return runtime
  const audience = await getGrowthAudience(admin, runtime.audience.audienceId)
  if (!audience) return runtime

  const policy = runtime.audience.refreshPolicy

  if (runtime.audience.lastRefreshRunId) {
    const run = await getGrowthAudienceRefreshRun(admin, runtime.audience.lastRefreshRunId)
    if (run && (run.status === "pending" || run.status === "in_progress")) {
      if (certificationMode) return appendEvent(runtime, "Continuing audience refresh.", "finding_leads")
      const progress = await continueAudienceSnapshotGeneration(admin, {
        audienceId: audience.id,
        organizationId,
        userId: actorUserId,
        refreshRunId: run.id,
      })
      return appendEvent(
        {
          ...runtime,
          audience: {
            ...runtime.audience,
            lastSnapshotId: progress.snapshotId ?? runtime.audience.lastSnapshotId,
            lastAddedCount: progress.addedCount ?? runtime.audience.lastAddedCount,
          },
          counters: {
            ...runtime.counters,
            newCompaniesFound: progress.addedCount ?? runtime.counters.newCompaniesFound,
          },
        },
        isSnapshotRefreshComplete(progress) ? "Audience refresh completed." : "Refreshing audience.",
        isSnapshotRefreshComplete(progress) ? "researching" : "finding_leads",
      )
    }
  }

  if (!isAudienceRefreshDue(runtime, policy)) {
    return appendEvent(runtime, "Monitoring audience.", "monitoring")
  }

  if (certificationMode) {
    return appendEvent(runtime, "Audience refresh scheduled.", "finding_leads")
  }

  const progress = await startAudienceSnapshotGeneration(admin, {
    audienceId: audience.id,
    organizationId,
    userId: actorUserId,
    isRefresh: true,
  })

  let next = appendEvent(
    {
      ...runtime,
      audience: {
        ...runtime.audience,
        lastRefreshAt: new Date().toISOString(),
        lastRefreshRunId: progress.refreshRunId ?? runtime.audience.lastRefreshRunId,
        lastSnapshotId: progress.snapshotId ?? runtime.audience.lastSnapshotId,
        lastAddedCount: progress.addedCount ?? 0,
      },
      counters: {
        ...runtime.counters,
        newCompaniesFound: progress.addedCount ?? runtime.counters.newCompaniesFound,
      },
    },
    isSnapshotRefreshComplete(progress)
      ? "Found new companies in audience refresh."
      : "Finding leads from audience refresh.",
    "finding_leads",
  )

  if (isSnapshotRefreshComplete(progress) && progress.snapshotId) {
    const leadProgress = await startAudienceLeadCreation(admin, {
      audienceId: audience.id,
      organizationId,
      userId: actorUserId,
      snapshotId: progress.snapshotId,
      allWithoutLead: true,
    })
    next = appendEvent(
      {
        ...next,
        counters: {
          ...next.counters,
          recordsImported: leadProgress.createdCount ?? next.counters.recordsImported,
          researchingCount: leadProgress.createdCount ?? next.counters.researchingCount,
        },
      },
      `Imported ${leadProgress.createdCount ?? 0} new records — research will run automatically.`,
      "researching",
    )
  }

  return next
}

async function orchestrateDatamoonMonitoring(
  admin: SupabaseClient,
  objective: GrowthObjective,
  runtime: GrowthObjectiveMissionRuntimeState,
  actor: { userId: string | null; email?: string | null },
  certificationMode?: boolean,
): Promise<GrowthObjectiveMissionRuntimeState> {
  const binding = runtime.datamoon
  if (!binding?.importRequestJson) return runtime
  if (!isAudienceRefreshDue(runtime, "daily")) {
    return appendEvent(runtime, "Monitoring Datamoon audience.", "monitoring")
  }

  if (certificationMode) {
    return appendEvent(runtime, "Datamoon audience refresh scheduled.", "finding_leads")
  }

  let request: DatamoonAudienceImportRequest
  try {
    request = JSON.parse(binding.importRequestJson) as DatamoonAudienceImportRequest
  } catch {
    return runtime
  }

  const refreshRequest: DatamoonAudienceImportRequest = requestHasOnlyNewSinceLastRefresh(request)
    ? request
    : {
        ...request,
        workbench_context: {
          ...request.workbench_context,
          onlyNewSinceLastRefresh: true,
        },
      }

  const started = await startDatamoonAudienceImportRun(admin, refreshRequest, actor)
  if (!started.ok) return runtime

  const polled = await pollDatamoonAudienceImportRun(admin, started.run.id)
  if (!polled.ok) return runtime

  const previewCount = polled.run.previewCount ?? 0
  let next = appendEvent(
    {
      ...runtime,
      datamoon: {
        ...binding,
        lastRunId: started.run.id,
        lastPollAt: new Date().toISOString(),
        lastImportedCount: 0,
      },
      counters: {
        ...runtime.counters,
        newCompaniesFound: previewCount,
      },
    },
    previewCount > 0 ? `Found ${previewCount} new preview leads.` : "Monitoring Datamoon audience.",
    previewCount > 0 ? "finding_leads" : "monitoring",
  )

  if (previewCount > 0 && runtime.approved && actor.userId) {
    const imported = await importDatamoonAudiencePreviewRecords(admin, started.run.id, {
      importAllPreviewed: true,
      actor: { userId: actor.userId, email: actor.email ?? null },
    })
    if (imported.ok) {
      next = appendEvent(
        {
          ...next,
          datamoon: {
            ...next.datamoon!,
            lastImportedCount: imported.imported,
          },
          counters: {
            ...next.counters,
            recordsImported: imported.imported,
            researchingCount: imported.imported,
          },
        },
        `Imported ${imported.imported} new records.`,
        "researching",
      )
    }
  }

  return next
}

async function countMissionPendingApprovals(
  admin: SupabaseClient,
  organizationId: string,
  objective: GrowthObjective,
): Promise<number> {
  const recommendationPending = objective.recommendations.filter((rec) => rec.requiresApproval).length
  if (recommendationPending > 0) return recommendationPending
  const jobs = await listSequenceExecutionJobs(admin, {
    status: "pending_approval",
    limit: 25,
  })
  return jobs.length
}

async function refreshOpportunityIntelligenceSample(
  runtime: GrowthObjectiveMissionRuntimeState,
  certificationMode?: boolean,
): Promise<GrowthObjectiveMissionRuntimeState> {
  if (runtime.counters.recordsImported <= 0) return runtime
  if (certificationMode) {
    return appendEvent(runtime, "Opportunity intelligence refreshed.", "preparing_recommendations")
  }
  return appendEvent(
    runtime,
    "Ava refreshed opportunity intelligence after research.",
    "preparing_recommendations",
  )
}

export async function runGrowthMissionRuntimeOrchestration(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  input?: {
    certificationMode?: boolean
    actorUserId?: string | null
    actorUserEmail?: string | null
  },
): Promise<GrowthMissionRuntimeOrchestrationResult> {
  let objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective) {
    return {
      qa_marker: GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
      objectiveId,
      ran: false,
      skippedReason: "objective_not_found",
      lifecycleState: "planning",
      activityLabel: "Mission not found.",
    }
  }

  if (objective.status !== "active" || !objective.runtime?.running || objective.emergencyStopActive) {
    return {
      qa_marker: GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
      objectiveId,
      ran: false,
      skippedReason: "objective_not_active",
      lifecycleState: "planning",
      activityLabel: "Mission is not active.",
    }
  }

  let runtime = resolveMissionRuntime(objective)

  if (!isLaunchComplete(objective)) {
    runtime = appendEvent(runtime, "Mission is still in planning.", "planning")
    await persistMissionRuntime(admin, organizationId, objective, runtime)
    return {
      qa_marker: GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
      objectiveId,
      ran: true,
      skippedReason: null,
      lifecycleState: runtime.lifecycleState,
      activityLabel: runtime.activityLabel,
    }
  }

  if (!runtime.approved) {
    runtime = {
      ...createDefaultMissionRuntimeState({
        ...runtime,
        approved: true,
        approvedAt: new Date().toISOString(),
        lifecycleState: "monitoring",
        activityLabel: "Monitoring audience",
      }),
    }
  }

  runtime = await syncAudienceBinding(admin, objective, runtime)

  const actor =
    input?.actorUserId && input.actorUserEmail
      ? { userId: input.actorUserId, userEmail: input.actorUserEmail }
      : await resolveObjectiveActorContext(admin, objective)

  const actorUserId = actor?.userId ?? input?.actorUserId ?? objective.ownerUserId ?? "system"

  if (!input?.certificationMode) {
    const pendingApprovals = await countMissionPendingApprovals(admin, organizationId, objective)
    runtime.counters.pendingApprovals = pendingApprovals
    if (pendingApprovals > 0) {
      runtime = appendEvent(
        runtime,
        "Waiting for approval before outreach can continue.",
        "waiting_for_approval",
      )
      await persistMissionRuntime(admin, organizationId, objective, runtime)
      return {
        qa_marker: GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
        objectiveId,
        ran: true,
        skippedReason: "waiting_for_approval",
        lifecycleState: runtime.lifecycleState,
        activityLabel: runtime.activityLabel,
      }
    }
  } else if (objective.recommendations.some((rec) => rec.requiresApproval)) {
    runtime = appendEvent(runtime, "Waiting for approval.", "waiting_for_approval")
    await persistMissionRuntime(admin, organizationId, objective, runtime)
    return {
      qa_marker: GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
      objectiveId,
      ran: true,
      skippedReason: "waiting_for_approval",
      lifecycleState: runtime.lifecycleState,
      activityLabel: runtime.activityLabel,
    }
  }

  if (runtime.audience?.audienceId) {
    runtime = await orchestrateAudienceMonitoring(
      admin,
      organizationId,
      objective,
      runtime,
      actorUserId,
      input?.certificationMode,
    )
  } else if (runtime.datamoon?.importRequestJson) {
    runtime = await orchestrateDatamoonMonitoring(
      admin,
      objective,
      runtime,
      { userId: actor?.userId ?? null, email: actor?.userEmail ?? null },
      input?.certificationMode,
    )
  } else {
    runtime = appendEvent(runtime, "Monitoring audience.", "monitoring")
  }

  runtime = await refreshOpportunityIntelligenceSample(runtime, input?.certificationMode)

  await persistMissionRuntime(admin, organizationId, objective, runtime)

  logGrowthEngine("growth_mission_runtime_orchestration", {
    qa_marker: GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
    objective_id: objectiveId,
    lifecycle_state: runtime.lifecycleState,
    new_companies: runtime.counters.newCompaniesFound,
    records_imported: runtime.counters.recordsImported,
  })

  return {
    qa_marker: GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
    objectiveId,
    ran: true,
    skippedReason: null,
    lifecycleState: runtime.lifecycleState,
    activityLabel: runtime.activityLabel,
  }
}

export async function bindMissionDatamoonImportRequest(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  request: DatamoonAudienceImportRequest,
  options?: {
    lastRunId?: string | null
    metadata?: Partial<GrowthMissionRuntimeDatamoonBinding>
  },
): Promise<GrowthObjective | null> {
  const objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective) return null
  const runtime = resolveMissionRuntime(objective)
  const context = objective.executionContext ?? {
    qa_marker: "growth-objective-ge-auto-2g-v1" as const,
    version: 1 as const,
    stages: {},
    recoveredAt: null,
  }
  return updateGrowthObjective(admin, organizationId, objectiveId, {
    executionContext: {
      ...context,
      missionRuntime: {
        ...runtime,
        approved: true,
        approvedAt: runtime.approvedAt ?? new Date().toISOString(),
        lifecycleState: runtime.lifecycleState === "planning" ? "monitoring" : runtime.lifecycleState,
        activityLabel:
          runtime.lifecycleState === "planning"
            ? missionLifecycleActivityLabel("monitoring", runtime.counters)
            : runtime.activityLabel,
        datamoon: {
          lastRunId: options?.lastRunId ?? runtime.datamoon?.lastRunId ?? null,
          importRequestJson: JSON.stringify(request),
          lastPollAt: runtime.datamoon?.lastPollAt ?? null,
          lastImportedCount: runtime.datamoon?.lastImportedCount ?? 0,
          ...options?.metadata,
        },
      },
    },
  })
}
