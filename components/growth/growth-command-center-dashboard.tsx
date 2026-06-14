"use client"

import { AidenDailyBriefingPanel } from "@/components/growth/aiden-daily-briefing-panel"
import { GrowthCommandDailyActionQueue } from "@/components/growth/growth-command-daily-action-queue"
import { GrowthCommandOpenOpportunitiesSection } from "@/components/growth/growth-command-open-opportunities-section"
import { GrowthCommandQuickActionsRail } from "@/components/growth/growth-command-quick-actions-rail"
import { GrowthCommandSequenceQueueSection } from "@/components/growth/growth-command-sequence-queue-section"
import { GrowthSignalFeedPanel } from "@/components/growth/growth-signal-feed-panel"
import { GrowthReplyWorkflowActionsPanel } from "@/components/growth/growth-reply-workflow-actions-panel"
import { useAidenBriefing } from "@/components/growth/use-aiden-briefing"
import { GROWTH_OPERATOR_UX_H3_QA_MARKER } from "@/lib/growth/operator-ux/operator-ux-h3-types"
import {
  GROWTH_COMMAND_CENTER_DAILY_WORKSPACE_QA_MARKER,
  GROWTH_COMMAND_CENTER_SPACING_QA_MARKER,
} from "@/lib/growth/command/command-action-types"

export function GrowthCommandCenterDashboard() {
  const { briefing, loading, error, reload } = useAidenBriefing(true)

  return (
    <div
      className="space-y-6"
      data-qa-marker={GROWTH_COMMAND_CENTER_SPACING_QA_MARKER}
      data-h3-qa={GROWTH_OPERATOR_UX_H3_QA_MARKER}
      data-daily-workspace={GROWTH_COMMAND_CENTER_DAILY_WORKSPACE_QA_MARKER}
    >
      <AidenDailyBriefingPanel
        headerVariant="compact"
        briefing={briefing}
        loading={loading}
        error={error}
        onReload={reload}
      />

      <GrowthCommandDailyActionQueue briefing={briefing} loading={loading} />

      <GrowthSignalFeedPanel compact title="Signal Feed" />

      <GrowthReplyWorkflowActionsPanel compact showSequenceExit title="Reply workflow queue" />

      <GrowthCommandSequenceQueueSection />

      <GrowthCommandOpenOpportunitiesSection />

      <GrowthCommandQuickActionsRail variant="section" />
    </div>
  )
}
