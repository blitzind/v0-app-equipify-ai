"use client"

import { BarChart3, CalendarCheck, MousePointerClick, Percent } from "lucide-react"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"

const METRIC_CARDS = [
  { id: "views", label: "Views", value: "—", icon: BarChart3 },
  { id: "watch-rate", label: "Watch Rate", value: "—", icon: Percent },
  { id: "cta-clicks", label: "CTA Clicks", value: "—", icon: MousePointerClick },
  { id: "meetings-booked", label: "Meetings Booked", value: "—", icon: CalendarCheck },
] as const

export function GrowthVideoAnalyticsShell() {
  return (
    <GrowthVideoWorkspaceShell
      title="Video Analytics"
      description="Passive engagement metrics for personalized video pages."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METRIC_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">Placeholder — analytics service wired in A1 foundation.</p>
            </div>
          )
        })}
      </div>
    </GrowthVideoWorkspaceShell>
  )
}
