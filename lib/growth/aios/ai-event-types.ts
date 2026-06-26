/** GE-AIOS-2B — AI OS Event types (client-safe). Constitutional §11.5, §17.8. */

import type { AiWorkOrderAgent } from "@/lib/growth/aios/ai-work-order-types"

export const GROWTH_AIOS_2B_PHASE = "GE-AIOS-2B" as const

export const GROWTH_AI_EVENT_QA_MARKER = "growth-aios-2b-ai-event-v1" as const

export const GROWTH_AI_EVENT_SCHEMA_MIGRATION =
  "20271001130000_growth_aios_2b_ai_events.sql" as const

export const AI_EVENT_SCHEMA_VERSION = "1.0" as const

/** Constitutional event categories only. */
export const AI_EVENT_CATEGORIES = [
  "mission",
  "work_order",
  "decision",
  "memory",
  "learning",
  "agent",
  "executive",
  "provider",
  "health",
  "approval",
  "budget",
  "deliverability",
  "conversation",
  "opportunity",
  "system",
] as const

export type AiEventCategory = (typeof AI_EVENT_CATEGORIES)[number]

/** Event row lifecycle — immutable after insert; archived via append-only index. */
export const AI_EVENT_LIFECYCLES = ["created", "published", "archived"] as const

export type AiEventLifecycle = (typeof AI_EVENT_LIFECYCLES)[number]

/** Delivery lifecycle per subscriber. */
export const AI_EVENT_DELIVERY_STATUSES = ["pending", "consumed", "archived"] as const

export type AiEventDeliveryStatus = (typeof AI_EVENT_DELIVERY_STATUSES)[number]

export const AI_EVENT_SUBSCRIBER_KINDS = ["internal", "audit", "bridge", "future"] as const

export type AiEventSubscriberKind = (typeof AI_EVENT_SUBSCRIBER_KINDS)[number]

export type AiOsEvent = {
  id: string
  eventType: string
  eventVersion: number
  schemaVersion: string
  category: AiEventCategory
  organizationId: string
  missionId: string | null
  workOrderId: string | null
  agentOwner: AiWorkOrderAgent | null
  entityType: string | null
  entityId: string | null
  correlationId: string
  causationId: string | null
  priority: number
  producer: string
  source: string
  payload: Record<string, unknown>
  metadata: Record<string, unknown>
  auditMetadata: Record<string, unknown>
  lifecycle: AiEventLifecycle
  replayable: boolean
  replayKey: string | null
  occurredAt: string
  createdAt: string
  qaMarker: string
}

export type AiOsEventPublishInput = {
  organizationId: string
  eventType: string
  category: AiEventCategory
  producer: string
  source: string
  correlationId?: string
  causationId?: string | null
  missionId?: string | null
  workOrderId?: string | null
  agentOwner?: AiWorkOrderAgent | null
  entityType?: string | null
  entityId?: string | null
  priority?: number
  eventVersion?: number
  schemaVersion?: string
  payload?: Record<string, unknown>
  metadata?: Record<string, unknown>
  auditMetadata?: Record<string, unknown>
  replayable?: boolean
  replayKey?: string | null
  occurredAt?: string
}

export type AiOsEventSubscription = {
  id: string
  organizationId: string
  subscriberId: string
  subscriberKind: AiEventSubscriberKind
  categories: AiEventCategory[]
  eventTypePrefixes: string[]
  enabled: boolean
  metadata: Record<string, unknown>
  qaMarker: string
  createdAt: string
  updatedAt: string
}

export type AiOsEventSubscriptionInput = {
  organizationId: string
  subscriberId: string
  subscriberKind?: AiEventSubscriberKind
  categories?: AiEventCategory[]
  eventTypePrefixes?: string[]
  enabled?: boolean
  metadata?: Record<string, unknown>
}

export type AiOsEventDelivery = {
  id: string
  eventId: string
  organizationId: string
  subscriptionId: string
  subscriberId: string
  status: AiEventDeliveryStatus
  consumedAt: string | null
  archivedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type AiOsEventListFilter = {
  organizationId: string
  category?: AiEventCategory | AiEventCategory[]
  eventType?: string
  missionId?: string
  workOrderId?: string
  correlationId?: string
  limit?: number
}

export type AiOsEventReplayFilter = {
  organizationId: string
  correlationId?: string
  missionId?: string
  workOrderId?: string
  since?: string
  until?: string
  limit?: number
}

export type AiOsLegacyBridgeSource =
  | "realtime_events"
  | "objective_event_router"
  | "ai_work_order"
  | "lead_timeline"
  | "sequence_execution"

export function isAiEventCategory(value: unknown): value is AiEventCategory {
  return typeof value === "string" && (AI_EVENT_CATEGORIES as readonly string[]).includes(value)
}

export function clampAiEventPriority(value: number): number {
  if (!Number.isFinite(value)) return 500
  return Math.max(0, Math.min(1000, Math.round(value)))
}

export function buildAiEventCorrelationId(seed?: string): string {
  if (seed && seed.length > 0) return seed
  return crypto.randomUUID()
}

/**
 * Constitutional loose-coupling rule (GE-AIOS-2B):
 * AI OS services must publish domain interactions as events instead of direct cross-service calls.
 */
export const AI_OS_LOOSE_COUPLING_RULE =
  "AI OS services SHALL NOT directly invoke another AI OS service when the interaction represents a domain event." as const
