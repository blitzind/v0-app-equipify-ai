/**
 * GE-AIOS-MEMORY-RESOLVER-1B — Semantic authority for human memory kinds (client-safe).
 *
 * metadata.human_memory_kind → authoritative meaning
 * legacy memory_category      → storage compatibility / legacy queries only
 */

import {
  HUMAN_MEMORY_KIND_METADATA_KEY,
  isHumanMemoryKind,
} from "@/lib/growth/lead-memory/canonical-human-memory-metadata"
import type { HumanMemoryKind } from "@/lib/growth/lead-memory/canonical-human-memory-types"
import type { GrowthLeadMemoryCategory } from "@/lib/growth/lead-memory/memory-types"

export function resolveAuthoritativeHumanMemoryKind(input: {
  memoryCategory: GrowthLeadMemoryCategory
  title?: string
  metadata?: Record<string, unknown> | null
}): HumanMemoryKind | null {
  const fromMeta = input.metadata?.[HUMAN_MEMORY_KIND_METADATA_KEY]
  if (typeof fromMeta === "string" && isHumanMemoryKind(fromMeta)) {
    return fromMeta
  }

  // Legacy events without explicit human kind — infer conservatively without
  // treating storage categories as semantic truth.
  const title = (input.title ?? "").toLowerCase()
  if (input.memoryCategory === "objection") return "sales_conclusion"
  if (input.memoryCategory === "competitor_signal") return "business_fact"
  if (input.memoryCategory === "communication_preference") return "communication_style"
  if (/commitment|promised|due|checklist|follow-up|send the/i.test(title)) return "action_commitment"
  if (/family|surgery|personal|empathy|sensitivity/i.test(title)) return "personal_context"
  if (/software|incumbent|expansion|location|equipment/i.test(title)) return "business_fact"
  if (input.memoryCategory === "buying_signal") return "sales_conclusion"
  return null
}

export function humanMemoryKindsAreMergeCompatible(
  left: HumanMemoryKind | null,
  right: HumanMemoryKind | null,
): boolean {
  if (!left || !right) return false
  return left === right
}

export function isActionCommitmentKind(kind: HumanMemoryKind | null): boolean {
  return kind === "action_commitment"
}

export function isPersonalContextKind(kind: HumanMemoryKind | null): boolean {
  return kind === "personal_context"
}

export function isEngagementPatternCategoryOnly(
  kind: HumanMemoryKind | null,
  category: GrowthLeadMemoryCategory,
): boolean {
  return kind == null && category === "engagement_pattern"
}

export function isMeetingSignalCategoryOnly(
  kind: HumanMemoryKind | null,
  category: GrowthLeadMemoryCategory,
): boolean {
  return kind == null && category === "meeting_signal"
}
