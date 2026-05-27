"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { GROWTH_SIGNAL_MOMENTUM_QA_MARKER, formatSignalTypeLabel } from "@/lib/growth/signals/company-signal-rollup"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

const MOMENTUM_STYLES: Record<string, string> = {
  Quiet: "border-slate-200 bg-slate-50 text-slate-700",
  Emerging: "border-sky-200 bg-sky-50 text-sky-900",
  Active: "border-emerald-200 bg-emerald-50 text-emerald-900",
  "High Intent": "border-violet-200 bg-violet-50 text-violet-900",
  Priority: "border-amber-200 bg-amber-50 text-amber-900",
}

function intentSignalsHref(row: GrowthProspectSearchCompanyResult): string {
  const params = new URLSearchParams()
  if (row.website) {
    try {
      const url = row.website.startsWith("http") ? row.website : `https://${row.website}`
      params.set("domain", new URL(url).hostname)
    } catch {
      params.set("company", row.company_name)
    }
  } else {
    params.set("company", row.company_name)
  }
  return `/admin/growth/intent-pixel?${params.toString()}`
}

export function CompanySignalMomentumPanel({
  row,
  className,
}: {
  row: GrowthProspectSearchCompanyResult
  className?: string
}) {
  const label = row.signal_momentum_label ?? "Quiet"
  const recentCount = row.recent_signal_count ?? 0
  const hasSignals = recentCount > 0 || (row.signal_momentum_score ?? 0) > 0

  if (!hasSignals) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)} data-qa-marker={GROWTH_SIGNAL_MOMENTUM_QA_MARKER}>
        No recent signals
      </p>
    )
  }

  const chips: string[] = []
  for (const type of row.top_signal_types ?? []) {
    chips.push(formatSignalTypeLabel(type as never))
  }
  if ((row.watchlist_matches?.length ?? 0) > 0) {
    chips.push("Watchlist match")
  }

  return (
    <div
      className={cn("rounded-lg border border-border/70 bg-muted/20 px-3 py-2", className)}
      data-qa-marker={GROWTH_SIGNAL_MOMENTUM_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("text-[10px] font-semibold", MOMENTUM_STYLES[label] ?? "")}>
          {label}
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          Momentum score {row.signal_momentum_score ?? 0}
          {(row.watchlist_matches?.length ?? 0) > 0 ? " · Matched watchlist" : ""}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-foreground/90">
        {recentCount} recent signal{recentCount === 1 ? "" : "s"}
        {row.latest_signal_summary ? ` · latest: ${row.latest_signal_summary}` : ""}
      </p>
      {chips.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.slice(0, 4).map((chip) => (
            <Badge key={chip} variant="secondary" className="text-[10px]">
              {chip}
            </Badge>
          ))}
        </div>
      ) : null}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] font-medium text-violet-800">Signals</summary>
        <div className="mt-1 space-y-1 text-[11px] text-muted-foreground">
          <p>Evidence count: {row.signal_evidence_count ?? 0}</p>
          {row.hiring_intensity ? <p>Hiring intensity: {row.hiring_intensity}</p> : null}
          {(row.watchlist_matches ?? []).map((match) => (
            <p key={match.watchlist_id}>Matched watchlist: {match.watchlist_name}</p>
          ))}
          <Link href={intentSignalsHref(row)} className="text-violet-700 underline-offset-2 hover:underline">
            View in Intent Signals
          </Link>
        </div>
      </details>
    </div>
  )
}
