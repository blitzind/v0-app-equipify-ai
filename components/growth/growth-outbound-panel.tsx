"use client"

import { useEffect, useState } from "react"
import { Loader2, Mail } from "lucide-react"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthLeadOutboundData } from "@/components/growth/growth-outreach-center"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthOutboundPanelProps = {
  lead: GrowthLead
}

export function GrowthOutboundPanel({ lead }: GrowthOutboundPanelProps) {
  const [data, setData] = useState<GrowthLeadOutboundData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/platform/growth/leads/${lead.id}/outbound`, { cache: "no-store" })
        const json = (await res.json()) as {
          ok?: boolean
          message?: string
          contacts?: GrowthLeadOutboundData["contacts"]
          messages?: GrowthLeadOutboundData["messages"]
          replies?: GrowthLeadOutboundData["replies"]
          campaigns?: GrowthLeadOutboundData["campaigns"]
        }
        if (!res.ok || !json.ok) throw new Error(json.message ?? "Could not load outbound data.")
        if (!cancelled) {
          setData({
            contacts: json.contacts ?? [],
            messages: json.messages ?? [],
            replies: json.replies ?? [],
            campaigns: json.campaigns ?? [],
          })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load outbound data.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [lead.id])

  const hasData = Boolean(data && (data.messages.length > 0 || data.replies.length > 0))

  return (
    <GrowthCollapsibleEngineCard
      title="Outbound Activity"
      icon={<Mail className="size-4" />}
      headerTrailing={
        lead.contactTemperature ? (
          <GrowthBadge label={lead.contactTemperature.replace(/_/g, " ")} tone={temperatureTone(lead.contactTemperature)} />
        ) : null
      }
    >
      {loading ? (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading outbound history…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !hasData ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          No outbound activity yet. Events will appear when provider webhooks are connected or fixtures are processed.
        </div>
      ) : (
        <div className="space-y-4">
          {data?.campaigns[0] ? (
            <div className="rounded-lg border border-border/70 bg-muted/15 p-3 text-sm">
              <div className="font-medium">{data.campaigns[0].name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {data.campaigns[0].sentCount} sent · {data.campaigns[0].replyCount} replies · engagement{" "}
                {data.campaigns[0].engagementScore}
              </div>
            </div>
          ) : null}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Messages</h4>
            <ul className="mt-2 space-y-2">
              {(data?.messages ?? []).slice(0, 5).map((message) => (
                <li key={message.id} className="rounded-lg border border-border/80 bg-muted/15 px-3 py-2 text-sm">
                  <div className="font-medium">{message.subject ?? "Outbound email"}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <GrowthBadge label={message.status} tone="medium" />
                    {message.sentAt ? new Date(message.sentAt).toLocaleString() : "—"}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {(data?.replies.length ?? 0) > 0 ? (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Replies</h4>
              <ul className="mt-2 space-y-2">
                {(data?.replies ?? []).slice(0, 5).map((reply) => (
                  <li key={reply.id} className="rounded-lg border border-border/80 bg-muted/15 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <GrowthBadge label={reply.classification.replace(/_/g, " ")} tone="healthy" />
                      {reply.classificationLocked ? (
                        <span className="text-[10px] uppercase text-muted-foreground">Locked</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-muted-foreground">{reply.bodyPreview ?? "—"}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </GrowthCollapsibleEngineCard>
  )
}

function temperatureTone(value: string) {
  switch (value) {
    case "hot":
      return "critical" as const
    case "engaged":
      return "healthy" as const
    case "warming":
      return "medium" as const
    case "suppressed":
      return "stalled" as const
    default:
      return "attention" as const
  }
}
