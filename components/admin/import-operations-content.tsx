"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Database,
  Filter,
  Hourglass,
  Loader2,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  StickyNote,
  Wrench,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type RunSummary = {
  runId: string
  runRef: string
  status: string
  importJobId: string
  importJobRef: string
  importKind: string
  organizationId: string
  organizationName: string | null
  totalRows: number
  processedCount: number
  errorCount: number
  retryCount: number
  maxRetries: number
  nextRetryAt: string | null
  leaseExpiresAt: string | null
  lastHeartbeatAt: string | null
  startedAt: string | null
  completedAt: string | null
  updatedAt: string | null
  createdAt: string | null
  errorMessage: string | null
  recovery: Record<string, unknown> | null
  staleLeaseRecoveredAt: string | null
  isLikelyStuck: boolean
}

type OperatorEvent = {
  id: string
  importJobId: string
  importRunId: string | null
  organizationId: string
  actorEmail: string | null
  actorKind: string
  eventType: string
  severity: "info" | "warning" | "critical"
  message: string
  metadata: Record<string, unknown>
  createdAt: string
}

type ImportOpsResponse = {
  ok: true
  metrics: {
    generatedAt: string
    windowHours: number
    health: {
      queued: number
      processing: number
      retrying: number
      failed: number
      completedRecent: number
      staleLeaseRecoveredRecent: number
      stuckRunsApprox: number
    }
    totals: { runsTotal: number; runsLast24h: number }
    recentTerminalThroughput: {
      last24h: { completed: number; failed: number; cancelled: number; completedWithErrors: number }
      last7d: { completed: number; failed: number; cancelled: number; completedWithErrors: number }
    }
  }
  runs: RunSummary[]
  filters: {
    statuses: string[]
    organizations: { id: string; name: string }[]
    kinds: string[]
  }
  recentEvents: OperatorEvent[]
}

type StatusFilter = "all" | "queued" | "processing" | "completed" | "completed_with_errors" | "failed" | "cancelled"

const STATUS_CHOICES: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "completed", label: "Completed" },
  { value: "completed_with_errors", label: "Completed (errors)" },
  { value: "cancelled", label: "Cancelled" },
]

function fmtTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19)
}

function statusToneClasses(status: string, isLikelyStuck: boolean) {
  if (isLikelyStuck && status === "processing") {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
  }
  switch (status) {
    case "queued":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
    case "processing":
      return "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30"
    case "completed":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
    case "completed_with_errors":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
    case "failed":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
    case "cancelled":
      return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30"
    default:
      return "bg-muted/40 text-muted-foreground border-border"
  }
}

function HealthCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  tone: "slate" | "emerald" | "rose" | "amber" | "violet" | "sky"
}) {
  const toneRing =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/[0.06]"
      : tone === "rose"
        ? "border-rose-500/30 bg-rose-500/[0.06]"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-500/[0.06]"
          : tone === "violet"
            ? "border-violet-500/30 bg-violet-500/[0.06]"
            : tone === "sky"
              ? "border-sky-500/30 bg-sky-500/[0.06]"
              : "border-border bg-muted/40"
  const iconColor =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "rose"
        ? "text-rose-600 dark:text-rose-400"
        : tone === "amber"
          ? "text-amber-600 dark:text-amber-400"
          : tone === "violet"
            ? "text-violet-600 dark:text-violet-400"
            : tone === "sky"
              ? "text-sky-600 dark:text-sky-400"
              : "text-muted-foreground"
  return (
    <div className={cn("rounded-xl border p-4 flex gap-3", toneRing)}>
      <div className="mt-0.5">
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground tabular-nums leading-tight mt-0.5">{value}</p>
        {sub ? <p className="text-[11px] text-muted-foreground mt-1">{sub}</p> : null}
      </div>
    </div>
  )
}

