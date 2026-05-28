"use client"

import { ProspectSearchDiscoverCompaniesTable } from "@/components/growth/prospect-search/prospect-search-discover-companies-table"
import { ProspectSearchPeopleFirstGrid } from "@/components/growth/prospect-search/prospect-search-people-first-grid"
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
  selectedPeopleKeys,
  onSelect,
  onToggleSelection,
  onSelectAllVisible,
  onClearSelection,
  onTogglePeopleSelection,
  onSelectAllVisiblePeople,
  onClearPeopleSelection,
  onContactDiscoveryComplete,
  onAddPersonToQueue,
  onAddPersonToLeadPipeline,
  onAddPersonToCallQueue,
  onOpenPersonContact,
  onRerunPersonDiscovery,
}: {
  mode: ProspectSearchResultMode
  rows: GrowthProspectSearchDiscoverResult[]
  peopleRows: GrowthProspectSearchPeopleResultRow[]
  selectedId: string | null
  selectedKeys: Set<string>
  selectedPeopleKeys?: Set<string>
  onSelect: (company: GrowthProspectSearchCompanyResult) => void
  onToggleSelection: (company: GrowthProspectSearchCompanyResult, checked: boolean) => void
  onSelectAllVisible: () => void
  onClearSelection: () => void
  onTogglePeopleSelection?: (row: GrowthProspectSearchPeopleResultRow, checked: boolean) => void
  onSelectAllVisiblePeople?: () => void
  onClearPeopleSelection?: () => void
  onContactDiscoveryComplete?: () => void | Promise<void>
  onAddPersonToQueue?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddPersonToLeadPipeline?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddPersonToCallQueue?: (row: GrowthProspectSearchPeopleResultRow) => void
  onOpenPersonContact?: (row: GrowthProspectSearchPeopleResultRow) => void
  onRerunPersonDiscovery?: (row: GrowthProspectSearchPeopleResultRow) => void
}) {
  if (mode === "people" || mode === "queue") {
    return (
      <ProspectSearchPeopleFirstGrid
        rows={peopleRows}
        selectedKeys={selectedPeopleKeys}
        onToggleSelection={onTogglePeopleSelection}
        onSelectAllVisible={onSelectAllVisiblePeople}
        onClearSelection={onClearPeopleSelection}
        onOpenCompany={(companyId) => {
          const company = rows.find((row) => row.company_id === companyId)?.company
          if (company) onSelect(company)
        }}
        onOpenContact={onOpenPersonContact}
        onAddToQueue={onAddPersonToQueue}
        onAddToLeadPipeline={onAddPersonToLeadPipeline}
        onAddToCallQueue={onAddPersonToCallQueue}
        onRerunDiscovery={onRerunPersonDiscovery}
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
