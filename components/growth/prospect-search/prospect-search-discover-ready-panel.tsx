"use client"

import { Search } from "lucide-react"
import { GROWTH_DISCOVER_READY_TO_SEARCH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-discover-ui-state"

export function ProspectSearchDiscoverReadyPanel() {
  return (
    <div
      className="rounded-2xl border border-dashed border-violet-200/80 bg-violet-50/40 px-6 py-12 text-center dark:border-violet-900/40 dark:bg-violet-950/20"
      data-qa={GROWTH_DISCOVER_READY_TO_SEARCH_QA_MARKER}
      data-qa-marker={GROWTH_DISCOVER_READY_TO_SEARCH_QA_MARKER}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50">
        <Search className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">Ready to search this market</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
        Review the live numerical estimate above, then click Search market to discover companies from external
        sources. Results appear here after discovery completes — filter changes refresh the estimate only.
      </p>
    </div>
  )
}
