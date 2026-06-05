"use client"

import { cn } from "@/lib/utils"
import type { ProspectSearchWorkspaceViewMatch } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import type { ProspectSearchWorkspaceViewId } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import { GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_UX_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_VIEWS_TITLE,
} from "@/lib/growth/prospect-search/prospect-search-workspace-ux"
import { PROSPECT_SEARCH_WORKSPACE_VIEW_DEFINITIONS } from "@/lib/growth/prospect-search/prospect-search-workspace-views"

export function ProspectSearchWorkspaceViewSelector({
  views,
  selectedViewId,
  onSelectView,
  className,
}: {
  views: ProspectSearchWorkspaceViewMatch[]
  selectedViewId?: ProspectSearchWorkspaceViewId | null
  onSelectView?: (viewId: ProspectSearchWorkspaceViewId) => void
  className?: string
}) {
  const countByView = new Map(views.map((row) => [row.view_id, row.count]))

  return (
    <section
      className={className}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER}
      data-workspace-ux-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_UX_QA_MARKER}
      data-workspace-view-selector="v1"
    >
      <h4 className="text-sm font-semibold text-slate-950">{PROSPECT_SEARCH_WORKSPACE_VIEWS_TITLE}</h4>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Deterministic view definitions — configuration only, no saved persistence in 7.PS-FA.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PROSPECT_SEARCH_WORKSPACE_VIEW_DEFINITIONS.map((definition) => {
          const count = countByView.get(definition.id) ?? 0
          const active = selectedViewId === definition.id
          return (
            <button
              key={definition.id}
              type="button"
              onClick={() => onSelectView?.(definition.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-slate-600 bg-slate-100 text-slate-950"
                  : "border-border bg-card text-foreground hover:bg-muted",
                !onSelectView && "cursor-default",
              )}
              title={definition.description}
            >
              {definition.label} ({count})
            </button>
          )
        })}
      </div>
    </section>
  )
}
