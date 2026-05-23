"use client"

import { DetailDrawer, DrawerSection } from "@/components/detail-drawer"
import { GrowthCompanyIntelligenceSnapshot } from "@/components/growth/growth-company-intelligence-snapshot"
import { GrowthDecisionMakersPanel } from "@/components/growth/growth-decision-makers-panel"
import { GrowthLeadMomentumPanel } from "@/components/growth/growth-lead-momentum-panel"
import { GrowthLeadResearchPanel } from "@/components/growth/growth-lead-research-panel"
import { GrowthLeadTimelinePanel } from "@/components/growth/growth-lead-timeline-panel"
import { GrowthNextBestActionBanner } from "@/components/growth/growth-next-best-action-banner"
import { GrowthWorkflowHealthBadge } from "@/components/growth/growth-workflow-health-badge"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadDrawerProps = {
  lead: GrowthLead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLeadUpdated?: (leadId: string, patch: Partial<GrowthLead>) => void
}

function formatSource(lead: GrowthLead): string {
  const channel = lead.sourceChannel ?? lead.sourceKind.replace(/_/g, " ")
  const parts = [channel, lead.sourceCampaign, lead.sourceVendor].filter(Boolean)
  return parts.join(" · ")
}

export function GrowthLeadDrawer({ lead, open, onOpenChange, onLeadUpdated }: GrowthLeadDrawerProps) {
  if (!lead) return null

  function handleLeadUpdated(patch: Partial<GrowthLead>) {
    onLeadUpdated?.(lead.id, patch)
  }

  return (
    <DetailDrawer
      open={open}
      onClose={() => onOpenChange(false)}
      title={lead.companyName}
      subtitle={[lead.contactName, lead.city, lead.state].filter(Boolean).join(" · ") || "Growth lead"}
      width="xl"
    >
      <DrawerSection title="Next step">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthWorkflowHealthBadge status={lead.workflowHealth} reason={lead.workflowHealthReason} />
            <span className="text-xs text-muted-foreground">{formatSource(lead)}</span>
          </div>
          <GrowthNextBestActionBanner lead={lead} />
        </div>
      </DrawerSection>

      <DrawerSection title="Momentum">
        <GrowthLeadMomentumPanel lead={lead} />
      </DrawerSection>

      <DrawerSection title="Timeline">
        <GrowthLeadTimelinePanel leadId={lead.id} />
      </DrawerSection>

      <DrawerSection title="Overview">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Status" value={lead.status.replace(/_/g, " ")} />
          <Field label="Fit score" value={lead.score != null ? String(lead.score) : "—"} />
          <Field label="Source" value={formatSource(lead)} />
          <Field label="Contact email" value={lead.contactEmail ?? "—"} />
          <Field label="Contact phone" value={lead.contactPhone ?? "—"} />
          <Field label="Website" value={lead.website ?? "—"} />
          <Field label="Lead notes" value={lead.notes ?? "—"} className="sm:col-span-2" />
        </dl>
      </DrawerSection>

      <DrawerSection title="Company intelligence">
        <GrowthCompanyIntelligenceSnapshot lead={lead} />
      </DrawerSection>

      <DrawerSection title="Decision makers">
        <GrowthDecisionMakersPanel lead={lead} onLeadUpdated={handleLeadUpdated} />
      </DrawerSection>

      <DrawerSection title="Research">
        <GrowthLeadResearchPanel lead={lead} onLeadUpdated={handleLeadUpdated} />
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
