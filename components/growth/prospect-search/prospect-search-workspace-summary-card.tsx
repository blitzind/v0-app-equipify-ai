"use client"

import { LayoutDashboard } from "lucide-react"
import type { ProspectSearchWorkspacePrioritizationRollup } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import { GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_UX_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_SUMMARY_TITLE,
} from "@/lib/growth/prospect-search/prospect-search-workspace-ux"

export function ProspectSearchWorkspaceSummaryCard({
  prioritization,
  accountCount,
  className,
}: {
  prioritization: ProspectSearchWorkspacePrioritizationRollup[]
  accountCount: number
  className?: string
}) {
  if (accountCount === 0) return null

  return (
    <section
      className={className}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER}
      data-workspace-ux-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_UX_QA_MARKER}
      data-workspace-summary="v1"
    >
      <div className="flex items-center gap-2">
        <LayoutDashboard className="size-4 text-slate-800" />
        <h4 className="text-sm font-semibold text-slate-950">{PROSPECT_SEARCH_WORKSPACE_SUMMARY_TITLE}</h4>
        <span className="text-xs text-muted-foreground">{accountCount} accounts in view</span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {prioritization.map((row) => (
          <div
            key={row.key}
            className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2"
          >
            <p className="text-[11px] font-medium text-muted-foreground">{row.label}</p>
            <p className="text-lg font-semibold text-slate-950">{row.count}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
