"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  ExternalLink,
  Filter,
  ListChecks,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  XCircle,
} from "lucide-react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { AIDEN_PREPARED_WORKSPACE_ACTION_IDS } from "@/lib/aiden/actions/action-types"
import { AIDEN_PREPARED_WORKSPACE_ACTION_RISK_LEVELS } from "@/lib/aiden/actions/action-risk"
import { nextStepLabelForPreparedActionStatus } from "@/lib/aiden/prepared-actions/prepared-action-next-step"
import { PreparedActionAuditTrail } from "@/components/aiden/prepared-actions/PreparedActionAuditTrail"
import { PreparedActionStatusBadge } from "@/components/aiden/prepared-actions/PreparedActionStatusBadge"
import { PreparedActionWarnings } from "@/components/aiden/prepared-actions/PreparedActionWarnings"
import { humanizePreparedActionId, type SerializedPreparedAction } from "@/components/aiden/prepared-actions/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50

type StatusPreset = "all" | "open" | "confirmed" | "executing" | "completed" | "canceled" | "failed"

function statusesForPreset(preset: StatusPreset): string | undefined {
  if (preset === "all") return undefined
  if (preset === "open") return "prepared,needs_clarification,ready_for_confirmation"
  return preset
}

export type AidenActionCenterListItem = SerializedPreparedAction & {
  requestedByLabel: string | null
  sourceHref: string | null
  targetHref: string | null
  sourceRecordLabel: string
  targetRecordLabel: string
  previewWarnings: string[]
}

