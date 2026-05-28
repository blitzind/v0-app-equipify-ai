"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { ProspectSearchContactDiscoveryButton } from "@/components/growth/prospect-search/prospect-search-contact-discovery-button"
import {
  GROWTH_DISCOVER_RESULTS_TABLE_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-discover-results"
import { GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import type { GrowthProspectSearchDiscoverResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { prospectSearchSelectionKey } from "@/lib/growth/prospect-search/prospect-search-selection"
import { cn } from "@/lib/utils"

export function ProspectSearchDiscoverCompaniesTable({
  rows,
  selectedId,
  selectedKeys,
  onSelect,
  onToggleSelection,
  onSelectAllVisible,
  onClearSelection,
  onContactDiscoveryComplete,
}: {
  rows: GrowthProspectSearchDiscoverResult[]
  selectedId: string | null
  selectedKeys: Set<string>
  onSelect: (company: GrowthProspectSearchCompanyResult) => void
  onToggleSelection: (company: GrowthProspectSearchCompanyResult, checked: boolean) => void
  onSelectAllVisible: () => void
  onClearSelection: () => void
  onContactDiscoveryComplete?: () => void | Promise<void>
}) {
  const allVisibleSelected =
    rows.length > 0 && rows.every((row) => selectedKeys.has(prospectSearchSelectionKey(row.company)))

  return (
    <div
      className="overflow-x-auto rounded-xl border border-border bg-card"
      data-qa={GROWTH_DISCOVER_RESULTS_TABLE_QA_MARKER}
      data-qa-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}
      data-result-mode="companies"
    >
      <table className="w-full min-w-[980px] text-left text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={(value) => {
                  if (value === true) onSelectAllVisible()
                  else onClearSelection()
                }}
                aria-label="Select all visible companies"
              />
            </th>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Website</th>
            <th className="px-3 py-2">Location</th>
            <th className="px-3 py-2">Industry</th>
            <th className="px-3 py-2">Confidence</th>
            <th className="px-3 py-2">Contact coverage</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.company_id}
              className={cn(
                "cursor-pointer border-t border-border hover:bg-muted/30",
                selectedId === row.company_id && "bg-violet-50/80",
              )}
              onClick={() => onSelect(row.company)}
            >
              <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedKeys.has(prospectSearchSelectionKey(row.company))}
                  onCheckedChange={(value) => onToggleSelection(row.company, value === true)}
                  aria-label={`Select ${row.company_name}`}
                />
              </td>
              <td className="px-3 py-2 font-medium">{row.company_name}</td>
              <td className="px-3 py-2">{row.domain ?? row.website ?? "—"}</td>
              <td className="px-3 py-2">{row.location ?? "—"}</td>
              <td className="px-3 py-2">{row.industry ?? "—"}</td>
              <td className="px-3 py-2 tabular-nums">
                {row.confidence != null ? `${Math.round(row.confidence * 100)}%` : "—"}
              </td>
              <td className="px-3 py-2">{row.contact_coverage_label ?? "Contact research needed"}</td>
              <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                <ProspectSearchContactDiscoveryButton
                  company={row.company}
                  compact
                  onComplete={onContactDiscoveryComplete}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
