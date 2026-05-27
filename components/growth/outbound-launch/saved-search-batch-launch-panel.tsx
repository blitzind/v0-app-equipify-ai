"use client"

import { useMemo, useState } from "react"
import { ExternalLink, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  buildSavedSearchBatchLaunchPreview,
  GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER,
  OUTBOUND_LAUNCH_BATCH_MAX,
} from "@/lib/growth/outbound-launch/outbound-launch-motion"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export function SavedSearchBatchLaunchPanel({
  savedSearchId,
  companies,
  onOpenCompany,
}: {
  savedSearchId: string | null
  companies: GrowthProspectSearchCompanyResult[]
  onOpenCompany?: (companyId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const preview = useMemo(
    () => buildSavedSearchBatchLaunchPreview({ savedSearchId, companies }),
    [savedSearchId, companies],
  )

  if (companies.length === 0) return null

  return (
    <div
      className="rounded-xl border border-amber-100 bg-amber-50/40 p-3"
      data-qa-marker={GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-amber-800" />
          <div>
            <p className="text-sm font-semibold text-amber-950">Saved search batch outbound</p>
            <p className="text-[11px] text-muted-foreground">
              Manual preview · approval-gated · no auto-send · max {OUTBOUND_LAUNCH_BATCH_MAX} per batch
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide preview" : "Review batch"}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span>{preview.total_candidates} in view</span>
        <span>{preview.eligible_count} launch-ready</span>
        <span>{preview.blocked_count} blocked</span>
        {preview.warning_count > 0 ? <span>{preview.warning_count} with warnings</span> : null}
        {preview.capped ? <span className="text-amber-800">Capped at {OUTBOUND_LAUNCH_BATCH_MAX}</span> : null}
      </div>

      {expanded ? (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {preview.rows.map((row) => (
            <li key={row.company_id} className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{row.company_name}</p>
                  <p className="text-muted-foreground">{row.recommended_action ?? "Review prospect"}</p>
                  {!row.preflight.can_launch ? (
                    <p className="mt-1 text-rose-800">
                      {row.preflight.checks.find((c) => !c.passed && c.severity === "block")?.detail ??
                        "Blocked by preflight"}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {onOpenCompany ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => onOpenCompany(row.company_id)}>
                      Select
                    </Button>
                  ) : null}
                  {row.launch_urls.generate_draft ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={row.launch_urls.generate_draft} target="_blank" rel="noopener noreferrer">
                        Draft
                        <ExternalLink className="ml-1 size-3" />
                      </a>
                    </Button>
                  ) : null}
                  {row.launch_urls.approval_queue ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={row.launch_urls.approval_queue} target="_blank" rel="noopener noreferrer">
                        Queue
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
