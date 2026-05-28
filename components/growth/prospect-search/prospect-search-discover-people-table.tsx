"use client"

import { ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  GROWTH_PEOPLE_HYDRATION_QA_MARKER,
  GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER,
  type GrowthProspectSearchPeopleResultRow,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import { cn } from "@/lib/utils"

export function ProspectSearchDiscoverPeopleTable({
  rows,
  onOpenCompany,
  onAddToQueue,
  onAddToLeadPipeline,
}: {
  rows: GrowthProspectSearchPeopleResultRow[]
  onOpenCompany?: (companyId: string) => void
  onAddToQueue?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddToLeadPipeline?: (row: GrowthProspectSearchPeopleResultRow) => void
}) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground"
        data-qa-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}
        data-people-hydration-marker={GROWTH_PEOPLE_HYDRATION_QA_MARKER}
        data-result-mode="people"
      >
        <p className="font-medium text-foreground">No verified contacts yet</p>
        <p className="mx-auto mt-2 max-w-md text-xs">
          Run Find contacts on company rows to extract publicly listed people from company websites.
          No paid providers or fabricated contacts.
        </p>
      </div>
    )
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-border bg-card"
      data-qa-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}
      data-people-hydration-marker={GROWTH_PEOPLE_HYDRATION_QA_MARKER}
      data-result-mode="people"
    >
      <table className="w-full min-w-[1180px] text-left text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Confidence</th>
            <th className="px-3 py-2">Readiness</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border hover:bg-muted/30">
              <td className="px-3 py-2 font-medium">{row.full_name ?? "—"}</td>
              <td className="px-3 py-2">{row.company_name}</td>
              <td className="px-3 py-2">{row.title ?? row.role ?? "—"}</td>
              <td className="px-3 py-2">
                <div>{row.email ?? row.email_reason ?? "No verified email yet"}</div>
              </td>
              <td className="px-3 py-2">
                <div>{row.phone ?? row.phone_reason ?? "Phone unavailable from current sources"}</div>
              </td>
              <td className="px-3 py-2">
                <div className="max-w-[180px] truncate" title={row.source_label ?? undefined}>
                  {row.source_label ?? "Internal contact research"}
                </div>
                {row.last_checked_at ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Checked {new Date(row.last_checked_at).toLocaleDateString()}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-2">{Math.round(row.confidence * 100)}%</td>
              <td className="px-3 py-2">
                <Badge variant="outline" className="text-[10px]">
                  {row.readiness_label}
                </Badge>
                {row.compliance_status === "suppressed" ? (
                  <p className="mt-1 text-[10px] text-red-700">Suppressed for outreach</p>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={row.compliance_status === "suppressed"}
                    onClick={() => onAddToQueue?.(row)}
                  >
                    Add to Queue
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={row.compliance_status === "suppressed"}
                    onClick={() => onAddToLeadPipeline?.(row)}
                  >
                    Lead Pipeline
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpenCompany?.(row.company_id)}
                  >
                    Review
                  </Button>
                  {row.source_page_url ? (
                    <Button type="button" size="sm" variant="ghost" asChild>
                      <a href={row.source_page_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 size-3" />
                        Source
                      </a>
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ProspectSearchPeopleResultsPanel({
  rows,
  onOpenCompany,
  onAddToQueue,
  onAddToLeadPipeline,
  className,
}: {
  rows: GrowthProspectSearchPeopleResultRow[]
  onOpenCompany?: (companyId: string) => void
  onAddToQueue?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddToLeadPipeline?: (row: GrowthProspectSearchPeopleResultRow) => void
  className?: string
}) {
  return (
    <div className={cn(className)} data-qa-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}>
      <ProspectSearchDiscoverPeopleTable
        rows={rows}
        onOpenCompany={onOpenCompany}
        onAddToQueue={onAddToQueue}
        onAddToLeadPipeline={onAddToLeadPipeline}
      />
    </div>
  )
}
