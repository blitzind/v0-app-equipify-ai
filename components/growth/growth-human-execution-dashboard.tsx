"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthHumanExecutionDashboard, HumanExecutionApprovalItem } from "@/lib/growth/human-execution/human-execution-types"
import { humanExecutionReadinessBandTone } from "@/lib/growth/human-execution/human-execution-readiness-score"
import {
  GrowthHumanExecutionSchemaNotice,
  type GrowthHumanExecutionSchemaMeta,
} from "@/components/growth/growth-human-execution-schema-notice"

export function GrowthHumanExecutionDashboardPanel() {
  const [dashboard, setDashboard] = useState<GrowthHumanExecutionDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupMeta, setSetupMeta] = useState<GrowthHumanExecutionSchemaMeta | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/human-execution/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: GrowthHumanExecutionSchemaMeta
        dashboard?: GrowthHumanExecutionDashboard | null
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load execution dashboard.")
      if (data.meta?.schemaReady === false) {
        setSetupMeta(data.meta)
        setDashboard(null)
        return
      }
      setSetupMeta(data.meta?.probeUncertain ? data.meta : null)
      setDashboard(data.dashboard ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function transitionApproval(item: HumanExecutionApprovalItem, toStatus: "review" | "approved" | "executed" | "complete") {
    if (item.id.startsWith("outreach:")) {
      window.open(item.ctaHref, "_blank")
      return
    }
    setActionId(item.id)
    try {
      const res = await fetch(`/api/platform/growth/human-execution/approvals/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) throw new Error(data.message ?? "Could not update approval.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.")
    } finally {
      setActionId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading human execution dashboard…
      </div>
    )
  }

  if (setupMeta?.schemaReady === false) {
    return <GrowthHumanExecutionSchemaNotice meta={setupMeta} />
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!dashboard) {
    return <p className="text-sm text-muted-foreground">No execution dashboard data.</p>
  }

  const { metrics, approvalQueue } = dashboard

  return (
    <div className="space-y-6">
      {setupMeta ? <GrowthHumanExecutionSchemaNotice meta={setupMeta} /> : null}
      <GrowthEngineCard
        title="Human-Approved Execution"
        subtitle="Draft → Review → Approved → Executed → Complete — operator controlled"
        icon={<ShieldCheck className="size-4" />}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <GrowthBadge label="No autonomous CRM · sends · calls" tone="neutral" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Approval pending" value={String(metrics.approvalPending)} />
          <StatTile label="Ready now" value={String(metrics.readyNow)} />
          <StatTile label="Revenue influenced" value={`$${metrics.revenueInfluenced.toLocaleString()}`} />
          <StatTile label="Sequences active" value={String(metrics.sequencesActive)} />
          <StatTile label="Reply rate" value={`${metrics.replyRatePercent}%`} />
        </div>
      </GrowthEngineCard>

      {approvalQueue.length > 0 ? (
      <GrowthEngineCard title="Approval queue" subtitle="All execution requires explicit operator approval">
          <ul className="space-y-2">
            {approvalQueue.map((item) => (
              <li key={item.id} className="rounded-lg border border-border/80 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{item.companyName}</p>
                    <p className="text-sm text-muted-foreground">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.channelLabel} · {item.approvalStatus} · score {item.readinessScore}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge
                      label={item.readinessBand}
                      tone={humanExecutionReadinessBandTone(item.readinessBand)}
                    />
                    {item.approvalStatus === "draft" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={actionId === item.id}
                        onClick={() => void transitionApproval(item, "review")}
                      >
                        Review
                      </Button>
                    ) : null}
                    {item.approvalStatus === "review" ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={actionId === item.id}
                        onClick={() => void transitionApproval(item, "approved")}
                      >
                        Approve
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="ghost">
                      <Link href={item.ctaHref}>Open</Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
      </GrowthEngineCard>
      ) : null}
    </div>
  )
}
