import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_INBOX_SYNC_THREAD_CONTINUITY_QA_MARKER,
  type GrowthInboxSyncDashboard,
} from "@/lib/growth/inbox-sync/inbox-sync-types"
import { enrichInboxSyncRunViews, listInboxSyncRuns } from "@/lib/growth/inbox-sync/inbox-sync-repository"

export async function fetchGrowthInboxSyncDashboard(admin: SupabaseClient): Promise<GrowthInboxSyncDashboard> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const runs = await listInboxSyncRuns(admin, 100)
  const views = await enrichInboxSyncRunViews(admin, runs)

  const recent = runs.filter((run) => run.startedAt >= since)
  const imported24h = recent.reduce((sum, run) => sum + run.messagesImported, 0)
  const duplicatesSkipped24h = recent.reduce((sum, run) => sum + run.duplicatesSkipped, 0)
  const failedRuns24h = recent.filter((run) => run.status === "failed").length
  const matched = recent.reduce((sum, run) => sum + run.threadsMatched, 0)
  const created = recent.reduce((sum, run) => sum + run.threadsCreated, 0)
  const imported = recent.reduce((sum, run) => sum + run.messagesImported, 0)
  const threadMatchRate = imported > 0 ? Math.round((matched / imported) * 100) : 0

  return {
    qa_marker: GROWTH_INBOX_SYNC_THREAD_CONTINUITY_QA_MARKER,
    lastSyncAt: runs[0]?.startedAt ?? null,
    imported24h,
    duplicatesSkipped24h,
    failedRuns24h,
    threadMatchRate,
    runs: views,
  }
}
