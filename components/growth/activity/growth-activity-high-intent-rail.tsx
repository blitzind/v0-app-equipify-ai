"use client"

import Link from "next/link"
import { AlertTriangle, CalendarCheck, Flame, PauseCircle } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GROWTH_ACTIVITY_RAIL_QUEUE_LABELS } from "@/lib/growth/activity/growth-activity-workspace-constants"
import type {
  GrowthActivityRailCardView,
  GrowthActivityRailQueueId,
  GrowthActivityRailQueues,
} from "@/lib/growth/activity/growth-activity-workspace-types"
import {
  buildGrowthActivityHotProspectHeroActions,
  GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER,
} from "@/lib/growth/operator-ux/growth-operator-primary-actions-7a2"

const QUEUE_ICON: Record<GrowthActivityRailQueueId, ReactNode> = {
  "needs-attention": <AlertTriangle className="size-4 text-amber-600" />,
  "hot-prospects": <Flame className="size-4 text-orange-600" />,
  "meetings-ready": <CalendarCheck className="size-4 text-emerald-600" />,
  "stalled-opportunities": <PauseCircle className="size-4 text-rose-600" />,
}

function HotProspectHeroCard({ prospect }: { prospect: GrowthActivityRailCardView }) {
  const { primary, secondary } = buildGrowthActivityHotProspectHeroActions(prospect.leadId)

  return (
    <li
      className="rounded-md border-2 border-orange-200 bg-orange-50/40 p-2 text-xs dark:border-orange-500/30 dark:bg-orange-500/10"
      data-growth-activity-hero="hot-prospect"
    >
      <p className="font-medium">{prospect.name}</p>
      <p className="text-muted-foreground">{prospect.company ?? "—"}</p>
      <p className="mt-1 text-muted-foreground">
        Score {prospect.score} · {prospect.reason}
      </p>
      <div className="mt-2 space-y-1.5">
        <Button size="sm" variant="default" className="h-7 w-full px-2 text-xs" asChild>
          <Link href={primary.href}>{primary.label}</Link>
        </Button>
        <div className="flex flex-wrap gap-1">
          {secondary.map((action) => (
            <Button key={action.id} size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        </div>
      </div>
    </li>
  )
}

function ProspectRailSection({
  queueId,
  items,
  focused,
  onFocus,
}: {
  queueId: GrowthActivityRailQueueId
  items: GrowthActivityRailCardView[]
  focused?: boolean
  onFocus?: (queueId: GrowthActivityRailQueueId) => void
}) {
  const title = GROWTH_ACTIVITY_RAIL_QUEUE_LABELS[queueId]
  const heroProspect = queueId === "hot-prospects" ? items[0] ?? null : null
  const remaining = queueId === "hot-prospects" && heroProspect ? items.slice(1) : items

  return (
    <div
      className={`space-y-2 rounded-md p-1 ${focused ? "bg-primary/5 ring-1 ring-primary/20" : ""}`}
      data-growth-activity-rail={queueId}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left text-sm font-medium"
        onClick={() => onFocus?.(queueId)}
      >
        {QUEUE_ICON[queueId]}
        <span>{title}</span>
      </button>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing in this queue yet.</p>
      ) : (
        <ul className="space-y-2">
          {heroProspect ? <HotProspectHeroCard prospect={heroProspect} /> : null}
          {remaining.slice(0, heroProspect ? 3 : 4).map((prospect) => (
            <li key={`${queueId}-${prospect.leadId}`} className="rounded-md border p-2 text-xs">
              <p className="font-medium">{prospect.name}</p>
              <p className="text-muted-foreground">{prospect.company ?? "—"}</p>
              <p className="mt-1 text-muted-foreground">
                Score {prospect.score} · {prospect.reason}
              </p>
              <div className="mt-2">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
                  <Link href={buildGrowthActivityHotProspectHeroActions(prospect.leadId).primary.href}>
                    Open Lead
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type Props = {
  queues: GrowthActivityRailQueues
  focusedQueueId?: GrowthActivityRailQueueId | null
  onFocusQueue?: (queueId: GrowthActivityRailQueueId | null) => void
}

export function GrowthActivityHighIntentRail({ queues, focusedQueueId = null, onFocusQueue }: Props) {
  return (
    <Card
      className="h-fit max-h-[min(720px,85vh)] overflow-y-auto"
      data-growth-ops-click-reduction={GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Operator Queues</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProspectRailSection
          queueId="needs-attention"
          items={queues["needs-attention"]}
          focused={focusedQueueId === "needs-attention"}
          onFocus={(queueId) => onFocusQueue?.(focusedQueueId === queueId ? null : queueId)}
        />
        <ProspectRailSection
          queueId="hot-prospects"
          items={queues["hot-prospects"]}
          focused={focusedQueueId === "hot-prospects"}
          onFocus={(queueId) => onFocusQueue?.(focusedQueueId === queueId ? null : queueId)}
        />
        <ProspectRailSection
          queueId="meetings-ready"
          items={queues["meetings-ready"]}
          focused={focusedQueueId === "meetings-ready"}
          onFocus={(queueId) => onFocusQueue?.(focusedQueueId === queueId ? null : queueId)}
        />
        <ProspectRailSection
          queueId="stalled-opportunities"
          items={queues["stalled-opportunities"]}
          focused={focusedQueueId === "stalled-opportunities"}
          onFocus={(queueId) => onFocusQueue?.(focusedQueueId === queueId ? null : queueId)}
        />
      </CardContent>
    </Card>
  )
}
