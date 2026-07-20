/**
 * GE-AIOS-NEXT-3D — Operator decision → organizational memory event builders (client-safe).
 * Reuses growth.organization_memory_events via upsertOrganizationMemoryEvents — no duplicate store.
 */

import type { AvaMemoryEvent } from "@/lib/growth/memory/types"
import type { GrowthHomeAvaRecommendationKind } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import {
  GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_METADATA_KEYS,
  GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_PHASE,
  GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_TYPES,
  type GrowthHomeAvaOperatorDecisionType,
} from "./growth-home-ava-recommendation-accountability-next-3d-types"
import { GROWTH_AIOS_NEXT_3E_OPERATOR_DECISION_METADATA_KEYS } from "@/lib/growth/organizational-effectiveness/growth-organizational-learning-certification-next-3e-types"
import { resolveGrowthRecommendationTopic } from "./growth-home-ava-recommendation-topic-next-3e-types"

export const GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_API_PATH =
  "/api/platform/growth/home/recommendation-accountability/operator-decision" as const

function asDecisionType(value: string): GrowthHomeAvaOperatorDecisionType | null {
  return (GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_TYPES as readonly string[]).includes(value)
    ? (value as GrowthHomeAvaOperatorDecisionType)
    : null
}

export function buildGrowthHomeAvaOperatorDecisionIdempotencyKey(input: {
  organizationId: string
  decisionType: GrowthHomeAvaOperatorDecisionType
  recommendationTopic?: string | null
  recommendationKind?: GrowthHomeAvaRecommendationKind | null
  recommendationId?: string | null
  occurredAt?: string
}): string {
  const day = (input.occurredAt ?? new Date().toISOString()).slice(0, 10)
  return [
    "next-3d",
    input.organizationId,
    input.decisionType,
    input.recommendationTopic ?? "general",
    input.recommendationKind ?? "none",
    input.recommendationId ?? "none",
    day,
  ].join(":")
}

export function buildGrowthHomeAvaOperatorDecisionMemoryEvent(input: {
  organizationId: string
  decisionType: GrowthHomeAvaOperatorDecisionType
  summary: string
  recommendationTopic?: string | null
  recommendationKind?: GrowthHomeAvaRecommendationKind | null
  recommendationId?: string | null
  entityId?: string | null
  occurredAt?: string
  implementationAt?: string | null
  attributionWindowId?: string | null
  importance?: number
}): AvaMemoryEvent {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const implementationAt =
    input.implementationAt ??
    (input.decisionType === "package_approved" ||
    input.decisionType === "recommendation_accepted" ||
    input.decisionType === "objective_adopted"
      ? occurredAt
      : null)
  const idempotencyKey = buildGrowthHomeAvaOperatorDecisionIdempotencyKey({
    organizationId: input.organizationId,
    decisionType: input.decisionType,
    recommendationTopic: input.recommendationTopic,
    recommendationKind: input.recommendationKind,
    recommendationId: input.recommendationId,
    occurredAt,
  })

  const category =
    input.decisionType === "package_approved" || input.decisionType === "package_rejected"
      ? "approval"
      : "decision"

  const resolvedTopic =
    resolveGrowthRecommendationTopic({
      explicitTopic: input.recommendationTopic,
      recommendationKind: input.recommendationKind,
    }) ?? input.recommendationTopic ?? null

  return {
    id: idempotencyKey,
    category,
    timestamp: occurredAt,
    importance: input.importance ?? 4,
    organizationId: input.organizationId,
    entityType: input.decisionType.startsWith("package_") ? "approval" : "organization",
    entityId: input.entityId ?? input.recommendationId ?? input.organizationId,
    source: "workspace_summary",
    summary: input.summary.trim(),
    metadata: {
      [GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_METADATA_KEYS.decisionType]: input.decisionType,
      [GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_METADATA_KEYS.recommendationTopic]: resolvedTopic,
      [GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_METADATA_KEYS.recommendationKind]:
        input.recommendationKind ?? null,
      [GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_METADATA_KEYS.recommendationId]:
        input.recommendationId ?? null,
      [GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_METADATA_KEYS.idempotencyKey]: idempotencyKey,
      [GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_METADATA_KEYS.phase]:
        GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_PHASE,
      [GROWTH_AIOS_NEXT_3E_OPERATOR_DECISION_METADATA_KEYS.implementationAt]: implementationAt,
      [GROWTH_AIOS_NEXT_3E_OPERATOR_DECISION_METADATA_KEYS.attributionWindowId]:
        input.attributionWindowId ??
        (resolvedTopic && implementationAt ? `${resolvedTopic}:${implementationAt.slice(0, 10)}` : null),
      [GROWTH_AIOS_NEXT_3E_OPERATOR_DECISION_METADATA_KEYS.observationWindowStart]: implementationAt,
      outcome_type: input.decisionType,
    },
  }
}

export function parseGrowthHomeAvaOperatorDecisionFromMemoryEvent(
  event: AvaMemoryEvent,
): {
  decisionType: GrowthHomeAvaOperatorDecisionType
  recommendationTopic: string | null
  recommendationKind: GrowthHomeAvaRecommendationKind | null
} | null {
  const rawType =
    event.metadata[GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_METADATA_KEYS.decisionType] ??
    event.metadata.outcome_type
  const decisionType =
    typeof rawType === "string" ? asDecisionType(rawType) : null
  if (!decisionType) return null

  const topic = event.metadata[GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_METADATA_KEYS.recommendationTopic]
  const kind = event.metadata[GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_METADATA_KEYS.recommendationKind]

  return {
    decisionType,
    recommendationTopic: typeof topic === "string" && topic.trim() ? topic.trim() : null,
    recommendationKind:
      typeof kind === "string" ? (kind as GrowthHomeAvaRecommendationKind) : null,
  }
}

export function summarizeGrowthHomeAvaOperatorDecision(input: {
  decisionType: GrowthHomeAvaOperatorDecisionType
  recommendationTopic?: string | null
  recommendationKind?: GrowthHomeAvaRecommendationKind | null
}): string {
  const topic = input.recommendationTopic ? ` (${input.recommendationTopic})` : ""
  switch (input.decisionType) {
    case "recommendation_accepted":
      return `Operator accepted Ava recommendation${topic}.`
    case "recommendation_skipped":
      return `Operator skipped Ava recommendation${topic}.`
    case "recommendation_dismissed":
      return `Operator dismissed Ava recommendation${topic}.`
    case "recommendation_deferred":
      return `Operator deferred Ava recommendation${topic}.`
    case "strategic_override":
      return `Operator recorded a strategic override${topic}.`
    case "objective_adopted":
      return "Operator adopted a business objective recommendation."
    case "package_approved":
      return "Operator approved a prepared package."
    case "package_rejected":
      return "Operator rejected a prepared package."
    default:
      return "Operator recorded a durable decision event."
  }
}
