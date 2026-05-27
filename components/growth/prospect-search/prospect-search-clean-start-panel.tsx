"use client"

import { Search } from "lucide-react"
import {
  GROWTH_SEARCH_CLEAN_START_QA_MARKER,
  PROSPECT_SEARCH_SUGGESTED_SEARCHES,
} from "@/components/growth/prospect-search/prospect-search-ux-constants"
import type { GrowthProspectSearchSavedSearchWithWorkflow } from "@/lib/growth/prospect-search/saved-search-workflows"

export function ProspectSearchCleanStartPanel({
  savedSearches,
  onRunQuery,
  onRestoreSavedSearch,
}: {
  savedSearches: GrowthProspectSearchSavedSearchWithWorkflow[]
  onRunQuery: (query: string) => void
  onRestoreSavedSearch: (id: string) => void
}) {
  return (
    <div
      className="rounded-2xl border border-dashed border-border bg-muted/15 px-6 py-12 text-center"
      data-qa-marker={GROWTH_SEARCH_CLEAN_START_QA_MARKER}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-700">
        <Search className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">Find your next prospects</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
        Search by company type, industry, location, technology, or plain English.
      </p>

      {savedSearches.length > 0 ? (
        <div className="mx-auto mt-8 max-w-md text-left">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Saved searches
          </h4>
          <ul className="mt-2 space-y-1.5">
            {savedSearches.slice(0, 5).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="text-sm font-medium text-violet-700 hover:underline"
                  onClick={() => onRestoreSavedSearch(row.id)}
                >
                  {row.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mx-auto mt-8 max-w-md text-left">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Try a suggested search
        </h4>
        <ul className="mt-2 space-y-1.5">
          {PROSPECT_SEARCH_SUGGESTED_SEARCHES.map((entry) => (
            <li key={entry.query}>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-violet-700"
                onClick={() => onRunQuery(entry.query)}
              >
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
