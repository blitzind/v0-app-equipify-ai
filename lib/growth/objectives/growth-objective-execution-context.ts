/** GE-AUTO-2F — Execution context helpers & stage completion rules (client-safe). */

import {
  GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER,
  type GrowthObjective,
  type GrowthObjectiveExecutionContext,
  type GrowthObjectiveMaterializedArtifact,
  type GrowthObjectiveStageId,
} from "@/lib/growth/objectives/growth-objective-types"

export const OBJECTIVE_MATERIALIZATION_STAGE_IDS = [
  "discover",
  "research",
  "enrich",
  "buying_committee",
  "generate_assets",
  "launch",
] as const satisfies readonly GrowthObjectiveStageId[]

export function createEmptyObjectiveExecutionContext(): GrowthObjectiveExecutionContext {
  return {
    qa_marker: GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER,
    version: 1,
    stages: {},
    recoveredAt: null,
  }
}

export function normalizeObjectiveExecutionContext(
  value: unknown,
): GrowthObjectiveExecutionContext {
  if (!value || typeof value !== "object") {
    return createEmptyObjectiveExecutionContext()
  }
  const raw = value as GrowthObjectiveExecutionContext
  return {
    qa_marker: GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER,
    version: 1,
    stages: raw.stages ?? {},
    recoveredAt: raw.recoveredAt ?? null,
    missionRuntime: raw.missionRuntime ?? null,
  }
}

export function listObjectiveArtifacts(
  context: GrowthObjectiveExecutionContext | null | undefined,
  stageId?: GrowthObjectiveStageId,
): GrowthObjectiveMaterializedArtifact[] {
  if (!context) return []
  if (stageId) {
    return context.stages[stageId]?.artifacts ?? []
  }
  return Object.values(context.stages).flatMap((stage) => stage?.artifacts ?? [])
}

export function countObjectiveArtifactsByType(
  context: GrowthObjectiveExecutionContext | null | undefined,
  resourceType: GrowthObjectiveMaterializedArtifact["resourceType"],
): number {
  return listObjectiveArtifacts(context).filter((artifact) => artifact.resourceType === resourceType).length
}

export function findObjectiveArtifact(
  context: GrowthObjectiveExecutionContext | null | undefined,
  input: { resourceType: GrowthObjectiveMaterializedArtifact["resourceType"]; resourceKey?: string },
): GrowthObjectiveMaterializedArtifact | null {
  return (
    listObjectiveArtifacts(context).find(
      (artifact) =>
        artifact.resourceType === input.resourceType &&
        (input.resourceKey == null || artifact.resourceKey === input.resourceKey),
    ) ?? null
  )
}

export function mergeObjectiveStageArtifacts(
  context: GrowthObjectiveExecutionContext,
  stageId: GrowthObjectiveStageId,
  artifacts: GrowthObjectiveMaterializedArtifact[],
  input?: { blockers?: string[]; completed?: boolean },
): GrowthObjectiveExecutionContext {
  const existing = context.stages[stageId]?.artifacts ?? []
  const byKey = new Map(existing.map((artifact) => [`${artifact.resourceType}:${artifact.resourceKey}`, artifact]))
  for (const artifact of artifacts) {
    byKey.set(`${artifact.resourceType}:${artifact.resourceKey}`, artifact)
  }
  const now = new Date().toISOString()
  return {
    ...context,
    stages: {
      ...context.stages,
      [stageId]: {
        materializedAt: context.stages[stageId]?.materializedAt ?? now,
        completedAt: input?.completed ? now : (context.stages[stageId]?.completedAt ?? null),
        artifacts: [...byKey.values()],
        blockers: input?.blockers ?? context.stages[stageId]?.blockers ?? [],
      },
    },
  }
}

function artifactsCompleted(
  artifacts: GrowthObjectiveMaterializedArtifact[],
  minCount = 1,
): boolean {
  const completed = artifacts.filter((artifact) => artifact.status === "completed")
  return completed.length >= minCount
}

