"use client"

/**
 * Leads + Follow-Up Phase 1 — Prospects list page.
 *
 * Lightweight pipeline view that lives alongside Customers. Designed to be
 * additive to the existing customer architecture: data lives in its own
 * `prospects` table (so converted prospects keep their pre-conversion
 * history), but conversion writes through the same Customers + Contacts
 * insert path managed server-side.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Columns3,
  Inbox,
  LayoutList,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  UserPlus,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { useToast } from "@/hooks/use-toast"
import { RestrictedNotice } from "@/components/permissions/restricted-notice"
import { ProspectFormDialog } from "@/components/prospects/prospect-form-dialog"
import { ProspectDrawer } from "@/components/prospects/prospect-drawer"
import { ProspectPipelineBoard } from "@/components/prospects/prospect-pipeline-board"
import {
  ACTIVE_PROSPECT_STATUSES,
  PROSPECT_STATUSES,
  type FollowUpBucket,
  type ProspectListItem,
  type ProspectStatus,
} from "@/lib/prospects/types"
import {
  followUpBucketFor,
  formatEstimatedValue,
  formatFollowUpBucket,
  formatFollowUpStamp,
  formatProspectStatus,
  prospectStatusBadgeClasses,
} from "@/lib/prospects/format"
import { PageHeroCard } from "@/components/page-hero-card"
import { cn } from "@/lib/utils"

type ArchiveScope = "active" | "archived" | "all"

type ViewMode = "table" | "pipeline"

type AssigneeOption = { id: string; label: string }

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)))
}

/**
 * `useSearchParams` requires a Suspense boundary during static export. The
 * page is a tiny shell that wraps the real component (which holds
 * `useSearchParams`) in `<Suspense>`. Loading state is intentionally minimal
 * because the inner page also has its own skeleton.
 */
export default function ProspectsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading prospects…</div>}>
      <ProspectsPageInner />
    </Suspense>
  )
}

