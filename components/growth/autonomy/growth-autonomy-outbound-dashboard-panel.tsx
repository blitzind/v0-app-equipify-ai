"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GrowthAutonomyOutboundDashboard } from "@/lib/growth/autonomy/growth-autonomy-outbound-dashboard"

const OUTBOUND_DASHBOARD_ADMIN_ONLY_MESSAGE =
  "Outbound dashboard is available to platform admins." as const

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
          throw new Error(body.error ?? "Could not load outbound dashboard.")
        }
        setDashboard(body.dashboard)
        setAdminOnly(false)
      })
      .catch((loadError) => {
        setAdminOnly(false)
        setError(loadError instanceof Error ? loadError.message : "Could not load outbound dashboard.")
      })
  }, [])

  if (adminOnly) {
    return <p className="text-sm text-muted-foreground">{OUTBOUND_DASHBOARD_ADMIN_ONLY_MESSAGE}</p>
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!dashboard) return <p className="text-sm text-muted-foreground">Loading outbound autonomy dashboard…</p>

  return (
    <Card data-qa-marker={dashboard.qa_marker}>
      <CardHeader>
        <CardTitle>Outbound autonomy dashboard</CardTitle>
        <CardDescription>
          Confidence-gated autonomous sends — shadow mode logs decisions without transport.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Autonomous sends today" value={String(dashboard.autonomousSendsToday)} />
        <Stat label="Would send (shadow)" value={String(dashboard.wouldSendToday)} />
        <Stat label="Would queue" value={String(dashboard.wouldQueueToday)} />
        <Stat
          label="Emergency stop"
          value={dashboard.emergencyStopActive ? "Active" : "Off"}
        />
        <Stat
          label="Master outbound"
          value={dashboard.masterOutboundEnabled ? "Enabled" : "Disabled"}
        />
        <Stat label="Shadow mode" value={dashboard.shadowModeEnabled ? "On" : "Off"} />
        <Stat
          label="Org outbound budget"
          value={`${dashboard.orgOutboundBudget.consumed}/${dashboard.orgOutboundBudget.cap || "—"}`}
        />
        {dashboard.channelBudgetUsage.map((row) => (
          <Stat
            key={row.channel}
            label={`${row.channel} sends today`}
            value={`${row.sentToday}/${row.cap || "—"}`}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}