export function evaluateGrowthObjectiveStageCompletion(
  stageId: GrowthObjectiveStageId,
  objective: GrowthObjective,
): { complete: boolean; reason: string | null; progress: number } {
  const context = objective.executionContext
  const stageArtifacts = listObjectiveArtifacts(context, stageId)

  switch (stageId) {
    case "discover": {
      const hasSearch = findObjectiveArtifact(context, { resourceType: "saved_search" })
      const audiences = listObjectiveArtifacts(context).filter((a) => a.resourceType === "audience")
      const audienceReady = audiences.some((a) => a.status === "completed")
      const complete = Boolean(hasSearch?.status === "completed" && audienceReady)
      return {
        complete,
        reason: complete
          ? null
          : !hasSearch
            ? "Awaiting saved search creation."
            : "Awaiting audience population.",
        progress: complete ? 100 : hasSearch ? 60 : 20,
      }
    }
    case "research": {
      const runs = stageArtifacts.filter((a) => a.resourceType === "research_run")
      const complete = artifactsCompleted(runs, 1)
      return {
        complete,
        reason: complete ? null : "Awaiting research job completion.",
        progress: complete ? 100 : runs.length > 0 ? 70 : 30,
      }
    }
    case "enrich": {
      const runs = stageArtifacts.filter((a) => a.resourceType === "enrichment_run")
      const complete = artifactsCompleted(runs, 1)
      return {
        complete,
        reason: complete ? null : "Awaiting enrichment job completion.",
        progress: complete ? 100 : runs.length > 0 ? 70 : 30,
      }
    }
    case "buying_committee": {
      const intel = stageArtifacts.find((a) => a.resourceType === "opportunity")
      const complete = intel?.status === "completed"
      return {
        complete: Boolean(complete),
        reason: complete ? null : "Awaiting buying committee intelligence.",
        progress: complete ? 100 : 50,
      }
    }
    case "generate_assets": {
      const required = objective.plan?.assetsRequired ?? []
      if (required.length === 0) {
        return { complete: true, reason: null, progress: 100 }
      }
      const typeMap: Record<string, GrowthObjectiveMaterializedArtifact["resourceType"]> = {
        page: "landing_page",
        video: "video_page",
        demo_assistant: "booking_page",
        sequence: "sequence",
        template: "landing_page",
      }
      const missing = required.filter((asset) => {
        const resourceType = typeMap[asset.type] ?? "landing_page"
        const key = asset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        const match = findObjectiveArtifact(context, { resourceType, resourceKey: key })
        return match?.status !== "completed"
      })
      const complete = missing.length === 0
      return {
        complete,
        reason: complete ? null : `Awaiting assets: ${missing.map((a) => a.name).join(", ")}`,
        progress: complete ? 100 : Math.round(((required.length - missing.length) / required.length) * 100),
      }
    }
    case "launch": {
      const campaign = findObjectiveArtifact(context, { resourceType: "campaign", resourceKey: "primary-launch" })
        ?? listObjectiveArtifacts(context, "launch").find((a) => a.resourceType === "campaign")
      const launchRunId =
        typeof campaign?.metadata?.launchRunId === "string"
          ? campaign.metadata.launchRunId
          : campaign?.resourceId
      const enrollmentRunId =
        typeof campaign?.metadata?.enrollmentRunId === "string" ? campaign.metadata.enrollmentRunId : null
      const enrolledCount = Number(campaign?.metadata?.enrolledCount ?? 0)
      const sequenceEnrollment = listObjectiveArtifacts(context, "launch").find(
        (a) => a.resourceType === "sequence" && a.status === "completed",
      )
      const complete =
        Boolean(launchRunId) &&
        campaign?.status === "completed" &&
        Boolean(enrollmentRunId) &&
        enrolledCount > 0 &&
        Boolean(sequenceEnrollment)
      return {
        complete,
        reason: complete ? null : "Awaiting launch run, campaign completion, and enrollments.",
        progress: complete ? 100 : campaign ? (enrolledCount > 0 ? 85 : 60) : 30,
      }
    }
    case "book":
      return {
        complete: objective.currentValue >= objective.targetValue,
        reason:
          objective.currentValue >= objective.targetValue
            ? null
            : `Awaiting bookings (${objective.currentValue}/${objective.targetValue}).`,
        progress: Math.min(
          100,
          Math.round((objective.currentValue / Math.max(objective.targetValue, 1)) * 100),
        ),
      }
    case "complete":
      return {
        complete: objective.currentValue >= objective.targetValue,
        reason: null,
        progress: objective.currentValue >= objective.targetValue ? 100 : 0,
      }
    default:
      return { complete: true, reason: null, progress: 100 }
  }
}

export function summarizeObjectiveExecutionContext(context: GrowthObjectiveExecutionContext | null | undefined): {
  searchesCreated: number
  audiencesCreated: number
  pagesCreated: number
  videosGenerated: number
  sequencesCreated: number
  launchesCreated: number
  campaignsRunning: number
  bookingPagesCreated: number
  launchRuns: number
  activeCampaigns: number
  enrollments: number
} {
  const artifacts = listObjectiveArtifacts(context)
  const launchArtifacts = artifacts.filter((a) => a.resourceType === "campaign")
  return {
    searchesCreated: artifacts.filter((a) => a.resourceType === "saved_search").length,
    audiencesCreated: artifacts.filter((a) => a.resourceType === "audience").length,
    pagesCreated: artifacts.filter((a) => a.resourceType === "landing_page").length,
    videosGenerated: artifacts.filter((a) => a.resourceType === "video_page").length,
    sequencesCreated: artifacts.filter((a) => a.resourceType === "sequence").length,
    launchesCreated: launchArtifacts.length,
    campaignsRunning: launchArtifacts.filter(
      (a) => a.status === "running" || a.status === "completed",
    ).length,
    bookingPagesCreated: artifacts.filter((a) => a.resourceType === "booking_page").length,
    launchRuns: launchArtifacts.filter((a) => a.metadata?.launchRunId || a.resourceKey === "primary-launch").length,
    activeCampaigns: launchArtifacts.filter((a) => a.status === "running").length,
    enrollments: launchArtifacts.reduce(
      (sum, entry) => sum + Number(entry.metadata?.enrolledCount ?? 0),
      0,
    ),
  }
}

export function summarizeObjectiveMaterializationHealth(
  context: GrowthObjectiveExecutionContext | null | undefined,
): {
  complete: number
  partial: number
  failed: number
  retrying: number
} {
  const stages = context?.stages ?? {}
  let complete = 0
  let partial = 0
  let failed = 0
  let retrying = 0
  for (const stage of Object.values(stages)) {
    if (!stage) continue
    if (stage.completedAt) {
      complete += 1
      continue
    }
    if ((stage.blockers?.length ?? 0) > 0) {
      retrying += 1
      continue
    }
    const artifacts = stage.artifacts ?? []
    if (artifacts.some((entry) => entry.status === "failed")) {
      failed += 1
    } else if (artifacts.some((entry) => entry.status === "running")) {
      partial += 1
    }
  }
  return { complete, partial, failed, retrying }
}
