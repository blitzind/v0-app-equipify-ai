"use client"

import { Download, ListPlus, Phone, RefreshCw, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_CONTACT_ELIGIBILITY_ENGINE_QA_MARKER,
  GROWTH_CONTACT_FRESHNESS_QA_MARKER,
  GROWTH_CONTACT_VERIFICATION_DEPTH_QA_MARKER,
  GROWTH_PEOPLE_WORKFLOWS_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import { cn } from "@/lib/utils"

export function ProspectSearchPeopleBulkActionBar({
  selectedCount,
  visibleCount,
  selectedRows,
  busy = false,
  onClear,
  onSelectVisible,
  onAddToQueue,
  onAddToLeadPipeline,
  onAddToCallQueue,
  onSaveToList,
  onExport,
  onRefreshVerification,
  onRefreshVisible,
  onRefreshStale,
  className,
}: {
  selectedCount: number
  visibleCount: number
  selectedRows: GrowthProspectSearchPeopleResultRow[]
  busy?: boolean
  onClear: () => void
  onSelectVisible: () => void
  onAddToQueue: () => void
  onAddToLeadPipeline: () => void
  onAddToCallQueue: () => void
  onSaveToList: () => void
  onExport: () => void
  onRefreshVerification: () => void
  onRefreshVisible?: () => void
  onRefreshStale?: () => void
  className?: string
}) {
  if (selectedCount <= 0) return null

  const callReadyCount = selectedRows.filter((row) => row.call_ready).length
  const suppressedCount = selectedRows.filter((row) => row.compliance_status === "suppressed").length

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      data-qa-marker={GROWTH_PEOPLE_WORKFLOWS_QA_MARKER}
      data-contact-eligibility-marker={GROWTH_CONTACT_ELIGIBILITY_ENGINE_QA_MARKER}
      data-contact-freshness-marker={GROWTH_CONTACT_FRESHNESS_QA_MARKER}
      data-contact-verification-depth-marker={GROWTH_CONTACT_VERIFICATION_DEPTH_QA_MARKER}
    >
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-cyan-950">
          {selectedCount} {selectedCount === 1 ? "contact" : "contacts"} selected
        </p>
        <p className="text-xs text-cyan-900/80">
          {callReadyCount} call-ready · {visibleCount} visible · operator-triggered actions only
        </p>
        {suppressedCount > 0 ? (
          <p className="text-xs text-red-800">
            {suppressedCount} suppressed {suppressedCount === 1 ? "contact will" : "contacts will"} be
            blocked from outreach actions.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={onSelectVisible}>
          Select visible ({visibleCount})
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onClear}>
          <X className="mr-1 size-3.5" />
          Clear
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onAddToQueue}>
          <Users className="mr-1 size-3.5" />
          Add to Queue
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onAddToLeadPipeline}>
          Lead Pipeline
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onAddToCallQueue}>
          <Phone className="mr-1 size-3.5" />
          Call Queue
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onSaveToList}>
          <ListPlus className="mr-1 size-3.5" />
          Save to List
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onExport}>
          <Download className="mr-1 size-3.5" />
          Export
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onRefreshVerification}>
          <RefreshCw className="mr-1 size-3.5" />
          Refresh selected
        </Button>
        {onRefreshVisible ? (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onRefreshVisible}>
            Refresh visible
          </Button>
        ) : null}
        {onRefreshStale ? (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onRefreshStale}>
            Refresh stale
          </Button>
        ) : null}
      </div>
    </div>
  )
}
