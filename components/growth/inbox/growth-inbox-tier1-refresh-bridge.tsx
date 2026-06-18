"use client"

import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { useGrowthInboxTier1PollRefresh } from "@/components/growth/inbox/growth-inbox-tier1-poll-coordinator"

/** Polls Tier 1 inbox routes when event bus is cold — threads + open conversation only. */
export function GrowthInboxTier1RefreshBridge() {
  const { refreshThreads, selectedThreadId, loadThreadDetail } = useGrowthInboxWorkspace()

  useGrowthInboxTier1PollRefresh(() => {
    void refreshThreads()
    if (selectedThreadId) void loadThreadDetail(selectedThreadId)
  })

  return null
}
