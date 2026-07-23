/** GE-AIOS-2B — AI OS Event schema health probe. Delegates to @fuzor/event-bus. */

import "server-only"

import type { GrowthSchemaObjectProbe } from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import {
  PLATFORM_EVENT_SCHEMA_OBJECTS,
  formatPlatformEventSchemaNotReadyMessage as formatGrowthAiEventSchemaNotReadyMessage,
  isPlatformEventSchemaReady as isGrowthAiEventSchemaReady,
  probePlatformEventSchema as probeGrowthAiEventSchema,
} from "@fuzor/event-bus"

export {
  formatGrowthAiEventSchemaNotReadyMessage,
  isGrowthAiEventSchemaReady,
  probeGrowthAiEventSchema,
}

export const GROWTH_AI_EVENT_SCHEMA_HEALTH_QA_MARKER =
  "growth-aios-2b-ai-event-schema-health-v1" as const

export const GROWTH_AI_EVENT_SCHEMA_OBJECTS =
  PLATFORM_EVENT_SCHEMA_OBJECTS as unknown as GrowthSchemaObjectProbe[]

export type { PlatformEventSchemaHealthSummary as GrowthSchemaHealthSummary } from "@fuzor/event-bus"
