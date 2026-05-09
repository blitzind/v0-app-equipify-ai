"use client"

/**
 * Communications Center Phase 1 — main visual page.
 *
 * Composes:
 *   - hero card (icon + title + description, no decorative artwork)
 *   - KPI strip (Sent today / Failed / Queued / Automated /
 *     Prospect follow-ups)
 *   - single-row toolbar matching the Customers / Equipment /
 *     Prospects / Work Orders pattern
 *   - unified chronological feed with click-to-open detail drawer
 *
 * Data comes from `/api/.../communications/feed` (Phase 1 enriched
 * endpoint). Existing tabs (Templates / Automations / AI suggestions
 * / Failed deliveries) live behind a "Tools" link out to the legacy
 * power-user view, which stays mounted at the same route.
 *
 * The page also accepts optional `customerId`, `entityType`, and
 * `entityId` props so it can be embedded inside the customer /
 * prospect / work-order / invoice / quote drawers as a smaller
 * "Recent communications" panel via `compactEmbed`.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowDownToLine,
  Bell,
  Inbox,
  Loader2,
  MessageSquare,
  NotebookPen,
  Search,
  Send,
  Settings2,
  XCircle,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  COMMUNICATION_CENTER_KINDS,
  COMMUNICATION_KIND_LABEL,
  type CommunicationCenterKind,
} from "@/lib/communications/communication-kind"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { ComposeDraftDialog } from "./compose-draft-dialog"
import { FeedRow } from "./feed-row"
import { FeedDetailDrawer } from "./feed-detail-drawer"
import type {
  FeedItemClient,
  FeedResponseClient,
  FeedStatsClient,
} from "./types-client"

type Channel = "all" | "email" | "sms" | "in_app" | "push" | "system"
type Status =
  | "all"
  | "sent"
  | "delivered"
  | "queued"
  | "pending"
  | "failed"
  | "bounced"
  | "skipped"
  | "simulated"
  | "draft"
type EntityType =
  | "all"
  | "work_order"
  | "invoice"
  | "quote"
  | "customer"
  | "prospect"
  | "equipment"
  | "maintenance_plan"

type DirectionFilter = "all" | "outbound" | "inbound"
type KindFilter = "all" | CommunicationCenterKind
type AiSourceFilter = "all" | "ai" | "manual"
type AssignedFilter = "all" | "me"

const EMPTY_STATS: FeedStatsClient = {
  sentToday: 0,
  failed: 0,
  queued: 0,
  automated: 0,
  prospectFollowUps: 0,
  total: 0,
}

export function CommunicationsFeedPage() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { permissions } = useOrgPermissions()

  const canView = Boolean(permissions.canViewCommunications)
  const canManage = Boolean(permissions.canManageCommunications)

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [channel, setChannel] = useState<Channel>("all")
  const [status, setStatus] = useState<Status>("all")
  const [entityType, setEntityType] = useState<EntityType>("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [automatedOnly, setAutomatedOnly] = useState(false)
  const [direction, setDirection] = useState<DirectionFilter>("all")
  const [communicationKind, setCommunicationKind] = useState<KindFilter>("all")
  const [aiSource, setAiSource] = useState<AiSourceFilter>("all")
  const [assignedFilter, setAssignedFilter] = useState<AssignedFilter>("all")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [items, setItems] = useState<FeedItemClient[]>([])
  const [stats, setStats] = useState<FeedStatsClient>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<FeedItemClient | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)

  // Debounce the search input to avoid spamming the API on each
  // keystroke. 350ms is the same value used elsewhere in the app.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(t)
  }, [search])

  const params = useMemo(() => {
    const p = new URLSearchParams()
    if (debouncedSearch) p.set("search", debouncedSearch)
    if (channel !== "all") p.set("channel", channel)
    if (status !== "all") p.set("status", status)
    if (entityType !== "all") p.set("entityType", entityType)
    if (fromDate) p.set("fromDate", fromDate)
    if (toDate) p.set("toDate", toDate)
    if (automatedOnly) p.set("automated", "1")
    if (direction !== "all") p.set("direction", direction)
    if (communicationKind !== "all") p.set("communicationKind", communicationKind)
    if (aiSource !== "all") p.set("aiSource", aiSource)
    if (assignedFilter === "me" && currentUserId) {
      p.set("assignedUserId", currentUserId)
    }
    p.set("limit", "100")
    return p.toString()
  }, [
    debouncedSearch,
    channel,
    status,
    entityType,
    fromDate,
    toDate,
    automatedOnly,
    direction,
    communicationKind,
    aiSource,
    assignedFilter,
    currentUserId,
  ])

  const reload = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/communications/feed?${params}`,
        { cache: "no-store" },
      )
      const body = (await res.json()) as FeedResponseClient & { error?: string }
      if (!res.ok) throw new Error(body.error ?? "Failed to load communications.")
      setItems(body.items ?? [])
      setStats(body.stats ?? EMPTY_STATS)
      if (body.currentUserId) setCurrentUserId(body.currentUserId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load communications.")
      setItems([])
      setStats(EMPTY_STATS)
    } finally {
      setLoading(false)
    }
  }, [organizationId, params])

  const groupedTimeline = useMemo(() => {
    const buckets = new Map<string, FeedItemClient[]>()
    for (const it of items) {
      const key = localDayKey(it.created_at)
      const list = buckets.get(key)
      if (list) list.push(it)
      else buckets.set(key, [it])
    }
    return [...buckets.entries()].sort(([a], [b]) => b.localeCompare(a))
  }, [items])

  useEffect(() => {
    void reload()
  }, [reload])

  const onSelect = useCallback((item: FeedItemClient) => {
    setSelected(item)
    setDrawerOpen(true)
  }, [])

  function exportCsv() {
    const header = [
      "created_at",
      "channel",
      "event_type",
      "title",
      "delivery_status",
      "automated",
      "customer",
      "entity",
      "summary",
    ]
    const rows = items.map((it) => [
      it.created_at,
      it.channel,
      it.event_type,
      csvEscape(it.title),
      it.delivery_status,
      String(it.automated),
      csvEscape(it.customer_label ?? ""),
      csvEscape(it.entity_label ?? ""),
      csvEscape(it.summary ?? ""),
    ])
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `communications-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (orgStatus !== "ready" || !organizationId) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workspace…
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
        Communications visibility is restricted to other roles in your workspace.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 min-w-0">
      {/*
        The shared dashboard PageHero (see lib/page-shell ROUTE_META) already
        renders the Communications title card above this page. We intentionally
        do NOT add a second in-page hero here so the spacing rhythm matches
        Customers / Equipment / Work Orders.
      */}

      {/* KPI strip per Phase 1 spec */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiTile label="Sent today" value={stats.sentToday} icon={Send} tone="emerald" />
        <KpiTile
          label="Failed deliveries"
          value={stats.failed}
          icon={XCircle}
          tone={stats.failed > 0 ? "rose" : "muted"}
        />
        <KpiTile label="Pending or queued" value={stats.queued} icon={Inbox} tone="amber" />
        <KpiTile label="Automated messages" value={stats.automated} icon={Zap} tone="violet" />
        <KpiTile
          label="Prospect follow-ups"
          value={stats.prospectFollowUps}
          icon={MessageSquare}
          tone="blue"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Review automation suggestions in the{" "}
          <Link href="/communications/follow-ups" className="font-medium text-primary hover:underline">
            follow-up queue
          </Link>{" "}
          · Triage customer intake in{" "}
          <Link href="/communications/service-requests" className="font-medium text-primary hover:underline">
            service requests
          </Link>
          .
        </p>
      </div>

      {/* Toolbar — single row on desktop, wraps cleanly on tablet/mobile */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-11 items-center gap-2 w-full sm:flex-1 sm:max-w-sm rounded-md border border-border bg-card px-3 py-2 min-w-0">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Customer, email, WO/INV/quote number, snippet…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground min-w-0"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
            <SelectTrigger className="w-32 sm:w-36 min-h-11 lg:min-h-10">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="in_app">In-app / reminder</SelectItem>
              <SelectItem value="push">Push</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger className="w-32 sm:w-36 min-h-11 lg:min-h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="bounced">Bounced</SelectItem>
              <SelectItem value="simulated">Simulated</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
            <SelectTrigger className="w-32 sm:w-36 min-h-11 lg:min-h-10">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              <SelectItem value="work_order">Work orders</SelectItem>
              <SelectItem value="invoice">Invoices</SelectItem>
              <SelectItem value="quote">Quotes</SelectItem>
              <SelectItem value="customer">Customers</SelectItem>
              <SelectItem value="prospect">Prospects</SelectItem>
              <SelectItem value="equipment">Equipment</SelectItem>
              <SelectItem value="maintenance_plan">Maintenance plans</SelectItem>
            </SelectContent>
          </Select>

          <Select value={direction} onValueChange={(v) => setDirection(v as DirectionFilter)}>
            <SelectTrigger className="w-32 sm:w-36 min-h-11 lg:min-h-10">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any direction</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={communicationKind}
            onValueChange={(v) => setCommunicationKind(v as KindFilter)}
          >
            <SelectTrigger className="w-[200px] sm:w-[220px] min-h-11 lg:min-h-10">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {COMMUNICATION_CENTER_KINDS.filter((k) => k !== "general").map((k) => (
                <SelectItem key={k} value={k}>
                  {COMMUNICATION_KIND_LABEL[k]}
                </SelectItem>
              ))}
              <SelectItem value="general">{COMMUNICATION_KIND_LABEL.general}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={aiSource} onValueChange={(v) => setAiSource(v as AiSourceFilter)}>
            <SelectTrigger className="w-36 sm:w-40 min-h-11 lg:min-h-10">
              <SelectValue placeholder="AI / manual" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">AI & manual</SelectItem>
              <SelectItem value="ai">AI-assisted only</SelectItem>
              <SelectItem value="manual">Manual only</SelectItem>
            </SelectContent>
          </Select>

          <Select value={assignedFilter} onValueChange={(v) => setAssignedFilter(v as AssignedFilter)}>
            <SelectTrigger className="w-36 sm:w-40 min-h-11 lg:min-h-10">
              <SelectValue placeholder="Assigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              <SelectItem value="me" disabled={!currentUserId}>
                Assigned to me
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 min-h-11 lg:min-h-10 rounded-md border border-border bg-card px-2.5">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-xs outline-none w-[112px]"
              aria-label="From date"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-xs outline-none w-[112px]"
              aria-label="To date"
            />
          </div>

          <label className="inline-flex items-center gap-2 min-h-11 lg:min-h-10 rounded-md border border-border bg-card px-3 text-xs font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={automatedOnly}
              onChange={(e) => setAutomatedOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Automated only
          </label>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={exportCsv}
            disabled={items.length === 0}
            className="min-h-11 lg:min-h-10 gap-1.5 w-full sm:w-auto"
          >
            <ArrowDownToLine className="w-4 h-4" aria-hidden />
            Export CSV
          </Button>
          {canManage ? (
            <Button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="min-h-11 lg:min-h-10 gap-1.5 w-full sm:w-auto"
            >
              <NotebookPen className="w-4 h-4" aria-hidden />
              Compose draft
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            asChild
            className="min-h-11 lg:min-h-10 gap-1.5 w-full sm:w-auto"
          >
            <Link href="/settings/automations">
              <Settings2 className="w-4 h-4" aria-hidden />
              Automations
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading communications…
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 px-6 space-y-3">
            <Bell className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">
              No communications match your filters
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Outbound emails, automations, prospect follow-ups, and portal events appear here as
              they happen. Adjust filters or clear them to see more.
            </p>
            {hasActiveFilters({
              debouncedSearch,
              channel,
              status,
              entityType,
              fromDate,
              toDate,
              automatedOnly,
              direction,
              communicationKind,
              aiSource,
              assignedFilter,
            }) ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setChannel("all")
                  setStatus("all")
                  setEntityType("all")
                  setFromDate("")
                  setToDate("")
                  setAutomatedOnly(false)
                  setDirection("all")
                  setCommunicationKind("all")
                  setAiSource("all")
                  setAssignedFilter("all")
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {groupedTimeline.map(([dayKey, dayItems]) => (
              <div key={dayKey}>
                <div className="sticky top-0 z-[1] bg-muted/50 backdrop-blur-sm border-b border-border px-4 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatDayHeading(dayKey)}
                  </p>
                </div>
                <ul className="divide-y divide-border">
                  {dayItems.map((it) => (
                    <FeedRow key={it.id} item={it} onSelect={onSelect} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <FeedDetailDrawer
        organizationId={organizationId}
        initial={selected}
        open={drawerOpen}
        onOpenChange={(o) => {
          setDrawerOpen(o)
          if (!o) setSelected(null)
        }}
      />

      <ComposeDraftDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        organizationId={organizationId}
        onSaved={() => void reload()}
      />
    </div>
  )
}

function csvEscape(s: string): string {
  if (s == null) return ""
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** YYYY-MM-DD in the viewer's local calendar for grouping. */
function localDayKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatDayHeading(dayKey: string): string {
  const [y, mo, da] = dayKey.split("-").map((n) => Number.parseInt(n, 10))
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) return dayKey
  const d = new Date(y, mo - 1, da)
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const yest = new Date(now)
  yest.setDate(yest.getDate() - 1)
  const yesterdayKey = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`
  const fmt = (x: Date) =>
    x.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  if (todayKey === dayKey) return `Today — ${fmt(d)}`
  if (yesterdayKey === dayKey) return `Yesterday — ${fmt(d)}`
  return fmt(d)
}

function hasActiveFilters(args: {
  debouncedSearch: string
  channel: Channel
  status: Status
  entityType: EntityType
  fromDate: string
  toDate: string
  automatedOnly: boolean
  direction: DirectionFilter
  communicationKind: KindFilter
  aiSource: AiSourceFilter
  assignedFilter: AssignedFilter
}): boolean {
  return Boolean(
    args.debouncedSearch ||
      args.channel !== "all" ||
      args.status !== "all" ||
      args.entityType !== "all" ||
      args.fromDate ||
      args.toDate ||
      args.automatedOnly ||
      args.direction !== "all" ||
      args.communicationKind !== "all" ||
      args.aiSource !== "all" ||
      args.assignedFilter !== "all",
  )
}

function KpiTile({
  label,
  value,
  icon: Icon,
  tone = "muted",
  sub,
}: {
  label: string
  value: number
  icon: React.ElementType
  tone?: "emerald" | "rose" | "amber" | "violet" | "blue" | "muted"
  sub?: string
}) {
  const toneClasses: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
    blue: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
    muted: "bg-muted/40 text-muted-foreground border-border",
  }
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-4",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.15)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-foreground mt-1">{value}</p>
          {sub ? (
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{sub}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0",
            toneClasses[tone] ?? toneClasses.muted,
          )}
        >
          <Icon className="w-4 h-4" aria-hidden />
        </div>
      </div>
    </div>
  )
}
