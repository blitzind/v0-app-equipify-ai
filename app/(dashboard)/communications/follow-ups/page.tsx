"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { canAccessInvoiceFollowUpTasks } from "@/lib/follow-up-automation/invoice-access"
import { isInvoiceFollowUpRuleKey } from "@/lib/follow-up-automation/invoice-rules"
import type { FollowUpTaskRow } from "@/lib/follow-up-automation/types"
import { cn } from "@/lib/utils"

function priorityBadgeClass(priority: FollowUpTaskRow["priority"]) {
  const map: Record<string, string> = {
    low: "bg-muted text-muted-foreground border-border",
    normal: "bg-sky-500/10 text-sky-900 dark:text-sky-100 border-sky-500/25",
    high: "bg-rose-500/10 text-rose-900 dark:text-rose-100 border-rose-500/25",
  }
  return map[priority] ?? map.normal
}

function statusBadge(status: FollowUpTaskRow["status"]) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-900 dark:text-amber-100 border-amber-500/25",
    approved: "bg-sky-500/10 text-sky-900 dark:text-sky-100 border-sky-500/25",
    sent: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 border-emerald-500/25",
    dismissed: "bg-muted text-muted-foreground border-border",
    failed: "bg-destructive/10 text-destructive border-destructive/25",
  }
  return map[status] ?? map.pending
}