function StatusPill({ status, isLikelyStuck }: { status: string; isLikelyStuck: boolean }) {
  const label = isLikelyStuck && status === "processing" ? "processing · likely stuck" : status.replace(/_/g, " ")
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border whitespace-nowrap capitalize",
        statusToneClasses(status, isLikelyStuck),
      )}
    >
      {isLikelyStuck && status === "processing" ? <ShieldAlert className="h-3 w-3" /> : null}
      {label}
    </span>
  )
}

export function ImportOperationsContent() {
  const [data, setData] = useState<ImportOpsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [organizationId, setOrganizationId] = useState("")
  const [importKind, setImportKind] = useState("")
  const [stuckOnly, setStuckOnly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [noteRunId, setNoteRunId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState("")
  const [noteSeverity, setNoteSeverity] = useState<"info" | "warning" | "critical">("info")

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams()
    if (search.trim()) p.set("search", search.trim())
    if (statusFilter !== "all") p.set("status", statusFilter)
    if (organizationId) p.set("organizationId", organizationId)
    if (importKind) p.set("kind", importKind)
    if (stuckOnly) p.set("stuckOnly", "true")
    p.set("limit", "100")
    return p.toString()
  }, [search, statusFilter, organizationId, importKind, stuckOnly])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/import-operations?${buildQuery()}`, { cache: "no-store" })
      const body = (await res.json()) as ImportOpsResponse & { error?: string; message?: string }
      if (!res.ok) {
        setData(null)
        setError(body.message ?? body.error ?? `HTTP ${res.status}`)
        return
      }
      setData(body)
      setSelected((prev) => {
        const next = new Set<string>()
        for (const r of body.runs) if (prev.has(r.runId)) next.add(r.runId)
        return next
      })
    } catch {
      setData(null)
      setError("Could not load import operations data.")
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    void load()
  }, [load])

  const allOnPage = useMemo(() => (data?.runs ?? []).map((r) => r.runId), [data?.runs])
  const allSelected = allOnPage.length > 0 && allOnPage.every((id) => selected.has(id))
  const selectedRuns = useMemo(
    () => (data?.runs ?? []).filter((r) => selected.has(r.runId)),
    [data?.runs, selected],
  )
  const failedSelected = selectedRuns.filter((r) => r.status === "failed")
  const stuckSelected = selectedRuns.filter((r) => r.isLikelyStuck && r.status === "processing")

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        for (const id of allOnPage) next.delete(id)
      } else {
        for (const id of allOnPage) next.add(id)
      }
      return next
    })
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runBulkAction = async (action: "retry" | "recover", runIds: string[]) => {
    if (runIds.length === 0) return
    setBusy(true)
    setActionError(null)
    setActionMessage(null)
    try {
      const path =
        action === "retry"
          ? "/api/platform/import-operations/bulk-retry"
          : "/api/platform/import-operations/bulk-recover"
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runIds }),
      })
      const body = (await res.json()) as {
        ok?: boolean
        attempted?: number
        succeeded?: number
        skipped?: number
        errors?: { runId: string; message: string }[]
        message?: string
      }
      if (!res.ok) {
        setActionError(body.message ?? `HTTP ${res.status}`)
      } else {
        const verb = action === "retry" ? "retried" : "recovered"
        setActionMessage(
          `${body.succeeded ?? 0} of ${body.attempted ?? runIds.length} ${verb}` +
            (body.skipped ? ` · ${body.skipped} skipped` : "") +
            (body.errors && body.errors.length ? ` · ${body.errors.length} errors` : ""),
        )
        setSelected(new Set())
        await load()
      }
    } catch {
      setActionError("Bulk action failed.")
    } finally {
      setBusy(false)
    }
  }

  const submitNote = async () => {
    if (!noteRunId) return
    const message = noteText.trim()
    if (!message) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(
        `/api/platform/import-operations/runs/${encodeURIComponent(noteRunId)}/notes`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, severity: noteSeverity }),
        },
      )
      const body = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok) {
        setActionError(body.message ?? `HTTP ${res.status}`)
      } else {
        setActionMessage("Operator note recorded.")
        setNoteText("")
        setNoteRunId(null)
        await load()
      }
    } catch {
      setActionError("Could not record operator note.")
    } finally {
      setBusy(false)
    }
  }

  const generatedAt = data?.metrics.generatedAt ? fmtTime(data.metrics.generatedAt) : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <Database className="h-6 w-6 text-violet-500 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-foreground">Import operations</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Cross-tenant queue health, search, and recovery for the async migration import runner. Re-queues respect
            the same lease + cron processing pipeline; sync imports are unaffected.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading || busy} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {generatedAt ? (
        <p className="text-[11px] text-muted-foreground -mt-3">
          Generated {generatedAt} UTC · {data?.metrics.totals.runsLast24h ?? 0} runs in last 24h ·{" "}
          {data?.metrics.totals.runsTotal ?? 0} total
        </p>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {actionMessage ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
          {actionMessage}
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {actionError}
        </div>
      ) : null}

      {/* Health cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <HealthCard
          icon={Hourglass}
          tone="sky"
          label="Queued"
          value={data?.metrics.health.queued ?? "…"}
          sub="Awaiting cron pickup"
        />
        <HealthCard
          icon={PlayCircle}
          tone="violet"
          label="Processing"
          value={data?.metrics.health.processing ?? "…"}
          sub={
            data && data.metrics.health.stuckRunsApprox > 0
              ? `${data.metrics.health.stuckRunsApprox} likely stuck`
              : "Active workers"
          }
        />
        <HealthCard
          icon={RotateCcw}
          tone="amber"
          label="Retrying"
          value={data?.metrics.health.retrying ?? "…"}
          sub="Queued with retry_count > 0"
        />
        <HealthCard
          icon={XCircle}
          tone="rose"
          label="Failed"
          value={data?.metrics.health.failed ?? "…"}
          sub="Awaiting operator action"
        />
        <HealthCard
          icon={CheckCircle2}
          tone="emerald"
          label="Completed (24h)"
          value={data?.metrics.health.completedRecent ?? "…"}
          sub="Finished cleanly in last 24h"
        />
        <HealthCard
          icon={Wrench}
          tone="amber"
          label="Stale lease recovered"
          value={data?.metrics.health.staleLeaseRecoveredRecent ?? "…"}
          sub="Last 24h"
        />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Search</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load()
              }}
              placeholder="Run ref, import ref, org name, error…"
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_CHOICES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Organization</label>
            <Select
              value={organizationId || "__all__"}
              onValueChange={(v) => setOrganizationId(v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All organizations</SelectItem>
                {(data?.filters.organizations ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Import kind</label>
            <Select value={importKind || "__all__"} onValueChange={(v) => setImportKind(v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All kinds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All kinds</SelectItem>
                {(data?.filters.kinds ?? []).map((k) => (
                  <SelectItem key={k} value={k}>
                    {k.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-end gap-2 text-xs text-muted-foreground pb-1.5">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={stuckOnly}
              onChange={(e) => setStuckOnly(e.target.checked)}
            />
            Likely stuck only
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => void load()} disabled={loading || busy}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Apply filters
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch("")
              setStatusFilter("all")
              setOrganizationId("")
              setImportKind("")
              setStuckOnly(false)
            }}
            disabled={loading || busy}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
        <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">
          {selectedRuns.length === 0
            ? "Select runs in the table below to enable bulk actions."
            : `${selectedRuns.length} selected · ${failedSelected.length} failed · ${stuckSelected.length} likely stuck`}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || failedSelected.length === 0}
            onClick={() => void runBulkAction("retry", failedSelected.map((r) => r.runId))}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Bulk retry failed ({failedSelected.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || stuckSelected.length === 0}
            onClick={() => void runBulkAction("recover", stuckSelected.map((r) => r.runId))}
          >
            <Wrench className="h-4 w-4 mr-1" />
            Bulk recover stuck ({stuckSelected.length})
          </Button>
        </div>
      </div>

      {/* Runs table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
          <p className="text-sm font-semibold">Import runs</p>
          <span className="text-[11px] text-muted-foreground">
            ({data?.runs.length ?? 0} shown · max 200)
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input type="checkbox" className="h-4 w-4" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <TableHead>Run</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead className="text-right">Errors</TableHead>
              <TableHead className="text-right">Retries</TableHead>
              <TableHead className="whitespace-nowrap">Updated (UTC)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data && data.runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-muted-foreground text-sm">
                  {loading ? "Loading…" : "No runs match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              (data?.runs ?? []).map((r) => {
                const isSelected = selected.has(r.runId)
                return (
                  <TableRow key={r.runId} className={isSelected ? "bg-primary/[0.04]" : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={isSelected}
                        onChange={() => toggleOne(r.runId)}
                        aria-label={`Select run ${r.runRef}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-[11px] whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-primary">{r.runRef}</span>
                        <span className="text-muted-foreground">{r.importJobRef}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">
                      {r.organizationName ?? <span className="text-muted-foreground">(unknown org)</span>}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{r.importKind.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <StatusPill status={r.status} isLikelyStuck={r.isLikelyStuck} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {r.processedCount}/{r.totalRows}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{r.errorCount}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {r.retryCount}/{r.maxRetries}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtTime(r.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="inline-flex gap-1">
                        {r.status === "failed" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            disabled={busy}
                            onClick={() => void runBulkAction("retry", [r.runId])}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        ) : null}
                        {r.isLikelyStuck && r.status === "processing" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            disabled={busy}
                            onClick={() => void runBulkAction("recover", [r.runId])}
                          >
                            <Wrench className="h-3 w-3 mr-1" />
                            Recover
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            setNoteRunId(r.runId)
                            setNoteText("")
                            setNoteSeverity("info")
                          }}
                        >
                          <StickyNote className="h-3 w-3 mr-1" />
                          Note
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Inline error preview for failures */}
      {data?.runs.some((r) => r.status === "failed" && r.errorMessage) ? (
        <div className="rounded-lg border border-border overflow-x-auto">
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <p className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Recent failure messages
            </p>
          </div>
          <ul className="divide-y divide-border">
            {data.runs
              .filter((r) => r.status === "failed" && r.errorMessage)
              .slice(0, 8)
              .map((r) => (
                <li key={`err-${r.runId}`} className="px-4 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-primary">{r.runRef}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="capitalize">{r.importKind.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{r.organizationName ?? "(org)"}</span>
                  </div>
                  <p className="text-muted-foreground mt-1">{r.errorMessage}</p>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {/* Operator events log */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Operator events log</p>
          <span className="text-[11px] text-muted-foreground">(last {data?.recentEvents.length ?? 0})</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">When (UTC)</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data || data.recentEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-sm">
                  No operator events recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              data.recentEvents.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtTime(ev.createdAt)}</TableCell>
                  <TableCell className="font-mono text-[11px]">{ev.eventType}</TableCell>
                  <TableCell className="text-xs capitalize">{ev.severity}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                    {ev.actorEmail ?? ev.actorKind}
                  </TableCell>
                  <TableCell className="text-xs max-w-[420px] truncate">{ev.message}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Note modal */}
      {noteRunId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              Operator note
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Recorded against this run for ops history. Visible to platform admins and to workspace owners/admins of
              the affected organization.
            </p>
            <div className="flex flex-col gap-1 mt-3">
              <label className="text-[11px] text-muted-foreground">Severity</label>
              <Select value={noteSeverity} onValueChange={(v) => setNoteSeverity(v as "info" | "warning" | "critical")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">info</SelectItem>
                  <SelectItem value="warning">warning</SelectItem>
                  <SelectItem value="critical">critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 mt-3">
              <label className="text-[11px] text-muted-foreground">Message</label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Describe the action, ticket reference, or context…"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" size="sm" variant="ghost" onClick={() => setNoteRunId(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={busy || !noteText.trim()} onClick={() => void submitNote()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save note
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
