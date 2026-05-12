"use client"

import { useEffect, useState } from "react"
import { AlertCircle, ChevronDown, ChevronRight, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PreparedActionAuditItem } from "@/components/aiden/prepared-actions/types"

function humanizeEventType(t: string): string {
  return t.replace(/^prepared_action_/, "").replace(/_/g, " ")
}

export function PreparedActionAuditTrail({
  organizationId,
  preparedActionId,
  defaultOpen = false,
}: {
  organizationId: string
  preparedActionId: string
  /** When true, audit list starts expanded (e.g. Action Center drawer). */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [items, setItems] = useState<PreparedActionAuditItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/${encodeURIComponent(preparedActionId)}/audit-log?limit=80`,
          { method: "GET", credentials: "include" },
        )
        const data = (await res.json().catch(() => ({}))) as {
          items?: PreparedActionAuditItem[]
          message?: string
          error?: string
        }
        if (cancelled) return
        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? "Could not load audit trail.")
        }
        setItems(data.items ?? [])
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load audit trail.")
          setItems([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, preparedActionId])

  return (
    <div className="rounded-lg border border-border">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 w-full justify-between rounded-none px-3 text-xs font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="inline-flex items-center gap-2">
          <History className="size-3.5 text-muted-foreground" aria-hidden />
          Audit trail
        </span>
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </Button>
      {open ? (
        <div className="border-t border-border px-3 py-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : !items.length ? (
            <p className="text-xs text-muted-foreground">No audit events recorded yet.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
              {items.map((row) => (
                <li key={row.id} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground">{humanizeEventType(row.eventType)}</span>
                    <time className="text-[10px] text-muted-foreground tabular-nums" dateTime={row.createdAt}>
                      {new Date(row.createdAt).toLocaleString()}
                    </time>
                  </div>
                  {row.details && Object.keys(row.details).length > 0 ? (
                    <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted/50 p-1.5 font-mono text-[10px] text-muted-foreground">
                      {JSON.stringify(row.details, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
