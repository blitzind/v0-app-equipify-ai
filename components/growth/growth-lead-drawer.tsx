"use client"

import { DetailDrawer, DrawerSection } from "@/components/detail-drawer"
import { GrowthLeadResearchPanel } from "@/components/growth/growth-lead-research-panel"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadDrawerProps = {
  lead: GrowthLead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLeadUpdated?: (leadId: string, patch: Partial<GrowthLead>) => void
}

export function GrowthLeadDrawer({ lead, open, onOpenChange, onLeadUpdated }: GrowthLeadDrawerProps) {
  if (!lead) return null

  return (
    <DetailDrawer
      open={open}
      onClose={() => onOpenChange(false)}
      title={lead.companyName}
      subtitle={[lead.contactName, lead.city, lead.state].filter(Boolean).join(" · ") || "Growth lead"}
      width="xl"
    >
      <DrawerSection title="Overview">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Status" value={lead.status.replace(/_/g, " ")} />
          <Field label="Fit score" value={lead.score != null ? String(lead.score) : "—"} />
          <Field label="Source" value={`${lead.sourceKind}${lead.sourceDetail ? ` — ${lead.sourceDetail}` : ""}`} />
          <Field label="Contact email" value={lead.contactEmail ?? "—"} />
          <Field label="Contact phone" value={lead.contactPhone ?? "—"} />
          <Field label="Website" value={lead.website ?? "—"} />
          <Field label="Lead notes" value={lead.notes ?? "—"} className="sm:col-span-2" />
        </dl>
      </DrawerSection>

      <DrawerSection title="Research">
        <GrowthLeadResearchPanel
          lead={lead}
          onLeadUpdated={(patch) => onLeadUpdated?.(lead.id, patch)}
        />
      </DrawerSection>
    </DetailDrawer>
  )
}

function Field({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  )
}