function ProspectsPageInner() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { permissions, status: permStatus } = useOrgPermissions()
  const { toast } = useToast()

  const canManage = Boolean(permissions.canManageProspects)

  const [rows, setRows] = useState<ProspectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // `?followup=overdue|today|this_week|upcoming|none` deep-links from the
  // dashboard widget and KPI tiles. We seed the filter from the URL on
  // first render but never write back — the user's clicks own the filter
  // after that.
  const searchParams = useSearchParams()
  const initialFollowUp = ((): FollowUpBucket => {
    const raw = searchParams?.get("followup")?.toLowerCase()
    if (
      raw === "overdue" ||
      raw === "today" ||
      raw === "this_week" ||
      raw === "upcoming" ||
      raw === "none"
    ) {
      return raw
    }
    return "all"
  })()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "all">("all")
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpBucket>(initialFollowUp)
  const [archiveScope, setArchiveScope] = useState<ArchiveScope>("active")

  const [createOpen, setCreateOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeProspect, setActiveProspect] = useState<ProspectListItem | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [assignees, setAssignees] = useState<AssigneeOption[]>([])

  const [lostPrompt, setLostPrompt] = useState<{ prospectId: string } | null>(null)
  const [lostReasonDraft, setLostReasonDraft] = useState("")
  const [qualificationPrompt, setQualificationPrompt] = useState<{
    prospectId: string
    targetStatus: ProspectStatus
  } | null>(null)
  const [qualNotesDraft, setQualNotesDraft] = useState("")
  const [qualValueDraft, setQualValueDraft] = useState("")

  const baseUrl = organizationId
    ? `/api/organizations/${encodeURIComponent(organizationId)}/prospects`
    : ""

  const load = useCallback(async () => {
    if (!organizationId || orgStatus !== "ready") {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      sp.set("archived", archiveScope)
      if (statusFilter !== "all") sp.set("status", statusFilter)
      if (search.trim()) sp.set("search", search.trim())
      const res = await fetch(`${baseUrl}?${sp.toString()}`, { cache: "no-store" })
      const j = (await res.json().catch(() => ({}))) as {
        prospects?: ProspectListItem[]
        message?: string
      }
      if (!res.ok) throw new Error(j.message ?? "Could not load prospects.")
      setRows(j.prospects ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load prospects.")
    } finally {
      setLoading(false)
    }
  }, [archiveScope, baseUrl, organizationId, orgStatus, search, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!organizationId || orgStatus !== "ready") return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/prospect-assignees`,
          { cache: "no-store" },
        )
        const j = (await res.json().catch(() => ({}))) as { assignees?: AssigneeOption[] }
        if (!cancelled && res.ok && Array.isArray(j.assignees)) setAssignees(j.assignees)
      } catch {
        if (!cancelled) setAssignees([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, orgStatus])

  // Re-sync the active drawer prospect when the underlying list refreshes
  // (e.g. after edit/follow-up/convert).
  useEffect(() => {
    if (!activeProspect) return
    const fresh = rows.find((p) => p.id === activeProspect.id)
    if (fresh && fresh !== activeProspect) setActiveProspect(fresh)
  }, [activeProspect, rows])

  const followUpFiltered = useMemo(() => {
    if (followUpFilter === "all") return rows
    return rows.filter((r) => followUpBucketFor(r.next_follow_up_at) === followUpFilter)
  }, [rows, followUpFilter])

  const followUpKpis = useMemo(() => {
    let overdue = 0
    let today = 0
    let thisWeek = 0
    let upcoming = 0
    let none = 0
    for (const r of rows) {
      const bucket = followUpBucketFor(r.next_follow_up_at)
      if (bucket === "overdue") overdue += 1
      else if (bucket === "today") today += 1
      else if (bucket === "this_week") thisWeek += 1
      else if (bucket === "upcoming") upcoming += 1
      else none += 1
    }
    return { overdue, today, thisWeek, upcoming, none }
  }, [rows])

  const statusKpis = useMemo(() => {
    const map = {} as Record<ProspectStatus, number>
    for (const s of PROSPECT_STATUSES) map[s] = 0
    for (const r of rows) {
      if (r.status in map) map[r.status as ProspectStatus] += 1
    }
    return map
  }, [rows])

  const operationalMetrics = useMemo(() => {
    const active = rows.filter((r) => !r.archived_at)
    const openPipeline = active.filter((r) => ACTIVE_PROSPECT_STATUSES.includes(r.status))
    const pipelineValueCents = openPipeline.reduce((acc, r) => acc + (r.estimated_value_cents ?? 0), 0)
    const staleOpen = openPipeline.filter((r) => {
      const d = daysSince(r.created_at)
      return d != null && d >= 14
    }).length
    const decided = statusKpis.won + statusKpis.lost
    const winRatePct = decided > 0 ? Math.round((100 * statusKpis.won) / decided) : null
    const openCount = openPipeline.length
    const withFollowUp = openPipeline.filter((r) => r.next_follow_up_at).length
    const followUpCompliancePct =
      openCount > 0 ? Math.round((100 * withFollowUp) / openCount) : null
    let overdueActive = 0
    for (const r of active) {
      if (followUpBucketFor(r.next_follow_up_at) === "overdue") overdueActive += 1
    }
    return {
      pipelineValueCents,
      staleOpen,
      winRatePct,
      followUpCompliancePct,
      overdueActive,
    }
  }, [rows, statusKpis])

  const stageAgeSummary = useMemo(() => {
    const active = rows.filter((r) => !r.archived_at)
    const openPipeline = active.filter((r) => ACTIVE_PROSPECT_STATUSES.includes(r.status))
    const parts: string[] = []
    for (const s of ACTIVE_PROSPECT_STATUSES) {
      const inStage = openPipeline.filter((r) => r.status === s)
      if (inStage.length === 0) continue
      const ages = inStage.map((r) => daysSince(r.created_at)).filter((d): d is number => d != null)
      if (ages.length === 0) continue
      const avg = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
      parts.push(`${formatProspectStatus(s)} ${avg}d avg`)
    }
    return parts.join(" · ")
  }, [rows])

  function openProspect(p: ProspectListItem) {
    setActiveProspect(p)
    setDrawerOpen(true)
  }

  async function submitProspectPatch(prospectId: string, body: Record<string, unknown>): Promise<boolean> {
    if (!organizationId || !canManage) return false
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/prospects/${encodeURIComponent(prospectId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      )
      const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      if (!res.ok) {
        if (j.error === "qualification_required" && typeof body.status === "string") {
          setQualificationPrompt({
            prospectId,
            targetStatus: body.status as ProspectStatus,
          })
          setQualNotesDraft("")
          setQualValueDraft("")
          return false
        }
        toast({
          title: j.message ?? "Could not update prospect",
          variant: "destructive",
        })
        return false
      }
      void load()
      return true
    } catch {
      toast({ title: "Could not update prospect", variant: "destructive" })
      return false
    }
  }

  async function handlePipelinePatch(prospectId: string, status: ProspectStatus) {
    if (status === "lost") {
      setLostPrompt({ prospectId })
      setLostReasonDraft("")
      return false
    }
    return submitProspectPatch(prospectId, { status })
  }

  async function confirmLostReason() {
    if (!lostPrompt) return
    const trimmed = lostReasonDraft.trim()
    if (!trimmed) {
      toast({ title: "Enter a short lost reason", variant: "destructive" })
      return
    }
    const ok = await submitProspectPatch(lostPrompt.prospectId, {
      status: "lost",
      lost_reason: trimmed,
    })
    if (ok) {
      setLostPrompt(null)
      setLostReasonDraft("")
    }
  }

  async function confirmQualification() {
    if (!qualificationPrompt) return
    const notes = qualNotesDraft.trim()
    const raw = qualValueDraft.trim()
    let estimated_value_cents: number | undefined
    if (raw !== "") {
      const n = Number.parseFloat(raw)
      if (!Number.isFinite(n) || n < 0) {
        toast({ title: "Estimated value must be a valid non-negative number.", variant: "destructive" })
        return
      }
      estimated_value_cents = Math.round(n * 100)
    }
    if (!notes && estimated_value_cents == null) {
      toast({
        title: "Add notes or an estimated value",
        variant: "destructive",
      })
      return
    }
    const patch: Record<string, unknown> = { status: qualificationPrompt.targetStatus }
    if (notes) patch.notes = notes
    if (estimated_value_cents != null) patch.estimated_value_cents = estimated_value_cents
    const ok = await submitProspectPatch(qualificationPrompt.prospectId, patch)
    if (ok) {
      setQualificationPrompt(null)
      setQualNotesDraft("")
      setQualValueDraft("")
    }
  }

  const isLoadingState = loading || permStatus === "loading"

  if (!isLoadingState && !canManage && rows.length === 0) {
    // Manager-and-up only have write access, but read access matches RLS
    // (org membership). If the user has neither read nor any data, show a
    // friendly empty state. We still render the page below for read-only.
  }

  return (
    <div className="flex flex-col gap-8 min-w-0">
      {/* Hero — title card (no decorative right-side graphic; matches dashboard shell rhythm) */}
      <PageHeroCard
        title="Prospects"
        subtitle="Inbound leads and opportunities. Convert promising prospects into customers while preserving pre-conversion history."
        icon={UserPlus}
        featureColor="var(--primary)"
      />

      {!canManage ? (
        <RestrictedNotice
          capability="canManageProspects"
          title="Prospect editing restricted to your role"
          body="You can browse the pipeline read-only. Owners, admins, and managers can create, edit, and convert prospects."
        />
      ) : null}

      {/* KPI strip — aligned with dashboard StatCard visual language */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiTile
          label="Overdue follow-ups"
          value={followUpKpis.overdue}
          icon={AlertCircle}
          tone={followUpKpis.overdue > 0 ? "rose" : "muted"}
          sub={followUpKpis.overdue === 0 ? "All caught up" : "Past their follow-up date"}
          onClick={() => setFollowUpFilter("overdue")}
        />
        <KpiTile
          label="Due today"
          value={followUpKpis.today}
          icon={Calendar}
          tone={followUpKpis.today > 0 ? "amber" : "muted"}
          sub="Plan today's calls and emails"
          onClick={() => setFollowUpFilter("today")}
        />
        <KpiTile
          label="This week"
          value={followUpKpis.thisWeek}
          icon={CalendarClock}
          tone={followUpKpis.thisWeek > 0 ? "violet" : "muted"}
          sub="Through end of week"
          onClick={() => setFollowUpFilter("this_week")}
        />
        <KpiTile
          label="Upcoming"
          value={followUpKpis.upcoming}
          icon={CalendarClock}
          tone="blue"
          sub="Scheduled later"
          onClick={() => setFollowUpFilter("upcoming")}
        />
        <KpiTile
          label="Won this list"
          value={statusKpis.won}
          icon={CheckCircle2}
          tone="emerald"
          sub={`Proposal sent: ${statusKpis.proposal_sent} · Lost: ${statusKpis.lost}`}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Pipeline value (open)"
          value={`${formatEstimatedValue(operationalMetrics.pipelineValueCents)}`}
          icon={TrendingUp}
          tone="blue"
          sub="Estimated across active stages"
        />
        <KpiTile
          label="Win rate"
          value={operationalMetrics.winRatePct != null ? `${operationalMetrics.winRatePct}%` : "—"}
          icon={Sparkles}
          tone="violet"
          sub="Won ÷ (won + lost) on this list"
        />
        <KpiTile
          label="Stale leads (14d+)"
          value={operationalMetrics.staleOpen}
          icon={CalendarClock}
          tone={operationalMetrics.staleOpen > 0 ? "amber" : "muted"}
          sub="Open pipeline, aging from created date"
        />
        <KpiTile
          label="Follow-up coverage"
          value={operationalMetrics.followUpCompliancePct != null ? `${operationalMetrics.followUpCompliancePct}%` : "—"}
          icon={CheckCircle2}
          tone="emerald"
          sub={`Open rows with a next step · ${operationalMetrics.overdueActive} overdue touches`}
        />
      </div>

      {stageAgeSummary ? (
        <p className="text-xs text-muted-foreground leading-relaxed px-0.5">
          <span className="font-medium text-foreground">Avg age by open stage</span> — {stageAgeSummary}
        </p>
      ) : null}

      {/*
        Toolbar — single row on desktop, wraps cleanly on tablet/mobile.
        Visual rhythm matches /equipment, /customers, /work-orders:
          - search box: bordered card container with inline icon, min-h-11
          - selects: w-32 sm:w-36 (status / follow-up) and w-[132px] (archive)
          - primary action: ml-auto on desktop, full-width below sm
        No labels above controls — placeholders carry the meaning, same
        as the sibling list pages.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-11 items-center gap-2 w-full sm:flex-1 sm:max-w-sm rounded-md border border-border bg-card px-3 py-2 min-w-0">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Company, contact, email…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground min-w-0"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProspectStatus | "all")}>
            <SelectTrigger className="w-32 sm:w-36 min-h-11 lg:min-h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PROSPECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatProspectStatus(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={followUpFilter} onValueChange={(v) => setFollowUpFilter(v as FollowUpBucket)}>
            <SelectTrigger className="w-32 sm:w-36 min-h-11 lg:min-h-10">
              <SelectValue placeholder="Follow-up" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All follow-ups</SelectItem>
              <SelectItem value="overdue">{formatFollowUpBucket("overdue")}</SelectItem>
              <SelectItem value="today">{formatFollowUpBucket("today")}</SelectItem>
              <SelectItem value="this_week">{formatFollowUpBucket("this_week")}</SelectItem>
              <SelectItem value="upcoming">{formatFollowUpBucket("upcoming")}</SelectItem>
              <SelectItem value="none">{formatFollowUpBucket("none")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={archiveScope} onValueChange={(v) => setArchiveScope(v as ArchiveScope)}>
            <SelectTrigger className="w-[132px] min-h-11 lg:min-h-10">
              <SelectValue placeholder="Records" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border border-border bg-card p-0.5 shrink-0">
            <Button
              type="button"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-9 px-2.5 gap-1.5"
              onClick={() => setViewMode("table")}
              title="Table view"
            >
              <LayoutList className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline text-xs font-medium">Table</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "pipeline" ? "secondary" : "ghost"}
              size="sm"
              className="h-9 px-2.5 gap-1.5"
              onClick={() => setViewMode("pipeline")}
              title="Pipeline view"
            >
              <Columns3 className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline text-xs font-medium">Pipeline</span>
            </Button>
          </div>
        </div>

        {canManage ? (
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="w-full sm:w-auto sm:ml-auto gap-1.5 min-h-11 lg:min-h-10 px-4 font-semibold shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden />
            New prospect
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      {/* Table or pipeline */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
        {viewMode === "pipeline" ? (
          <div className="p-4 sm:p-5">
            {followUpFiltered.length === 0 && !loading ? (
              <EmptyState canManage={canManage} onCreate={() => setCreateOpen(true)} />
            ) : (
              <ProspectPipelineBoard
                prospects={followUpFiltered}
                canManage={canManage}
                onOpen={openProspect}
                onPipelinePatch={handlePipelinePatch}
              />
            )}
          </div>
        ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Next action</TableHead>
                <TableHead>Last contact</TableHead>
                <TableHead>Next follow-up</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Estimated value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-sm text-muted-foreground py-8 text-center">
                    Loading prospects…
                  </TableCell>
                </TableRow>
              ) : followUpFiltered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-7 sm:py-8 text-center align-middle">
                    <EmptyState canManage={canManage} onCreate={() => setCreateOpen(true)} />
                  </TableCell>
                </TableRow>
              ) : (
                followUpFiltered.map((p) => {
                  const bucket = followUpBucketFor(p.next_follow_up_at)
                  const followUpTone =
                    bucket === "overdue"
                      ? "text-rose-700 dark:text-rose-300"
                      : bucket === "today"
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-foreground"
                  return (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => openProspect(p)}
                    >
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{p.company_name}</span>
                          {p.archived_at ? (
                            <Badge variant="outline" className="text-[10px]">
                              Archived
                            </Badge>
                          ) : null}
                          {p.converted_customer_id ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                            >
                              Converted
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.contact_name ?? <span className="text-muted-foreground">—</span>}
                        {p.contact_email ? (
                          <span className="block text-[11px] text-muted-foreground">
                            {p.contact_email}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-[11px]", prospectStatusBadgeClasses(p.status))}
                        >
                          {formatProspectStatus(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                        {p.assigned_to_label ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                        {p.next_action_owner_label ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                        {p.last_contacted_at ? (
                          <span className="block">
                            {formatFollowUpStamp(p.last_contacted_at)}
                            {p.last_contacted_by_label ? (
                              <span className="block text-[10px] text-muted-foreground/90">
                                {p.last_contacted_by_label}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className={cn("text-sm tabular-nums", followUpTone)}>
                        {p.next_follow_up_at ? formatFollowUpStamp(p.next_follow_up_at) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.lead_source ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatEstimatedValue(p.estimated_value_cents)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        )}
      </div>

      <AlertDialog
        open={lostPrompt !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLostPrompt(null)
            setLostReasonDraft("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as lost</AlertDialogTitle>
            <AlertDialogDescription>
              Record why this opportunity closed so your team can learn from it. This appears on the prospect timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={lostReasonDraft}
            onChange={(e) => setLostReasonDraft(e.target.value)}
            placeholder="e.g. Chose another vendor, budget freeze, no response…"
            className="min-h-[88px] resize-y"
          />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button type="button" onClick={() => void confirmLostReason()}>
              Save & move to Lost
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={qualificationPrompt !== null}
        onOpenChange={(open) => {
          if (!open) {
            setQualificationPrompt(null)
            setQualNotesDraft("")
            setQualValueDraft("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add qualification details</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Before moving to {qualificationPrompt ? formatProspectStatus(qualificationPrompt.targetStatus) : ""}, add an
            estimated value or notes on the prospect.
          </p>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="qual-est">Estimated value (USD)</Label>
              <input
                id="qual-est"
                type="number"
                min={0}
                step="0.01"
                value={qualValueDraft}
                onChange={(e) => setQualValueDraft(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qual-notes">Notes</Label>
              <Textarea
                id="qual-notes"
                value={qualNotesDraft}
                onChange={(e) => setQualNotesDraft(e.target.value)}
                placeholder="Qualification context, scope, decision-makers…"
                className="min-h-[88px] resize-y"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQualificationPrompt(null)
                setQualNotesDraft("")
                setQualValueDraft("")
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmQualification()}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProspectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={organizationId ?? ""}
        prospect={null}
        assignees={assignees}
        onSaved={(saved) => {
          setCreateOpen(false)
          void load()
          // Open the drawer for the new prospect so the user can immediately
          // log a first follow-up.
          setActiveProspect({ ...saved, converted_customer_name: null })
          setDrawerOpen(true)
          toast({ title: "Prospect created" })
        }}
      />

      <ProspectDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        organizationId={organizationId ?? ""}
        prospect={activeProspect}
        canManage={canManage}
        assignees={assignees}
        onChanged={() => {
          void load()
        }}
      />
    </div>
  )
}

function KpiTile({
  label,
  value,
  icon: Icon,
  tone,
  sub,
  onClick,
}: {
  label: string
  value: number | string
  icon: typeof Sparkles
  tone: "rose" | "amber" | "blue" | "emerald" | "violet" | "muted"
  sub: string
  onClick?: () => void
}) {
  const iconColor =
    tone === "rose"
      ? "text-rose-700 dark:text-rose-300"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "blue"
          ? "text-blue-700 dark:text-blue-300"
          : tone === "emerald"
            ? "text-emerald-700 dark:text-emerald-300"
            : tone === "violet"
              ? "text-violet-700 dark:text-violet-300"
              : "text-muted-foreground"
  const iconBg =
    tone === "rose"
      ? "bg-rose-500/10"
      : tone === "amber"
        ? "bg-amber-500/10"
        : tone === "blue"
          ? "bg-blue-500/10"
          : tone === "emerald"
            ? "bg-emerald-500/10"
            : tone === "violet"
              ? "bg-violet-500/10"
              : "bg-muted/50"
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group bg-card rounded-xl border border-border p-4 sm:p-5 flex flex-col text-left h-full min-h-[148px]",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
        "dark:shadow-[0_1px_3px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.1)]",
        onClick &&
          "hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)] hover:-translate-y-px hover:border-primary/30 transition-all duration-200",
        !onClick && "cursor-default",
      )}
    >
      <div className="flex items-start justify-between gap-2 min-h-[2rem]">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-snug">
          {label}
        </p>
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg shrink-0",
            "ring-2 ring-transparent ring-offset-1 ring-offset-card",
            onClick && "group-hover:ring-primary/20 transition-all duration-200",
            iconBg,
          )}
        >
          <Icon
            className={cn(
              "w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200",
              onClick && "group-hover:scale-110",
              iconColor,
            )}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-col flex-1">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-foreground ds-tabular">
          {value}
        </span>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{sub}</p>
      </div>
    </button>
  )
}

function EmptyState({ canManage, onCreate }: { canManage: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-1 max-w-md mx-auto">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 ring-1 ring-border/60">
        <Inbox className="h-6 w-6 text-muted-foreground/90" strokeWidth={1.5} aria-hidden />
      </div>
      <div className="space-y-1.5 text-center">
        <p className="text-sm font-semibold text-foreground">Nothing matches this view</p>
        <p className="text-sm text-muted-foreground/90 leading-relaxed">
          Try another filter, search term, or archive scope. Add inbound leads here to track follow-ups
          and convert when they are ready — history stays on the prospect record.
        </p>
      </div>
      {canManage ? (
        <Button
          type="button"
          className="mt-1 h-9 gap-1.5 px-4 w-full max-w-xs font-semibold sm:w-auto"
          onClick={onCreate}
        >
          <Plus className="w-4 h-4" aria-hidden />
          New prospect
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground/80 text-center max-w-sm">
          Ask an owner, admin, or manager to add prospects or adjust filters.
        </p>
      )}
    </div>
  )
}
