"use client"

import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthEngagementDrilldownTarget } from "@/components/growth/engagement/growth-engagement-drilldown-drawer"
import type { GrowthEngagementCommandCenterHighIntentCard } from "@/lib/growth/engagement/growth-engagement-command-center-types"

export function GrowthEngagementCommandCenterHighIntentPanel({
  cards,
  onOpenDrilldown,
}: {
  cards: GrowthEngagementCommandCenterHighIntentCard[]
  onOpenDrilldown?: (target: GrowthEngagementDrilldownTarget) => void
}) {
  return (
    <GrowthEngineCard title="High-intent workspace">
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No high-intent workspace cards in this range.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {cards.map((card) => (
            <li key={card.cardId} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{card.title}</p>
                  <p className="text-muted-foreground">{card.description}</p>
                </div>
                <GrowthBadge label={card.severity} tone={card.severity} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <GrowthBadge label={card.alertType.replaceAll("_", " ")} tone="neutral" />
                <span>{new Date(card.occurredAt).toLocaleString()}</span>
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    if (card.entityType === "lead") onOpenDrilldown?.({ kind: "lead", id: card.entityId })
                    if (card.entityType === "template") onOpenDrilldown?.({ kind: "template", id: card.entityId })
                    if (card.entityType === "media") onOpenDrilldown?.({ kind: "media", id: card.entityId })
                    if (card.entityType === "share_page") onOpenDrilldown?.({ kind: "share_page", id: card.entityId })
                  }}
                >
                  Open {card.entityType.replaceAll("_", " ")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}