export default function FollowUpQueuePage() {
  const { toast } = useToast()
  const { organizationId, status } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const canManage = Boolean(permissions.canManageCommunications)
  const canSeeInvoiceFollowUps = canAccessInvoiceFollowUpTasks(permissions)

  const [tasks, setTasks] = useState<FollowUpTaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [queueFilter, setQueueFilter] = useState<"all" | "invoice" | "other">("all")
  const [queueStats, setQueueStats] = useState<{
    maintenanceRemindersPending: number
    maintenanceRemindersOverdue: number
    maintenanceRemindersDraftReady: number
    invoiceRemindersPending?: number
    invoiceRemindersOverdue?: number
  } | null>(null)

  const visibleTasks = useMemo(() => {
    if (queueFilter === "invoice") return tasks.filter((t) => t.entity_type === "invoice")
    if (queueFilter === "other") return tasks.filter((t) => t.entity_type !== "invoice")
    return tasks
  }, [tasks, queueFilter])

  const load = useCallback(async () => {
    if (!organizationId || status !== "ready") return
    setLoading(true)
    try {
      const [tasksRes, statsRes] = await Promise.all([
        fetch(`/api/organizations/${encodeURIComponent(organizationId)}/follow-up-tasks`, {
          cache: "no-store",
        }),
        fetch(`/api/organizations/${encodeURIComponent(organizationId)}/follow-up-tasks/stats`, {
          cache: "no-store",
        }),
      ])
      const body = (await tasksRes.json()) as { tasks?: FollowUpTaskRow[]; error?: string }
      if (!tasksRes.ok) throw new Error(body.error ?? "Could not load queue.")
      const statsBody = (await statsRes.json()) as {
        maintenanceRemindersPending?: number
        maintenanceRemindersOverdue?: number
        maintenanceRemindersDraftReady?: number
        invoiceRemindersPending?: number
        invoiceRemindersOverdue?: number
      }
      if (statsRes.ok) {
        setQueueStats({
          maintenanceRemindersPending: statsBody.maintenanceRemindersPending ?? 0,
          maintenanceRemindersOverdue: statsBody.maintenanceRemindersOverdue ?? 0,
          maintenanceRemindersDraftReady: statsBody.maintenanceRemindersDraftReady ?? 0,
          invoiceRemindersPending: statsBody.invoiceRemindersPending ?? 0,
          invoiceRemindersOverdue: statsBody.invoiceRemindersOverdue ?? 0,
        })
      } else {
        setQueueStats(null)
      }
      const open = (body.tasks ?? []).filter((t) => t.status === "pending" || t.status === "approved")
      setTasks(open)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not load follow-up queue",
        description: e instanceof Error ? e.message : "Unexpected error.",
      })
      setTasks([])
      setQueueStats(null)
    } finally {
      setLoading(false)
    }
  }, [organizationId, status, toast])

  useEffect(() => {
    void load()
  }, [load])

  async function act(taskId: string, path: string) {
    if (!organizationId) return
    setBusyId(taskId)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/follow-up-tasks/${encodeURIComponent(taskId)}${path}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      )
      const body = (await res.json()) as { error?: string; draft?: { subject?: string } }
      if (!res.ok) throw new Error(body.error ?? "Action failed.")
      if (path === "/approve") {
        toast({ title: "Ready to review", description: "Automation draft generated when enabled." })
      }
      if (path === "/handoff") {
        toast({ title: "Queued in Communications", description: "Pending message created for your team to send." })
      }
      if (path === "/dismiss") toast({ title: "Dismissed" })
      if (path === "/regenerate-draft") toast({ title: "Draft regenerated" })
      await load()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Action failed",
        description: e instanceof Error ? e.message : "Unexpected error.",
      })
    } finally {
      setBusyId(null)
    }
  }

  if (status !== "ready" || !organizationId) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workspace…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 min-w-0 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/communications">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Communications
          </Link>
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Follow-up queue</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Suggested reminders — review drafts, then hand off to Communications. Nothing sends automatically.
          </p>
        </div>
      </div>

      {queueStats &&
        canSeeInvoiceFollowUps &&
        ((queueStats.invoiceRemindersPending ?? 0) > 0 || (queueStats.invoiceRemindersOverdue ?? 0) > 0) && (
          <div className="rounded-lg border border-border bg-muted/25 px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-5 gap-y-1">
            <span>
              <span className="font-medium text-foreground">Invoice reminders</span>
              {(queueStats.invoiceRemindersPending ?? 0) > 0 ? (
                <>
                  {" "}
                  · {queueStats.invoiceRemindersPending} pending
                </>
              ) : null}
              {(queueStats.invoiceRemindersOverdue ?? 0) > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-amber-700 dark:text-amber-300">{queueStats.invoiceRemindersOverdue}</span>{" "}
                  overdue milestone(s)
                </>
              ) : null}
            </span>
          </div>
        )}

      {queueStats &&
        (queueStats.maintenanceRemindersPending > 0 ||
          queueStats.maintenanceRemindersOverdue > 0 ||
          queueStats.maintenanceRemindersDraftReady > 0) && (
          <div className="rounded-lg border border-border bg-muted/25 px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-5 gap-y-1">
            <span>
              <span className="font-medium text-foreground">Maintenance reminders</span>
              {queueStats.maintenanceRemindersPending > 0 ? (
                <>
                  {" "}
                  · {queueStats.maintenanceRemindersPending} pending
                </>
              ) : null}
              {queueStats.maintenanceRemindersOverdue > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-amber-700 dark:text-amber-300">{queueStats.maintenanceRemindersOverdue}</span> past
                  scheduled date
                </>
              ) : null}
              {queueStats.maintenanceRemindersDraftReady > 0 ? (
                <> · {queueStats.maintenanceRemindersDraftReady} AI draft(s) ready</>
              ) : null}
            </span>
          </div>
        )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading suggested reminders…
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          No pending follow-ups. Run an evaluation from{" "}
          <Link href="/settings/automations" className="text-primary font-medium hover:underline">
            Settings → Automations
          </Link>{" "}
          when you are ready.
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          No items match this filter. Try another queue filter or{" "}
          <button
            type="button"
            className="text-primary font-medium hover:underline"
            onClick={() => setQueueFilter("all")}
          >
            show all
          </button>
          .
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">Queue filter</span>
            <Select
              value={queueFilter}
              onValueChange={(v) => setQueueFilter(v as "all" | "invoice" | "other")}
            >
              <SelectTrigger id="follow-up-queue-filter" className="h-9 w-[200px]">
                <SelectValue placeholder="Show" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All follow-ups</SelectItem>
                <SelectItem value="invoice">Invoice reminders</SelectItem>
                <SelectItem value="other">Non-invoice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[160px]">Summary</TableHead>
                  <TableHead className="w-[100px]">Priority</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Entity</TableHead>
                  {canSeeInvoiceFollowUps ? (
                    <TableHead className="min-w-[140px]">Invoice context</TableHead>
                  ) : null}
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right min-w-[260px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTasks.map((t) => {
                  const summary =
                    typeof t.metadata?.summary === "string" ? t.metadata.summary : t.rule_key.replace(/_/g, " ")
                  const busy = busyId === t.id
                  const meta = (t.metadata ?? {}) as Record<string, unknown>
                  const invNo = typeof meta.invoice_number === "string" ? meta.invoice_number : null
                  const dueRaw = meta.due_date
                  const dueDate = typeof dueRaw === "string" ? dueRaw : null
                  const daysOd = typeof meta.days_overdue === "number" ? meta.days_overdue : null
                  const daysUntil = typeof meta.days_until_due === "number" ? meta.days_until_due : null
                  const isInvRule = t.entity_type === "invoice" && isInvoiceFollowUpRuleKey(t.rule_key)
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="align-top text-sm">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isInvRule ? (
                            <Badge variant="outline" className="text-[10px] font-medium border border-violet-500/30">
                              Invoice
                            </Badge>
                          ) : null}
                          <span>{summary}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-medium border capitalize", priorityBadgeClass(t.priority))}
                        >
                          {t.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{t.rule_key}</code>
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {t.entity_type} · {t.entity_id.slice(0, 8)}…
                      </TableCell>
                      {canSeeInvoiceFollowUps ? (
                        <TableCell className="align-top text-xs text-muted-foreground">
                          {t.entity_type === "invoice" ? (
                            <div className="space-y-0.5">
                              {invNo ? <div>#{invNo}</div> : null}
                              {dueDate ? <div>Due {dueDate}</div> : null}
                              {daysOd !== null && daysOd > 0 ? <div>{daysOd}d overdue</div> : null}
                              {daysUntil !== null && daysUntil >= 0 && daysOd === null ? (
                                <div>{daysUntil === 0 ? "Due today" : `Due in ${daysUntil}d`}</div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                      ) : null}
                      <TableCell className="align-top">
                        <Badge variant="outline" className={cn("text-[10px] font-medium border", statusBadge(t.status))}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {canManage ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8"
                                disabled={busy || t.status !== "pending"}
                                onClick={() => void act(t.id, "/approve")}
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                Approve & draft
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8"
                                disabled={busy || t.status === "dismissed" || t.status === "sent"}
                                onClick={() => void act(t.id, "/regenerate-draft")}
                              >
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                Regenerate
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8"
                                disabled={busy || t.status !== "approved"}
                                onClick={() => void act(t.id, "/handoff")}
                              >
                                <Send className="h-3.5 w-3.5" />
                                Queue in Communications
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                disabled={busy}
                                onClick={() => void act(t.id, "/dismiss")}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Dismiss
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">View only</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
