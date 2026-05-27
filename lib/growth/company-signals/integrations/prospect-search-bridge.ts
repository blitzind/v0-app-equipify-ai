import type { GrowthCompanySignalUiSummary } from "@/lib/growth/company-signals/company-signal-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { mergeSignalSummaryIntoProspectSignals } from "@/lib/growth/company-signals/integrations/real-world-discovery-bridge"

export function attachCompanySignalSummaryToProspectCompany(
  company: GrowthProspectSearchCompanyResult,
  summary: GrowthCompanySignalUiSummary | null,
): GrowthProspectSearchCompanyResult {
  if (!summary) return company
  return {
    ...company,
    company_signal_summary: summary,
    signals: mergeSignalSummaryIntoProspectSignals(company.signals, summary),
  }
}
