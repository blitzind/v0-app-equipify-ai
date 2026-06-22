"use client"

import Link from "next/link"
import { CalendarClock, Phone, Reply, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  resolveInboxMeetingPropensity,
  resolveInboxNextBestAction,
  resolveInboxReplyConfidence,
} from "@/lib/growth/inbox/inbox-message-display-utils"
import { classificationLabel } from "@/lib/growth/inbox/reply-classifier"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"
import { growthWorkspaceInboxWorkflowHref, growthWorkspaceLeadHref, buildGrowthCallWorkspaceHref } from "@/lib/growth/navigation/growth-workspace-operator-links"

export const GROWTH_INBOX_NEXT_BEST_ACTION_BAR_QA_MARKER = "growth-inbox-next-best-action-bar-v1" as const

export function GrowthInboxNextBestActionBar() {
  const { selectedThread } = useGrowthInboxWorkspace()
  const { copilot } = useGrowthInboxLeadContext()

  if (!selectedThread) return null

  const recommended = resolveInboxNextBestAction(selectedThread)
  const replyConfidence = copilot?.confidenceTier ?? resolveInboxReplyConfidence(selectedThread)
  const meetingPropensity = resolveInboxMeetingPropensity(selectedThread)
  const callsHref = buildGrowthCallWorkspaceHref({ leadId: selectedThread.lead_id })
  const workflowHref = growthWorkspaceInboxWorkflowHref(selectedThread.lead_id)
  const leadHref = growthWorkspaceLeadHref(selectedThread.lead_id)

  return (
    <section
      aria-labelledby="inbox-next-best-action-heading"
      className="sticky top-[var(--inbox-conversation-header-offset,7.5rem)] z-10 shrink-0 border-b border-border/70 bg-muted/20 px-3 py-2"
      data-qa-marker={GROWTH_INBOX_NEXT_BEST_ACTION_BAR_QA_MARKER}
    >
      <h3 id="inbox-next-best-action-heading" className="sr-only">
        Next best action
      </h3>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{classificationLabel(selectedThread.classification)} prospect</span>
        <span>Reply confidence: {replyConfidence}</span>
        <span>Meeting propensity: {meetingPropensity}</span>
      </div>
      <p className="mt-1 text-xs text-foreground">
        <span className="font-medium">Recommended:</span> {recommended}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" asChild>
          <Link href={workflowHref}>
            <Reply className="mr-1 size-3" aria-hidden />
            Reply
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
          <Link href={callsHref}>
            <Phone className="mr-1 size-3" aria-hidden />
            Call
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
          <Link href={GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF}>
            <CalendarClock className="mr-1 size-3" aria-hidden />
            Book Meeting
          </Link>
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" asChild>
          <Link href={leadHref}>
            <UserRound className="mr-1 size-3" aria-hidden />
            Open Lead
          </Link>
        </Button>
      </div>
    </section>
  )
}
