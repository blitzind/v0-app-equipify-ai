/**
 * Communications Center Phase 1 — client-side feed shapes returned
 * from `/api/.../communications/feed` and the per-event detail
 * endpoint. These mirror `lib/communications/feed.ts::FeedItem` but
 * are decoupled here so we don't drag server-only imports into
 * "use client" files.
 */

import type {
  CommunicationChannel,
  CommunicationDeliveryStatus,
  RelatedEntityType,
} from "@/lib/notifications/types"

export type FeedCategoryClient = "billing" | "operations" | "marketing" | "system"

export type FeedItemClient = {
  id: string
  organization_id: string
  channel: CommunicationChannel
  direction: "outbound" | "inbound"
  event_type: string
  title: string
  summary: string | null
  body: string | null
  audience: "organization" | "customer_timeline" | "both"
  counts_toward_unread: boolean
  delivery_status: CommunicationDeliveryStatus
  recipient_kind: "user" | "customer" | "external" | "none"
  recipient_user_id: string | null
  recipient_customer_id: string | null
  recipient_address: string | null
  related_entity_type: RelatedEntityType | null
  related_entity_id: string | null
  provider: string
  provider_message_id: string | null
  metadata: Record<string, unknown> | null
  scheduled_reminder_key: string | null
  scheduled_at: string | null
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
  error_message: string | null
  created_at: string
  created_by: string | null
  entity_label: string | null
  entity_href: string | null
  customer_label: string | null
  customer_href: string | null
  category: FeedCategoryClient
  automated: boolean
}

export type FeedStatsClient = {
  sentToday: number
  failed: number
  queued: number
  automated: number
  prospectFollowUps: number
  total: number
}

export type FeedResponseClient = {
  items: FeedItemClient[]
  nextCursor: string | null
  stats: FeedStatsClient
  role: string | null
  canManageCommunications: boolean
}

export type FeedDetailClient = FeedItemClient & {
  ai_generated: boolean
  simulated: boolean
}
