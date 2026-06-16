import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createDraftFromPublishedVersionMetadata,
  getFlowGraph,
  listVersions,
  publishAutomationFlowVersionMetadata,
  unpublishAutomationFlowMetadata,
} from "@/lib/growth/automation/growth-automation-repository"
import type {
  GrowthAutomationPublishMetadata,
  GrowthAutomationPublishReadinessResult,
  GrowthAutomationPublishResult,
  GrowthAutomationPublishStatusResult,
} from "@/lib/growth/automation/growth-automation-publish-types"
import {
  buildPublishMetadata,
  evaluatePublishReadiness,
  extractPublishMetadata,
  mapFlowPublishStatus,
  mergePublishMetadataIntoCanvasLayout,
} from "@/lib/growth/automation/growth-automation-publish-utils"
import { canEditAutomationDraftVersion } from "@/lib/growth/automation/growth-automation-types"

export async function checkPublishReadiness(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; versionId?: string },
): Promise<GrowthAutomationPublishReadinessResult> {
  const graph = await getFlowGraph(admin, input)
  return evaluatePublishReadiness(graph)
}

export async function publishAutomationFlowVersion(
  admin: SupabaseClient,
  input: {
    flowId: string
    organizationId: string
    versionId?: string
    publishedBy?: string | null
  },
): Promise<GrowthAutomationPublishResult> {
  const graph = await getFlowGraph(admin, input)
  const readiness = evaluatePublishReadiness(graph)
  if (!readiness.ok) {
    return {
      ok: false,
      flow: graph.flow,
      publishedVersion: graph.version,
      draftVersion: graph.version,
      readiness,
      metadata: buildPublishMetadata(readiness),
    }
  }

  const metadata = buildPublishMetadata(readiness)
  const canvasLayoutJson = mergePublishMetadataIntoCanvasLayout({
    canvasLayoutJson: graph.version.canvasLayoutJson,
    metadata,
  })

  const published = await publishAutomationFlowVersionMetadata(admin, {
    flowId: graph.flow.id,
    versionId: graph.version.id,
    organizationId: input.organizationId,
    publishedBy: input.publishedBy ?? null,
    publishMetadata: metadata as unknown as Record<string, unknown>,
    canvasLayoutJson,
  })

  return {
    ok: true,
    flow: published.flow,
    publishedVersion: published.publishedVersion,
    draftVersion: published.draftVersion,
    readiness,
    metadata: extractPublishMetadata(published.publishedVersion.canvasLayoutJson) ?? metadata,
  }
}

export async function unpublishAutomationFlow(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<{ flow: Awaited<ReturnType<typeof unpublishAutomationFlowMetadata>> }> {
  const flow = await unpublishAutomationFlowMetadata(admin, input)
  return { flow }
}

export async function getPublishStatus(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationPublishStatusResult> {
  const graph = await getFlowGraph(admin, input)
  const versions = await listVersions(admin, input)
  const publishedVersion = graph.flow.publishedVersionId
    ? versions.find((version) => version.id === graph.flow.publishedVersionId) ?? null
    : null
  const currentVersion = graph.version
  const metadata =
    extractPublishMetadata(currentVersion.canvasLayoutJson) ??
    (publishedVersion ? extractPublishMetadata(publishedVersion.canvasLayoutJson) : null)
  const readiness = evaluatePublishReadiness(graph)

  return {
    flow: graph.flow,
    currentVersion,
    publishedVersion,
    versions,
    publishStatus: mapFlowPublishStatus(graph.flow),
    publishReadiness: readiness.publishReadiness,
    requiresHumanReview: readiness.requiresHumanReview,
    lastCompiledAt: metadata?.lastCompiledAt ?? readiness.lastCompiledAt,
    compileSummary: metadata?.compileSummary ?? readiness.compileSummary,
    publishWarnings: readiness.publishWarnings,
    publishErrors: readiness.publishErrors,
    metadata,
  }
}

export async function createDraftFromPublishedVersion(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<{ flow: Awaited<ReturnType<typeof createDraftFromPublishedVersionMetadata>>["flow"]; version: Awaited<ReturnType<typeof createDraftFromPublishedVersionMetadata>>["version"] }> {
  const result = await createDraftFromPublishedVersionMetadata(admin, input)
  return result
}

export function assertPublishedVersionImmutable(version: { lifecycle: string }): void {
  if (!canEditAutomationDraftVersion(version.lifecycle as "draft" | "published" | "superseded")) {
    throw new Error("published_version_immutable")
  }
}

export type { GrowthAutomationPublishMetadata }
