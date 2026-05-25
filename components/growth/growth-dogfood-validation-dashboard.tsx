"use client"

import { useCallback, useEffect, useState } from "react"
import { ClipboardCheck, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_DOGFOOD_INBOX_VIEWS,
  GROWTH_DOGFOOD_ISSUE_SEVERITIES,
  GROWTH_DOGFOOD_SUBSYSTEMS,
  GROWTH_DOGFOOD_SUBSYSTEM_LABELS,
  GROWTH_DOGFOOD_VALIDATION_STATUSES,
  GROWTH_DOGFOOD_VALIDATION_STATUS_LABELS,
  type GrowthDogfoodInboxView,
  type GrowthDogfoodIssue,
  type GrowthDogfoodReadinessDashboard,
  type GrowthDogfoodSubsystem,
  type GrowthDogfoodValidationRun,
  type GrowthDogfoodValidationStatus,
} from "@/lib/growth/dogfood/dogfood-types"

const VIEW_LABELS: Record<GrowthDogfoodInboxView, string> = {
  scorecard: "Scorecard",
  runs: "Validation Runs",
  issues: "Issue Registry",
  blockers: "Blockers",
}

function statusTone(status: GrowthDogfoodValidationStatus): "healthy" | "high" | "critical" | "neutral" | "medium" {
  if (status === "validated") return "healthy"
  if (status === "warning") return "medium"
  if (status === "failed") return "critical"
  if (status === "testing") return "high"
  return "neutral"
}

