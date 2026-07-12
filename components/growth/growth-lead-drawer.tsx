"use client"

import { useEffect, useState } from "react"
import { DetailDrawer, DRAWER_INNER_SCROLL_CANVAS } from "@/components/detail-drawer"
import { GrowthCompanyIntelligenceSnapshot } from "@/components/growth/growth-company-intelligence-snapshot"
import { GrowthDecisionMakersPanel } from "@/components/growth/growth-decision-makers-panel"
import { GrowthOutboundPanel } from "@/components/growth/growth-outbound-panel"
import { GrowthLeadEngagement } from "@/components/growth/growth-lead-engagement"
import { GrowthLeadCompliance } from "@/components/growth/growth-lead-compliance"
import { GrowthRelationshipIntelligence } from "@/components/growth/growth-relationship-intelligence"
import { GrowthConversationIntelligence } from "@/components/growth/growth-conversation-intelligence"
import { GrowthSequenceIntelligence } from "@/components/growth/growth-sequence-intelligence"
import { GrowthOpportunityReadiness } from "@/components/growth/growth-opportunity-readiness"
import { GrowthLeadOpportunityIntelligencePanel } from "@/components/growth/growth-lead-opportunity-intelligence-panel"
import { GrowthLeadBookingIntelligencePanel } from "@/components/growth/growth-lead-booking-intelligence-panel"
import { GrowthLeadRelationshipMemoryPanel } from "@/components/growth/growth-lead-relationship-memory-panel"
import { GrowthRevenueReadinessPanel } from "@/components/growth/growth-revenue-readiness-panel"
import { GrowthRevenueWorkflowWorkspacePanel } from "@/components/growth/growth-revenue-workflow-workspace-panel"
import { GrowthRevenueForecast } from "@/components/growth/growth-revenue-forecast"
import { GrowthRevenueForecastEvidencePanel } from "@/components/growth/growth-revenue-forecast-evidence-panel"
import { GrowthRevenueTimelinePanel } from "@/components/growth/growth-revenue-timeline-panel"
import { GrowthVoiceRevenueIntelligencePassiveCard } from "@/components/growth/growth-voice-revenue-intelligence-passive-card"
import { GrowthVoiceRetentionIntelligencePassiveCard } from "@/components/growth/growth-voice-retention-intelligence-passive-card"
import { GrowthExecutiveOperatingIntelligence } from "@/components/growth/growth-executive-operating-intelligence"
import { GrowthOperationalCapacityIntelligence } from "@/components/growth/growth-operational-capacity-intelligence"
import { GrowthAiCopilot } from "@/components/growth/growth-ai-copilot"
import { GrowthPersonalizationEmbeddedPanel } from "@/components/growth/personalization/embedded/growth-personalization-embedded-panel"
import { GrowthCallCopilot } from "@/components/growth/growth-call-copilot"
import { GrowthRealtimeCallIntelligence } from "@/components/growth/growth-realtime-call-intelligence"
import { GrowthLeadCommandCenter } from "@/components/growth/growth-lead-command-center"
import { GrowthLeadCognitiveWorkspace } from "@/components/growth/growth-lead-cognitive-workspace"
import { GrowthLeadAutonomousExecutionGuardrailPanel } from "@/components/growth/growth-lead-autonomous-execution-guardrail-panel"
import { GrowthLeadMeetingIntelligence } from "@/components/growth/growth-lead-meeting-intelligence"
import { GrowthLeadCadencePanel } from "@/components/growth/growth-lead-cadence-panel"
import { GrowthLeadExecutionReadiness } from "@/components/growth/growth-lead-execution-readiness"
import { GrowthLeadMeetingOutcomeIntelligence } from "@/components/growth/growth-lead-meeting-outcome-intelligence"
import { GrowthLeadCustomerLifecyclePanel } from "@/components/growth/growth-lead-customer-lifecycle-panel"
import { GrowthLeadResearchPanel } from "@/components/growth/growth-lead-research-panel"
import { GrowthOperationalIntelligence } from "@/components/growth/growth-operational-intelligence"
import { GrowthLeadActivityStream } from "@/components/growth/growth-lead-activity-stream"
import { GrowthLeadMultichannelTimelinePanel } from "@/components/growth/growth-lead-multichannel-timeline-panel"
import type { GrowthLeadResearchRun } from "@/lib/growth/research-types"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import type { GrowthLead } from "@/lib/growth/types"
import { enqueueGrowthLeadResearchFromDrawer } from "@/lib/growth/research/growth-lead-research-drawer-client"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import { GrowthCallWorkflowProvider } from "@/components/growth/growth-call-workflow-context"
import {
  applyGrowthCommandLeadFocusExpand,
  resolveAvaRawDomainForFocus,
  scrollGrowthCommandLeadFocusSection,
} from "@/lib/growth/command/command-lead-focus"
import {
  GROWTH_AVA_RAW_INTELLIGENCE_FOCUS_TARGETS,
  type GrowthAvaRawDomainId,
} from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"
import type { CommunicationStrategyDisplaySummary } from "@/lib/growth/contact-verification/communication-strategy-types"
import type { NativeRevenueDecisionDisplaySummary } from "@/lib/growth/contact-verification/native-revenue-decision-adapter"

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

