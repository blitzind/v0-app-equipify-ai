"use client"

import Link from "next/link"
import { ExternalLink, MessageSquare, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthActionRequiredBadge } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import {
  adaptGrowthLeadToInboxConversationPreview,
  hasInboxConversationIntelligencePreview,
} from "@/lib/growth/inbox/inbox-conversation-intelligence-read-model"
import {
  growthWorkspaceConversationsHref,
  growthWorkspaceInboxHref,
  growthWorkspaceInboxWorkflowHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"

export const GROWTH_INBOX_CONVERSATION_INTELLIGENCE_CONTEXT_STRIP_QA_MARKER =
  "growth-inbox-conversation-intelligence-context-strip-v1" as const

export function GrowthInboxConversationIntelligenceContextStrip() {
  const { lead, leadId, threadId, loading } = useGrowthInboxLeadContext()

  if (loading || !lead || !leadId || !hasInboxConversationIntelligencePreview(lead)) {
    return null
  }

  const preview = adaptGrowthLeadToInboxConversationPreview(lead, { threadId })

  return (
    <div
      className="shrink-0 space-y-2 border-b border-border bg-muted/20 px-4 py-3"
      data-qa-marker={GROWTH_INBOX_CONVERSATION_INTELLIGENCE_CONTEXT_STRIP_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Conversation context</p>
        {preview.actionRequired ? <GrowthActionRequiredBadge /> : null}
        {preview.healthTier ? <GrowthBadge label={preview.healthTier} tone="healthy" /> : null}
        {preview.sentiment ? <GrowthBadge label={preview.sentiment} tone="neutral" /> : null}
        {preview.momentum ? <GrowthBadge label={preview.momentum.replace(/_/g, " ")} tone="attention" /> : null}
        {preview.healthScore != null ? (
          <span className="text-xs font-semibold tabular-nums text-foreground">{preview.healthScore}</span>
        ) : null}
      </div>
      {preview.summarySnippet ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{preview.summarySnippet}</p>
      ) : null}
      {preview.recommendationPreview ? (
        <p className="text-xs text-foreground">{preview.recommendationPreview}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
          <Link href={preview.conversationsHref}>
            <MessageSquare className="mr-1 size-3" />
            View Conversation
          </Link>
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" asChild>
          <Link href={preview.timelineHref}>
            <ExternalLink className="mr-1 size-3" />
            View Timeline
          </Link>
        </Button>
      </div>
    </div>
  )
}

export function GrowthInboxConversationCrossLinks({
  leadId,
  threadId,
}: {
  leadId: string
  threadId?: string | null
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
        <Link href={growthWorkspaceConversationsHref({ leadId, threadId })}>
          <MessageSquare className="mr-1 size-3" />
          View Conversation
        </Link>
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" asChild>
        <Link href={growthWorkspaceConversationsHref({ leadId })}>
          <ExternalLink className="mr-1 size-3" />
          View Timeline
        </Link>
      </Button>
    </div>
  )
}

export function GrowthConversationsActionCrossLinks({ leadId }: { leadId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
        <Link href={growthWorkspaceInboxHref({ leadId })}>
          <MessageSquare className="mr-1 size-3" />
          Reply
        </Link>
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" asChild>
        <Link href={growthWorkspaceInboxWorkflowHref(leadId)}>
          <Workflow className="mr-1 size-3" />
          Open Workflow
        </Link>
      </Button>
    </div>
  )
}
