"use client"

import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  COMMAND_CENTER_UNIFICATION_QA_MARKER,
  WORKSPACE_STATUS_LABELS,
  type GrowthCommandCenterMetrics,
  type GrowthCommandCenterWorkspaceStatus,
} from "@/lib/growth/command-center-unification/command-center-unification-types"
import { BarChart3 } from "lucide-react"

function statusTone(status: GrowthCommandCenterWorkspaceStatus) {
  switch (status) {
    case "blocked":
      return "critical" as const
    case "needs_attention":
      return "attention" as const
    case "waiting_for_review":
      return "neutral" as const
    default:
      return "healthy" as const
  }
}

export function GrowthCommandCenterMetricsPanel({
  metrics,
  workspaceStatus,
  compact = false,
}: {
  metrics: GrowthCommandCenterMetrics
  workspaceStatus: GrowthCommandCenterWorkspaceStatus
  compact?: boolean
}) {
  const tiles = [
    { label: "Signals", value: metrics.total_signals },
    { label: "Inbox", value: metrics.inbox_items },
    { label: "Needs attention", value: metrics.needs_attention_count },
    { label: "Blocked", value: metrics.blocked_campaigns },
    { label: "Ready", value: metrics.ready_for_outreach_count },
    { label: "Approvals", value: metrics.approval_queue_count },
    { label: "High intent", value: metrics.high_intent_count },
    { label: "Conversations", value: metrics.active_conversations_count },
  ]

  return (
    <GrowthEngineCard
      title="Command Center Metrics"
      icon={<BarChart3 className="h-4 w-4" />}
      data-qa-marker={COMMAND_CENTER_UNIFICATION_QA_MARKER}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <GrowthBadge tone={statusTone(workspaceStatus)}>
          {WORKSPACE_STATUS_LABELS[workspaceStatus]}
        </GrowthBadge>
        {!compact ? (
          <>
            <GrowthBadge tone="neutral">{metrics.interventions_count} interventions</GrowthBadge>
            <GrowthBadge tone="neutral">{metrics.agent_plans_count} agent plans</GrowthBadge>
            <GrowthBadge tone="neutral">{metrics.waiting_for_review_count} waiting review</GrowthBadge>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-border bg-muted/20 p-2">
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p className="text-lg font-semibold">{tile.value}</p>
          </div>
        ))}
      </div>
    </GrowthEngineCard>
  )
}
