"use client"

import { Activity } from "lucide-react"
import { GrowthBadge, GrowthCollapsibleEngineCard, formatRelativeTime } from "@/components/growth/growth-ui-utils"
import type { GrowthLead } from "@/lib/growth/types"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"

type GrowthLeadEngagementProps = {
  lead: GrowthLead
}

export function GrowthLeadEngagement({ lead }: GrowthLeadEngagementProps) {
  return (
    <GrowthCollapsibleEngineCard
      title="Engagement"
      icon={<Activity className="size-4" />}
      headerAside={
        <>
          <span className="text-sm font-semibold tabular-nums text-foreground">{lead.engagementScore ?? "—"}</span>
          {lead.engagementTier ? <GrowthBadge label={lead.engagementTier} tone="healthy" /> : null}
        </>
      }
      defaultOpen={false}
      persistKey={GROWTH_DRAWER_CARD_KEYS.engagement}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">{lead.engagementScore ?? "—"}</span>
          {lead.engagementTier ? <GrowthBadge label={lead.engagementTier} tone="healthy" /> : null}
        </div>
        {lead.engagementSummary ? <p className="text-sm text-foreground">{lead.engagementSummary}</p> : null}
        {lead.engagementLastActivityAt ? (
          <p className="text-xs text-muted-foreground">
            Last activity {formatRelativeTime(lead.engagementLastActivityAt)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No engagement activity recorded yet.</p>
        )}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
