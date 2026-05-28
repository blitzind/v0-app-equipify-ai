"use client"

import { Checkbox } from "@/components/ui/checkbox"
import {
  formatDiscoverContactField,
  GROWTH_DISCOVER_CONTACT_ROW_QA_MARKER,
  GROWTH_DISCOVER_RESULTS_TABLE_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-discover-results"
import type { GrowthProspectSearchDiscoverResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { prospectSearchSelectionKey } from "@/lib/growth/prospect-search/prospect-search-selection"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

export function ProspectSearchDiscoverResultsTable({
  rows,
  selectedId,
  selectedKeys,
  onSelect,
  onToggleSelection,
  onSelectAllVisible,
  onClearSelection,
}: {
  rows: GrowthProspectSearchDiscoverResult[]
  selectedId: string | null
  selectedKeys: Set<string>
  onSelect: (company: GrowthProspectSearchCompanyResult) => void
  onToggleSelection: (company: GrowthProspectSearchCompanyResult, checked: boolean) => void
  onSelectAllVisible: () => void
  onClearSelection: () => void
}) {
  const allVisibleSelected =
    rows.length > 0 && rows.every((row) => selectedKeys.has(prospectSearchSelectionKey(row.company)))

  return (
    <div
      className="overflow-x-auto rounded-xl border border-border bg-card"
      data-qa={GROWTH_DISCOVER_RESULTS_TABLE_QA_MARKER}
      data-qa-marker={GROWTH_DISCOVER_RESULTS_TABLE_QA_MARKER}
    >
      <table className="w-full min-w-[1100px] text-left text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={(value) => {
                  if (value === true) onSelectAllVisible()
                  else onClearSelection()
                }}
                aria-label="Select all visible prospects"
              />
            </th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2">Location</th>
            <th className="px-3 py-2">Industry</th>
            <th className="px-3 py-2">Size</th>
            <th className="px-3 py-2">Score</th>
            <th className="px-3 py-2">ICP fit</th>
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const hasContact = Boolean(row.contact_name?.trim())
            return (
              <tr
                key={`${row.company_id}-${row.contact_id ?? "company"}`}
                className={cn(
                  "cursor-pointer border-t border-border hover:bg-muted/30",
                  selectedId === row.company_id && "bg-violet-50/80",
                )}
                data-qa={hasContact ? GROWTH_DISCOVER_CONTACT_ROW_QA_MARKER : undefined}
                onClick={() => onSelect(row.company)}
              >
                <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedKeys.has(prospectSearchSelectionKey(row.company))}
                    onCheckedChange={(value) => onToggleSelection(row.company, value === true)}
                    aria-label={`Select ${row.company_name}`}
                  />
                </td>
                <td className="px-3 py-2 font-medium">{row.contact_name ?? "—"}</td>
                <td className="px-3 py-2">{row.company_name}</td>
                <td className="px-3 py-2">{row.contact_title ?? "—"}</td>
                <td className="px-3 py-2">
                  {formatDiscoverContactField(row.contact_email, row.contact_email_status)}
                </td>
                <td className="px-3 py-2">
                  {formatDiscoverContactField(row.contact_phone, row.contact_phone_status)}
                </td>
                <td className="px-3 py-2">{row.location ?? "—"}</td>
                <td className="px-3 py-2">{row.industry ?? "—"}</td>
                <td className="px-3 py-2">{row.company_size ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{row.lead_score ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">
                  {row.icp_fit != null ? `${Math.round(row.icp_fit * 100)}%` : "—"}
                </td>
                <td className="px-3 py-2">{row.buying_stage?.replace(/_/g, " ") ?? "—"}</td>
                <td className="px-3 py-2">{row.source_provider ?? "—"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
