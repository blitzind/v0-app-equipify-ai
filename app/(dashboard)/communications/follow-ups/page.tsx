"use client"

import { useCallback, useEffect, useState } from "react"
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
import type { FollowUpTaskRow } from "@/lib/follow-up-automation/types"
import { cn } from "@/lib/utils"

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

  const [tasks, setTasks] = useState<FollowUpTaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || status !== "ready") return
    setLoading(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/follow-up-tasks`, {
        cache: "no-store",
      })
      const body = (await res.json()) as { tasks?: FollowUpTaskRow[]; error?: string }
      if (!res.ok) throw new Error(body.error ?? "Could not load queue.")
      const open = (body.tasks ?? []).filter((t) => t.status === "pending" || t.status === "approved")
      setTasks(open)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not load follow-up queue",
        description: e instanceof Error ? e.message : "Unexpected error.",
      })
      setTasks([])
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
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[180px]">Summary</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[220px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => {
                const summary =
                  typeof t.metadata?.summary === "string" ? t.metadata.summary : t.rule_key.replace(/_/g, " ")
                const busy = busyId === t.id
                return (
                  <TableRow key={t.id}>
                    <TableCell className="align-top text-sm">{summary}</TableCell>
                    <TableCell className="align-top">
                      <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{t.rule_key}</code>
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">
                      {t.entity_type} · {t.entity_id.slice(0, 8)}…
                    </TableCell>
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
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Approve & draft
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
      )}
    </div>
  )
}
