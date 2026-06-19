/**
 * Video workspace tab navigation (Phase A1).
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_VIDEO_WORKSPACE_NAV_QA_MARKER = "growth-video-workspace-nav-a1-v1" as const

export type GrowthVideoWorkspaceTab = {
  id: string
  label: string
  href: string
  description: string
}

const BASE = `${GROWTH_WORKSPACE_BASE_PATH}/videos`

export const GROWTH_VIDEO_WORKSPACE_TABS: GrowthVideoWorkspaceTab[] = [
  {
    id: "library",
    label: "Library",
    href: `${BASE}/library`,
    description: "Browse recorded and uploaded video assets.",
  },
  {
    id: "pages",
    label: "Pages",
    href: `${BASE}/pages`,
    description: "Branded shareable video pages with CTAs and calendar blocks.",
  },
  {
    id: "record",
    label: "Record",
    href: `${BASE}/record`,
    description: "Webcam, screen, and picture-in-picture recording studio.",
  },
  {
    id: "templates",
    label: "Templates",
    href: `${BASE}/templates`,
    description: "Reusable video page and recording templates.",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: `${BASE}/analytics`,
    description: "Views, watch rate, CTA clicks, and meetings booked.",
  },
  {
    id: "jobs",
    label: "Jobs",
    href: `${BASE}/jobs`,
    description: "Persistent media generation jobs for voice, avatar, and video workflows.",
  },
  {
    id: "settings",
    label: "Settings",
    href: `${BASE}/settings`,
    description: "Storage, branding, permissions, and recording defaults.",
  },
]

const TAB_ROUTES = new Set(GROWTH_VIDEO_WORKSPACE_TABS.map((tab) => tab.href))

export function isGrowthVideoTabRoute(pathname: string): boolean {
  return TAB_ROUTES.has(pathname) || pathname === BASE
}

export function resolveGrowthVideoActiveTabId(pathname: string): string | null {
  if (pathname.startsWith(`${BASE}/pages`)) return "pages"
  if (pathname === `${BASE}/library` || pathname.startsWith(`${BASE}/library/`)) return "library"
  if (pathname === `${BASE}/record`) return "record"
  if (pathname === `${BASE}/templates`) return "templates"
  if (pathname === `${BASE}/analytics`) return "analytics"
  if (pathname === `${BASE}/jobs`) return "jobs"
  if (pathname === `${BASE}/settings`) return "settings"
  if (pathname === BASE) return "library"
  return null
}
