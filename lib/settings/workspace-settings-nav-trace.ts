/** PROD-HOTFIX — temporary navigation render trace (growth settings routes). */

export const WORKSPACE_SETTINGS_NAV_TRACE_QA_MARKER = "workspace-settings-nav-trace-v1" as const

export function traceWorkspaceSettingsNavigation(
  event: string,
  details: Record<string, unknown> = {},
): void {
  console.info("[workspace-settings-nav-trace]", {
    marker: WORKSPACE_SETTINGS_NAV_TRACE_QA_MARKER,
    event,
    ...details,
  })
}
