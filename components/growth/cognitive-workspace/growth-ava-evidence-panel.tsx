"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { GrowthAvaEvidenceFact } from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

type Props = {
  facts: GrowthAvaEvidenceFact[]
}

export function GrowthAvaEvidencePanel({ facts }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  if (facts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        I do not have curated factual evidence for this account yet.
      </p>
    )
  }

  const overview = facts.filter((fact) =>
    ["company", "website", "industry", "location", "summary", "research_status"].includes(fact.id),
  )
  const detail = facts.filter((fact) => !overview.some((item) => item.id === fact.id))

  return (
    <div className="space-y-3">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {(overview.length ? overview : facts.slice(0, 6)).map((fact) => (
          <div key={fact.id} className="rounded-lg border border-border/50 bg-background/60 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className="mt-1 break-words font-medium text-foreground">{fact.value}</dd>
            {fact.confidencePercent != null ? (
              <p className="mt-1 text-[11px] text-muted-foreground">Source confidence {fact.confidencePercent}%</p>
            ) : null}
            {fact.source ? (
              <a
                href={fact.source.startsWith("http") ? fact.source : `https://${fact.source}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-[11px] text-sky-700 underline dark:text-sky-300"
              >
                Open source
              </a>
            ) : null}
          </div>
        ))}
      </dl>

      {detail.length > 0 ? (
        <div className="rounded-lg border border-border/60">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground"
            onClick={() => setDetailsOpen((value) => !value)}
          >
            {detailsOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            Detailed evidence ({detail.length})
          </button>
          {detailsOpen ? (
            <dl className="grid gap-2 border-t border-border/60 px-3 py-3 text-sm sm:grid-cols-2">
              {detail.map((fact) => (
                <div key={fact.id}>
                  <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                  <dd className="mt-1 break-words">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
