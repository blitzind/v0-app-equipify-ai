import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AI_REPLY_DRAFTING_QA_MARKER,
  type GrowthReplyDraftDashboard,
  type GrowthReplyDraftRiskLevel,
} from "@/lib/growth/replies/reply-draft-types"
import { enrichReplyDraftViews, listReplyDrafts } from "@/lib/growth/replies/reply-draft-repository"

export async function fetchGrowthReplyDraftDashboard(admin: SupabaseClient): Promise<GrowthReplyDraftDashboard> {
  const drafts = await listReplyDrafts(admin, { limit: 200 })
  const views = await enrichReplyDraftViews(admin, drafts)

  const pendingReview = drafts.filter((draft) => draft.status === "draft").length
  const approved = drafts.filter((draft) => draft.status === "approved").length
  const sent = drafts.filter((draft) => draft.status === "sent").length
  const blocked = drafts.filter((draft) => draft.status === "blocked").length

  const classificationCounts = new Map<string, number>()
  for (const draft of drafts) {
    const key = draft.classification ?? "unknown"
    classificationCounts.set(key, (classificationCounts.get(key) ?? 0) + 1)
  }
  const topClassifications = [...classificationCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({ label, count }))

  const riskDistribution: Record<GrowthReplyDraftRiskLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    blocked: 0,
  }
  for (const draft of drafts) {
    riskDistribution[draft.riskLevel] += 1
  }

  return {
    qa_marker: GROWTH_AI_REPLY_DRAFTING_QA_MARKER,
    pendingReview,
    approved,
    sent,
    blocked,
    topClassifications,
    riskDistribution,
    drafts: views,
  }
}
