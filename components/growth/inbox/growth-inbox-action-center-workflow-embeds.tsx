"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { GrowthOnDemandFeature } from "@/components/growth/runtime/growth-on-demand-feature"
import { GrowthInboxWidgetErrorBoundary } from "@/components/growth/growth-inbox-widget-error-boundary"
import { GrowthReplyWorkflowActionsPanel } from "@/components/growth/growth-reply-workflow-actions-panel"
import { GrowthInboxActionCenterBookingEmbed } from "@/components/growth/inbox/growth-inbox-action-center-booking-embed"
import { GrowthInboxActionCenterCopilotEmbed } from "@/components/growth/inbox/growth-inbox-action-center-copilot-embed"
import { GrowthInboxActionCenterOpportunityEmbed } from "@/components/growth/inbox/growth-inbox-action-center-opportunity-embed"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxSharedData } from "@/components/growth/inbox/growth-inbox-shared-data-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { shouldDeferGrowthInboxTier3Hydration } from "@/lib/growth/inbox/growth-inbox-minimal-runtime-contract"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { GROWTH_INBOX_WORKSPACE_PHASE4_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import { cn } from "@/lib/utils"

function WorkflowGroup({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border border-border/70">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-medium leading-snug hover:bg-muted/30">
        <span>
          {title}
          {count != null && count > 0 ? <span className="ml-1 text-muted-foreground">({count})</span> : null}
        </span>
        <ChevronDown className={cn("size-3.5 transition-transform", open ? "rotate-180" : "")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 border-t border-border/70 px-3 py-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}

export function GrowthInboxActionCenterWorkflowEmbeds() {
  const {
    leadId,
    workflowActions,
    sequenceExitCandidates,
    opportunityRecommendations,
    bookingRecommendations,
    copilot,
    refreshWorkflow,
    refreshRecommendations,
    refreshSequenceExitCandidates,
  } = useGrowthInboxLeadContext()
  const { refreshCommandCenter } = useGrowthInboxSharedData()
  const { actionLoading } = useGrowthInboxWorkspace()
  const deferTier3 = shouldDeferGrowthInboxTier3Hydration()

  if (!leadId) return null

  const totalItems =
    workflowActions.length +
    sequenceExitCandidates.length +
    opportunityRecommendations.length +
    bookingRecommendations.length +
    (copilot ? 1 : 0)

  return (
    <div className="space-y-3" data-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE4_QA_MARKER}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Workflow & Recommendations
        </p>
        <span className="shrink-0 text-[10px] text-muted-foreground">{totalItems} item(s)</span>
      </div>

      <WorkflowGroup
        title="Workflow Actions"
        count={workflowActions.length}
        defaultOpen={workflowActions.length > 0}
      >
        <GrowthInboxWidgetErrorBoundary label="Workflow actions">
          <div className={actionLoading ? "pointer-events-none opacity-60" : undefined}>
            <GrowthReplyWorkflowActionsPanel
              leadId={leadId}
              compact
              showSequenceExit={!deferTier3}
              hideRevenuePanel
              title="Pending workflow actions"
              useExternalData
              externalItems={workflowActions}
              externalExitCandidates={sequenceExitCandidates}
              onExternalRefresh={refreshWorkflow}
            />
          </div>
        </GrowthInboxWidgetErrorBoundary>
      </WorkflowGroup>

      {deferTier3 ? (
        <GrowthOnDemandFeature
          feature="sequenceExitCandidates"
          scopeKey={leadId}
          title="Sequence exit candidates"
          description="Review pending sequence exits for this lead."
          compact
          load={async () => {
            await refreshSequenceExitCandidates()
          }}
        >
          <GrowthInboxWidgetErrorBoundary label="Sequence exits">
            <GrowthReplyWorkflowActionsPanel
              leadId={leadId}
              compact
              showSequenceExit
              hideRevenuePanel
              title="Sequence exit candidates"
              useExternalData
              externalItems={[]}
              externalExitCandidates={sequenceExitCandidates}
              onExternalRefresh={refreshWorkflow}
            />
          </GrowthInboxWidgetErrorBoundary>
        </GrowthOnDemandFeature>
      ) : null}

      <WorkflowGroup title="Opportunity Recommendations" count={opportunityRecommendations.length}>
        {deferTier3 ? (
          <GrowthOnDemandFeature
            feature="opportunityRecommendations"
            scopeKey={leadId}
            title="Opportunity recommendations"
            compact
            load={async () => {
              await refreshRecommendations()
            }}
          >
            <GrowthInboxActionCenterOpportunityEmbed />
          </GrowthOnDemandFeature>
        ) : (
          <GrowthInboxActionCenterOpportunityEmbed />
        )}
      </WorkflowGroup>

      <WorkflowGroup title="Booking Recommendations" count={bookingRecommendations.length}>
        {deferTier3 ? (
          <GrowthOnDemandFeature
            feature="bookingIntelligence"
            scopeKey={leadId}
            title="Booking recommendations"
            compact
            load={async () => {
              await refreshRecommendations()
            }}
          >
            <GrowthInboxActionCenterBookingEmbed />
          </GrowthOnDemandFeature>
        ) : (
          <GrowthInboxActionCenterBookingEmbed />
        )}
      </WorkflowGroup>

      <WorkflowGroup title="Reply Copilot" count={copilot ? 1 : 0}>
        <GrowthInboxActionCenterCopilotEmbed />
      </WorkflowGroup>

      {deferTier3 ? (
        <GrowthOnDemandFeature
          feature="revenueCommandCenter"
          scopeKey={leadId}
          title="Revenue command center"
          description="Cross-lead revenue signals for enriched recommendations."
          compact
          load={async () => {
            await refreshCommandCenter()
          }}
        >
          <p className="text-xs text-muted-foreground">Command center intelligence loaded for this session.</p>
        </GrowthOnDemandFeature>
      ) : null}
    </div>
  )
}
