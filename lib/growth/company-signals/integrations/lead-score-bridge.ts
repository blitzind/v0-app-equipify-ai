import type { GrowthCompanySignal } from "@/lib/growth/company-signals/company-signal-types"

/** Evidence-backed hints for lead score — no score mutation here. */
export function companySignalsToLeadScoreHints(signals: GrowthCompanySignal[]): {
  technology_fit: string[]
  operational_fit: string[]
  growth_fit: string[]
  max_confidence: number
} {
  const technology_fit = signals
    .filter((s) => s.signal_category === "technology" || s.signal_category === "field_service")
    .map((s) => s.signal_value)
  const operational_fit = signals
    .filter((s) => s.signal_category === "operations" || s.signal_category === "service_model")
    .map((s) => s.signal_value)
  const growth_fit = signals
    .filter((s) => ["growth", "staffing", "digital_presence"].includes(s.signal_category))
    .map((s) => s.signal_value)
  const max_confidence =
    signals.length > 0 ? Math.max(...signals.map((s) => s.confidence)) : 0

  return { technology_fit, operational_fit, growth_fit, max_confidence }
}
