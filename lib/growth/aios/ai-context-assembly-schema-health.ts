import "server-only"

/** GE-AIOS-2J — Context Assembly schema health. Delegates to @fuzor/context. */

import type { GrowthSchemaObjectProbe } from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import {
  PLATFORM_CONTEXT_SCHEMA_OBJECTS,
  formatPlatformContextAssemblySchemaNotReadyMessage as formatGrowthAiContextAssemblySchemaNotReadyMessage,
  isPlatformContextAssemblySchemaReady as isGrowthAiContextAssemblySchemaReady,
  probePlatformContextAssemblySchema as probeGrowthAiContextAssemblySchema,
} from "@fuzor/context"

export {
  formatGrowthAiContextAssemblySchemaNotReadyMessage,
  isGrowthAiContextAssemblySchemaReady,
  probeGrowthAiContextAssemblySchema,
}

export const GROWTH_AI_CONTEXT_ASSEMBLY_SCHEMA_HEALTH_QA_MARKER =
  "growth-aios-2j-context-assembly-schema-health-v1" as const

export const GROWTH_AI_CONTEXT_ASSEMBLY_SCHEMA_OBJECTS =
  PLATFORM_CONTEXT_SCHEMA_OBJECTS as unknown as GrowthSchemaObjectProbe[]

export type { PlatformContextSchemaHealthSummary as GrowthSchemaHealthSummary } from "@fuzor/context"
