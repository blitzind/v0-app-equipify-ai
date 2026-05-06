"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import { communicationEventPresentation } from "@/lib/notifications/event-icons"
import { hrefForRelatedEntity } from "@/lib/notifications/event-links"
import type {
  CommunicationAutomationRow,
  CommunicationMetricsPayload,
  CommunicationSuggestion,
} from "@/lib/communications/types"
import { useToast } from "@/hooks/use-toast"

type CommRow = {
  id: string
  title: string
  summary: string | null
  channel: string
  event_type: string
  delivery_status: string
  created_at: string
  related_entity_type: string | null
  related_entity_id: string | null
  recipient_customer_id?: string | null
  customer_display_name?: string | null
  error_message?: string | null
  is_read?: boolean
}

type TemplateRow = {
  id: string
  template_key: string
  name: string
  category: string
  subject: string | null
  body: string
  channel: string
  updated_at: string
}

function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function entityShort(type: string | null): string {
  if (!type) return "Record"
  const m: Record<string, string> = {
    work_order: "Work order",
    quote: "Quote",
    invoice: "Invoice",
    maintenance_plan: "Maintenance plan",
    customer: "Customer",
    equipment: "Equipment",
    organization: "Organization",
  }
  return m[type] ?? type.replace(/_/g, " ")
}

function deliveryBadgeVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "failed" || s === "bounced") return "destructive"
  if (s === "delivered" || s === "sent") return "default"
  if (s === "pending" || s === "queued") return "secondary"
  return "outline"
}

function emptyMetrics(): CommunicationMetricsPayload {
  return {
    emailsSentToday: 0,
    deliveryRatePercent: null,
    deliveryRateSampleSize: 0,
    openRatePercent: null,
    openRateIsEstimated: true,
    failedDeliveries: 0,
    pendingFollowUps: 0,
    automatedRemindersWeek: 0,
    computedAtIso: new Date().toISOString(),
  }
}

