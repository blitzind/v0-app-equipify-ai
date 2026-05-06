"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import { communicationEventPresentation } from "@/lib/notifications/event-icons"
import { hrefForRelatedEntity } from "@/lib/notifications/event-links"

type Row = {
  id: string
  title: string
  summary: string | null
  channel: string
  event_type: string
  delivery_status: string
  created_at: string
  related_entity_type: string | null
  related_entity_id: string | null
}

export function CustomerCommunicationTimeline({
  organizationId,
  customerId,
}: {
  organizationId: string
  customerId: string
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/communications?customerId=${encodeURIComponent(customerId)}&limit=40`,
          { cache: "no-store" },
        )
        const body = (await res.json()) as { events?: Row[]; error?: string }
        if (!res.ok) throw new Error(body.error ?? "Failed to load")
        if (!cancelled) setRows(body.events ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, customerId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading communications…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive py-4">{error}</p>
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No logged emails or reminders for this customer yet. Outbound messages appear here when sent from Equipify.
      </p>
    )
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {rows.map((r) => {
        const { Icon, iconColor } = communicationEventPresentation(r.event_type, r.channel)
        const href = hrefForRelatedEntity(r.related_entity_type, r.related_entity_id)
        const inner = (
          <>
            <div
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg shrink-0 mt-0.5",
                "bg-muted",
              )}
            >
              <Icon className={cn("w-4 h-4", iconColor)} aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground truncate">{r.title}</p>
                <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                  {r.channel.replace(/_/g, " ")}
                </Badge>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {r.delivery_status}
                </Badge>
              </div>
              {r.summary ? (
                <p className="text-xs text-muted-foreground mt-1 leading-snug">{r.summary}</p>
              ) : null}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
              {formatRelativeTime(r.created_at)}
            </span>
          </>
        )
        return href ? (
          <Link
            key={r.id}
            href={href}
            className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors ds-hover-list-row-menu"
          >
            {inner}
          </Link>
        ) : (
          <div key={r.id} className="flex items-start gap-3 px-4 py-3">
            {inner}
          </div>
        )
      })}
    </div>
  )
}
