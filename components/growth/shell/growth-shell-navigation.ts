/**
 * Growth workspace shell navigation — re-exports registry-derived nav (Phase 2C).
 * @deprecated Import from `@/lib/growth/navigation/growth-workspace-shell-navigation` for new code.
 */

export {
  GROWTH_SHELL_NAV_GROUPS,
  GROWTH_SHELL_NAV_QA_MARKER,
  GROWTH_SHELL_NAV_SECONDARY_IDS,
  GROWTH_WORKSPACE_SHELL_NAV_MANIFEST,
  GROWTH_WORKSPACE_FIRST_UX_1A_SHELL_NAV_MANIFEST,
  GROWTH_WORKSPACE_SHELL_NAV_UX_1A_QA_MARKER,
  buildGrowthWorkspaceShellNavGroups,
  isGrowthShellNavItemActive,
  isGrowthWorkspaceFirstUx1aShellNavActive,
  listGrowthWorkspaceShellNavHrefs,
  resolveGrowthWorkspaceShellNavManifest,
  resolveGrowthWorkspaceShellNavQaMarker,
  validateGrowthWorkspaceShellNavRegistryParity,
  type GrowthShellNavGroup,
  type GrowthShellNavItem,
  type GrowthWorkspaceShellNavParityIssue,
} from "@/lib/growth/navigation/growth-workspace-shell-navigation"
