"use client"

import { useMemo } from "react"
import { buildSearchSuggestions } from "@/components/growth/prospect-search/search-suggestion-engine"
import { cn } from "@/lib/utils"

export function SearchRecommendations({
  query,
  savedSearchNames,
  onSelect,
  visible,
}: {
  query: string
  savedSearchNames: string[]
  onSelect: (value: string) => void
  visible: boolean
}) {
  const suggestions = useMemo(
    () =>
      buildSearchSuggestions({
        query,
        savedSearchNames,
        limit: 8,
      }),
    [query, savedSearchNames],
  )

  if (!visible || !query.trim() || suggestions.length === 0) return null

  return (
    <ul
      className={cn(
        "absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg",
      )}
    >
      {suggestions.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(s.value)
            }}
          >
            <span>{s.label}</span>
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
              {s.kind}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
