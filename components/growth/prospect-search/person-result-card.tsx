"use client"

import { Badge } from "@/components/ui/badge"
import type { GrowthProspectSearchPersonResult } from "@/lib/growth/prospect-search/prospect-search-types"

export function PersonResultCard({ row }: { row: GrowthProspectSearchPersonResult }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{row.full_name ?? "Contact"}</h3>
          <p className="text-sm text-muted-foreground">{row.company_name}</p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {row.verification_status.replace(/_/g, " ")}
        </Badge>
      </div>
      <dl className="mt-3 grid gap-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Title</dt>
          <dd className="font-medium">{row.title ?? row.role ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="truncate font-medium">{row.email ?? "No verified email yet"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Phone</dt>
          <dd className="truncate font-medium">{row.phone ?? "Phone unavailable from current sources"}</dd>
        </div>
      </dl>
    </article>
  )
}
