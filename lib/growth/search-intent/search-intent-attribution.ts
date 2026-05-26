import type {
  GrowthSearchIntentAttribution,
  GrowthSearchIntentClassifiedSignal,
} from "@/lib/growth/search-intent/search-intent-types"

export function buildSearchIntentAttribution(
  signal: GrowthSearchIntentClassifiedSignal,
): GrowthSearchIntentAttribution[] {
  const entries: GrowthSearchIntentAttribution[] = [
    {
      source: "growth.search_intent_signals",
      section: "classification",
      signal: signal.intent_category,
      evidence: signal.evidence,
      confidence: signal.intent_strength === "high" ? 0.88 : signal.intent_strength === "medium" ? 0.72 : 0.5,
    },
  ]

  if (signal.source_type) {
    entries.push({
      source: "growth.search_intent_signals",
      section: "source_type",
      signal: signal.source_type,
      evidence: `Captured via ${signal.source_type}${signal.source_name ? ` (${signal.source_name})` : ""}.`,
      confidence: signal.source_type === "utm_keyword" ? 0.9 : 0.65,
    })
  }

  if (signal.matched_page_path) {
    entries.push({
      source: "growth.search_intent_signals",
      section: "page_path",
      signal: "matched_path",
      evidence: signal.matched_page_path,
      confidence: 0.7,
    })
  }

  return entries
}

export function attachAttributionToSignals(
  signals: GrowthSearchIntentClassifiedSignal[],
): GrowthSearchIntentClassifiedSignal[] {
  return signals.map((signal) => ({
    ...signal,
    source_attribution: buildSearchIntentAttribution(signal),
  }))
}
