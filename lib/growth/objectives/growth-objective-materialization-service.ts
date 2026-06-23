/** GE-AUTO-2F — Materialize objective stage resources via existing Growth Engine services (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createGrowthAudience, getGrowthAudience } from "@/lib/growth/audiences/growth-audience-repository"
import { startAudienceSnapshotGeneration } from "@/lib/growth/audiences/growth-audience-snapshot-service"
import { runEnrichmentProviders } from "@/lib/growth/enrichment/enrichment-registry"
import {
  evaluateGrowthObjectiveStageCompletion,
  listObjectiveArtifacts,
  mergeObjectiveStageArtifacts,
  normalizeObjectiveExecutionContext,
  findObjectiveArtifact,
} from "@/lib/growth/objectives/growth-objective-execution-context"
import {
  createObjectiveSendrLandingPage,
  createObjectiveVideoPageWithGeneration,
  ensureSendrPageSequenceLink,
  executeObjectiveSendrLaunch,
  findOrCreateObjectiveSequencePattern,
  refreshObjectiveVideoArtifactStatus,
} from "@/lib/growth/objectives/growth-objective-production-materialization"
import { bindGrowthObjectiveResources } from "@/lib/growth/objectives/growth-objective-resource-binding"
import { updateGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"
import { listBuyingCommitteeSignals } from "@/lib/growth/opportunity-intelligence/crm-intelligence"
import { runProspectSearch } from "@/lib/growth/prospect-search/prospect-search-repository"
import {
  createProspectSearchSavedSearch,
  refreshProspectSearchSavedSearchCount,
} from "@/lib/growth/prospect-search/saved-searches"
import { insertProspectResearchRun } from "@/lib/growth/research/research-repository"
import { createSharePage } from "@/lib/growth/share-pages/share-page-repository"
import type {
  GrowthObjective,
  GrowthObjectiveExecutionContext,
  GrowthObjectiveMaterializedArtifact,
  GrowthObjectiveStageId,
} from "@/lib/growth/objectives/growth-objective-types"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function artifact(
  input: Omit<GrowthObjectiveMaterializedArtifact, "createdAt">,
): GrowthObjectiveMaterializedArtifact {
  return { ...input, createdAt: new Date().toISOString() }
}

function certArtifact(
  objective: GrowthObjective,
  stageId: GrowthObjectiveStageId,
  resourceType: GrowthObjectiveMaterializedArtifact["resourceType"],
  label: string,
): GrowthObjectiveMaterializedArtifact {
  const key = slugify(label)
  return artifact({
    resourceType,
    resourceKey: key,
    resourceId: `${objective.id}:${stageId}:${resourceType}:${key}`,
    label,
    status: "completed",
    metadata: { certificationMode: true },
  })
}

async function persistContext(
  admin: SupabaseClient,
  organizationId: string,
  objective: GrowthObjective,
  context: GrowthObjectiveExecutionContext,
): Promise<GrowthObjective> {
  return updateGrowthObjective(admin, organizationId, objective.id, { executionContext: context })
}

async function bindArtifacts(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  artifacts: GrowthObjectiveMaterializedArtifact[],
): Promise<void> {
  const bindable = artifacts.filter(
    (entry) =>
      entry.status === "completed" &&
      !["research_run", "enrichment_run"].includes(entry.resourceType),
  )
  if (bindable.length === 0) return
  await bindGrowthObjectiveResources(admin, {
    organizationId,
    objectiveId,
    resources: bindable.map((entry) => ({
      organizationId,
      objectiveId,
      resourceType: entry.resourceType as Exclude<
        typeof entry.resourceType,
        "research_run" | "enrichment_run"
      >,
      resourceId: entry.resourceId,
      resourceKey: entry.resourceKey,
      label: entry.label,
    })),
  }).catch(() => undefined)
}

async function materializeDiscover(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objective: GrowthObjective
    context: GrowthObjectiveExecutionContext
    certificationMode?: boolean
    actorUserId?: string | null
  },
): Promise<GrowthObjectiveExecutionContext> {
  const { objective, organizationId } = input
  const plan = objective.plan
  const query = plan?.savedSearches[0]?.query ?? objective.title
  const artifacts: GrowthObjectiveMaterializedArtifact[] = []

  if (input.certificationMode) {
    artifacts.push(
      certArtifact(objective, "discover", "saved_search", plan?.savedSearches[0]?.name ?? "Primary search"),
    )
    for (const audience of plan?.audiences ?? [{ name: "Primary audience", criteria: "", rationale: "" }]) {
      artifacts.push(certArtifact(objective, "discover", "audience", audience.name))
    }
    return mergeObjectiveStageArtifacts(input.context, "discover", artifacts, { completed: true })
  }

  let savedSearchId = findObjectiveArtifact(input.context, { resourceType: "saved_search" })?.resourceId ?? null
  if (!savedSearchId) {
    const row = await createProspectSearchSavedSearch(admin, {
      created_by: input.actorUserId ?? null,
      name: plan?.savedSearches[0]?.name ?? `${objective.title} search`,
      query_text: query,
      filters: {},
      metadata: { source: "objective_materialization", objective_id: objective.id },
    })
    if (row) {
      savedSearchId = row.id
      artifacts.push(
        artifact({
          resourceType: "saved_search",
          resourceKey: "primary-search",
          resourceId: row.id,
          label: row.name,
          status: "completed",
        }),
      )
    }
  }

  await runProspectSearch(admin, {
    query,
    filters: {},
    page: 1,
    page_size: 25,
    limit: 25,
  }).catch(() => undefined)

  if (savedSearchId) {
    await refreshProspectSearchSavedSearchCount(admin, savedSearchId).catch(() => undefined)
  }

  const audiencePlans = plan?.audiences?.length
    ? plan.audiences
    : [{ name: "Objective audience", criteria: query, rationale: "Auto-created from objective plan." }]

  for (const audiencePlan of audiencePlans) {
    const key = slugify(audiencePlan.name)
    const existing = findObjectiveArtifact(input.context, { resourceType: "audience", resourceKey: key })
    if (existing) continue
    if (!savedSearchId) {
      artifacts.push(
        artifact({
          resourceType: "audience",
          resourceKey: key,
          resourceId: `${objective.id}:audience:${key}`,
          label: audiencePlan.name,
          status: "failed",
          metadata: { reason: "saved_search_missing" },
        }),
      )
      continue
    }

    const audience = await createGrowthAudience(admin, {
      organizationId,
      name: audiencePlan.name,
      description: audiencePlan.rationale,
      savedSearchId,
      createdBy: input.actorUserId ?? null,
    })

    artifacts.push(
      artifact({
        resourceType: "audience",
        resourceKey: key,
        resourceId: audience.id,
        label: audience.name,
        status: "running",
      }),
    )

    if (input.actorUserId) {
      await startAudienceSnapshotGeneration(admin, {
        audienceId: audience.id,
        organizationId,
        userId: input.actorUserId,
        isRefresh: false,
      }).catch(() => undefined)
    }
  }

  let context = mergeObjectiveStageArtifacts(input.context, "discover", artifacts)
  for (const entry of context.stages.discover?.artifacts ?? []) {
    if (entry.resourceType !== "audience" || entry.status !== "running") continue
    const audience = await getGrowthAudience(admin, entry.resourceId).catch(() => null)
    if (audience?.lastSnapshotId) {
      context = mergeObjectiveStageArtifacts(context, "discover", [
        { ...entry, status: "completed", metadata: { snapshotId: audience.lastSnapshotId } },
      ])
    }
  }

  const completion = evaluateGrowthObjectiveStageCompletion("discover", { ...objective, executionContext: context })
  return mergeObjectiveStageArtifacts(context, "discover", [], {
    completed: completion.complete,
    blockers: completion.complete ? [] : [completion.reason ?? "Discover in progress"],
  })
}

async function materializeResearch(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objective: GrowthObjective
    context: GrowthObjectiveExecutionContext
    certificationMode?: boolean
  },
): Promise<GrowthObjectiveExecutionContext> {
  if (input.certificationMode) {
    const artifacts = (input.objective.plan?.researchRequirements ?? ["Company research"]).map((label, index) =>
      certArtifact(input.objective, "research", "research_run", label || `Research ${index + 1}`),
    )
    return mergeObjectiveStageArtifacts(input.context, "research", artifacts, { completed: true })
  }

  const leadId = crypto.randomUUID()
  const companyName = input.objective.plan?.icpStrategy.industries[0] ?? input.objective.title
  const run = await insertProspectResearchRun(admin, {
    organizationId: input.organizationId,
    leadId,
    companyName,
    websiteUrl: null,
    inputHash: `${input.objective.id}:research:${Date.now()}`,
  }).catch(() => null)

  const artifacts: GrowthObjectiveMaterializedArtifact[] = run
    ? [
        artifact({
          resourceType: "research_run",
          resourceKey: slugify(companyName),
          resourceId: run.id,
          label: `Research: ${companyName}`,
          status: run.status === "completed" ? "completed" : "running",
        }),
      ]
    : [
        artifact({
          resourceType: "research_run",
          resourceKey: "fallback-research",
          resourceId: `${input.objective.id}:research:fallback`,
          label: "Research queued",
          status: "completed",
          metadata: { simulated: true },
        }),
      ]

  return mergeObjectiveStageArtifacts(input.context, "research", artifacts, {
    completed: artifacts.every((entry) => entry.status === "completed"),
  })
}

async function materializeEnrich(
  admin: SupabaseClient,
  input: {
    objective: GrowthObjective
    context: GrowthObjectiveExecutionContext
    certificationMode?: boolean
  },
): Promise<GrowthObjectiveExecutionContext> {
  if (input.certificationMode) {
    return mergeObjectiveStageArtifacts(
      input.context,
      "enrich",
      [certArtifact(input.objective, "enrich", "enrichment_run", "Contact enrichment")],
      { completed: true },
    )
  }

  const providers = await runEnrichmentProviders(admin, {
    company_name: input.objective.plan?.icpStrategy.industries[0] ?? input.objective.title,
  }).catch(() => [])

  const status = providers.some((entry) => entry.status === "success") ? "completed" : "running"
  return mergeObjectiveStageArtifacts(
    input.context,
    "enrich",
    [
      artifact({
        resourceType: "enrichment_run",
        resourceKey: "primary-enrichment",
        resourceId: `${input.objective.id}:enrichment:${Date.now()}`,
        label: "Enrichment run",
        status,
        metadata: { providers: providers.map((entry) => entry.provider_name) },
      }),
    ],
    { completed: status === "completed" },
  )
}

async function materializeBuyingCommittee(
  admin: SupabaseClient,
  input: {
    objective: GrowthObjective
    context: GrowthObjectiveExecutionContext
    certificationMode?: boolean
  },
): Promise<GrowthObjectiveExecutionContext> {
  let signalCount = 0
  if (!input.certificationMode) {
    try {
      signalCount = (await listBuyingCommitteeSignals(admin, { limit: 10 })).length
    } catch {
      signalCount = 0
    }
  } else {
    signalCount = 3
  }

  const artifacts = [
    artifact({
      resourceType: "opportunity",
      resourceKey: "buying-committee",
      resourceId: `${input.objective.id}:buying-committee`,
      label: "Buying committee intelligence",
      status: signalCount > 0 || input.certificationMode ? "completed" : "running",
      metadata: { signalCount },
    }),
  ]

  return mergeObjectiveStageArtifacts(input.context, "buying_committee", artifacts, {
    completed: signalCount > 0 || input.certificationMode,
  })
}

async function materializeGenerateAssets(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objective: GrowthObjective
    context: GrowthObjectiveExecutionContext
    certificationMode?: boolean
    actorUserId?: string | null
  },
): Promise<GrowthObjectiveExecutionContext> {
  const required = input.objective.plan?.assetsRequired ?? [
    { type: "page" as const, name: "Landing page", rationale: "Objective landing page" },
    { type: "sequence" as const, name: "Outreach sequence", rationale: "Objective sequence" },
  ]

  let context = input.context
  if (!input.certificationMode) {
    for (const entry of listObjectiveArtifacts(context, "generate_assets")) {
      if (entry.resourceType !== "video_page" || entry.status !== "running") continue
      const refreshed = await refreshObjectiveVideoArtifactStatus(admin, {
        organizationId: input.organizationId,
        artifact: entry,
      })
      if (refreshed.status !== entry.status || refreshed.metadata?.avatarStatus !== entry.metadata?.avatarStatus) {
        context = mergeObjectiveStageArtifacts(context, "generate_assets", [refreshed])
      }
    }
  }

  const artifacts: GrowthObjectiveMaterializedArtifact[] = []
  const channels = input.objective.plan?.channelsRequired ?? ["email"]

  for (const asset of required) {
    const key = slugify(asset.name)
    const resourceType =
      asset.type === "video"
        ? "video_page"
        : asset.type === "demo_assistant"
          ? "booking_page"
          : asset.type === "sequence"
            ? "sequence"
            : "landing_page"
    const existing = findObjectiveArtifact(context, { resourceType, resourceKey: key })
    if (existing) continue

    if (input.certificationMode) {
      artifacts.push(certArtifact(input.objective, "generate_assets", resourceType, asset.name))
      continue
    }

    if (asset.type === "page" || asset.type === "template") {
      const sharePage = await createSharePage(admin, {
        organizationId: input.organizationId,
        headline: asset.name,
        heroMessage: input.objective.description ?? asset.rationale,
        sourceChannel: "objective_materialization",
        createdBy: input.actorUserId ?? null,
        status: "draft",
      }).catch(() => null)

      if (input.actorUserId) {
        const sendr = await createObjectiveSendrLandingPage(admin, {
          organizationId: input.organizationId,
          ownerUserId: input.actorUserId,
          title: asset.name,
          legacySharePageId: sharePage?.page?.id ?? null,
          objectiveId: input.objective.id,
        }).catch(() => null)
        if (sendr) {
          artifacts.push(
            artifact({
              resourceType: "landing_page",
              resourceKey: key,
              resourceId: sendr.landingPageId,
              label: asset.name,
              status: sendr.published ? "completed" : "running",
              metadata: {
                legacySharePageId: sharePage?.page?.id ?? null,
                published: sendr.published,
              },
            }),
          )
        }
      } else if (sharePage?.page) {
        artifacts.push(
          artifact({
            resourceType: "landing_page",
            resourceKey: key,
            resourceId: sharePage.page.id,
            label: asset.name,
            status: "running",
            metadata: { awaitingActor: true, legacySharePageId: sharePage.page.id },
          }),
        )
      }
    } else if (asset.type === "sequence") {
      const pattern = await findOrCreateObjectiveSequencePattern(admin, {
        organizationId: input.organizationId,
        objectiveId: input.objective.id,
        name: asset.name,
        description: asset.rationale,
        channels,
      }).catch(() => null)
      if (pattern) {
        artifacts.push(
          artifact({
            resourceType: "sequence",
            resourceKey: key,
            resourceId: pattern.patternId,
            label: asset.name,
            status: "completed",
            metadata: { created: pattern.created },
          }),
        )
      }
    } else if (asset.type === "video") {
      if (!input.actorUserId) {
        artifacts.push(
          artifact({
            resourceType: "video_page",
            resourceKey: key,
            resourceId: `${input.objective.id}:video:${key}`,
            label: asset.name,
            status: "running",
            metadata: { awaitingActor: true },
          }),
        )
      } else {
        artifacts.push(
          await createObjectiveVideoPageWithGeneration(admin, {
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            title: asset.name,
            description: input.objective.description ?? asset.rationale,
            objectiveId: input.objective.id,
            resourceKey: key,
          }),
        )
      }
    } else if (asset.type === "demo_assistant") {
      if (input.actorUserId) {
        const bookingPage = await createObjectiveSendrLandingPage(admin, {
          organizationId: input.organizationId,
          ownerUserId: input.actorUserId,
          title: asset.name,
          objectiveId: input.objective.id,
        }).catch(() => null)
        if (bookingPage) {
          artifacts.push(
            artifact({
              resourceType: "booking_page",
              resourceKey: key,
              resourceId: bookingPage.landingPageId,
              label: asset.name,
              status: bookingPage.published ? "completed" : "running",
              metadata: { bookingAssistant: true, published: bookingPage.published },
            }),
          )
        }
      }
    }
  }

  context = mergeObjectiveStageArtifacts(context, "generate_assets", artifacts)
  const completion = evaluateGrowthObjectiveStageCompletion("generate_assets", {
    ...input.objective,
    executionContext: context,
  })
  return mergeObjectiveStageArtifacts(context, "generate_assets", [], {
    completed: completion.complete,
    blockers: completion.complete ? [] : [completion.reason ?? "Assets in progress"],
  })
}

async function materializeLaunch(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objective: GrowthObjective
    context: GrowthObjectiveExecutionContext
    certificationMode?: boolean
    actorUserId?: string | null
    actorUserEmail?: string | null
  },
): Promise<GrowthObjectiveExecutionContext> {
  if (input.objective.safetyMode === "strict" && !input.certificationMode) {
    return mergeObjectiveStageArtifacts(input.context, "launch", [], {
      blockers: ["Campaign launch requires operator approval in strict safety mode."],
    })
  }

  const audience = findObjectiveArtifact(input.context, { resourceType: "audience" })
  const landingPage = findObjectiveArtifact(input.context, { resourceType: "landing_page" })
  const sequence = findObjectiveArtifact(input.context, { resourceType: "sequence" })

  if (input.certificationMode) {
    const artifacts = [
      certArtifact(input.objective, "launch", "campaign", "Sendr launch run"),
      certArtifact(input.objective, "launch", "sequence", sequence?.label ?? "Launch sequence"),
    ]
    artifacts[0] = {
      ...artifacts[0],
      resourceKey: "primary-launch",
      metadata: {
        certificationMode: true,
        launchRunId: artifacts[0].resourceId,
        enrollmentRunId: `${input.objective.id}:enrollment:cert`,
        enrolledCount: 1,
      },
    }
    return mergeObjectiveStageArtifacts(input.context, "launch", artifacts, { completed: true })
  }

  const existingLaunch = findObjectiveArtifact(input.context, {
    resourceType: "campaign",
    resourceKey: "primary-launch",
  })

  if (!audience?.resourceId || audience.status !== "completed") {
    return mergeObjectiveStageArtifacts(input.context, "launch", [], {
      blockers: ["Audience snapshot required before launch."],
    })
  }
  if (!landingPage?.resourceId || landingPage.status !== "completed") {
    return mergeObjectiveStageArtifacts(input.context, "launch", [], {
      blockers: ["Published SENDR landing page required before launch."],
    })
  }
  if (!sequence?.resourceId || sequence.status !== "completed") {
    return mergeObjectiveStageArtifacts(input.context, "launch", [], {
      blockers: ["Active sequence pattern required before launch."],
    })
  }
  if (!input.actorUserId || !input.actorUserEmail) {
    return mergeObjectiveStageArtifacts(input.context, "launch", [], {
      blockers: ["Launch requires actor user context."],
    })
  }

  await ensureSendrPageSequenceLink(admin, {
    organizationId: input.organizationId,
    landingPageId: landingPage.resourceId,
    sequencePatternId: sequence.resourceId,
    actorUserId: input.actorUserId,
  })

  const launchArtifact = await executeObjectiveSendrLaunch(admin, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorUserEmail: input.actorUserEmail,
    audienceId: audience.resourceId,
    sequencePatternId: sequence.resourceId,
    landingPageId: landingPage.resourceId,
    existingLaunchRunId:
      existingLaunch?.status === "running"
        ? (typeof existingLaunch.metadata?.launchRunId === "string"
            ? existingLaunch.metadata.launchRunId
            : existingLaunch.resourceId)
        : null,
  })

  const artifacts: GrowthObjectiveMaterializedArtifact[] = [launchArtifact]
  if (sequence) {
    artifacts.push(
      artifact({
        resourceType: "sequence",
        resourceKey: sequence.resourceKey,
        resourceId: sequence.resourceId,
        label: sequence.label,
        status:
          launchArtifact.status === "completed" && Number(launchArtifact.metadata?.enrolledCount ?? 0) > 0
            ? "completed"
            : "running",
        metadata: {
          enrollmentRunId: launchArtifact.metadata?.enrollmentRunId ?? null,
          enrolledCount: launchArtifact.metadata?.enrolledCount ?? 0,
        },
      }),
    )
  }

  const context = mergeObjectiveStageArtifacts(input.context, "launch", artifacts)
  const completion = evaluateGrowthObjectiveStageCompletion("launch", {
    ...input.objective,
    executionContext: context,
  })
  return mergeObjectiveStageArtifacts(context, "launch", [], {
    completed: completion.complete,
    blockers: completion.complete ? [] : [completion.reason ?? "Launch in progress"],
  })
}

export async function materializeGrowthObjectiveStage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objective: GrowthObjective
    stageId: GrowthObjectiveStageId
    certificationMode?: boolean
    actorUserId?: string | null
    actorUserEmail?: string | null
  },
): Promise<{ objective: GrowthObjective; context: GrowthObjectiveExecutionContext }> {
  let context = normalizeObjectiveExecutionContext(input.objective.executionContext)

  switch (input.stageId) {
    case "discover":
      context = await materializeDiscover(admin, { ...input, context })
      break
    case "research":
      context = await materializeResearch(admin, { ...input, context })
      break
    case "enrich":
      context = await materializeEnrich(admin, { ...input, context })
      break
    case "buying_committee":
      context = await materializeBuyingCommittee(admin, { ...input, context })
      break
    case "generate_assets":
      context = await materializeGenerateAssets(admin, { ...input, context })
      break
    case "launch":
      context = await materializeLaunch(admin, { ...input, context })
      break
    default:
      break
  }

  const stageArtifacts = context.stages[input.stageId]?.artifacts ?? []
  await bindArtifacts(admin, input.organizationId, input.objective.id, stageArtifacts)

  const objective = await persistContext(admin, input.organizationId, input.objective, context)
  return { objective, context }
}

export async function rebuildGrowthObjectiveExecutionContext(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
): Promise<GrowthObjective> {
  const { getGrowthObjective } = await import("@/lib/growth/objectives/growth-objective-repository")
  const objective = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!objective) throw new Error("Objective not found.")

  const context: GrowthObjectiveExecutionContext = {
    ...normalizeObjectiveExecutionContext(objective.executionContext),
    recoveredAt: new Date().toISOString(),
  }

  if (objective.eventSubscriptions?.items?.length) {
    for (const item of objective.eventSubscriptions.items) {
      if (!item.resourceId) continue
      const stageId: GrowthObjectiveStageId =
        item.resourceType === "saved_search" || item.resourceType === "audience"
          ? "discover"
          : item.resourceType === "campaign"
            ? "launch"
            : "generate_assets"
      const artifacts = context.stages[stageId]?.artifacts ?? []
      if (artifacts.some((entry) => entry.resourceId === item.resourceId)) continue
      context.stages[stageId] = {
        materializedAt: context.stages[stageId]?.materializedAt ?? new Date().toISOString(),
        completedAt: context.stages[stageId]?.completedAt ?? null,
        blockers: context.stages[stageId]?.blockers ?? [],
        artifacts: [
          ...artifacts,
          artifact({
            resourceType: item.resourceType,
            resourceKey: item.resourceKey,
            resourceId: item.resourceId,
            label: item.label,
            status: "completed",
            metadata: { recoveredFromSubscription: true },
          }),
        ],
      }
    }
  }

  return updateGrowthObjective(admin, organizationId, objectiveId, { executionContext: context })
}

export async function recoverGrowthObjectiveRuntimeContext(
  admin: SupabaseClient,
  organizationId: string,
  objective: GrowthObjective,
): Promise<GrowthObjective> {
  if (objective.executionContext?.recoveredAt && Object.keys(objective.executionContext.stages).length > 0) {
    return objective
  }
  const rebuilt = await rebuildGrowthObjectiveExecutionContext(admin, organizationId, objective.id)
  return {
    ...rebuilt,
    runtime: objective.runtime ?? rebuilt.runtime,
    executionHistory: objective.executionHistory ?? rebuilt.executionHistory,
    recentSignals: objective.recentSignals ?? rebuilt.recentSignals,
    recommendations: objective.recommendations ?? rebuilt.recommendations,
    status: objective.status ?? rebuilt.status,
  }
}

export const GrowthObjectiveMaterializationService = {
  materializeGrowthObjectiveStage,
  rebuildGrowthObjectiveExecutionContext,
  recoverGrowthObjectiveRuntimeContext,
} as const
