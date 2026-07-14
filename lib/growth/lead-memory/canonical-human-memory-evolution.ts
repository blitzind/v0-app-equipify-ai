/** GE-AIOS-MEMORY-RESOLVER-1A — Memory evolution, dedup, and current-conclusion resolution (client-safe). */

import {
  buildMemoryFingerprint,
  HUMAN_MEMORY_KIND_METADATA_KEY,
  resolveAuthoritativeHumanMemoryKind,
  MEMORY_CONFIRMATION_COUNT_KEY,
  MEMORY_FRESHNESS_EXPIRES_AT_KEY,
  MEMORY_LAST_CONFIRMED_AT_KEY,
  MEMORY_OPERATOR_OVERRIDE_KEY,
  MEMORY_OPERATOR_STATUS_KEY,
  MEMORY_PINNED_KEY,
  MEMORY_PROTECTED_KEY,
  MEMORY_SUPERSEDED_KEY,
  MEMORY_WHY_IT_MATTERS_KEY,
  MEMORY_CANONICAL_ENTITY_LABEL_KEY,
} from "@/lib/growth/lead-memory/canonical-human-memory-metadata"
import type { CanonicalMemoryRecord, HumanMemoryKind } from "@/lib/growth/lead-memory/canonical-human-memory-types"
import {
  confidenceRank,
  type GrowthLeadMemoryEvent,
  type GrowthLeadMemoryProfileView,
  type GrowthMemoryConfidence,
} from "@/lib/growth/lead-memory/memory-types"

const MIN_SURFACED_CONFIDENCE: GrowthMemoryConfidence = "medium"

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function isExpired(freshnessExpiresAt: string | null, nowMs: number): boolean {
  if (!freshnessExpiresAt) return false
  const expires = Date.parse(freshnessExpiresAt)
  return Number.isFinite(expires) && expires <= nowMs
}

function shouldSurfaceRecord(record: CanonicalMemoryRecord, nowMs: number): boolean {
  if (record.superseded || record.operatorStatus === "deleted") return false
  if (
    record.operatorStatus === "protected" ||
    record.operatorStatus === "pinned" ||
    record.operatorStatus === "approved" ||
    record.operatorStatus === "corrected"
  ) {
    return true
  }
  if (record.pinned || record.protected) return true
  if (record.humanMemoryKind === "personal_context" && isExpired(record.freshnessExpiresAt, nowMs)) {
    return false
  }
  if (confidenceRank(record.confidence) < confidenceRank(MIN_SURFACED_CONFIDENCE)) {
    return false
  }
  return true
}

export function mapProfileEventToCanonicalRecord(
  event: GrowthLeadMemoryEvent & { metadata?: Record<string, unknown> },
  identityCompanyLabel: string | null,
): CanonicalMemoryRecord {
  const metadata = metaRecord(event.metadata)
  const humanMemoryKind = resolveAuthoritativeHumanMemoryKind({
    memoryCategory: event.memoryCategory,
    title: event.title,
    metadata,
  })
  const operatorOverride = asString(metadata[MEMORY_OPERATOR_OVERRIDE_KEY])
  const conclusion = operatorOverride ?? event.title

  return {
    id: event.id,
    conclusion,
    humanMemoryKind,
    memoryCategory: event.memoryCategory,
    confidence: event.confidence,
    sourceSystem: event.sourceSystem,
    recordedAt: event.recordedAt,
    lastConfirmedAt: asString(metadata[MEMORY_LAST_CONFIRMED_AT_KEY]) ?? event.recordedAt,
    confirmationCount: Math.max(1, asNumber(metadata[MEMORY_CONFIRMATION_COUNT_KEY], 1)),
    freshnessExpiresAt: asString(metadata[MEMORY_FRESHNESS_EXPIRES_AT_KEY]),
    operatorStatus:
      (asString(metadata[MEMORY_OPERATOR_STATUS_KEY]) as CanonicalMemoryRecord["operatorStatus"]) ?? "pending",
    superseded: metadata[MEMORY_SUPERSEDED_KEY] === true,
    pinned: metadata[MEMORY_PINNED_KEY] === true,
    protected: metadata[MEMORY_PROTECTED_KEY] === true,
    whyItMatters: asString(metadata[MEMORY_WHY_IT_MATTERS_KEY]),
    canonicalEntityLabel: asString(metadata[MEMORY_CANONICAL_ENTITY_LABEL_KEY]) ?? identityCompanyLabel,
  }
}

