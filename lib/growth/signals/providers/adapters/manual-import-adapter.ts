import type { GrowthSignalProvider } from "@/lib/growth/signals/providers/signal-provider-types"
import { normalizeSignalDraft } from "@/lib/growth/signals/signal-normalizer"
import type {
  GrowthNormalizedSignalDraft,
  GrowthSignalEvidenceDraft,
} from "@/lib/growth/signals/signal-types"

function asArray(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

export function createManualImportSignalAdapter(): GrowthSignalProvider {
  return {
    provider_key: "manual_import",
    display_name: "Manual import",
    status: "active",
    supported_signal_types: [
      "manual_signal",
      "news_event",
      "job_posting",
      "job_change",
      "promotion",
      "hire",
      "tech_install",
      "funding_event",
    ],
    isConfigured() {
      return true
    },
    normalize(raw: unknown): GrowthNormalizedSignalDraft[] {
      return asArray(raw)
        .map((entry) => normalizeSignalDraft(entry))
        .filter((draft): draft is GrowthNormalizedSignalDraft => draft !== null)
        .map((draft) => ({
          ...draft,
          provider_key: "manual_import",
        }))
    },
    extractEvidence(raw: unknown): GrowthSignalEvidenceDraft[] {
      return this.normalize(raw).flatMap((draft) => draft.evidence)
    },
    computeProviderConfidence(draft: GrowthNormalizedSignalDraft): number {
      const hasUrl = draft.evidence.some((entry) => Boolean(entry.source_url?.trim()))
      const hasExcerpt = draft.evidence.some((entry) => Boolean(entry.excerpt?.trim()))
      if (hasUrl && hasExcerpt) return 0.85
      if (hasUrl || hasExcerpt) return 0.7
      return 0.4
    },
    async poll(context) {
      if (!context.sample_input) {
        return {
          ok: true,
          status: "skipped",
          provider_key: "manual_import",
          drafts: [],
          message: "Manual import requires operator-provided sample_input.",
        }
      }

      const drafts = this.normalize(context.sample_input)
      if (drafts.length === 0) {
        return {
          ok: false,
          status: "failed",
          provider_key: "manual_import",
          drafts: [],
          message: "Manual import sample_input could not be normalized.",
        }
      }

      return {
        ok: true,
        status: "completed",
        provider_key: "manual_import",
        drafts,
      }
    },
  }
}
