"use client"

/**
 * Workflow Automations Phase 2 — run history drawer.
 *
 * Right-side sheet that pulls the most recent runs (live + simulated)
 * from `/workflow-automations/{id}/runs` and renders the per-run step
 * log so managers can see exactly what each rule did. Live failures
 * surface their `error_message`; simulated runs are flagged with a
 * dedicated badge.
 */

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2, RefreshCcw, XCircle } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { RunHistoryEntry } from "./types"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string | null
  automationId: string | null
  automationName?: string
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusPill(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300 gap-1">
          <CheckCircle2 className="w-3 h-3" /> Completed
        </Badge>
      )
    case "failed":
      return (
        <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive gap-1">
          <XCircle className="w-3 h-3" /> Failed
        </Badge>
      )
    case "simulated":
      return (
        <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-700 dark:text-violet-300 gap-1">
          <FlaskConical className="w-3 h-3" /> Simulated
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-[10px] capitalize">
          {status}
        </Badge>
      )
  }
}

export function RunHistoryDrawer({
  open,
  onOpenChange,
  organizationId,
  automationId,
  automationName,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runs, setRuns] = useState<RunHistoryEntry[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !automationId) {
      setRuns([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/workflow-automations/${automationId}/runs`,
      )
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { runs?: RunHistoryEntry[] }
      setRuns(data.runs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load runs.")
    } finally {
      setLoading(false)
    }
  }, [organizationId, automationId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="text-base font-semibold">Run history</SheetTitle>
          <SheetDescription className="text-xs">
            {automationName ? `Recent runs for "${automationName}".` : "Recent runs."} Live + simulated.
          </SheetDescription>
        </SheetHeader>
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-muted/20">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCcw className={cn("w-3 h-3", loading && "animate-spin")} /> Refresh
          </Button>
          <span className="text-[11px] text-muted-foreground ml-auto">Last 25 runs</span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </div>
          ) : null}

          {loading && runs.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading runs…
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-8 text-center">
              No runs yet. Use <strong>Run test</strong> on the list to simulate this automation.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {runs.map((run) => {
                const isExpanded = expandedId === run.id
                return (
                  <li
                    key={run.id}
                    className={cn(
                      "rounded-xl border bg-card overflow-hidden",
                      run.status === "failed" ? "border-destructive/40" : "border-border",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : run.id)}
                      className="w-full text-left px-3 py-2.5 flex flex-wrap items-center gap-2 hover:bg-muted/30 transition-colors"
                    >
                      {statusPill(run.status)}
                      <span className="text-xs text-foreground tabular-nums">{formatTimestamp(run.started_at)}</span>
                      <span className="text-[11px] text-muted-foreground">· {run.source_type}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {run.logs.length} step{run.logs.length === 1 ? "" : "s"}
                      </span>
                    </button>
                    {isExpanded ? (
                      <div className="border-t border-border/70 px-3 py-2.5 flex flex-col gap-1.5 bg-muted/20">
                        {run.error_message ? (
                          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[11px] text-destructive">
                            {run.error_message}
                          </div>
                        ) : null}
                        {run.logs.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground italic">No step logs recorded.</p>
                        ) : (
                          <ol className="flex flex-col gap-1">
                            {run.logs.map((log) => (
                              <li key={log.id} className="flex gap-2 text-[11px]">
                                <span className="text-muted-foreground tabular-nums">
                                  {new Date(log.created_at).toLocaleTimeString(undefined, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                                </span>
                                <span className="font-mono text-muted-foreground">{log.step}</span>
                                <span className="text-foreground/90 leading-snug">{log.message}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
