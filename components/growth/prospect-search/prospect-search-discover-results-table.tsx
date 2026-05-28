"use client"

import { ProspectSearchDiscoverCompaniesTable } from "@/components/growth/prospect-search/prospect-search-discover-companies-table"
import { ProspectSearchDiscoverPeopleTable } from "@/components/growth/prospect-search/prospect-search-discover-people-table"
import type {
  GrowthProspectSearchPeopleResultRow,
  ProspectSearchResultMode,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import type { GrowthProspectSearchDiscoverResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export function ProspectSearchDiscoverResultsTable({
  mode,
  rows,
  peopleRows,
  selectedId,
  selectedKeys,
  onSelect,
  onToggleSelection,
  onSelectAllVisible,
  onClearSelection,
  onContactDiscoveryComplete,
  onAddPersonToQueue,
  onAddPersonToLeadPipeline,
}: {
  mode: ProspectSearchResultMode
  rows: GrowthProspectSearchDiscoverResult[]
  peopleRows: GrowthProspectSearchPeopleResultRow[]
  selectedId: string | null
  selectedKeys: Set<string>
  onSelect: (company: GrowthProspectSearchCompanyResult) => void
  onToggleSelection: (company: GrowthProspectSearchCompanyResult, checked: boolean) => void
  onSelectAllVisible: () => void
  onClearSelection: () => void
  onContactDiscoveryComplete?: () => void | Promise<void>
  onAddPersonToQueue?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddPersonToLeadPipeline?: (row: GrowthProspectSearchPeopleResultRow) => void
}) {
  if (mode === "people") {
    return (
      <ProspectSearchDiscoverPeopleTable
        rows={peopleRows}
        onOpenCompany={(companyId) => {
          const company = rows.find((row) => row.company_id === companyId)?.company
          if (company) onSelect(company)
        }}
        onAddToQueue={onAddPersonToQueue}
        onAddToLeadPipeline={onAddPersonToLeadPipeline}
      />
    )
  }

  return (
    <ProspectSearchDiscoverCompaniesTable
      rows={rows}
      selectedId={selectedId}
      selectedKeys={selectedKeys}
      onSelect={onSelect}
      onToggleSelection={onToggleSelection}
      onSelectAllVisible={onSelectAllVisible}
      onClearSelection={onClearSelection}
      onContactDiscoveryComplete={onContactDiscoveryComplete}
    />
  )
}
