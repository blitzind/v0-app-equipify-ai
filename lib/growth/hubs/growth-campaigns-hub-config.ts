import type { LucideIcon } from "lucide-react"
import { CalendarClock, Layers, PlayCircle } from "lucide-react"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
  GROWTH_CAMPAIGNS_HUB_HREF,
  GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"

export const GROWTH_CAMPAIGNS_HUB_UX_QA_MARKER = "growth-campaigns-hub-operator-home-v1" as const

export type GrowthCampaignsHubQuickLink = {
  id: string
  label: string
  href: string
  icon: LucideIcon
}

export const GROWTH_CAMPAIGNS_HUB_QUICK_LINKS: GrowthCampaignsHubQuickLink[] = [
  {
    id: "sequence-execution",
    label: "Sequence Execution",
    href: GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
    icon: PlayCircle,
  },
  {
    id: "booking-intelligence",
    label: "Booking Intelligence",
    href: GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
    icon: CalendarClock,
  },
  {
    id: "campaigns-home",
    label: "Campaigns Home",
    href: GROWTH_CAMPAIGNS_HUB_HREF,
    icon: Layers,
  },
]

export const GROWTH_CAMPAIGNS_HUB_PERFORMANCE_METRICS = [
  { id: "emails-sent", label: "Emails Sent", metricKey: "emailsSent" as const },
  { id: "open-rate", label: "Open Rate", metricKey: "openRate" as const, suffix: "%" },
  { id: "reply-rate", label: "Reply Rate", metricKey: "replyRate" as const, suffix: "%" },
  { id: "meetings-booked", label: "Meetings Booked", metricKey: "meetingsBooked" as const },
  { id: "pipeline-created", label: "Pipeline Created", metricKey: "pipelineCreated" as const },
] as const
