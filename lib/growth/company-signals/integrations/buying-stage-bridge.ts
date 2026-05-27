import type { GrowthCompanySignal } from "@/lib/growth/company-signals/company-signal-types"

export function companySignalsToBuyingStageHints(signals: GrowthCompanySignal[]): string[] {
  const hints: string[] = []
  for (const s of signals) {
    if (s.confidence < 0.45) continue
    hints.push(`${s.signal_category}: ${s.signal_value}`)
  }
  return hints.slice(0, 6)
}
