"use client"

import type { GrowthLead } from "@/lib/growth/types"

type GrowthCompanyIntelligenceSnapshotProps = {
  lead: GrowthLead
}

function Field({
  label,
  value,
  className,
}: {
  label: string
  value: string | null
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value?.trim() ? value : "—"}</dd>
    </div>
  )
}

export function GrowthCompanyIntelligenceSnapshot({ lead }: GrowthCompanyIntelligenceSnapshotProps) {
  const hasAny =
    lead.estimatedAnnualRevenue ||
    lead.estimatedEmployeeCount ||
    lead.fleetSizeEstimate ||
    lead.crmDetected ||
    lead.fieldServiceStackDetected

  if (!hasAny) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Company intelligence placeholders will populate after AI research.
      </div>
    )
  }

  return (
    <dl className="grid gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
      <Field label="Est. annual revenue" value={lead.estimatedAnnualRevenue} />
      <Field label="Est. employee count" value={lead.estimatedEmployeeCount} />
      <Field label="Fleet size estimate" value={lead.fleetSizeEstimate} />
      <Field label="CRM detected" value={lead.crmDetected} />
      <Field label="Field service stack" value={lead.fieldServiceStackDetected} className="sm:col-span-2" />
    </dl>
  )
}
