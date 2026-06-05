"use client"

import { Button } from "@/components/ui/button"
import { GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import type { ProspectSearchWorkspaceWorklistMetrics } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_UX_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_SELECTION_TITLE,
} from "@/lib/growth/prospect-search/prospect-search-workspace-ux"

export function ProspectSearchWorkspaceSelectionBar({
  metrics,
  onSelectAllVisible,
  onClearSelection,
  className,
}: {
  metrics: ProspectSearchWorkspaceWorklistMetrics
  onSelectAllVisible?: () => void
  onClearSelection?: () => void
  className?: string
}) {
  return (
    <section
      className={className}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER}
      data-workspace-ux-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_UX_QA_MARKER}
      data-workspace-selection-bar="v1"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-950">{PROSPECT_SEARCH_WORKSPACE_SELECTION_TITLE}</h4>
        <div className="flex flex-wrap gap-2">
          {onSelectAllVisible ? (
            <Button type="button" size="sm" variant="outline" onClick={onSelectAllVisible}>
              Select all visible
            </Button>
          ) : null}
          {onClearSelection ? (
            <Button type="button" size="sm" variant="ghost" onClick={onClearSelection}>
              Clear selection
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["Visible", metrics.visible_accounts],
            ["Selected", metrics.selected_accounts],
            ["Executable (preview)", metrics.executable_accounts],
            ["Blocked (preview)", metrics.blocked_accounts],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-center"
          >
            <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums text-slate-950">{value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
