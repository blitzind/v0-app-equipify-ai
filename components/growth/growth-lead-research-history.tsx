"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { GrowthLeadResearchRun } from "@/lib/growth/research-types"
import { GrowthLeadResearchRunCard } from "@/components/growth/growth-lead-research-run-card"

type GrowthLeadResearchHistoryProps = {
  runs: GrowthLeadResearchRun[]
  latestRunId?: string | null
}

export function GrowthLeadResearchHistory({ runs, latestRunId }: GrowthLeadResearchHistoryProps) {
  const history = runs.filter((run) => run.id !== latestRunId)
  const [open, setOpen] = useState(false)

  if (history.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        Run history ({history.length})
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border px-4 py-3">
          {history.map((run) => (
            <GrowthLeadResearchRunCard
              key={run.id}
              run={run}
              title={`${run.status} · ${new Date(run.createdAt).toLocaleString()}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
