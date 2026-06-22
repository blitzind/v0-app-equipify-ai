"use client"

import { GrowthInboxConversationEmptyState } from "@/components/growth/inbox/growth-inbox-conversation-empty-state"
import { GrowthInboxConversationIntelligenceContextStrip } from "@/components/growth/inbox/growth-inbox-conversation-intelligence-context-strip"
import { GrowthInboxConversationHeader } from "@/components/growth/inbox/growth-inbox-conversation-header"
import { GrowthInboxConversationThreadOps } from "@/components/growth/inbox/growth-inbox-conversation-thread-ops"
import { GrowthInboxConversationTimeline } from "@/components/growth/inbox/growth-inbox-conversation-timeline"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  GROWTH_INBOX_CONVERSATION_WORKSPACE_QA_MARKER,
  GROWTH_INBOX_FINAL_POLISH_QA_MARKER,
} from "@/lib/growth/hubs/growth-inbox-conversation-workspace-config"
import { GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import { GROWTH_SMS_INBOX_QA_MARKER } from "@/lib/growth/sms/sms-inbox-audit"

export function GrowthInboxConversationColumn() {
  const { selectedThread, syncDetail } = useGrowthInboxWorkspace()

  if (!selectedThread) {
    return <GrowthInboxConversationEmptyState />
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-card"
      data-equipify-qa-marker={`${GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER}:${GROWTH_SMS_INBOX_QA_MARKER}`}
      data-growth-inbox-conversation-workspace={GROWTH_INBOX_CONVERSATION_WORKSPACE_QA_MARKER}
      data-growth-inbox-final-polish={GROWTH_INBOX_FINAL_POLISH_QA_MARKER}
    >
      <GrowthInboxConversationHeader />
      <GrowthInboxConversationIntelligenceContextStrip />
      <GrowthInboxConversationTimeline />

      {syncDetail?.sequenceExitCandidate ? (
        <div className="shrink-0 border-t border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
          Sequence exit review recommended — human approval required.
        </div>
      ) : null}

      <GrowthInboxConversationThreadOps />
    </div>
  )
}
