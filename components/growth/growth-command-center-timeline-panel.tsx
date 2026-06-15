"use client"

import Link from "next/link"
import { ExternalLink, GitBranch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  COMMAND_CENTER_UNIFICATION_QA_MARKER,
  type GrowthCommandCenterTimelineItem,
} from "@/lib/growth/command-center-unification/command-center-unification-types"

export function GrowthCommandCenterTimelinePanel({
  timeline,
  compact = false,
  onNavigate,
}: {
  timeline: GrowthCommandCenterTimelineItem[]
  compact?: boolean
  onNavigate?: (item: GrowthCommandCenterTimelineItem) => void
}) {
  const items = compact ? timeline.slice(0, 8) : timeline.slice(0, 20)

  return (
    <GrowthEngineCard
      title="Cross-System Timeline"
      icon={<GitBranch className="h-4 w-4" />}
      data-qa-marker={COMMAND_CENTER_UNIFICATION_QA_MARKER}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Deterministic timeline across signals, interventions, readiness, follow-ups, previews, builder, agent plans, and
        approvals. Read-only — no execution.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No timeline items yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.timeline_id} className="rounded-lg border border-border bg-muted/20 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <GrowthBadge tone="neutral">{item.stage.replace(/_/g, " ")}</GrowthBadge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{item.source_subsystem.replace(/_/g, " ")}</span>
                {item.company_name ? <span>· {item.company_name}</span> : null}
              </div>
              {item.related_href ? (
                <div className="mt-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      href={item.related_href}
                      onClick={() => onNavigate?.(item)}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Open Related Item
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </GrowthEngineCard>
  )
}
