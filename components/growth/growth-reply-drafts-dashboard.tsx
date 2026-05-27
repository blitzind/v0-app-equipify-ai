"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE,
  GROWTH_AI_REPLY_DRAFTING_QA_MARKER,
  type GrowthReplyDraftDashboard,
  type GrowthReplyDraftView,
  replyDraftStatusLabel,
} from "@/lib/growth/replies/reply-draft-types"

const RISK_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  low: "healthy",
  medium: "attention",
  high: "critical",
  blocked: "blocked",
}

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  draft: "attention",
  approved: "healthy",
  discarded: "neutral",
  sent: "healthy",
  blocked: "blocked",
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthReplyDraftDashboard
  message?: string
}

export function GrowthReplyDraftsDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthReplyDraftDashboard | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/replies/drafts/dashboard")
      const payload = (await response.json()) as DashboardPayload
      if (!response.ok) throw new Error(payload.message ?? "Could not load reply drafts dashboard.")
      setDashboard(payload.dashboard ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load reply drafts dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading reply drafts dashboard…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <GrowthBadge label={GROWTH_AI_REPLY_DRAFTING_QA_MARKER} tone="neutral" />
          <p className="text-xs text-muted-foreground">{GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/copilot/content-library">Content Library</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/inbox">Unified Inbox</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <GrowthEngineCard title="Reply Draft Overview">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Drafts pending review" value={String(dashboard?.pendingReview ?? 0)} />
          <StatTile label="Approved drafts" value={String(dashboard?.approved ?? 0)} />
          <StatTile label="Sent drafts" value={String(dashboard?.sent ?? 0)} />
          <StatTile label="Blocked drafts" value={String(dashboard?.blocked ?? 0)} />
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthEngineCard title="Top classifications">
          <div className="space-y-2">
            {(dashboard?.topClassifications ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No classifications yet.</p>
            ) : (
              (dashboard?.topClassifications ?? []).map((entry) => (
                <div key={entry.label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span>{entry.label}</span>
                  <GrowthBadge label={String(entry.count)} tone="neutral" />
                </div>
              ))
            )}
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Risk distribution">
          <div className="grid gap-2 sm:grid-cols-2">
            {(["low", "medium", "high", "blocked"] as const).map((risk) => (
              <StatTile
                key={risk}
                label={risk}
                value={String(dashboard?.riskDistribution?.[risk] ?? 0)}
              />
            ))}
          </div>
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Recent drafts">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Lead</th>
                <th className="px-2 py-2 font-medium">Thread</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Classification</th>
                <th className="px-2 py-2 font-medium">Risk</th>
                <th className="px-2 py-2 font-medium">Confidence</th>
                <th className="px-2 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.drafts ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    No reply drafts yet. Generate drafts from the unified inbox thread detail panel.
                  </td>
                </tr>
              ) : (
                (dashboard?.drafts ?? []).slice(0, 30).map((draft: GrowthReplyDraftView) => (
                  <tr key={draft.id} className="border-b">
                    <td className="px-2 py-2">{draft.leadLabel}</td>
                    <td className="max-w-[180px] truncate px-2 py-2">{draft.threadSubject}</td>
                    <td className="px-2 py-2">
                      <GrowthBadge label={replyDraftStatusLabel(draft.status)} tone={STATUS_TONE[draft.status] ?? "neutral"} />
                    </td>
                    <td className="px-2 py-2">{draft.classification ?? "—"}</td>
                    <td className="px-2 py-2">
                      <GrowthBadge label={draft.riskLevel} tone={RISK_TONE[draft.riskLevel] ?? "neutral"} />
                    </td>
                    <td className="px-2 py-2">{draft.confidence}%</td>
                    <td className="px-2 py-2">{formatDate(draft.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>
    </div>
  )
}
