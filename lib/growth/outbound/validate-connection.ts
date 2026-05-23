import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  appendGrowthProviderCapabilityHistory,
  countGrowthProviderCapabilityHistory,
} from "@/lib/growth/outbound/capability-history-repository"
import { resolveGrowthProviderLifecycleFromValidation } from "@/lib/growth/outbound/connection-lifecycle"
import { appendGrowthPlatformTimelineEvent } from "@/lib/growth/outbound/platform-timeline-repository"
import {
  applyGrowthProviderValidationPatch,
  fetchGrowthProviderConnectionInternal,
  growthProviderValidationCooldownRemainingMs,
  isGrowthProviderValidationCooldownActive,
  readGrowthProviderConnectionCredentials,
  type GrowthProviderConnectionInternal,
} from "@/lib/growth/outbound/provider-connection-repository"
import type {
  GrowthProviderConnectionSummary,
  GrowthProviderValidationResult,
} from "@/lib/growth/outbound/provider-types"
import { GROWTH_PROVIDER_VALIDATION_COOLDOWN_MS } from "@/lib/growth/outbound/provider-types"
import { getOutboundProviderAdapter } from "@/lib/growth/outbound/providers/registry"
import type { GrowthEmailProviderConnection } from "@/lib/growth/outbound/types"

export class GrowthProviderValidationCooldownError extends Error {
  readonly remainingMs: number

  constructor(remainingMs: number) {
    super(`validation_cooldown:${remainingMs}`)
    this.remainingMs = remainingMs
  }
}

function toAdapterConnection(connection: GrowthProviderConnectionInternal): GrowthEmailProviderConnection {
  return {
    id: connection.id,
    provider: connection.provider,
    providerFamily: connection.providerFamily,
    label: connection.label,
    status: connection.status as GrowthEmailProviderConnection["status"],
    apiBaseUrl: connection.apiBaseUrl,
    webhookSecret: connection.webhookSecretConfigured ? "[configured]" : null,
    config: connection.config,
    lastWebhookAt: null,
    lastError: connection.health.lastErrorMessage,
    monthlyCostEstimate: connection.monthlyCostEstimate,
    seatCount: connection.seatCount,
    notes: connection.notes,
    createdBy: null,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  }
}

export async function validateGrowthProviderConnection(
  admin: SupabaseClient,
  input: {
    connectionId: string
    actorUserId?: string | null
    actorEmail?: string | null
    force?: boolean
  },
): Promise<{
  connection: GrowthProviderConnectionSummary
  validation: GrowthProviderValidationResult
  cooldownRemainingMs: number
}> {
  const connection = await fetchGrowthProviderConnectionInternal(admin, input.connectionId)
  if (!connection) throw new Error("connection_not_found")

  if (!input.force && isGrowthProviderValidationCooldownActive(connection)) {
    throw new GrowthProviderValidationCooldownError(
      growthProviderValidationCooldownRemainingMs(connection),
    )
  }

  const adapter = getOutboundProviderAdapter(connection.provider)
  const credentials = readGrowthProviderConnectionCredentials(connection)
  const started = Date.now()

  const adapterResult = await adapter.validateConnection({
    connection: toAdapterConnection(connection),
    credentials,
  })

  const durationMs = Date.now() - started
  const lifecycleStatus = resolveGrowthProviderLifecycleFromValidation({
    healthy: adapterResult.healthy,
    warnings: adapterResult.warnings,
    temporarilyDegraded: adapterResult.temporarilyDegraded,
  })

  const priorCount = await countGrowthProviderCapabilityHistory(admin, connection.id)
  const prevAvg = connection.health.averageValidationDurationMs
  const averageDurationMs =
    prevAvg == null ? durationMs : Math.round((prevAvg * priorCount + durationMs) / (priorCount + 1))

  const validationFailureCount = adapterResult.healthy
    ? 0
    : connection.health.validationFailureCount + 1

  const lastErrorMessage = adapterResult.healthy
    ? null
    : adapterResult.warnings[0]?.message ?? "Provider validation failed"

  const seatCount =
    typeof adapterResult.accountMetadata.seatCount === "number"
      ? adapterResult.accountMetadata.seatCount
      : undefined

  const updated = await applyGrowthProviderValidationPatch(admin, connection.id, {
    lifecycleStatus,
    healthy: adapterResult.healthy,
    warnings: adapterResult.warnings,
    capabilitySnapshot: adapterResult.supportedCapabilities,
    durationMs,
    averageDurationMs,
    temporarilyDegraded: Boolean(adapterResult.temporarilyDegraded),
    degradedReason: adapterResult.degradedReason ?? null,
    degradedUntil: adapterResult.degradedUntil ?? null,
    lastErrorMessage,
    validationFailureCount,
    seatCount,
  })

  await appendGrowthProviderCapabilityHistory(admin, {
    connectionId: connection.id,
    healthy: adapterResult.healthy,
    durationMs,
    lifecycleStatus,
    capabilitySnapshot: adapterResult.supportedCapabilities,
    warnings: adapterResult.warnings,
    accountMetadata: adapterResult.accountMetadata,
  })

  if (adapterResult.healthy) {
    await appendGrowthPlatformTimelineEvent(admin, {
      connectionId: connection.id,
      eventType: "provider_connected",
      title: `${connection.label} validated`,
      summary: adapterResult.warnings.length
        ? `Validation succeeded with ${adapterResult.warnings.length} warning(s).`
        : "Validation succeeded.",
      payload: {
        durationMs,
        lifecycleStatus,
        temporarilyDegraded: Boolean(adapterResult.temporarilyDegraded),
      },
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
  } else {
    await appendGrowthPlatformTimelineEvent(admin, {
      connectionId: connection.id,
      eventType: "provider_validation_failed",
      title: `${connection.label} validation failed`,
      summary: lastErrorMessage,
      payload: { durationMs, lifecycleStatus },
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
  }

  const validation: GrowthProviderValidationResult = {
    healthy: adapterResult.healthy,
    lifecycleStatus,
    healthReason: updated.health.healthReason,
    warnings: adapterResult.warnings,
    supportedCapabilities: adapterResult.supportedCapabilities,
    accountMetadata: adapterResult.accountMetadata,
    durationMs,
    temporarilyDegraded: Boolean(adapterResult.temporarilyDegraded),
    degradedReason: adapterResult.degradedReason ?? null,
    degradedUntil: adapterResult.degradedUntil ?? null,
  }

  return {
    connection: updated,
    validation,
    cooldownRemainingMs: GROWTH_PROVIDER_VALIDATION_COOLDOWN_MS,
  }
}
