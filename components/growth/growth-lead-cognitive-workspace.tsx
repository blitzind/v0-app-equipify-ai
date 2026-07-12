"use client"

import { useMemo, useState, type ReactNode } from "react"
import { GrowthCognitiveSection } from "@/components/growth/cognitive-workspace/growth-cognitive-section"
import { GrowthAvaCurrentAssessmentPanel } from "@/components/growth/cognitive-workspace/growth-ava-current-assessment-panel"
import { GrowthAvaWhyIBelievePanel } from "@/components/growth/cognitive-workspace/growth-ava-why-i-believe-panel"
import { GrowthAvaEvidencePanel } from "@/components/growth/cognitive-workspace/growth-ava-evidence-panel"
import { GrowthAvaResearchJournalPanel } from "@/components/growth/cognitive-workspace/growth-ava-research-journal-panel"
import { GrowthAvaOperationalStatePanel } from "@/components/growth/cognitive-workspace/growth-ava-operational-state-panel"
import { GrowthSalesExecutionPlanPanel } from "@/components/growth/growth-sales-execution-plan-panel"
import { GrowthLeadDailyWorkQueuePanel } from "@/components/growth/growth-lead-daily-work-queue-panel"
import { GrowthNextBestActionBanner } from "@/components/growth/growth-next-best-action-banner"
import { GeV15AutomationRuntimeApprovalPanel } from "@/components/growth/automation/ge-v1-5-automation-runtime-approval-panel"
import { GrowthReplyWorkflowActionsPanel } from "@/components/growth/growth-reply-workflow-actions-panel"
import { GrowthLeadAssignmentPanel } from "@/components/growth/growth-lead-assignment-panel"
import { GrowthLeadTimelinePanel } from "@/components/growth/growth-lead-timeline-panel"
import { GrowthLeadActivityStream } from "@/components/growth/growth-lead-activity-stream"
import { GrowthLeadMultichannelTimelinePanel } from "@/components/growth/growth-lead-multichannel-timeline-panel"
import {
  buildAvaBeliefs,
  buildAvaCurrentAssessment,
  buildAvaEvidenceFacts,
  buildAvaOperationalItems,
  buildAvaResearchJournal,
} from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-mappers"
import {
  GROWTH_AVA_COGNITIVE_SECTION_IDS,
  GROWTH_AVA_COGNITIVE_SECTION_TITLES,
  GROWTH_AVA_COGNITIVE_WORKSPACE_QA_MARKER,
} from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"
import type { CommunicationStrategyDisplaySummary } from "@/lib/growth/contact-verification/communication-strategy-types"
import type { NativeRevenueDecisionDisplaySummary } from "@/lib/growth/contact-verification/native-revenue-decision-adapter"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import type { GrowthLead } from "@/lib/growth/types"

export type GrowthLeadCognitiveWorkspaceProps = {
  lead: GrowthLead
  prospectRun: GrowthResearchRunPublicView | null
  nativeDecision?: NativeRevenueDecisionDisplaySummary | null
  nativeCommunicationStrategy?: CommunicationStrategyDisplaySummary | null
  timelineRefreshToken: number
  rawExpandToken?: number
  humanWorkspaceChildren?: ReactNode
  rawIntelligenceChildren: ReactNode
  researchNotesSlot?: ReactNode
  onLeadUpdated?: (patch: Partial<GrowthLead>) => void
  onTimelineRefresh?: () => void
}

