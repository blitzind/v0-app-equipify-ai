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
  Plus,
  Search,
  Sparkles,
  UserPlus2,
  Users,
} from "lucide-react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
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
import { cn } from "@/lib/utils"

type ArchiveScope = "active" | "archived" | "all"

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
    const map: Record<ProspectStatus, number> = {
      new: 0,
      contacted: 0,
      follow_up: 0,
      quoted: 0,
      won: 0,
      lost: 0,
    }
    for (const r of rows) {
      if (r.status in map) map[r.status as ProspectStatus] += 1
    }
    return map
  }, [rows])

  function openProspect(p: ProspectListItem) {
    setActiveProspect(p)
    setDrawerOpen(true)
  }

  const isLoadingState = loading || permStatus === "loading"

  if (!isLoadingState && !canManage && rows.length === 0) {
    // Manager-and-up only have write access, but read access matches RLS
    // (org membership). If the user has neither read nor any data, show a
    // friendly empty state. We still render the page below for read-only.
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Prospects
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Inbound leads and opportunities. Convert promising prospects into customers from the
            drawer — pre-conversion history is preserved on the prospect record.
          </p>
        </div>
        {canManage ? (
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> New prospect
          </Button>
        ) : null}
      </div>

      {!canManage ? (
        <RestrictedNotice
          capability="canManageProspects"
          title="Prospect editing restricted to your role"
          body="You can browse the pipeline read-only. Owners, admins, and managers can create, edit, and convert prospects."
        />
      ) : null}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
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
          sub={`Quoted: ${statusKpis.quoted} · Lost: ${statusKpis.lost}`}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="flex-1 min-w-0">
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Company, contact, email…"
              className="h-9 text-sm pl-8"
            />
          </div>
        </div>
        <div className="sm:basis-[12rem] min-w-0">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProspectStatus | "all")}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
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
        </div>
        <div className="sm:basis-[14rem] min-w-0">
          <Label className="text-xs">Follow-up</Label>
          <Select value={followUpFilter} onValueChange={(v) => setFollowUpFilter(v as FollowUpBucket)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
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
        </div>
        <div className="sm:basis-[10rem] min-w-0">
          <Label className="text-xs">Archive</Label>
          <Select value={archiveScope} onValueChange={(v) => setArchiveScope(v as ArchiveScope)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="archived">Archived only</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next follow-up</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Estimated value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground py-8 text-center">
                    Loading prospects…
                  </TableCell>
                </TableRow>
              ) : followUpFiltered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center">
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
      </div>

      {/* Growth roadmap teaser */}
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5 text-[11px] text-muted-foreground inline-flex items-start gap-1.5 max-w-2xl">
        <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
        <span>
          Coming next: campaigns, review &amp; referral requests, automated nurture sequences, and
          AI follow-up suggestions. This pipeline is the foundation those tools will plug into.
        </span>
      </div>

      <ProspectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={organizationId ?? ""}
        prospect={null}
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
  value: number
  icon: typeof Sparkles
  tone: "rose" | "amber" | "blue" | "emerald" | "violet" | "muted"
  sub: string
  onClick?: () => void
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
            : tone === "violet"
              ? "text-violet-700 dark:text-violet-300 bg-violet-500/10"
              : "text-muted-foreground bg-muted/40"
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "bg-card rounded-xl border border-border p-4 flex flex-col gap-2 justify-between text-left h-full",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
        onClick ? "hover:border-primary/40 transition-colors" : "cursor-default",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", accent.split(" ").slice(-1)[0])}>
          <Icon className={cn("w-3.5 h-3.5", accent.split(" ")[0])} />
        </div>
      </div>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{sub}</p>
    </button>
  )
}

function EmptyState({ canManage, onCreate }: { canManage: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <UserPlus2 className="w-6 h-6 text-muted-foreground" />
      <p className="text-sm font-medium">No prospects in this view yet.</p>
      <p className="text-xs text-muted-foreground max-w-sm">
        Add inbound leads here and follow up consistently. When a prospect is ready, convert them
        into a customer in one click — no data re-entry required.
      </p>
      {canManage ? (
        <Button size="sm" className="gap-1.5 mt-1" onClick={onCreate}>
          <Plus className="w-3.5 h-3.5" /> New prospect
        </Button>
      ) : null}
    </div>
  )
}