export function GrowthDogfoodValidationDashboard() {
  const [dashboard, setDashboard] = useState<GrowthDogfoodReadinessDashboard | null>(null)
  const [runs, setRuns] = useState<GrowthDogfoodValidationRun[]>([])
  const [issues, setIssues] = useState<GrowthDogfoodIssue[]>([])
  const [view, setView] = useState<GrowthDogfoodInboxView>("scorecard")
  const [subsystemFilter, setSubsystemFilter] = useState<GrowthDogfoodSubsystem | "">("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [runSubsystem, setRunSubsystem] = useState<GrowthDogfoodSubsystem>("import")
  const [runStatus, setRunStatus] = useState<GrowthDogfoodValidationStatus>("testing")
  const [runNotes, setRunNotes] = useState("")
  const [issueTitle, setIssueTitle] = useState("")
  const [issueSeverity, setIssueSeverity] = useState<(typeof GROWTH_DOGFOOD_ISSUE_SEVERITIES)[number]>("medium")
  const [issueSubsystem, setIssueSubsystem] = useState<GrowthDogfoodSubsystem>("import")
  const [issueNotes, setIssueNotes] = useState("")

  const load = useCallback(async (activeView: GrowthDogfoodInboxView) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (subsystemFilter) params.set("subsystem", subsystemFilter)
      if (activeView === "blockers") params.set("blockers", "true")
      const [dashRes, runsRes, issuesRes] = await Promise.all([
        fetch("/api/platform/growth/dogfood/dashboard", { cache: "no-store" }),
        fetch(`/api/platform/growth/dogfood/runs?${params.toString()}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/dogfood/issues?${params.toString()}`, { cache: "no-store" }),
      ])
      const dashData = (await dashRes.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        dashboard?: GrowthDogfoodReadinessDashboard | null
        message?: string
      }
      const runsData = (await runsRes.json().catch(() => ({}))) as { ok?: boolean; feed?: { items?: GrowthDogfoodValidationRun[] } }
      const issuesData = (await issuesRes.json().catch(() => ({}))) as { ok?: boolean; feed?: { items?: GrowthDogfoodIssue[] } }
      if (!dashRes.ok || !dashData.ok) throw new Error(dashData.message ?? "Could not load dogfood dashboard.")
      if (dashData.meta?.schemaReady === false) {
        setSetupMessage(dashData.meta.setupMessage ?? null)
        setDashboard(null)
        setRuns([])
        setIssues([])
        return
      }
      setSetupMessage(null)
      setDashboard(dashData.dashboard ?? null)
      setRuns(runsData.feed?.items ?? [])
      setIssues(issuesData.feed?.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [subsystemFilter])

  useEffect(() => {
    void load(view)
  }, [load, view])

  async function submitRun() {
    setActing(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/dogfood/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subsystem: runSubsystem, status: runStatus, notes: runNotes }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not record run.")
      setRunNotes("")
      await load(view)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed.")
    } finally {
      setActing(false)
    }
  }

  async function submitIssue() {
    setActing(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/dogfood/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: issueTitle,
          severity: issueSeverity,
          subsystem: issueSubsystem,
          reproductionNotes: issueNotes,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not create issue.")
      setIssueTitle("")
      setIssueNotes("")
      await load(view)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Issue create failed.")
    } finally {
      setActing(false)
    }
  }

  async function patchIssue(issueId: string, status: GrowthDogfoodIssue["status"]) {
    setActing(true)
    try {
      const res = await fetch(`/api/platform/growth/dogfood/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Update failed.")
      await load(view)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.")
    } finally {
      setActing(false)
    }
  }

  if (loading && !dashboard && !setupMessage) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading dogfood validation center…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {GROWTH_DOGFOOD_INBOX_VIEWS.map((option) => (
            <Button key={option} size="sm" variant={view === option ? "default" : "outline"} onClick={() => setView(option)}>
              {VIEW_LABELS[option]}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(view)}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>

      <select
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        value={subsystemFilter}
        onChange={(e) => setSubsystemFilter(e.target.value as GrowthDogfoodSubsystem | "")}
      >
        <option value="">All subsystems</option>
        {GROWTH_DOGFOOD_SUBSYSTEMS.map((subsystem) => (
          <option key={subsystem} value={subsystem}>
            {GROWTH_DOGFOOD_SUBSYSTEM_LABELS[subsystem]}
          </option>
        ))}
      </select>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {setupMessage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">{setupMessage}</p>
      ) : null}

      {dashboard ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge label={dashboard.qaMarker} tone="healthy" />
            <GrowthBadge label="Human validation only" tone="neutral" />
            {dashboard.readyForBlitzUsage ? (
              <GrowthBadge label="Ready for Blitz usage" tone="healthy" />
            ) : (
              <GrowthBadge label="Not ready for Blitz usage" tone="critical" />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={<ClipboardCheck className="size-3.5" />} label="Overall readiness" value={`${dashboard.overallReadinessPercent}%`} />
            <StatTile label="Open blockers" value={dashboard.openBlockers} />
            <StatTile label="Critical blockers" value={dashboard.criticalBlockers} />
            <StatTile label="Subsystems tracked" value={dashboard.scorecard.length} />
          </div>
        </>
      ) : null}

      {(view === "scorecard" || view === "blockers") && dashboard ? (
        <GrowthEngineCard title="Operational scorecard">
          <ul className="divide-y divide-border">
            {dashboard.scorecard
              .filter((entry) => !subsystemFilter || entry.subsystem === subsystemFilter)
              .map((entry) => (
                <li key={entry.subsystem} className="space-y-2 py-3 first:pt-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{entry.label}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <GrowthBadge label={GROWTH_DOGFOOD_VALIDATION_STATUS_LABELS[entry.status]} tone={statusTone(entry.status)} />
                        <GrowthBadge label={`Confidence ${entry.confidence}`} tone="neutral" />
                        {entry.failures > 0 ? <GrowthBadge label={`${entry.failures} open issues`} tone="high" /> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.lastValidatedAt
                          ? `Last validated ${new Date(entry.lastValidatedAt).toLocaleString()}`
                          : "Not validated yet"}
                      </p>
                      <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                        {entry.checks.map((check) => (
                          <li key={check}>{check}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </GrowthEngineCard>
      ) : null}

      {view === "runs" ? (
        <GrowthEngineCard title="Record validation run">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <select
              className="rounded-md border border-border bg-background px-2 py-2 text-sm"
              value={runSubsystem}
              onChange={(e) => setRunSubsystem(e.target.value as GrowthDogfoodSubsystem)}
            >
              {GROWTH_DOGFOOD_SUBSYSTEMS.map((subsystem) => (
                <option key={subsystem} value={subsystem}>
                  {GROWTH_DOGFOOD_SUBSYSTEM_LABELS[subsystem]}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-border bg-background px-2 py-2 text-sm"
              value={runStatus}
              onChange={(e) => setRunStatus(e.target.value as GrowthDogfoodValidationStatus)}
            >
              {GROWTH_DOGFOOD_VALIDATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {GROWTH_DOGFOOD_VALIDATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <Textarea value={runNotes} onChange={(e) => setRunNotes(e.target.value)} placeholder="Validation notes" className="mb-3" />
          <Button size="sm" disabled={acting} onClick={() => void submitRun()}>
            Record run
          </Button>
          <ul className="mt-4 divide-y divide-border">
            {runs.map((run) => (
              <li key={run.id} className="py-3 first:pt-0">
                <p className="font-medium">
                  {GROWTH_DOGFOOD_SUBSYSTEM_LABELS[run.subsystem]} · {GROWTH_DOGFOOD_VALIDATION_STATUS_LABELS[run.status]}
                </p>
                <p className="text-xs text-muted-foreground">{new Date(run.runAt).toLocaleString()} · confidence {run.confidence}</p>
                {run.notes ? <p className="mt-1 text-sm text-muted-foreground">{run.notes}</p> : null}
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}

      {view === "issues" || view === "blockers" ? (
        <GrowthEngineCard title={view === "blockers" ? "Open blockers" : "Issue registry"}>
          {view === "issues" ? (
            <div className="mb-4 space-y-3">
              <Input value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} placeholder="Issue title" />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="rounded-md border border-border bg-background px-2 py-2 text-sm"
                  value={issueSubsystem}
                  onChange={(e) => setIssueSubsystem(e.target.value as GrowthDogfoodSubsystem)}
                >
                  {GROWTH_DOGFOOD_SUBSYSTEMS.map((subsystem) => (
                    <option key={subsystem} value={subsystem}>
                      {GROWTH_DOGFOOD_SUBSYSTEM_LABELS[subsystem]}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border border-border bg-background px-2 py-2 text-sm"
                  value={issueSeverity}
                  onChange={(e) => setIssueSeverity(e.target.value as (typeof GROWTH_DOGFOOD_ISSUE_SEVERITIES)[number])}
                >
                  {GROWTH_DOGFOOD_ISSUE_SEVERITIES.map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
                placeholder="Reproduction notes"
              />
              <Button size="sm" disabled={acting || !issueTitle.trim()} onClick={() => void submitIssue()}>
                Log issue
              </Button>
            </div>
          ) : null}
          <ul className="divide-y divide-border">
            {issues.map((issue) => (
              <li key={issue.id} className="space-y-2 py-3 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{issue.title}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <GrowthBadge label={issue.severity} tone={issue.severity === "critical" ? "critical" : "neutral"} />
                      <GrowthBadge label={GROWTH_DOGFOOD_SUBSYSTEM_LABELS[issue.subsystem]} tone="neutral" />
                      <GrowthBadge label={issue.status.replace(/_/g, " ")} tone="neutral" />
                    </div>
                    {issue.reproductionNotes ? (
                      <p className="mt-1 text-xs text-muted-foreground">{issue.reproductionNotes}</p>
                    ) : null}
                  </div>
                </div>
                {issue.status === "open" || issue.status === "in_progress" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={acting} onClick={() => void patchIssue(issue.id, "in_progress")}>
                      In progress
                    </Button>
                    <Button size="sm" variant="outline" disabled={acting} onClick={() => void patchIssue(issue.id, "fixed")}>
                      Mark fixed
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}
    </div>
  )
}