export function GrowthLeadCognitiveWorkspace({
  lead,
  prospectRun,
  nativeDecision = null,
  nativeCommunicationStrategy = null,
  timelineRefreshToken,
  rawExpandToken = 0,
  humanWorkspaceChildren,
  rawIntelligenceChildren,
  researchNotesSlot,
  onLeadUpdated,
  onTimelineRefresh,
}: GrowthLeadCognitiveWorkspaceProps) {
  const [pendingApprovalCount] = useState(0)

  const projectionInput = useMemo(
    () => ({
      lead,
      prospectRun,
      nativeDecision,
      nativeCommunicationStrategy,
      pendingApprovalCount,
    }),
    [lead, prospectRun, nativeDecision, nativeCommunicationStrategy, pendingApprovalCount],
  )

  const assessment = useMemo(() => buildAvaCurrentAssessment(projectionInput), [projectionInput])
  const beliefs = useMemo(() => buildAvaBeliefs(projectionInput), [projectionInput])
  const evidence = useMemo(() => buildAvaEvidenceFacts(projectionInput), [projectionInput])
  const journal = useMemo(() => buildAvaResearchJournal(projectionInput), [projectionInput])
  const operational = useMemo(() => buildAvaOperationalItems(lead), [lead])

  const hasPlanSignals = Boolean(
    lead.nextBestAction ||
      nativeDecision?.action_label ||
      prospectRun?.recommendedNextAction ||
      assessment.objective,
  )

  return (
    <div className="space-y-4" data-qa-marker={GROWTH_AVA_COGNITIVE_WORKSPACE_QA_MARKER}>
      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.assessment}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.assessment}
        defaultOpen
        persistKey="ava-cognitive-assessment"
      >
        <GrowthAvaCurrentAssessmentPanel assessment={assessment} />
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.why_i_believe}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.why_i_believe}
        defaultOpen
        persistKey="ava-cognitive-why"
      >
        <GrowthAvaWhyIBelievePanel beliefs={beliefs} />
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.evidence}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.evidence}
        defaultOpen
        persistKey="ava-cognitive-evidence"
      >
        <GrowthAvaEvidencePanel facts={evidence} />
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.execution_plan}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.execution_plan}
        defaultOpen
        persistKey="ava-cognitive-plan"
      >
        <div className="space-y-3">
          {assessment.objective ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current objective</p>
              <p className="mt-1 font-medium">{assessment.objective}</p>
            </div>
          ) : null}
          {assessment.blocker ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              <p className="text-xs uppercase tracking-wide">Blocked by</p>
              <p className="mt-1 font-medium">{assessment.blocker}</p>
            </div>
          ) : null}
          <GrowthNextBestActionBanner
            lead={lead}
            nativeDecision={nativeDecision}
            nativeCommunicationStrategy={nativeCommunicationStrategy}
          />
          <GrowthLeadDailyWorkQueuePanel lead={lead} />
          {!hasPlanSignals ? (
            <p className="text-sm text-muted-foreground">
              I have not created an execution plan for this account yet.
            </p>
          ) : null}
          <GrowthSalesExecutionPlanPanel leadId={lead.id} />
          {nativeCommunicationStrategy?.fallback_channels?.length ? (
            <div className="rounded-lg border border-border/60 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Fallback path</p>
              <p className="mt-1">
                {nativeCommunicationStrategy.fallback_channels.join(" → ")}
              </p>
            </div>
          ) : null}
        </div>
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.research_journal}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.research_journal}
        defaultOpen
        persistKey="ava-cognitive-journal"
      >
        <GrowthAvaResearchJournalPanel entries={journal} />
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.operational_state}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.operational_state}
        defaultOpen={operational.length > 0}
        persistKey="ava-cognitive-ops"
      >
        <GrowthAvaOperationalStatePanel items={operational} />
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.activity_timeline}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.activity_timeline}
        defaultOpen
        persistKey="ava-cognitive-timeline"
      >
        <div className="space-y-3">
          <GrowthLeadActivityStream lead={lead} />
          <GrowthLeadMultichannelTimelinePanel lead={lead} />
          <GrowthLeadTimelinePanel leadId={lead.id} refreshToken={timelineRefreshToken} />
        </div>
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.human_workspace}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.human_workspace}
        defaultOpen
        persistKey="ava-cognitive-human"
        forceVisible
      >
        <div className="space-y-3">
          {!assessment.operatorInvolvementRequired ? (
            <p className="rounded-lg border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
              Ava does not need anything from you right now.
            </p>
          ) : null}
          <GeV15AutomationRuntimeApprovalPanel leadId={lead.id} />
          <GrowthReplyWorkflowActionsPanel leadId={lead.id} compact showSequenceExit />
          <GrowthLeadAssignmentPanel
            lead={lead}
            compact
            onLeadUpdated={onLeadUpdated}
            onTimelineRefresh={onTimelineRefresh}
          />
          {researchNotesSlot}
          {humanWorkspaceChildren}
        </div>
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.raw_intelligence}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.raw_intelligence}
        defaultOpen={false}
        persistKey="ava-cognitive-raw"
        expandToken={rawExpandToken}
        headerAside={<span className="text-[11px] text-muted-foreground">Collapsed by default</span>}
      >
        <div className="space-y-3">{rawIntelligenceChildren}</div>
      </GrowthCognitiveSection>
    </div>
  )
}
