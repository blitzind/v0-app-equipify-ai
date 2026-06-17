import { Headphones, History, Phone, PhoneCall, Radio, Sparkles } from "lucide-react"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import { GROWTH_CALLS_HUB_WORKSPACE_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"
import type { GrowthWorkspaceHubManifest } from "@/lib/growth/hubs/growth-workspace-hub-types"

const BASE = GROWTH_WORKSPACE_BASE_PATH

export const GROWTH_CALLS_HUB_MANIFEST: GrowthWorkspaceHubManifest = {
  id: "calls",
  title: "Calls",
  description:
    "Call operations hub — queue, live sessions, coaching, and the unified call workspace without provider setup.",
  icon: Phone,
  iconClassName: "bg-sky-50 text-sky-600",
  overview: [
    { id: "queue-today", label: "Queue today", hint: "Open call queue" },
    { id: "live-now", label: "Live now", hint: "Open live calls" },
    { id: "completed-today", label: "Completed today", hint: "Open call workspace" },
    { id: "coaching-open", label: "Coaching open", hint: "Open live coaching" },
  ],
  quickActions: [
    {
      id: "call-workspace",
      label: "Call workspace",
      description: "Unified dialer, queue, and embedded call intelligence.",
      href: GROWTH_CALLS_HUB_WORKSPACE_HREF,
      icon: Headphones,
    },
    {
      id: "live-calls",
      label: "Live calls",
      description: "Active live-call sessions and realtime surfaces.",
      href: `${BASE}/calls/live`,
      icon: Radio,
    },
    {
      id: "call-queue",
      label: "Today's queue",
      description: "Ranked leads worth calling next.",
      href: `${BASE}/leads/queue`,
      icon: PhoneCall,
    },
    {
      id: "live-coaching",
      label: "Live coaching",
      description: "Operator coaching during active calls.",
      href: `${BASE}/calls/coaching`,
      icon: Sparkles,
      variant: "outline",
    },
    {
      id: "voice-drops",
      label: "Voice drops",
      description: "Review voice-drop assets and delivery history.",
      href: `${BASE}/calls/voice-drops`,
      icon: History,
      variant: "outline",
    },
  ],
  sections: [
    {
      id: "todays-queue",
      title: "Today's Queue",
      description: "Leads ranked for outbound calling today.",
      drilldowns: [
        {
          id: "queue",
          label: "Open call queue",
          description: "Growth Leads call queue ranked by fit and signals.",
          href: `${BASE}/leads/queue`,
        },
        {
          id: "workspace",
          label: "Call workspace",
          description: "Dial and work leads from the unified call shell.",
          href: GROWTH_CALLS_HUB_WORKSPACE_HREF,
        },
      ],
    },
    {
      id: "upcoming-calls",
      title: "Upcoming Calls",
      description: "Scheduled callbacks and meeting-adjacent call work.",
      drilldowns: [
        {
          id: "meetings",
          label: "Meetings",
          description: "Meeting schedule and prep surfaces.",
          href: `${BASE}/meetings`,
        },
      ],
      emptyHint: "Upcoming call scheduling surfaces from Meetings and the call workspace.",
    },
    {
      id: "recent-calls",
      title: "Recent Calls",
      description: "Recently completed sessions and post-call review entry points.",
      drilldowns: [
        {
          id: "workspace",
          label: "Call workspace",
          description: "Post-call review and session history in the operating shell.",
          href: GROWTH_CALLS_HUB_WORKSPACE_HREF,
        },
        {
          id: "voice-drops",
          label: "Voice drops",
          description: "Voice-drop history and asset review.",
          href: `${BASE}/calls/voice-drops`,
        },
      ],
    },
    {
      id: "call-outcomes",
      title: "Call Outcomes",
      description: "Disposition summaries and outcome follow-ups.",
      drilldowns: [
        {
          id: "workspace-overview",
          label: "Embedded intelligence",
          description: "Open call intelligence overview in the workspace shell.",
          href: `${GROWTH_CALLS_HUB_WORKSPACE_HREF}?view=overview`,
        },
      ],
      emptyHint: "Outcome rollups appear in the call workspace intelligence overview.",
    },
    {
      id: "live-coaching",
      title: "Live Coaching",
      description: "Realtime coaching while operators are on live calls.",
      drilldowns: [
        {
          id: "coaching",
          label: "Open live coaching",
          description: "Coaching panel for active operator calls.",
          href: `${BASE}/calls/coaching`,
        },
        {
          id: "live",
          label: "Live calls",
          description: "Jump into active live-call sessions.",
          href: `${BASE}/calls/live`,
        },
      ],
    },
    {
      id: "quick-actions",
      title: "Quick Actions",
      description: "Fast paths into daily call workflows.",
    },
  ],
}
