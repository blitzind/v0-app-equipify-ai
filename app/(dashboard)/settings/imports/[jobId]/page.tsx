"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ArrowLeft, Download, Loader2, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { IMPORT_STRATEGIES } from "@/lib/migration-imports/strategy"
import { cn } from "@/lib/utils"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

type JobDetail = {
  jobId: string
  importRef: string
  kind: string
  source_system: string | null
  status: string
  file_name: string | null
  row_count: number | null
  processed_count?: number | null
  success_count: number | null
  updated_count: number | null
  skipped_count: number | null
  error_count: number | null
  strategy: string | null
  user_message: string | null
  created_at: string | null
  started_at: string | null
  completed_at: string | null
  validation_summary: Record<string, unknown> | null
  preview_json: { headers?: string[]; truncated?: boolean; sample?: unknown[] } | null
  partialImport?: boolean
  canExport: boolean
  cancel_requested_at?: string | null
}

type ActiveRun = {
  runId: string
  runRef: string
  status: string
  totalRows: number
  totalChunks: number
  currentChunkIndex: number
  processedCount: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  cancelRequestedAt: string | null
  retryCount: number
  maxRetries: number
  nextRetryAt: string | null
  errorMessage?: string | null
  completedAt?: string | null
  createdAt?: string | null
  isLikelyStuck?: boolean
  staleLeaseRecoveredAt?: string | null
  recovery?: Record<string, unknown> | null
}

type RowSample = {
  rowIndex: number
  status: string
  codes: string[]
  message: string | null
  recordRef: string | null
  cells: Record<string, string> | null
}

function strategyLabel(value: string | null): string {
  if (!value) return "—"
  const hit = IMPORT_STRATEGIES.find((s) => s.value === value)
  return hit?.label ?? value.replace(/_/g, " ")
}

