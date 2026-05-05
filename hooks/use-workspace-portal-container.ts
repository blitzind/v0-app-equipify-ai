"use client"

import { useWorkspaceAppearanceOptional } from "@/lib/workspace-appearance-context"

/** Radix `Portal` `container` — themed workspace shell, else body default. */
export function useWorkspacePortalContainer(): HTMLElement | undefined {
  const ctx = useWorkspaceAppearanceOptional()
  return ctx?.portalContainer ?? undefined
}
