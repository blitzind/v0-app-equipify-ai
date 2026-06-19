"use client"

import Link from "next/link"
import { PlayCircle, CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
  GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"

export function GrowthCampaignsHubHeaderActions() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" asChild>
        <Link href={GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF}>
          <PlayCircle className="mr-1.5 size-4" aria-hidden />
          Sequence Execution
        </Link>
      </Button>
      <Button type="button" variant="outline" size="sm" asChild>
        <Link href={GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF}>
          <CalendarClock className="mr-1.5 size-4" aria-hidden />
          Booking Intelligence
        </Link>
      </Button>
    </div>
  )
}
