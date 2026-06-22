/**
 * Workspace Settings shell layout tokens (GS-GROWTH-SETTINGS-LAYOUT-1A).
 * Client-safe — use in settings layout, PageShell, and regression tests.
 */

import { WORKSPACE_SETTINGS_SHELL_MAIN_INNER } from "@/lib/workspace/workspace-shell-tokens"

export const WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER = "workspace-settings-shell-layout-1a-v1" as const

export { WORKSPACE_SETTINGS_SHELL_MAIN_INNER }

export const WORKSPACE_SETTINGS_SHELL_ROOT = "flex w-full min-w-0 flex-col gap-0 md:gap-5" as const

export const WORKSPACE_SETTINGS_SHELL_BODY =
  "flex w-full min-w-0 gap-6 md:gap-8 items-start mt-3 md:mt-0" as const

export const WORKSPACE_SETTINGS_SHELL_CONTENT = "flex-1 min-w-0 w-full pb-24 md:pb-6" as const

/** Desktop settings nav — fixed width, does not shrink. */
export const WORKSPACE_SETTINGS_SHELL_SIDEBAR_DESKTOP =
  "hidden md:flex w-56 shrink-0 flex-col gap-4 sticky top-4 self-start" as const

export function isWorkspaceSettingsPathname(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/")
}
