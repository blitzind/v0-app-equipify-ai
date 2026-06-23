"use client"

import { useEffect, useState } from "react"
import { DetailDrawer, DRAWER_INNER_SCROLL_CANVAS } from "@/components/detail-drawer"
import { GrowthCompanyIntelligenceSnapshot } from "@/components/growth/growth-company-intelligence-snapshot"
import { GrowthDecisionMakersPanel } from "@/components/growth/growth-decision-makers-panel"
import { GrowthOutboundPanel } from "@/components/growth/growth-outbound-panel"
import { GrowthLeadActivityStream } from "@/components/growth/growth-lead-activity-stream"
import { GrowthLeadEngagement } from "@/components/growth/growth-lead-engagement"
import { GrowthLeadCompliance } from "@/components/growth/growth-lead-compliance"
import { GrowthRelationshipIntelligence } from "@/components/growth/growth-relationship-intelligence"
import { GrowthConversationIntelligence } from "@/components/growth/growth-conversation-intelligence"
import { GrowthSequenceIntelligence } from "@/components/growth/growth-sequence-intelligence"
import { GrowthOpportunityReadiness } from "@/components/growth/growth-opportunity-readiness"
import { GrowthLeadOpportunityIntelligencePanel } from "@/components/growth/growth-lead-opportunity-intelligence-panel"
import { GrowthLeadBookingIntelligencePanel } from "@/components/growth/growth-lead-booking-intelligence-panel"
import { GrowthLeadRelationshipMemoryPanel } from "@/components/growth/growth-lead-relationship-memory-panel"
import { GeV15AutomationRuntimeApprovalPanel } from "@/components/growth/automation/ge-v1-5-automation-runtime-approval-panel"
import { GrowthReplyWorkflowActionsPanel } from "@/components/growth/growth-reply-workflow-actions-panel"
import { GrowthLeadMultichannelTimelinePanel } from "@/components/growth/growth-lead-multichannel-timeline-panel"
import { GrowthRevenueReadinessPanel } from "@/components/growth/growth-revenue-readiness-panel"
import { GrowthRevenueWorkflowWorkspacePanel } from "@/components/growth/growth-revenue-workflow-workspace-panel"
import { GrowthRevenueForecast } from "@/components/growth/growth-revenue-forecast"
import { GrowthRevenueForecastEvidencePanel } from "@/components/growth/growth-revenue-forecast-evidence-panel"
import { GrowthRevenueTimelinePanel } from "@/components/growth/growth-revenue-timeline-panel"
import { GrowthSalesExecutionPlanPanel } from "@/components/growth/growth-sales-execution-plan-panel"
import { GrowthVoiceRevenueIntelligencePassiveCard } from "@/components/growth/growth-voice-revenue-intelligence-passive-card"
import { GrowthVoiceRetentionIntelligencePassiveCard } from "@/components/growth/growth-voice-retention-intelligence-passive-card"
import { GrowthExecutiveOperatingIntelligence } from "@/components/growth/growth-executive-operating-intelligence"
import { GrowthOperationalCapacityIntelligence } from "@/components/growth/growth-operational-capacity-intelligence"
import { GrowthAiCopilot } from "@/components/growth/growth-ai-copilot"
import { GrowthPersonalizationEmbeddedPanel } from "@/components/growth/personalization/embedded/growth-personalization-embedded-panel"
import { GrowthCallCopilot } from "@/components/growth/growth-call-copilot"
import { GrowthRealtimeCallIntelligence } from "@/components/growth/growth-realtime-call-intelligence"
import { GrowthLeadCommandCenter } from "@/components/growth/growth-lead-command-center"
import { GrowthLeadMeetingIntelligence } from "@/components/growth/growth-lead-meeting-intelligence"
import { GrowthLeadCadencePanel } from "@/components/growth/growth-lead-cadence-panel"
import { GrowthLeadExecutionReadiness } from "@/components/growth/growth-lead-execution-readiness"
import { GrowthLeadMeetingOutcomeIntelligence } from "@/components/growth/growth-lead-meeting-outcome-intelligence"
import { GrowthLeadCustomerLifecyclePanel } from "@/components/growth/growth-lead-customer-lifecycle-panel"
import { GrowthLeadResearchPanel } from "@/components/growth/growth-lead-research-panel"
import { GrowthLeadTimelinePanel } from "@/components/growth/growth-lead-timeline-panel"
import { GrowthOperationalIntelligence } from "@/components/growth/growth-operational-intelligence"
import type { GrowthLeadResearchRun } from "@/lib/growth/research-types"
import type { GrowthLead } from "@/lib/growth/types"
import { GrowthCallWorkflowProvider } from "@/components/growth/growth-call-workflow-context"
import { applyGrowthCommandLeadFocusExpand, scrollGrowthCommandLeadFocusSection } from "@/lib/growth/command/command-lead-focus"

