/** GE-AIOS-2D — Decision Record schema health probe. Delegates to @fuzor/decision-records. */

import "server-only"

import type { GrowthSchemaObjectProbe } from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import {
  PLATFORM_DECISION_RECORD_SCHEMA_OBJECTS,
  formatPlatformDecisionRecordSchemaNotReadyMessage as formatGrowthAiDecisionRecordSchemaNotReadyMessage,
  isPlatformDecisionRecordSchemaReady as isGrowthAiDecisionRecordSchemaReady,
  probePlatformDecisionRecordSchema as probeGrowthAiDecisionRecordSchema,
} from "@fuzor/decision-records"

export {
  formatGrowthAiDecisionRecordSchemaNotReadyMessage,
  isGrowthAiDecisionRecordSchemaReady,
  probeGrowthAiDecisionRecordSchema,
}

export const GROWTH_AI_DECISION_RECORD_SCHEMA_HEALTH_QA_MARKER =
  "growth-aios-2d-decision-record-schema-health-v1" as const

export const GROWTH_AI_DECISION_RECORD_SCHEMA_OBJECTS =
  PLATFORM_DECISION_RECORD_SCHEMA_OBJECTS as unknown as GrowthSchemaObjectProbe[]

export type { PlatformDecisionRecordSchemaHealthSummary as GrowthSchemaHealthSummary } from "@fuzor/decision-records"
