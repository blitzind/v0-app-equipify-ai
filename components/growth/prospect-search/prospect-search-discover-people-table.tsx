"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER,
  type GrowthProspectSearchPeopleResultRow,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import { cn } from "@/lib/utils"

export function ProspectSearchDiscoverPeopleTable({
  rows,
  onOpenCompany,
}: {
  rows: GrowthProspectSearchPeopleResultRow[]
  onOpenCompany?: (companyId: string) => void
}) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground"
        data-qa-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}
        data-result-mode="people"
      >
        <p className="font-medium text-foreground">No verified contacts yet</p>
        <p className="mx-auto mt-2 max-w-md text-xs">
          Run contact research on company rows to populate People results. Connect a contact discovery
          provider to reveal verified emails and phones.
        </p>
      </div>
    )
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-border bg-card"
      data-qa-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}
      data-result-mode="people"
    >
      <table className="w-full min-w-[980px] text-left text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2">Location</th>
            <th className="px-3 py-2">Verification</th>
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
              <td className="px-3 py-2">{row.location ?? "—"}</td>
              <td className="px-3 py-2">
                <Badge variant="outline" className="text-[10px]">
                  {row.verification_status.replace(/_/g, " ")}
                </Badge>
                {row.compliance_status === "suppressed" ? (
                  <p className="mt-1 text-[10px] text-red-700">Suppressed, do not contact</p>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={row.compliance_status === "suppressed"}
                  onClick={() => onOpenCompany?.(row.company_id)}
                >
                  Review company
                </Button>
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
  className,
}: {
  rows: GrowthProspectSearchPeopleResultRow[]
  onOpenCompany?: (companyId: string) => void
  className?: string
}) {
  return (
    <div className={cn(className)} data-qa-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}>
      <ProspectSearchDiscoverPeopleTable rows={rows} onOpenCompany={onOpenCompany} />
    </div>
  )
}
