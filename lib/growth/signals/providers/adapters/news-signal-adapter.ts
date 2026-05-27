import type { GrowthSignalProvider } from "@/lib/growth/signals/providers/signal-provider-types"
import {
  classifyNewsSignalCategory,
  type GrowthNewsSignalCategory,
} from "@/lib/growth/signals/news-signal-categories"
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

export type NewsManualInputItem = {
  headline?: string
  title?: string
  source_url?: string
  url?: string
  publisher?: string
  source_label?: string
  published_at?: string
  occurred_at?: string
  company_name?: string
  domain?: string
  excerpt?: string
  snippet?: string
  geography?: string
  country?: string
  category?: string
  provider_event_id?: string
}

/**
 * Normalize one news queue item into a signal draft.
 * Returns null when required evidence (source URL) is missing — never fabricates data.
 */
export function normalizeNewsManualItem(raw: unknown): GrowthNormalizedSignalDraft | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as NewsManualInputItem

  const headline = asString(row.headline) || asString(row.title)
  const sourceUrl = asString(row.source_url) || asString(row.url)
  if (!isHttpUrl(sourceUrl)) return null

  const excerpt = asString(row.excerpt) || asString(row.snippet) || headline
  const publisher = asNullableString(row.publisher) || asNullableString(row.source_label)
  const occurredAt = parseOccurredAt(row.published_at) ?? parseOccurredAt(row.occurred_at) ?? new Date().toISOString()
  const companyName = asNullableString(row.company_name)
  const domain = asNullableString(row.domain)
  const geography = asNullableString(row.geography) || asNullableString(row.country)

  const explicitCategory = asString(row.category).toLowerCase()
  const category: GrowthNewsSignalCategory =
    explicitCategory &&
    (
      [
        "funding",
        "acquisition",
        "leadership",
        "expansion",
        "layoffs",
        "compliance",
        "product_launch",
        "partnership",
        "general",
      ] as const
    ).includes(explicitCategory as GrowthNewsSignalCategory)
      ? (explicitCategory as GrowthNewsSignalCategory)
      : classifyNewsSignalCategory({ headline, excerpt })

  const evidence: GrowthSignalEvidenceDraft[] = [
    {
      source_type: "press_news",
      source_label: publisher ?? "news_manual",
      source_url: sourceUrl,
      publisher,
      excerpt,
      observed_at: occurredAt,
    },
  ]

  return {
    signal_type: "news_event",
    provider_key: "news_manual",
    provider_event_id: asNullableString(row.provider_event_id),
    occurred_at: occurredAt,
    company_name: companyName ?? "",
    domain,
    geography,
    category,
    title: headline || null,
    evidence,
    metadata: {
      news_provider: "news_manual",
      publisher: publisher ?? null,
    },
    raw_payload: row,
  }
}

export function createNewsManualSignalAdapter(): GrowthSignalProvider {
  return {
    provider_key: "news_manual",
    display_name: "News (manual / RSS-style input)",
    status: "active",
    supported_signal_types: ["news_event"],
    isConfigured() {
      return true
    },
    normalize(raw: unknown): GrowthNormalizedSignalDraft[] {
      return asArray(raw)
        .map((entry) => normalizeNewsManualItem(entry))
        .filter((draft): draft is GrowthNormalizedSignalDraft => draft !== null)
    },
    extractEvidence(raw: unknown): GrowthSignalEvidenceDraft[] {
      return this.normalize(raw).flatMap((draft) => draft.evidence)
    },
    computeProviderConfidence(draft: GrowthNormalizedSignalDraft): number {
      const hasUrl = draft.evidence.some((entry) => Boolean(entry.source_url?.trim()))
      const hasHeadline = Boolean(draft.title?.trim())
      const hasCompany = Boolean(draft.company_name?.trim() || draft.domain?.trim())
      if (hasUrl && hasHeadline && hasCompany) return 0.9
      if (hasUrl && hasHeadline) return 0.8
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
          provider_key: "news_manual",
          drafts: [],
          message: "news_manual requires cursor.sample_input with one or more news items.",
        }
      }

      const drafts = this.normalize(sample)
      if (drafts.length === 0) {
        return {
          ok: false,
          status: "failed",
          provider_key: "news_manual",
          drafts: [],
          message: "No valid news items — each item requires a source URL.",
        }
      }

      return {
        ok: true,
        status: "completed",
        provider_key: "news_manual",
        drafts,
      }
    },
  }
}
