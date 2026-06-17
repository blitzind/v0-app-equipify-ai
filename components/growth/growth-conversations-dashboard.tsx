"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, MessageSquare, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthConversationsActionCrossLinks } from "@/components/growth/inbox/growth-inbox-conversation-intelligence-context-strip"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthLead } from "@/lib/growth/types"

type DashboardPayload = {
  averageHealth: number
  strongHealth: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  buyingIntent: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  sentimentShift: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  competitorMentions: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  topObjections: Array<{ key: string; count: number }>
  urgencyTrends: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  conversationRisk: Array<Partial<GrowthLead> & { id: string; companyName: string }>
}

function LeadBucket({
  title,
  leads,
  metricKey,
}: {
  title: string
  leads: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  metricKey?: keyof GrowthLead
}) {
  return (
    <GrowthEngineCard title={title}>
      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leads in this bucket.</p>
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => (
            <li key={lead.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{lead.companyName}</p>
                {lead.conversationSummary ? <p className="text-muted-foreground">{lead.conversationSummary}</p> : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  {metricKey && lead[metricKey] != null ? (
                    <span className="tabular-nums font-semibold">{String(lead[metricKey])}</span>
                  ) : null}
                  {lead.conversationHealthTier ? (
                    <GrowthBadge label={lead.conversationHealthTier} tone="healthy" />
                  ) : null}
                </div>
                <GrowthConversationsActionCrossLinks leadId={lead.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthConversationsDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/conversations/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; dashboard?: DashboardPayload; message?: string }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load conversation dashboard.")
      }
      setDashboard(data.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading conversation intelligence…
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 size-4" />
          Retry
        </Button>
      </div>
    )
  }

  if (!dashboard) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Avg conversation health" value={dashboard.averageHealth} />
          <StatTile label="Strong buying intent" value={dashboard.buyingIntent.length} />
          <StatTile label="High urgency" value={dashboard.urgencyTrends.length} />
          <StatTile label="At conversation risk" value={dashboard.conversationRisk.length} />
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LeadBucket title="Health leaders" leads={dashboard.strongHealth} metricKey="conversationHealthScore" />
        <LeadBucket title="Buying intent" leads={dashboard.buyingIntent} metricKey="conversationBuyingIntent" />
        <LeadBucket title="Sentiment shift" leads={dashboard.sentimentShift} metricKey="conversationSentiment" />
        <LeadBucket title="Competitor mentions" leads={dashboard.competitorMentions} metricKey="conversationCompetitorPressure" />
        <LeadBucket title="Urgency trends" leads={dashboard.urgencyTrends} metricKey="conversationUrgencyLevel" />
        <LeadBucket title="Conversation risk" leads={dashboard.conversationRisk} metricKey="conversationMomentum" />
      </div>

      <GrowthEngineCard title="Top objections" icon={<MessageSquare className="size-4" />}>
        {dashboard.topObjections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No objection clusters recorded.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.topObjections.map((entry) => (
              <li key={entry.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="capitalize">{entry.key.replace(/_/g, " ")}</span>
                <span className="font-semibold tabular-nums">{entry.count}</span>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>
    </div>
  )
}
