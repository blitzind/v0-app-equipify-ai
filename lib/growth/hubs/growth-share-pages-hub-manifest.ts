import { BarChart3, FileText, Layers, LayoutTemplate, Plus, Sparkles } from "lucide-react"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import { GROWTH_SHARE_PAGES_HUB_MANAGE_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"
import type { GrowthWorkspaceHubManifest } from "@/lib/growth/hubs/growth-workspace-hub-types"

const BASE = GROWTH_WORKSPACE_BASE_PATH

export const GROWTH_SHARE_PAGES_HUB_MANIFEST: GrowthWorkspaceHubManifest = {
  id: "share-pages",
  title: "Share Pages",
  description:
    "Content hub for personalized share pages — create, template, attach media, and review performance without restoring sidebar drill-downs.",
  icon: FileText,
  iconClassName: "bg-emerald-50 text-emerald-600",
  overview: [
    { id: "published", label: "Published", hint: "Manage share pages" },
    { id: "drafts", label: "Drafts", hint: "Manage share pages" },
    { id: "templates", label: "Templates", hint: "Open templates" },
    { id: "cta-clicks", label: "CTA clicks (7d)", hint: "Manage share pages" },
  ],
  quickActions: [
    {
      id: "manage-share-pages",
      label: "Manage share pages",
      description: "Create, preview, approve, and review personalized pages.",
      href: GROWTH_SHARE_PAGES_HUB_MANAGE_HREF,
      icon: Plus,
    },
    {
      id: "templates",
      label: "Templates",
      description: "Reusable share page templates (sidebar drill-down).",
      href: `${BASE}/share-pages/templates`,
      icon: LayoutTemplate,
    },
    {
      id: "media",
      label: "Media assets",
      description: "Video, voice, and media library for share pages.",
      href: `${BASE}/media`,
      icon: Layers,
    },
    {
      id: "engagement",
      label: "Engagement",
      description: "Engagement intelligence for templates and share pages.",
      href: `${BASE}/engagement`,
      icon: BarChart3,
      variant: "outline",
    },
  ],
  sections: [
    {
      id: "recent-share-pages",
      title: "Recent Share Pages",
      description: "Latest personalized pages — open the manager for the full list.",
      drilldowns: [
        {
          id: "manage",
          label: "Manage share pages",
          description: "Full operator panel for create, preview, and approval.",
          href: GROWTH_SHARE_PAGES_HUB_MANAGE_HREF,
        },
      ],
      emptyHint: "Recent pages surface in the share page manager after you open records.",
    },
    {
      id: "templates",
      title: "Templates",
      description: "Template library drill-down — not restored to the primary sidebar.",
      drilldowns: [
        {
          id: "templates",
          label: "Open templates",
          description: "Browse, edit, and publish share page templates.",
          href: `${BASE}/share-pages/templates`,
        },
        {
          id: "new-template",
          label: "New template",
          description: "Start a new reusable share page template.",
          href: `${BASE}/share-pages/templates/new`,
        },
      ],
    },
    {
      id: "media-assets",
      title: "Media Assets",
      description: "Attach media assets used by share pages and templates.",
      drilldowns: [
        {
          id: "media",
          label: "Open media library",
          description: "Growth media assets workspace.",
          href: `${BASE}/media`,
        },
      ],
    },
    {
      id: "quick-actions",
      title: "Quick Actions",
      description: "Create and maintain share page content.",
    },
    {
      id: "analytics-snapshot",
      title: "Analytics Snapshot",
      description: "Passive delivery analytics — no sends or enrollments from this hub.",
      drilldowns: [
        {
          id: "engagement",
          label: "Engagement dashboard",
          description: "Template and share-page engagement intelligence.",
          href: `${BASE}/engagement`,
        },
        {
          id: "manage",
          label: "Share page manager",
          description: "Per-page analytics in the operator manager.",
          href: GROWTH_SHARE_PAGES_HUB_MANAGE_HREF,
        },
      ],
      emptyHint: "Analytics rollups appear in Engagement and the share page manager.",
    },
  ],
}
