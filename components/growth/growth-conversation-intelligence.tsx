"use client"

import { MessageSquare } from "lucide-react"
import { GrowthBadge, GrowthActionRequiredBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { growthLeadConversationActionRequired } from "@/lib/growth/growth-lead-drawer-badges"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthConversationIntelligenceProps = {
  lead: GrowthLead
}

export function GrowthConversationIntelligence({ lead }: GrowthConversationIntelligenceProps) {
  const collapsedSummary = [
    lead.conversationHealthScore != null ? `${lead.conversationHealthScore}` : null,
    lead.conversationHealthTier ?? null,
    lead.conversationMomentum ?? null,
  ]
    .filter(Boolean)
    .join(" · ")

  const objections = lead.conversationObjectionProfile?.clusters ?? []

  return (
    <GrowthCollapsibleEngineCard
      id="growth-conversation"
      title="Conversation Intelligence"
      icon={<MessageSquare className="size-4" />}
      headerAside={collapsedSummary || "No conversation data"}
      headerTrailing={growthLeadConversationActionRequired(lead) ? <GrowthActionRequiredBadge /> : null}
      defaultOpen={false}
      persistKey={GROWTH_DRAWER_CARD_KEYS.conversation}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {lead.conversationHealthScore ?? "—"}
          </span>
          {lead.conversationHealthTier ? <GrowthBadge label={lead.conversationHealthTier} tone="healthy" /> : null}
          {lead.conversationTrend ? <GrowthBadge label={lead.conversationTrend} tone="neutral" /> : null}
        </div>

        {lead.conversationSummary ? <p className="text-sm text-muted-foreground">{lead.conversationSummary}</p> : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {lead.conversationSentiment ? (
            <div className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="text-muted-foreground">Sentiment</p>
              <p className="font-medium capitalize">{lead.conversationSentiment}</p>
            </div>
          ) : null}
          {lead.conversationBuyingIntent ? (
            <div className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="text-muted-foreground">Buying intent</p>
              <p className="font-medium capitalize">{lead.conversationBuyingIntent}</p>
            </div>
          ) : null}
          {lead.conversationUrgencyLevel ? (
            <div className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="text-muted-foreground">Urgency</p>
              <p className="font-medium capitalize">{lead.conversationUrgencyLevel}</p>
            </div>
          ) : null}
          {lead.conversationMomentum ? (
            <div className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="text-muted-foreground">Momentum</p>
              <p className="font-medium capitalize">{lead.conversationMomentum.replace(/_/g, " ")}</p>
            </div>
          ) : null}
          {lead.conversationResponsePattern ? (
            <div className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="text-muted-foreground">Response pattern</p>
              <p className="font-medium capitalize">{lead.conversationResponsePattern.replace(/_/g, " ")}</p>
            </div>
          ) : null}
          {lead.conversationCompetitorPressure != null ? (
            <div className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="text-muted-foreground">Competitor pressure</p>
              <p className="font-medium tabular-nums">{lead.conversationCompetitorPressure}</p>
            </div>
          ) : null}
        </div>

        {lead.conversationTopSignals.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top signals</p>
            <ul className="space-y-1 text-sm">
              {lead.conversationTopSignals.map((signal) => (
                <li key={`${signal.kind}-${signal.occurredAt}`} className="flex justify-between gap-2">
                  <span>{signal.label}</span>
                  <span className="tabular-nums text-muted-foreground">{signal.points > 0 ? `+${signal.points}` : signal.points}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {objections.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objection profile</p>
            <ul className="space-y-1 text-sm">
              {objections.map((cluster) => (
                <li key={cluster.key} className="flex justify-between gap-2">
                  <span className="capitalize">{cluster.key.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">
                    ×{cluster.count} · weight {cluster.severityWeight}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {lead.conversationCompetitorMentions.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Competitors</p>
            <ul className="space-y-1 text-sm">
              {lead.conversationCompetitorMentions.map((mention) => (
                <li key={mention.name} className="flex justify-between gap-2">
                  <span>{mention.name}</span>
                  <span className="text-muted-foreground">×{mention.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
