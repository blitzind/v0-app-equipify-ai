"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, MessageSquare, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthConversationsActionCrossLinks } from "@/components/growth/inbox/growth-inbox-conversation-intelligence-context-strip"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  fetchGrowthConversationsDashboard,
  type GrowthConversationsDashboardPayload,
} from "@/lib/growth/conversations/growth-conversations-dashboard-client"
import {
  collectGrowthConversationsDashboardLeads,
  findGrowthConversationsFocusedLead,
  parseGrowthConversationsDeepLinkParams,
  resolveGrowthConversationsFocusedLeadId,
  shouldShowGrowthConversationsMissingContextMessage,
} from "@/lib/growth/navigation/growth-conversations-deep-link"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_CONVERSATIONS_DASHBOARD_QA_MARKER = "growth-conversations-dashboard-v2" as const

type DashboardPayload = GrowthConversationsDashboardPayload

function LeadBucket({
  title,
  leads,
  metricKey,
  focusedLeadId,
  registerFocusedLeadRef,
}: {
  title: string
  leads: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  metricKey?: keyof GrowthLead
  focusedLeadId: string | null
  registerFocusedLeadRef: (node: HTMLLIElement | null) => void
}) {
  return (
    <GrowthEngineCard title={title}>
      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leads in this bucket.</p>
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => {
            const isFocused = focusedLeadId === lead.id
            return (
              <li
                key={lead.id}
                ref={isFocused ? registerFocusedLeadRef : undefined}
                data-focused-lead={isFocused ? "true" : undefined}
                className={[
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                  isFocused
                    ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
                    : "border-border",
                ].join(" ")}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{lead.companyName}</p>
                    {isFocused ? <GrowthBadge label="Focused" tone="healthy" /> : null}
                  </div>
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
            )
          })}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthConversationsDashboard() {
  const searchParams = useSearchParams()
  const deepLinkParams = useMemo(
    () => parseGrowthConversationsDeepLinkParams(searchParams),
    [searchParams],
  )
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const focusedLeadRef = useRef<HTMLLIElement | null>(null)
  const hasScrolledToFocus = useRef(false)

  const registerFocusedLeadRef = useCallback((node: HTMLLIElement | null) => {
    focusedLeadRef.current = node
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const dashboard = await fetchGrowthConversationsDashboard()
      setDashboard(dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dashboardLeads = useMemo(
    () => (dashboard ? collectGrowthConversationsDashboardLeads(dashboard) : []),
    [dashboard],
  )

  const focusedLeadId = useMemo(
    () => resolveGrowthConversationsFocusedLeadId(dashboardLeads, deepLinkParams),
    [dashboardLeads, deepLinkParams],
  )

  const focusedLead = useMemo(
    () => findGrowthConversationsFocusedLead(dashboardLeads, focusedLeadId),
    [dashboardLeads, focusedLeadId],
  )

  const showMissingContextMessage = shouldShowGrowthConversationsMissingContextMessage({
    params: deepLinkParams,
    focusedLeadId,
  })

  useEffect(() => {
    hasScrolledToFocus.current = false
  }, [focusedLeadId, deepLinkParams.leadId, deepLinkParams.threadId])

  useEffect(() => {
    if (!focusedLeadId || !focusedLeadRef.current || hasScrolledToFocus.current) return
    focusedLeadRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    hasScrolledToFocus.current = true
  }, [focusedLeadId, dashboard])

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
    <div className="space-y-6" data-qa-marker={GROWTH_CONVERSATIONS_DASHBOARD_QA_MARKER}>
      {focusedLead ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <p className="font-medium">
            Focused on {focusedLead.companyName ?? "lead"}
            {deepLinkParams.threadId ? " · Opened from Inbox thread" : ""}
          </p>
          {deepLinkParams.threadId ? (
            <p className="mt-1 text-xs text-muted-foreground">Thread context preserved for future drill-down.</p>
          ) : null}
        </div>
      ) : null}

      {showMissingContextMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Linked conversation context was not found in the current dashboard view.
        </div>
      ) : null}

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
        <LeadBucket
          title="Health leaders"
          leads={dashboard.strongHealth}
          metricKey="conversationHealthScore"
          focusedLeadId={focusedLeadId}
          registerFocusedLeadRef={registerFocusedLeadRef}
        />
        <LeadBucket
          title="Buying intent"
          leads={dashboard.buyingIntent}
          metricKey="conversationBuyingIntent"
          focusedLeadId={focusedLeadId}
          registerFocusedLeadRef={registerFocusedLeadRef}
        />
        <LeadBucket
          title="Sentiment shift"
          leads={dashboard.sentimentShift}
          metricKey="conversationSentiment"
          focusedLeadId={focusedLeadId}
          registerFocusedLeadRef={registerFocusedLeadRef}
        />
        <LeadBucket
          title="Competitor mentions"
          leads={dashboard.competitorMentions}
          metricKey="conversationCompetitorPressure"
          focusedLeadId={focusedLeadId}
          registerFocusedLeadRef={registerFocusedLeadRef}
        />
        <LeadBucket
          title="Urgency trends"
          leads={dashboard.urgencyTrends}
          metricKey="conversationUrgencyLevel"
          focusedLeadId={focusedLeadId}
          registerFocusedLeadRef={registerFocusedLeadRef}
        />
        <LeadBucket
          title="Conversation risk"
          leads={dashboard.conversationRisk}
          metricKey="conversationMomentum"
          focusedLeadId={focusedLeadId}
          registerFocusedLeadRef={registerFocusedLeadRef}
        />
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
