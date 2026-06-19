"use client"

import Link from "next/link"
import { Loader2 } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { channelTypeLabel, taskStatusLabel } from "@/lib/growth/multichannel/multichannel-types"
import { GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"
import { useGrowthCampaignsHubMetrics } from "@/components/growth/hubs/campaigns/use-growth-campaigns-hub-metrics"

function taskEmoji(channel: string): string {
  if (channel === "manual_call") return "🔥"
  if (channel === "manual_followup" || channel === "email") return "⚡"
  if (channel === "booking_followup") return "📅"
  return "✉️"
}

export function GrowthCampaignsHubMyTasks() {
  const { loading, metrics } = useGrowthCampaignsHubMetrics()
  const tasks = metrics.taskQueue.slice(0, 6)

  return (
    <section id="my-tasks" aria-labelledby="campaigns-hub-my-tasks-heading" data-section="my-tasks">
      <GrowthEngineCard title="My Tasks">
        <h2 id="campaigns-hub-my-tasks-heading" className="sr-only">
          My tasks
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading tasks…
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No channel tasks in queue.{" "}
            <Link href={GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF} className="font-medium text-primary hover:underline">
              Open sequence execution
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-border/70 rounded-xl border border-border/80">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF}
                  className="flex flex-col gap-1 px-4 py-3 text-sm transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-foreground">
                    <span aria-hidden className="mr-2">
                      {taskEmoji(task.channel)}
                    </span>
                    {task.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {task.leadLabel} · {channelTypeLabel(task.channel)} · {taskStatusLabel(task.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>
    </section>
  )
}
