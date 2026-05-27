"use client"

import { Badge } from "@/components/ui/badge"
import type { GrowthCompanySignalUiSummary } from "@/lib/growth/company-signals/company-signal-types"
import { hasDisplayableCompanySignalSummary } from "@/lib/growth/prospect-search/internal-company-signal-hydration"

function SignalGroup({
  label,
  items,
  variant = "secondary" as const,
}: {
  label: string
  items: string[]
  variant?: "secondary" | "outline"
}) {
  if (items.length === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold text-violet-900">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => (
          <Badge key={`${label}-${item}`} variant={variant} className="text-[10px]">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function operationalIndicators(summary: GrowthCompanySignalUiSummary): string[] {
  const items: string[] = []
  if (summary.operational_maturity === "Mature operations") {
    items.push("Mature operations")
  } else if (summary.operational_maturity === "Emerging operations") {
    items.push("Emerging operations")
  }
  if (summary.field_service_maturity === "Field service ready") {
    items.push("Field service ready")
  } else if (summary.field_service_maturity === "Partial field service fit") {
    items.push("Partial field service fit")
  }
  return items
}

export function CompanySignalSummaryPanel({
  summary,
  signalConfidence,
  signalCount = 1,
}: {
  summary: GrowthCompanySignalUiSummary
  signalConfidence?: number | null
  signalCount?: number
}) {
  if (!hasDisplayableCompanySignalSummary(summary, signalCount)) return null

  const operational = operationalIndicators(summary)

  return (
    <div
      className="space-y-3 rounded-lg border border-violet-100 bg-violet-50/40 p-3"
      data-qa-marker="growth-prospect-search-internal-signals-v1"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-900">
          Company intelligence
        </p>
        {signalConfidence != null ? (
          <p className="text-xs text-violet-800">
            Signal confidence{" "}
            <span className="font-semibold tabular-nums">{Math.round(signalConfidence * 100)}%</span>
          </p>
        ) : null}
      </div>

      <SignalGroup label="Growth signals" items={summary.growth_indicators} variant="outline" />
      <SignalGroup label="Technology" items={summary.technology_signals} />
      <SignalGroup label="Operational" items={operational} variant="outline" />
      <SignalGroup label="Fit indicators" items={summary.fit_indicators} variant="outline" />
    </div>
  )
}
