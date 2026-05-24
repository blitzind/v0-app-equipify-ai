"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Play, RefreshCw, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_LEAD_ASSIGNMENT_QA_MARKER,
  type GrowthAssignmentRunResult,
  type GrowthRepRosterEntry,
  type GrowthSalesOwnershipDashboard,
} from "@/lib/growth/assignment/assignment-types"

export function GrowthSalesOwnershipDashboard() {
  const [dashboard, setDashboard] = useState<GrowthSalesOwnershipDashboard | null>(null)
  const [reps, setReps] = useState<GrowthRepRosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<GrowthAssignmentRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashboardRes, repsRes] = await Promise.all([
        fetch("/api/platform/growth/assignment/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/assignment/reps", { cache: "no-store" }),
      ])
      const dashboardData = (await dashboardRes.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthSalesOwnershipDashboard
        message?: string
      }
      const repsData = (await repsRes.json().catch(() => ({}))) as { ok?: boolean; reps?: GrowthRepRosterEntry[] }
      if (!dashboardRes.ok || !dashboardData.ok) {
        throw new Error(dashboardData.message ?? "Could not load ownership dashboard.")
      }
      setDashboard(dashboardData.dashboard ?? null)
      setReps(repsData.reps ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ownership dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function runAssignment(dryRun: boolean) {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/assignment/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, limit: 25 }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: GrowthAssignmentRunResult
        message?: string
      }
      if (!res.ok || !data.ok || !data.result) {
        throw new Error(data.message ?? "Assignment run failed.")
      }
      setRunResult(data.result)
      if (!dryRun) await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment run failed.")
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading sales ownership…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <GrowthEngineCard title="Sales Ownership">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Deterministic rep assignment, capacity limits, and accountability — no autonomous outreach.
            </p>
            <GrowthBadge label={GROWTH_LEAD_ASSIGNMENT_QA_MARKER} tone="neutral" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={running}>
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={() => void runAssignment(true)} disabled={running}>
              Dry run
            </Button>
            <Button size="sm" onClick={() => void runAssignment(false)} disabled={running}>
              {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
              Run assignment
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Unassigned" value={dashboard?.unassignedCount ?? 0} />
          <StatTile label="High-priority unassigned" value={dashboard?.highPriorityUnassignedCount ?? 0} />
          <StatTile label="Over-capacity reps" value={dashboard?.overCapacityRepCount ?? 0} />
          <StatTile label="Last run assigned" value={dashboard?.lastRun?.assigned ?? 0} />
          <StatTile label="Active reps" value={reps.filter((rep) => rep.status === "active").length} />
        </div>

        {runResult ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {runResult.dryRun ? "Dry run" : "Live run"} · scanned {runResult.scanned} · assigned {runResult.assigned} ·
            skipped manual {runResult.skippedManual} · capacity {runResult.skippedCapacity} · no rep{" "}
            {runResult.skippedNoRep}
          </p>
        ) : dashboard?.lastRun ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Last run {new Date(dashboard.lastRun.startedAt).toLocaleString()} · assigned {dashboard.lastRun.assigned}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No assignment runs yet.</p>
        )}

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </GrowthEngineCard>

      <GrowthEngineCard title="Leads by owner">
        <p className="mb-3 text-sm text-muted-foreground">Active pipeline ownership and action backlog.</p>
        {dashboard?.leadsByOwner.length ? (
          <div className="space-y-2">
            {dashboard.leadsByOwner.map((owner) => (
              <div
                key={owner.userId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div>
                  <p className="font-medium">{owner.displayName ?? owner.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {owner.leadCount} leads · {owner.needsActionCount} need action
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <GrowthBadge label={owner.status} tone={owner.status === "active" ? "healthy" : "neutral"} />
                  {owner.isOverCapacity ? <GrowthBadge label="Over capacity" tone="attention" /> : null}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/growth/leads?assignedTo=${owner.userId}`}>View leads</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No rep roster entries yet. Platform admins sync on first load.</p>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Recent assignment activity">
        {dashboard?.recentActivity.length ? (
          <div className="space-y-2">
            {dashboard.recentActivity.map((item) => (
              <div key={`${item.leadId}-${item.occurredAt}`} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{item.companyName}</p>
                  <p className="text-muted-foreground">
                    {item.eventType.replace(/_/g, " ")} · {item.summary ?? "—"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(item.occurredAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No assignment timeline activity yet.</p>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Rep roster">
        <p className="mb-3 text-sm text-muted-foreground">Capacity, specialties, and routing eligibility.</p>
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          Configure rep status and limits via assignment APIs.
        </div>
        {reps.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-2">Rep</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Active leads</th>
                  <th className="px-3 py-2">Today</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((rep) => (
                  <tr key={rep.userId} className="border-t border-border">
                    <td className="px-3 py-2">{rep.displayName ?? rep.email}</td>
                    <td className="px-3 py-2">{rep.status}</td>
                    <td className="px-3 py-2">
                      {rep.activeLeadCount}/{rep.maxActiveLeads}
                    </td>
                    <td className="px-3 py-2">
                      {rep.dailyAssignmentCount}/{rep.maxDailyNewAssignments}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No reps configured.</p>
        )}
      </GrowthEngineCard>
    </div>
  )
}
