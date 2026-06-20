import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SENDR_RESOURCE_ESTIMATES,
  type GrowthSendrMediaAssetType,
} from "@/lib/growth/sendr/growth-sendr-config"
import {
  assertSendrOrgAssetCap,
  consumeSendrBudget,
  recordSendrGuardrailFailure,
} from "@/lib/growth/sendr/growth-sendr-guardrails"
import {
  createGrowthSendrMediaAsset,
  createGrowthSendrMediaAssetVersion,
  getGrowthSendrMediaAsset,
  logGrowthSendrMediaAssetAccess,
  publishGrowthSendrMediaAssetVersion,
} from "@/lib/growth/sendr/growth-sendr-media-asset-repository"
import type { GrowthSendrMediaAsset } from "@/lib/growth/sendr/growth-sendr-types"
import {
  recordRuntimeHealthRead,
  recordRuntimeHealthWrite,
} from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"

export { GROWTH_SENDR_RESOURCE_ESTIMATES }

/** Operator-initiated media asset registration — metadata only. */
export async function registerSendrMediaAsset(
  admin: SupabaseClient,
  input: {
    organizationId: string
    ownerUserId: string
    assetType: GrowthSendrMediaAssetType
    name: string
    slug?: string | null
    metadata?: Record<string, unknown>
    legacyMediaAssetId?: string | null
    legacySharePageId?: string | null
    legacyVideoAssetId?: string | null
  },
): Promise<GrowthSendrMediaAsset> {
  const budget = await consumeSendrBudget(admin, {
    organizationId: input.organizationId,
    resourceType: "media_assets",
  })
  if (!budget.allowed) {
    await recordSendrGuardrailFailure(admin, budget.reason ?? "media_asset_budget_exceeded")
    throw new Error(budget.reason ?? "media_asset_budget_exceeded")
  }

  const cap = await assertSendrOrgAssetCap(admin, input.organizationId)
  if (!cap.allowed) {
    await recordSendrGuardrailFailure(admin, cap.reason ?? "media_asset_cap_exceeded")
    throw new Error(cap.reason ?? "media_asset_cap_exceeded")
  }

  await recordRuntimeHealthRead(admin, GROWTH_SENDR_RESOURCE_ESTIMATES.mediaAssetCreate.maxReadsPerRun)
  const asset = await createGrowthSendrMediaAsset(admin, input)
  const version = await createGrowthSendrMediaAssetVersion(admin, {
    mediaAssetId: asset.id,
    organizationId: input.organizationId,
    storageMetadata: input.metadata ?? {},
  })
  await logGrowthSendrMediaAssetAccess(admin, {
    mediaAssetId: asset.id,
    organizationId: input.organizationId,
    accessKind: "write",
    actorUserId: input.ownerUserId,
  })
  await recordRuntimeHealthWrite(admin, GROWTH_SENDR_RESOURCE_ESTIMATES.mediaAssetCreate.maxWritesPerRun)

  return { ...asset, publishedVersionId: version.id }
}

export async function publishSendrMediaAsset(
  admin: SupabaseClient,
  input: {
    organizationId: string
    mediaAssetId: string
    versionId: string
    publishedBy: string
  },
): Promise<GrowthSendrMediaAsset> {
  const asset = await getGrowthSendrMediaAsset(admin, input.mediaAssetId)
  if (!asset || asset.organizationId !== input.organizationId) {
    throw new Error("media_asset_not_found")
  }

  const published = await publishGrowthSendrMediaAssetVersion(admin, input)
  await logGrowthSendrMediaAssetAccess(admin, {
    mediaAssetId: input.mediaAssetId,
    organizationId: input.organizationId,
    accessKind: "publish",
    actorUserId: input.publishedBy,
  })
  return published
}
