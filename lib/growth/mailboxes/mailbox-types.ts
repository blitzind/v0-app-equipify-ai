/** Growth Engine — Mailbox Connection types (Phase 1B). Client-safe. */

import type { GrowthSenderProviderFamily } from "@/lib/growth/sender/sender-types"

export const GROWTH_MAILBOX_CONNECTION_QA_MARKER = "growth-mailbox-connection-v1" as const

export const GROWTH_MAILBOX_CONNECTION_STATUSES = [
  "pending",
  "connecting",
  "connected",
  "warning",
  "expired",
  "error",
  "disabled",
] as const
export type GrowthMailboxConnectionStatus = (typeof GROWTH_MAILBOX_CONNECTION_STATUSES)[number]

export const GROWTH_MAILBOX_HEALTH_TIERS = ["healthy", "warning", "degraded", "critical"] as const
export type GrowthMailboxHealthTier = (typeof GROWTH_MAILBOX_HEALTH_TIERS)[number]

export const GROWTH_MAILBOX_EVENT_SEVERITIES = ["low", "medium", "high", "critical"] as const
export type GrowthMailboxEventSeverity = (typeof GROWTH_MAILBOX_EVENT_SEVERITIES)[number]

export const GROWTH_MAILBOX_TIMELINE_EVENT_TYPES = [
  "mailbox_connected",
  "mailbox_disconnected",
  "mailbox_validation_failed",
  "mailbox_token_expired",
  "mailbox_health_declined",
] as const
export type GrowthMailboxTimelineEventType = (typeof GROWTH_MAILBOX_TIMELINE_EVENT_TYPES)[number]

/** API-safe mailbox row — never includes encrypted token fields. */
export type GrowthMailboxConnectionSummary = {
  id: string
  sender_account_id: string
  provider_family: GrowthSenderProviderFamily
  status: GrowthMailboxConnectionStatus
  email_address: string
  display_name: string
  token_expires_at: string | null
  token_configured: boolean
  last_refresh_attempt: string | null
  last_successful_refresh: string | null
  last_validation_at: string | null
  validation_failure_count: number
  provider_account_id: string | null
  provider_metadata: Record<string, unknown>
  connection_health: number
  health_tier: GrowthMailboxHealthTier
  health_reason: string | null
  /** Populated by validateMailboxConnection only — not persisted. */
  validation_message?: string
  created_at: string
  updated_at: string
}

export type GrowthMailboxConnectionEvent = {
  id: string
  mailbox_connection_id: string
  event_type: string
  severity: GrowthMailboxEventSeverity
  title: string
  description: string
  metadata: Record<string, unknown>
  created_at: string
}

export type GrowthMailboxHealthDashboard = {
  qa_marker: typeof GROWTH_MAILBOX_CONNECTION_QA_MARKER
  connected_count: number
  warning_count: number
  expired_count: number
  failed_validation_count: number
  average_connection_health: number
}

export const GROWTH_MAILBOX_CONNECTION_PRIVACY_NOTE =
  "Mailbox tokens are encrypted at rest and never returned to clients. No outbound sending in Phase 1B."

export type GrowthMailboxTokenRefreshResult = "supported" | "unsupported" | "failed"
