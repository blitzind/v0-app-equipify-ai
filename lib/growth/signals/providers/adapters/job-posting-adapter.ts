import type { GrowthSignalProvider } from "@/lib/growth/signals/providers/signal-provider-types"
import {
  classifyHiringIntentIndicators,
  classifyJobDepartment,
  classifyJobOperationalRelevance,
  classifyJobRoleFamily,
} from "@/lib/growth/signals/job-signal-classification"
import type {
  GrowthNormalizedSignalDraft,
  GrowthSignalEvidenceDraft,
} from "@/lib/growth/signals/signal-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNullableString(value: unknown): string | null {
  const text = asString(value)
  return text || null
}

function asArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === "object") return [raw]
  return []
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function parseOccurredAt(raw: unknown): string | null {
  const text = asString(raw)
  if (!text) return null
  const ms = Date.parse(text)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

export type JobPostingManualInputItem = {
  title?: string
  company_name?: string
  domain?: string
  department?: string
  location?: string
  employment_type?: string
  posted_at?: string
  occurred_at?: string
  source_url?: string
  url?: string
  publisher?: string
  excerpt?: string
  snippet?: string
  provider_event_id?: string
}

/**
 * Normalize one job posting queue item into a signal draft.
 * Returns null when required evidence (source URL, title, company/domain) is missing.
 */
export function normalizeJobPostingManualItem(raw: unknown): GrowthNormalizedSignalDraft | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as JobPostingManualInputItem

  const title = asString(row.title)
  const sourceUrl = asString(row.source_url) || asString(row.url)
  const companyName = asNullableString(row.company_name)
  const domain = asNullableString(row.domain)

  if (!title || !isHttpUrl(sourceUrl)) return null
  if (!companyName && !domain) return null

  const excerpt = asString(row.excerpt) || asString(row.snippet) || title
  const publisher = asNullableString(row.publisher)
  const location = asNullableString(row.location)
  const employmentType = asNullableString(row.employment_type)
  const occurredAt = parseOccurredAt(row.posted_at) ?? parseOccurredAt(row.occurred_at) ?? new Date().toISOString()

  const department = classifyJobDepartment({
    title,
    department: row.department,
    excerpt,
  })
  const roleFamily = classifyJobRoleFamily({ title, excerpt })
  const operationalRelevance = classifyJobOperationalRelevance({ department, title, excerpt })
  const hiringIntentIndicators = classifyHiringIntentIndicators({
    title,
    department: row.department,
    excerpt,
    location,
  })

  const evidence: GrowthSignalEvidenceDraft[] = [
    {
      source_type: "job_posting",
      source_label: publisher ?? "job_posting_manual",
      source_url: sourceUrl,
      publisher,
      excerpt,
      observed_at: occurredAt,
    },
  ]

  return {
    signal_type: "job_posting",
    provider_key: "job_posting_manual",
    provider_event_id: asNullableString(row.provider_event_id),
    occurred_at: occurredAt,
    company_name: companyName ?? "",
    domain,
    geography: location,
    category: department,
    title,
    evidence,
    metadata: {
      job_provider: "job_posting_manual",
      publisher: publisher ?? null,
      source_url: sourceUrl,
      department,
      role_family: roleFamily,
      operational_relevance: operationalRelevance,
      hiring_intent_indicators: hiringIntentIndicators,
      employment_type: employmentType,
      location: location ?? null,
      company_linkage: {
        company_name: companyName ?? null,
        domain: domain ?? null,
      },
    },
    raw_payload: row,
  }
}

export function createJobPostingManualSignalAdapter(): GrowthSignalProvider {
  return {
    provider_key: "job_posting_manual",
    display_name: "Job postings (manual input)",
    status: "active",
    supported_signal_types: ["job_posting"],
    isConfigured() {
      return true
    },
    normalize(raw: unknown): GrowthNormalizedSignalDraft[] {
      return asArray(raw)
        .map((entry) => normalizeJobPostingManualItem(entry))
        .filter((draft): draft is GrowthNormalizedSignalDraft => draft !== null)
    },
    extractEvidence(raw: unknown): GrowthSignalEvidenceDraft[] {
      return this.normalize(raw).flatMap((draft) => draft.evidence)
    },
    computeProviderConfidence(draft: GrowthNormalizedSignalDraft): number {
      const hasUrl = draft.evidence.some((entry) => Boolean(entry.source_url?.trim()))
      const hasTitle = Boolean(draft.title?.trim())
      const hasCompany = Boolean(draft.company_name?.trim() || draft.domain?.trim())
      if (hasUrl && hasTitle && hasCompany) return 0.92
      if (hasUrl && hasTitle) return 0.82
      if (hasUrl) return 0.7
      return 0.4
    },
    async poll(context) {
      const sample =
        context.sample_input ??
        (context.cursor && typeof context.cursor === "object"
          ? (context.cursor as Record<string, unknown>).sample_input
          : undefined)

      if (!sample) {
        return {
          ok: true,
          status: "skipped",
          provider_key: "job_posting_manual",
          drafts: [],
          message: "job_posting_manual requires cursor.sample_input with one or more job posting items.",
        }
      }

      const drafts = this.normalize(sample)
      if (drafts.length === 0) {
        return {
          ok: false,
          status: "failed",
          provider_key: "job_posting_manual",
          drafts: [],
          message: "No valid job postings — each item requires title, source URL, and company or domain.",
        }
      }

      return {
        ok: true,
        status: "completed",
        provider_key: "job_posting_manual",
        drafts,
      }
    },
  }
}
