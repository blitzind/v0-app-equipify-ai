import {
  BarChart3,
  Clapperboard,
  FolderOpen,
  LayoutTemplate,
  Settings,
  Upload,
  Video,
} from "lucide-react"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import type { GrowthWorkspaceHubManifest } from "@/lib/growth/hubs/growth-workspace-hub-types"

const BASE = `${GROWTH_WORKSPACE_BASE_PATH}/videos`

export const GROWTH_VIDEOS_HUB_MANIFEST: GrowthWorkspaceHubManifest = {
  id: "videos",
  title: "Videos",
  description:
    "Recording studio foundation — library, capture modes, templates, analytics, and settings for personalized video pages.",
  icon: Video,
  iconClassName: "bg-violet-50 text-violet-600",
  overview: [
    { id: "library", label: "Library", hint: "Open video library" },
    { id: "record", label: "Record", hint: "Open recording studio" },
    { id: "templates", label: "Templates", hint: "Open templates" },
    { id: "views", label: "Views (7d)", hint: "Open analytics" },
  ],
  quickActions: [
    {
      id: "library",
      label: "Video library",
      description: "Browse drafts, ready assets, and uploads.",
      href: `${BASE}/library`,
      icon: FolderOpen,
    },
    {
      id: "record",
      label: "Record video",
      description: "Webcam, screen, or screen + webcam capture.",
      href: `${BASE}/record`,
      icon: Clapperboard,
    },
    {
      id: "templates",
      label: "Templates",
      description: "Reusable layouts for personalized video pages.",
      href: `${BASE}/templates`,
      icon: LayoutTemplate,
    },
    {
      id: "upload",
      label: "Upload video",
      description: "Upload placeholder — recording studio foundation only.",
      href: `${BASE}/library`,
      icon: Upload,
      variant: "outline",
    },
    {
      id: "analytics",
      label: "Analytics",
      description: "Views, watch rate, CTA clicks, and meetings booked.",
      href: `${BASE}/analytics`,
      icon: BarChart3,
      variant: "outline",
    },
    {
      id: "settings",
      label: "Settings",
      description: "Storage, branding, permissions, and recording defaults.",
      href: `${BASE}/settings`,
      icon: Settings,
      variant: "outline",
    },
  ],
  sections: [
    {
      id: "library",
      title: "Video Library",
      description: "Central asset library for operator-recorded and uploaded videos.",
      drilldowns: [
        {
          id: "open-library",
          label: "Open library",
          description: "Search, filter, and manage video assets.",
          href: `${BASE}/library`,
        },
      ],
      emptyHint: "Record or upload videos to populate the library.",
    },
    {
      id: "recording",
      title: "Recording Studio",
      description: "Capture modes are scaffolded — implementation arrives in a later phase.",
      drilldowns: [
        {
          id: "record",
          label: "Open recording studio",
          description: "Webcam, screen, and PiP recording placeholders.",
          href: `${BASE}/record`,
        },
      ],
    },
    {
      id: "templates",
      title: "Templates",
      description: "Template library for future personalized video pages.",
      drilldowns: [
        {
          id: "templates",
          label: "Open templates",
          description: "Browse reusable video templates.",
          href: `${BASE}/templates`,
        },
      ],
    },
    {
      id: "analytics",
      title: "Analytics Snapshot",
      description: "Passive engagement metrics — no sends or enrollments from this hub.",
      drilldowns: [
        {
          id: "analytics",
          label: "Open analytics",
          description: "Views, watch rate, CTA clicks, meetings booked.",
          href: `${BASE}/analytics`,
        },
      ],
      emptyHint: "Analytics populate after viewers interact with published video pages.",
    },
  ],
}
