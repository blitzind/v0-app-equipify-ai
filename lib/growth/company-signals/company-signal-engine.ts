import type { GrowthCompanySignalContext } from "@/lib/growth/company-signals/company-signal-context"
import { detectGrowthSignals } from "@/lib/growth/company-signals/company-growth-detector"
import { detectOperationalSignals } from "@/lib/growth/company-signals/company-operational-detector"
import { detectTechnologySignals } from "@/lib/growth/company-signals/company-tech-detector"
import {
  normalizeCompanySignal,
  type RawCompanySignalCandidate,
} from "@/lib/growth/company-signals/company-signal-normalizer"
import { dedupeCompanySignals, type NormalizedCompanySignal } from "@/lib/growth/company-signals/company-signal-dedupe"
import type { GrowthCompanySignalUiSummary } from "@/lib/growth/company-signals/company-signal-types"

export function runCompanySignalDetectors(ctx: GrowthCompanySignalContext): RawCompanySignalCandidate[] {
  return [
    ...detectTechnologySignals(ctx),
    ...detectOperationalSignals(ctx),
    ...detectGrowthSignals(ctx),
  ]
}

export function normalizeDetectedCompanySignals(
  ctx: GrowthCompanySignalContext,
): NormalizedCompanySignal[] {
  const raw = runCompanySignalDetectors(ctx)
  const normalized: NormalizedCompanySignal[] = []
  for (const r of raw) {
    const row = normalizeCompanySignal(r, ctx.company_candidate_id, "company_signal_engine")
    if (row) normalized.push(row)
  }
  return dedupeCompanySignals(normalized)
}

function maturityLabel(score: number, high: string, mid: string, low: string): string {
  if (score >= 0.65) return high
  if (score >= 0.4) return mid
  return low
}

export function buildCompanySignalUiSummary(
  signals: Array<{ signal_category: string; signal_type: string; signal_value: string; confidence: number }>,
): GrowthCompanySignalUiSummary {
  const technology_signals = signals
    .filter((s) => s.signal_category === "technology" || s.signal_category === "field_service")
    .sort((a, b) => b.confidence - a.confidence)
    .map((s) => s.signal_value)
    .slice(0, 6)

  const growth_indicators = signals
    .filter((s) => ["growth", "staffing", "digital_presence"].includes(s.signal_category))
    .sort((a, b) => b.confidence - a.confidence)
    .map((s) => s.signal_value)
    .slice(0, 5)

  const ops = signals.filter((s) => s.signal_category === "operations")
  const opsAvg =
    ops.length > 0 ? ops.reduce((a, s) => a + s.confidence, 0) / ops.length : 0

  const digital = signals.filter((s) => s.signal_category === "digital_presence")
  const digitalAvg =
    digital.length > 0 ? digital.reduce((a, s) => a + s.confidence, 0) / digital.length : 0

  const field = signals.filter((s) => s.signal_category === "field_service")
  const fieldAvg =
    field.length > 0 ? field.reduce((a, s) => a + s.confidence, 0) / field.length : 0

  const fit_indicators = signals
    .filter((s) =>
      ["service_model", "field_service", "technology"].includes(s.signal_category),
    )
    .sort((a, b) => b.confidence - a.confidence)
    .map((s) => s.signal_value)
    .slice(0, 4)

  return {
    technology_signals,
    growth_indicators,
    operational_maturity: maturityLabel(opsAvg, "Mature operations", "Emerging operations", "Limited ops evidence"),
    digital_maturity: maturityLabel(
      digitalAvg,
      "Strong digital presence",
      "Moderate digital presence",
      "Limited digital evidence",
    ),
    field_service_maturity: maturityLabel(
      fieldAvg,
      "Field service ready",
      "Partial field service fit",
      "No field service evidence",
    ),
    fit_indicators,
  }
}
