/** Pure Prospect Search growth signal overlay helpers. Client-safe. */

import type { GrowthCompanyGrowthSignalsSnapshot } from "@/lib/growth/company-growth-signals/company-growth-signal-types"
import { finalizeProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-result-finalize"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export function applyGrowthSignalsToCompanyResult(
  company: GrowthProspectSearchCompanyResult,
  snapshot: GrowthCompanyGrowthSignalsSnapshot | null | undefined,
): GrowthProspectSearchCompanyResult {
  if (!snapshot?.schema_ready || !snapshot.score) return company

  const topSignal = snapshot.score.top_signals[0]
  const growthIndicators = snapshot.score.top_signals.map((signal) => signal.signal_type.replace(/_/g, " "))
  const technologySignals = snapshot.signals
    .filter((signal) => signal.signal_type === "technology_change" || signal.signal_type === "competitor_detected")
    .map((signal) => signal.evidence_excerpt)
    .slice(0, 4)

  return finalizeProspectSearchCompanyResult({
    ...company,
    growth_signal_score: snapshot.score.growth_signal_score,
    growth_signal_tier: snapshot.score.signal_tier,
    growth_signal_recommended_action: snapshot.score.recommended_next_action,
    growth_signal_last_computed_at: snapshot.score.last_computed_at,
    company_signal_summary: company.company_signal_summary
      ? {
          ...company.company_signal_summary,
          growth_indicators: [
            ...new Set([...(company.company_signal_summary.growth_indicators ?? []), ...growthIndicators]),
          ].slice(0, 6),
          technology_signals: [
            ...new Set([...(company.company_signal_summary.technology_signals ?? []), ...technologySignals]),
          ].slice(0, 6),
          fit_indicators: topSignal
            ? [`Top signal: ${topSignal.signal_type.replace(/_/g, " ")}`]
            : company.company_signal_summary.fit_indicators,
        }
      : {
          technology_signals: technologySignals,
          growth_indicators: growthIndicators,
          operational_maturity: "Unknown",
          digital_maturity: "Unknown",
          field_service_maturity: "Unknown",
          fit_indicators: topSignal ? [`Top signal: ${topSignal.signal_type.replace(/_/g, " ")}`] : [],
        },
    signal_confidence: Math.max(company.signal_confidence ?? 0, snapshot.score.growth_signal_score / 100),
    signal_count: (company.signal_count ?? 0) + snapshot.signals.length,
  })
}
