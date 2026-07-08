"use client"

import { Badge } from "@/components/ui/badge"
import { formatSuppressionReason } from "@/lib/growth/prospect-search/prospect-search-status"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  "In Revenue Queue": "border-sky-200 bg-sky-50 text-sky-900",
  "Existing Customer": "border-emerald-200 bg-emerald-50 text-emerald-900",
  "Existing Prospect": "border-teal-200 bg-teal-50 text-teal-900",
  Suppressed: "border-red-200 bg-red-50 text-red-900",
  "Already Pushed": "border-amber-200 bg-amber-50 text-amber-900",
}

export function inferProspectSearchStatusBadges(
  row: GrowthProspectSearchCompanyResult,
): string[] {
  const badges: string[] = []

  if (row.is_suppressed) {
    const reason = formatSuppressionReason(row.suppression_reason)
    badges.push(reason ? `Suppressed (${reason})` : "Suppressed")
  }
  if (row.in_revenue_queue) badges.push("In Revenue Queue")
  else if (row.already_pushed) badges.push("Already Pushed")
  if (row.existing_customer) badges.push("Existing Customer")
  if (row.existing_prospect) badges.push("Existing Prospect")

  return badges
}

export function CompanyStatusBadges({
  row,
  className,
}: {
  row: GrowthProspectSearchCompanyResult
  className?: string
}) {
  const badges = inferProspectSearchStatusBadges(row)
  if (badges.length === 0) return null

  return (
    <div
      className={cn("flex flex-wrap gap-1", className)}
      data-qa-marker="growth-prospect-search-status-v1"
    >
      {badges.map((label) => {
        const baseLabel = label.startsWith("Suppressed") ? "Suppressed" : label
        return (
          <Badge
            key={label}
            variant="outline"
            className={cn("text-[10px] font-medium", STATUS_STYLES[baseLabel] ?? "")}
            title={label}
          >
            {label}
          </Badge>
        )
      })}
    </div>
  )
}