export default function CommunicationsCenter() {
  const activeOrg = useActiveOrganization()
  const orgId = activeOrg.status === "ready" ? activeOrg.organizationId : null
  const { toast } = useToast()

  const [tab, setTab] = useState("activity")

  const [metrics, setMetrics] = useState<CommunicationMetricsPayload | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [channel, setChannel] = useState("all")
  const [deliveryFilter, setDeliveryFilter] = useState("all")
  const [customerId, setCustomerId] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  const [activityRows, setActivityRows] = useState<CommRow[]>([])
  const [failedRows, setFailedRows] = useState<CommRow[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [failedLoading, setFailedLoading] = useState(false)

  const [unreadCount, setUnreadCount] = useState(0)

  const [customers, setCustomers] = useState<{ id: string; company_name: string }[]>([])

  const [automations, setAutomations] = useState<CommunicationAutomationRow[]>([])
  const [autoLoading, setAutoLoading] = useState(false)

  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [tplLoading, setTplLoading] = useState(false)
  const [editTpl, setEditTpl] = useState<TemplateRow | null>(null)
  const [tplDraft, setTplDraft] = useState({ name: "", subject: "", body: "" })
  const [tplSaving, setTplSaving] = useState(false)

  const [suggestions, setSuggestions] = useState<CommunicationSuggestion[]>([])
  const [suggLoading, setSuggLoading] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (!orgId) return
    const sb = createBrowserSupabaseClient()
    void sb
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", orgId)
      .order("company_name", { ascending: true })
      .limit(400)
      .then(({ data }) => {
        setCustomers(((data ?? []) as { id: string; company_name: string }[]) ?? [])
      })
  }, [orgId])

  const loadMetrics = useCallback(async () => {
    if (!orgId) return
    setMetricsLoading(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications/metrics`, {
        cache: "no-store",
      })
      const body = (await res.json()) as { metrics?: CommunicationMetricsPayload }
      if (!res.ok) throw new Error()
      setMetrics(body.metrics ?? emptyMetrics())
    } catch {
      setMetrics(emptyMetrics())
    } finally {
      setMetricsLoading(false)
    }
  }, [orgId])

  const activityQs = useMemo(() => {
    const p = new URLSearchParams()
    p.set("sync", "1")
    p.set("limit", "100")
    if (channel !== "all") p.set("channel", channel)
    if (deliveryFilter !== "all") p.set("deliveryStatus", deliveryFilter)
    if (dateFrom) p.set("dateFrom", dateFrom)
    if (dateTo) p.set("dateTo", dateTo)
    if (debouncedSearch.length >= 2) p.set("search", debouncedSearch)
    if (customerId !== "all") p.set("customerId", customerId)
    return p.toString()
  }, [channel, deliveryFilter, dateFrom, dateTo, debouncedSearch, customerId])

  const loadActivity = useCallback(async () => {
    if (!orgId) return
    setActivityLoading(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(orgId)}/communications?${activityQs}`,
        { cache: "no-store" },
      )
      const body = (await res.json()) as { events?: CommRow[]; unreadCount?: number; error?: string }
      if (!res.ok) throw new Error(body.error ?? "Failed")
      setActivityRows(body.events ?? [])
      setUnreadCount(Number(body.unreadCount ?? 0))
    } catch {
      setActivityRows([])
    } finally {
      setActivityLoading(false)
    }
  }, [orgId, activityQs])

  const loadFailed = useCallback(async () => {
    if (!orgId) return
    setFailedLoading(true)
    try {
      const p = new URLSearchParams()
      p.set("sync", "1")
      p.set("limit", "80")
      p.set("deliveryStatus", "failed,bounced")
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(orgId)}/communications?${p.toString()}`,
        { cache: "no-store" },
      )
      const body = (await res.json()) as { events?: CommRow[] }
      if (!res.ok) throw new Error()
      setFailedRows(body.events ?? [])
    } catch {
      setFailedRows([])
    } finally {
      setFailedLoading(false)
    }
  }, [orgId])

  const loadAutomations = useCallback(async () => {
    if (!orgId) return
    setAutoLoading(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications/automations`, {
        cache: "no-store",
      })
      const body = (await res.json()) as { automations?: CommunicationAutomationRow[] }
      if (!res.ok) throw new Error()
      setAutomations(body.automations ?? [])
    } catch {
      setAutomations([])
    } finally {
      setAutoLoading(false)
    }
  }, [orgId])

  const loadTemplates = useCallback(async () => {
    if (!orgId) return
    setTplLoading(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications/templates`, {
        cache: "no-store",
      })
      const body = (await res.json()) as { templates?: TemplateRow[]; error?: string }
      if (!res.ok) throw new Error(body.error ?? "")
      setTemplates(body.templates ?? [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load templates (migration applied?)."
      toast({ title: "Templates unavailable", description: msg, variant: "destructive" })
      setTemplates([])
    } finally {
      setTplLoading(false)
    }
  }, [orgId, toast])

  const loadSuggestions = useCallback(async () => {
    if (!orgId) return
    setSuggLoading(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications/suggestions`, {
        cache: "no-store",
      })
      const body = (await res.json()) as { suggestions?: CommunicationSuggestion[] }
      if (!res.ok) throw new Error()
      setSuggestions(body.suggestions ?? [])
    } catch {
      setSuggestions([])
    } finally {
      setSuggLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    void loadMetrics()
  }, [loadMetrics])

  useEffect(() => {
    void loadActivity()
  }, [loadActivity])

  useEffect(() => {
    if (tab === "failed") void loadFailed()
    if (tab === "automations") void loadAutomations()
    if (tab === "templates") void loadTemplates()
    if (tab === "ai") void loadSuggestions()
  }, [tab, loadFailed, loadAutomations, loadTemplates, loadSuggestions])

  async function markAllRead() {
    if (!orgId) return
    await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    })
    void loadActivity()
    void loadMetrics()
  }

  async function markOneRead(id: string) {
    if (!orgId) return
    await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    })
    void loadActivity()
  }

  async function retryEvent(id: string) {
    if (!orgId) return
    const res = await fetch(
      `/api/organizations/${encodeURIComponent(orgId)}/communications/${encodeURIComponent(id)}/retry`,
      { method: "POST" },
    )
    const body = (await res.json()) as { ok?: boolean; message?: string }
    if (!res.ok) {
      toast({ title: "Retry failed", description: String(body.message ?? res.status), variant: "destructive" })
      return
    }
    toast({ title: "Retry queued", description: body.message ?? "Delivery marked for retry." })
    void loadFailed()
    void loadMetrics()
    void loadActivity()
  }

  function openEdit(t: TemplateRow) {
    setEditTpl(t)
    setTplDraft({ name: t.name, subject: t.subject ?? "", body: t.body })
  }

  async function saveTemplate() {
    if (!orgId || !editTpl) return
    setTplSaving(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(orgId)}/communications/templates/${encodeURIComponent(editTpl.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tplDraft.name,
            subject: tplDraft.subject,
            body: tplDraft.body,
          }),
        },
      )
      if (!res.ok) throw new Error()
      toast({ title: "Template saved" })
      setEditTpl(null)
      void loadTemplates()
    } catch {
      toast({ title: "Save failed", variant: "destructive" })
    } finally {
      setTplSaving(false)
    }
  }

  const m = metrics ?? emptyMetrics()

  if (activeOrg.status !== "ready" || !orgId) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" />
        Select an organization to open the communications center.
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 px-1 sm:px-0">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          label="Emails sent today"
          value={metricsLoading ? "—" : String(m.emailsSentToday)}
          hint="Outbound email events today (UTC day)."
          icon={Mail}
        />
        <KpiCard
          label="Delivery rate"
          value={
            metricsLoading ? "—" : m.deliveryRatePercent != null ? `${m.deliveryRatePercent}%` : "—"
          }
          hint={
            m.deliveryRateSampleSize > 0
              ? `Last 30d · n=${m.deliveryRateSampleSize}`
              : "No finalized deliveries yet."
          }
          icon={Send}
        />
        <KpiCard
          label="Open rate"
          value={
            metricsLoading ? "—" : m.openRatePercent != null ? `${Math.round(m.openRatePercent)}%` : "—"
          }
          hint={m.openRateIsEstimated ? "Estimated — opens not tracked on every channel yet." : "Tracked opens"}
          icon={CheckCircle2}
        />
        <KpiCard
          label="Failed deliveries"
          value={metricsLoading ? "—" : String(m.failedDeliveries)}
          hint="Failed + bounced (all time in feed)."
          icon={XCircle}
        />
        <KpiCard
          label="Pending follow-ups"
          value={metricsLoading ? "—" : String(m.pendingFollowUps)}
          hint="Quotes sent >5 days, still open."
          icon={MessageSquare}
        />
        <KpiCard
          label="Automated reminders"
          value={metricsLoading ? "—" : String(m.automatedRemindersWeek)}
          hint="Reminder-keyed events in the last 7 days."
          icon={Sparkles}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList className="flex flex-wrap h-auto gap-1 sm:gap-2 p-1 w-full sm:w-auto justify-start">
          <TabsTrigger value="activity" className="gap-1.5">
            Activity
            {unreadCount > 0 ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {unreadCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="failed" className="gap-1">
            Failed deliveries
            {m.failedDeliveries > 0 ? (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {m.failedDeliveries}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1">
            <Bot className="w-3.5 h-3.5" />
            AI suggestions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-0 space-y-4">
          <div className="sticky top-0 z-20 -mx-2 px-2 py-3 bg-background/90 backdrop-blur-md border-b border-border/80 rounded-t-lg">
            <div className="flex flex-col xl:flex-row xl:items-end gap-3 flex-wrap">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 flex-1">
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="in_app">In-app / reminders</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Delivery" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="bounced">Bounced</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Customer" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all">All customers</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="bg-background"
                  placeholder="Search title or snippet…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
                  <Input
                    type="date"
                    className="w-[150px] bg-background"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
                  <Input
                    type="date"
                    className="w-[150px] bg-background"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void loadActivity()}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                {unreadCount > 0 ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => void markAllRead()}>
                    Mark all read
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-0">
              {activityLoading ? (
                <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading activity…
                </div>
              ) : activityRows.length === 0 ? (
                <div className="text-center py-16 px-6 space-y-3">
                  <Mail className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">No communication activity yet</p>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Send quote or invoice emails, enable workflows, or sync reminders. Activity appears here with delivery
                    status and customer context.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {activityRows.map((r) => (
                    <TimelineRow key={r.id} r={r} onMarkRead={() => void markOneRead(r.id)} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automations" className="mt-0 space-y-4">
          <p className="text-sm text-muted-foreground max-w-3xl">
            Operational visibility for reminders and follow-ups. Editing advanced workflow logic stays under Settings →
            Automations.
          </p>
          {autoLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {automations.map((a) => (
                <Card key={a.key} className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{a.label}</CardTitle>
                      <Badge variant={a.active ? "default" : "secondary"}>{a.active ? "Active" : "Inactive"}</Badge>
                    </div>
                    <CardDescription className="text-xs leading-relaxed">{a.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2 text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Trigger: </span>
                      {a.trigger}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Last run:{" "}
                        <span className="text-foreground font-mono tabular-nums">
                          {a.lastRunAt ? formatRelativeTime(a.lastRunAt) : "—"}
                        </span>
                      </span>
                      <span>
                        Next: <span className="text-foreground">{a.nextScheduledLabel ?? "—"}</span>
                      </span>
                    </div>
                    <div className="flex gap-4 pt-1">
                      <span className="text-emerald-700 dark:text-emerald-400">
                        OK (30d): {a.successCount30d}
                      </span>
                      <span className="text-destructive">Failed (30d): {a.failureCount30d}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-0 space-y-4">
          {tplLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates — apply DB migration and refresh.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((t) => (
                <Card key={t.id} className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <CardDescription className="capitalize">{t.category.replace(/_/g, " ")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      <span className="font-medium text-foreground">Subject: </span>
                      {t.subject ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{t.body}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(t)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toast({
                            title: "Preview",
                            description: "Merge fields like {{customer_name}} replace at send time.",
                          })
                        }
                      >
                        Preview notes
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          toast({
                            title: "AI rewrite (placeholder)",
                            description: "Wire to org AI tasks when policy allows — not sending provider calls yet.",
                          })
                        }
                      >
                        AI polish (placeholder)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="failed" className="mt-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            Bounced or failed sends. Retry marks the event as queued for the next provider integration pass.
          </p>
          <Card className="border-destructive/30 shadow-sm">
            <CardContent className="p-0">
              {failedLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading failures…
                </div>
              ) : failedRows.length === 0 ? (
                <div className="text-center py-14 px-4 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600/80" />
                  <p className="text-sm font-medium">No failed deliveries in view</p>
                  <p className="text-xs text-muted-foreground">Provider errors will appear here with reasons.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {failedRows.map((r) => (
                    <li key={r.id} className="flex flex-col sm:flex-row sm:items-start gap-3 px-4 py-4">
                      <div className="flex gap-3 flex-1 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive font-semibold text-xs">
                          {initials(r.customer_display_name ?? r.title)}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold truncate">{r.title}</span>
                            <Badge variant="destructive" className="text-[10px] capitalize">
                              {r.delivery_status}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {r.channel}
                            </Badge>
                          </div>
                          {r.customer_display_name ? (
                            <p className="text-xs text-muted-foreground">{r.customer_display_name}</p>
                          ) : null}
                          {r.related_entity_type ? (
                            <p className="text-xs text-muted-foreground">
                              {entityShort(r.related_entity_type)}
                              {r.related_entity_id ? (
                                <Link
                                  href={
                                    hrefForRelatedEntity(r.related_entity_type, r.related_entity_id) ?? "#"
                                  }
                                  className="ml-1 text-primary underline-offset-2 hover:underline inline-flex items-center gap-0.5"
                                >
                                  Open
                                  <ChevronRight className="w-3 h-3" />
                                </Link>
                              ) : null}
                            </p>
                          ) : null}
                          {r.error_message ? (
                            <p className="text-xs text-destructive/90 mt-1">{r.error_message}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1">No provider error captured.</p>
                          )}
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {formatRelativeTime(r.created_at)}
                          </p>
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void retryEvent(r.id)}>
                        Retry
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-0 space-y-4">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-sm text-violet-950 dark:text-violet-100 flex gap-2 items-start">
            <Bot className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Operational recommendations</p>
              <p className="text-xs opacity-90 mt-1">
                Generated from live quotes, invoices, maintenance plans, and delivery failures — no chat UI, no bulk
                campaigns.
              </p>
            </div>
          </div>
          {suggLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
              <Loader2 className="h-4 w-4 animate-spin" /> Generating suggestions…
            </div>
          ) : (
            <div className="grid gap-3">
              {suggestions.map((s) => (
                <Card
                  key={s.id}
                  className={cn(
                    "border-border/80 shadow-sm",
                    s.severity === "high" && "border-destructive/40",
                  )}
                >
                  <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-base leading-snug">{s.title}</CardTitle>
                      <CardDescription>{s.detail}</CardDescription>
                    </div>
                    {s.href ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={s.href}>
                          Open
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      </Button>
                    ) : null}
                  </CardHeader>
                  {s.metric != null ? (
                    <CardContent className="text-xs text-muted-foreground pt-0">
                      Metric: <span className="font-mono text-foreground">{s.metric}</span>
                    </CardContent>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={Boolean(editTpl)} onOpenChange={(o) => !o && setEditTpl(null)}>
        <SheetContent className="sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>Edit template</SheetTitle>
            <SheetDescription>Variables like {"{{customer_name}}"} are replaced when sending.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 py-4 overflow-y-auto">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input value={tplDraft.name} onChange={(e) => setTplDraft((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <Input
                value={tplDraft.subject}
                onChange={(e) => setTplDraft((p) => ({ ...p, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Body</label>
              <Textarea
                rows={12}
                value={tplDraft.body}
                onChange={(e) => setTplDraft((p) => ({ ...p, body: e.target.value }))}
              />
            </div>
          </div>
          <SheetFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setEditTpl(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveTemplate()} disabled={tplSaving}>
              {tplSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: React.ElementType
}) {
  return (
    <Card className="border-border/70 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="text-[11px] uppercase tracking-wide font-semibold">{label}</CardDescription>
          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
        <CardTitle className="text-2xl tabular-nums pt-1">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-[11px] text-muted-foreground px-4 pb-4 pt-0 leading-snug">{hint}</CardContent>
    </Card>
  )
}

function TimelineRow({
  r,
  onMarkRead,
}: {
  r: CommRow
  onMarkRead: () => void
}) {
  const { Icon, iconColor } = communicationEventPresentation(r.event_type, r.channel)
  const href = hrefForRelatedEntity(r.related_entity_type, r.related_entity_id)
  const unread = r.is_read === false
  const cust = r.customer_display_name

  return (
    <li
      className={cn(
        "flex flex-col sm:flex-row sm:items-start gap-3 px-4 py-4 transition-colors",
        unread ? "bg-primary/[0.04]" : "hover:bg-muted/40",
      )}
    >
      <div className="flex gap-3 flex-1 min-w-0">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            unread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {cust ? initials(cust) : <Icon className={cn("w-4 h-4", unread ? iconColor : "text-muted-foreground")} />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {unread ? <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden /> : null}
            <span className={cn("text-sm font-semibold", unread ? "text-foreground" : "text-foreground/90")}>
              {r.title}
            </span>
            <Badge variant="outline" className="text-[10px] capitalize shrink-0">
              {r.channel.replace(/_/g, " ")}
            </Badge>
            <Badge variant={deliveryBadgeVariant(r.delivery_status)} className="text-[10px] capitalize shrink-0">
              {r.delivery_status}
            </Badge>
          </div>
          {cust ? <p className="text-xs text-muted-foreground">{cust}</p> : null}
          {r.related_entity_type ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 font-medium text-foreground/80">
                {entityShort(r.related_entity_type)}
              </span>
              {href ? (
                <Link href={href} className="text-primary underline-offset-2 hover:underline inline-flex items-center gap-0.5">
                  View record
                  <ChevronRight className="w-3 h-3" />
                </Link>
              ) : null}
            </div>
          ) : null}
          {r.summary ? (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{r.summary}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {unread ? (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onMarkRead}>
                Mark read
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex sm:flex-col items-center sm:items-end gap-1 shrink-0 sm:text-right pl-14 sm:pl-0">
        <span className="text-[10px] text-muted-foreground tabular-nums">{formatRelativeTime(r.created_at)}</span>
      </div>
    </li>
  )
}
