"use client"

import { useState } from "react"
import { Flame, Inbox, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { GrowthHighIntentQueueItem } from "@/lib/growth/intent-pixel/live-visitor-monitor-types"

export function HighIntentQueuePanel({
  queue,
  siteKey,
  onProcessed,
}: {
  queue: GrowthHighIntentQueueItem[]
  siteKey: string
  onProcessed?: () => void
}) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function processSession(sessionId: string) {
    setProcessingId(sessionId)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/intent-pixel/process-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_key: siteKey, session_id: sessionId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: { message?: string; lead_inbox_id?: string | null }
      }
      setMessage(data.result?.message ?? (res.ok ? "Processed." : "Could not process session."))
      if (res.ok && data.ok) onProcessed?.()
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Flame className="size-5 text-orange-600" />
          <div>
            <h2 className="text-lg font-semibold">High intent queue</h2>
            <p className="text-sm text-muted-foreground">
              Live candidates from recent sessions. Process to Lead Inbox for human review — no Lead Engine auto-run.
            </p>
          </div>
        </div>
      </div>
      {message ? (
        <p className="border-b border-border px-5 py-2 text-sm text-muted-foreground">{message}</p>
      ) : null}
      <ul className="divide-y divide-border">
        {queue.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted-foreground">
            No high-intent sessions in the live window.
          </li>
        ) : (
          queue.map((item) => (
            <li
              key={item.session_id}
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.display_label}</p>
                  {item.high_intent ? (
                    <Badge className="bg-violet-600 hover:bg-violet-600">High intent</Badge>
                  ) : null}
                  {item.returning_account ? (
                    <Badge variant="outline">Returning account</Badge>
                  ) : null}
                  {item.pricing_viewed ? (
                    <Badge variant="outline">Pricing viewed</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Intent score {item.intent_score} · grade {item.intent_grade}
                  {item.buying_stage_candidate ? ` · ${item.buying_stage_candidate}` : ""}
                </p>
                {item.signals.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">{item.signals.join(" · ")}</p>
                ) : null}
                <Badge variant="secondary" className="mt-2">
                  {item.visitor_type}
                </Badge>
              </div>
              <Button
                size="sm"
                disabled={processingId === item.session_id || !item.lead_engine_eligible}
                onClick={() => void processSession(item.session_id)}
                title={
                  item.lead_engine_eligible
                    ? "Add to Lead Inbox"
                    : "Session not eligible for Lead Inbox handoff"
                }
              >
                {processingId === item.session_id ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Inbox className="mr-2 size-4" />
                )}
                Process to Lead Inbox
              </Button>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
