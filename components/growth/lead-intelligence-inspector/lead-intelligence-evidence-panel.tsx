"use client"

import { Badge } from "@/components/ui/badge"
import {
  LEAD_STAGE_CONFIDENCE_QA_MARKER,
  LEAD_STAGE_EVIDENCE_QA_MARKER,
} from "@/lib/growth/lead-engine/lead-intelligence-inspector-qa"
import type { LeadIntelligenceEvidenceItem } from "@/lib/growth/lead-engine/lead-intelligence-stage-display"
import { cn } from "@/lib/utils"

export function LeadIntelligenceEvidencePanel({
  items,
  summary,
  className,
}: {
  items: LeadIntelligenceEvidenceItem[]
  summary?: string | null
  className?: string
}) {
  if (!items.length && !summary) return null

  return (
    <div
      className={cn("space-y-3", className)}
      data-qa-marker={LEAD_STAGE_EVIDENCE_QA_MARKER}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Evidence & signals
        </p>
        <Badge variant="secondary" className="text-[10px]">
          {items.length} item{items.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-border/80 bg-background/80 p-3 text-sm"
            data-qa-marker={LEAD_STAGE_CONFIDENCE_QA_MARKER}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium leading-snug">{item.claim}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px] font-normal">
                  {item.kind}
                </Badge>
                {item.confidencePercent != null ? (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {item.confidencePercent}%
                  </Badge>
                ) : null}
              </div>
            </div>
            <p className="mt-1.5 text-muted-foreground">{item.evidence}</p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/80">source: {item.source}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
