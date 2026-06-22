"use client"

import Link from "next/link"
import { AlertTriangle, Flame, PauseCircle, CalendarCheck } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GROWTH_ACTIVITY_RAIL_QUEUE_LABELS } from "@/lib/growth/activity/growth-activity-workspace-constants"
import type {
  GrowthActivityRailCardView,
  GrowthActivityRailQueueId,
  GrowthActivityRailQueues,
} from "@/lib/growth/activity/growth-activity-workspace-types"

const QUEUE_ICON: Record<GrowthActivityRailQueueId, ReactNode> = {
  "needs-attention": <AlertTriangle className="size-4 text-amber-600" />,
  "hot-prospects": <Flame className="size-4 text-orange-600" />,
  "meetings-ready": <CalendarCheck className="size-4 text-emerald-600" />,
  "stalled-opportunities": <PauseCircle className="size-4 text-rose-600" />,
}

function ProspectRailSection({
  queueId,
  items,
}: {
  queueId: GrowthActivityRailQueueId
  items: GrowthActivityRailCardView[]
}) {
  const title = GROWTH_ACTIVITY_RAIL_QUEUE_LABELS[queueId]
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {QUEUE_ICON[queueId]}
        <span>{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing in this queue yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 4).map((prospect) => (
            <li key={`${queueId}-${prospect.leadId}`} className="rounded-md border p-2 text-xs">
              <p className="font-medium">{prospect.name}</p>
              <p className="text-muted-foreground">{prospect.company ?? "—"}</p>
              <p className="mt-1 text-muted-foreground">
                Score {prospect.score} · {prospect.reason}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {prospect.actions.slice(0, 3).map((action) => (
                  <Button key={action.id} size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
                    <Link href={action.href}>{action.label}</Link>
                  </Button>
                ))}
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
}

export function GrowthActivityHighIntentRail({ queues }: Props) {
  return (
    <Card className="h-fit max-h-[min(720px,85vh)] overflow-y-auto">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Operator Queues</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProspectRailSection queueId="needs-attention" items={queues["needs-attention"]} />
        <ProspectRailSection queueId="hot-prospects" items={queues["hot-prospects"]} />
        <ProspectRailSection queueId="meetings-ready" items={queues["meetings-ready"]} />
        <ProspectRailSection queueId="stalled-opportunities" items={queues["stalled-opportunities"]} />
      </CardContent>
    </Card>
  )
}