type GrowthLeadDrawerProps = {
  lead: GrowthLead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLeadUpdated?: (leadId: string, patch: Partial<GrowthLead>) => void
  onLeadSaved?: (lead: GrowthLead) => void
  drawerFocus?: string | null
  highlightMeetingId?: string | null
  pendingReplyId?: string | null
}

export function GrowthLeadDrawer({ lead, open, onOpenChange, onLeadUpdated, onLeadSaved, drawerFocus, highlightMeetingId, pendingReplyId }: GrowthLeadDrawerProps) {
  const [latestResearchRun, setLatestResearchRun] = useState<GrowthLeadResearchRun | null>(null)
  const [openAddDmForm, setOpenAddDmForm] = useState(false)
  const [timelineRefreshToken, setTimelineRefreshToken] = useState(0)

  useEffect(() => {
    if (!open || !drawerFocus || !lead) return
    applyGrowthCommandLeadFocusExpand(drawerFocus)
    scrollGrowthCommandLeadFocusSection(drawerFocus)
  }, [open, drawerFocus, lead?.id])

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
        <GrowthCallWorkflowProvider>
          <GrowthLeadCommandCenter
            lead={activeLead}
            onLeadUpdated={handleLeadUpdated}
            onLeadSaved={onLeadSaved}
            onAddDecisionMaker={handleAddDecisionMaker}
            onTimelineRefresh={() => setTimelineRefreshToken((token) => token + 1)}
          />

          <GrowthReplyWorkflowActionsPanel leadId={activeLead.id} compact showSequenceExit />

          <GeV15AutomationRuntimeApprovalPanel leadId={activeLead.id} />

          <GrowthExecutiveOperatingIntelligence lead={activeLead} />

          <GrowthOperationalCapacityIntelligence lead={activeLead} />

          <GrowthRevenueForecast lead={activeLead} />

          <GrowthRevenueForecastEvidencePanel leadId={activeLead.id} />

          <GrowthRevenueReadinessPanel lead={activeLead} />

          <GrowthSalesExecutionPlanPanel leadId={activeLead.id} />

          <GrowthRevenueTimelinePanel leadId={activeLead.id} />

          <GrowthRevenueWorkflowWorkspacePanel leadId={activeLead.id} compact />

          <GrowthVoiceRevenueIntelligencePassiveCard leadId={activeLead.id} />

          <GrowthVoiceRetentionIntelligencePassiveCard leadId={activeLead.id} />

          <GrowthOpportunityReadiness lead={activeLead} />

          <GrowthLeadOpportunityIntelligencePanel lead={activeLead} />

          <GrowthLeadBookingIntelligencePanel lead={activeLead} />

          <GrowthLeadRelationshipMemoryPanel lead={activeLead} />

          <GrowthLeadMultichannelTimelinePanel lead={activeLead} />

          <GrowthRelationshipIntelligence lead={activeLead} />

          <GrowthConversationIntelligence lead={activeLead} />

          <GrowthLeadMeetingIntelligence
            lead={activeLead}
            highlightMeetingId={highlightMeetingId}
            pendingReplyId={pendingReplyId}
            onTimelineRefresh={() => setTimelineRefreshToken((token) => token + 1)}
          />

          <GrowthLeadMeetingOutcomeIntelligence lead={activeLead} />

          <GrowthSequenceIntelligence lead={activeLead} />

          <GrowthLeadCadencePanel
            lead={activeLead}
            onTimelineRefresh={() => setTimelineRefreshToken((token) => token + 1)}
          />

          <GrowthLeadExecutionReadiness lead={activeLead} />

          <GrowthLeadCustomerLifecyclePanel
            lead={activeLead}
            onTimelineRefresh={() => setTimelineRefreshToken((token) => token + 1)}
          />

          <GrowthLeadEngagement lead={activeLead} />

          <GrowthLeadCompliance lead={activeLead} />

          <GrowthCallCopilot lead={activeLead} />

          <GrowthPersonalizationEmbeddedPanel leadId={activeLead.id} surface="lead" compact className="px-1" />

          <GrowthRealtimeCallIntelligence lead={activeLead} />

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
        </GrowthCallWorkflowProvider>
      </div>
    </DetailDrawer>
  )
}
