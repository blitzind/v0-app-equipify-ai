"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

export function CompanyResultExplanations({ row }: { row: GrowthProspectSearchCompanyResult }) {
  const scoreItems = row.score_explanation_items ?? []
  const confidenceItems = row.confidence_explanation_items ?? []
  const hasItems = scoreItems.length > 0 || confidenceItems.length > 0

  if (!hasItems && !row.recommended_next_step_reason) return null

  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-lg border border-slate-200 bg-slate-50/70"
      data-qa-marker="growth-prospect-search-explanations-v1"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        <span className="text-xs font-semibold text-slate-900">Why this match?</span>
        <ChevronDown className={cn("size-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-slate-200 px-3 py-2.5 text-xs text-slate-700">
          {scoreItems.length > 0 ? (
            <div>
              <p className="font-medium text-slate-900">Score signals</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {scoreItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {confidenceItems.length > 0 ? (
            <div>
              <p className="font-medium text-slate-900">Confidence</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {confidenceItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {row.recommended_next_step_reason ? (
            <p className="rounded-md border border-violet-100 bg-violet-50/80 px-2.5 py-2 text-violet-900">
              <span className="font-medium">Recommended next step:</span> {row.recommended_next_step_reason}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
