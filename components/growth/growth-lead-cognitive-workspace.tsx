"use client"

import { useMemo, useState, type ReactNode } from "react"
import { GrowthCognitiveSection } from "@/components/growth/cognitive-workspace/growth-cognitive-section"
import { GrowthAvaCurrentAssessmentPanel } from "@/components/growth/cognitive-workspace/growth-ava-current-assessment-panel"
import { GrowthAvaWhyIBelievePanel } from "@/components/growth/cognitive-workspace/growth-ava-why-i-believe-panel"
import { GrowthAvaEvidencePanel } from "@/components/growth/cognitive-workspace/growth-ava-evidence-panel"
import { GrowthAvaResearchJournalPanel } from "@/components/growth/cognitive-workspace/growth-ava-research-journal-panel"
import { GrowthAvaOperationalStatePanel } from "@/components/growth/cognitive-workspace/growth-ava-operational-state-panel"
import { GrowthAvaRawDomain } from "@/components/growth/cognitive-workspace/growth-ava-raw-domain"
import { GrowthAvaOperatorTaskGroup } from "@/components/growth/cognitive-workspace/growth-ava-operator-task-group"
import { GrowthSalesExecutionPlanPanel } from "@/components/growth/growth-sales-execution-plan-panel"
import { GrowthLeadDailyWorkQueuePanel } from "@/components/growth/growth-lead-daily-work-queue-panel"
import { GrowthNextBestActionBanner } from "@/components/growth/growth-next-best-action-banner"
import { GeV15AutomationRuntimeApprovalPanel } from "@/components/growth/automation/ge-v1-5-automation-runtime-approval-panel"
import { GrowthReplyWorkflowActionsPanel } from "@/components/growth/growth-reply-workflow-actions-panel"
import { GrowthLeadAssignmentPanel } from "@/components/growth/growth-lead-assignment-panel"
import { GrowthLeadTimelinePanel } from "@/components/growth/growth-lead-timeline-panel"
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
  GROWTH_AVA_COGNITIVE_WORKSPACE_COMPRESSION_QA_MARKER,
  GROWTH_AVA_COGNITIVE_WORKSPACE_QA_MARKER,
  type GrowthAvaRawDomainId,
} from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"
import {
  listAvaRawDomainSlots,
  resolveAvaRawDomainChildren,
} from "@/lib/growth/cognitive-workspace/growth-cognitive-raw-domain-resolver"
import type { CommunicationStrategyDisplaySummary } from "@/lib/growth/contact-verification/communication-strategy-types"
import type { NativeRevenueDecisionDisplaySummary } from "@/lib/growth/contact-verification/native-revenue-decision-adapter"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import type { GrowthLead } from "@/lib/growth/types"

export type GrowthLeadCognitiveRawDomains = Partial<Record<GrowthAvaRawDomainId, ReactNode>>

