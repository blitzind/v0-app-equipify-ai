"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowLeft,
  Ban,
  Brain,
  ChevronRight,
  DollarSign,
  Filter,
  Loader2,
  ShieldOff,
  Sparkles,
  XCircle,
} from "lucide-react"
import type { PlatformAccount } from "@/lib/admin-data"
import { BrandLogo } from "@/components/brand-logo"
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

type AiOperationsResponse = {
  month: string
  range: { start: string; end: string }
  summary: {
    totalEstimatedCostUsd: number
    totalRequests: number
    failedRequests: number
    budgetBlockedRequests: number
    planBlockedRequests: number
    cacheHitsLogged: number
    cacheHitsNote?: string
  }
  topTasksByCost: { task: string; estimated_cost_usd: number }[]
  topOrganizationsByCost: {
    organization_id: string
    name: string | null
    plan_id: string
    plan_label: string
    estimated_cost_usd: number
  }[]
  usageByPlanTier?: { plan_id: string; plan_label: string; estimated_cost_usd: number }[]
  recentAiJobs?: Array<{
    id: string
    organization_id: string
    organization_name: string | null
    task: string
    status: string
    created_at: string
    duration_ms: number | null
    error_message: string | null
    progress_percent: number
    current_step: string | null
    source_type: string | null
    source_id: string | null
  }>
  recentLogs: Array<{
    id: string
    created_at: string
    organization_id: string
    organization_name: string | null
    organization_plan_id: string
    organization_plan_label: string
    task: string
    provider: string
    model: string
    prompt_tokens: number
    completion_tokens: number
    estimated_cost: number
    duration_ms: number
    success: boolean
    failure_reason: string | null
    cache_hit: boolean
    budget_blocked: boolean
    prompt_id: string | null
    prompt_version: number | null
    schema_version: string | null
  }>
  filterHints: { tasks: string[]; providers: string[]; models: string[] }
  alerts?: {
    openCount: number
    recentOpenAlerts: Array<{
      id: string
      organization_id: string | null
      organization_name: string | null
      alert_type: string
      severity: "info" | "warning" | "critical"
      title: string
      status: "open" | "acknowledged" | "resolved"
      created_at: string
    }>
  }
}

function fmtUsd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
}

