"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  GrowthAttentionDashboard,
  GrowthAttentionQueueView,
  GrowthNotification,
} from "@/lib/growth/notifications/notification-types"
import { GROWTH_NOTIFICATIONS_QA_MARKER } from "@/lib/growth/notifications/notification-types"

const VIEW_LABELS: Record<GrowthAttentionQueueView, string> = {
  my_work: "My Work",
  needs_action: "Needs Action",
  critical: "Critical",
  today: "Today",
  overdue: "Overdue",
  unassigned: "Unassigned",
  provider_issues: "Provider Issues",
  approval_queue: "Approval Queue",
}

function severityTone(severity: string): "critical" | "high" | "medium" | "low" | "neutral" {
  if (severity === "critical") return "critical"
  if (severity === "high") return "high"
  if (severity === "medium") return "medium"
  if (severity === "low") return "low"
  return "neutral"
}

export function GrowthAttentionCenter() {
  const [dashboard, setDashboard] = useState<GrowthAttentionDashboard | null>(null)
  const [items, setItems] = useState<GrowthNotification[]>([])
  const [view, setView] = useState<GrowthAttentionQueueView>("needs_action")
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (activeView: GrowthAttentionQueueView, refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view: activeView, ownerUserId: "me", limit: "25" })
      if (refresh) params.set("refresh", "true")
      const res = await fetch(`/api/platform/growth/attention/feed?${params.toString()}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        feed?: { items?: GrowthNotification[] }
        dashboard?: GrowthAttentionDashboard
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load attention feed.")
      setItems(data.feed?.items ?? [])
      setDashboard(data.dashboard ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load attention feed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(view)
  }, [load, view])

  async function updateNotification(id: string, action: "acknowledge" | "complete") {
    setActingId(id)
    try {
      const res = await fetch(`/api/platform/growth/attention/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error("Could not update notification.")
      await load(view)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update notification.")
    } finally {
      setActingId(null)
    }
  }

  return (
    <GrowthEngineCard title="Attention Center">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Deterministic operator notifications — who owns what and what needs action next.
          </p>
          <GrowthBadge label={GROWTH_NOTIFICATIONS_QA_MARKER} tone="neutral" />
        </div>
        <Button size="sm" variant="outline" onClick={() => void load(view, true)} disabled={loading}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>

      {dashboard ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <StatTile label="Critical" value={dashboard.criticalCount} />
          <StatTile label="Needs approval" value={dashboard.needsApprovalCount} />
          <StatTile label="High-fit waiting" value={dashboard.highFitWaitingCount} />
          <StatTile label="Provider issues" value={dashboard.providerIssueCount} />
          <StatTile label="Sequence failures" value={dashboard.sequenceFailureCount} />
          <StatTile label="Unassigned" value={dashboard.unassignedCount} />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(VIEW_LABELS) as GrowthAttentionQueueView[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              view === key ? "border-indigo-200 bg-indigo-50 text-indigo-800" : "border-border text-muted-foreground"
            }`}
          >
            {VIEW_LABELS[key]}
          </button>
        ))}
      </div>

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading attention queue…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications in this view.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge label={item.severity} tone={severityTone(item.severity)} />
                    <GrowthBadge label={item.notificationType.replace(/_/g, " ")} tone="neutral" />
                    {item.collapseCount > 1 ? (
                      <GrowthBadge label={`${item.collapseCount} collapsed`} tone="neutral" />
                    ) : null}
                  </div>
                  <p className="mt-1 font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()} · priority {item.priorityScore}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.actionUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={item.actionUrl}>
                        <ExternalLink className="mr-2 size-4" />
                        Open
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actingId === item.id}
                    onClick={() => void updateNotification(item.id, "acknowledge")}
                  >
                    {actingId === item.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                    Ack
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </GrowthEngineCard>
  )
}
