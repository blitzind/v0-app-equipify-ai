"use client"

import Link from "next/link"
import { Reply } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  displayInboxLeadLabel,
  INBOX_STATUS_TONE,
} from "@/components/growth/inbox/growth-inbox-shared-ui"
import {
  buildGrowthInboxCrmSummaryChips,
  GROWTH_INBOX_FINAL_POLISH_QA_MARKER,
} from "@/lib/growth/hubs/growth-inbox-conversation-workspace-config"
import {
  formatInboxCompactTimestamp,
  parseInboxLeadLabelParts,
  resolveInboxStatusBadgeLabels,
} from "@/lib/growth/inbox/inbox-message-display-utils"
import { classificationLabel } from "@/lib/growth/inbox/reply-classifier"
import { growthWorkspaceInboxWorkflowHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER } from "@/lib/growth/operator-ux/growth-operator-primary-actions-7a2"

export const GROWTH_INBOX_CONVERSATION_HEADER_QA_MARKER = "growth-inbox-conversation-header-v2" as const

function GrowthInboxCrmSummaryStrip() {
  const { selectedThread } = useGrowthInboxWorkspace()
  const { lead, bookingRecommendations, playbook } = useGrowthInboxLeadContext()

  if (!selectedThread) return null

  const chips = buildGrowthInboxCrmSummaryChips({
    fitScore: lead?.score ?? lead?.conversationHealthScore ?? selectedThread.priority_score,
    stageLabel: classificationLabel(selectedThread.classification),
    ownerLabel: selectedThread.owner_label ?? lead?.executiveOwner ?? null,
    meetingLabel:
      bookingRecommendations[0]?.availabilityHint ??
      bookingRecommendations[0]?.title ??
      null,
    sequenceLabel: playbook?.title ?? lead?.recommendedSequenceReason ?? null,
  })

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 border-t border-border/60 px-3 py-1.5" aria-label="CRM summary">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px]"
          title={`${chip.label}: ${chip.value}`}
        >
          <span className="font-medium text-muted-foreground">{chip.label}:</span>
          <span className="truncate text-foreground">{chip.value}</span>
        </span>
      ))}
    </div>
  )
}

export function GrowthInboxConversationHeader() {
  const { selectedThread } = useGrowthInboxWorkspace()

  if (!selectedThread) return null

  const { company, contact } = parseInboxLeadLabelParts(selectedThread.lead_label)
  const statusLabels = resolveInboxStatusBadgeLabels(selectedThread)
  const workflowHref = growthWorkspaceInboxWorkflowHref(selectedThread.lead_id)

  return (
    <header
      className="sticky top-0 z-20 shrink-0 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      data-qa-marker={GROWTH_INBOX_CONVERSATION_HEADER_QA_MARKER}
      data-growth-inbox-final-polish={GROWTH_INBOX_FINAL_POLISH_QA_MARKER}
      data-growth-ops-click-reduction={GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER}
    >
      <div className="px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {contact || displayInboxLeadLabel(selectedThread)}
          </h2>
          <p className="truncate text-xs text-muted-foreground">{company}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {statusLabels.map((label) => (
              <GrowthBadge
                key={label}
                label={label}
                tone={INBOX_STATUS_TONE[selectedThread.priority_tier] ?? "neutral"}
              />
            ))}
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Last reply {formatInboxCompactTimestamp(selectedThread.last_message_at)}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="default" className="h-7 px-2 text-xs" asChild>
            <Link href={workflowHref}>
              <Reply className="mr-1 size-3" aria-hidden />
              Reply
            </Link>
          </Button>
        </div>
      </div>
      <GrowthInboxCrmSummaryStrip />
    </header>
  )
}
