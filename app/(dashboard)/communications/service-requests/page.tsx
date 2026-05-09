"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Bot,
  ClipboardList,
  Loader2,
  RefreshCw,
  Send,
  UserPlus,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { canReadServiceRequestQueue } from "@/lib/service-requests/list-filter"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { formatCustomerLocationSelectLabel } from "@/lib/customer-locations/format"

type SrRow = {
  id: string
  status: string
  urgency: string
  source: string
  issue_summary: string
  description: string | null
  customer_id: string | null
  customer_location_id?: string | null
  equipment_id: string | null
  requester_name: string | null
  requester_email: string | null
  requester_phone: string | null
  preferred_service_window: string | null
  assigned_to_user_id: string | null
  converted_work_order_id: string | null
  internal_notes_log: unknown
  created_at: string
}

const STATUS_OPTIONS = [
  "new",
  "reviewing",
  "needs_info",
  "approved",
  "converted",
  "declined",
  "archived",
] as const

function urgencyBadge(u: string) {
  if (u === "critical" || u === "high") return "bg-rose-500/10 text-rose-900 dark:text-rose-100 border-rose-500/25"
  if (u === "low") return "bg-muted text-muted-foreground border-border"
  return "bg-amber-500/10 text-amber-900 dark:text-amber-100 border-amber-500/25"
}

