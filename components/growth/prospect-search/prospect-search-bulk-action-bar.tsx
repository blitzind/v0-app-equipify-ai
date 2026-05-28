"use client"

import Link from "next/link"
import { Inbox, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

export function ProspectSearchBulkActionBar({
  selectedCount,
  pushableCount,
  selectedCompanies,
  visibleCompanyCount,
  pushing,
  contactDiscoveryBusy = false,
  onPush,
  onClear,
  onFindContactsSelected,
  onFindContactsVisible,
  className,
}: {
  selectedCount: number
  pushableCount: number
  selectedCompanies: GrowthProspectSearchCompanyResult[]
  visibleCompanyCount: number
  pushing: boolean
  contactDiscoveryBusy?: boolean
  onPush: () => void
  onClear: () => void
  onFindContactsSelected?: () => void
  onFindContactsVisible?: () => void
  className?: string
}) {
  if (selectedCount <= 0) return null

  const externalCount = selectedCompanies.filter(
    (row) => row.source_type === "external_discovered",
  ).length
  const sourceSummary = summarizeSourceTypes(selectedCompanies)
  const busy = pushing || contactDiscoveryBusy

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      data-qa-marker="growth-prospect-search-bulk-action-bar"
      data-contact-discovery-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}
    >
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-violet-950">
          {selectedCount} {selectedCount === 1 ? "company" : "companies"} selected
        </p>
        {sourceSummary ? (
          <p className="text-xs text-violet-900/80">{sourceSummary}</p>
        ) : null}
        {pushableCount < selectedCount ? (
          <p className="text-xs text-red-800">
            {selectedCount - pushableCount} suppressed{" "}
            {selectedCount - pushableCount === 1 ? "row will" : "rows will"} be skipped on push.
          </p>
        ) : null}
        {externalCount > 0 ? (
          <p className="text-xs text-amber-900">
            {externalCount} external {externalCount === 1 ? "row may" : "rows may"} already exist in
            Lead Inbox — duplicates will be reported clearly.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onClear} disabled={busy}>
          <X className="mr-1 size-3.5" />
          Clear selection
        </Button>
        {onFindContactsSelected ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onFindContactsSelected}>
            <Users className="mr-1 size-3.5" />
            {contactDiscoveryBusy ? "Finding contacts…" : "Find contacts for selected"}
          </Button>
        ) : null}
        {onFindContactsVisible && visibleCompanyCount > 0 ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onFindContactsVisible}>
            <Users className="mr-1 size-3.5" />
            Find contacts for visible
          </Button>
        ) : null}
        <Button size="sm" onClick={onPush} disabled={busy}>
          <Inbox className="mr-1 size-3.5" />
          {pushing ? "Pushing…" : "Push selected to Lead Inbox"}
        </Button>
      </div>
    </div>
  )
}

export function ProspectSearchBulkPushSummary({
  message,
  workspaceUrl,
  tone,
}: {
  message: string
  workspaceUrl?: string | null
  tone: "success" | "warning" | "error"
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-950",
        tone === "error" && "border-red-200 bg-red-50 text-red-800",
      )}
    >
      <p>{message}</p>
      {workspaceUrl ? (
        <Link
          href={workspaceUrl}
          className="mt-2 inline-flex text-sm font-medium underline underline-offset-2"
        >
          View Lead Inbox
        </Link>
      ) : null}
    </div>
  )
}

function summarizeSourceTypes(companies: GrowthProspectSearchCompanyResult[]): string | null {
  const counts = new Map<string, number>()
  for (const row of companies) {
    counts.set(row.source_type, (counts.get(row.source_type) ?? 0) + 1)
  }
  if (counts.size === 0) return null

  const labels: Record<string, string> = {
    growth_lead: "Growth leads",
    lead_inbox: "Lead Inbox",
    crm_prospect: "CRM prospects",
    crm_customer: "CRM customers",
    external_discovered: "External discovery",
  }

  return [...counts.entries()]
    .map(([type, count]) => `${count} ${labels[type] ?? type}`)
    .join(" · ")
}
