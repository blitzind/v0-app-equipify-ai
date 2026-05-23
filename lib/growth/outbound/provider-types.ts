/** Client-safe Growth Engine provider connector types. */

import type { GrowthOutboundProviderFamily } from "@/lib/growth/outbound/types"

export const GROWTH_PROVIDER_LIFECYCLE_STATUSES = [
  "not_connected",
  "configuring",
  "connected",
  "warning",
  "error",
  "disabled",
] as const

export type GrowthProviderLifecycleStatus = (typeof GROWTH_PROVIDER_LIFECYCLE_STATUSES)[number]

export const GROWTH_PROVIDER_CAPABILITY_KEYS = [
  "supports_webhooks",
  "supports_replies",
  "supports_sequences",
  "supports_custom_tracking",
  "supports_unsubscribe_sync",
  "supports_reply_sync",
  "supports_contact_sync",
  "supports_campaign_sync",
  "supports_send",
] as const

export type GrowthProviderCapabilityKey = (typeof GROWTH_PROVIDER_CAPABILITY_KEYS)[number]

export type GrowthProviderCapabilityProbeStatus = "supported" | "partial" | "unavailable" | "disabled"

export const GROWTH_PLATFORM_PROVIDER_EVENT_TYPES = [
  "provider_connected",
  "provider_validation_failed",
  "provider_disabled",
  "provider_reconnected",
] as const

export type GrowthPlatformProviderEventType = (typeof GROWTH_PLATFORM_PROVIDER_EVENT_TYPES)[number]

export type GrowthProviderCapabilitySnapshot = Record<
  GrowthProviderCapabilityKey,
  GrowthProviderCapabilityProbeStatus
>

export type GrowthProviderValidationWarning = {
  code: string
  message: string
}

export type GrowthProviderConnectionHealth = {
  lifecycleStatus: GrowthProviderLifecycleStatus
  healthReason: string | null
  lastValidationAt: string | null
  lastValidationSuccessAt: string | null
  validationFailureCount: number
  lastErrorMessage: string | null
  lastValidationDurationMs: number | null
  averageValidationDurationMs: number | null
  temporarilyDegraded: boolean
  degradedReason: string | null
  degradedUntil: string | null
  credentialLastRotatedAt: string | null
  credentialRotationRecommendedAt: string | null
  nextValidationAllowedAt: string | null
  capabilitySnapshot: GrowthProviderCapabilitySnapshot
}

export type GrowthProviderConnectionSummary = {
  id: string
  provider: string
  providerFamily: GrowthOutboundProviderFamily
  label: string
  status: string
  apiBaseUrl: string | null
  config: Record<string, unknown>
  monthlyCostEstimate: number | null
  seatCount: number | null
  notes: string | null
  credentialsConfigured: boolean
  webhookSecretConfigured: boolean
  health: GrowthProviderConnectionHealth
  createdAt: string
  updatedAt: string
}

export type GrowthProviderValidationResult = {
  healthy: boolean
  lifecycleStatus: GrowthProviderLifecycleStatus
  healthReason: string | null
  warnings: GrowthProviderValidationWarning[]
  supportedCapabilities: GrowthProviderCapabilitySnapshot
  accountMetadata: Record<string, unknown>
  durationMs: number
  temporarilyDegraded: boolean
  degradedReason: string | null
  degradedUntil: string | null
}

export type GrowthProviderCapabilityHistoryEntry = {
  id: string
  connectionId: string
  validatedAt: string
  healthy: boolean
  durationMs: number
  lifecycleStatus: GrowthProviderLifecycleStatus
  capabilitySnapshot: GrowthProviderCapabilitySnapshot
  warnings: GrowthProviderValidationWarning[]
  accountMetadata: Record<string, unknown>
  createdAt: string
}

export type GrowthPlatformTimelineEvent = {
  id: string
  connectionId: string | null
  eventType: GrowthPlatformProviderEventType
  title: string
  summary: string | null
  payload: Record<string, unknown>
  actorUserId: string | null
  actorEmail: string | null
  occurredAt: string
  createdAt: string
}

export const GROWTH_PROVIDER_CAPABILITY_LABELS: Record<GrowthProviderCapabilityKey, string> = {
  supports_webhooks: "Webhooks",
  supports_replies: "Replies",
  supports_sequences: "Sequences",
  supports_custom_tracking: "Custom tracking",
  supports_unsubscribe_sync: "Unsubscribe sync",
  supports_reply_sync: "Reply sync",
  supports_contact_sync: "Contact sync",
  supports_campaign_sync: "Campaign sync",
  supports_send: "Send",
}

export const GROWTH_PROVIDER_VALIDATION_COOLDOWN_MS = 30_000

export const GROWTH_PROVIDER_CREDENTIAL_ROTATION_RECOMMEND_DAYS = 90

/** Lifecycle states that require confirmation before delete. Others delete immediately. */
export const GROWTH_PROVIDER_DELETE_CONFIRMATION_LIFECYCLES = ["connected", "warning"] as const

export function growthProviderDeleteRequiresConfirmation(
  lifecycleStatus: GrowthProviderLifecycleStatus,
): boolean {
  return (GROWTH_PROVIDER_DELETE_CONFIRMATION_LIFECYCLES as readonly string[]).includes(lifecycleStatus)
}
