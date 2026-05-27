import type {
  GrowthNormalizedSignalDraft,
  GrowthSignalEvidenceDraft,
  GrowthSignalType,
} from "@/lib/growth/signals/signal-types"
import { GROWTH_SIGNAL_TYPES } from "@/lib/growth/signals/signal-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNullableString(value: unknown): string | null {
  const text = asString(value)
  return text || null
}

function parseEvidence(raw: unknown): GrowthSignalEvidenceDraft[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const row = entry as Record<string, unknown>
      const excerpt = asString(row.excerpt)
      const sourceUrl = asNullableString(row.source_url)
      if (!excerpt && !sourceUrl) return null
      return {
        source_type: (asString(row.source_type) || "manual") as GrowthSignalEvidenceDraft["source_type"],
        source_label: asString(row.source_label) || undefined,
        source_url: sourceUrl,
        publisher: asNullableString(row.publisher),
        excerpt,
        observed_at: asString(row.observed_at) || undefined,
        confidence_score:
          typeof row.confidence_score === "number" ? row.confidence_score : undefined,
        metadata:
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : undefined,
      }
    })
    .filter((entry): entry is GrowthSignalEvidenceDraft => entry !== null)
}

export function isGrowthSignalType(value: unknown): value is GrowthSignalType {
  return typeof value === "string" && GROWTH_SIGNAL_TYPES.includes(value as GrowthSignalType)
}

export function normalizeSignalDraft(raw: unknown): GrowthNormalizedSignalDraft | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const signalType = asString(row.signal_type)
  if (!isGrowthSignalType(signalType)) return null

  const occurredAt = asString(row.occurred_at)
  if (!occurredAt) return null

  const evidence = parseEvidence(row.evidence)
  if (evidence.length === 0) return null

  return {
    organization_id: asNullableString(row.organization_id),
    signal_type: signalType,
    provider_key: asString(row.provider_key) || "manual_import",
    provider_event_id: asNullableString(row.provider_event_id),
    occurred_at: occurredAt,
    detected_at: asString(row.detected_at) || undefined,
    expires_at: asNullableString(row.expires_at),
    company_id: asNullableString(row.company_id),
    company_name: asString(row.company_name),
    domain: asNullableString(row.domain),
    contact_id: asNullableString(row.contact_id),
    contact_display_label: asNullableString(row.contact_display_label),
    title: asNullableString(row.title),
    previous_title: asNullableString(row.previous_title),
    seniority: asNullableString(row.seniority),
    geography: asNullableString(row.geography),
    industry: asNullableString(row.industry),
    category: asNullableString(row.category),
    evidence,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
    raw_payload: row.raw_payload,
  }
}
