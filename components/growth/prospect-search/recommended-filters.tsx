"use client"

import { Sparkles } from "lucide-react"
import { buildFilterRecommendations } from "@/components/growth/prospect-search/search-recommendation-engine"

export function RecommendedFilters({
  field,
  query,
  onPick,
}: {
  field: "industry" | "location" | "technology" | "role"
  query: string
  onPick: (value: string) => void
}) {
  const recs = buildFilterRecommendations({ field, query, limit: 4 })
  if (!query.trim() || recs.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <Sparkles className="size-3 text-violet-500" />
      {recs.map((r) => (
        <button
          key={r.id}
          type="button"
          className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800 hover:bg-violet-100"
          onClick={() => onPick(r.value)}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
