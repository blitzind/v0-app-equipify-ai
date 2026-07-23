/** GE-AIOS-2D — Decision Record types (client-safe). Delegates to @fuzor/decision-records. */

import type { AiWorkOrderAgent } from "@/lib/growth/aios/ai-work-order-types"
import {
  PLATFORM_DECISION_RECORD_LIFECYCLE_EVENTS,
  PLATFORM_DECISION_RECORD_QA_MARKER,
  PLATFORM_DECISION_RECORD_RUNTIME_RULE,
  PLATFORM_DECISION_RECORD_SCHEMA_MIGRATION,
  PLATFORM_DECISION_RECORD_SCHEMA_VERSION,
  clampDecisionConfidence,
  clampDecisionRiskScore,
  isPlatformDecisionOwnerAgent,
  normalizeChosenAction,
  normalizeDecisionActions,
  normalizeEvidenceBundle,
} from "@fuzor/decision-records"

export type {
  PlatformDecisionActionRef as AiDecisionActionRef,
  PlatformDecisionEvidenceRef as AiDecisionEvidenceRef,
  PlatformDecisionRecord as AiDecisionRecord,
  PlatformDecisionRecordAuditEvent as AiDecisionRecordAuditEvent,
  PlatformDecisionRecordCreateInput as AiDecisionRecordCreateInput,
  PlatformDecisionRecordLifecycleEvent as AiDecisionRecordLifecycleEvent,
  PlatformDecisionRecordLinkInput as AiDecisionRecordLinkInput,
  PlatformDecisionRecordListFilter as AiDecisionRecordListFilter,
  PlatformDecisionRecordSupersedeInput as AiDecisionRecordSupersedeInput,
} from "@fuzor/decision-records"

export const GROWTH_AIOS_2D_PHASE = "GE-AIOS-2D" as const

export const GROWTH_AI_DECISION_RECORD_QA_MARKER = PLATFORM_DECISION_RECORD_QA_MARKER
export const GROWTH_AI_DECISION_RECORD_SCHEMA_MIGRATION = PLATFORM_DECISION_RECORD_SCHEMA_MIGRATION
export const AI_DECISION_RECORD_SCHEMA_VERSION = PLATFORM_DECISION_RECORD_SCHEMA_VERSION
export const AI_DECISION_RECORD_LIFECYCLE_EVENTS = PLATFORM_DECISION_RECORD_LIFECYCLE_EVENTS
export const AI_DECISION_RECORD_RUNTIME_RULE = PLATFORM_DECISION_RECORD_RUNTIME_RULE

export {
  clampDecisionConfidence,
  clampDecisionRiskScore,
  normalizeChosenAction,
  normalizeDecisionActions,
  normalizeEvidenceBundle,
}

export function isAiDecisionOwnerAgent(value: unknown): value is AiWorkOrderAgent {
  return isPlatformDecisionOwnerAgent(value)
}
