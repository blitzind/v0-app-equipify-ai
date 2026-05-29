"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Pause, Play, Radar, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  GrowthBulkAcquisitionPhase,
  GrowthBulkAcquisitionRun,
  GrowthBulkAcquisitionRunStatus,
} from "@/lib/growth/acquisition/acquisition-types"
import { phaseLabel, statusLabel } from "@/lib/growth/acquisition/acquisition-types"

function phaseTone(phase: GrowthBulkAcquisitionPhase) {
  switch (phase) {
    case "done":
      return "healthy" as const
    case "discover_companies":
      return "high" as const
    case "discover_contacts":
      return "medium" as const
    case "verify_contacts":
      return "attention" as const
    case "promote_leads":
      return "healthy" as const
    default:
      return "neutral" as const
  }
}

function statusTone(status: GrowthBulkAcquisitionRunStatus, paused: boolean) {
  if (paused) return "stalled" as const
  switch (status) {
    case "completed":
      return "healthy" as const
    case "running":
      return "medium" as const
    case "partial":
      return "attention" as const
    case "failed":
      return "critical" as const
    default:
      return "neutral" as const
  }
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function GrowthAcquisitionRunsDashboard() {
  const [runs, setRuns] = useState<GrowthBulkAcquisitionRun[]>([])
  const [schemaReady, setSchemaReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [industry, setIndustry] = useState("commercial HVAC")
  const [location, setLocation] = useState("Tennessee")
  const [limitPerQuery, setLimitPerQuery] = useState("50")
  const [targetCompanyCount, setTargetCompanyCount] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/acquisition/runs", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        runs?: GrowthBulkAcquisitionRun[]
        meta?: { schemaReady?: boolean }
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not load acquisition runs.")
      }
      setRuns(data.runs ?? [])
      setSchemaReady(data.meta?.schemaReady !== false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load acquisition runs.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate() {
    if (!industry.trim() || !location.trim()) return
    setCreating(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        filters: {
          industry: industry.trim(),
          location: location.trim(),
        },
        limit_per_query: Number.parseInt(limitPerQuery, 10) || 50,
        auto_tick: true,
        tick_count: 5,
      }
      const target = Number.parseInt(targetCompanyCount, 10)
      if (target > 0) body.target_company_count = target

      const res = await fetch("/api/platform/growth/acquisition/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        run?: GrowthBulkAcquisitionRun
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.run) {
        throw new Error(data.message ?? data.error ?? "Could not create acquisition run.")
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create acquisition run.")
    } finally {
      setCreating(false)
    }
  }

  const activeRuns = runs.filter((run) => run.state.phase !== "done" && run.status !== "completed")
  const totalLeads = runs.reduce((sum, run) => sum + run.state.stats.leads_created, 0)

  return (
    <div className="flex flex-col gap-6">
      {!schemaReady ? (
        <GrowthEngineCard title="Schema not ready">
          <p className="text-sm text-muted-foreground">
            Real-world discovery schema is not ready. Apply Growth Engine migrations before starting acquisition runs.
          </p>
        </GrowthEngineCard>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active runs" value={activeRuns.length} hint="Running, partial, or paused" />
        <StatTile label="Total runs" value={runs.length} hint="Recent acquisition runs" />
        <StatTile label="Leads created" value={totalLeads} hint="Across listed runs" />
        <StatTile
          label="Cron worker"
          value="Every 5 min"
          hint="Background ticks for non-paused runs"
        />
      </div>

      <GrowthEngineCard title="Start acquisition run" icon={<Radar size={16} />}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="acq-industry">Industry</Label>
            <Input
              id="acq-industry"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              placeholder="commercial HVAC"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acq-location">Location</Label>
            <Input
              id="acq-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Tennessee"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acq-limit">Companies per query</Label>
            <Input
              id="acq-limit"
              type="number"
              min={10}
              max={100}
              value={limitPerQuery}
              onChange={(event) => setLimitPerQuery(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acq-target">Target company count (optional)</Label>
            <Input
              id="acq-target"
              type="number"
              min={1}
              value={targetCompanyCount}
              onChange={(event) => setTargetCompanyCount(event.target.value)}
              placeholder="Leave blank for geo exhaustion"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => void handleCreate()} disabled={creating || !schemaReady}>
            {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Start run
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
      </GrowthEngineCard>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <GrowthEngineCard title="Acquisition runs">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading runs…
          </div>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No acquisition runs yet.</p>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <Link
                key={run.id}
                href={`/admin/growth/acquisition/${run.id}`}
                className="block rounded-lg border border-border/80 bg-muted/10 p-4 transition hover:border-primary/40 hover:bg-muted/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{run.query}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {run.industry ?? "—"} · {run.location ?? "—"} · started {formatWhen(run.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {run.state.paused ? (
                      <GrowthBadge tone="stalled">
                        <Pause className="mr-1 size-3" />
                        Paused
                      </GrowthBadge>
                    ) : null}
                    <GrowthBadge tone={statusTone(run.status, run.state.paused)}>
                      {statusLabel(run.status)}
                    </GrowthBadge>
                    <GrowthBadge tone={phaseTone(run.state.phase)}>{phaseLabel(run.state.phase)}</GrowthBadge>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4 lg:grid-cols-6">
                  <span>Companies: {run.state.stats.companies_discovered}</span>
                  <span>Processed: {run.state.stats.companies_contacts_processed}</span>
                  <span>Contacts: {run.state.metrics.contacts_discovered}</span>
                  <span>Verified: {run.state.metrics.emails_verified}</span>
                  <span>Leads: {run.state.stats.leads_created}</span>
                  <span>Ticks: {run.state.metrics.ticks_completed}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </GrowthEngineCard>
    </div>
  )
}

export function GrowthAcquisitionRunPauseButton({
  run,
  onUpdated,
}: {
  run: GrowthBulkAcquisitionRun
  onUpdated: (run: GrowthBulkAcquisitionRun) => void
}) {
  const [acting, setActing] = useState(false)
  const done = run.state.phase === "done" || run.status === "completed"

  async function togglePaused() {
    setActing(true)
    try {
      const res = await fetch(`/api/platform/growth/acquisition/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !run.state.paused }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        run?: GrowthBulkAcquisitionRun
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.run) {
        throw new Error(data.message ?? data.error ?? "Could not update run.")
      }
      onUpdated(data.run)
    } finally {
      setActing(false)
    }
  }

  if (done) return null

  return (
    <Button variant="outline" onClick={() => void togglePaused()} disabled={acting}>
      {acting ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : run.state.paused ? (
        <Play className="mr-2 size-4" />
      ) : (
        <Pause className="mr-2 size-4" />
      )}
      {run.state.paused ? "Resume" : "Pause"}
    </Button>
  )
}
