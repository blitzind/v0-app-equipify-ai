"use client"

import Link from "next/link"
import { Loader2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GrowthEngineCard, GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  buildGrowthCampaignsHubActiveCampaignRows,
  formatGrowthCampaignsRelativeTime,
} from "@/lib/growth/hubs/growth-campaigns-hub-active-campaigns"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
  GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"
import { taskStatusLabel } from "@/lib/growth/multichannel/multichannel-types"
import { useGrowthCampaignsHubMetrics } from "@/components/growth/hubs/campaigns/use-growth-campaigns-hub-metrics"

export function GrowthCampaignsHubActiveCampaigns() {
  const { loading, metrics } = useGrowthCampaignsHubMetrics()
  const rows = buildGrowthCampaignsHubActiveCampaignRows(metrics)

  return (
    <section aria-labelledby="campaigns-hub-active-campaigns-heading" data-section="active-campaigns">
      <GrowthEngineCard title="Active Campaigns">
        <h2 id="campaigns-hub-active-campaigns-heading" className="sr-only">
          Active campaigns
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading campaigns…
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border/80 bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Leads</th>
                  <th className="px-4 py-3 font-medium">Replies</th>
                  <th className="px-4 py-3 font-medium">Meetings</th>
                  <th className="px-4 py-3 font-medium">Last Activity</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                    <td className="px-4 py-3">
                      <GrowthBadge
                        label={row.status === "active" ? "active" : taskStatusLabel(row.status as never)}
                        tone="neutral"
                      />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.leads}</td>
                    <td className="px-4 py-3 tabular-nums">{row.replies}</td>
                    <td className="px-4 py-3 tabular-nums">{row.meetings}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatGrowthCampaignsRelativeTime(row.lastActivity)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={row.href}>Open</Link>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`${GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF}?enrollmentId=${encodeURIComponent(row.id)}`}>
                            Pause
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={row.href}>Resume</Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" aria-label={`More actions for ${row.name}`}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF}>Sequence execution</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF}>Booking intelligence</Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GrowthEngineCard>
    </section>
  )
}
