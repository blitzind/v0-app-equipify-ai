"use client"

import { cn } from "@/lib/utils"
import { GROWTH_LEAD_STATUSES, type GrowthLead, type GrowthLeadStatus } from "@/lib/growth/types"

function statusLabel(status: string) {
  return status.replace(/_/g, " ")
}

function statusClass(status: GrowthLeadStatus) {
  switch (status) {
    case "new":
      return "bg-sky-50 text-sky-700 border-sky-200"
    case "qualified":
    case "call_ready":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "in_outreach":
    case "replied":
      return "bg-violet-50 text-violet-700 border-violet-200"
    case "converted":
      return "bg-teal-50 text-teal-700 border-teal-200"
    case "disqualified":
    case "archived":
      return "bg-slate-100 text-slate-600 border-slate-200"
    default:
      return "bg-amber-50 text-amber-700 border-amber-200"
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

type GrowthLeadsTableProps = {
  leads: GrowthLead[]
  onStatusChange: (leadId: string, status: GrowthLeadStatus) => Promise<void>
  onOpenLead?: (lead: GrowthLead) => void
  updatingLeadId?: string | null
}

export function GrowthLeadsTable({ leads, onStatusChange, onOpenLead, updatingLeadId = null }: GrowthLeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center text-sm text-muted-foreground">
        No growth leads yet. Add the first internal lead to start the inbox.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contact</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Priority</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground"> </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 align-top">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => onOpenLead?.(lead)}
                >
                  <div className="font-medium text-foreground underline-offset-2 hover:underline">{lead.companyName}</div>
                {lead.website ? <div className="text-xs text-muted-foreground">{lead.website}</div> : null}
                {lead.city || lead.state ? (
                  <div className="text-xs text-muted-foreground">
                    {[lead.city, lead.state].filter(Boolean).join(", ")}
                  </div>
                ) : null}
                </button>
              </td>
              <td className="px-4 py-3 align-top">
                <div>{lead.contactName ?? "—"}</div>
                {lead.contactEmail ? <div className="text-xs text-muted-foreground">{lead.contactEmail}</div> : null}
                {lead.contactPhone ? <div className="text-xs text-muted-foreground">{lead.contactPhone}</div> : null}
              </td>
              <td className="px-4 py-3 align-top">
                <div className="capitalize">{lead.sourceKind.replace(/_/g, " ")}</div>
                {lead.sourceDetail ? <div className="text-xs text-muted-foreground">{lead.sourceDetail}</div> : null}
              </td>
              <td className="px-4 py-3 align-top capitalize text-muted-foreground">{lead.researchPriority}</td>
              <td className="px-4 py-3 align-top">
                <select
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                    statusClass(lead.status),
                  )}
                  value={lead.status}
                  disabled={updatingLeadId === lead.id}
                  onChange={(event) => void onStatusChange(lead.id, event.target.value as GrowthLeadStatus)}
                >
                  {GROWTH_LEAD_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 align-top text-muted-foreground">{formatDate(lead.createdAt)}</td>
              <td className="px-4 py-3 align-top">
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => onOpenLead?.(lead)}
                >
                  Research
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