function shortId(id: string | null | undefined): string {
  if (!id) return "—"
  const t = id.trim()
  if (t.length <= 10) return t
  return `${t.slice(0, 8)}…`
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function recordCell(label: string, id: string | null) {
  if (!id) return label === "—" ? "—" : label
  return (
    <span className="block">
      <span className="text-foreground">{label}</span>
      <span className="block font-mono text-[10px] text-muted-foreground">{shortId(id)}</span>
    </span>
  )
}

export function AidenActionCenterPage() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { toast } = useToast()

  const [items, setItems] = useState<AidenActionCenterListItem[]>([])
  const [requesterOptions, setRequesterOptions] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const [statusPreset, setStatusPreset] = useState<StatusPreset>("all")
  const [actionId, setActionId] = useState<string>("all")
  const [riskLevel, setRiskLevel] = useState<string>("all")
  const [requestedBy, setRequestedBy] = useState<string>("all")
  const [createdAfter, setCreatedAfter] = useState("")
  const [createdBefore, setCreatedBefore] = useState("")

  const [selected, setSelected] = useState<AidenActionCenterListItem | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)

  const buildQuery = useCallback(
    (nextOffset: number) => {
      if (!organizationId) return ""
      const p = new URLSearchParams()
      p.set("limit", String(PAGE_SIZE))
      p.set("offset", String(nextOffset))
      const st = statusesForPreset(statusPreset)
      if (st) p.set("statuses", st)
      if (actionId !== "all") p.set("actionId", actionId)
      if (riskLevel !== "all") p.set("riskLevel", riskLevel)
      if (requestedBy !== "all") p.set("requestedBy", requestedBy)
      if (createdAfter.trim()) p.set("createdAfter", createdAfter.trim())
      if (createdBefore.trim()) p.set("createdBefore", createdBefore.trim())
      return p.toString()
    },
    [organizationId, statusPreset, actionId, riskLevel, requestedBy, createdAfter, createdBefore],
  )

  const loadRequesters = useCallback(async () => {
    if (!organizationId || orgStatus !== "ready") return
    const res = await fetch(
      `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions?include=requesters&limit=1`,
      { credentials: "include" },
    )
    const data = (await res.json().catch(() => ({}))) as {
      requesterOptions?: { id: string; label: string }[]
    }
    if (res.ok && data.requesterOptions) {
      setRequesterOptions(data.requesterOptions)
    }
  }, [organizationId, orgStatus])

  const fetchPage = useCallback(
    async (nextOffset: number, replace: boolean, soft: boolean) => {
      if (!organizationId || orgStatus !== "ready") return
      if (soft) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const qs = buildQuery(nextOffset)
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions?${qs}`,
          { credentials: "include" },
        )
        const data = (await res.json().catch(() => ({}))) as {
          items?: AidenActionCenterListItem[]
          message?: string
          error?: string
        }
        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? `Request failed (${res.status})`)
        }
        const next = data.items ?? []
        setItems((prev) => (replace ? next : [...prev, ...next]))
        setOffset(nextOffset)
        setHasMore(next.length === PAGE_SIZE)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load actions.")
        if (replace) setItems([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [organizationId, orgStatus, buildQuery],
  )

  useEffect(() => {
    void loadRequesters()
  }, [loadRequesters])

  useEffect(() => {
    if (!organizationId || orgStatus !== "ready") return
    setOffset(0)
    void fetchPage(0, true, false)
  }, [
    organizationId,
    orgStatus,
    statusPreset,
    actionId,
    riskLevel,
    requestedBy,
    createdAfter,
    createdBefore,
    fetchPage,
  ])

  const onRefresh = () => {
    void fetchPage(0, true, true)
  }

  const onLoadMore = () => {
    void fetchPage(offset + PAGE_SIZE, false, true)
  }

  const canCancel = (row: AidenActionCenterListItem) =>
    row.status === "prepared" ||
    row.status === "needs_clarification" ||
    row.status === "ready_for_confirmation" ||
    row.status === "confirmed"

  async function handleCancel(row: AidenActionCenterListItem) {
    if (!organizationId) return
    setCancelBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/${encodeURIComponent(row.id)}/cancel`,
        { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" },
      )
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Cancel failed.")
      }
      toast({ title: "Canceled", description: "This prepared action was canceled." })
      setSelected((s) => (s?.id === row.id ? null : s))
      void fetchPage(0, true, true)
    } catch (e) {
      toast({
        title: "Could not cancel",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setCancelBusy(false)
    }
  }

  if (orgStatus !== "ready" || !organizationId) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading workspace…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">AIden Action Center</h1>
          <p className="text-xs text-muted-foreground sm:text-sm max-w-2xl">
            Review prepared workspace actions across statuses. Use filters to narrow by lifecycle, action type, risk,
            who requested them, and date range.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 self-start sm:self-auto"
          disabled={refreshing}
          onClick={() => onRefresh()}
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="size-4 text-muted-foreground" aria-hidden />
            Filters
          </div>
          <CardDescription className="text-xs">
            Filters apply to the list below. Clearing dates shows all time (up to the row limit).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusPreset} onValueChange={(v) => setStatusPreset(v as StatusPreset)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Awaiting confirmation</SelectItem>
                <SelectItem value="confirmed">Confirmed (run)</SelectItem>
                <SelectItem value="executing">Executing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Action type</Label>
            <Select value={actionId} onValueChange={setActionId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {AIDEN_PREPARED_WORKSPACE_ACTION_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {humanizePreparedActionId(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Risk level</Label>
            <Select value={riskLevel} onValueChange={setRiskLevel}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All risk levels</SelectItem>
                {AIDEN_PREPARED_WORKSPACE_ACTION_RISK_LEVELS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Requested by</Label>
            <Select value={requestedBy} onValueChange={setRequestedBy}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Anyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                {requesterOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Created from</Label>
            <input
              type="date"
              value={createdAfter}
              onChange={(e) => setCreatedAfter(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Created to</Label>
            <input
              type="date"
              value={createdBefore}
              onChange={(e) => setCreatedBefore(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </CardContent>
      </Card>

      {error ?
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      : null}

      {loading && items.length === 0 ?
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading actions…
        </div>
      : null}

      {!loading && items.length === 0 && !error ?
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            <ListChecks className="size-8 opacity-40" aria-hidden />
            <p>No prepared actions match these filters.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => onRefresh()}>
              Refresh
            </Button>
          </CardContent>
        </Card>
      : null}

      {items.length > 0 ?
        <>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="min-w-[120px]">Source</TableHead>
                    <TableHead className="min-w-[120px]">Target</TableHead>
                    <TableHead className="min-w-[100px]">Requested by</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="min-w-[140px]">Next step</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelected(row)}
                    >
                      <TableCell className="align-top text-xs font-medium text-foreground">
                        {humanizePreparedActionId(row.actionId)}
                      </TableCell>
                      <TableCell className="align-top">
                        <PreparedActionStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {recordCell(row.sourceRecordLabel, row.sourceRecordId)}
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {recordCell(row.targetRecordLabel, row.targetRecordId)}
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {row.requestedByLabel ?? "—"}
                      </TableCell>
                      <TableCell className="align-top whitespace-nowrap text-xs text-muted-foreground">
                        {formatWhen(row.createdAt)}
                      </TableCell>
                      <TableCell className="align-top text-xs capitalize text-muted-foreground">
                        {row.riskLevel.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {nextStepLabelForPreparedActionStatus(row.status)}
                      </TableCell>
                      <TableCell className="align-top text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => setSelected(row)}
                        >
                          <MoreHorizontal className="size-3.5" aria-hidden />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:hidden">
            {items.map((row) => (
              <Card
                key={row.id}
                className="cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() => setSelected(row)}
              >
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-snug">
                      {humanizePreparedActionId(row.actionId)}
                    </CardTitle>
                    <PreparedActionStatusBadge status={row.status} />
                  </div>
                  <CardDescription className="text-xs">
                    {formatWhen(row.createdAt)} ·{" "}
                    <span className="capitalize">{row.riskLevel.replace(/_/g, " ")}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Source: </span>
                    {recordCell(row.sourceRecordLabel, row.sourceRecordId)}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Target: </span>
                    {recordCell(row.targetRecordLabel, row.targetRecordId)}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Requested by: </span>
                    {row.requestedByLabel ?? "—"}
                  </div>
                  <p className="text-[11px] leading-relaxed">{nextStepLabelForPreparedActionStatus(row.status)}</p>
                  <Button type="button" variant="secondary" size="sm" className="mt-1 w-full text-xs">
                    Review
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {hasMore ?
            <div className="flex justify-center">
              <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={() => onLoadMore()}>
                {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Load more
              </Button>
            </div>
          : null}
        </>
      : null}

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          {selected ?
            <>
              <SheetHeader className="border-b border-border px-4 py-3 text-left">
                <SheetTitle className="pr-8 text-base leading-snug">
                  {humanizePreparedActionId(selected.actionId)}
                </SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                  <PreparedActionStatusBadge status={selected.status} />
                  <span className="text-xs text-muted-foreground">{formatWhen(selected.createdAt)}</span>
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-4 pr-2">
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <p className="font-medium text-foreground">Source</p>
                      <p className="text-muted-foreground">{recordCell(selected.sourceRecordLabel, selected.sourceRecordId)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Target</p>
                      <p className="text-muted-foreground">{recordCell(selected.targetRecordLabel, selected.targetRecordId)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Requested by</p>
                      <p className="text-muted-foreground">{selected.requestedByLabel ?? "—"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Next step</p>
                      <p className="text-muted-foreground">{nextStepLabelForPreparedActionStatus(selected.status)}</p>
                    </div>
                  </div>

                  <PreparedActionWarnings warnings={selected.previewWarnings} />

                  <div>
                    <p className="mb-1 text-xs font-medium text-foreground">Preview payload</p>
                    <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-2 text-[10px] leading-relaxed text-muted-foreground">
                      {JSON.stringify(selected.previewPayload, null, 2)}
                    </pre>
                  </div>

                  <PreparedActionAuditTrail
                    organizationId={organizationId}
                    preparedActionId={selected.id}
                    defaultOpen
                  />

                  <Separator />

                  <div className="flex flex-col gap-2 pb-6">
                    {selected.sourceHref ?
                      <Button type="button" variant="secondary" size="sm" className="justify-start gap-2" asChild>
                        <Link href={selected.sourceHref}>
                          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                          Continue (open source record)
                        </Link>
                      </Button>
                    : (
                      <p className="text-[11px] text-muted-foreground">
                        No direct link for the source record. Open the original page where you started this action.
                      </p>
                    )}
                    {selected.targetHref && selected.status === "completed" ?
                      <Button type="button" size="sm" className="justify-start gap-2" asChild>
                        <Link href={selected.targetHref}>
                          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                          Open created record
                        </Link>
                      </Button>
                    : null}
                    {canCancel(selected) ?
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2 text-destructive hover:text-destructive"
                        disabled={cancelBusy}
                        onClick={() => void handleCancel(selected)}
                      >
                        <XCircle className="size-3.5 shrink-0" aria-hidden />
                        Cancel prepared action
                      </Button>
                    : null}
                  </div>
                </div>
              </ScrollArea>
            </>
          : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
