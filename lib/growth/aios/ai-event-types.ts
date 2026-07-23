/** GE-AIOS-2B — AI OS Event types (client-safe). Delegates to @fuzor/event-bus. */

import type { AiWorkOrderAgent } from "@/lib/growth/aios/ai-work-order-types"
import {
  PLATFORM_EVENT_CATEGORIES,
  PLATFORM_EVENT_DELIVERY_STATUSES,
  PLATFORM_EVENT_LIFECYCLES,
  PLATFORM_EVENT_LOOSE_COUPLING_RULE,
  PLATFORM_EVENT_QA_MARKER,
  PLATFORM_EVENT_SCHEMA_MIGRATION,
  PLATFORM_EVENT_SCHEMA_VERSION,
  PLATFORM_EVENT_SUBSCRIBER_KINDS,
  buildPlatformEventCorrelationId,
  clampPlatformEventPriority,
  isPlatformEventCategory,
} from "@fuzor/event-bus"

export type {
  PlatformEvent as AiOsEvent,
  PlatformEventCategory as AiEventCategory,
  PlatformEventDeliveryStatus as AiEventDeliveryStatus,
  PlatformEventLifecycle as AiEventLifecycle,
  PlatformEventListFilter as AiOsEventListFilter,
  PlatformEventPublishInput as AiOsEventPublishInput,
  PlatformEventReplayFilter as AiOsEventReplayFilter,
  PlatformEventSubscriberKind as AiEventSubscriberKind,
  PlatformEventSubscription as AiOsEventSubscription,
  PlatformEventSubscriptionInput as AiOsEventSubscriptionInput,
  PlatformEventDelivery as AiOsEventDelivery,
} from "@fuzor/event-bus"

export const GROWTH_AIOS_2B_PHASE = "GE-AIOS-2B" as const

export const GROWTH_AI_EVENT_QA_MARKER = PLATFORM_EVENT_QA_MARKER
export const GROWTH_AI_EVENT_SCHEMA_MIGRATION = PLATFORM_EVENT_SCHEMA_MIGRATION
export const AI_EVENT_SCHEMA_VERSION = PLATFORM_EVENT_SCHEMA_VERSION
export const AI_EVENT_CATEGORIES = PLATFORM_EVENT_CATEGORIES
export const AI_EVENT_LIFECYCLES = PLATFORM_EVENT_LIFECYCLES
export const AI_EVENT_DELIVERY_STATUSES = PLATFORM_EVENT_DELIVERY_STATUSES
export const AI_EVENT_SUBSCRIBER_KINDS = PLATFORM_EVENT_SUBSCRIBER_KINDS
export const AI_OS_LOOSE_COUPLING_RULE = PLATFORM_EVENT_LOOSE_COUPLING_RULE

export {
  buildPlatformEventCorrelationId as buildAiEventCorrelationId,
  clampPlatformEventPriority as clampAiEventPriority,
  isPlatformEventCategory as isAiEventCategory,
}

export type AiOsLegacyBridgeSource =
  | "realtime_events"
  | "objective_event_router"
  | "ai_work_order"
  | "lead_timeline"
  | "sequence_execution"

/** Re-export for event payloads referencing work order agents. */
export type { AiWorkOrderAgent }