function statusBadgeClass(status: string): string {
  if (status === "completed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (status === "completed_with_errors") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  if (status === "failed" || status === "cancelled") return "border-destructive/30 bg-destructive/10 text-destructive"
  if (status === "processing" || status === "queued") return "border-primary/30 bg-primary/10 text-primary"
  return "border-border bg-muted/40 text-muted-foreground"
}

function validationNumber(summary: Record<string, unknown> | null, key: string): number {
  const value = summary?.[key]
  return typeof value === "number" ? value : 0
}

function issueCounts(summary: Record<string, unknown> | null): Array<[string, number]> {
  const counts = summary?.issueCounts
  if (!counts || typeof counts !== "object") return []
  return Object.entries(counts as Record<string, unknown>)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((a, b) => b[1] - a[1])
}

export default function ImportJobDetailPage() {
  const params = useParams()
  const jobId = typeof params.jobId === "string" ? params.jobId : null
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { has, status: permStatus } = useOrgPermissions()
  const allowed = has("canManageHistoricalImports")

  const [job, setJob] = useState<JobDetail | null>(null)
  const [rows, setRows] = useState<RowSample[]>([])
  const [rowSampleLimit, setRowSampleLimit] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null)
  const [runHistory, setRunHistory] = useState<ActiveRun[]>([])
  const [runActionBusy, setRunActionBusy] = useState(false)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !jobId || !allowed) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/${encodeURIComponent(jobId)}?rowLimit=500`,
      )
      const json = (await res.json()) as {
        job?: JobDetail
        activeRun?: ActiveRun | null
        runHistory?: ActiveRun[]
        rows?: RowSample[]
        rowSampleLimit?: number
        message?: string
      }
      if (!res.ok) {
        setError(json.message ?? "Could not load import job.")
        setJob(null)
        setRows([])
        return
      }
      setJob(json.job ?? null)
      setActiveRun(json.activeRun ?? null)
      setRows(json.rows ?? [])
      setRunHistory(json.runHistory ?? [])
      setRowSampleLimit(json.rowSampleLimit ?? 0)
    } catch {
      setError("Could not load import job.")
      setJob(null)
      setActiveRun(null)
      setRows([])
      setRunHistory([])
    } finally {
      setLoading(false)
    }
  }, [organizationId, jobId, allowed])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!job || (job.status !== "processing" && job.status !== "queued")) return
    const id = setInterval(() => {
      void load()
    }, 3000)
    return () => clearInterval(id)
  }, [job, load])

  const resumeFailedRun = useCallback(async () => {
    if (!organizationId || !jobId) return
    setRunActionBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/${encodeURIComponent(jobId)}/async`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "resume" }),
        },
      )
      const json = (await res.json()) as { message?: string }
      if (!res.ok) {
        setError(json.message ?? "Could not resume failed run.")
        return
      }
      await load()
    } catch {
      setError("Could not resume failed run.")
    } finally {
      setRunActionBusy(false)
    }
  }, [organizationId, jobId, load])

  if (permStatus === "loading" || orgStatus !== "ready") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="max-w-lg rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Shield className="h-5 w-5 text-primary" />
          Restricted
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Only owners and admins can view import jobs.{" "}
          <Link href="/settings/imports" className="text-primary underline">
            Back to Migration center
          </Link>
        </p>
      </div>
    )
  }

  if (!jobId) {
    return <p className="text-sm text-destructive">Invalid job reference.</p>
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2 mb-2">
          <Link href="/settings/imports">
            <ArrowLeft className="h-4 w-4" />
            Migration center
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className={cn(PAGE_STANDARD_PAGE_TITLE, "text-foreground")}>Import job</h1>
          {job ? (
            <span className="text-sm font-mono text-primary" aria-label="Import reference">
              #{job.importRef}
            </span>
          ) : null}
          {job ? (
            <span className={cn("capitalize inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", statusBadgeClass(job.status))}>
              {job.status.replace(/_/g, " ")}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground mt-1">Review outcomes, strategy, and downloadable reports.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading job…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !job ? (
        <p className="text-sm text-muted-foreground">Job not found.</p>
      ) : (
        <>
          {activeRun?.isLikelyStuck ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              <p className="font-medium">Stuck run detected</p>
              <p className="text-muted-foreground mt-1">
                This run appears stuck (stale lease or heartbeat). Cron will recover stale leases automatically.
              </p>
            </div>
          ) : null}
          {job.partialImport ? (
            <div
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 flex gap-2 items-start"
              role="status"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Completed with errors</p>
                <p className="text-muted-foreground mt-1">
                  Some rows failed. Download the error report to correct your file and run a follow-up import if needed.
                </p>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Detail label="Type" value={job.kind.replace(/_/g, " ")} />
              <Detail label="Status" value={job.status.replace(/_/g, " ")} />
              <Detail label="Strategy" value={strategyLabel(job.strategy)} />
              <Detail label="Source system" value={job.source_system?.trim() || "—"} />
              <Detail label="File" value={job.file_name ?? "—"} />
              <Detail
                label="Started"
                value={job.started_at ? new Date(job.started_at).toLocaleString() : "—"}
              />
              <Detail
                label="Completed"
                value={job.completed_at ? new Date(job.completed_at).toLocaleString() : "—"}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-sm pt-2 border-t border-border">
              <Count label="Total rows" value={job.row_count} />
              <Count label="Processed" value={job.processed_count ?? null} />
              <Count label="Created" value={job.success_count} />
              <Count label="Updated" value={job.updated_count} />
              <Count label="Skipped" value={job.skipped_count} />
              <Count label="Failed" value={job.error_count} tone="destructive" />
            </div>

            {activeRun ? (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">
                  Active background run: {activeRun.status.replace(/_/g, " ")}
                </p>
                <p className="text-muted-foreground">
                  Processed {activeRun.processedCount}/{activeRun.totalRows} rows · chunk {activeRun.currentChunkIndex}/
                  {Math.max(1, activeRun.totalChunks)}
                </p>
                {activeRun.cancelRequestedAt ? (
                  <p className="text-amber-700 dark:text-amber-300">Cancellation requested.</p>
                ) : null}
                {activeRun.nextRetryAt ? (
                  <p className="text-muted-foreground">Next retry: {new Date(activeRun.nextRetryAt).toLocaleString()}</p>
                ) : null}
                {activeRun.staleLeaseRecoveredAt ? (
                  <p className="text-muted-foreground">
                    Stale lease recovered at {new Date(activeRun.staleLeaseRecoveredAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ) : null}

            {job.user_message ? (
              <p className="text-sm text-muted-foreground border-t border-border pt-3">{job.user_message}</p>
            ) : null}

            {job.validation_summary && Object.keys(job.validation_summary).length > 0 ? (
              <div className="border-t border-border pt-3">
                <h2 className="text-sm font-semibold text-foreground mb-2">Validation summary</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <Count label="Blocking errors" value={validationNumber(job.validation_summary, "errorRows")} tone="destructive" />
                  <Count label="Warnings" value={validationNumber(job.validation_summary, "warningRows")} />
                  <Count label="Clean rows" value={validationNumber(job.validation_summary, "okRows")} />
                </div>
                {issueCounts(job.validation_summary).length > 0 ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {issueCounts(job.validation_summary).slice(0, 8).map(([code, count]) => (
                      <div key={code} className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                        <p className="font-medium text-foreground">{code.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">{count} row{count === 1 ? "" : "s"} affected</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <details className="mt-3 rounded-md border border-border bg-muted/20 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">Developer details</summary>
                  <pre className="mt-3 text-xs bg-background rounded-md p-3 overflow-x-auto max-h-48 overflow-y-auto">
                    {JSON.stringify(job.validation_summary, null, 2)}
                  </pre>
                </details>
              </div>
            ) : null}

            {job.canExport && organizationId ? (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {job.status === "failed" || job.partialImport ? (
                  <Button variant="default" size="sm" asChild className="gap-2">
                    <a
                      href={`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/${encodeURIComponent(jobId)}/export?filter=failed`}
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      Download errors
                    </a>
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <a
                    href={`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/${encodeURIComponent(jobId)}/export?filter=all`}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Full outcome CSV
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <a
                    href={`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/${encodeURIComponent(jobId)}/export?filter=failed`}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Errors only
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <a
                    href={`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/${encodeURIComponent(jobId)}/export?filter=skipped`}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Skipped only
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                Outcome CSV export is available after a CSV-based import with a stored file.
              </p>
            )}
          </div>

          {rows.length > 0 ? (
            <div className="ds-table-surface">
              <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Row outcomes</h2>
                <span className="text-xs text-muted-foreground">
                  Showing {rows.length}
                  {rowSampleLimit > 0 && job.row_count != null && job.row_count > rowSampleLimit
                    ? ` of ${job.row_count} (sample)`
                    : ""}
                </span>
              </div>
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Row</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Record</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.rowIndex} className="border-t border-border/80">
                        <td className="px-3 py-1.5 font-mono text-xs tabular-nums">{r.rowIndex}</td>
                        <td className="px-3 py-1.5 capitalize">{r.status.replace(/_/g, " ")}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{r.recordRef ?? "—"}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground max-w-md">
                          {r.message ?? (r.codes.length ? r.codes.join(", ") : "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : job.status !== "draft" ? (
            <p className="text-sm text-muted-foreground">No row outcomes recorded for this job yet.</p>
          ) : null}

          {runHistory.length > 0 ? (
            <div className="ds-table-surface">
              <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Run history</h2>
                {!activeRun && runHistory.some((r) => r.status === "failed") ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={runActionBusy}
                    onClick={() => void resumeFailedRun()}
                  >
                    {runActionBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Resume failed run
                  </Button>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Run</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Progress</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Retry</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Completed</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runHistory.map((r) => (
                      <tr key={r.runId} className="border-t border-border/80 align-top">
                        <td className="px-3 py-1.5 font-mono text-xs">{r.runRef}</td>
                        <td className="px-3 py-1.5 capitalize">{r.status.replace(/_/g, " ")}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          {r.processedCount}/{r.totalRows} · chunk {r.currentChunkIndex}/{Math.max(1, r.totalChunks)}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          {r.retryCount}/{r.maxRetries}
                          {r.nextRetryAt ? ` · next ${new Date(r.nextRetryAt).toLocaleTimeString()}` : ""}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          {r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => setExpandedRunId((prev) => (prev === r.runId ? null : r.runId))}
                          >
                            {expandedRunId === r.runId ? "Hide" : "Show"}
                          </button>
                          {expandedRunId === r.runId ? (
                            <div className="mt-2 rounded border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground space-y-1 max-w-[320px]">
                              {r.errorMessage ? <p>Error: {r.errorMessage}</p> : null}
                              {r.isLikelyStuck ? <p>Likely stuck: yes</p> : null}
                              {r.staleLeaseRecoveredAt ? (
                                <p>Stale lease recovered: {new Date(r.staleLeaseRecoveredAt).toLocaleString()}</p>
                              ) : null}
                              {r.recovery ? (
                                <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(r.recovery, null, 2)}</pre>
                              ) : (
                                <p>No recovery metadata.</p>
                              )}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground border-t border-border pt-4">
            Large reversals may require administrator support. Default strategies avoid overwriting existing records without
            an explicit choice.
          </p>
        </>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-foreground capitalize mt-0.5">{value}</p>
    </div>
  )
}

function Count({
  label,
  value,
  tone,
}: {
  label: string
  value: number | null
  tone?: "destructive"
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border px-3 py-2",
        tone === "destructive" && "border-destructive/30 bg-destructive/5",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value ?? "—"}</p>
    </div>
  )
}
