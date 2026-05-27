"use client"

import { Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import {
  TITLE_ROLE_GROUPS,
  type TitleRoleGroup,
} from "@/lib/growth/prospect-search/title-industry-mapping"
import { getSmartTitleRecommendations } from "@/lib/growth/prospect-search/title-suggestion-engine"
import { cn } from "@/lib/utils"

export function TitleRecommendations({
  industry,
  selectedTitles,
  onPick,
}: {
  industry?: string | null
  selectedTitles: string[]
  onPick: (title: string) => void
}) {
  const [activeGroup, setActiveGroup] = useState<TitleRoleGroup | null>(null)

  const recommendations = useMemo(
    () =>
      getSmartTitleRecommendations({
        industry,
        selected: selectedTitles,
        roleGroup: activeGroup,
        limit: 8,
      }),
    [industry, selectedTitles, activeGroup],
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {TITLE_ROLE_GROUPS.map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => setActiveGroup((current) => (current === group ? null : group))}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-medium",
              activeGroup === group
                ? "border-slate-400 bg-slate-100 text-slate-900"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {group}
          </button>
        ))}
      </div>

      {recommendations.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Sparkles className="size-3 shrink-0 text-violet-500" />
          {industry ? (
            <span className="text-[10px] text-muted-foreground">Recommended for {industry}:</span>
          ) : null}
          {recommendations.map((row) => (
            <button
              key={row.title}
              type="button"
              className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800 hover:bg-violet-100"
              onClick={() => onPick(row.title)}
            >
              {row.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
