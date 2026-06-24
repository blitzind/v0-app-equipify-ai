"use client"

import { useLayoutEffect } from "react"
import {
  WORKSPACE_SHELL_MAIN_CONTENT_ID,
  WORKSPACE_SHELL_QA_MARKER,
} from "@/lib/workspace/workspace-shell-tokens"

export const GROWTH_SETTINGS_SHELL_WIDTH_ENFORCER_QA_MARKER =
  "growth-settings-shell-width-enforcer-ui-5-v1" as const

const FULL_WIDTH_CLASSES = ["w-full", "min-w-0", "max-w-none", "mx-0"] as const
const CAPPED_CLASSES = ["max-w-[1440px]", "mx-auto"] as const
const AIDEN_PADDING_CLASSES = ["growth-aiden-safe-area-pr", "growth-aiden-safe-area-pb-scroll"] as const

function resolveWorkspaceMainInner(): HTMLElement | null {
  const main = document.getElementById(WORKSPACE_SHELL_MAIN_CONTENT_ID)
  if (!main) return null

  const marked = main.querySelector<HTMLElement>(`[data-qa-marker="${WORKSPACE_SHELL_QA_MARKER}"]`)
  if (marked) return marked

  const firstChild = main.firstElementChild
  return firstChild instanceof HTMLElement ? firstChild : null
}

/** Ensures the Growth workspace main inner is uncapped while settings shell is mounted. */
export function GrowthSettingsShellWidthEnforcer() {
  useLayoutEffect(() => {
    const inner = resolveWorkspaceMainInner()
    if (!inner) return

    inner.dataset.growthSettingsFullWidth = "true"
    inner.dataset.growthSettingsShellParity = "core-matched"
    inner.dataset.growthSettingsWidthEnforcer = GROWTH_SETTINGS_SHELL_WIDTH_ENFORCER_QA_MARKER
    for (const className of CAPPED_CLASSES) inner.classList.remove(className)
    for (const className of AIDEN_PADDING_CLASSES) inner.classList.remove(className)
    for (const className of FULL_WIDTH_CLASSES) inner.classList.add(className)

    return () => {
      delete inner.dataset.growthSettingsWidthEnforcer
    }
  }, [])

  return null
}
