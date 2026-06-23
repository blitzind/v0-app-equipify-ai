/** GE-AUTO-2F — Real launch, sequence, and video materialization (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getMediaGenerationJobById } from "@/lib/growth/media/growth-media-generation-job-service"
import { createGrowthAiAvatarGenerationJob } from "@/lib/growth/media/growth-ai-avatar-generation-service"
import { GROWTH_MEDIA_ELEVENLABS_AVATAR_CATALOG } from "@/lib/growth/media/media-avatar-types"
import type {
  GrowthObjective,
  GrowthObjectiveMaterializedArtifact,
} from "@/lib/growth/objectives/growth-objective-types"
import {
  listGrowthSequencePatterns,
  setGrowthSequencePatternActive,
} from "@/lib/growth/sequence-pattern-repository"
import type { GrowthSequenceStepChannel } from "@/lib/growth/sequence-types"
import {
  createGrowthSendrLandingPage,
  publishGrowthSendrLandingPage,
} from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import {
  continueSendrLaunchRun,
  startSendrLaunchRun,
} from "@/lib/growth/sendr/growth-sendr-launch-run-service"
import { attachSendrPageToSequence } from "@/lib/growth/sendr/growth-sendr-sequence-bridge-service"
import { GrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"
import { slugFromGrowthVideoPageTitle } from "@/lib/growth/videos/growth-video-page-validation"

export const GROWTH_OBJECTIVE_PRODUCTION_MATERIALIZATION_QA_MARKER =
  "growth-objective-ge-auto-2g-v1" as const

const OBJECTIVE_SEQUENCE_QA_MARKER = GROWTH_OBJECTIVE_PRODUCTION_MATERIALIZATION_QA_MARKER

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function mapPlanChannel(channel: "email" | "sms" | "voice"): GrowthSequenceStepChannel {
  if (channel === "sms") return "sms"
  if (channel === "voice") return "voice_drop"
  return "email"
}

function artifact(
  input: Omit<GrowthObjectiveMaterializedArtifact, "createdAt">,
): GrowthObjectiveMaterializedArtifact {
  return { ...input, createdAt: new Date().toISOString() }
}

export {
  auditObjectiveActorContext,
  ObjectiveActorResolutionError,
  requireObjectiveActorContext,
  resolveObjectiveActorContext,
} from "@/lib/growth/objectives/growth-objective-actor-resolution"

export async function findOrCreateObjectiveSequencePattern(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objectiveId: string
    name: string
    description?: string | null
    channels: Array<"email" | "sms" | "voice">
  },
): Promise<{ patternId: string; created: boolean }> {
  const patternKey = `objective:${input.objectiveId}:${slugify(input.name)}`
  const existing = await admin
    .schema("growth")
    .from("sequence_patterns")
    .select("id")
    .eq("key", patternKey)
    .maybeSingle()
  if (existing.data?.id) {
    return { patternId: String(existing.data.id), created: false }
  }

  const patterns = await listGrowthSequencePatterns(admin)
  const reusable = patterns.find(
    (entry) =>
      entry.isActive &&
      entry.key.startsWith(`objective:${input.objectiveId}:`) &&
      entry.label.toLowerCase().includes(slugify(input.name).replace(/-/g, " ")),
  )
  if (reusable) {
    return { patternId: reusable.id, created: false }
  }

  const channels = input.channels.length > 0 ? input.channels : (["email"] as const)
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_patterns")
    .insert({
      key: patternKey,
      label: input.name,
      description: input.description ?? `Objective sequence for ${input.name}`,
      pattern_kind: "catalog",
      is_active: false,
      metadata: {
        qa_marker: OBJECTIVE_SEQUENCE_QA_MARKER,
        organization_id: input.organizationId,
        objective_id: input.objectiveId,
        execution_enabled: true,
      },
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "objective_sequence_pattern_create_failed")

  const patternId = String(data.id)
  const now = new Date().toISOString()
  for (const [index, channel] of channels.entries()) {
    const { error: stepError } = await admin.schema("growth").from("sequence_pattern_steps").insert({
      pattern_id: patternId,
      step_order: index + 1,
      channel: mapPlanChannel(channel),
      delay_days_min: index === 0 ? 0 : 2,
      delay_days_max: index === 0 ? 0 : 3,
      required_human_approval: true,
      generation_type: "objective_nurture",
      expected_signal: index === channels.length - 1 ? "reply" : "no_signal",
      updated_at: now,
    })
    if (stepError) throw new Error(stepError.message)
  }

  await setGrowthSequencePatternActive(admin, { patternId, isActive: true })
  return { patternId, created: true }
}

export async function createObjectiveSendrLandingPage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    ownerUserId: string
    title: string
    legacySharePageId?: string | null
    objectiveId: string
  },
): Promise<{ landingPageId: string; published: boolean }> {
  const page = await createGrowthSendrLandingPage(admin, {
    organizationId: input.organizationId,
    ownerUserId: input.ownerUserId,
    title: input.title,
    legacySharePageId: input.legacySharePageId ?? null,
    variableMap: { company: "{{company}}", first_name: "{{first_name}}" },
    mobileMetadata: {
      qa_marker: GROWTH_OBJECTIVE_PRODUCTION_MATERIALIZATION_QA_MARKER,
      objective_id: input.objectiveId,
    },
  })

  try {
    await publishGrowthSendrLandingPage(admin, {
      landingPageId: page.id,
      organizationId: input.organizationId,
      publishedBy: input.ownerUserId,
    })
    return { landingPageId: page.id, published: true }
  } catch {
    return { landingPageId: page.id, published: false }
  }
}

export async function createObjectiveVideoPageWithGeneration(
  admin: SupabaseClient,
  input: {
    organizationId: string
    actorUserId: string
    title: string
    description?: string | null
    objectiveId: string
    resourceKey: string
  },
): Promise<GrowthObjectiveMaterializedArtifact> {
  const videoService = createGrowthVideoService(admin)
  const assetResult = await videoService.createAsset({
    organizationId: input.organizationId,
    createdBy: input.actorUserId,
    title: input.title,
    description: input.description ?? null,
    sourceType: "ai_avatar_generation",
    status: "draft",
    uploadStatus: "pending",
  })
  if (!assetResult.ok) {
    return artifact({
      resourceType: "video_page",
      resourceKey: input.resourceKey,
      resourceId: `${input.objectiveId}:video:${input.resourceKey}`,
      label: input.title,
      status: "failed",
      metadata: { reason: assetResult.error },
    })
  }

  const pageService = new GrowthVideoPageService(admin)
  const page = await pageService.createPage({
    organizationId: input.organizationId,
    createdBy: input.actorUserId,
    videoAssetId: assetResult.asset.id,
    slug: slugFromGrowthVideoPageTitle(input.title),
    title: input.title,
    description: input.description ?? null,
  })
  await pageService.updatePage({
    organizationId: input.organizationId,
    pageId: page.id,
    patch: {
      metadata: {
        qa_marker: GROWTH_OBJECTIVE_PRODUCTION_MATERIALIZATION_QA_MARKER,
        objective_id: input.objectiveId,
        source: "objective_materialization",
      },
    },
  }).catch(() => undefined)

  const defaultAvatar =
    GROWTH_MEDIA_ELEVENLABS_AVATAR_CATALOG.find((entry) => entry.enabled)?.avatarId ??
    "elevenlabs-avatar-jordan"

  let avatarRunId: string | null = null
  let avatarStatus: string = "queued"
  try {
    const job = await createGrowthAiAvatarGenerationJob(admin, {
      organizationId: input.organizationId,
      createdBy: input.actorUserId,
      generation: {
        videoPageId: page.id,
        avatarId: defaultAvatar,
        provider: "elevenlabs",
        attachToPageOnComplete: true,
        prospect: {
          companyName: input.title,
        },
      },
    })
    avatarRunId = job.runId
    avatarStatus = job.status
  } catch (error) {
    avatarStatus = "failed"
    return artifact({
      resourceType: "video_page",
      resourceKey: input.resourceKey,
      resourceId: page.id,
      label: input.title,
      status: "failed",
      metadata: {
        videoAssetId: assetResult.asset.id,
        avatarRunId,
        avatarStatus,
        reason: error instanceof Error ? error.message : "avatar_job_failed",
      },
    })
  }

  const completed = avatarStatus === "completed" || Boolean(jobHasOutput(avatarStatus))
  return artifact({
    resourceType: "video_page",
    resourceKey: input.resourceKey,
    resourceId: page.id,
    label: input.title,
    status: completed ? "completed" : "running",
    metadata: {
      videoAssetId: assetResult.asset.id,
      avatarRunId,
      avatarStatus,
      outputMediaAssetId: null,
    },
  })
}

function jobHasOutput(status: string): boolean {
  return status === "completed" || status === "succeeded"
}

export async function refreshObjectiveVideoArtifactStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    artifact: GrowthObjectiveMaterializedArtifact
  },
): Promise<GrowthObjectiveMaterializedArtifact> {
  if (input.artifact.status === "completed" || input.artifact.status === "failed") {
    return input.artifact
  }
  const avatarRunId =
    typeof input.artifact.metadata?.avatarRunId === "string" ? input.artifact.metadata.avatarRunId : null
  if (!avatarRunId) return input.artifact

  const run = await getMediaGenerationJobById(admin, {
    organizationId: input.organizationId,
    runId: avatarRunId,
  }).catch(() => null)
  if (!run) return input.artifact

  const output = run.output as Record<string, unknown>
  const writeback =
    output.storage_writeback && typeof output.storage_writeback === "object"
      ? (output.storage_writeback as Record<string, unknown>)
      : null
  const outputMediaAssetId =
    typeof writeback?.asset_id === "string"
      ? writeback.asset_id
      : typeof output.output_media_asset_id === "string"
        ? output.output_media_asset_id
        : null

  if (run.status === "failed") {
    return {
      ...input.artifact,
      status: "failed",
      metadata: {
        ...input.artifact.metadata,
        avatarStatus: run.status,
        reason: run.error ?? "avatar_generation_failed",
      },
    }
  }

  if (run.status === "completed" || outputMediaAssetId) {
    return {
      ...input.artifact,
      status: "completed",
      metadata: {
        ...input.artifact.metadata,
        avatarStatus: run.status,
        outputMediaAssetId,
      },
    }
  }

  return {
    ...input.artifact,
    metadata: {
      ...input.artifact.metadata,
      avatarStatus: run.status,
      progressPercent: run.progressPercent,
    },
  }
}

export async function executeObjectiveSendrLaunch(
  admin: SupabaseClient,
  input: {
    organizationId: string
    actorUserId: string
    actorUserEmail: string
    audienceId: string
    sequencePatternId: string
    landingPageId: string
    existingLaunchRunId?: string | null
  },
): Promise<GrowthObjectiveMaterializedArtifact> {
  let progress = input.existingLaunchRunId
    ? await continueSendrLaunchRun(admin, {
        organizationId: input.organizationId,
        userId: input.actorUserId,
        userEmail: input.actorUserEmail,
        launchRunId: input.existingLaunchRunId,
      })
    : await startSendrLaunchRun(admin, {
        organizationId: input.organizationId,
        userId: input.actorUserId,
        userEmail: input.actorUserEmail,
        audienceId: input.audienceId,
        sequencePatternId: input.sequencePatternId,
        landingPageId: input.landingPageId,
      })

  let guard = 0
  while (progress.hasMore && progress.nextAction === "continue" && guard < 5) {
    progress = await continueSendrLaunchRun(admin, {
      organizationId: input.organizationId,
      userId: input.actorUserId,
      userEmail: input.actorUserEmail,
      launchRunId: progress.launchRunId,
    })
    guard += 1
  }

  const status =
    progress.status === "completed"
      ? "completed"
      : progress.status === "failed"
        ? "failed"
        : "running"

  return artifact({
    resourceType: "campaign",
    resourceKey: "primary-launch",
    resourceId: progress.launchRunId,
    label: "Sendr launch run",
    status,
    metadata: {
      launchRunId: progress.launchRunId,
      enrollmentRunId: progress.enrollmentRunId,
      enrolledCount: progress.enrolledCount,
      processedCount: progress.processedCount,
      sequenceLinkId: progress.sequenceLinkId,
      previewId: progress.previewId,
      nextAction: progress.nextAction,
      hasMore: progress.hasMore,
      error: progress.error,
    },
  })
}

export async function ensureSendrPageSequenceLink(
  admin: SupabaseClient,
  input: {
    organizationId: string
    landingPageId: string
    sequencePatternId: string
    actorUserId?: string | null
  },
): Promise<string | null> {
  try {
    const link = await attachSendrPageToSequence(admin, {
      organizationId: input.organizationId,
      landingPageId: input.landingPageId,
      sequencePatternId: input.sequencePatternId,
      attachedBy: input.actorUserId ?? null,
      metadata: { source: "objective_materialization" },
    })
    return link.id
  } catch {
    return null
  }
}
