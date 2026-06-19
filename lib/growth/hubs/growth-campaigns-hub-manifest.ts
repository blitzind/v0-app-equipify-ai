import { Layers, PlayCircle } from "lucide-react"
import { GROWTH_CAMPAIGNS_HUB_QUICK_LINKS } from "@/lib/growth/hubs/growth-campaigns-hub-config"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
  GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"
import type { GrowthWorkspaceHubManifest } from "@/lib/growth/hubs/growth-workspace-hub-types"

export const GROWTH_CAMPAIGNS_HUB_MANIFEST: GrowthWorkspaceHubManifest = {
  id: "campaigns",
  title: "Campaigns",
  description: "Daily campaign operations — triage sequence tasks, booking follow-ups, and channel health.",
  icon: Layers,
  iconClassName: "bg-violet-50 text-violet-700",
  overview: [
    { id: "sequence-execution", label: "Sequence Execution", hint: "Approve and monitor outbound steps" },
    { id: "booking-intelligence", label: "Booking Intelligence", hint: "Meeting intent and booking routing" },
    { id: "campaign-health", label: "Campaign Health", hint: "Running, attention, and stalled signals" },
  ],
  quickActions: GROWTH_CAMPAIGNS_HUB_QUICK_LINKS.map((link) => ({
    id: link.id,
    label: link.label,
    description: "",
    href: link.href,
    icon: link.icon,
  })),
  sections: [
    {
      id: "sequence-execution",
      title: "Sequence Execution",
      description: "Human-approved sequence orchestration queue.",
      drilldowns: [
        {
          id: "execution",
          label: "Open Sequence Execution",
          description: "Review pending approvals and automation queues",
          href: GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
        },
      ],
      emptyHint: "No sequence execution tasks yet.",
    },
    {
      id: "booking-intelligence",
      title: "Booking Intelligence",
      description: "Meeting recommendations and conversion attribution.",
      drilldowns: [
        {
          id: "bookings",
          label: "Open Booking Intelligence",
          description: "Review booking recommendations",
          href: GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
        },
      ],
      emptyHint: "No booking intelligence events yet.",
    },
  ],
}

export const GROWTH_CAMPAIGNS_HUB_SECONDARY_DESTINATIONS = [
  { action: "Sequence Execution", href: GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF, icon: PlayCircle },
  { action: "Booking Intelligence", href: GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF },
] as const
