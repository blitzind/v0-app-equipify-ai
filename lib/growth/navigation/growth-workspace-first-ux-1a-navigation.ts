/**
 * GE-AIOS-UX-1A — Workspace-first operator sidebar manifest (client-safe labels only).
 *
 * Identity-agnostic: nav labels never include the configured assistant name.
 * Routes reuse existing registry entries — presentation-only Phase 1.
 */

import type { LucideIcon } from "lucide-react"
import {
  GraduationCap,
  Inbox,
  LayoutGrid,
  Search,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCircle,
  Users,
} from "lucide-react"
import {
  GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS,
} from "@/lib/growth/navigation/growth-workspace-first-ux-1a-labels"
import { GROWTH_REVIEW_PAGE_HREF } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"

export const GROWTH_WORKSPACE_FIRST_UX_1A_GROUP_IDS = ["operator-primary", "tools"] as const

export type GrowthWorkspaceFirstUx1aGroupId = (typeof GROWTH_WORKSPACE_FIRST_UX_1A_GROUP_IDS)[number]

/** Primary + Tools nav item ids — order matches sidebar manifest. */
export const GROWTH_WORKSPACE_FIRST_UX_1A_OPERATOR_NAV_IDS = [
  "workspace",
  "review",
  "inbox",
  "meetings",
  "pipeline",
  "find-companies",
  "leads",
  "training",
  "about",
  "settings",
] as const

export type GrowthWorkspaceFirstUx1aNavManifestEntry = {
  id: string
  label: string
  icon: LucideIcon
  registryRouteId: string
  workspaceRoute?: boolean
  hrefOverride?: string
}

export type GrowthWorkspaceFirstUx1aNavManifestGroup = {
  id: GrowthWorkspaceFirstUx1aGroupId
  /** Empty string hides the group header in the workspace shell sidebar. */
  label: string
  items: GrowthWorkspaceFirstUx1aNavManifestEntry[]
}

/**
 * Canonical UX-1A sidebar — six operator destinations + Tools section.
 * Diagnostics is intentionally excluded (Phase 7).
 */
export const GROWTH_WORKSPACE_FIRST_UX_1A_NAV_MANIFEST: GrowthWorkspaceFirstUx1aNavManifestGroup[] = [
  {
    id: "operator-primary",
    label: "",
    items: [
      {
        id: "workspace",
        label: GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.workspace,
        registryRouteId: "workspace-dashboard",
        icon: LayoutGrid,
        workspaceRoute: true,
      },
      {
        id: "review",
        label: GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.review,
        registryRouteId: "workspace-human-approval-center",
        icon: ShieldCheck,
        workspaceRoute: true,
        hrefOverride: GROWTH_REVIEW_PAGE_HREF,
      },
      {
        id: "inbox",
        label: GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.inbox,
        registryRouteId: "workspace-inbox",
        icon: Inbox,
        workspaceRoute: true,
      },
      {
        id: "meetings",
        label: GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.meetings,
        registryRouteId: "workspace-meetings",
        icon: Users,
        workspaceRoute: true,
      },
      {
        id: "pipeline",
        label: GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.pipeline,
        registryRouteId: "workspace-opportunities",
        icon: TrendingUp,
        workspaceRoute: true,
      },
    ],
  },
  {
    id: "tools",
    label: GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.tools,
    items: [
      {
        id: "find-companies",
        label: GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.findCompanies,
        registryRouteId: "workspace-audiences",
        icon: Search,
        workspaceRoute: true,
      },
      {
        id: "leads",
        label: GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.leads,
        registryRouteId: "workspace-leads",
        icon: Target,
        workspaceRoute: true,
      },
      {
        id: "training",
        label: GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.training,
        registryRouteId: "workspace-training",
        icon: GraduationCap,
        workspaceRoute: true,
      },
      {
        id: "about",
        label: GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.about,
        registryRouteId: "workspace-ava-about",
        icon: UserCircle,
        workspaceRoute: true,
      },
      {
        id: "settings",
        label: GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.settings,
        registryRouteId: "workspace-settings",
        icon: Settings,
        workspaceRoute: true,
      },
    ],
  },
]

/** Operator-visible labels that must not appear in UX-1A navigation chrome. */
export const GROWTH_WORKSPACE_FIRST_UX_1A_FORBIDDEN_NAV_LABELS = [
  "AI OS",
  "Ava",
  "Nova",
  "Home",
  "Completed Work",
  "Human Approval Center",
  "Sequence Execution",
  "Campaigns",
  "Apollo Queue",
  "AI Operations",
  "About Your AI",
  "More",
] as const
