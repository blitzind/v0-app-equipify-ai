"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { GrowthInboxWidgetErrorBoundary } from "@/components/growth/growth-inbox-widget-error-boundary"
import { GrowthReplyWorkflowActionsPanel } from "@/components/growth/growth-reply-workflow-actions-panel"
import { GrowthInboxActionCenterBookingEmbed } from "@/components/growth/inbox/growth-inbox-action-center-booking-embed"
import { GrowthInboxActionCenterCopilotEmbed } from "@/components/growth/inbox/growth-inbox-action-center-copilot-embed"
import { GrowthInboxActionCenterOpportunityEmbed } from "@/components/growth/inbox/growth-inbox-action-center-opportunity-embed"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium hover:bg-muted/30">
        <span>
          {title}
          {count != null && count > 0 ? <span className="ml-1 text-muted-foreground">({count})</span> : null}
        </span>
        <ChevronDown className={cn("size-3.5 transition-transform", open ? "rotate-180" : "")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/70 px-2 py-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}

export function GrowthInboxActionCenterWorkflowEmbeds() {
  const { leadId, workflowActions, opportunityRecommendations, bookingRecommendations, copilot } =
    useGrowthInboxLeadContext()
  const { actionLoading } = useGrowthInboxWorkspace()

  if (!leadId) return null

  const totalItems =
    workflowActions.length +
    opportunityRecommendations.length +
    bookingRecommendations.length +
    (copilot ? 1 : 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workflow & Recommendations
        </p>
        <span className="text-[10px] text-muted-foreground">{totalItems} item(s)</span>
      </div>

      <WorkflowGroup title="Workflow Actions" count={workflowActions.length} defaultOpen={workflowActions.length > 0}>
        <GrowthInboxWidgetErrorBoundary label="Workflow actions">
          <div className={actionLoading ? "pointer-events-none opacity-60" : undefined}>
            <GrowthReplyWorkflowActionsPanel
              leadId={leadId}
              compact
              showSequenceExit={false}
              hideRevenuePanel
              title="Pending workflow actions"
            />
          </div>
        </GrowthInboxWidgetErrorBoundary>
      </WorkflowGroup>

      <WorkflowGroup title="Opportunity Recommendations" count={opportunityRecommendations.length}>
        <GrowthInboxActionCenterOpportunityEmbed />
      </WorkflowGroup>

      <WorkflowGroup title="Booking Recommendations" count={bookingRecommendations.length}>
        <GrowthInboxActionCenterBookingEmbed />
      </WorkflowGroup>

      <WorkflowGroup title="Reply Copilot" count={copilot ? 1 : 0}>
        <GrowthInboxActionCenterCopilotEmbed />
      </WorkflowGroup>
    </div>
  )
}
