/**
 * GE-AUTO-UI-5 — Growth settings shell tokens mirror Core Workspace Settings exactly.
 * Growth-only chrome (header card) uses separate tokens below.
 */

export {
  WORKSPACE_SETTINGS_SHELL_MAIN_INNER as GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER,
  WORKSPACE_SETTINGS_SHELL_ROOT as GROWTH_WORKSPACE_SETTINGS_SHELL_ROOT,
  WORKSPACE_SETTINGS_SHELL_BODY as GROWTH_WORKSPACE_SETTINGS_SHELL_BODY,
} from "@/lib/settings/workspace-settings-shell-tokens"

/** Growth settings content column — no Core mobile bottom-nav pb-24 reserve. */
export const GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT = "flex-1 min-w-0 w-full pb-6" as const

export const GROWTH_WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER =
  "growth-workspace-settings-shell-layout-ui-5-v1" as const

/** Growth settings hub header — full width, outside Core body/nav split. */
export const GROWTH_WORKSPACE_SETTINGS_SHELL_HEADER =
  "w-full min-w-0 max-w-none rounded-2xl border border-border bg-card p-5 shadow-sm" as const

/** Desktop nav width matches Core `WORKSPACE_SETTINGS_SHELL_SIDEBAR_DESKTOP` (w-56). */
export const GROWTH_WORKSPACE_SETTINGS_SHELL_SIDEBAR =
  "w-full shrink-0 rounded-xl border border-border bg-card p-3 shadow-sm md:sticky md:top-4 md:w-56 md:self-start" as const

export function assertGrowthWorkspaceSettingsMainInnerHasNoMaxWidth(classes: string): void {
  if (/\bmax-w-/.test(classes) && !/\bmax-w-none\b/.test(classes)) {
    throw new Error("Growth settings main inner must not cap max-width")
  }
  if (/\bmx-auto\b/.test(classes)) {
    throw new Error("Growth settings main inner must not center with mx-auto")
  }
}