export function GrowthLeadDrawer({
  lead,
  open,
  onOpenChange,
  onLeadUpdated,
  onLeadSaved,
  drawerFocus,
  highlightMeetingId,
  pendingReplyId,
}: GrowthLeadDrawerProps) {
  const [latestResearchRun, setLatestResearchRun] = useState<GrowthLeadResearchRun | null>(null)
  const [latestProspectRun, setLatestProspectRun] = useState<GrowthResearchRunPublicView | null>(null)
  const [openAddDmForm, setOpenAddDmForm] = useState(false)
  const [timelineRefreshToken, setTimelineRefreshToken] = useState(0)
  const [rawExpandToken, setRawExpandToken] = useState(0)
  const [rawDomainExpand, setRawDomainExpand] = useState<GrowthAvaRawDomainId | null>(null)
  const [rawDomainExpandToken, setRawDomainExpandToken] = useState(0)
  const [nativeDecision, setNativeDecision] = useState<NativeRevenueDecisionDisplaySummary | null>(null)
  const [nativeCommunicationStrategy, setNativeCommunicationStrategy] =
    useState<CommunicationStrategyDisplaySummary | null>(null)
  const [nativeRelationshipRecommendation, setNativeRelationshipRecommendation] = useState<string | null>(null)

  const [researchEnqueueing, setResearchEnqueueing] = useState(false)

  useEffect(() => {
    if (!open || !lead) return
    if (!shouldAutoQueueLeadResearch(lead)) return

    let cancelled = false
    setResearchEnqueueing(true)
    void enqueueGrowthLeadResearchFromDrawer(lead).finally(() => {
      if (!cancelled) setResearchEnqueueing(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, lead?.id])

  useEffect(() => {
    if (!open || !lead) {
      setNativeDecision(null)
      setNativeCommunicationStrategy(null)
      setNativeRelationshipRecommendation(null)
      return
    }

    let cancelled = false
    void fetch(`/api/platform/growth/leads/${encodeURIComponent(lead.id)}/communication-strategy`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok?: boolean
          enabled?: boolean
          display_summary?: NativeRevenueDecisionDisplaySummary | null
          communication_strategy?: CommunicationStrategyDisplaySummary | null
          relationship_recommendation?: string | null
        }
        if (cancelled || !response.ok || !payload.ok || !payload.enabled) return
        setNativeDecision(payload.display_summary ?? null)
        setNativeCommunicationStrategy(payload.communication_strategy ?? null)
        setNativeRelationshipRecommendation(payload.relationship_recommendation ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setNativeDecision(null)
          setNativeCommunicationStrategy(null)
          setNativeRelationshipRecommendation(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, lead?.id])

  useEffect(() => {
    if (!open || !drawerFocus || !lead) return
    applyGrowthCommandLeadFocusExpand(drawerFocus)
    if (
      GROWTH_AVA_RAW_INTELLIGENCE_FOCUS_TARGETS.includes(
        drawerFocus as (typeof GROWTH_AVA_RAW_INTELLIGENCE_FOCUS_TARGETS)[number],
      ) ||
      drawerFocus === "decision-makers" ||
      drawerFocus === "research"
    ) {
      setRawExpandToken((token) => token + 1)
      const domain = resolveAvaRawDomainForFocus(drawerFocus)
      if (domain) {
        setRawDomainExpand(domain)
        setRawDomainExpandToken((token) => token + 1)
      }
    }
    scrollGrowthCommandLeadFocusSection(drawerFocus)
  }, [open, drawerFocus, lead?.id])

  if (!lead) return null

  const activeLead = lead

  function handleLeadUpdated(patch: Partial<GrowthLead>) {
    onLeadUpdated?.(activeLead.id, patch)
  }

  function handleAddDecisionMaker() {
    setOpenAddDmForm(true)
    setRawExpandToken((token) => token + 1)
    setRawDomainExpand("research")
    setRawDomainExpandToken((token) => token + 1)
    requestAnimationFrame(() => {
      document.getElementById("growth-decision-makers")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  const hasOpportunitySignals =
    activeLead.opportunityReadinessScore != null ||
    activeLead.opportunityReadinessTier != null ||
    (activeLead.opportunityReadinessTopSignals?.length ?? 0) > 0

  const hasEngagementSignals =
    Boolean(activeLead.engagementLastActivityAt) ||
    (activeLead.engagementScore != null && activeLead.engagementScore > 0)

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
            researchEnqueueing={researchEnqueueing}
            onLeadUpdated={handleLeadUpdated}
            onLeadSaved={onLeadSaved}
            onAddDecisionMaker={handleAddDecisionMaker}
            onTimelineRefresh={() => setTimelineRefreshToken((token) => token + 1)}
            nativeDecision={nativeDecision}
            nativeCommunicationStrategy={nativeCommunicationStrategy}
            cognitiveActionsOnly
          />

          <GrowthLeadCognitiveWorkspace
            lead={activeLead}
            prospectRun={latestProspectRun}
            nativeDecision={nativeDecision}
            nativeCommunicationStrategy={nativeCommunicationStrategy}
            timelineRefreshToken={timelineRefreshToken}
            rawExpandToken={rawExpandToken}
            rawDomainExpand={rawDomainExpand}
            rawDomainExpandToken={rawDomainExpandToken}
            onLeadUpdated={handleLeadUpdated}
            onTimelineRefresh={() => setTimelineRefreshToken((token) => token + 1)}
            rawDomains={{
              research: (
                <>
                  <GrowthLeadResearchPanel
                    id="growth-lead-research"
                    lead={activeLead}
                    autoQueueResearch
                    onProspectRunChange={setLatestProspectRun}
                    onLeadUpdated={handleLeadUpdated}
                    onLatestRunChange={setLatestResearchRun}
                  />
                  <GrowthCompanyIntelligenceSnapshot
                    lead={activeLead}
                    latestRun={latestResearchRun}
                    prospectRun={latestProspectRun}
                    researchEnqueueing={researchEnqueueing}
                  />
                  <GrowthDecisionMakersPanel
                    id="growth-decision-makers"
                    lead={activeLead}
                    onLeadUpdated={handleLeadUpdated}
                    openAddForm={openAddDmForm}
                    onOpenAddFormChange={setOpenAddDmForm}
                  />
                </>
              ),
              revenue: (
                <>
                  {hasOpportunitySignals ? <GrowthOpportunityReadiness lead={activeLead} /> : null}
                  {hasOpportunitySignals ? (
                    <GrowthLeadOpportunityIntelligencePanel lead={activeLead} />
                  ) : null}
                  <GrowthRevenueReadinessPanel lead={activeLead} />
                  <GrowthRevenueForecast lead={activeLead} />
                  <GrowthRevenueForecastEvidencePanel leadId={activeLead.id} />
                  <GrowthRevenueTimelinePanel leadId={activeLead.id} />
                  <GrowthRevenueWorkflowWorkspacePanel leadId={activeLead.id} compact />
                  <GrowthLeadBookingIntelligencePanel lead={activeLead} />
                  <GrowthLeadExecutionReadiness lead={activeLead} />
                  <GrowthLeadCustomerLifecyclePanel
                    lead={activeLead}
                    onTimelineRefresh={() => setTimelineRefreshToken((token) => token + 1)}
                  />
                  <GrowthVoiceRevenueIntelligencePassiveCard leadId={activeLead.id} />
                  <GrowthVoiceRetentionIntelligencePassiveCard leadId={activeLead.id} />
                </>
              ),
              communication: (
                <>
                  <GrowthSequenceIntelligence lead={activeLead} />
                  <GrowthLeadMeetingIntelligence
                    lead={activeLead}
                    highlightMeetingId={highlightMeetingId}
                    pendingReplyId={pendingReplyId}
                    onTimelineRefresh={() => setTimelineRefreshToken((token) => token + 1)}
                  />
                  <GrowthLeadMeetingOutcomeIntelligence lead={activeLead} />
                  <GrowthLeadCadencePanel
                    lead={activeLead}
                    onTimelineRefresh={() => setTimelineRefreshToken((token) => token + 1)}
                  />
                  <GrowthOutboundPanel lead={activeLead} />
                  <GrowthCallCopilot lead={activeLead} />
                  <GrowthRealtimeCallIntelligence lead={activeLead} />
                  <GrowthPersonalizationEmbeddedPanel
                    lead={activeLead}
                    leadId={activeLead.id}
                    surface="lead"
                    compact
                    className="px-1"
                  />
                  <GrowthLeadMultichannelTimelinePanel lead={activeLead} />
                </>
              ),
              relationship: (
                <>
                  <GrowthLeadRelationshipMemoryPanel lead={activeLead} />
                  <GrowthRelationshipIntelligence
                    lead={activeLead}
                    nativeRelationshipRecommendation={nativeRelationshipRecommendation}
                  />
                  <GrowthConversationIntelligence lead={activeLead} />
                  {hasEngagementSignals ? <GrowthLeadEngagement lead={activeLead} /> : null}
                </>
              ),
              operations: (
                <>
                  <GrowthOperationalIntelligence lead={activeLead} />
                  <GrowthOperationalCapacityIntelligence lead={activeLead} />
                  <GrowthExecutiveOperatingIntelligence lead={activeLead} />
                  <GrowthLeadAutonomousExecutionGuardrailPanel lead={activeLead} />
                  <GrowthLeadCompliance lead={activeLead} />
                </>
              ),
              advanced: (
                <>
                  <GrowthLeadActivityStream lead={activeLead} />
                  <GrowthAiCopilot lead={activeLead} />
                </>
              ),
            }}
          />
        </GrowthCallWorkflowProvider>
      </div>
    </DetailDrawer>
  )
}
