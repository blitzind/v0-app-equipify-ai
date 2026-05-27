"use client"

import { Search, Sparkles } from "lucide-react"
import {
  PROSPECT_SEARCH_ICP_TEMPLATES,
  PROSPECT_SEARCH_POPULAR_INDUSTRIES,
  PROSPECT_SEARCH_SUGGESTED_SEARCHES,
} from "@/components/growth/prospect-search/prospect-search-ux-constants"
import type { ProspectSearchIcpTemplate } from "@/components/growth/prospect-search/prospect-search-ux-constants"
import type { GrowthProspectSearchSavedSearchRow } from "@/lib/growth/prospect-search/prospect-search-types"

export function SearchEmptyState({
  onRunQuery,
  onSelectTemplate,
  recentSaved,
  emptyMessage,
  title,
}: {
  onRunQuery: (query: string) => void
  onSelectTemplate: (template: ProspectSearchIcpTemplate) => void
  recentSaved: GrowthProspectSearchSavedSearchRow[]
  emptyMessage?: string | null
  title?: string | null
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-700">
        <Search className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title ?? "Discover your next ICP"}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {emptyMessage ??
          "Start with a suggested search, starter ICP template, or popular industry — then refine with guided filters."}
      </p>

      <div className="mt-8 grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested searches
          </h4>
          <ul className="mt-2 space-y-1.5">
            {PROSPECT_SEARCH_SUGGESTED_SEARCHES.map((s) => (
              <li key={s.query}>
                <button
                  type="button"
                  className="text-sm font-medium text-violet-700 hover:underline"
                  onClick={() => onRunQuery(s.query)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3" /> Starter ICPs
          </h4>
          <ul className="mt-2 space-y-1.5">
            {PROSPECT_SEARCH_ICP_TEMPLATES.slice(0, 4).map((tpl) => (
              <li key={tpl.id}>
                <button
                  type="button"
                  className="text-sm hover:text-violet-700"
                  onClick={() => onSelectTemplate(tpl)}
                >
                  {tpl.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Popular industries
          </h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PROSPECT_SEARCH_POPULAR_INDUSTRIES.map((ind) => (
              <button
                key={ind}
                type="button"
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:border-violet-300"
                onClick={() => onRunQuery(`${ind.toLowerCase()} companies`)}
              >
                {ind}
              </button>
            ))}
          </div>
          {recentSaved.length > 0 ? (
            <>
              <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recently used
              </h4>
              <ul className="mt-2 space-y-1">
                {recentSaved.slice(0, 3).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => onRunQuery(s.query_text)}
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
