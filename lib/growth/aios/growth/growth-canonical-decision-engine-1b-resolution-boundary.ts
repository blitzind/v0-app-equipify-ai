/**
 * GE-AIOS-PRODUCTION-VALIDATION-1B — Stable canonical decision resolution boundary (client-safe).
 * Fingerprints and cache keys must not drift on wall-clock alone for unchanged source state.
 */

import type { CanonicalHumanMemoryBundle } from "@/lib/growth/lead-memory/canonical-human-memory-types"

export const CANONICAL_DECISION_STATE_BOUNDARY_SENTINEL =
  "ge-aios-decision-state-boundary:v1" as const

export const GROWTH_AIOS_CANONICAL_DECISION_RESOLUTION_BOUNDARY_QA_MARKER =
  "ge-aios-canonical-decision-resolution-boundary-v1" as const

function finiteParse(value: string | null | undefined): number | null {
  if (!value?.trim()) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Material timestamps only — never wall-clock. */
export function resolveCanonicalDecisionGeneratedAtBoundary(input: {
  packagePreparedAt?: string | null
  latestReplyAt?: string | null
  latestMeetingAt?: string | null
  storedClosureAt?: string | null
  leadUpdatedAt?: string | null
  materialEventAt?: string | null
}): string {
  const stamps = [
    input.packagePreparedAt,
    input.latestReplyAt,
    input.latestMeetingAt,
    input.storedClosureAt,
    input.leadUpdatedAt,
    input.materialEventAt,
  ]
    .map(finiteParse)
    .filter((ms): ms is number => ms != null)

  if (stamps.length === 0) return CANONICAL_DECISION_STATE_BOUNDARY_SENTINEL
  return new Date(Math.max(...stamps)).toISOString()
}

/** Evaluation instant for wait/meeting windows — stable when boundary is sentinel. */
export function resolveCanonicalDecisionEvaluationInstantMs(
  generatedAtBoundary: string,
  materialTimestamps: Array<string | null | undefined>,
): number {
  if (generatedAtBoundary !== CANONICAL_DECISION_STATE_BOUNDARY_SENTINEL) {
    const parsed = finiteParse(generatedAtBoundary)
    if (parsed != null) return parsed
  }

  const material = materialTimestamps.map(finiteParse).filter((ms): ms is number => ms != null)
  if (material.length > 0) return Math.max(...material)
  return 0
}

export function buildStableCanonicalMemoryVersionKey(
  memoryBundle: CanonicalHumanMemoryBundle | null,
): string {
  if (!memoryBundle) return "none"

  const recordIds = [
    ...memoryBundle.business.records,
    ...memoryBundle.personal.records,
    ...memoryBundle.relationship.records,
    ...memoryBundle.sales.records,
    ...memoryBundle.actions.records,
  ]
    .filter((row) => !row.superseded && row.operatorStatus !== "deleted")
    .map((row) => row.id)
    .sort()

  const tail = recordIds.slice(-8).join("|") || "empty"
  return [
    memoryBundle.freshness.totalActiveRecords,
    memoryBundle.freshness.operatorApprovedCount,
    memoryBundle.packageSnapshot?.preparedAt ?? "no-package",
    tail,
  ].join(":")
}
