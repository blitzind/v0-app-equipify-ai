"use client"

import { useEffect, useState } from "react"
import { Activity } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GrowthAutonomyOutboundDashboard } from "@/lib/growth/autonomy/growth-autonomy-outbound-dashboard"

const OUTBOUND_DASHBOARD_ADMIN_ONLY_MESSAGE =
  "Advanced outbound metrics are available to platform admins." as const

export function GrowthAutonomyOutboundDashboardPanel() {
  const [dashboard, setDashboard] = useState<GrowthAutonomyOutboundDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adminOnly, setAdminOnly] = useState(false)

  useEffect(() => {
    void fetch("/api/platform/growth/autonomy/outbound-dashboard", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as { ok?: boolean; dashboard?: GrowthAutonomyOutboundDashboard; error?: string }
        if (response.status === 403 || body.error === "forbidden") {
          setAdminOnly(true)
          setError(null)
          return
        }
        if (!response.ok || !body.ok || !body.dashboard) {
          throw new Error(body.error ?? "Could not load activity summary.")
        }
        setDashboard(body.dashboard)
        setAdminOnly(false)
      })
      .catch((loadError) => {
        setAdminOnly(false)
        setError(loadError instanceof Error ? loadError.message : "Could not load activity summary.")
      })
  }, [])

  if (adminOnly) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">{OUTBOUND_DASHBOARD_ADMIN_ONLY_MESSAGE}</p>
        </CardContent>
      </Card>
    )
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!dashboard) {
    return <p className="text-sm text-muted-foreground">Loading today&apos;s autonomy activity…</p>
  }

  const budgetRemaining = dashboard.orgOutboundBudget.remaining
  const draftsPrepared = dashboard.wouldQueueToday
  const waitingForApproval = dashboard.wouldQueueToday

  return (
    <Card data-qa-marker={dashboard.qa_marker}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-600" />
          <CardTitle className="text-base">Today&apos;s activity</CardTitle>
        </div>
        <CardDescription>Operational summary for autonomous AI OS actions.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
        <Stat label="AI actions today" value={String(dashboard.autonomousSendsToday + draftsPrepared)} />
        <Stat label="Drafts prepared" value={String(draftsPrepared)} />
        <Stat label="Waiting for approval" value={String(waitingForApproval)} />
        <Stat label="Would-send decisions" value={String(dashboard.wouldSendToday)} />
        <Stat label="Sends today" value={String(dashboard.autonomousSendsToday)} />
        <Stat
          label="Budget remaining"
          value={dashboard.orgOutboundBudget.cap > 0 ? String(budgetRemaining) : "—"}
        />
        <Stat
          label="Emergency stop"
          value={dashboard.emergencyStopActive ? "On" : "Off"}
          emphasis={dashboard.emergencyStopActive}
        />
        {dashboard.shadowModeEnabled ? (
          <Stat label="Shadow mode" value="Active" />
        ) : null}
      </CardContent>
    </Card>
  )
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={emphasis ? "text-lg font-semibold text-destructive" : "text-lg font-semibold tabular-nums"}>
        {value}
      </p>
    </div>
  )
}
