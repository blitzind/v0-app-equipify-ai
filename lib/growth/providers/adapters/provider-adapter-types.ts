/** Growth Engine — Provider adapter contract (Phase 2D). Client-safe types only. */

import type { GrowthDeliveryProviderFamily } from "@/lib/growth/providers/provider-types"

export const GROWTH_LIVE_PROVIDER_TRANSPORT_QA_MARKER = "growth-live-provider-transport-v1" as const

export const GROWTH_TRANSPORT_RETRY_DELAYS_MS = [
  0,
  5 * 60 * 1000,
  30 * 60 * 1000,
  4 * 60 * 60 * 1000,
] as const

export const GROWTH_TRANSPORT_MAX_RETRIES = 3 as const

export const GROWTH_TRANSPORT_TIMELINE_EVENT_TYPES = [
  "delivery_queued",
  "delivery_sent",
  "delivery_failed",
  "delivery_retry",
  "rate_limit_hit",
] as const

export type GrowthTransportTimelineEventType = (typeof GROWTH_TRANSPORT_TIMELINE_EVENT_TYPES)[number]

export const GROWTH_TRANSPORT_ATTEMPT_STATUSES = [
  "queued",
  "sent",
  "failed",
  "retry_scheduled",
  "cancelled",
] as const

export type GrowthTransportAttemptStatus = (typeof GROWTH_TRANSPORT_ATTEMPT_STATUSES)[number]

export const GROWTH_TRANSPORT_CHANNELS = ["email"] as const
export type GrowthTransportChannel = (typeof GROWTH_TRANSPORT_CHANNELS)[number]

export type ProviderAdapterCapabilities = {
  oauthMailbox: boolean
  smtp: boolean
  apiKey: boolean
  webhooks: boolean
  tracking: boolean
}

export type ProviderAdapterValidationResult = {
  ok: boolean
  status: "valid" | "warning" | "invalid"
  summary: string
}

export type ProviderAdapterHealthResult = {
  ok: boolean
  tier: "healthy" | "degraded" | "critical"
  summary: string
}

export type ProviderSendMessage = {
  to: string
  subject: string
  html?: string
  text?: string
  from: string
  fromName?: string
  replyTo?: string
}

/** Server-only credentials — never expose to clients. */
export type ProviderAdapterCredentials = {
  provider_family: GrowthDeliveryProviderFamily
  access_token?: string | null
  refresh_token?: string | null
  api_key?: string | null
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_user?: string | null
  smtp_password?: string | null
  smtp_secure?: boolean
  aws_access_key_id?: string | null
  aws_secret_access_key?: string | null
  aws_region?: string | null
  from_address?: string | null
}

export type ProviderSendResult = {
  ok: boolean
  provider_message_id?: string
  error?: string
  simulated?: boolean
}

export type GrowthProviderAdapter = {
  family: GrowthDeliveryProviderFamily
  capabilities(): ProviderAdapterCapabilities
  validate(credentials: ProviderAdapterCredentials): ProviderAdapterValidationResult
  health(credentials: ProviderAdapterCredentials): ProviderAdapterHealthResult
  send(credentials: ProviderAdapterCredentials, message: ProviderSendMessage): Promise<ProviderSendResult>
}

export type GrowthDeliveryAttempt = {
  id: string
  provider_id: string | null
  sender_account_id: string | null
  provider_connection_id?: string | null
  outreach_queue_id?: string | null
  failure_class?: string | null
  latency_ms?: number | null
  send_plane?: "transport" | "adapter"
  lead_id: string | null
  sequence_enrollment_id: string | null
  channel: GrowthTransportChannel
  status: GrowthTransportAttemptStatus
  queued_at: string
  sent_at: string | null
  failed_at: string | null
  provider_message_id: string | null
  failure_reason: string | null
  retry_count: number
  metadata: Record<string, unknown>
  created_at: string
}

export type GrowthProviderRateLimitRow = {
  id: string
  provider_id: string
  minute_cap: number
  hour_cap: number
  day_cap: number
  current_minute: number
  current_hour: number
  current_day: number
  window_started_at: string
  created_at: string
  updated_at: string
}

export type GrowthTransportHealthSnapshot = {
  qa_marker: typeof GROWTH_LIVE_PROVIDER_TRANSPORT_QA_MARKER
  queued_count: number
  sent_count_24h: number
  failed_count_24h: number
  retry_scheduled_count: number
  rate_limited_providers: number
  healthy_providers: number
}

export type GrowthTransportSimulationResult = {
  route: {
    selected_route_id: string | null
    selected_provider_name: string | null
    fallback_route_id: string | null
    fallback_provider_name: string | null
    reason: string
  }
  rate_limit: {
    allowed: boolean
    reason: string
    minute_remaining: number
    hour_remaining: number
    day_remaining: number
  }
  fallback_route: {
    route_id: string | null
    provider_name: string | null
  }
}

export const GROWTH_LIVE_PROVIDER_TRANSPORT_PRIVACY_NOTE =
  "Live transport executes human-approved sends only. Provider tokens and API keys never leave the server. No autonomous sending."
