import type {
  GrowthNormalizedSignalDraft,
  GrowthSignalEvidenceDraft,
} from "@/lib/growth/signals/signal-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function hasUsableEvidenceEntry(entry: GrowthSignalEvidenceDraft): boolean {
  const excerpt = asString(entry.excerpt)
  const sourceUrl = asString(entry.source_url)
  return excerpt.length > 0 || sourceUrl.length > 0
}

export function validateSignalEvidenceRequired(
  draft: Pick<GrowthNormalizedSignalDraft, "evidence">,
): string | null {
  if (!Array.isArray(draft.evidence) || draft.evidence.length === 0) {
    return "At least one evidence entry is required."
  }
  for (const entry of draft.evidence) {
    if (!hasUsableEvidenceEntry(entry)) {
      return "Each evidence entry requires excerpt or source_url."
    }
  }
  return null
}

export function buildSignalEvidenceSummary(
  draft: Pick<GrowthNormalizedSignalDraft, "signal_type" | "company_name" | "domain" | "evidence">,
): string {
  const primary = draft.evidence[0]
  const company = asString(draft.company_name) || asString(draft.domain) || "Unknown company"
  const excerpt = asString(primary?.excerpt)
  const url = asString(primary?.source_url)
  const publisher = asString(primary?.publisher)

  if (excerpt) {
    const clipped = excerpt.length > 180 ? `${excerpt.slice(0, 177)}…` : excerpt
    return `${draft.signal_type}: ${company} — ${clipped}`
  }
  if (url) {
    return `${draft.signal_type}: ${company} — source ${url}`
  }
  if (publisher) {
    return `${draft.signal_type}: ${company} — ${publisher}`
  }
  return `${draft.signal_type}: ${company} — evidence on file`
}

export function sanitizeEvidenceForApi(
  entries: GrowthSignalEvidenceDraft[],
): GrowthSignalEvidenceDraft[] {
  return entries.map((entry) => ({
    source_type: entry.source_type,
    source_label: asString(entry.source_label) || undefined,
    source_url: asString(entry.source_url) || null,
    publisher: asString(entry.publisher) || null,
    excerpt: asString(entry.excerpt),
    observed_at: entry.observed_at,
    confidence_score:
      typeof entry.confidence_score === "number" ? entry.confidence_score : undefined,
  }))
}
