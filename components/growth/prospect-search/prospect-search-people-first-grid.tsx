"use client"

import { MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import {
  GROWTH_CONTACT_DRAWER_QA_MARKER,
  GROWTH_BULK_CONTACT_OPERATIONS_QA_MARKER,
  GROWTH_CONTACT_NATIVE_PAGINATION_QA_MARKER,
  GROWTH_PROSPEO_STYLE_RESULTS_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import { GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-native-index"
import {
  GROWTH_PEOPLE_FIRST_GRID_QA_MARKER,
  GROWTH_CONTACTABILITY_RANKING_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-people-native-ranking"
import { GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-scalable-pagination"
import { prospectSearchPeopleSelectionKey } from "@/lib/growth/prospect-search/prospect-search-people-selection"

function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  if (value <= 1) return `${Math.round(value * 100)}%`
  return String(Math.round(value))
}

export function ProspectSearchPeopleFirstGrid({
  rows,
  selectedKeys,
  onToggleSelection,
  onSelectAllVisible,
  onClearSelection,
  onOpenContact,
  onOpenCompany,
  onAddToQueue,
  onAddToLeadPipeline,
  onAddToCallQueue,
  onRerunDiscovery,
}: {
  rows: GrowthProspectSearchPeopleResultRow[]
  selectedKeys?: Set<string>
  onToggleSelection?: (row: GrowthProspectSearchPeopleResultRow, checked: boolean) => void
  onSelectAllVisible?: () => void
  onClearSelection?: () => void
  onOpenContact?: (row: GrowthProspectSearchPeopleResultRow) => void
  onOpenCompany?: (companyId: string) => void
  onAddToQueue?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddToLeadPipeline?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddToCallQueue?: (row: GrowthProspectSearchPeopleResultRow) => void
  onRerunDiscovery?: (row: GrowthProspectSearchPeopleResultRow) => void
}) {
  const allVisibleSelected =
    rows.length > 0 &&
    selectedKeys &&
    rows.every((row) => selectedKeys.has(prospectSearchPeopleSelectionKey(row)))

  if (rows.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground"
        data-people-first-grid-marker={GROWTH_PEOPLE_FIRST_GRID_QA_MARKER}
        data-prospeo-style-results-marker={GROWTH_PROSPEO_STYLE_RESULTS_QA_MARKER}
      >
        No reachable contacts matched this search yet. Try broadening filters or run contact acquisition on
        target companies.
      </div>
    )
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-border bg-card"
      data-people-first-grid-marker={GROWTH_PEOPLE_FIRST_GRID_QA_MARKER}
      data-prospeo-style-results-marker={GROWTH_PROSPEO_STYLE_RESULTS_QA_MARKER}
      data-contact-native-search-marker={GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER}
      data-contact-native-pagination-marker={GROWTH_CONTACT_NATIVE_PAGINATION_QA_MARKER}
      data-contact-drawer-marker={GROWTH_CONTACT_DRAWER_QA_MARKER}
      data-bulk-contact-operations-marker={GROWTH_BULK_CONTACT_OPERATIONS_QA_MARKER}
      data-contactability-ranking-marker={GROWTH_CONTACTABILITY_RANKING_QA_MARKER}
      data-scalable-prospect-search-marker={GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER}
      data-virtualization-layer="v1"
    >
      <table className="w-full min-w-[1400px] text-left text-[11px]">
        <thead className="sticky top-0 z-20 bg-muted/60 text-muted-foreground backdrop-blur">
          <tr>
            <th className="sticky left-0 z-30 bg-muted/60 px-2 py-2">
              {onSelectAllVisible && onClearSelection ? (
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(value) => {
                    if (value === true) onSelectAllVisible()
                    else onClearSelection()
                  }}
                  aria-label="Select all visible contacts"
                />
              ) : null}
            </th>
            <th className="px-2 py-2">Name</th>
            <th className="px-2 py-2">Company</th>
            <th className="px-2 py-2">Title</th>
            <th className="px-2 py-2">Email</th>
            <th className="px-2 py-2">Phone</th>
            <th className="px-2 py-2">Location</th>
            <th className="px-2 py-2">Reachable</th>
            <th className="px-2 py-2">Verification</th>
            <th className="px-2 py-2">Confidence</th>
            <th className="px-2 py-2">DM Fit</th>
            <th className="px-2 py-2">Signals</th>
            <th className="px-2 py-2">Freshness</th>
            <th className="sticky right-0 z-30 bg-muted/60 px-2 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = prospectSearchPeopleSelectionKey(row)
            const reachableScore =
              row.reachable_human_score ?? row.company.reachable_human?.score ?? row.contact_native_rank_score

            return (
              <tr key={key} className="border-b border-border/60 hover:bg-muted/20">
                <td className="sticky left-0 z-10 bg-card px-2 py-1.5">
                  {onToggleSelection ? (
                    <Checkbox
                      checked={selectedKeys?.has(key) ?? false}
                      onCheckedChange={(value) => onToggleSelection(row, value === true)}
                      aria-label={`Select ${row.full_name ?? "contact"}`}
                    />
                  ) : null}
                </td>
                <td className="px-2 py-1.5 font-medium text-foreground">{row.full_name ?? "—"}</td>
                <td className="px-2 py-1.5">
                  {onOpenCompany ? (
                    <button
                      type="button"
                      className="text-left text-violet-700 underline-offset-2 hover:underline"
                      onClick={() => onOpenCompany(row.company_id)}
                    >
                      {row.company_name}
                    </button>
                  ) : (
                    row.company_name
                  )}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">{row.title ?? "—"}</td>
                <td className="px-2 py-1.5">{row.email ?? "—"}</td>
                <td className="px-2 py-1.5">{row.phone ?? "—"}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{row.location ?? row.branch_city ?? "—"}</td>
                <td className="px-2 py-1.5">{formatScore(reachableScore)}</td>
                <td className="px-2 py-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {row.verification_status.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-2 py-1.5">{formatScore(row.confidence)}</td>
                <td className="px-2 py-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {row.persona_label}
                  </Badge>
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {row.ranking_reasons[0] ?? row.company.signals[0] ?? "—"}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">{row.freshness_status ?? "—"}</td>
                <td className="sticky right-0 z-10 bg-card px-2 py-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs">
                      {onOpenContact ? (
                        <DropdownMenuItem onClick={() => onOpenContact(row)}>Open profile</DropdownMenuItem>
                      ) : null}
                      {onAddToQueue ? (
                        <DropdownMenuItem onClick={() => onAddToQueue(row)}>Add to Queue</DropdownMenuItem>
                      ) : null}
                      {onAddToLeadPipeline ? (
                        <DropdownMenuItem onClick={() => onAddToLeadPipeline(row)}>
                          Push to Lead Pipeline
                        </DropdownMenuItem>
                      ) : null}
                      {onAddToCallQueue ? (
                        <DropdownMenuItem onClick={() => onAddToCallQueue(row)}>Add to Call Queue</DropdownMenuItem>
                      ) : null}
                      {onOpenCompany ? (
                        <DropdownMenuItem onClick={() => onOpenCompany(row.company_id)}>
                          Open company intelligence
                        </DropdownMenuItem>
                      ) : null}
                      {onRerunDiscovery ? (
                        <DropdownMenuItem onClick={() => onRerunDiscovery(row)}>
                          Start research expansion
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ProspectSearchBulkContactOperationsBar({
  selectedCount,
  visibleCount,
  busy,
  onClear,
  onSelectVisible,
  onAddToQueue,
  onAddToLeadPipeline,
  onAddToCallQueue,
  onExport,
  onBulkEnrich,
  onBulkVerify,
}: {
  selectedCount: number
  visibleCount: number
  busy?: boolean
  onClear: () => void
  onSelectVisible: () => void
  onAddToQueue: () => void
  onAddToLeadPipeline: () => void
  onAddToCallQueue: () => void
  onExport: () => void
  onBulkEnrich?: () => void
  onBulkVerify?: () => void
}) {
  if (selectedCount === 0 && visibleCount === 0) return null

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 text-xs dark:border-violet-900 dark:bg-violet-950/20"
      data-bulk-contact-operations-marker={GROWTH_BULK_CONTACT_OPERATIONS_QA_MARKER}
    >
      <p className="font-medium text-foreground">
        {selectedCount > 0
          ? `${selectedCount} contact(s) selected`
          : `${visibleCount} visible contact(s)`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={onSelectVisible}>
          Select visible
        </Button>
        <Button size="sm" variant="outline" disabled={busy || selectedCount === 0} onClick={onClear}>
          Clear
        </Button>
        <Button size="sm" disabled={busy || selectedCount === 0} onClick={onAddToQueue}>
          Queue
        </Button>
        <Button size="sm" variant="secondary" disabled={busy || selectedCount === 0} onClick={onAddToLeadPipeline}>
          Lead Pipeline
        </Button>
        <Button size="sm" variant="secondary" disabled={busy || selectedCount === 0} onClick={onAddToCallQueue}>
          Call Queue
        </Button>
        {onBulkEnrich ? (
          <Button size="sm" variant="outline" disabled={busy || selectedCount === 0} onClick={onBulkEnrich}>
            Bulk enrich
          </Button>
        ) : null}
        {onBulkVerify ? (
          <Button size="sm" variant="outline" disabled={busy || selectedCount === 0} onClick={onBulkVerify}>
            Bulk verify
          </Button>
        ) : null}
        <Button size="sm" variant="outline" disabled={busy || selectedCount === 0} onClick={onExport}>
          Export
        </Button>
      </div>
    </div>
  )
}
