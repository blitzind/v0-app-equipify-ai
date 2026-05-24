"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Mail, RefreshCw, ShieldAlert, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthOutreachQueueItemWithLead } from "@/lib/growth/outreach/outreach-queue-types"
import {
  GROWTH_OUTREACH_QUEUE_CHANNEL_LABELS,
  GROWTH_OUTREACH_QUEUE_PRIORITY_LABELS,
} from "@/lib/growth/outreach/outreach-queue-types"

type DashboardPayload = {
  sections: {
    pendingApproval: GrowthOutreachQueueItemWithLead[]
    scheduled: GrowthOutreachQueueItemWithLead[]
    failed: GrowthOutreachQueueItemWithLead[]
    executedRecently: GrowthOutreachQueueItemWithLead[]
    followUpDraftsPendingApproval: Array<{
      id: string
      leadId: string
      generationType: string
      companyName: string
      createdAt: string
    }>
  }
  analytics: {
    approvalRate: number
    medianTimeToApprovalMs: number | null
    executionRate: number
    failedExecutionRate: number
    regenerationRate: number
    channelMix: Array<{ channel: string; count: number }>
  }
  providerHealth: Array<{
    id: string
    label: string
    provider: string
    providerFamily: string
    lifecycleStatus: string
    healthReason: string | null
    temporarilyDegraded: boolean
    supportsSend: string
    validationFailureCount: number
  }>
  regenerationHotspots: Array<{ leadId: string; count: number; latestVersion: number }>
}

function QueueList({
  title,
  items,
  onAction,
  actingId,
}: {
  title: string
  items: GrowthOutreachQueueItemWithLead[]
  onAction: (action: "approve" | "execute" | "cancel", queueId: string) => void
  actingId: string | null
}) {
  return (
    <GrowthEngineCard title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.companyName}</p>
                  <p className="text-muted-foreground">
                    {GROWTH_OUTREACH_QUEUE_CHANNEL_LABELS[item.channel]} ·{" "}
                    {GROWTH_OUTREACH_QUEUE_PRIORITY_LABELS[item.priority]} · confidence {item.executionConfidence}
                  </p>
                  {item.payloadSnapshot.subject ? (
                    <p className="mt-1 text-xs text-foreground/80">{item.payloadSnapshot.subject}</p>
                  ) : null}
                  {item.approvalNote ? (
                    <p className="mt-1 text-xs text-muted-foreground">Note: {item.approvalNote}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={item.status.replace(/_/g, " ")} tone="neutral" />
                  {item.status === "pending_approval" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={actingId === item.id}
                      onClick={() => onAction("approve", item.id)}
                    >
                      Approve
                    </Button>
                  ) : null}
                  {item.status === "approved" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={actingId === item.id}
                      onClick={() => onAction("execute", item.id)}
                    >
                      Execute
                    </Button>
                  ) : null}
                  {["pending_approval", "approved", "scheduled"].includes(item.status) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={actingId === item.id}
                      onClick={() => onAction("cancel", item.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—"
  const hours = Math.round(ms / (60 * 60 * 1000))
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

export function GrowthOutreachApprovalDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/outreach/approval-dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as DashboardPayload & { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load approval dashboard.")
      setDashboard(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAction(action: "approve" | "execute" | "cancel", queueId: string) {
    setActingId(queueId)
    try {
      const path =
        action === "approve"
          ? `/api/platform/growth/outreach/queue/${queueId}/approve`
          : action === "execute"
            ? `/api/platform/growth/outreach/queue/${queueId}/execute`
            : `/api/platform/growth/outreach/queue/${queueId}/cancel`
      const init: RequestInit =
        action === "approve"
          ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sendNow: false }) }
          : { method: "POST" }
      await fetch(path, init)
      await load()
    } finally {
      setActingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading outreach approval dashboard…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-600">{error ?? "Dashboard unavailable."}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-1 size-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Approval rate" value={`${dashboard.analytics.approvalRate}%`} />
        <StatTile label="Time to approval" value={formatDuration(dashboard.analytics.medianTimeToApprovalMs)} />
        <StatTile label="Execution rate" value={`${dashboard.analytics.executionRate}%`} />
        <StatTile label="Failed execution rate" value={`${dashboard.analytics.failedExecutionRate}%`} />
        <StatTile label="Regeneration rate" value={`${dashboard.analytics.regenerationRate}%`} />
        <StatTile
          label="Channel mix"
          value={dashboard.analytics.channelMix.map((entry) => `${entry.channel} ${entry.count}`).join(" · ") || "—"}
        />
      </div>

      <GrowthEngineCard title="Provider Health" icon={<ShieldAlert className="size-4" />}>
        {dashboard.providerHealth.length === 0 ? (
          <p className="text-sm text-muted-foreground">No provider connections configured.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {dashboard.providerHealth.map((provider) => (
              <li key={provider.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div>
                  <p className="font-medium">{provider.label}</p>
                  <p className="text-muted-foreground capitalize">
                    {provider.providerFamily} · {provider.lifecycleStatus.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <GrowthBadge label={`send ${provider.supportsSend}`} tone="neutral" />
                  {provider.temporarilyDegraded ? <GrowthBadge label="degraded" tone="warning" /> : null}
                  {provider.validationFailureCount > 0 ? (
                    <GrowthBadge label={`${provider.validationFailureCount} validation failures`} tone="attention" />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Regeneration Hotspots" icon={<TrendingUp className="size-4" />}>
        {dashboard.regenerationHotspots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No regeneration hotspots in the last 30 days.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {dashboard.regenerationHotspots.map((spot) => (
              <li key={spot.leadId} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="font-mono text-xs">{spot.leadId.slice(0, 8)}…</span>
                <span className="text-muted-foreground">
                  {spot.count} regen · v{spot.latestVersion}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <QueueList
        title="Pending approval"
        items={dashboard.sections.pendingApproval}
        onAction={handleAction}
        actingId={actingId}
      />
      <QueueList title="Scheduled" items={dashboard.sections.scheduled} onAction={handleAction} actingId={actingId} />
      <QueueList title="Failed" items={dashboard.sections.failed} onAction={handleAction} actingId={actingId} />
      <QueueList
        title="Executed recently"
        items={dashboard.sections.executedRecently}
        onAction={handleAction}
        actingId={actingId}
      />

      {dashboard.sections.followUpDraftsPendingApproval.length > 0 ? (
        <GrowthEngineCard title="Follow-up drafts pending approval" icon={<Mail className="size-4" />}>
          <ul className="space-y-2 text-sm">
            {dashboard.sections.followUpDraftsPendingApproval.map((draft) => (
              <li key={draft.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="font-medium">{draft.companyName}</p>
                  <p className="text-muted-foreground capitalize">{draft.generationType.replace(/_/g, " ")}</p>
                </div>
                <GrowthBadge label="draft" tone="warning" />
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}
    </div>
  )
}
