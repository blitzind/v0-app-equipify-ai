"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ArrowRight } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { useGrowthReplyIntelligenceDashboard } from "@/components/growth/inbox/use-growth-reply-intelligence-dashboard"
import { deriveGrowthInboxOverviewMetrics } from "@/lib/growth/inbox/growth-inbox-overview-metrics"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_ACTION_FIRST_CAUGHT_UP_TITLE,
  GROWTH_ACTION_FIRST_INBOX_HIGH_PRIORITY,
  GROWTH_ACTION_FIRST_INBOX_NEEDS_REVIEW,
  GROWTH_ACTION_FIRST_INBOX_REPLIES_WAITING,
  GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER,
} from "@/lib/growth/workspace/growth-workspace-action-first-1f"
import { recommends, nothingNeededFromYou } from "@/lib/workspace/ai-teammate-voice"

export function GrowthInboxActionFirstStrip() {
  const { teammate } = useAiTeammateIdentity()
  const { threads } = useGrowthInboxWorkspace()
  const { dashboard } = useGrowthReplyIntelligenceDashboard({ deferLoad: true })

  const metrics = useMemo(
    () => deriveGrowthInboxOverviewMetrics({ threads, replyDashboard: dashboard }),
    [threads, dashboard],
  )

  const actionTotal = metrics.unreadConversations + metrics.needsReview + metrics.highPriority

  if (actionTotal === 0) {
    return (
      <GrowthEngineCard
        title={recommends(teammate)}
        data-section="inbox-action-first"
        data-qa-marker={GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER}
      >
        <p className="text-sm font-medium">{GROWTH_ACTION_FIRST_CAUGHT_UP_TITLE}</p>
        <p className="mt-1 text-sm text-muted-foreground">{nothingNeededFromYou(teammate)}</p>
      </GrowthEngineCard>
    )
  }

  const items = [
    {
      id: "replies-waiting",
      label: GROWTH_ACTION_FIRST_INBOX_REPLIES_WAITING,
      count: metrics.unreadConversations,
      hint: "Threads with unread replies waiting on you.",
    },
    {
      id: "needs-review",
      label: GROWTH_ACTION_FIRST_INBOX_NEEDS_REVIEW,
      count: metrics.needsReview,
      hint: `Drafts and approvals ${teammate.name} prepared for your review.`,
    },
    {
      id: "high-priority",
      label: GROWTH_ACTION_FIRST_INBOX_HIGH_PRIORITY,
      count: metrics.highPriority,
      hint: "Conversations flagged as urgent or at risk.",
    },
  ].filter((item) => item.count > 0)

  return (
    <GrowthEngineCard
      title={recommends(teammate)}
      data-section="inbox-action-first"
      data-qa-marker={GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER}
    >
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">
                {item.label} · {item.count}
              </p>
              <p className="text-xs text-muted-foreground">{item.hint}</p>
            </div>
          </li>
        ))}
      </ul>
      <Link
        href={`${GROWTH_WORKSPACE_BASE_PATH}/inbox`}
        className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        Work the queue
        <ArrowRight className="size-4" />
      </Link>
    </GrowthEngineCard>
  )
}
