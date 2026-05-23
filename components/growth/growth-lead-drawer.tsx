"use client"

import { useState } from "react"
import { DetailDrawer, DRAWER_INNER_SCROLL_CANVAS } from "@/components/detail-drawer"
import { GrowthCompanyIntelligenceSnapshot } from "@/components/growth/growth-company-intelligence-snapshot"
import { GrowthDecisionMakersPanel } from "@/components/growth/growth-decision-makers-panel"
import { GrowthOutboundPanel } from "@/components/growth/growth-outbound-panel"
import { GrowthLeadActivityStream } from "@/components/growth/growth-lead-activity-stream"
import { GrowthLeadEngagement } from "@/components/growth/growth-lead-engagement"
import { GrowthRelationshipIntelligence } from "@/components/growth/growth-relationship-intelligence"
import { GrowthOpportunityReadiness } from "@/components/growth/growth-opportunity-readiness"
import { GrowthRevenueForecast } from "@/components/growth/growth-revenue-forecast"
import { GrowthExecutiveOperatingIntelligence } from "@/components/growth/growth-executive-operating-intelligence"
import { GrowthOperationalCapacityIntelligence } from "@/components/growth/growth-operational-capacity-intelligence"
import { GrowthAiCopilot } from "@/components/growth/growth-ai-copilot"
import { GrowthCallCopilot } from "@/components/growth/growth-call-copilot"
import { GrowthLeadCommandCenter } from "@/components/growth/growth-lead-command-center"
import { GrowthLeadResearchPanel } from "@/components/growth/growth-lead-research-panel"
import { GrowthLeadTimelinePanel } from "@/components/growth/growth-lead-timeline-panel"
import { GrowthOperationalIntelligence } from "@/components/growth/growth-operational-intelligence"
import type { GrowthLeadResearchRun } from "@/lib/growth/research-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadDrawerProps = {
  lead: GrowthLead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLeadUpdated?: (leadId: string, patch: Partial<GrowthLead>) => void
}

export function GrowthLeadDrawer({ lead, open, onOpenChange, onLeadUpdated }: GrowthLeadDrawerProps) {
  const [latestResearchRun, setLatestResearchRun] = useState<GrowthLeadResearchRun | null>(null)
  const [openAddDmForm, setOpenAddDmForm] = useState(false)
  const [timelineRefreshToken, setTimelineRefreshToken] = useState(0)

  if (!lead) return null

  const activeLead = lead

  function handleLeadUpdated(patch: Partial<GrowthLead>) {
    onLeadUpdated?.(activeLead.id, patch)
  }

  function handleAddDecisionMaker() {
    setOpenAddDmForm(true)
    requestAnimationFrame(() => {
      document.getElementById("growth-decision-makers")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  return (
    <DetailDrawer
      open={open}
      onClose={() => onOpenChange(false)}
      title={activeLead.companyName}
      subtitle={[activeLead.contactName, activeLead.city, activeLead.state].filter(Boolean).join(" · ") || "Growth lead"}
      width="xl"
    >
      <div className={DRAWER_INNER_SCROLL_CANVAS}>
        <GrowthLeadCommandCenter
          lead={activeLead}
          onLeadUpdated={handleLeadUpdated}
          onAddDecisionMaker={handleAddDecisionMaker}
        />

        <GrowthExecutiveOperatingIntelligence lead={activeLead} />

        <GrowthOperationalCapacityIntelligence lead={activeLead} />

        <GrowthRevenueForecast lead={activeLead} />

        <GrowthOpportunityReadiness lead={activeLead} />

        <GrowthRelationshipIntelligence lead={activeLead} />

        <GrowthLeadEngagement lead={activeLead} />

        <GrowthCallCopilot lead={activeLead} />

        <GrowthAiCopilot lead={activeLead} />

        <GrowthDecisionMakersPanel
          id="growth-decision-makers"
          lead={activeLead}
          onLeadUpdated={handleLeadUpdated}
          openAddForm={openAddDmForm}
          onOpenAddFormChange={setOpenAddDmForm}
        />

        <GrowthCompanyIntelligenceSnapshot lead={activeLead} latestRun={latestResearchRun} />

        <GrowthLeadResearchPanel
          id="growth-research"
          lead={activeLead}
          onLeadUpdated={handleLeadUpdated}
          onLatestRunChange={setLatestResearchRun}
        />

        <GrowthOutboundPanel lead={activeLead} />

        <GrowthOperationalIntelligence lead={activeLead} />

        <GrowthLeadActivityStream lead={activeLead} />

        <GrowthLeadTimelinePanel leadId={activeLead.id} refreshToken={timelineRefreshToken} />
      </div>
    </DetailDrawer>
  )
}