export function resolveCurrentConclusions(
  records: CanonicalMemoryRecord[],
  nowMs = Date.now(),
): {
  active: CanonicalMemoryRecord[]
  suppressedLowConfidence: number
  expiredPersonal: number
} {
  const byFingerprint = new Map<string, CanonicalMemoryRecord>()
  let suppressedLowConfidence = 0
  let expiredPersonal = 0

  const sorted = [...records].sort(
    (left, right) => Date.parse(right.lastConfirmedAt ?? right.recordedAt) - Date.parse(left.lastConfirmedAt ?? left.recordedAt),
  )

  for (const record of sorted) {
    if (!shouldSurfaceRecord(record, nowMs)) {
      if (record.humanMemoryKind === "personal_context" && isExpired(record.freshnessExpiresAt, nowMs)) {
        expiredPersonal += 1
      } else if (confidenceRank(record.confidence) < confidenceRank(MIN_SURFACED_CONFIDENCE)) {
        suppressedLowConfidence += 1
      }
      continue
    }

    const fingerprint =
      record.humanMemoryKind != null
        ? buildMemoryFingerprint({
            leadId: "lead",
            humanMemoryKind: record.humanMemoryKind,
            conclusion: record.conclusion,
          }).replace(/^lead:/, "")
        : `${record.memoryCategory}:${record.conclusion.toLowerCase()}`

    const existing = byFingerprint.get(fingerprint)
    if (!existing || confidenceRank(record.confidence) >= confidenceRank(existing.confidence)) {
      byFingerprint.set(fingerprint, record)
    }
  }

  return {
    active: [...byFingerprint.values()],
    suppressedLowConfidence,
    expiredPersonal,
  }
}

export function buildCanonicalRecordsFromProfileView(
  view: GrowthLeadMemoryProfileView | null | undefined,
  identityCompanyLabel: string | null,
): CanonicalMemoryRecord[] {
  if (!view) return []
  const eventRecords = (view.events ?? []).map((event) =>
    mapProfileEventToCanonicalRecord(event as GrowthLeadMemoryEvent & { metadata?: Record<string, unknown> }, identityCompanyLabel),
  )

  const objectionRecords: CanonicalMemoryRecord[] = (view.objections ?? [])
    .filter((row) => !row.resolved)
    .map((row) => ({
      id: row.id,
      conclusion: row.objectionLabel,
      humanMemoryKind: "sales_conclusion" as HumanMemoryKind,
      memoryCategory: "objection",
      confidence: row.confidence,
      sourceSystem: "lead_objection_memory",
      recordedAt: row.lastSeenAt,
      lastConfirmedAt: row.lastSeenAt,
      confirmationCount: row.occurrenceCount,
      freshnessExpiresAt: null,
      operatorStatus: "pending",
      superseded: false,
      pinned: false,
      protected: false,
      whyItMatters: "Unresolved objection influences next conversation.",
      canonicalEntityLabel: identityCompanyLabel,
    }))

  const preferenceRecords: CanonicalMemoryRecord[] = (view.preferences ?? []).map((row) => ({
    id: row.id,
    conclusion: `${row.preferenceType.replace(/_/g, " ")}: ${row.preferenceValue}`,
    humanMemoryKind: "communication_style" as HumanMemoryKind,
    memoryCategory: "communication_preference",
    confidence: row.confidence,
    sourceSystem: "lead_preference_memory",
    recordedAt: new Date().toISOString(),
    lastConfirmedAt: new Date().toISOString(),
    confirmationCount: 1,
    freshnessExpiresAt: null,
    operatorStatus: "pending",
    superseded: false,
    pinned: false,
    protected: false,
    whyItMatters: "Shapes how Ava should approach this contact.",
    canonicalEntityLabel: identityCompanyLabel,
  }))

  return [...eventRecords, ...objectionRecords, ...preferenceRecords]
}