export type GrowthLeadCognitiveWorkspaceProps = {
  lead: GrowthLead
  prospectRun: GrowthResearchRunPublicView | null
  nativeDecision?: NativeRevenueDecisionDisplaySummary | null
  nativeCommunicationStrategy?: CommunicationStrategyDisplaySummary | null
  timelineRefreshToken: number
  rawExpandToken?: number
  /** GE-AIOS-25A-2 — which raw domain to force-open (from deep link). */
  rawDomainExpand?: GrowthAvaRawDomainId | null
  rawDomainExpandToken?: number
  humanWorkspaceChildren?: ReactNode
  /** Optional for fail-closed rendering if a caller omits domains. */
  rawDomains?: GrowthLeadCognitiveRawDomains | null
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
  rawDomainExpand = null,
  rawDomainExpandToken = 0,
  humanWorkspaceChildren,
  rawDomains = null,
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
    <div
      className="space-y-4"
      data-qa-marker={GROWTH_AVA_COGNITIVE_WORKSPACE_QA_MARKER}
      data-compression-marker={GROWTH_AVA_COGNITIVE_WORKSPACE_COMPRESSION_QA_MARKER}
    >
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
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Working on</p>
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
              <p className="mt-1">{nativeCommunicationStrategy.fallback_channels.join(" → ")}</p>
            </div>
          ) : null}
        </div>
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.research_journal}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.research_journal}
        defaultOpen={false}
        persistKey="ava-cognitive-journal"
      >
        <GrowthAvaResearchJournalPanel entries={journal} />
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.operational_state}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.operational_state}
        defaultOpen={false}
        persistKey="ava-cognitive-ops"
      >
        <GrowthAvaOperationalStatePanel items={operational} />
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.activity_timeline}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.activity_timeline}
        defaultOpen={false}
        persistKey="ava-cognitive-timeline"
      >
        <GrowthLeadTimelinePanel leadId={lead.id} refreshToken={timelineRefreshToken} />
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.human_workspace}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.human_workspace}
        defaultOpen
        persistKey="ava-cognitive-human"
        forceVisible
      >
        <div className="space-y-3">
          <GrowthAvaOperatorTaskGroup
            title="Status"
            description="Whether I need your attention on this account."
          >
            {!assessment.operatorInvolvementRequired ? (
              <p className="rounded-lg border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                I&apos;m continuing research and planning. I&apos;ll let you know if I need approval or
                additional direction.
              </p>
            ) : (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                {assessment.operatorInvolvementSummary}
              </p>
            )}
          </GrowthAvaOperatorTaskGroup>

          <GrowthAvaOperatorTaskGroup
            title="Approvals"
            description="Prepared work waiting for your decision."
          >
            <GeV15AutomationRuntimeApprovalPanel leadId={lead.id} />
          </GrowthAvaOperatorTaskGroup>

          <GrowthAvaOperatorTaskGroup
            title="Replies & follow-up"
            description="Inbox replies, knowledge requests, and follow-up choices."
          >
            <GrowthReplyWorkflowActionsPanel leadId={lead.id} compact showSequenceExit />
          </GrowthAvaOperatorTaskGroup>

          <GrowthAvaOperatorTaskGroup title="Ownership" description="Who owns this account.">
            <GrowthLeadAssignmentPanel
              lead={lead}
              compact
              onLeadUpdated={onLeadUpdated}
              onTimelineRefresh={onTimelineRefresh}
            />
          </GrowthAvaOperatorTaskGroup>

          {researchNotesSlot ? (
            <GrowthAvaOperatorTaskGroup title="Notes" description="Manual research notes for this account.">
              {researchNotesSlot}
            </GrowthAvaOperatorTaskGroup>
          ) : null}

          {humanWorkspaceChildren}
        </div>
      </GrowthCognitiveSection>

      <GrowthCognitiveSection
        id={GROWTH_AVA_COGNITIVE_SECTION_IDS.raw_intelligence}
        title={GROWTH_AVA_COGNITIVE_SECTION_TITLES.raw_intelligence}
        defaultOpen={false}
        persistKey="ava-cognitive-raw"
        expandToken={rawExpandToken}
        headerAside={
          <span className="text-[11px] text-muted-foreground">6 domains · collapsed by default</span>
        }
      >
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Full subsystem detail for verification. Expand only what you need.
          </p>
          {listAvaRawDomainSlots().map((slot) => {
            const children = resolveAvaRawDomainChildren(rawDomains, slot.domainId)
            if (!children) return null
            return (
              <GrowthAvaRawDomain
                key={slot.domainId}
                id={slot.elementId}
                title={slot.title}
                persistKey={slot.persistKey}
                defaultOpen={false}
                expandToken={rawDomainExpand === slot.domainId ? rawDomainExpandToken : 0}
              >
                {children}
              </GrowthAvaRawDomain>
            )
          })}
        </div>
      </GrowthCognitiveSection>
    </div>
  )
}
