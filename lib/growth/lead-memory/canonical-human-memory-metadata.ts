/** GE-AIOS-MEMORY-RESOLVER-1A — Memory event metadata helpers (client-safe). */

import type { HumanMemoryKind } from "@/lib/growth/lead-memory/canonical-human-memory-types"
import type { GrowthLeadMemoryCategory } from "@/lib/growth/lead-memory/memory-types"

export const HUMAN_MEMORY_KIND_METADATA_KEY = "human_memory_kind" as const
export const MEMORY_FINGERPRINT_METADATA_KEY = "fingerprint" as const
export const MEMORY_SUPERSEDES_EVENT_ID_KEY = "supersedes_event_id" as const
export const MEMORY_EVOLUTION_CHAIN_ID_KEY = "evolution_chain_id" as const
export const MEMORY_OPERATOR_STATUS_KEY = "operator_status" as const
export const MEMORY_OPERATOR_OVERRIDE_KEY = "operator_override_conclusion" as const
export const MEMORY_PINNED_KEY = "pinned" as const
export const MEMORY_PROTECTED_KEY = "protected" as const
export const MEMORY_CONFIRMATION_COUNT_KEY = "confirmation_count" as const
export const MEMORY_LAST_CONFIRMED_AT_KEY = "last_confirmed_at" as const
export const MEMORY_FRESHNESS_EXPIRES_AT_KEY = "freshness_expires_at" as const
export const MEMORY_WHY_IT_MATTERS_KEY = "why_it_matters" as const
export const MEMORY_CANONICAL_ENTITY_LABEL_KEY = "canonical_entity_label" as const
export const MEMORY_SUPERSEDED_KEY = "superseded" as const
export const VOICE_BRIDGE_SOURCE_SYSTEM = "voice_memory_bridge_v1" as const

/** Map human kinds to DB-safe categories (existing CHECK constraint). */
export function storageCategoryForHumanKind(kind: HumanMemoryKind): GrowthLeadMemoryCategory {
  switch (kind) {
    case "business_fact":
      return "industry_interest"
    case "personal_context":
      return "engagement_pattern"
    case "communication_style":
      return "communication_preference"
    case "sales_conclusion":
      return "buying_signal"
    case "action_commitment":
      return "meeting_signal"
  }
}

export {
  resolveAuthoritativeHumanMemoryKind,
  resolveAuthoritativeHumanMemoryKind as inferHumanMemoryKindFromEvent,
} from "@/lib/growth/lead-memory/canonical-human-memory-semantics"

export const MEMORY_ORIGINAL_CONCLUSION_KEY = "original_conclusion" as const
export const MEMORY_ORIGINAL_EVIDENCE_KEY = "original_evidence_snippet" as const
export const MEMORY_OPERATOR_DECISION_AT_KEY = "operator_decision_at" as const
export const MEMORY_OPERATOR_DECISION_BY_KEY = "operator_decision_by" as const
export const MEMORY_MERGED_SOURCE_EVENT_IDS_KEY = "merged_source_event_ids" as const
export const MEMORY_MERGED_INTO_EVENT_ID_KEY = "merged_into_event_id" as const
export const MEMORY_OPERATOR_DECISION_IDEMPOTENCY_KEY = "operator_decision_idempotency" as const

export function isOperatorControlledMemoryMetadata(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false
  const status = metadata[MEMORY_OPERATOR_STATUS_KEY]
  return (
    status === "approved" ||
    status === "corrected" ||
    status === "protected" ||
    status === "pinned" ||
    status === "deleted" ||
    typeof metadata[MEMORY_OPERATOR_OVERRIDE_KEY] === "string"
  )
}

export function isHumanMemoryKind(value: string): value is HumanMemoryKind {
  return (
    value === "business_fact" ||
    value === "personal_context" ||
    value === "communication_style" ||
    value === "sales_conclusion" ||
    value === "action_commitment"
  )
}

export function personalContextFreshnessExpiresAt(recordedAt: string): string {
  const expires = Date.parse(recordedAt) + 90 * 86400000
  return new Date(expires).toISOString()
}

export function buildMemoryFingerprint(input: {
  leadId: string
  humanMemoryKind: HumanMemoryKind
  conclusion: string
}): string {
  const normalized = input.conclusion.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120)
  return `${input.leadId}:${input.humanMemoryKind}:${normalized}`
}
