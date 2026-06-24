/**
 * Growth workspace settings shell layout tokens (GE-AUTO-UI-3).
 * Mirrors Core `workspace-settings-shell-tokens.ts` for full-width settings pages.
 */

import {
  WORKSPACE_SETTINGS_SHELL_MAIN_INNER,
} from "@/lib/workspace/workspace-shell-tokens"

export const GROWTH_WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER =
  "growth-workspace-settings-shell-layout-ui-4-v1" as const

/** Reuse Core settings main inner — full width, no max-w cap. */
export const GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER = WORKSPACE_SETTINGS_SHELL_MAIN_INNER

export const GROWTH_WORKSPACE_SETTINGS_SHELL_ROOT =
  "flex w-full min-w-0 max-w-none flex-col gap-6" as const

export const GROWTH_WORKSPACE_SETTINGS_SHELL_HEADER =
  "w-full min-w-0 max-w-none rounded-2xl border border-border bg-card p-5 shadow-sm" as const

export const GROWTH_WORKSPACE_SETTINGS_SHELL_BODY =
  "flex w-full min-w-0 max-w-none flex-col gap-6 lg:flex-row lg:items-start" as const

/** Content column to the right of the settings nav — expands to fill remaining width. */
export const GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT =
  "flex-1 min-w-0 w-full max-w-none" as const

/** Desktop settings nav — fixed width, does not shrink. */
export const GROWTH_WORKSPACE_SETTINGS_SHELL_SIDEBAR =
  "w-full shrink-0 rounded-xl border border-border bg-card p-3 shadow-sm lg:sticky lg:top-6 lg:w-64" as const

export function growthWorkspaceSettingsMainInnerClasses(isSettingsRoute: boolean): string {
  return isSettingsRoute ? GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER : ""
}

export function assertGrowthWorkspaceSettingsMainInnerHasNoMaxWidth(classes: string): void {
  if (/\bmax-w-/.test(classes) && !/\bmax-w-none\b/.test(classes)) {
    throw new Error("Growth settings main inner must not cap max-width")
  }
  if (/\bmx-auto\b/.test(classes)) {
    throw new Error("Growth settings main inner must not center with mx-auto")
  }
}