function ServiceRequestsQueuePageContent() {
  const { toast } = useToast()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const canView = canReadServiceRequestQueue(permissions)
  const canManage = Boolean(permissions.canManageDispatch)
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const focusCustomer = (searchParams.get("focusCustomer") ?? "").trim()
  const focusLocation = (searchParams.get("focusLocation") ?? "").trim()

  const baseUrl =
    organizationId ? `/api/organizations/${encodeURIComponent(organizationId)}` : ""

  const [rows, setRows] = useState<SrRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fStatus, setFStatus] = useState<string>("active")
  const [fUrgency, setFUrgency] = useState<string>("all")
  const [fSource, setFSource] = useState<string>("all")

  const [detail, setDetail] = useState<SrRow | null>(null)
  const [noteText, setNoteText] = useState("")
  const [assignId, setAssignId] = useState("")
  const [statusEdit, setStatusEdit] = useState<string>("new")

  const [convertOpen, setConvertOpen] = useState(false)
  const [customerId, setCustomerId] = useState("")
  const [equipmentId, setEquipmentId] = useState("")
  const [woTitle, setWoTitle] = useState("")
  const [woPriority, setWoPriority] = useState("normal")
  const [woType, setWoType] = useState("repair")
  const [confirmConvert, setConfirmConvert] = useState(false)
  const [saveDraft, setSaveDraft] = useState(false)
  const [dedupeMatches, setDedupeMatches] = useState<Array<{ customer_id: string; company_name: string }>>([])
  const [convertLocationId, setConvertLocationId] = useState("")
  const [convertLocationOpts, setConvertLocationOpts] = useState<Array<{ id: string; label: string }>>([])
  const [eqOpts, setEqOpts] = useState<Array<{ id: string; name: string; customer_location_id: string | null }>>([])

  const [newOpen, setNewOpen] = useState(false)
  const [newSummary, setNewSummary] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newName, setNewName] = useState("")

  const [aiBusy, setAiBusy] = useState(false)
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null)

  const load = useCallback(async () => {
    if (!baseUrl || orgStatus !== "ready") return
    setLoading(true)
    try {
      const st = fStatus === "active" ? "all" : fStatus
      const qs = new URLSearchParams()
      if (st !== "all") qs.set("status", st)
      if (fUrgency !== "all") qs.set("urgency", fUrgency)
      if (fSource !== "all") qs.set("source", fSource)
      const res = await fetch(`${baseUrl}/service-requests?${qs.toString()}`, { cache: "no-store" })
      const body = (await res.json().catch(() => ({}))) as { requests?: SrRow[]; error?: string }
      if (!res.ok) throw new Error(body.error ?? "Failed to load")
      let list = body.requests ?? []
      if (fStatus === "active") {
        list = list.filter((r) => !["converted", "declined", "archived"].includes(r.status))
      }
      setRows(list)
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [baseUrl, fStatus, fSource, fUrgency, orgStatus, toast])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRows = useMemo(() => {
    let list = rows
    const idLooksLikeUuid = (s: string) => /^[0-9a-f-]{20,}$/i.test(s)
    if (focusCustomer && idLooksLikeUuid(focusCustomer)) {
      list = list.filter((r) => r.customer_id === focusCustomer)
    }
    if (focusLocation && idLooksLikeUuid(focusLocation)) {
      list = list.filter((r) => r.customer_location_id === focusLocation)
    }
    return list
  }, [rows, focusCustomer, focusLocation])

  useEffect(() => {
    if (detail) {
      setStatusEdit(detail.status)
      setAssignId(detail.assigned_to_user_id ?? "")
      setWoTitle(detail.issue_summary)
    }
  }, [detail])

  const openDetail = async (id: string) => {
    if (!baseUrl) return
    const res = await fetch(`${baseUrl}/service-requests/${id}`, { cache: "no-store" })
    const body = (await res.json().catch(() => ({}))) as { request?: SrRow }
    if (res.ok && body.request) {
      setDetail(body.request)
    }
  }

  const runDedupe = async () => {
    if (!baseUrl || !detail) return
    const email = detail.requester_email ?? ""
    if (email.length < 4) {
      setDedupeMatches([])
      return
    }
    const res = await fetch(
      `${baseUrl}/service-requests/dedupe?${new URLSearchParams({ email })}`,
      { cache: "no-store" },
    )
    const body = (await res.json().catch(() => ({}))) as {
      matches?: Array<{ customer_id: string; company_name: string }>
    }
    setDedupeMatches(body.matches ?? [])
  }

  useEffect(() => {
    if (convertOpen && detail) {
      setCustomerId(detail.customer_id ?? "")
      setEquipmentId(detail.equipment_id ?? "")
      void runDedupe()
    }
  }, [convertOpen, detail?.id, detail?.customer_id, detail?.equipment_id, detail?.requester_email])

  useEffect(() => {
    if (!organizationId || !customerId || customerId.length < 30) {
      setEqOpts([])
      return
    }
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data } = await supabase
        .from("equipment")
        .select("id, name, customer_location_id")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .is("archived_at", null)
        .order("name", { ascending: true })
        .limit(100)
      setEqOpts(
        (data ?? []) as Array<{ id: string; name: string; customer_location_id: string | null }>,
      )
    })()
  }, [organizationId, customerId])

  useEffect(() => {
    if (!organizationId || !customerId || customerId.length < 30) {
      setConvertLocationOpts([])
      return
    }
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data } = await supabase
        .from("customer_locations")
        .select("id, name, address_line1, address_line2, city, state, postal_code, is_default")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .is("archived_at", null)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true })
      const rows =
        (data ?? []) as Array<{
          id: string
          name: string
          address_line1: string
          address_line2: string | null
          city: string
          state: string
          postal_code: string
          is_default: boolean | null
        }>
      setConvertLocationOpts(
        rows.map((r) => ({
          id: r.id,
          label: formatCustomerLocationSelectLabel({
            name: r.name,
            address_line1: r.address_line1,
            address_line2: r.address_line2,
            city: r.city,
            state: r.state,
            postal_code: r.postal_code,
          }),
        })),
      )
    })()
  }, [organizationId, customerId])

  useEffect(() => {
    if (!convertOpen) {
      setConvertLocationId("")
      return
    }
    if (convertLocationOpts.length === 0) return

    const valid = (id: string | null | undefined) =>
      id && convertLocationOpts.some((o) => o.id === id) ? id : null

    const fromSr = valid(detail?.customer_location_id)
    if (fromSr) {
      setConvertLocationId(fromSr)
      return
    }
    const eq = eqOpts.find((e) => e.id === equipmentId)
    const fromEq = valid(eq?.customer_location_id ?? null)
    if (fromEq) {
      setConvertLocationId(fromEq)
      return
    }
    setConvertLocationId(convertLocationOpts[0]?.id ?? "")
  }, [
    convertOpen,
    detail?.customer_location_id,
    detail?.id,
    equipmentId,
    eqOpts,
    convertLocationOpts,
  ])

  if (!organizationId || orgStatus !== "ready") {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading…
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center text-sm text-muted-foreground">
        Service requests are available to dispatchers, technicians (assigned items), and workspace viewers with
        operational access.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/communications"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3 h-3" /> Communications
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Service requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Triage inbound issues before opening work orders. Nothing is messaged or scheduled automatically.
          </p>
        </div>
        {canManage ?
          <Button type="button" size="sm" className="gap-2" onClick={() => setNewOpen(true)}>
            <UserPlus className="w-4 h-4" />
            New intake
          </Button>
        : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Queue
          </CardTitle>
          <CardDescription>Filter by lifecycle stage, urgency, and source.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (default)</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Urgency</Label>
              <Select value={fUrgency} onValueChange={setFUrgency}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Source</Label>
              <Select value={fSource} onValueChange={setFSource}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="portal">Portal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void load()}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>

          {(focusCustomer || focusLocation) && !loading ?
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Filtered from customer dashboard
                {focusCustomer ? " · customer scope" : ""}
                {focusLocation ? " · service site" : ""} ({visibleRows.length} shown)
              </span>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.replace(pathname)}>
                Clear location filter
              </Button>
            </div>
          : null}

          {loading ?
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          : <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Summary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="hidden md:table-cell">Requester</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ?
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground py-10 text-center">
                      No requests match your filters.
                    </TableCell>
                  </TableRow>
                : visibleRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-[280px]">
                        <div className="font-medium text-sm truncate">{r.issue_summary}</div>
                        <div className="text-[11px] text-muted-foreground font-mono truncate">{r.id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {r.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px] capitalize", urgencyBadge(r.urgency))}>
                          {r.urgency}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{r.source}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {r.requester_name || r.requester_email || "—"}
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="secondary" size="sm" onClick={() => void openDetail(r.id)}>
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request detail</DialogTitle>
          </DialogHeader>
          {detail ?
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Summary</p>
                <p className="font-medium">{detail.issue_summary}</p>
              </div>
              {detail.description ?
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{detail.description}</p>
                </div>
              : null}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Requester</span>
                  <p>{detail.requester_name ?? "—"}</p>
                  <p className="text-muted-foreground">{detail.requester_email ?? ""}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Preferred window</span>
                  <p>{detail.preferred_service_window ?? "—"}</p>
                </div>
              </div>

              {Array.isArray(detail.internal_notes_log) && detail.internal_notes_log.length > 0 ?
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Internal notes</p>
                  <ul className="space-y-2 text-xs border rounded-md p-2 max-h-40 overflow-y-auto">
                    {(detail.internal_notes_log as Array<{ at: string; text: string }>).map((n, i) => (
                      <li key={i} className="border-b border-border/60 pb-2 last:border-0">
                        <span className="text-muted-foreground">{new Date(n.at).toLocaleString()}</span>
                        <p className="whitespace-pre-wrap">{n.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              : null}

              {canManage && detail.status !== "converted" ?
                <div className="space-y-3 border-t pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <Select value={statusEdit} onValueChange={setStatusEdit}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.filter((s) => s !== "converted").map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Assign (user id)</Label>
                      <Input
                        className="h-9 text-xs font-mono"
                        value={assignId}
                        onChange={(e) => setAssignId(e.target.value)}
                        placeholder="Optional UUID"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Internal note</Label>
                    <Textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        if (!baseUrl || !detail) return
                        const res = await fetch(`${baseUrl}/service-requests/${detail.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            status: statusEdit,
                            assigned_to_user_id: assignId.trim() || null,
                            internal_note_text: noteText.trim() || undefined,
                          }),
                        })
                        const j = (await res.json().catch(() => ({}))) as {
                          error?: string
                          request?: SrRow
                        }
                        if (!res.ok) {
                          toast({ title: j.error ?? "Update failed", variant: "destructive" })
                          return
                        }
                        toast({ title: "Saved" })
                        setNoteText("")
                        const updated = (j as { request?: SrRow }).request
                        if (updated) setDetail(updated)
                        void load()
                      }}
                    >
                      Save changes
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={aiBusy}
                      onClick={async () => {
                        if (!baseUrl || !detail) return
                        setAiBusy(true)
                        setAiResult(null)
                        try {
                          const res = await fetch(`${baseUrl}/service-requests/${detail.id}/ai-assist`, {
                            method: "POST",
                          })
                          const j = (await res.json().catch(() => ({}))) as {
                            assist?: Record<string, unknown>
                            error?: string
                          }
                          if (!res.ok) throw new Error(j.error ?? "AI failed")
                          setAiResult(j.assist ?? null)
                        } catch (e) {
                          toast({ title: e instanceof Error ? e.message : "AI error", variant: "destructive" })
                        } finally {
                          setAiBusy(false)
                        }
                      }}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      {aiBusy ? "Running…" : "AI assist"}
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setConvertOpen(true)}>
                      Convert…
                    </Button>
                  </div>
                </div>
              : null}

              {aiResult ?
                <div className="rounded-md border p-3 text-xs space-y-2 bg-muted/30">
                  <p className="font-semibold text-foreground">AI suggestions (review only)</p>
                  <p>
                    <span className="text-muted-foreground">Summary:</span> {String(aiResult.summary ?? "")}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Urgency:</span>{" "}
                    {String(aiResult.suggested_urgency ?? "")}
                  </p>
                  <p>
                    <span className="text-muted-foreground">WO title:</span>{" "}
                    {String(aiResult.suggested_work_order_title ?? "")}
                  </p>
                  <p className="whitespace-pre-wrap">
                    <span className="text-muted-foreground">WO description:</span>{" "}
                    {String(aiResult.suggested_work_order_description ?? "")}
                  </p>
                  <p className="whitespace-pre-wrap">
                    <span className="text-muted-foreground">Draft customer reply (not sent):</span>{" "}
                    {String(aiResult.draft_customer_response ?? "")}
                  </p>
                </div>
              : null}

              {detail.converted_work_order_id ?
                <p className="text-xs text-muted-foreground">
                  Linked work order:{" "}
                  <Link className="text-primary hover:underline" href={`/work-orders/${detail.converted_work_order_id}`}>
                    Open
                  </Link>
                </p>
              : null}
            </div>
          : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to work order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Requires an existing customer. Match duplicates by email when possible — forcing a new customer is
              opt-in.
            </p>
            {dedupeMatches.length > 0 ?
              <div className="rounded-md border p-2 text-xs space-y-1">
                <p className="font-medium">Possible existing customers</p>
                {dedupeMatches.map((m) => (
                  <button
                    key={m.customer_id}
                    type="button"
                    className="block w-full text-left hover:bg-muted rounded px-2 py-1"
                    onClick={() => setCustomerId(m.customer_id)}
                  >
                    {m.company_name}{" "}
                    <span className="font-mono text-muted-foreground">{m.customer_id.slice(0, 8)}…</span>
                  </button>
                ))}
              </div>
            : null}
            <div className="space-y-1">
              <Label className="text-xs">Customer id</Label>
              <Input
                className="font-mono text-xs h-9"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value.trim())}
                placeholder="UUID"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Equipment (optional)</Label>
              <Select
                value={equipmentId || "none"}
                onValueChange={(v) => setEquipmentId(v === "none" ? "" : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {eqOpts.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {convertLocationOpts.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Service location</Label>
                <Select value={convertLocationId} onValueChange={setConvertLocationId}>
                  <SelectTrigger className="h-auto min-h-9 py-2 whitespace-normal text-left">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(100vw-2rem,520px)]">
                    {convertLocationOpts.map((o) => (
                      <SelectItem key={o.id} value={o.id} className="whitespace-normal items-start py-2">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Work order title</Label>
              <Input value={woTitle} onChange={(e) => setWoTitle(e.target.value)} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <Select value={woPriority} onValueChange={setWoPriority}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={woType} onValueChange={setWoType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="pm">PM</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="install">Install</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={confirmConvert} onChange={(e) => setConfirmConvert(e.target.checked)} />I
              reviewed the request and want to create the work order.
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={saveDraft} onChange={(e) => setSaveDraft(e.target.checked)} />
              Also save an empty communication draft linked to the work order (not sent).
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConvertOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!confirmConvert || !customerId}
              onClick={async () => {
                if (!baseUrl || !detail || !customerId) return
                const res = await fetch(`${baseUrl}/service-requests/${detail.id}/convert`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    confirm: true,
                    customer_id: customerId,
                    equipment_id: equipmentId || null,
                    customer_location_id: convertLocationId || null,
                    work_order: {
                      title: woTitle,
                      priority: woPriority,
                      type: woType,
                    },
                    save_communication_draft: saveDraft,
                  }),
                })
                const j = (await res.json().catch(() => ({}))) as {
                  error?: string
                  matches?: unknown
                  work_order_id?: string
                }
                if (res.status === 409) {
                  toast({
                    title: j.error ?? "Duplicate customers",
                    description: "Pick a match or use force_create_customer via API.",
                    variant: "destructive",
                  })
                  return
                }
                if (!res.ok) {
                  toast({ title: j.error ?? "Conversion failed", variant: "destructive" })
                  return
                }
                toast({ title: "Work order created", description: j.work_order_id })
                setConvertOpen(false)
                setDetail(null)
                void load()
              }}
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New internal intake</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Issue summary</Label>
              <Input value={newSummary} onChange={(e) => setNewSummary(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={4} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Requester name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Requester email</Label>
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!baseUrl) return
                const res = await fetch(`${baseUrl}/service-requests`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    issue_summary: newSummary,
                    description: newDesc,
                    requester_name: newName || null,
                    requester_email: newEmail || null,
                  }),
                })
                const j = (await res.json().catch(() => ({}))) as { error?: string }
                if (!res.ok) {
                  toast({ title: j.error ?? "Failed", variant: "destructive" })
                  return
                }
                toast({ title: "Request logged" })
                setNewOpen(false)
                setNewSummary("")
                setNewDesc("")
                setNewName("")
                setNewEmail("")
                void load()
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ServiceRequestsQueuePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading service requests…
        </div>
      }
    >
      <ServiceRequestsQueuePageContent />
    </Suspense>
  )
}
