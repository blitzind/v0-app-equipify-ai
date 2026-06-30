/** GROWTH-WORKSPACE-SIDEBAR-DISCOVERABILITY-1C — sidebar discoverability certification marker. */
export const GROWTH_WORKSPACE_SIDEBAR_DISCOVERABILITY_1C_QA_MARKER =
  "growth-workspace-sidebar-discoverability-1c-v1" as const

/** Revenue modules promoted from Cmd+K-only to visible sidebar in polish 1C. */
export const GROWTH_WORKSPACE_SIDEBAR_DISCOVERABLE_REVENUE_MODULES = [
  {
    id: "conversations",
    label: "Conversations",
    href: "/growth/conversations",
    registryRouteId: "workspace-conversations",
  },
  {
    id: "opportunities",
    label: "Opportunities",
    href: "/growth/opportunities",
    registryRouteId: "workspace-opportunities",
  },
  {
    id: "relationships",
    label: "Relationships",
    href: "/growth/relationships",
    registryRouteId: "workspace-relationships",
  },
] as const
