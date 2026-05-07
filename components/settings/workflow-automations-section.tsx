"use client"

/**
 * Workflow Automations Phase 2 — top-level Settings shell.
 *
 * KPI strip + filters + automation list. The visual builder, run
 * history drawer, action picker, and condition builder live in
 * `components/settings/workflow-automations/`. This file is the
 * coordinator that:
 *   - fetches the list (existing GET endpoint + Phase 1 stats)
 *   - hosts toggle / duplicate / delete / test / open builder actions
 *   - shows manager-friendly summaries with reuse of the catalogs
 *   - keeps "Advanced JSON" alive inside the builder dialog (not the
 *     list view) so power users can still author non-visual rules
 *
 * No engine, API contract, or schema is rewritten — the row shape
 * stays compatible with Phase 1's enriched response.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, Filter, Loader2, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useToast } from "@/hooks/use-toast"
import {
  TRIGGER_CATALOG,
  TRIGGER_CATALOG_ORDER,
  TRIGGER_GROUP_LABELS,
  triggerLabel,
} from "@/lib/workflows/trigger-catalog"
import type { WorkflowTriggerType } from "@/lib/workflows/types"
import { cn } from "@/lib/utils"
import { AutomationListRow } from "./workflow-automations/automation-row"
import { AutomationBuilderDialog } from "./workflow-automations/automation-builder-dialog"
import { RunHistoryDrawer } from "./workflow-automations/run-history-drawer"
import type { AutomationRow, AutomationsResponse } from "./workflow-automations/types"

type StatusFilter = "all" | "enabled" | "disabled" | "failing"

export function WorkflowAutomationsSection() {
  const org = useActiveOrganization()
  const orgId = org.status === "ready" ? org.organizationId : null
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AutomationRow[]>([])
  const [planOk, setPlanOk] = useState(true)

  // Filters
  const [search, setSearch] = useState("")
  const [triggerFilter, setTriggerFilter] = useState<WorkflowTriggerType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // Editor + drawer state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<AutomationRow | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null)

  // AI Ops Phase 2 — read `?aiops=1&trigger=...&name=...&description=...`
  // and pop the builder open with a pre-filled suggestion. This is a
  // one-shot effect (`consumed`) so refreshing the dialog state
  // doesn't re-trigger.
  const router = useRouter()
  const searchParams = useSearchParams()
  const consumedSuggestionRef = useRef(false)
  const [initialSuggestion, setInitialSuggestion] = useState<{
    name?: string
    description?: string
    triggerType?: WorkflowTriggerType
  } | null>(null)

  useEffect(() => {
    if (consumedSuggestionRef.current) return
    if (searchParams.get("aiops") !== "1") return
    consumedSuggestionRef.current = true
    const triggerParam = searchParams.get("trigger") ?? ""
    const triggerType =
      triggerParam in TRIGGER_CATALOG ? (triggerParam as WorkflowTriggerType) : undefined
    const name = (searchParams.get("name") ?? "").slice(0, 120)
    const description = (searchParams.get("description") ?? "").slice(0, 500)
    setInitialSuggestion({ name, description, triggerType })
    setEditing(null)
    setEditorOpen(true)
    // Strip the query params so the suggestion isn't re-applied on
    // navigation (back/forward, refresh).
    const next = new URLSearchParams(searchParams.toString())
    next.delete("aiops")
    next.delete("trigger")
    next.delete("name")
    next.delete("description")
    const search = next.toString()
    router.replace(search ? `/settings/automations?${search}` : "/settings/automations", {
      scroll: false,
    })
  }, [router, searchParams])

  // Drop the suggestion once the dialog closes so a subsequent
  // "+ New automation" click starts blank.
  useEffect(() => {
    if (!editorOpen) setInitialSuggestion(null)
  }, [editorOpen])

  const load = useCallback(async () => {
    if (!orgId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${orgId}/workflow-automations`)
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as AutomationsResponse
      setRows(data.automations ?? [])
      setPlanOk(data.automationAllowed !== false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (triggerFilter !== "all" && r.trigger_type !== triggerFilter) return false
      if (statusFilter === "enabled" && !r.enabled) return false
      if (statusFilter === "disabled" && r.enabled) return false
      if (statusFilter === "failing" && (r.recent_failure_count ?? 0) === 0) return false
      if (q) {
        const haystack = `${r.name} ${r.description ?? ""} ${triggerLabel(r.trigger_type)}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [rows, search, triggerFilter, statusFilter])

  const kpis = useMemo(() => {
    let active = 0
    let failures = 0
    let totalRuns = 0
    let attention = 0
    for (const r of rows) {
      if (r.enabled) active += 1
      const rf = r.recent_failure_count ?? 0
      const tr = r.recent_runs_count ?? 0
      failures += rf
      totalRuns += tr
      if (rf > 0 || (r.enabled && tr === 0 && r.created_at && rowIsStale(r.created_at))) attention += 1
    }
    return { active, failures, totalRuns, attention }
  }, [rows])

  function openCreate() {
    setEditing(null)
    setEditorOpen(true)
  }
  function openEdit(row: AutomationRow) {
    setEditing(row)
    setEditorOpen(true)
  }
  async function toggleEnabled(row: AutomationRow, next: boolean) {
    if (!orgId) return
    setPendingId(row.id)
    try {
      const res = await fetch(`/api/organizations/${orgId}/workflow-automations/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "Toggle failed")
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: next } : r)))
      toast({ title: next ? "Automation enabled" : "Automation disabled" })
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : undefined })
    } finally {
      setPendingId(null)
    }
  }
  async function duplicateRow(row: AutomationRow) {
    if (!orgId) return
    setPendingId(row.id)
    try {
      const res = await fetch(
        `/api/organizations/${orgId}/workflow-automations/${row.id}/duplicate`,
        { method: "POST" },
      )
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "Duplicate failed")
      }
      toast({ title: "Automation duplicated", description: "New copy is disabled by default." })
      await load()
    } catch (e) {
      toast({ title: "Could not duplicate", description: e instanceof Error ? e.message : undefined })
    } finally {
      setPendingId(null)
    }
  }
  async function archiveRow(row: AutomationRow) {
    if (!orgId) return
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return
    setPendingId(row.id)
    try {
      const res = await fetch(`/api/organizations/${orgId}/workflow-automations/${row.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "Delete failed")
      }
      toast({ title: "Automation deleted" })
      await load()
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : undefined })
    } finally {
      setPendingId(null)
    }
  }
  async function runTest(row: AutomationRow) {
    if (!orgId) return
    setPendingId(row.id)
    try {
      const res = await fetch(
        `/api/organizations/${orgId}/workflow-automations/${row.id}/test`,
        { method: "POST" },
      )
      const j = (await res.json().catch(() => ({}))) as {
        error?: string
        conditions_pass?: boolean
        action_count?: number
      }
      if (!res.ok) throw new Error(j.error ?? "Test failed")
      toast({
        title: j.conditions_pass ? "Test pass — actions would run" : "Test pass — conditions skipped actions",
        description: `Logged ${j.action_count ?? 0} simulated step${j.action_count === 1 ? "" : "s"}. Open Run history to inspect.`,
      })
      await load()
    } catch (e) {
      toast({ title: "Could not run test", description: e instanceof Error ? e.message : undefined })
    } finally {
      setPendingId(null)
    }
  }
  function openHistory(row: AutomationRow) {
    setHistoryTarget({ id: row.id, name: row.name })
    setHistoryOpen(true)
  }

  if (!orgId) {
    return (
      <p className="text-sm text-muted-foreground border border-border rounded-lg px-4 py-3">
        Select an organization to manage workflow automations.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Workflow rules</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            Visual automation builder. Pick a trigger, add no-code conditions, and stack actions.
            Advanced JSON is still available inside each automation. Requires Growth or Scale (or trial).
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreate} disabled={!planOk || loading} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New automation
        </Button>
      </div>

      {!planOk && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          Workflow automation is available on Growth and Scale plans. Upgrade to create rules.
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <KpiCard label="Active automations" value={kpis.active} sub={`of ${rows.length} total`} tone="emerald" />
        <KpiCard label="Failures (14d)" value={kpis.failures} sub="across all rules" tone={kpis.failures > 0 ? "rose" : "muted"} />
        <KpiCard label="Total runs (14d)" value={kpis.totalRuns} sub="completed + failed + simulated" tone="blue" />
        <KpiCard label="Need attention" value={kpis.attention} sub="failing or never run" tone={kpis.attention > 0 ? "amber" : "muted"} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, description, trigger…"
              className="h-9 text-sm pl-8"
            />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap min-w-0">
          <div className="space-y-1.5 min-w-0 sm:min-w-[12rem]">
            <Label className="text-[11px] text-muted-foreground">Trigger</Label>
            <Select value={triggerFilter} onValueChange={(v) => setTriggerFilter(v as WorkflowTriggerType | "all")}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All triggers</SelectItem>
                {TRIGGER_CATALOG_ORDER.map((id) => {
                  const meta = TRIGGER_CATALOG[id]
                  return (
                    <SelectItem key={id} value={id} className="text-xs">
                      {TRIGGER_GROUP_LABELS[meta.group]} · {meta.label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0 sm:min-w-[10rem]">
            <Label className="text-[11px] text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="failing">Failing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading automations…
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border bg-muted/20 rounded-xl px-4 py-10 text-center flex flex-col items-center gap-2">
          {rows.length === 0 ? (
            <>
              <p className="text-sm font-semibold text-foreground">No automations yet</p>
              <p className="text-xs text-muted-foreground max-w-md">
                Create one to react to prospect status changes, work orders, invoices, or maintenance
                events.
              </p>
              <Button type="button" size="sm" className="mt-1 gap-1.5" onClick={openCreate} disabled={!planOk}>
                <Plus className="w-3.5 h-3.5" /> New automation
              </Button>
            </>
          ) : (
            <>
              <Filter className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm font-medium">Nothing matches these filters</p>
              <p className="text-xs text-muted-foreground">
                Try a broader search, switch triggers, or reset the status filter.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((row) => (
            <AutomationListRow
              key={row.id}
              row={row}
              onEdit={openEdit}
              onToggle={toggleEnabled}
              onDuplicate={duplicateRow}
              onArchive={archiveRow}
              onRunTest={runTest}
              onRunHistory={openHistory}
              pendingId={pendingId}
            />
          ))}
        </div>
      )}

      {/* Active filter summary */}
      {filtered.length > 0 && filtered.length !== rows.length ? (
        <p className="text-[11px] text-muted-foreground">
          Showing {filtered.length} of {rows.length}
          <Badge variant="outline" className="ml-2 text-[10px]">
            Filter active
          </Badge>
        </p>
      ) : null}

      {/* Builder + history */}
      <AutomationBuilderDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        organizationId={orgId}
        editing={editing}
        initialSuggestion={initialSuggestion}
        onSaved={() => {
          void load()
        }}
        onRequestRunTest={async (id) => {
          const row = rows.find((r) => r.id === id)
          if (row) await runTest(row)
        }}
        onRequestRunHistory={(id, name) => {
          setHistoryTarget({ id, name })
          setHistoryOpen(true)
        }}
      />
      <RunHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        organizationId={orgId}
        automationId={historyTarget?.id ?? null}
        automationName={historyTarget?.name}
      />
    </div>
  )
}

function rowIsStale(createdAt: string): boolean {
  const ts = new Date(createdAt).getTime()
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts > 14 * 24 * 60 * 60 * 1000
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: number
  sub: string
  tone: "rose" | "amber" | "blue" | "emerald" | "muted"
}) {
  const accent =
    tone === "rose"
      ? "text-rose-700 dark:text-rose-300 bg-rose-500/10"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300 bg-amber-500/10"
        : tone === "blue"
          ? "text-blue-700 dark:text-blue-300 bg-blue-500/10"
          : tone === "emerald"
            ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
            : "text-muted-foreground bg-muted/40"
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3.5 flex flex-col gap-1.5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-snug">
          {label}
        </p>
        <span className={cn("inline-block h-1.5 w-1.5 rounded-full", accent.split(" ").slice(-1)[0])} aria-hidden />
      </div>
      <p className={cn("text-2xl font-bold tabular-nums", tone === "muted" ? "text-foreground" : accent.split(" ")[0])}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground leading-snug">{sub}</p>
    </div>
  )
}
