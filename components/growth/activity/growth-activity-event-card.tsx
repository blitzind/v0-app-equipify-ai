"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  CalendarCheck,
  Mail,
  PlayCircle,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GROWTH_ACTIVITY_SOURCE_LABELS } from "@/lib/growth/activity/growth-activity-workspace-constants"
import type { GrowthActivityEventView } from "@/lib/growth/activity/growth-activity-workspace-types"

const CATEGORY_ICON: Record<GrowthActivityEventView["category"], LucideIcon> = {
  communication: Mail,
  content: PlayCircle,
  personalization: Wand2,
  sales: CalendarCheck,
  intelligence: Target,
}

const URGENCY_TONE: Record<GrowthActivityEventView["urgency"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-100 text-amber-900",
  high: "bg-orange-100 text-orange-900",
  critical: "bg-rose-100 text-rose-900",
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function sourceLabel(source: string): string {
  return GROWTH_ACTIVITY_SOURCE_LABELS[source] ?? source.replace(/_/g, " ")
}

type Props = {
  event: GrowthActivityEventView
}

export function GrowthActivityEventCard({ event }: Props) {
  const Icon = CATEGORY_ICON[event.category] ?? Activity
  const contextualActions = event.actions.slice(0, 5)

  return (
    <article className="rounded-lg border border-border/70 bg-card shadow-sm">
      <header className="flex items-start gap-3 border-b border-border/50 p-3">
        <div className="mt-0.5 rounded-md bg-muted p-2 text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-semibold">{event.title}</h3>
            <div className="flex items-center gap-2">
              {event.metadata.isUnread ? (
                <Badge variant="outline" className="border-violet-300 text-violet-700">
                  Unread
                </Badge>
              ) : null}
              <Badge className={URGENCY_TONE[event.urgency]} variant="secondary">
                {event.urgency}
              </Badge>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{formatWhen(event.occurredAt)}</p>
        </div>
      </header>

      <div className="space-y-2 p-3">
        {event.description ? <p className="text-sm text-muted-foreground">{event.description}</p> : null}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {event.leadName ? <span>{event.leadName}</span> : null}
          {event.companyName ? <span>{event.companyName}</span> : null}
          {event.score != null ? <span>Score {event.score}</span> : null}
          <span>{sourceLabel(event.source)}</span>
        </div>
      </div>

      {contextualActions.length > 0 ? (
        <footer className="flex flex-wrap gap-1 border-t border-border/50 p-2">
          {contextualActions.map((action) => (
            <Button key={action.id} size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        </footer>
      ) : null}
    </article>
  )
}