function fmtDurationMs(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "—"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  tone: "slate" | "emerald" | "rose" | "amber" | "violet"
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

export default function AiOperationsPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  })
  const [organizationId, setOrganizationId] = useState("")
  const [task, setTask] = useState("")
  const [provider, setProvider] = useState("")
  const [model, setModel] = useState("")
  const [successFilter, setSuccessFilter] = useState<"all" | "true" | "false">("all")

  const [data, setData] = useState<AiOperationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<PlatformAccount[]>([])

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/accounts", { cache: "no-store" })
      const body = (await res.json()) as { accounts?: PlatformAccount[] }
      if (res.ok) setAccounts(body.accounts ?? [])
    } catch {
      setAccounts([])
    }
  }, [])

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams()
    p.set("month", month)
    if (organizationId.trim()) p.set("organizationId", organizationId.trim())
    if (task.trim()) p.set("task", task.trim())
    if (provider.trim()) p.set("provider", provider.trim())
    if (model.trim()) p.set("model", model.trim())
    if (successFilter !== "all") p.set("success", successFilter)
    return p.toString()
  }, [month, organizationId, task, provider, model, successFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/ai-operations?${buildQuery()}`, { cache: "no-store" })
      const body = (await res.json()) as AiOperationsResponse & { message?: string; error?: string }
      if (!res.ok) {
        setData(null)
        setError(body.message ?? body.error ?? `HTTP ${res.status}`)
        return
      }
      setData(body)
    } catch {
      setData(null)
      setError("Could not load AI operations data.")
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  const mutateAlert = useCallback(
    async (alertId: string, action: "acknowledge" | "resolve") => {
      const res = await fetch(`/api/platform/ai-alerts/${alertId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (res.ok) await load()
    },
    [load],
  )

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    void load()
    // Filters other than month require an explicit Refresh so typing task/model does not spam the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const hints = data?.filterHints

  const orgOptions = useMemo(() => {
    return [...accounts].sort((a, b) =>
      (a.organizationName ?? "").localeCompare(b.organizationName ?? "", undefined, { sensitivity: "base" }),
    )
  }, [accounts])

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center h-14 px-6 bg-[#0F172A] border-b border-white/10 gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <BrandLogo className="h-7 w-auto max-h-7" priority />
          <span className="ml-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-200 border border-violet-400/25">
            AI Operations
          </span>
        </div>
        <div className="flex-1" />
        <Link
          href="/admin"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Platform Admin
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          App <ChevronRight size={12} />
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Brain className="h-6 w-6 text-violet-500" />
            <h1 className="text-xl font-semibold text-foreground">AI usage & reliability</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Cross-tenant operational view for platform admins only. No prompts or customer message bodies are stored or
            displayed.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">Month (UTC)</label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9" />
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
                  {orgOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name ?? a.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">Task (exact)</label>
              <Input
                className="h-9 font-mono text-xs"
                placeholder="e.g. classification"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                list="ai-op-task-hints"
              />
              <datalist id="ai-op-task-hints">
                {(hints?.tasks ?? []).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">Outcome</label>
              <Select
                value={successFilter}
                onValueChange={(v) => setSuccessFilter(v as "all" | "true" | "false")}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outcomes</SelectItem>
                  <SelectItem value="true">Success only</SelectItem>
                  <SelectItem value="false">Failed / blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">Provider (exact)</label>
              <Input
                className="h-9 font-mono text-xs"
                placeholder="openai, anthropic, …"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                list="ai-op-provider-hints"
              />
              <datalist id="ai-op-provider-hints">
                {(hints?.providers ?? []).map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">Model</label>
              <Input
                placeholder="Exact match"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : loading && !data ? (
          <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <StatCard
                icon={DollarSign}
                label="Est. cost (month)"
                value={fmtUsd(data.summary.totalEstimatedCostUsd)}
                sub={`UTC month ${data.month}`}
                tone="emerald"
              />
              <StatCard
                icon={Activity}
                label="AI log rows"
                value={String(data.summary.totalRequests)}
                sub="One row per logged event"
                tone="slate"
              />
              <StatCard
                icon={XCircle}
                label="Failed (non-budget)"
                value={String(data.summary.failedRequests)}
                tone="rose"
              />
              <StatCard
                icon={ShieldOff}
                label="Budget blocked"
                value={String(data.summary.budgetBlockedRequests)}
                tone="amber"
              />
              <StatCard
                icon={Ban}
                label="Plan blocked"
                value={String(data.summary.planBlockedRequests ?? 0)}
                sub="Subscription tier / plan limits"
                tone="rose"
              />
              <StatCard
                icon={Sparkles}
                label="Cache hits (logged)"
                value={String(data.summary.cacheHitsLogged)}
                sub={data.summary.cacheHitsNote}
                tone="violet"
              />
              <StatCard
                icon={Ban}
                label="Open alerts"
                value={String(data.alerts?.openCount ?? 0)}
                sub="Operational AI alerts"
                tone="amber"
              />
            </div>
            {data.summary.cacheHitsNote ? (
              <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-3 py-2">
                {data.summary.cacheHitsNote}
              </p>
            ) : null}

            {data.usageByPlanTier && data.usageByPlanTier.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-muted/30">
                  <p className="text-sm font-semibold">Estimated cost by plan tier (month, filtered)</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.usageByPlanTier.map((r) => (
                      <TableRow key={r.plan_id}>
                        <TableCell className="text-sm">{r.plan_label}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtUsd(r.estimated_cost_usd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-muted/30">
                  <p className="text-sm font-semibold">Top tasks by estimated cost</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topTasksByCost.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-muted-foreground text-sm">
                          No data for filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.topTasksByCost.map((r) => (
                        <TableRow key={r.task}>
                          <TableCell className="font-mono text-xs">{r.task}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtUsd(r.estimated_cost_usd)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-muted/30">
                  <p className="text-sm font-semibold">Top organizations by estimated cost</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topOrganizationsByCost.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-muted-foreground text-sm">
                          No data for filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.topOrganizationsByCost.map((r) => (
                        <TableRow key={r.organization_id}>
                          <TableCell className="max-w-[280px] truncate">
                            <span className="block truncate">{r.name ?? r.organization_id}</span>
                            <span className="text-[10px] text-muted-foreground">{r.plan_label}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{fmtUsd(r.estimated_cost_usd)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {data.recentAiJobs && data.recentAiJobs.length > 0 ? (
              <div className="rounded-lg border border-border overflow-x-auto">
                <div className="px-4 py-2 border-b border-border bg-muted/30">
                  <p className="text-sm font-semibold">Recent AI jobs (month, filtered)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Long-running tasks (catalog extraction, etc.). Duration is started→completed when both exist. Progress reflects polling state for imports.
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Created (UTC)</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right tabular-nums">%</TableHead>
                      <TableHead className="max-w-[140px]">Step</TableHead>
                      <TableHead className="max-w-[100px]">Source</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                      <TableHead className="max-w-[180px]">Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentAiJobs.map((j) => (
                      <TableRow key={j.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(j.created_at).toISOString().replace("T", " ").slice(0, 19)}
                        </TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate">
                          {j.organization_name ?? j.organization_id.slice(0, 8) + "…"}
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">{j.task}</TableCell>
                        <TableCell className="text-xs">{j.status}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {Number.isFinite(j.progress_percent) ? `${j.progress_percent}%` : "—"}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground max-w-[140px] truncate">
                          {j.current_step ?? "—"}
                        </TableCell>
                        <TableCell className="text-[10px] font-mono text-muted-foreground max-w-[100px] truncate" title={j.source_id ?? undefined}>
                          {j.source_type ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{fmtDurationMs(j.duration_ms)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                          {j.error_message ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <div className="rounded-lg border border-border overflow-x-auto">
              <div className="px-4 py-2 border-b border-border bg-muted/30">
                <p className="text-sm font-semibold">Open AI alerts</p>
                <p className="text-xs text-muted-foreground mt-0.5">Operational alerts only, no prompt/output content</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="whitespace-nowrap">Created (UTC)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.alerts?.recentOpenAlerts ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground text-sm">
                        No open alerts.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data.alerts?.recentOpenAlerts ?? []).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs">{a.severity}</TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate">
                          {a.organization_name ?? a.organization_id?.slice(0, 8) ?? "platform"}
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">{a.alert_type}</TableCell>
                        <TableCell className="text-xs max-w-[260px] truncate">{a.title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(a.created_at).toISOString().replace("T", " ").slice(0, 19)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => void mutateAlert(a.id, "acknowledge")}>
                              Acknowledge
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void mutateAlert(a.id, "resolve")}>
                              Resolve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-lg border border-border overflow-x-auto">
              <div className="px-4 py-2 border-b border-border bg-muted/30">
                <p className="text-sm font-semibold">Recent AI usage log</p>
                <p className="text-xs text-muted-foreground mt-0.5">Newest first · operational metadata only</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Time (UTC)</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead className="max-w-[200px]">Prompt</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Prompt tok</TableHead>
                    <TableHead className="text-right">Completion tok</TableHead>
                    <TableHead className="text-right">Est. cost</TableHead>
                    <TableHead>OK</TableHead>
                    <TableHead>Cache</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead className="max-w-[200px]">Failure</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-muted-foreground text-sm">
                        No rows for this month / filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recentLogs.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(r.created_at).toISOString().replace("T", " ").slice(0, 19)}
                        </TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate">
                          {r.organization_name ?? r.organization_id.slice(0, 8) + "…"}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {r.organization_plan_label ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">{r.task}</TableCell>
                        <TableCell className="text-[11px] max-w-[200px]">
                          {r.prompt_id != null || r.prompt_version != null || r.schema_version != null ? (
                            <span
                              className="block truncate font-mono text-muted-foreground"
                              title={
                                r.prompt_id
                                  ? `${r.prompt_id}${r.prompt_version != null ? ` · v${r.prompt_version}` : ""}${r.schema_version ? ` · ${r.schema_version}` : ""}`
                                  : undefined
                              }
                            >
                              {r.prompt_version != null ? `v${r.prompt_version}` : "—"}
                              {r.schema_version ? ` · ${r.schema_version}` : ""}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{r.provider}</TableCell>
                        <TableCell className="font-mono text-[11px] max-w-[120px] truncate">{r.model}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{r.prompt_tokens}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{r.completion_tokens}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{fmtUsd(r.estimated_cost)}</TableCell>
                        <TableCell className="text-xs">{r.success ? "yes" : "no"}</TableCell>
                        <TableCell className="text-xs">{r.cache_hit ? "yes" : "—"}</TableCell>
                        <TableCell className="text-xs">{r.budget_blocked ? "yes" : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                          {r.failure_reason ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
