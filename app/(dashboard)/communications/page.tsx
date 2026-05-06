"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useActiveOrganization } from "@/lib/active-organization-context"
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
  is_read?: boolean
}

export default function CommunicationsPage() {
  const activeOrg = useActiveOrganization()
  const orgId = activeOrg.status === "ready" ? activeOrg.organizationId : null

  const [channel, setChannel] = useState<string>("all")
  const [rows, setRows] = useState<Row[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [syncNote, setSyncNote] = useState<string | null>(null)

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set("sync", "1")
    p.set("limit", "80")
    if (channel !== "all") p.set("channel", channel)
    return p.toString()
  }, [channel])

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications?${qs}`, {
        cache: "no-store",
      })
      const body = (await res.json()) as { events?: Row[]; unreadCount?: number; error?: string }
      if (!res.ok) throw new Error(body.error ?? "Failed to load")
      setRows(body.events ?? [])
      setUnreadCount(Number(body.unreadCount ?? 0))
      setSyncNote("Reminders synced from work orders, maintenance plans, quotes, and invoices.")
    } catch {
      setSyncNote(null)
    } finally {
      setLoading(false)
    }
  }, [orgId, qs])

  useEffect(() => {
    void load()
  }, [load])

  async function markOneRead(id: string) {
    if (!orgId) return
    await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    })
    void load()
  }

  async function markAllRead() {
    if (!orgId) return
    await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    })
    void load()
  }

  if (activeOrg.status !== "ready" || !orgId) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" />
        Select an organization to view communications.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Communications center</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Emails, SMS (planned), reminders, and internal notices — unified with delivery status and entity links.
          </p>
          {syncNote ? <p className="text-[11px] text-muted-foreground mt-2">{syncNote}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="in_app">Reminders / in-app</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          {unreadCount > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void markAllRead()}>
              Mark all read ({unreadCount})
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center px-4">
            No communications yet. Send a quote or invoice email, or wait for scheduled reminders.
          </p>
        ) : (
          rows.map((r) => {
            const { Icon, iconColor } = communicationEventPresentation(r.event_type, r.channel)
            const href = hrefForRelatedEntity(r.related_entity_type, r.related_entity_id)
            const unread = r.is_read === false
            return (
              <div
                key={r.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-start gap-3 px-4 py-3",
                  unread ? "bg-primary/[0.03]" : "",
                )}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
                      unread ? "bg-primary/10" : "bg-muted",
                    )}
                  >
                    <Icon className={cn("w-4 h-4", unread ? iconColor : "text-muted-foreground")} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {unread ? <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden /> : null}
                      <p className={cn("text-sm font-semibold truncate", unread ? "text-foreground" : "text-foreground/85")}>
                        {r.title}
                      </p>
                      <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                        {r.channel.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {r.delivery_status}
                      </Badge>
                    </div>
                    {r.summary ? (
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">{r.summary}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {href ? (
                        <Button variant="link" className="h-auto p-0 text-xs" asChild>
                          <Link href={href}>Open related record</Link>
                        </Button>
                      ) : null}
                      {unread ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => void markOneRead(r.id)}
                        >
                          Mark read
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 sm:text-right pl-12 sm:pl-0">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formatRelativeTime(r.created_at)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Future: Twilio webhooks will update <code className="text-xs">delivery_status</code> for SMS; Resend webhooks for email;
        push tokens stored per user for mobile alerts. Provider IDs live in <code className="text-xs">provider_message_id</code> and{" "}
        <code className="text-xs">metadata</code>.
      </p>
    </div>
  )
}
