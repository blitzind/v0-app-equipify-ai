"use client"

import { Badge } from "@/components/ui/badge"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export function CompanyEnrichmentBadges({ row }: { row: GrowthProspectSearchCompanyResult }) {
  const badges: Array<{ key: string; label: string }> = []

  if (row.existing_account) {
    badges.push({ key: "existing-account", label: "Existing account" })
  }
  if (row.crm_detected) {
    badges.push({ key: "crm", label: `CRM: ${row.crm_detected}` })
  }
  if (row.field_service_software) {
    badges.push({ key: "fsm", label: row.field_service_software })
  }
  if (row.website_platform) {
    badges.push({ key: "platform", label: row.website_platform })
  }
  if (row.revenue_range) {
    badges.push({ key: "revenue", label: row.revenue_range })
  }
  if (row.service_area) {
    badges.push({ key: "service-area", label: row.service_area })
  }

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1" data-qa-marker="growth-prospect-search-index-enrichment-v1">
      {badges.map((badge) => (
        <Badge key={badge.key} variant="outline" className="text-[10px]">
          {badge.label}
        </Badge>
      ))}
    </div>
  )
}
